import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresa_id')
  const competenciaInicio = url.searchParams.get('competencia_inicio')
  const competenciaFim = url.searchParams.get('competencia_fim')

  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

  let query = supabase
    .from('fa_documentos_itens')
    .select('cfop, valor_total, quantidade, fa_documentos_fiscais!inner(status, tipo_movimento, data_competencia)')
    .eq('empresa_id', empresaId)

  if (competenciaInicio) query = query.gte('fa_documentos_fiscais.data_competencia', competenciaInicio)
  if (competenciaFim) query = query.lte('fa_documentos_fiscais.data_competencia', competenciaFim)

  const { data, error } = await query.limit(100000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agregar por CFOP
  const mapa = new Map<string, { cfop: string; tipo: string; valor_total: number; quantidade: number; count: number }>()

  for (const item of (data ?? [])) {
    const doc = item.fa_documentos_fiscais as unknown as { status: string; tipo_movimento: string } | null
    if (doc?.status === 'cancelada') continue

    const cfop = item.cfop ?? 'sem-cfop'
    const tipo = cfop.startsWith('1') || cfop.startsWith('2') || cfop.startsWith('3') ? 'entrada' : 'saida'

    if (!mapa.has(cfop)) {
      mapa.set(cfop, { cfop, tipo, valor_total: 0, quantidade: 0, count: 0 })
    }
    const m = mapa.get(cfop)!
    m.valor_total += item.valor_total ?? 0
    m.quantidade += item.quantidade ?? 0
    m.count++
  }

  const totalGeral = Array.from(mapa.values()).reduce((s, m) => s + m.valor_total, 0)

  const resultado = Array.from(mapa.values())
    .map(m => ({
      ...m,
      participacao: totalGeral > 0 ? (m.valor_total / totalGeral) * 100 : 0,
    }))
    .sort((a, b) => b.valor_total - a.valor_total)

  return NextResponse.json(resultado)
}
