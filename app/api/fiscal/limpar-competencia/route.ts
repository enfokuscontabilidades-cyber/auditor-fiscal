import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/fiscal/limpar-competencia?empresa_id=...&competencia=MM/YYYY
 *
 * Remove completamente todos os dados de uma empresa+competência:
 * - fa_documentos_fiscais (cascade elimina fa_documentos_itens via FK)
 * - fa_arquivos_xml
 *
 * Usado antes de reimportar XMLs para garantir estado limpo.
 * Os dados do PGDAS-D (sn_declaracoes) NÃO são afetados.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId  = searchParams.get('empresa_id')
  const competencia = searchParams.get('competencia')

  if (!empresaId || !competencia) {
    return NextResponse.json(
      { error: 'empresa_id e competencia são obrigatórios' },
      { status: 400 }
    )
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  let documentosRemovidos = 0
  let xmlsRemovidos = 0

  // ── 1. Limpar fa_documentos_fiscais (cascade → fa_documentos_itens) ────────
  try {
    const { data: docsRemovidos, error: errDocs } = await supabase
      .from('fa_documentos_fiscais')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('data_competencia', competencia)
      .select('id')

    if (!errDocs) documentosRemovidos = docsRemovidos?.length ?? 0
    // Se a tabela não existir ainda (migração pendente), ignora silenciosamente
  } catch { /* tabela não existe — ok */ }

  // ── 2. Limpar fa_arquivos_xml ───────────────────────────────────────────────
  // Tentativa A: filtrar diretamente pela coluna competencia (requer migração fase A)
  const { error: errXmlComp } = await supabase
    .from('fa_arquivos_xml')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('competencia', competencia)

  if (!errXmlComp?.message?.includes('competencia')) {
    // Coluna existe — contamos separadamente via select antes (já foram deletados)
    // Neste path o delete já ocorreu; buscar contagem não é possível após delete sem select
    // Informamos apenas que ocorreu a limpeza
    xmlsRemovidos = -1  // indica "limpeza realizada, contagem não disponível"
  } else {
    // Tentativa B: coluna não existe (migração pendente) — limpar via sessões
    const { data: sessoes } = await supabase
      .from('fa_sessoes_analise')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('competencia', competencia)

    if (sessoes && sessoes.length > 0) {
      const ids = sessoes.map((s: { id: string }) => s.id)
      const { data: xmlsDeleted } = await supabase
        .from('fa_arquivos_xml')
        .delete()
        .in('sessao_id', ids)
        .select('id')
      xmlsRemovidos = xmlsDeleted?.length ?? 0
    }
  }

  return NextResponse.json({
    ok: true,
    documentos_removidos: documentosRemovidos,
    xmls_removidos: xmlsRemovidos,
  })
}
