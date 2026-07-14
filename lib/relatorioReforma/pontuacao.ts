// Motor de pontuação determinístico do diagnóstico de IBS/CBS.
//
// Escopo estritamente limitado a IBS e CBS (ver instrução original): campos
// gerais do XML (chave de acesso, data de emissão, número, série, CNPJ,
// assinatura, protocolo, ICMS/IPI/PIS/Cofins etc.) NUNCA entram nesta
// pontuação — só servem para identificar o documento na tela/relatório.
//
// Regras:
// - 0 a 100 pontos, calculados apenas a partir de verificações OBJETIVAS e
//   aplicáveis de IBS/CBS — nunca por um modelo generativo.
// - pontuação = soma dos pesos aprovados ÷ soma dos pesos aplicáveis × 100
// - Verificações "não aplicáveis" nunca reduzem a nota.
// - Verificações "não validadas" não contam como aprovadas nem como
//   reprovadas — ficam fora do denominador, porque afirmar "conforme" sem
//   ter verificado de fato seria uma conclusão inventada.
// - Um diagnóstico sem nenhuma divergência de IBS/CBS aplicável recebe 100.
// - TETO POR GRAVIDADE: a média ponderada por item pode diluir um problema
//   grave (ex.: 3 de 9 documentos inteiramente sem o grupo IBSCBS) até um
//   número que parece "adequado", porque os itens sem grupo saem do
//   denominador das demais categorias (CST, bases, valores) em vez de
//   pesarem contra a nota. Por isso a pontuação nunca pode indicar uma
//   classificação mais branda do que a pior divergência encontrada: havendo
//   ao menos uma divergência crítica, a nota final fica limitada a 49;
//   havendo uma alta, a 69; havendo uma média, a 89.

import type { ResultadoArquivoDiagnostico } from './tipos'
import type { DivergenciaConsolidada } from './divergencias'

export type CategoriaId =
  | 'presenca_grupos'
  | 'cst_cclasstrib'
  | 'bases_aliquotas'
  | 'valores_ibs_cbs'
  | 'consistencia_totalizadores'

export const NOME_CATEGORIA: Record<CategoriaId, string> = {
  presenca_grupos: 'Presença e estrutura dos grupos de IBS e CBS',
  cst_cclasstrib: 'CST e cClassTrib',
  bases_aliquotas: 'Bases e alíquotas',
  valores_ibs_cbs: 'Valores de IBS e CBS',
  consistencia_totalizadores: 'Consistência dos itens com os totalizadores',
}

export const PESO_CATEGORIA: Record<CategoriaId, number> = {
  presenca_grupos: 25,
  cst_cclasstrib: 25,
  bases_aliquotas: 20,
  valores_ibs_cbs: 20,
  consistencia_totalizadores: 10,
}

export type StatusVerificacao = 'conforme' | 'divergente' | 'nao_aplicavel' | 'nao_validado'

export interface Verificacao {
  categoria: CategoriaId
  status: StatusVerificacao
  arquivoId: string
  arquivo: string
  itemNumero?: string
  descricao: string
}

export interface ResultadoCategoria {
  categoria: CategoriaId
  nome: string
  pesoMaximo: number
  pesoAplicavel: number
  pesoObtido: number
  conformes: number
  divergentes: number
  naoAplicaveis: number
  naoValidados: number
}

export type ClassificacaoPontuacao = 'estrutura_adequada' | 'atencao_recomendada' | 'adequacao_necessaria' | 'situacao_critica'

export const LABEL_CLASSIFICACAO: Record<ClassificacaoPontuacao, string> = {
  estrutura_adequada: 'Estrutura de IBS e CBS aparentemente adequada',
  atencao_recomendada: 'Pontos de atenção em IBS e CBS',
  adequacao_necessaria: 'Adequações de IBS e CBS necessárias',
  situacao_critica: 'Divergências críticas em IBS e CBS',
}

export interface ResultadoPontuacao {
  pontuacao: number
  classificacao: ClassificacaoPontuacao
  classificacaoLabel: string
  categorias: ResultadoCategoria[]
  verificacoes: Verificacao[]
  semDadosAplicaveis: boolean
}

const ALERTA_CST_AUSENTE = 'CST IBS/CBS ausente'
const ALERTA_CCLASS_AUSENTE = 'cClassTrib ausente'
const TOLERANCIA_TOTALIZADOR = 0.05

function temAlertaAliquota(alertas: string[]): boolean {
  return alertas.some(a => a.startsWith('Alíquota'))
}

function temAlertaValor(alertas: string[]): boolean {
  return alertas.some(a => a.includes('esperado:'))
}

