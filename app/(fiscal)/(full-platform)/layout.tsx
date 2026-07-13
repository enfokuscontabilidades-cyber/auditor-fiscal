import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { getContextoAcesso } from '@/lib/planos/acessoReformaTributaria'
import { redirect } from 'next/navigation'

/**
 * Gate único para todos os módulos exclusivos da plataforma completa
 * (auditor_fiscal, editor_sped, validador_entradas, simples_nacional,
 * inconsistencias, planejamento, obrigacoes, cobrancas, leads-reforma-tributaria).
 * Organizações com produto_escopo='tax_reform_only' nunca renderizam essas
 * páginas nem chegam a buscar dados delas — o bloqueio acontece aqui, antes
 * de qualquer coisa nas rotas filhas.
 */
export default async function FullPlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) redirect('/configuracoes/novo-escritorio')

  const ctx = await getContextoAcesso(supabase, orgId)
  if (ctx.produtoEscopo !== 'full_platform') {
    redirect('/?bloqueado=1')
  }

  return <>{children}</>
}
