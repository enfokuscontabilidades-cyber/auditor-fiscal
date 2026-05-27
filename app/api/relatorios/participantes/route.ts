import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresa_id')
  const tipo = url.searchParams.get('tipo') ?? 'entrada' // 'entrada' | 'saida'
  const competenciaInicio = url.searchParams.get('competencia_inicio')
  const competenciaFim = url.searchParams.get('competencia_fim')
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)

  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

  let query = supabase
    .from('fa_documentos_fiscais')
    .select('emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, valor_total, tipo_movimento, status, data_competencia')
    .eq('empresa_id', empresaId)
    .neq('status', 'cancelada')
    .eq('tipo_movimento', tipo)

  if (competenciaInicio) query = query.gte('data_competencia', competenciaInicio)
  if (competenciaFim) query = query.lte('data_competencia', competenciaFim)

  const { data, error } = await query.limit(50000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agregar por CNPJ do participante relevante
  const mapa = new Map<string, { cnpj: string; nome: string; valor_total: number; count: number }>()

  for (const doc of (data ?? [])) {
    const cnpj = tipo === 'entrada' ? (doc.emitente_cnpj ?? '') : (doc.destinatario_cnpj ?? '')
    const nome = tipo === 'entrada' ? (doc.emitente_nome ?? 'Não identificado') : (doc.destinatario_nome ?? 'Não identificado')

    if (!cnpj) continue

    if (!mapa.has(cnpj)) {
      mapa.set(cnpj, { cnpj, nome, valor_total: 0, count: 0 })
    }
    const m = mapa.get(cnpj)!
    m.valor_total += doc.valor_total ?? 0
    m.count++
    // Atualizar nome se estava vazio
    if (!m.nome && nome) m.nome = nome
  }

  const resultado = Array.from(mapa.values())
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, limit)

  return NextResponse.json(resultado)
}
