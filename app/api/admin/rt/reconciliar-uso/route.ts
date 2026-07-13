import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailAutorizadoParaLeads } from '@/lib/security/adminLeads'
import { reconciliarUsoXml, periodoInicioAtual } from '@/lib/planos/quotaXml'
import { registrarEventoRt } from '@/lib/planos/auditoria'

async function exigirAcesso() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !emailAutorizadoParaLeads(user.email)) return null
  return user
}

/**
 * Recalcula o uso real de XMLs do ciclo atual a partir de
 * rt_documentos_processados (fonte de verdade) e grava a trilha de
 * auditoria em rt_reconciliacoes_uso. Nunca é automático — sempre exige
 * justificativa e um admin autenticado (allowlist LEADS_ADMIN_EMAILS).
 */
export async function POST(request: Request) {
  const user = await exigirAcesso()
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })

  const { assinaturaId, justificativa } = await request.json() as { assinaturaId?: string; justificativa?: string }
  if (!assinaturaId || !justificativa?.trim()) {
    return NextResponse.json({ error: 'assinaturaId e justificativa são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: assinatura } = await admin.from('rt_assinaturas').select('id, org_id, ciclo_inicio').eq('id', assinaturaId).single()
  if (!assinatura) return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })

  const periodoInicio = periodoInicioAtual(assinatura.ciclo_inicio)

  let resultado: { valorAnterior: number; valorRecalculado: number }
  try {
    resultado = await reconciliarUsoXml(admin, {
      assinaturaId: assinatura.id,
      periodoInicio,
      adminEmail: user.email ?? 'desconhecido',
      justificativa: justificativa.trim(),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao reconciliar uso' }, { status: 500 })
  }

  await registrarEventoRt(admin, {
    orgId: assinatura.org_id,
    assinaturaId: assinatura.id,
    tipo: 'uso_xml_reconciliado',
    detalhes: {
      periodo_inicio: periodoInicio,
      valor_anterior: resultado.valorAnterior,
      valor_recalculado: resultado.valorRecalculado,
      admin_email: user.email,
    },
    atorUserId: user.id,
  })

  return NextResponse.json(resultado)
}

/** Histórico de reconciliações de uma assinatura, para auditoria na tela admin. */
export async function GET(request: Request) {
  const user = await exigirAcesso()
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const assinaturaId = searchParams.get('assinaturaId')
  if (!assinaturaId) return NextResponse.json({ error: 'assinaturaId é obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('rt_reconciliacoes_uso')
    .select('*')
    .eq('assinatura_id', assinaturaId)
    .order('criado_em', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
