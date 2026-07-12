// Geração de texto determinística (conclusão) a partir dos dados reais do
// diagnóstico. Nada aqui é gerado por IA generativa — são templates
// escolhidos por regras objetivas a partir das contagens reais de IBS/CBS,
// nunca a partir de campos gerais do XML fora desse escopo.
//
// Importante: "zero divergências" e "zero documentos analisados" são casos
// DIFERENTES. Se nenhum arquivo pôde ser lido, não há base nenhuma para
// afirmar que "os campos de IBS e CBS foram localizados" — isso seria uma
// conclusão inventada. Os dois casos têm textos distintos.

import type { ResultadoPontuacao } from './pontuacao'
import type { DivergenciaConsolidada } from './divergencias'

export type GrauUrgencia = 'alta' | 'media' | 'baixa'

export function grauUrgencia(divergencias: DivergenciaConsolidada[]): GrauUrgencia {
  if (divergencias.some(d => d.gravidade === 'critica' || d.gravidade === 'alta')) return 'alta'
  if (divergencias.some(d => d.gravidade === 'media')) return 'media'
  return 'baixa'
}

export interface BlocoResultado {
  tipo: 'positivo' | 'sem_dados'
  titulo: string
  texto: string
}

/** Bloco curto exibido na página de divergências quando nenhuma divergência de IBS/CBS foi encontrada. */
export function blocoResultadoSemDivergencia(totalDocumentosAnalisados: number): BlocoResultado {
  if (totalDocumentosAnalisados === 0) {
    return {
      tipo: 'sem_dados',
      titulo: 'Não foi possível analisar os campos de IBS e CBS',
      texto: 'Nenhum documento pôde ser lido com sucesso nesta análise, por isso não há verificações de IBS e CBS aplicáveis. Veja os arquivos abaixo.',
    }
  }
  const plural = totalDocumentosAnalisados === 1 ? 'documento fiscal analisado' : 'documentos fiscais analisados'
  return {
    tipo: 'positivo',
    titulo: 'Nenhuma divergência encontrada',
    texto: `Nenhuma divergência relacionada ao IBS e à CBS foi identificada nas verificações realizadas em ${totalDocumentosAnalisados} ${plural}.`,
  }
}

/**
 * Conclusão curta e personalizada, restrita a IBS/CBS — usada na página final.
 * `totalDocumentosAfetados` é a contagem correta de XMLs distintos com
 * problema (não o número de TIPOS de divergência) — nunca reduzir para
 * "divergencias.length apontamento(s)", que conta regras, não documentos.
 */
export function conclusaoIbsCbs(
  pontuacao: ResultadoPontuacao,
  divergencias: DivergenciaConsolidada[],
  totalDocumentosAnalisados: number,
  totalDocumentosAfetados: number,
): string[] {
  const paragrafos: string[] = []

  if (totalDocumentosAnalisados === 0) {
    paragrafos.push(
      'Não foi possível verificar os campos de IBS e CBS nesta análise porque nenhum dos arquivos enviados pôde ser lido com sucesso.',
    )
    paragrafos.push('Revise os arquivos indicados na página anterior, corrija o que for necessário e envie novamente para obter um diagnóstico de IBS e CBS.')
  } else if (divergencias.length === 0) {
    paragrafos.push(
      'Os campos de IBS e CBS foram localizados e as verificações automatizadas aplicáveis não identificaram divergências. ' +
      'Isso não constitui certificação de conformidade tributária, mas indica que a estrutura analisada está alinhada ao esperado para o período.',
    )
    paragrafos.push('Recomenda-se apenas manter o acompanhamento nas próximas emissões, especialmente à medida que novas exigências entrarem em vigor.')
  } else {
    const urgencia = grauUrgencia(divergencias)
    const principal = divergencias[0]
    const documentoPlural = totalDocumentosAfetados === 1 ? 'documento' : 'documentos'
    const tipoPlural = divergencias.length === 1 ? 'tipo de divergência' : 'tipos de divergência'
    paragrafos.push(
      urgencia === 'alta'
        ? `Foram identificados ${divergencias.length} ${tipoPlural} de IBS e CBS, afetando ${totalDocumentosAfetados} ${documentoPlural}, que precisam de correção antes das próximas emissões.`
        : `Foram identificados ${divergencias.length} ${tipoPlural} de IBS e CBS, afetando ${totalDocumentosAfetados} ${documentoPlural}, que devem ser revisados nas próximas emissões.`,
    )
    paragrafos.push(`Primeira providência: ${principal.orientacao} (responsável sugerido: ${principal.responsavelSugerido.toLowerCase()}).`)
    paragrafos.push('Após a correção, recomenda-se realizar uma nova análise nesta ferramenta para confirmar que os apontamentos de IBS e CBS foram resolvidos.')
  }

  paragrafos.push(
    'Esta conclusão considera exclusivamente os campos de IBS e CBS verificados e não substitui uma avaliação tributária completa. ' +
    'Recomenda-se validação complementar pelo responsável contábil ou tributário da empresa.',
  )

  return paragrafos
}
