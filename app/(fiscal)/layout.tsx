import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SidebarFiscal from './SidebarFiscal'

export default async function FiscalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="fiscal-shell">
      <SidebarFiscal />
      <main className="fiscal-main">{children}</main>
    </div>
  )
}
