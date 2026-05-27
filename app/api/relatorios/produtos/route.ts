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
  const limit = parseInt(url.searchParams.get('limit') ?? '15', 10)
  const tipoMovimento = url.searchParams.get('tipo_movimento') // 'entrada' | 'saida' | null

  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

  let query = supabase
    .from('fa_documentos_itens')
    .select('descricao, ncm, cfop, valor_total, quantidade, fa_documentos_fiscais!inner(status, tipo_movimento, data_competencia)')
    .eq('empresa_id', empresaId)

  if (competenciaInicio) query = query.gte('fa_documentos_fiscais.data_competencia', competenciaInicio)
  if (competenciaFim) query = query.lte('fa_documentos_fiscais.data_competencia', competenciaFim)
  if (tipoMovimento) query = query.eq('fa_documentos_fiscais.tipo_movimento', tipoMovimento)

  const { data, error } = await query.limit(50000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agregar por (descricao + ncm)
  const mapa = new Map<string, { descricao: string; ncm: string; valor_total: number; quantidade: number; count: number }>()

  for (const item of (data ?? [])) {
    const docs = item.fa_documentos_fiscais as unknown as { status: string; tipo_movimento: string } | null
    if (docs?.status === 'cancelada') continue

    const chave = `${item.descricao}||${item.ncm ?? ''}`
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        descricao: item.descricao ?? '',
        ncm: item.ncm ?? '',
        valor_total: 0,
        quantidade: 0,
        count: 0,
      })
    }
    const m = mapa.get(chave)!
    m.valor_total += item.valor_total ?? 0
    m.quantidade += item.quantidade ?? 0
    m.count++
  }

  const resultado = Array.from(mapa.values())
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, limit)

  return NextResponse.json(resultado)
}