/**
 * Verificações consideradas: apenas os itens com grupo IBSCBS de documentos
 * lidos com sucesso, mais a consistência de totalizadores por documento.
 * Documentos que falharam na leitura (motivoFalha) não entram aqui — a
 * pontuação é exclusivamente de IBS/CBS, e um arquivo ilegível não é, por si
 * só, uma divergência tributária (fica registrado à parte, ver divergencias.ts).
 */
function construirVerificacoes(resultados: ResultadoArquivoDiagnostico[]): Verificacao[] {
  const verificacoes: Verificacao[] = []

  for (const resultado of resultados) {
    if (!resultado.ok) continue

    for (const item of resultado.itens || []) {
      verificacoes.push({
        categoria: 'presenca_grupos',
        status: item.destacado ? 'conforme' : 'divergente',
        arquivoId: resultado.id, arquivo: resultado.arquivo, itemNumero: item.itemNumero,
        descricao: item.destacado ? 'Grupo IBSCBS presente no item.' : 'Grupo IBSCBS não encontrado no item.',
      })

      if (!item.destacado) {
        verificacoes.push({
          categoria: 'cst_cclasstrib', status: 'nao_aplicavel', arquivoId: resultado.id, arquivo: resultado.arquivo,
          itemNumero: item.itemNumero, descricao: 'Sem grupo IBSCBS no item — não há CST/cClassTrib a avaliar.',
        })
        verificacoes.push({
          categoria: 'bases_aliquotas', status: 'nao_aplicavel', arquivoId: resultado.id, arquivo: resultado.arquivo,
          itemNumero: item.itemNumero, descricao: 'Sem grupo IBSCBS no item — não há base/alíquota a avaliar.',
        })
        verificacoes.push({
          categoria: 'valores_ibs_cbs', status: 'nao_aplicavel', arquivoId: resultado.id, arquivo: resultado.arquivo,
          itemNumero: item.itemNumero, descricao: 'Sem grupo IBSCBS no item — não há valor a avaliar.',
        })
        continue
      }

      const cstOuCclassAusente = item.alertas.includes(ALERTA_CST_AUSENTE) || item.alertas.includes(ALERTA_CCLASS_AUSENTE)
      verificacoes.push({
        categoria: 'cst_cclasstrib',
        status: cstOuCclassAusente ? 'divergente' : 'conforme',
        arquivoId: resultado.id, arquivo: resultado.arquivo, itemNumero: item.itemNumero,
        descricao: cstOuCclassAusente ? 'CST e/ou cClassTrib do IBS/CBS ausente no item.' : 'CST e cClassTrib do IBS/CBS presentes no item.',
      })

      const possuiAliquota = item.aliquotaIbsUf > 0 || item.aliquotaIbsMun > 0 || item.aliquotaCbs > 0
      if (!possuiAliquota) {
        verificacoes.push({
          categoria: 'bases_aliquotas', status: 'nao_aplicavel', arquivoId: resultado.id, arquivo: resultado.arquivo,
          itemNumero: item.itemNumero, descricao: 'Item sem base ou alíquota de IBS/CBS informadas para conferência.',
        })
      } else {
        const divergente = temAlertaAliquota(item.alertas)
        verificacoes.push({
          categoria: 'bases_aliquotas', status: divergente ? 'divergente' : 'conforme',
          arquivoId: resultado.id, arquivo: resultado.arquivo, itemNumero: item.itemNumero,
          descricao: divergente ? 'Alíquota de IBS/CBS fora do esperado para o período de testes.' : 'Base e alíquotas de IBS/CBS consistentes com o esperado.',
        })
      }

      const possuiValor = item.valorIbs > 0 || item.valorCbs > 0
      if (!possuiValor) {
        verificacoes.push({
          categoria: 'valores_ibs_cbs', status: 'nao_aplicavel', arquivoId: resultado.id, arquivo: resultado.arquivo,
          itemNumero: item.itemNumero, descricao: 'Item sem valor de IBS/CBS informado para conferência.',
        })
      } else {
        const divergente = temAlertaValor(item.alertas)
        verificacoes.push({
          categoria: 'valores_ibs_cbs', status: divergente ? 'divergente' : 'conforme',
          arquivoId: resultado.id, arquivo: resultado.arquivo, itemNumero: item.itemNumero,
          descricao: divergente ? 'Valor de IBS/CBS diferente do calculado (base × alíquota).' : 'Valores de IBS/CBS consistentes com o calculado.',
        })
      }
    }

    // Consistência com o totalizador da nota — só avaliável quando o XML
    // traz o grupo IBSCBSTot (best effort; nem todo XML do período de
    // transição possui esse grupo). Ausência não é divergência.
    const itens = resultado.itens || []
    const somaIbs = itens.reduce((acc, i) => acc + i.valorIbs, 0)
    const somaCbs = itens.reduce((acc, i) => acc + i.valorCbs, 0)

    if (resultado.totalizadorIbs != null) {
      const divergente = Math.abs(resultado.totalizadorIbs - somaIbs) > TOLERANCIA_TOTALIZADOR
      verificacoes.push({
        categoria: 'consistencia_totalizadores', status: divergente ? 'divergente' : 'conforme',
        arquivoId: resultado.id, arquivo: resultado.arquivo,
        descricao: divergente
          ? `Totalizador de IBS da nota (${resultado.totalizadorIbs.toFixed(2)}) diverge da soma dos itens (${somaIbs.toFixed(2)}).`
          : 'Totalizador de IBS da nota consistente com a soma dos itens.',
      })
    } else {
      verificacoes.push({
        categoria: 'consistencia_totalizadores', status: 'nao_validado', arquivoId: resultado.id, arquivo: resultado.arquivo,
        descricao: 'Não foi possível validar com os dados disponíveis (totalizador de IBS não encontrado no XML).',
      })
    }

    if (resultado.totalizadorCbs != null) {
      const divergente = Math.abs(resultado.totalizadorCbs - somaCbs) > TOLERANCIA_TOTALIZADOR
      verificacoes.push({
        categoria: 'consistencia_totalizadores', status: divergente ? 'divergente' : 'conforme',
        arquivoId: resultado.id, arquivo: resultado.arquivo,
        descricao: divergente
          ? `Totalizador de CBS da nota (${resultado.totalizadorCbs.toFixed(2)}) diverge da soma dos itens (${somaCbs.toFixed(2)}).`
          : 'Totalizador de CBS da nota consistente com a soma dos itens.',
      })
    } else {
      verificacoes.push({
        categoria: 'consistencia_totalizadores', status: 'nao_validado', arquivoId: resultado.id, arquivo: resultado.arquivo,
        descricao: 'Não foi possível validar com os dados disponíveis (totalizador de CBS não encontrado no XML).',
      })
    }
  }

  return verificacoes
}

