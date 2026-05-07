import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')

  let query = supabase
    .from('fa_sessoes_analise')
    .select('*, empresa:empresas(id, razao_social, cnpj)')
    .order('created_at', { ascending: false })

  if (empresaId) query = query.eq('empresa_id', empresaId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const { empresa_id, competencia, periodo_inicial, periodo_final, observacoes } = body

  if (!empresa_id || !competencia) {
    return NextResponse.json(
      { error: 'empresa_id e competencia são obrigatórios' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('fa_sessoes_analise')
    .insert({ empresa_id, competencia, periodo_inicial, periodo_final, observacoes, criado_por: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
