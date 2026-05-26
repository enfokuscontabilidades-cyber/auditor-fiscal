import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'

// Calcula as competências dos 12 meses anteriores a uma competência alvo
function competenciasAnteriores(competencia: string, meses = 12): string[] {
  const [mm, yyyy] = competencia.split('/')
  if (!mm || !yyyy) return []
  let mes = parseInt(mm, 10)
  let ano = parseInt(yyyy, 10)
  const resultado: string[] = []
  for (let i = 0; i < meses; i++) {
    mes--
    if (mes === 0) { mes = 12; ano-- }
    resultado.push(`${String(mes).padStart(2, '0')}/${ano}`)
  }
  return resultado
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  const competencia = searchParams.get('competencia')  // competência de referência para calcular RBT12

  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })
  }

  let query = supabase
    .from('sn_receitas_mensais')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('competencia', { ascending: false })

  if (competencia) {
    // Retorna apenas os 12 meses anteriores à competência informada
    const competencias = competenciasAnteriores(competencia)
    if (competencias.length > 0) {
      query = query.in('competencia', competencias)
    }
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rbt12 = (data ?? []).reduce((acc: number, r: { receita_bruta_mes: number }) => acc + (r.receita_bruta_mes ?? 0), 0)

  return NextResponse.json({ receitas: data, rbt12 })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const { empresa_id, entradas } = body as {
    empresa_id: string
    entradas: { competencia: string; receita_bruta_mes: number; origem?: string }[]
  }

  if (!empresa_id || !Array.isArray(entradas) || entradas.length === 0) {
    return NextResponse.json({ error: 'empresa_id e entradas[] são obrigatórios' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  const rows = entradas
    .filter(e => e.competencia && typeof e.receita_bruta_mes === 'number')
    .map(e => ({
      org_id: orgId,
      empresa_id,
      competencia: e.competencia,
      receita_bruta_mes: e.receita_bruta_mes,
      origem: e.origem ?? 'manual',
      updated_at: new Date().toISOString(),
    }))

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Nenhuma entrada válida' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sn_receitas_mensais')
    .upsert(rows, { onConflict: 'empresa_id,competencia' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
