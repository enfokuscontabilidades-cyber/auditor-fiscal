import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { getContextoAcesso, getPlanoAtual, getCompanyLimit, getXmlUsageLimit } from '@/lib/planos/acessoReformaTributaria'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const ctx = await getContextoAcesso(supabase, orgId)

  return NextResponse.json({
    produtoEscopo: ctx.produtoEscopo,
    assinatura: ctx.assinatura,
    plano: getPlanoAtual(ctx) ?? null,
    cnpjSlotsUsados: ctx.cnpjSlotsUsados,
    limiteCnpj: getCompanyLimit(ctx),
    xmlsUsadosNoCiclo: ctx.xmlsUsadosNoCiclo,
    limiteXmlPorCiclo: getXmlUsageLimit(ctx),
  })
}
