import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('cobrancas')
    .select('*, empresa:empresas(id, razao_social)')
    .order('vencimento', { ascending: true })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const body = await request.json()
  const { empresa_id, descricao, valor, vencimento, observacao } = body

  if (!descricao?.trim() || !vencimento) {
    return NextResponse.json({ error: 'descricao e vencimento são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cobrancas')
    .insert({
      org_id: orgId,
      empresa_id: empresa_id || null,
      descricao: descricao.trim(),
      valor: valor || null,
      vencimento,
      status: 'pendente',
      observacao: observacao?.trim() || null,
    })
    .select('*, empresa:empresas(id, razao_social)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const body = await request.json()
  const { status, pago_em, empresa_id, descricao, valor, vencimento, observacao } = body

  const { data, error } = await supabase
    .from('cobrancas')
    .update({
      ...(status !== undefined && { status }),
      ...(pago_em !== undefined && { pago_em }),
      ...(empresa_id !== undefined && { empresa_id }),
      ...(descricao !== undefined && { descricao }),
      ...(valor !== undefined && { valor }),
      ...(vencimento !== undefined && { vencimento }),
      ...(observacao !== undefined && { observacao }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, empresa:empresas(id, razao_social)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase.from('cobrancas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
