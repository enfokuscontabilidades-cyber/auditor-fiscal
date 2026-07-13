import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailAutorizadoParaLeads } from '@/lib/security/adminLeads'
import { getPlanoReformaTributaria } from '@/lib/planos/reformaTributariaPlanos'
import { registrarEventoRt } from '@/lib/planos/auditoria'
import { periodoInicioAtual } from '@/lib/planos/quotaXml'

async function exigirAcesso() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !emailAutorizadoParaLeads(user.email)) return null
  return user
}

export async function GET() {
  const user = await exigirAcesso()
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })

  const admin = createAdminClient()

  const { data: assinaturas, error } = await admin
    .from('rt_assinaturas')
    .select('*, organizacao:organizacoes(id, nome)')
    .order('criado_em', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: slots } = await admin.from('rt_cnpj_slots').select('org_id')
  const contagemSlots = new Map<string, number>()
  for (const s of slots ?? []) contagemSlots.set(s.org_id, (contagemSlots.get(s.org_id) ?? 0) + 1)

  const idsAssinaturas = (assinaturas ?? []).map(a => a.id)
  const { data: usosMensais } = idsAssinaturas.length
    ? await admin.from('rt_uso_mensal').select('assinatura_id, periodo_inicio, xmls_processados').in('assinatura_id', idsAssinaturas)
    : { data: [] as { assinatura_id: string; periodo_inicio: string; xmls_processados: number }[] }

  const usoPorChave = new Map<string, number>()
  for (const u of usosMensais ?? []) usoPorChave.set(`${u.assinatura_id}:${u.periodo_inicio}`, u.xmls_processados)

  const usoPorAssinatura = new Map<string, number>()
  for (const a of assinaturas ?? []) {
    const periodoInicio = periodoInicioAtual(a.ciclo_inicio)
    usoPorAssinatura.set(a.id, usoPorChave.get(`${a.id}:${periodoInicio}`) ?? 0)
  }

  return NextResponse.json((assinaturas ?? []).map(a => ({
    ...a,
    cnpj_slots_usados: contagemSlots.get(a.org_id) ?? 0,
    xmls_usados_ciclo: usoPorAssinatura.get(a.id) ?? 0,
    limite_xml_ciclo: getPlanoReformaTributaria(a.plano_codigo)?.limiteXmlPorCiclo ?? null,
  })))
}

/** Ativação manual de assinatura (sem Stripe) — cobre a seção 19 do briefing. */
export async function POST(request: Request) {
  const user = await exigirAcesso()
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })

  const { orgId, planoCodigo, prazoMeses } = await request.json()
  const plano = getPlanoReformaTributaria(planoCodigo)
  if (!orgId || !plano) return NextResponse.json({ error: 'orgId e planoCodigo são obrigatórios' }, { status: 400 })

  const admin = createAdminClient()

  const agora = new Date()
  const fim = new Date(agora)
  fim.setMonth(fim.getMonth() + (Number(prazoMeses) > 0 ? Number(prazoMeses) : 1))

  const { data: existente } = await admin.from('rt_assinaturas').select('id').eq('org_id', orgId).maybeSingle()

  const payload = {
    org_id: orgId,
    plano_codigo: plano.codigo,
    preco_contratado_centavos: plano.precoCentavos,
    status: 'manual' as const,
    periodo_inicio: agora.toISOString(),
    ciclo_inicio: agora.toISOString(),
    ciclo_fim: fim.toISOString(),
    proxima_renovacao: fim.toISOString(),
    cancelamento_solicitado: false,
    atualizado_em: agora.toISOString(),
  }

  const { data: assinatura, error } = existente
    ? await admin.from('rt_assinaturas').update(payload).eq('id', existente.id).select().single()
    : await admin.from('rt_assinaturas').insert(payload).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('organizacoes').update({ produto_escopo: 'tax_reform_only' }).eq('id', orgId)

  await registrarEventoRt(admin, {
    orgId, assinaturaId: assinatura.id, tipo: 'assinatura_ativada',
    detalhes: { plano_codigo: plano.codigo, via: 'manual', admin_email: user.email },
  })

  return NextResponse.json(assinatura, { status: 201 })
}
