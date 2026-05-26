import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const {
    empresa_id,
    competencia,
    periodo_inicial,
    periodo_final,
    receita_bruta_mes,
    receita_bruta_acumulada_12m,
    receita_bruta_ano,
    valor_total_devido,
    numero_recibo,
    nome_arquivo,
    parsed_data,
  } = body

  if (!empresa_id || !competencia) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: empresa_id, competencia' },
      { status: 400 }
    )
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  const { data, error } = await supabase
    .from('sn_declaracoes')
    .upsert(
      {
        org_id: orgId,
        empresa_id,
        competencia,
        periodo_inicial: periodo_inicial ?? null,
        periodo_final: periodo_final ?? null,
        receita_bruta_mes: receita_bruta_mes ?? null,
        receita_bruta_acumulada_12m: receita_bruta_acumulada_12m ?? null,
        receita_bruta_ano: receita_bruta_ano ?? null,
        valor_total_devido: valor_total_devido ?? null,
        numero_recibo: numero_recibo ?? null,
        nome_arquivo: nome_arquivo ?? null,
        parsed_data: parsed_data ?? null,
      },
      { onConflict: 'empresa_id,competencia' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Populara sn_receitas_mensais a partir do histórico mensal do PGDAS
  if (parsed_data?.historico_mensal?.length > 0) {
    const rows = (parsed_data.historico_mensal as { mes: string; receita: number }[])
      .filter(h => h.mes && typeof h.receita === 'number')
      .map(h => ({
        org_id: orgId,
        empresa_id,
        competencia: h.mes,   // já no formato "MM/YYYY"
        receita_bruta_mes: h.receita,
        origem: 'pgdas',
        updated_at: new Date().toISOString(),
      }))

    if (rows.length > 0) {
      // Não sobrescrever entradas marcadas como 'manual' — upsert apenas se origem != manual
      // Como não há como filtrar no upsert, fazemos em dois passos:
      // 1) buscar quais competências já têm origem=manual
      const competencias = rows.map(r => r.competencia)
      const { data: existentes } = await supabase
        .from('sn_receitas_mensais')
        .select('competencia, origem')
        .eq('empresa_id', empresa_id)
        .in('competencia', competencias)

      const manuais = new Set(
        (existentes ?? [])
          .filter((e: { origem: string }) => e.origem === 'manual')
          .map((e: { competencia: string }) => e.competencia),
      )

      const rowsParaUpsert = rows.filter(r => !manuais.has(r.competencia))
      if (rowsParaUpsert.length > 0) {
        await supabase
          .from('sn_receitas_mensais')
          .upsert(rowsParaUpsert, { onConflict: 'empresa_id,competencia' })
      }
    }
  }

  return NextResponse.json(data, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')

  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sn_declaracoes')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('competencia', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  }

  const { error } = await supabase
    .from('sn_declaracoes')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
