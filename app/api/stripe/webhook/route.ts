import { createAdminClient } from '@/lib/supabase/admin'
import { registrarEventoRt } from '@/lib/planos/auditoria'
import { getPlanoPorStripePriceId } from '@/lib/planos/reformaTributariaPlanos'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

function mapStripeStatus(status: Stripe.Subscription.Status): 'active' | 'past_due' | 'canceled' | 'expired' {
  if (status === 'active' || status === 'trialing') return 'active'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  if (status === 'incomplete_expired') return 'expired'
  return 'canceled'
}

async function upsertAssinaturaRt(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  patch: Record<string, unknown>,
) {
  const { data: existente } = await admin.from('rt_assinaturas').select('id').eq('org_id', orgId).maybeSingle()
  if (!existente) return null
  const { data } = await admin
    .from('rt_assinaturas')
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq('id', existente.id)
    .select()
    .single()
  return data
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Sem assinatura' }, { status: 400 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: `Assinatura inválida: ${err}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Idempotência: se o evento já foi processado, retorna sem reexecutar.
  const { error: erroEvento } = await admin.from('rt_webhook_eventos').insert({ id: event.id, tipo: event.type })
  if (erroEvento) {
    return NextResponse.json({ received: true, duplicado: true })
  }

  // Pagamento concluído — ativar plano
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orgId = session.metadata?.org_id
    const produtoEscopo = session.metadata?.produto_escopo

    if (orgId && produtoEscopo === 'tax_reform_only') {
      const planoCodigo = session.metadata?.plano_codigo
      let dadosCiclo: Record<string, unknown> = {}
      if (typeof session.subscription === 'string') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        const item = subscription.items.data[0]
        dadosCiclo = {
          status: mapStripeStatus(subscription.status),
          periodo_inicio: new Date(subscription.start_date * 1000).toISOString(),
          ciclo_inicio: item ? new Date(item.current_period_start * 1000).toISOString() : null,
          ciclo_fim: item ? new Date(item.current_period_end * 1000).toISOString() : null,
          proxima_renovacao: item ? new Date(item.current_period_end * 1000).toISOString() : null,
          stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
          stripe_subscription_id: subscription.id,
        }
      }
      const assinatura = await upsertAssinaturaRt(admin, orgId, dadosCiclo)
      await registrarEventoRt(admin, {
        orgId,
        assinaturaId: assinatura?.id,
        tipo: 'assinatura_ativada',
        detalhes: { plano_codigo: planoCodigo },
      })
    } else if (orgId) {
      await admin
        .from('organizacoes')
        .update({ plano: 'founder_access', updated_at: new Date().toISOString() })
        .eq('id', orgId)
    }
  }

  // Renovação / mudança de status da assinatura
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const orgId = subscription.metadata?.org_id
    if (orgId && subscription.metadata?.produto_escopo === 'tax_reform_only') {
      const item = subscription.items.data[0]
      const planoAtual = getPlanoPorStripePriceId(item?.price?.id)
      await upsertAssinaturaRt(admin, orgId, {
        status: mapStripeStatus(subscription.status),
        ciclo_inicio: item ? new Date(item.current_period_start * 1000).toISOString() : null,
        ciclo_fim: item ? new Date(item.current_period_end * 1000).toISOString() : null,
        proxima_renovacao: item ? new Date(item.current_period_end * 1000).toISOString() : null,
        cancelamento_solicitado: subscription.cancel_at_period_end ?? false,
        ...(planoAtual ? { plano_codigo: planoAtual.codigo, preco_contratado_centavos: planoAtual.precoCentavos } : {}),
      })
    }
  }

  // Falha de cobrança
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionRef = invoice.parent?.subscription_details?.subscription
    const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id
    if (subscriptionId) {
      const { data: assinatura } = await admin
        .from('rt_assinaturas')
        .select('id, org_id')
        .eq('stripe_subscription_id', subscriptionId)
        .maybeSingle()
      if (assinatura) {
        await admin.from('rt_assinaturas').update({ status: 'past_due', atualizado_em: new Date().toISOString() }).eq('id', assinatura.id)
        await registrarEventoRt(admin, { orgId: assinatura.org_id, assinaturaId: assinatura.id, tipo: 'assinatura_alterada', detalhes: { motivo: 'invoice.payment_failed' } })
      }
    }
  }

  // Assinatura cancelada — suspender acesso
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const orgId = subscription.metadata?.org_id

    if (orgId && subscription.metadata?.produto_escopo === 'tax_reform_only') {
      const item = subscription.items.data[0]
      const assinatura = await upsertAssinaturaRt(admin, orgId, {
        status: 'canceled',
        acesso_ate: item ? new Date(item.current_period_end * 1000).toISOString() : null,
      })
      await registrarEventoRt(admin, { orgId, assinaturaId: assinatura?.id, tipo: 'assinatura_cancelada' })
    } else if (orgId) {
      await admin
        .from('organizacoes')
        .update({ plano: 'pendente', updated_at: new Date().toISOString() })
        .eq('id', orgId)
    }
  }

  return NextResponse.json({ received: true })
}
