// Mesclagem e classificação das linhas de conferência de IBS/CBS para a
// tela `/reforma_tributaria` — extraído da página para ser reaproveitado
// também pela API paginada (server-side), eliminando a necessidade de
// carregar milhares de itens no navegador só para depois filtrar a
// maioria fora da tela.
//
// Une duas fontes históricas do mesmo dado (fa_documentos_fiscais/itens,
// fonte atual, e fa_arquivos_xml/parsed_data, fonte legada ainda usada por
// orgs full_platform que também importam XML pelo Validador de Entradas),
// deduplicando por item e preferindo a linha mais completa.

import { montarLinhaPaga, type SituacaoReforma } from '@/lib/fiscal/analiseReformaTributariaPaga'
import { n } from '@/lib/fiscal/analiseReformaTributaria'

export interface ItemFiscalReforma {
  id: string
  item_numero?: number
  codigo_produto?: string
  descricao?: string
  ncm?: string
  cfop?: string
  valor_total?: number
  cst_ibs_cbs?: string
  cclass_trib?: string
  valor_bc_ibs_cbs?: number
  aliquota_ibs_uf?: number
  valor_ibs_uf?: number
  aliquota_ibs_mun?: number
  valor_ibs_mun?: number
  valor_ibs?: number
  aliquota_cbs?: number
  valor_cbs?: number
}

export interface DocumentoFiscalReforma {
  id: string
  tipo_documento?: string
  chave_acesso?: string
  numero?: string
  serie?: string
  modelo?: string
  data_emissao?: string
  data_competencia?: string
  destinatario_nome?: string
  destinatario_cnpj?: string
  tipo_movimento?: string
  fa_documentos_itens?: ItemFiscalReforma[]
}

export interface ItemXmlSaidaReforma {
  id?: string
  item_numero?: number
  numero_nota?: string
  destinatario?: string
  data?: string
  codigo_produto?: string
  descricao?: string
  ncm?: string
  cfop?: string
  valor_contabil?: number
  valor_produto?: number
  cst_ibs_cbs?: string
  cclass_trib?: string
  base_ibs_cbs?: number
  aliquota_ibs_uf?: number
  valor_ibs_uf?: number
  aliquota_ibs_mun?: number
  valor_ibs_mun?: number
  valor_ibs?: number
  aliquota_cbs?: number
  valor_cbs?: number
}

export interface ArquivoXmlFiscalReforma {
  id: string
  chave_nfe?: string
  numero_nf?: string
  data_emissao?: string
  competencia?: string
  tipo_operacao?: string
  destinatario_nome?: string
  destinatario_cnpj?: string
  parsed_data?: { itens_saida?: ItemXmlSaidaReforma[] } | null
}

export interface LinhaReforma {
  chave: string
  documentoChave: string
  documentoId: string
  itemId: string
  itemNumero: number
  codigoProduto: string
  tipoDocumento: TipoDocumentoReforma
  competencia: string
  nota: string
  serie: string
  data: string
  participante: string
  participanteNome: string
  participanteDocumento: string
  produto: string
  ncm: string
  cfop: string
  valorItem: number
  cst: string
  cclass: string
  base: number
  aliquotaIbsUf: number
  valorIbsUf: number
  aliquotaIbsMun: number
  valorIbsMun: number
  valorIbs: number
  aliquotaCbs: number
  valorCbs: number
  destacado: boolean
  alertas: string[]
  situacao: SituacaoReforma
}

export interface NotaReforma {
  chave: string
  documentoId: string
  tipoDocumento: TipoDocumentoReforma
  competencia: string
  nota: string
  serie: string
  data: string
  participanteNome: string
  participanteDocumento: string
  totalItens: number
  itensComDestaque: number
  itensSemDestaque: number
  divergencias: number
  valorItens: number
  baseIbsCbs: number
  valorIbs: number
  valorCbs: number
  situacao: SituacaoReforma
  alertas: string[]
  itens: LinhaReforma[]
}

export type TipoDocumentoReforma = 'nfe' | 'nfce' | 'nfse' | 'outro'

