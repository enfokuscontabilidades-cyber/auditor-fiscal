import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  const sessaoId = searchParams.get('sessao_id')
  const nivelRisco = searchParams.get('nivel_risco')
  const status = searchParams.get('status')
  const categoria = searchParams.get('categoria')

  let query = supabase
    .from('fa_alertas')
    .select('*, empresa:empresas(id, razao_social), regra:fa_regras_fiscais(codigo, titulo)')
    .order('nivel_risco', { ascending: true })
    .order('created_at', { ascending: false })

  if (empresaId) query = query.eq('empresa_id', empresaId)
  if (sessaoId) query = query.eq('sessao_id', sessaoId)
  if (nivelRisco) query = query.eq('nivel_risco', nivelRisco)
  if (status) query = query.eq('status', status)
  if (categoria) query = query.eq('categoria', categoria)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()

  // Aceita array de alertas ou objeto único
  const alertas = Array.isArray(body) ? body : [body]

  if (alertas.length === 0) return NextResponse.json([], { status: 201 })

  const { data, error } = await supabase
    .from('fa_alertas')
    .insert(alertas)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
