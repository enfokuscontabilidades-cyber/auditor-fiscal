import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'

/**
 * GET /api/fiscal/periodos-importados?empresa_id=...
 *
 * Retorna a lista de períodos (MM/YYYY) que possuem documentos fiscais
 * importados para a empresa, com contagens e totais por período.
 * Consulta fa_documentos_fiscais primeiro; faz fallback para fa_arquivos_xml.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')

  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  // Tenta fa_documentos_fiscais (requer migração fase A)
  const { data: docsFiscais, error: errDocs } = await supabase
    .from('fa_documentos_fiscais')
    .select('data_competencia, impacto_receita, valor_total, status')
    .eq('empresa_id', empresaId)

  if (!errDocs && Array.isArray(docsFiscais) && docsFiscais.length > 0) {
    const byPeriodo = new Map<string, { total_docs: number; total_receita: number; total_devolucoes: number }>()
    for (const d of docsFiscais) {
      const comp = d.data_competencia as string
      if (!comp) continue
      const entry = byPeriodo.get(comp) ?? { total_docs: 0, total_receita: 0, total_devolucoes: 0 }
      entry.total_docs++
      if (d.status !== 'cancelada') {
        if (d.impacto_receita === 'soma_receita') entry.total_receita += (d.valor_total as number) ?? 0
        if (d.impacto_receita === 'reduz_receita') entry.total_devolucoes += (d.valor_total as number) ?? 0
      }
      byPeriodo.set(comp, entry)
    }
    const periodos = [...byPeriodo.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([competencia, stats]) => ({ competencia, fonte: 'fa_documentos_fiscais', ...stats }))
    return NextResponse.json(periodos)
  }

  // Fallback: fa_arquivos_xml
  const { data: xmlRows, error: errXml } = await supabase
    .from('fa_arquivos_xml')
    .select('data_emissao, competencia, tipo_operacao, valor_total, status')
    .eq('empresa_id', empresaId)

  if (errXml) return NextResponse.json({ error: errXml.message }, { status: 500 })

  const byPeriodo = new Map<string, { total_docs: number; total_receita: number; total_devolucoes: number }>()
  for (const x of xmlRows ?? []) {
    // Prefere campo competencia do registro; deriva de data_emissao como fallback
    let comp = (x.competencia as string | null)
    if (!comp && x.data_emissao) {
      const ymd = (x.data_emissao as string).split('T')[0].split('-')
      if (ymd.length >= 2) comp = `${ymd[1]}/${ymd[0]}`
    }
    if (!comp) continue
    const entry = byPeriodo.get(comp) ?? { total_docs: 0, total_receita: 0, total_devolucoes: 0 }
    entry.total_docs++
    if ((x.status as string) !== 'cancelada') {
      if ((x.tipo_operacao as string) === 'saida') entry.total_receita += (x.valor_total as number) ?? 0
    }
    byPeriodo.set(comp, entry)
  }

  const periodos = [...byPeriodo.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([competencia, stats]) => ({ competencia, fonte: 'fa_arquivos_xml', ...stats }))

  return NextResponse.json(periodos)
}
