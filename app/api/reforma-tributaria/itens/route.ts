import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { fetchAll } from '@/lib/supabase/fetchAll'
import {
  montarLinhasReforma,
  agruparLinhasReforma,
  filtrarLinhasReforma,
  totalizarLinhasReforma,
  type DocumentoFiscalReforma,
  type ArquivoXmlFiscalReforma,
  type SituacaoFiltroReforma,
  type TipoDocumentoReforma,
} from '@/lib/fiscal/linhasReformaTributaria'
import { NextResponse } from 'next/server'

const TAMANHO_PAGINA_PADRAO = 50
const TAMANHO_PAGINA_MAXIMO = 100

/**
 * Endpoint paginado da tela de Reforma Tributária. O merge/classificação
 * (montarLinhasReforma) ainda processa o conjunto completo de documentos +
 * itens do servidor — não há como evitar isso sem duplicar as regras de
 * IBS/CBS em SQL —, mas o navegador recebe apenas uma página de NF-e já
 * agrupadas, com seus respectivos itens para expansão. Assim uma nota nunca
 * é dividida entre páginas e a identificação permanece íntegra na interface.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  const competencia = searchParams.get('competencia') || undefined
  const situacao = (searchParams.get('situacao') as SituacaoFiltroReforma | null) ?? 'todos'
  const tipoDocumentoParam = searchParams.get('tipoDocumento')
  const tipoDocumento = tipoDocumentoParam && ['nfe', 'nfce', 'nfse', 'outro'].includes(tipoDocumentoParam)
    ? tipoDocumentoParam as TipoDocumentoReforma
    : undefined
  const busca = searchParams.get('busca') || undefined
  const exportarTudo = searchParams.get('export') === 'true'
  const pagina = Math.max(1, Number(searchParams.get('page')) || 1)
  const tamanhoPagina = Math.min(TAMANHO_PAGINA_MAXIMO, Math.max(1, Number(searchParams.get('pageSize')) || TAMANHO_PAGINA_PADRAO))

  if (!empresaId) return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const [docsResult, xmlsResult] = await Promise.all([
    fetchAll((from, to) => supabase
      .from('fa_documentos_fiscais')
      .select('id, tipo_documento, chave_acesso, numero, serie, modelo, data_emissao, data_competencia, destinatario_nome, destinatario_cnpj, tipo_movimento, ' +
        'fa_documentos_itens(id, item_numero, codigo_produto, descricao, ncm, cfop, valor_total, cst_ibs_cbs, cclass_trib, valor_bc_ibs_cbs, ' +
        'aliquota_ibs_uf, valor_ibs_uf, aliquota_ibs_mun, valor_ibs_mun, valor_ibs, aliquota_cbs, valor_cbs)')
      .eq('empresa_id', empresaId)
      .order('data_emissao', { ascending: false })
      .range(from, to)),
    fetchAll((from, to) => supabase
      .from('fa_arquivos_xml')
      .select('id, chave_nfe, numero_nf, data_emissao, competencia, tipo_operacao, destinatario_nome, destinatario_cnpj, parsed_data')
      .eq('empresa_id', empresaId)
      .eq('tipo_operacao', 'saida')
      .order('data_emissao', { ascending: false })
      .range(from, to)),
  ])

  const docs = docsResult as unknown as DocumentoFiscalReforma[]
  const xmls = xmlsResult as unknown as ArquivoXmlFiscalReforma[]

  const linhas = montarLinhasReforma(docs, xmls)
  const competencias = Array.from(new Set(linhas.map(l => l.competencia).filter(Boolean))).sort((a, b) => b.localeCompare(a))
  const filtradas = filtrarLinhasReforma(linhas, { competencia, situacao, tipoDocumento, busca })
  const totais = totalizarLinhasReforma(filtradas)

  if (exportarTudo) {
    return NextResponse.json({ itens: filtradas, total: filtradas.length, competencias, totais })
  }

  const notas = agruparLinhasReforma(filtradas)
  const inicio = (pagina - 1) * tamanhoPagina
  const pageSlice = notas.slice(inicio, inicio + tamanhoPagina)

  return NextResponse.json({
    notas: pageSlice,
    total: notas.length,
    totalItens: filtradas.length,
    page: pagina,
    pageSize: tamanhoPagina,
    competencias,
    totais,
  })
}
