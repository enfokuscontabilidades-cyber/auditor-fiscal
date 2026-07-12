import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'

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
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  const competencia = searchParams.get('competencia')
  if (!empresaId) return NextResponse.json({ error: 'empresa_id e obrigatorio' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })
  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) return respostaForbidden('empresa_id')

  let query = supabase
    .from('sn_folha_mensal')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('competencia', { ascending: false })

  if (competencia) {
    const comps = competenciasAnteriores(competencia)
    if (comps.length > 0) query = query.in('competencia', comps)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const folha12 = (data ?? []).reduce((acc: number, row: { valor_folha: number }) => acc + (row.valor_folha ?? 0), 0)
  return NextResponse.json({ folhas: data ?? [], folha12 })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const body = await request.json() as {
    empresa_id: string
    entradas: { competencia: string; valor_folha: number; origem?: 'manual' | 'importacao_excel' }[]
  }
  if (!body.empresa_id || !Array.isArray(body.entradas) || body.entradas.length === 0) {
    return NextResponse.json({ error: 'empresa_id e entradas[] sao obrigatorios' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })
  if (!await validarEmpresaDaOrg(supabase, body.empresa_id, orgId)) return respostaForbidden('empresa_id')

  const rows = body.entradas
    .filter(e => e.competencia && typeof e.valor_folha === 'number' && Number.isFinite(e.valor_folha))
    .map(e => ({
      org_id: orgId,
      empresa_id: body.empresa_id,
      competencia: e.competencia,
      valor_folha: e.valor_folha,
      origem: e.origem ?? 'manual',
      updated_at: new Date().toISOString(),
    }))

  if (rows.length === 0) return NextResponse.json({ error: 'Nenhuma entrada valida' }, { status: 400 })

  const { data, error } = await supabase
    .from('sn_folha_mensal')
    .upsert(rows, { onConflict: 'empresa_id,competencia' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
