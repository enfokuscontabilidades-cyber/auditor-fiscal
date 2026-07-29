import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { respostaForbidden, validarEmpresaDaOrg } from '@/lib/supabase/validation'
import type { OrigemRbt12 } from '@/lib/types'

const ORIGENS_RBT12: OrigemRbt12[] = ['pgdas', 'xml', 'manual', 'estimado']

type ResultadoApuracaoRecebido = {
  competencia?: unknown
  rbt12_utilizado?: unknown
  origem_rbt12?: unknown
  receita_vendas_bruta?: unknown
  receita_devolucoes?: unknown
  receita_liquida?: unknown
  receita_st?: unknown
  valor_das_total?: unknown
  valor_das_a_pagar?: unknown
  [campo: string]: unknown
}

function numero(valor: unknown): number {
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : 0
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const empresaId = new URL(request.url).searchParams.get('empresa_id')
  if (!empresaId) return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })
  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) return respostaForbidden('empresa_id')

  const { data, error } = await supabase
    .from('sn_apuracoes')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('competencia', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json() as { empresa_id?: unknown; resultado?: ResultadoApuracaoRecebido }
  const empresaId = typeof body.empresa_id === 'string' ? body.empresa_id : ''
  const resultado = body.resultado
  const competencia = typeof resultado?.competencia === 'string' ? resultado.competencia : ''
  if (!empresaId || !resultado || !/^\d{2}\/\d{4}$/.test(competencia)) {
    return NextResponse.json({ error: 'empresa_id e resultado com competência válida são obrigatórios' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })
  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) return respostaForbidden('empresa_id')

  const { data: pgdas, error: erroPgdas } = await supabase
    .from('sn_declaracoes')
    .select('receita_bruta_mes, valor_total_devido')
    .eq('empresa_id', empresaId)
    .eq('competencia', competencia)
    .maybeSingle()
  if (erroPgdas) return NextResponse.json({ error: erroPgdas.message }, { status: 500 })

  const valorSistema = numero(resultado.valor_das_a_pagar ?? resultado.valor_das_total)
  const valorPgdas = pgdas ? numero(pgdas.valor_total_devido) : null
  const diferencaValor = valorPgdas === null ? null : valorSistema - valorPgdas
  const diferencaPercentual = valorPgdas && valorPgdas > 0 && diferencaValor !== null
    ? diferencaValor / valorPgdas
    : null
  const origemInformada = typeof resultado.origem_rbt12 === 'string' ? resultado.origem_rbt12 : ''
  const origemRbt12 = ORIGENS_RBT12.includes(origemInformada as OrigemRbt12)
    ? origemInformada as OrigemRbt12
    : 'manual'
  const status = valorPgdas === null
    ? 'pendente_revisao'
    : Math.abs(diferencaPercentual ?? 0) <= 0.01 ? 'ok' : 'divergente'

  const row = {
    org_id: orgId,
    empresa_id: empresaId,
    competencia,
    rbt12_utilizado: numero(resultado.rbt12_utilizado),
    origem_rbt12: origemRbt12,
    receita_xml_total: numero(resultado.receita_vendas_bruta),
    receita_devolucoes: numero(resultado.receita_devolucoes),
    receita_liquida: numero(resultado.receita_liquida),
    receita_st: numero(resultado.receita_st),
    receita_pgdas_total: pgdas ? numero(pgdas.receita_bruta_mes) : null,
    valor_simples_calculado: valorSistema,
    valor_pgdas: valorPgdas,
    diferenca_valor: diferencaValor,
    diferenca_percentual: diferencaPercentual,
    status,
    detalhes: resultado,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('sn_apuracoes')
    .upsert(row, { onConflict: 'empresa_id,competencia' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
