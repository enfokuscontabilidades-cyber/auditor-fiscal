import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailAutorizadoParaLeads } from '@/lib/security/adminLeads'
import { getPlanoReformaTributaria } from '@/lib/planos/reformaTributariaPlanos'
import { registrarEventoRt } from '@/lib/planos/auditoria'
import type { StatusAssinaturaRt } from '@/lib/types'

async function exigirAcesso() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !emailAutorizadoParaLeads(user.email)) return null
  return user
}

const STATUS_VALIDOS: StatusAssinaturaRt[] = ['pending', 'active', 'past_due', 'canceled', 'expired', 'suspended', 'manual']

/**
 * Ajustes administrativos excepcionais: suspender, reativar, estender prazo,
 * ou forçar troca de plano (inclusive downgrade incompatível com as vagas já
 * ocupadas — exclusivo do admin, sempre auditado).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await exigirAcesso()
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })

  const { id } = await params
  const body = await request.json() as { status?: string; planoCodigo?: string; prazoMeses?: number; justificativa?: string }

  const admin = createAdminClient()
  const { data: atual } = await admin.from('rt_assinaturas').select('*').eq('id', id).single()
  if (!atual) return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() }

  if (body.status) {
    if (!STATUS_VALIDOS.includes(body.status as StatusAssinaturaRt)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (body.planoCodigo) {
    const plano = getPlanoReformaTributaria(body.planoCodigo)
    if (!plano) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
    patch.plano_codigo = plano.codigo
    patch.preco_contratado_centavos = plano.precoCentavos
  }

  if (body.prazoMeses) {
    const fim = new Date()
    fim.setMonth(fim.getMonth() + Number(body.prazoMeses))
    patch.ciclo_fim = fim.toISOString()
    patch.proxima_renovacao = fim.toISOString()
  }

  const { data: atualizada, error } = await admin.from('rt_assinaturas').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await registrarEventoRt(admin, {
    orgId: atual.org_id, assinaturaId: id, tipo: 'assinatura_alterada',
    detalhes: { alteracoes: patch, justificativa: body.justificativa ?? null, admin_email: user.email },
  })

  return NextResponse.json(atualizada)
}
