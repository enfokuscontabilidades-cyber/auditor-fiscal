import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresa_id')
  const meses = parseInt(url.searchParams.get('meses') ?? '6', 10)

  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  // Buscar todos os documentos dos últimos N meses
  const { data, error } = await supabase
    .from('fa_documentos_fiscais')
    .select('data_competencia, tipo_movimento, valor_total')
    .eq('empresa_id', empresaId)
    .neq('status', 'cancelada')
    .order('data_competencia', { ascending: false })
    .limit(200000) // margem para grandes volumes

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agregar por competência e tipo de movimento
  const mapa = new Map<string, { total_entrada: number; total_saida: number; count_entrada: number; count_saida: number }>()

  for (const doc of (data ?? [])) {
    const comp = doc.data_competencia ?? 'sem-competencia'
    if (!mapa.has(comp)) mapa.set(comp, { total_entrada: 0, total_saida: 0, count_entrada: 0, count_saida: 0 })
    const m = mapa.get(comp)!
    const valor = doc.valor_total ?? 0
    if (doc.tipo_movimento === 'entrada') {
      m.total_entrada += valor
      m.count_entrada++
    } else if (doc.tipo_movimento === 'saida') {
      m.total_saida += valor
      m.count_saida++
    }
  }

  // Converter para array e limitar ao número de competências solicitadas
  const resultado = Array.from(mapa.entries())
    .map(([competencia, totais]) => ({ competencia, ...totais }))
    .sort((a, b) => a.competencia.localeCompare(b.competencia))
    .slice(-meses)

  return NextResponse.json(resultado)
}
