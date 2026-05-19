import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    metadata: { org_id: orgId },
    customer_email: user.email,
    success_url: `${origin}/aguardando-ativacao?payment=success`,
    cancel_url: `${origin}/aguardando-ativacao`,
    locale: 'pt-BR',
  })

  return NextResponse.json({ url: session.url })
}