/** Nota máxima possível dada a pior gravidade presente entre as divergências — ver comentário no topo do arquivo. */
function tetoPorGravidade(divergencias: DivergenciaConsolidada[]): number {
  if (divergencias.some(d => d.gravidade === 'critica')) return 49
  if (divergencias.some(d => d.gravidade === 'alta')) return 69
  if (divergencias.some(d => d.gravidade === 'media')) return 89
  return 100
}

export function calcularPontuacao(resultados: ResultadoArquivoDiagnostico[], divergencias: DivergenciaConsolidada[] = []): ResultadoPontuacao {
  const verificacoes = construirVerificacoes(resultados)
  const categorias: ResultadoCategoria[] = []
  let totalAplicavel = 0
  let totalObtido = 0

  for (const categoria of Object.keys(PESO_CATEGORIA) as CategoriaId[]) {
    const daCategoria = verificacoes.filter(v => v.categoria === categoria)
    const aplicaveis = daCategoria.filter(v => v.status === 'conforme' || v.status === 'divergente')
    const conformes = daCategoria.filter(v => v.status === 'conforme').length
    const divergentes = daCategoria.filter(v => v.status === 'divergente').length
    const naoAplicaveis = daCategoria.filter(v => v.status === 'nao_aplicavel').length
    const naoValidados = daCategoria.filter(v => v.status === 'nao_validado').length

    const pesoMaximo = PESO_CATEGORIA[categoria]
    const pesoAplicavel = aplicaveis.length > 0 ? pesoMaximo : 0
    const pesoObtido = aplicaveis.length > 0 ? (conformes / aplicaveis.length) * pesoMaximo : 0

    totalAplicavel += pesoAplicavel
    totalObtido += pesoObtido

    categorias.push({
      categoria, nome: NOME_CATEGORIA[categoria], pesoMaximo, pesoAplicavel, pesoObtido,
      conformes, divergentes, naoAplicaveis, naoValidados,
    })
  }

  const semDadosAplicaveis = totalAplicavel === 0
  const pontuacaoBruta = semDadosAplicaveis ? 0 : Math.round((totalObtido / totalAplicavel) * 100)
  const pontuacao = Math.min(pontuacaoBruta, tetoPorGravidade(divergencias))

  let classificacao: ClassificacaoPontuacao
  if (pontuacao >= 90) classificacao = 'estrutura_adequada'
  else if (pontuacao >= 70) classificacao = 'atencao_recomendada'
  else if (pontuacao >= 50) classificacao = 'adequacao_necessaria'
  else classificacao = 'situacao_critica'

  return {
    pontuacao, classificacao, classificacaoLabel: LABEL_CLASSIFICACAO[classificacao],
    categorias, verificacoes, semDadosAplicaveis,
  }
}
