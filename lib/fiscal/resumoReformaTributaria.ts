import { n } from '@/lib/fiscal/analiseReformaTributaria'
import {
  montarLinhaPaga,
  type CamposReformaPaga,
  type DivergenciaReformaPaga,
  type SituacaoReforma,
  type OpcoesAnaliseReformaPaga,
} from '@/lib/fiscal/analiseReformaTributariaPaga'

export interface ItemBrutoReforma {
  cst_ibs_cbs?: string | null
  cclass_trib?: string | null
  valor_bc_ibs_cbs?: number | null
  valor_total?: number | null
  aliquota_ibs_uf?: number | null
  valor_ibs_uf?: number | null
  aliquota_ibs_mun?: number | null
  valor_ibs_mun?: number | null
  valor_ibs?: number | null
  aliquota_cbs?: number | null
  valor_cbs?: number | null
  /** Data de emissão do documento pai (YYYY-MM-DD) — resolve os parâmetros de referência vigentes. */
  data_emissao?: string | null
}

export function camposReformaDeItem(item: ItemBrutoReforma): CamposReformaPaga {
  return {
    cst: item.cst_ibs_cbs || '-',
    cclass: item.cclass_trib || '-',
    base: n(item.valor_bc_ibs_cbs),
    valorItem: n(item.valor_total),
    aliquotaIbsUf: n(item.aliquota_ibs_uf),
    valorIbsUf: n(item.valor_ibs_uf),
    aliquotaIbsMun: n(item.aliquota_ibs_mun),
    valorIbsMun: n(item.valor_ibs_mun),
    valorIbs: n(item.valor_ibs),
    aliquotaCbs: n(item.aliquota_cbs),
    valorCbs: n(item.valor_cbs),
    dataEmissao: item.data_emissao ?? null,
  }
}

const ORDEM_GRAVIDADE: Record<SituacaoReforma, number> = { ok: 0, alerta: 1, critico: 2 }

/** Combina duas situações, preservando a mais grave — usada para consolidar a situação de um documento a partir dos itens. */
export function piorSituacaoReforma(a: SituacaoReforma, b: SituacaoReforma): SituacaoReforma {
  return ORDEM_GRAVIDADE[b] > ORDEM_GRAVIDADE[a] ? b : a
}

// ─────────────────────────────────────────────────────────────────────────
// Agrupamento de divergências (relatório PDF e telas de detalhe)
// ─────────────────────────────────────────────────────────────────────────

export interface ContextoItemReforma {
  documentoId: string
  documentoNumero: string
  divergencias: DivergenciaReformaPaga[]
}

export interface GrupoDivergenciaReforma {
  codigo: string
  gravidade: 'critico' | 'alerta'
  campo: string
  resumo: string
  explicacao: string
  impacto: string
  responsavel: string
  orientacao: string[]
  /** Números de nota (ou id, se sem número) únicos afetados por este código de divergência. */
  documentosAfetados: string[]
  totalDocumentos: number
  /** Total de itens (linhas de produto) que geraram esta divergência, somado entre todos os documentos. */
  totalItens: number
}

/**
 * Agrupa divergências por código (ex: "12 de 80 XMLs afetados, 37 itens
 * afetados"), preservando gravidade, explicação e orientação — usado pelo
 * relatório em PDF para nunca degenerar em uma simples listagem de notas.
 */
export function agruparDivergenciasReforma(contextos: ContextoItemReforma[]): GrupoDivergenciaReforma[] {
  interface Acumulador {
    exemplo: DivergenciaReformaPaga
    documentos: Set<string>
    totalItens: number
  }

  const grupos = new Map<string, Acumulador>()

  for (const ctx of contextos) {
    for (const div of ctx.divergencias) {
      let grupo = grupos.get(div.codigo)
      if (!grupo) {
        grupo = { exemplo: div, documentos: new Set<string>(), totalItens: 0 }
        grupos.set(div.codigo, grupo)
      }
      grupo.documentos.add(ctx.documentoNumero || ctx.documentoId)
      grupo.totalItens++
    }
  }

  return Array.from(grupos.values())
    .map(({ exemplo, documentos, totalItens }) => ({
      codigo: exemplo.codigo,
      gravidade: exemplo.gravidade,
      campo: exemplo.campo,
      resumo: exemplo.resumo,
      explicacao: exemplo.explicacao,
      impacto: exemplo.impacto,
      responsavel: exemplo.responsavel,
      orientacao: exemplo.orientacao,
      documentosAfetados: Array.from(documentos),
      totalDocumentos: documentos.size,
      totalItens,
    }))
    .sort((a, b) => {
      if (a.gravidade !== b.gravidade) return a.gravidade === 'critico' ? -1 : 1
      return b.totalItens - a.totalItens
    })
}

// ─────────────────────────────────────────────────────────────────────────
// Serviço central de resumo da análise — único ponto de verdade das
// métricas de documentos e itens. Dashboard, tela, relatório PDF (as duas
// modalidades) e Excel devem sempre chamar esta função em vez de
// recalcular localmente, para nunca divergir entre si e nunca confundir
// contagem de itens com contagem de documentos.
//
// Definições:
// - DOCUMENTO ANALISADO: um XML fiscal único (fa_documentos_fiscais).
// - ITEM ANALISADO: cada linha de produto/serviço dentro de um documento.
// - DOCUMENTO CRÍTICO: possui pelo menos um item com divergência crítica.
// - DOCUMENTO EM ATENÇÃO: sem divergência crítica, mas com ao menos uma
//   divergência de atenção.
// - DOCUMENTO ADEQUADO: nenhuma divergência crítica ou de atenção.
// ─────────────────────────────────────────────────────────────────────────

