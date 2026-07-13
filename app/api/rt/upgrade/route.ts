import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { getContextoAcesso, getPlanoAtual } from '@/lib/planos/acessoReformaTributaria'
import { getPlanoReformaTributaria } from '@/lib/planos/reformaTributariaPlanos'
import { registrarEventoRt } from '@/lib/planos/auditoria'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

/**
 * Upgrade de plano dentro do produto Reforma Tributária. Nunca cria uma
 * segunda assinatura no Stripe — atualiza o item da assinatura existente
 * (com proration), preservando CNPJs e histórico já vinculados à mesma
 * `rt_assinaturas`. Downgrade não é permitido por aqui (ver seção 23 do
 * briefing) — precisa de ajuste administrativo auditado.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const ctx = await getContextoAcesso(supabase, orgId)
  if (ctx.produtoEscopo !== 'tax_reform_only' || !ctx.assinatura) {
    return NextResponse.json({ error: 'Organização sem assinatura de Reforma Tributária' }, { status: 400 })
  }

  const { planoCodigo } = await request.json()
  const novoPlano = getPlanoReformaTributaria(planoCodigo)
  if (!novoPlano) return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })

  const planoAtual = getPlanoAtual(ctx)
  if (planoAtual?.codigo === novoPlano.codigo) {
    return NextResponse.json({ error: 'Este já é o seu plano atual' }, { status: 400 })
  }
  if (planoAtual && novoPlano.precoCentavos <= planoAtual.precoCentavos) {
    return NextResponse.json({ error: 'Use a área de suporte para reduzir de plano — a troca aqui é somente para upgrade' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Assinatura ativada manualmente pelo admin (sem Stripe) — só atualiza o registro local.
  if (!ctx.assinatura.stripe_subscription_id) {
    await admin
      .from('rt_assinaturas')
      .update({ plano_codigo: novoPlano.codigo, preco_contratado_centavos: novoPlano.precoCentavos, atualizado_em: new Date().toISOString() })
      .eq('id', ctx.assinatura.id)

    await registrarEventoRt(admin, {
      orgId, assinaturaId: ctx.assinatura.id, tipo: 'assinatura_alterada',
      detalhes: { de: planoAtual?.codigo, para: novoPlano.codigo, via: 'manual' }, atorUserId: user.id,
    })
    return NextResponse.json({ ok: true })
  }

  const envPriceId = process.env[novoPlano.stripePriceEnvVar]
  if (!envPriceId) {
    return NextResponse.json({ error: 'Este plano ainda não está disponível para upgrade online. Fale com o suporte.' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const subscription = await stripe.subscriptions.retrieve(ctx.assinatura.stripe_subscription_id)
  const item = subscription.items.data[0]
  if (!item) return NextResponse.json({ error: 'Assinatura sem item ativo no Stripe' }, { status: 500 })

  await stripe.subscriptions.update(ctx.assinatura.stripe_subscription_id, {
    items: [{ id: item.id, price: envPriceId }],
    proration_behavior: 'create_prorations',
    metadata: { org_id: orgId, produto_escopo: 'tax_reform_only', plano_codigo: novoPlano.codigo },
  })

  // Atualização otimista — o webhook customer.subscription.updated confirma com os dados oficiais do Stripe.
  await admin
    .from('rt_assinaturas')
    .update({ plano_codigo: novoPlano.codigo, preco_contratado_centavos: novoPlano.precoCentavos, atualizado_em: new Date().toISOString() })
    .eq('id', ctx.assinatura.id)

  await registrarEventoRt(admin, {
    orgId, assinaturaId: ctx.assinatura.id, tipo: 'assinatura_alterada',
    detalhes: { de: planoAtual?.codigo, para: novoPlano.codigo, via: 'stripe' }, atorUserId: user.id,
  })

  return NextResponse.json({ ok: true })
}
