import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
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

  const { data: org } = await supabase
    .from('organizacoes')
    .select('plano')
    .eq('id', orgId)
    .single()

  if (org?.plano === 'pendente') redirect('/aguardando-ativacao')

  return (
    <NotificationProvider>
      <div className="fiscal-shell">
        <SidebarFiscal />
        <div className="fiscal-area">
          <TopbarFiscal />
          <main className="fiscal-main">{children}</main>
        </div>
      </div>
    </NotificationProvider>
  )
}
