import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailAutorizadoParaLeads } from '@/lib/security/adminLeads'
import { validarCnpj, somenteDigitos } from '@/lib/validacao/documentos'
import { registrarEventoRt } from '@/lib/planos/auditoria'

async function exigirAcesso() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !emailAutorizadoParaLeads(user.email)) return null
  return user
}

/**
 * Única forma de corrigir um CNPJ já vinculado a uma vaga do plano. Exige
 * justificativa e é sempre auditada (rt_correcoes_cnpj + rt_auditoria).
 * Não existe rota equivalente acessível ao cliente.
 */
export async function POST(request: Request) {
  const user = await exigirAcesso()
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })

  const { slotId, cnpjNovo, justificativa } = await request.json() as { slotId?: string; cnpjNovo?: string; justificativa?: string }
  if (!slotId || !cnpjNovo || !justificativa?.trim()) {
    return NextResponse.json({ error: 'slotId, cnpjNovo e justificativa são obrigatórios' }, { status: 400 })
  }

  const cnpjLimpo = somenteDigitos(cnpjNovo)
  if (!validarCnpj(cnpjLimpo)) {
    return NextResponse.json({ error: 'CNPJ inválido: os dígitos verificadores não conferem' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: slot } = await admin.from('rt_cnpj_slots').select('*').eq('id', slotId).single()
  if (!slot) return NextResponse.json({ error: 'Vaga de CNPJ não encontrada' }, { status: 404 })

  const cnpjAnterior = slot.cnpj_normalizado

  const { error: errSlot } = await admin
    .from('rt_cnpj_slots')
    .update({ cnpj_normalizado: cnpjLimpo, status: 'corrigido' })
    .eq('id', slotId)
  if (errSlot) return NextResponse.json({ error: errSlot.message }, { status: 500 })

  await admin.from('empresas').update({ cnpj: cnpjLimpo, updated_at: new Date().toISOString() }).eq('id', slot.empresa_id)

  await admin.from('rt_correcoes_cnpj').insert({
    slot_id: slotId,
    org_id: slot.org_id,
    cnpj_anterior: cnpjAnterior,
    cnpj_novo: cnpjLimpo,
    justificativa: justificativa.trim(),
    admin_email: user.email,
  })

  await registrarEventoRt(admin, {
    orgId: slot.org_id, assinaturaId: slot.assinatura_id, tipo: 'cnpj_corrigido',
    detalhes: { slot_id: slotId, admin_email: user.email }, atorUserId: user.id,
  })

  return NextResponse.json({ ok: true })
}
