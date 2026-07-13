import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { getContextoAcesso } from '@/lib/planos/acessoReformaTributaria'
import { registrarEventoRt } from '@/lib/planos/auditoria'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

/**
 * Cancelamento solicitado pelo próprio cliente. Mantém acesso até o fim do
 * período já pago (cancel_at_period_end no Stripe) — nunca revoga na hora,
 * nunca apaga empresas, análises ou relatórios.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const ctx = await getContextoAcesso(supabase, orgId)
  if (ctx.produtoEscopo !== 'tax_reform_only' || !ctx.assinatura) {
    return NextResponse.json({ error: 'Organização sem assinatura de Reforma Tributária' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (ctx.assinatura.stripe_subscription_id) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    await stripe.subscriptions.update(ctx.assinatura.stripe_subscription_id, { cancel_at_period_end: true })
    await admin.from('rt_assinaturas').update({ cancelamento_solicitado: true, atualizado_em: new Date().toISOString() }).eq('id', ctx.assinatura.id)
  } else {
    await admin
      .from('rt_assinaturas')
      .update({
        cancelamento_solicitado: true,
        status: 'canceled',
        acesso_ate: ctx.assinatura.ciclo_fim ?? new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', ctx.assinatura.id)
  }

  await registrarEventoRt(admin, { orgId, assinaturaId: ctx.assinatura.id, tipo: 'assinatura_cancelada', atorUserId: user.id })

  return NextResponse.json({ ok: true })
}