export interface DocumentoParaAnaliseReforma {
  id: string
  numero: string | null
  serie?: string | null
  tipoDocumento?: string | null
  dataEmissao: string | null
  destinatarioNome?: string | null
  destinatarioCnpj?: string | null
  itens: ItemBrutoReforma[]
}

export interface DocumentoAnalisadoReforma {
  id: string
  numero: string
  serie: string
  tipoDocumento: string
  data: string
  participante: string
  situacao: SituacaoReforma
  /** Quantidade de itens deste documento com pelo menos uma divergência. */
  itensAfetados: number
  principalDivergencia: string
  valorIbs: number
  valorCbs: number
}

export interface ResumoAnaliseReforma {
  totalDocumentos: number
  totalItens: number
  documentosAdequados: number
  documentosAtencao: number
  documentosCriticos: number
  /** documentosAtencao + documentosCriticos */
  documentosAfetados: number
  itensAdequados: number
  itensAtencao: number
  itensCriticos: number
  /** itensAtencao + itensCriticos */
  itensAfetados: number
  /** Quantidade de códigos de regra distintos identificados (ex: "CST ausente" é 1 tipo, não importa quantas vezes ocorra). */
  tiposDivergencia: number
  /** Soma de todas as ocorrências individuais de divergência entre todos os itens. */
  ocorrenciasDivergencia: number
  totalIbs: number
  totalCbs: number
}

export interface AnaliseReformaConsolidada {
  resumo: ResumoAnaliseReforma
  grupos: GrupoDivergenciaReforma[]
  /** Um registro por documento — usado tanto para o anexo completo quanto para filtrar só os afetados. */
  documentos: DocumentoAnalisadoReforma[]
}

/**
 * Analisa um lote de documentos (com seus itens) e consolida TODAS as
 * métricas em uma única passada — documentos e itens nunca são somados
 * entre si. Reaproveitado por dashboard, relatório PDF (empresarial e do
 * contador) e, futuramente, pela paginação server-side da tela.
 */
export function analisarDocumentosReforma(
  documentos: DocumentoParaAnaliseReforma[],
  opcoesAnalise?: OpcoesAnaliseReformaPaga,
): AnaliseReformaConsolidada {
  const contextos: ContextoItemReforma[] = []
  const documentosAnalisados: DocumentoAnalisadoReforma[] = []

  let totalItens = 0
  let itensAdequados = 0, itensAtencao = 0, itensCriticos = 0
  let documentosAdequados = 0, documentosAtencao = 0, documentosCriticos = 0
  let totalIbs = 0, totalCbs = 0
  let ocorrenciasDivergencia = 0

  for (const doc of documentos) {
    if (!doc.itens.length) continue

    let situacaoDoc: SituacaoReforma = 'ok'
    let ibsDoc = 0, cbsDoc = 0, itensAfetadosDoc = 0
    const divergenciasPorCodigoDoc = new Map<string, { resumo: string; count: number }>()

    for (const item of doc.itens) {
      const campos = camposReformaDeItem({ ...item, data_emissao: doc.dataEmissao })
      const linha = montarLinhaPaga(campos, opcoesAnalise)

      totalItens++
      if (linha.situacao === 'ok') itensAdequados++
      else if (linha.situacao === 'alerta') itensAtencao++
      else itensCriticos++

      totalIbs += campos.valorIbs
      totalCbs += campos.valorCbs
      ibsDoc += campos.valorIbs
      cbsDoc += campos.valorCbs
      situacaoDoc = piorSituacaoReforma(situacaoDoc, linha.situacao)

      if (linha.divergencias.length > 0) {
        itensAfetadosDoc++
        ocorrenciasDivergencia += linha.divergencias.length
        contextos.push({ documentoId: doc.id, documentoNumero: doc.numero || doc.id, divergencias: linha.divergencias })
        for (const div of linha.divergencias) {
          const atual = divergenciasPorCodigoDoc.get(div.codigo)
          divergenciasPorCodigoDoc.set(div.codigo, { resumo: div.resumo, count: (atual?.count ?? 0) + 1 })
        }
      }
    }

    if (situacaoDoc === 'ok') documentosAdequados++
    else if (situacaoDoc === 'alerta') documentosAtencao++
    else documentosCriticos++

    let principal = { resumo: '—', count: -1 }
    for (const v of divergenciasPorCodigoDoc.values()) if (v.count > principal.count) principal = v

    documentosAnalisados.push({
      id: doc.id,
      numero: doc.numero || '-',
      serie: doc.serie || '-',
      tipoDocumento: doc.tipoDocumento ?? 'outro',
      data: doc.dataEmissao || '',
      participante: doc.destinatarioNome || doc.destinatarioCnpj || '-',
      situacao: situacaoDoc,
      itensAfetados: itensAfetadosDoc,
      principalDivergencia: principal.resumo,
      valorIbs: ibsDoc,
      valorCbs: cbsDoc,
    })
  }

  const grupos = agruparDivergenciasReforma(contextos)

  const resumo: ResumoAnaliseReforma = {
    totalDocumentos: documentosAnalisados.length,
    totalItens,
    documentosAdequados,
    documentosAtencao,
    documentosCriticos,
    documentosAfetados: documentosAtencao + documentosCriticos,
    itensAdequados,
    itensAtencao,
    itensCriticos,
    itensAfetados: itensAtencao + itensCriticos,
    tiposDivergencia: grupos.length,
    ocorrenciasDivergencia,
    totalIbs,
    totalCbs,
  }

  return { resumo, grupos, documentos: documentosAnalisados }
}
