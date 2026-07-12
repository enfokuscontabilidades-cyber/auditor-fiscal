// Orientação prática (antigo "plano de ação"), agora incorporada de forma
// compacta à página de conclusão — no máximo 3 ações prioritárias,
// construídas a partir das divergências de IBS/CBS já classificadas
// (lib/relatorioReforma/divergencias.ts). Não introduz nenhum julgamento
// novo: apenas seleciona e deduplica as orientações já existentes, sempre
// citando o alcance real (quantos documentos e itens) — nunca "1 apontamento"
// quando várias notas estão envolvidas.

import type { DivergenciaConsolidada } from './divergencias'
import { ORDEM_GRAVIDADE } from './divergencias'

export interface OrientacaoPrioritaria {
  ordem: number
  descricao: string
  divergenciaRelacionada: number
  responsavelSugerido: string
}

const MAXIMO_ORIENTACOES = 3

/** Seleciona até 3 orientações prioritárias, das divergências mais graves (por nº de documentos afetados), sem repetir o mesmo texto de orientação. */
export function montarOrientacoesPrioritarias(divergencias: DivergenciaConsolidada[]): OrientacaoPrioritaria[] {
  const ordenadas = [...divergencias].sort((a, b) =>
    ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade] || b.totalDocumentosAfetados - a.totalDocumentosAfetados,
  )

  const vistos = new Set<string>()
  const resultado: OrientacaoPrioritaria[] = []
  for (const d of ordenadas) {
    if (resultado.length >= MAXIMO_ORIENTACOES) break
    if (vistos.has(d.orientacao)) continue
    vistos.add(d.orientacao)
    const documentoPlural = d.totalDocumentosAfetados === 1 ? 'documento' : 'documentos'
    const itemPlural = d.totalItensAfetados === 1 ? 'item' : 'itens'
    resultado.push({
      ordem: resultado.length + 1,
      descricao: `${d.orientacao} (${d.totalDocumentosAfetados} ${documentoPlural} · ${d.totalItensAfetados} ${itemPlural} afetado(s))`,
      divergenciaRelacionada: d.numero,
      responsavelSugerido: d.responsavelSugerido,
    })
  }
  return resultado
}
