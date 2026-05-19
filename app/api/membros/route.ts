import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 404 })

  const { data, error } = await supabase
    .from('membros_organizacao')
    .select('id, user_id, papel, created_at')
    .eq('org_id', orgId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Busca emails via admin
  const admin = createAdminClient()
  const membrosComEmail = await Promise.all(
    (data ?? []).map(async (m) => {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id)
      return { ...m, email: u?.user?.email ?? null }
    })
  )

  return NextResponse.json(membrosComEmail)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 404 })

  // Só admin pode adicionar membros
  const { data: membro } = await supabase
    .from('membros_organizacao')
    .select('papel')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (membro?.papel !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem adicionar membros' }, { status: 403 })
  }

  const { email } = await request.json()
  if (!email?.trim()) {
    return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const emailNorm = email.trim().toLowerCase()

  // Tenta encontrar conta existente
  const { data: { users }, error: errSearch } = await admin.auth.admin.listUsers()
  if (errSearch) return NextResponse.json({ error: errSearch.message }, { status: 500 })

  const target = users.find(u => u.email === emailNorm)

  if (!target) {
    // Usuário ainda não tem conta — criar convite
    const { data: convite, error: errConvite } = await admin
      .from('convites_organizacao')
      .insert({ org_id: orgId, email: emailNorm, papel: 'membro' })
      .select()
      .single()

    if (errConvite) {
      if (errConvite.code === '23505') {
        return NextResponse.json({ error: 'Já existe um convite pendente para este e-mail' }, { status: 409 })
      }
      return NextResponse.json({ error: errConvite.message }, { status: 500 })
    }

    return NextResponse.json(
      { ...convite, pendente: true, mensagem: 'Convite criado. O usuário entrará no escritório ao criar sua conta.' },
      { status: 201 }
    )
  }

  // Usuário tem conta — adicionar diretamente
  const { data, error } = await admin
    .from('membros_organizacao')
    .insert({ org_id: orgId, user_id: target.id, papel: 'membro' })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Usuário já é membro desta organização' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ...data, email: target.email }, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 404 })

  // Só admin pode remover membros
  const { data: membro } = await supabase
    .from('membros_organizacao')
    .select('papel')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (membro?.papel !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem remover membros' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const membroId = searchParams.get('id')
  if (!membroId) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  // Impede admin de se remover
  const { data: alvo } = await supabase
    .from('membros_organizacao')
    .select('user_id')
    .eq('id', membroId)
    .eq('org_id', orgId)
    .single()

  if (!alvo) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
  if (alvo.user_id === user.id) {
    return NextResponse.json({ error: 'Você não pode remover a si mesmo' }, { status: 400 })
  }

  const { error } = await supabase
    .from('membros_organizacao')
    .delete()
    .eq('id', membroId)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