export type SituacaoFiltroReforma = 'todos' | 'destacadas' | 'sem_destaque' | 'divergencias'

function tipoDocumentoReforma(tipo?: string, modelo?: string): TipoDocumentoReforma {
  if (modelo === '65' || tipo === 'nfce') return 'nfce'
  if (tipo === 'nfse') return 'nfse'
  if (tipo === 'nfe' || modelo === '55') return 'nfe'
  return 'outro'
}

export function competenciaDaData(data?: string): string {
  if (!data) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [, mes, ano] = data.split('/')
    return `${mes}/${ano}`
  }
  const [ano, mes] = data.slice(0, 7).split('-')
  return ano && mes ? `${mes}/${ano}` : ''
}

function normalizarCompetencia(competencia?: string, data?: string): string {
  if (/^\d{2}\/\d{4}$/.test(competencia || '')) return competencia!
  if (/^\d{4}-\d{2}$/.test(competencia || '')) {
    const [ano, mes] = competencia!.split('-')
    return `${mes}/${ano}`
  }
  return competenciaDaData(data)
}

const REGEX_DIACRITICOS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g')

function normalizarChave(valor?: string): string {
  return (valor || '')
    .normalize('NFD')
    .replace(REGEX_DIACRITICOS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function chaveDocumentoReforma(args: {
  id: string
  chaveAcesso?: string
  nota?: string
  serie?: string
  data?: string
  participanteDocumento?: string
}): string {
  if (args.chaveAcesso) return `NFE:${normalizarChave(args.chaveAcesso)}`
  return [
    'DOC',
    normalizarChave(args.nota),
    normalizarChave(args.serie),
    normalizarChave(args.data),
    normalizarChave(args.participanteDocumento),
    normalizarChave(args.id),
  ].join('|')
}

function chaveItemReforma(documentoChave: string, itemNumero: number): string {
  return `${documentoChave}|ITEM:${itemNumero}`
}

function escolherLinhaPreferida(atual: LinhaReforma | undefined, proxima: LinhaReforma): LinhaReforma {
  if (!atual) return proxima
  const scoreAtual = atual.base + atual.valorIbs + atual.valorCbs + (atual.cst !== '-' ? 1 : 0) + (atual.cclass !== '-' ? 1 : 0)
  const scoreProxima = proxima.base + proxima.valorIbs + proxima.valorCbs + (proxima.cst !== '-' ? 1 : 0) + (proxima.cclass !== '-' ? 1 : 0)
  const preferida = (!atual.destacado && proxima.destacado) || (atual.destacado === proxima.destacado && scoreProxima > scoreAtual)
    ? proxima
    : atual
  const complementar = preferida === atual ? proxima : atual

  // Conserva a identidade estável do registro atual e preenche metadados que
  // podem não existir na fonte legada, mesmo quando ela tem IBS/CBS mais completo.
  return {
    ...complementar,
    ...preferida,
    documentoId: atual.documentoId,
    itemId: atual.itemId,
    serie: atual.serie !== '-' ? atual.serie : proxima.serie,
    participanteNome: atual.participanteNome || proxima.participanteNome,
    participanteDocumento: atual.participanteDocumento || proxima.participanteDocumento,
    codigoProduto: atual.codigoProduto || proxima.codigoProduto,
  }
}

/** Mescla documentos (fonte atual) e XMLs legados (fonte antiga) em uma única lista de linhas, deduplicada por item. */
export function montarLinhasReforma(docs: DocumentoFiscalReforma[], xmls: ArquivoXmlFiscalReforma[]): LinhaReforma[] {
  const mapa = new Map<string, LinhaReforma>()

  for (const doc of docs) {
    if (doc.tipo_movimento && doc.tipo_movimento !== 'saida') continue
    const participanteNome = doc.destinatario_nome || ''
    const participanteDocumento = doc.destinatario_cnpj || ''
    const participante = participanteNome || participanteDocumento || '-'
    const tipoDocumento = tipoDocumentoReforma(doc.tipo_documento, doc.modelo)
    const documentoChave = chaveDocumentoReforma({
      id: doc.id,
      chaveAcesso: doc.chave_acesso,
      nota: doc.numero,
      serie: doc.serie,
      data: doc.data_emissao,
      participanteDocumento,
    })
    for (const [indice, item] of (doc.fa_documentos_itens ?? []).entries()) {
      const itemNumero = item.item_numero && item.item_numero > 0 ? item.item_numero : indice + 1
      const chave = chaveItemReforma(documentoChave, itemNumero)
      const linha = montarLinhaPaga({
        chave,
        documentoChave,
        documentoId: doc.id,
        itemId: item.id,
        itemNumero,
        codigoProduto: item.codigo_produto || '',
        tipoDocumento,
        competencia: normalizarCompetencia(doc.data_competencia, doc.data_emissao),
        nota: doc.numero || '-',
        serie: doc.serie || '-',
        data: doc.data_emissao || '',
        dataEmissao: doc.data_emissao,
        participante,
        participanteNome,
        participanteDocumento,
        produto: item.descricao || item.codigo_produto || '-',
        ncm: item.ncm || '-',
        cfop: item.cfop || '-',
        valorItem: n(item.valor_total),
        cst: item.cst_ibs_cbs || '-',
        cclass: item.cclass_trib || '-',
        base: n(item.valor_bc_ibs_cbs),
        aliquotaIbsUf: n(item.aliquota_ibs_uf),
        valorIbsUf: n(item.valor_ibs_uf),
        aliquotaIbsMun: n(item.aliquota_ibs_mun),
        valorIbsMun: n(item.valor_ibs_mun),
        valorIbs: n(item.valor_ibs),
        aliquotaCbs: n(item.aliquota_cbs),
        valorCbs: n(item.valor_cbs),
      })
      mapa.set(chave, escolherLinhaPreferida(mapa.get(chave), linha))
    }
  }

  for (const xml of xmls) {
    if (xml.tipo_operacao && xml.tipo_operacao !== 'saida') continue
    const itensSaida = xml.parsed_data?.itens_saida ?? []
    for (const [indice, item] of itensSaida.entries()) {
      const participanteInformado = item.destinatario || ''
      const participanteEhDocumento = /^\d{11,14}$/.test(participanteInformado.replace(/\D/g, ''))
      const participanteNome = xml.destinatario_nome || (participanteEhDocumento ? '' : participanteInformado)
      const participanteDocumento = xml.destinatario_cnpj || (participanteEhDocumento ? participanteInformado.replace(/\D/g, '') : '')
      const documentoChave = chaveDocumentoReforma({
        id: xml.id,
        chaveAcesso: xml.chave_nfe,
        nota: item.numero_nota || xml.numero_nf,
        data: xml.data_emissao || item.data,
        participanteDocumento,
      })
      const itemNumero = item.item_numero && item.item_numero > 0 ? item.item_numero : indice + 1
      const chave = chaveItemReforma(documentoChave, itemNumero)
      const linha = montarLinhaPaga({
        chave,
        documentoChave,
        documentoId: xml.id,
        itemId: item.id || chave,
        itemNumero,
        codigoProduto: item.codigo_produto || '',
        tipoDocumento: 'nfe' as const,
        competencia: normalizarCompetencia(xml.competencia, xml.data_emissao || item.data),
        nota: item.numero_nota || xml.numero_nf || '-',
        serie: '-',
        data: xml.data_emissao || item.data || '',
        dataEmissao: xml.data_emissao || item.data,
        participante: participanteNome || participanteDocumento || '-',
        participanteNome,
        participanteDocumento,
        produto: item.descricao || item.codigo_produto || '-',
        ncm: item.ncm || '-',
        cfop: item.cfop || '-',
        valorItem: n(item.valor_contabil) || n(item.valor_produto),
        cst: item.cst_ibs_cbs || '-',
        cclass: item.cclass_trib || '-',
        base: n(item.base_ibs_cbs),
        aliquotaIbsUf: n(item.aliquota_ibs_uf),
        valorIbsUf: n(item.valor_ibs_uf),
        aliquotaIbsMun: n(item.aliquota_ibs_mun),
        valorIbsMun: n(item.valor_ibs_mun),
        valorIbs: n(item.valor_ibs),
        aliquotaCbs: n(item.aliquota_cbs),
        valorCbs: n(item.valor_cbs),
      })
      mapa.set(chave, escolherLinhaPreferida(mapa.get(chave), linha))
    }
  }

  return Array.from(mapa.values()).sort((a, b) => `${b.data}${b.nota}`.localeCompare(`${a.data}${a.nota}`))
}

export function filtrarLinhasReforma(
  linhas: LinhaReforma[],
  filtros: { competencia?: string; situacao?: SituacaoFiltroReforma; tipoDocumento?: TipoDocumentoReforma; busca?: string },
): LinhaReforma[] {
  const termo = (filtros.busca ?? '').trim().toLowerCase()
  return linhas.filter(l => {
    if (filtros.competencia && l.competencia !== filtros.competencia) return false
    if (filtros.tipoDocumento && l.tipoDocumento !== filtros.tipoDocumento) return false
    if (filtros.situacao === 'destacadas' && !l.destacado) return false
    if (filtros.situacao === 'sem_destaque' && l.destacado) return false
    if (filtros.situacao === 'divergencias' && !l.alertas.length) return false
    if (!termo) return true
    return [l.nota, l.serie, l.participante, l.participanteDocumento, l.codigoProduto, l.produto, l.ncm, l.cfop, l.cst, l.cclass, l.competencia]
      .some(v => v.toLowerCase().includes(termo))
  })
}

export function agruparLinhasReforma(linhas: LinhaReforma[]): NotaReforma[] {
  const grupos = new Map<string, LinhaReforma[]>()
  for (const linha of linhas) {
    const itens = grupos.get(linha.documentoChave) ?? []
    itens.push(linha)
    grupos.set(linha.documentoChave, itens)
  }

  return Array.from(grupos.entries()).map(([chave, itens]) => {
    const ordenados = [...itens].sort((a, b) => a.itemNumero - b.itemNumero)
    const referencia = ordenados[0]
    const divergencias = ordenados.filter(item => item.alertas.length > 0).length
    const situacao: SituacaoReforma = ordenados.some(item => item.situacao === 'critico')
      ? 'critico'
      : ordenados.some(item => item.situacao === 'alerta') ? 'alerta' : 'ok'

    return {
      chave,
      documentoId: referencia.documentoId,
      tipoDocumento: referencia.tipoDocumento,
      competencia: referencia.competencia,
      nota: referencia.nota,
      serie: referencia.serie,
      data: referencia.data,
      participanteNome: referencia.participanteNome,
      participanteDocumento: referencia.participanteDocumento,
      totalItens: ordenados.length,
      itensComDestaque: ordenados.filter(item => item.destacado).length,
      itensSemDestaque: ordenados.filter(item => !item.destacado).length,
      divergencias,
      valorItens: ordenados.reduce((total, item) => total + item.valorItem, 0),
      baseIbsCbs: ordenados.reduce((total, item) => total + item.base, 0),
      valorIbs: ordenados.reduce((total, item) => total + item.valorIbs, 0),
      valorCbs: ordenados.reduce((total, item) => total + item.valorCbs, 0),
      situacao,
      alertas: Array.from(new Set(ordenados.flatMap(item => item.alertas))),
      itens: ordenados,
    }
  }).sort((a, b) => `${b.data}${b.nota}`.localeCompare(`${a.data}${a.nota}`))
}

export interface TotaisLinhasReforma {
  notas: number
  itens: number
  semDestaque: number
  divergencias: number
  ibs: number
  cbs: number
}

export function totalizarLinhasReforma(linhas: LinhaReforma[]): TotaisLinhasReforma {
  return {
    notas: new Set(linhas.filter(l => l.destacado).map(l => l.documentoChave)).size,
    itens: linhas.filter(l => l.destacado).length,
    semDestaque: linhas.filter(l => !l.destacado).length,
    divergencias: linhas.filter(l => l.alertas.length).length,
    ibs: linhas.reduce((s, l) => s + l.valorIbs, 0),
    cbs: linhas.reduce((s, l) => s + l.valorCbs, 0),
  }
}
