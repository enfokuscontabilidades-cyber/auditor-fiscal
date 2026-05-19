import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'

// GET — retorna convite pendente para o e-mail do usuário logado
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('convites_organizacao')
    .select('id, org_id, papel, criado_em, organizacao:organizacoes(nome)')
    .eq('email', user.email!)
    .limit(1)
    .single()

  return NextResponse.json(data ?? null)
}

// POST — aceitar convite e entrar na org
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Verifica que o usuário ainda não pertence a uma org
  const orgId = await getOrgId(supabase, user.id)
  if (orgId) return NextResponse.json({ error: 'Usuário já pertence a uma organização' }, { status: 409 })

  const admin = createAdminClient()

  const { data: convite } = await admin
    .from('convites_organizacao')
    .select('id, org_id, papel')
    .eq('email', user.email!)
    .limit(1)
    .single()

  if (!convite) return NextResponse.json({ error: 'Nenhum convite encontrado' }, { status: 404 })

  const { error } = await admin
    .from('membros_organizacao')
    .insert({ org_id: convite.org_id, user_id: user.id, papel: convite.papel })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Remove o convite após aceitar
  await admin.from('convites_organizacao').delete().eq('id', convite.id)

  return NextResponse.json({ ok: true, org_id: convite.org_id })
}
