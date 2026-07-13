import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { getContextoAcesso, precisaAtivarAssinatura, MODULOS_TAX_REFORM_ONLY } from '@/lib/planos/acessoReformaTributaria'
import { redirect } from 'next/navigation'
import SidebarFiscal from './SidebarFiscal'
import TopbarFiscal from '@/components/TopbarFiscal'
import { NotificationProvider } from '@/components/notifications/NotificationProvider'

export default async function FiscalLayout({
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

  if (ctx.produtoEscopo === 'full_platform') {
    const { data: org } = await supabase
      .from('organizacoes')
      .select('plano')
      .eq('id', orgId)
      .single()

    if (org?.plano === 'pendente') redirect('/aguardando-ativacao')
  } else if (precisaAtivarAssinatura(ctx)) {
    const planoCodigo = ctx.assinatura?.plano_codigo ?? ''
    redirect(`/aguardando-ativacao?produto=reforma_tributaria&plano=${planoCodigo}`)
  }

  const allowedModules = ctx.produtoEscopo === 'tax_reform_only' ? MODULOS_TAX_REFORM_ONLY : null

  return (
    <NotificationProvider>
      <div className="fiscal-shell">
        <SidebarFiscal allowedModules={allowedModules} />
        <div className="fiscal-area">
          <TopbarFiscal />
          <main className="fiscal-main">{children}</main>
        </div>
      </div>
    </NotificationProvider>
  )
}
