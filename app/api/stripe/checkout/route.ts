import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { getPlanoReformaTributaria } from '@/lib/planos/reformaTributariaPlanos'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  let produto: string | undefined
  let planoCodigo: string | undefined
  try {
    const body = await request.json()
    produto = body?.produto
    planoCodigo = body?.planoCodigo
  } catch {
    // corpo vazio — fluxo padrão (Founder Access)
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  let priceId = process.env.STRIPE_PRICE_ID!
  let metadata: Record<string, string> = { org_id: orgId }
  let successUrl = `${origin}/aguardando-ativacao?payment=success`
  let cancelUrl = `${origin}/aguardando-ativacao`

  if (produto === 'reforma_tributaria') {
    const plano = getPlanoReformaTributaria(planoCodigo)
    if (!plano) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

    const envPriceId = process.env[plano.stripePriceEnvVar]
    if (!envPriceId) {
      return NextResponse.json(
        { error: 'Este plano ainda não está disponível para pagamento online. Fale com o suporte para ativação manual.' },
        { status: 503 },
      )
    }

    priceId = envPriceId
    metadata = { org_id: orgId, produto_escopo: 'tax_reform_only', plano_codigo: plano.codigo }
    successUrl = `${origin}/aguardando-ativacao?payment=success&produto=reforma_tributaria&plano=${plano.codigo}`
    cancelUrl = `${origin}/aguardando-ativacao?produto=reforma_tributaria&plano=${plano.codigo}`
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    customer_email: user.email,
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: 'pt-BR',
  })

  return NextResponse.json({ url: session.url })
}
