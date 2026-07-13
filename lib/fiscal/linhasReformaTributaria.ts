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
  numero?: string
  data_emissao?: string
  data_competencia?: string
  destinatario_nome?: string
  destinatario_cnpj?: string
  tipo_movimento?: string
  fa_documentos_itens?: ItemFiscalReforma[]
}

export interface ItemXmlSaidaReforma {
  id?: string
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
  documentoId: string
  itemId: string
  competencia: string
  nota: string
  data: string
  participante: string
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

export type SituacaoFiltroReforma = 'todos' | 'destacadas' | 'sem_destaque' | 'divergencias'

export function competenciaDaData(data?: string): string {
  if (!data) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [, mes, ano] = data.split('/')
    return `${ano}-${mes}`
  }
  const m = data.slice(0, 7)
  return /^\d{4}-\d{2}$/.test(m) ? m : ''
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

function chaveItemReforma(args: { nota?: string; codigo?: string; descricao?: string; ncm?: string; cfop?: string }): string {
  const identificador = normalizarChave(args.codigo) || normalizarChave(args.descricao)
  return [normalizarChave(args.nota), identificador, normalizarChave(args.ncm), normalizarChave(args.cfop)].join('|')
}

function escolherLinhaPreferida(atual: LinhaReforma | undefined, proxima: LinhaReforma): LinhaReforma {
  if (!atual) return proxima
  if (!atual.destacado && proxima.destacado) return proxima
  if (atual.destacado && !proxima.destacado) return atual
  const scoreAtual = atual.base + atual.valorIbs + atual.valorCbs + (atual.cst !== '-' ? 1 : 0) + (atual.cclass !== '-' ? 1 : 0)
  const scoreProxima = proxima.base + proxima.valorIbs + proxima.valorCbs + (proxima.cst !== '-' ? 1 : 0) + (proxima.cclass !== '-' ? 1 : 0)
  return scoreProxima > scoreAtual ? proxima : atual
}

/** Mescla documentos (fonte atual) e XMLs legados (fonte antiga) em uma única lista de linhas, deduplicada por item. */
export function montarLinhasReforma(docs: DocumentoFiscalReforma[], xmls: ArquivoXmlFiscalReforma[]): LinhaReforma[] {
  const mapa = new Map<string, LinhaReforma>()

  for (const doc of docs) {
    if (doc.tipo_movimento && doc.tipo_movimento !== 'saida') continue
    const participante = doc.destinatario_nome || doc.destinatario_cnpj || '-'
    for (const item of doc.fa_documentos_itens ?? []) {
      const chave = chaveItemReforma({ nota: doc.numero, codigo: item.codigo_produto, descricao: item.descricao, ncm: item.ncm, cfop: item.cfop })
      const linha = montarLinhaPaga({
        chave,
        documentoId: doc.id,
        itemId: item.id,
        competencia: doc.data_competencia || competenciaDaData(doc.data_emissao),
        nota: doc.numero || '-',
        data: doc.data_emissao || '',
        dataEmissao: doc.data_emissao,
        participante,
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
    for (const item of xml.parsed_data?.itens_saida ?? []) {
      const chave = chaveItemReforma({ nota: item.numero_nota || xml.numero_nf, codigo: item.codigo_produto, descricao: item.descricao, ncm: item.ncm, cfop: item.cfop })
      const linha = montarLinhaPaga({
        chave,
        documentoId: xml.id,
        itemId: item.id || chave,
        competencia: xml.competencia || competenciaDaData(xml.data_emissao || item.data),
        nota: item.numero_nota || xml.numero_nf || '-',
        data: xml.data_emissao || item.data || '',
        dataEmissao: xml.data_emissao || item.data,
        participante: item.destinatario || xml.destinatario_nome || xml.destinatario_cnpj || '-',
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
  filtros: { competencia?: string; situacao?: SituacaoFiltroReforma; busca?: string },
): LinhaReforma[] {
  const termo = (filtros.busca ?? '').trim().toLowerCase()
  return linhas.filter(l => {
    if (filtros.competencia && l.competencia !== filtros.competencia) return false
    if (filtros.situacao === 'destacadas' && !l.destacado) return false
    if (filtros.situacao === 'sem_destaque' && l.destacado) return false
    if (filtros.situacao === 'divergencias' && !l.alertas.length) return false
    if (!termo) return true
    return [l.nota, l.participante, l.produto, l.ncm, l.cfop, l.cst, l.cclass, l.competencia]
      .some(v => v.toLowerCase().includes(termo))
  })
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
    notas: new Set(linhas.filter(l => l.destacado).map(l => l.documentoId)).size,
    itens: linhas.filter(l => l.destacado).length,
    semDestaque: linhas.filter(l => !l.destacado).length,
    divergencias: linhas.filter(l => l.alertas.length).length,
    ibs: linhas.reduce((s, l) => s + l.valorIbs, 0),
    cbs: linhas.reduce((s, l) => s + l.valorCbs, 0),
  }
}
