import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

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

  // Pagamento concluído — ativar plano
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orgId = session.metadata?.org_id

    if (orgId) {
      const admin = createAdminClient()
      await admin
        .from('organizacoes')
        .update({ plano: 'founder_access', updated_at: new Date().toISOString() })
        .eq('id', orgId)
    }
  }

  // Assinatura cancelada — suspender acesso
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const orgId = subscription.metadata?.org_id

    if (orgId) {
      const admin = createAdminClient()
      await admin
        .from('organizacoes')
        .update({ plano: 'pendente', updated_at: new Date().toISOString() })
        .eq('id', orgId)
    }
  }

  return NextResponse.json({ received: true })
}
