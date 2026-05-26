// Motor de cálculo do Simples Nacional
// Cálculo da alíquota efetiva e do DAS por anexo/atividade.

import type { DocumentoFiscal, DocumentoFiscalItem, OrigemRbt12 } from '@/lib/types'
import {
  TABELAS_ANEXOS,
  DISTRIBUICOES_ANEXOS,
  LIMITE_SIMPLES_NACIONAL,
  type AnexoSimples,
  type FaixaSimples,
  type DistribuicaoSimples,
} from './tabelasAnexos'

// ──────────────────────────────────────────────────────────────────────────
// Tipos de resultado
// ──────────────────────────────────────────────────────────────────────────

export interface ResultadoFaixa {
  faixa: number
  aliquotaNominal: number      // decimal (ex: 0.04)
  parcelaDeduzir: number       // R$
  aliquotaEfetiva: number      // decimal calculado
  aliquotaEfetivaPerc: number  // percentual para exibição (ex: 3.82)
}

export interface ResultadoDas {
  receita: number
  rbt12: number
  faixa: ResultadoFaixa
  valorDas: number
  distribuicao: DistribuicaoSimples
  breakdown: Record<keyof DistribuicaoSimples, number>  // valores em R$
}

export interface NotaDevolucao {
  chave?: string
  numero?: string
  emitente?: string
  valor: number
  origem_devolucao: 'emitida_propria' | 'emitida_terceiro'
  competencia?: string
}

export interface ResultadoApuracao {
  competencia: string
  rbt12_utilizado: number
  origem_rbt12: OrigemRbt12
  receita_vendas_bruta: number        // soma das saídas de faturamento
  receita_devolucoes: number          // soma das devoluções de venda
  receita_liquida: number             // bruta - devoluções
  receita_st: number                  // segregada; não entra na base
  receita_exportacao: number          // separado para informação
  por_anexo: Record<string, ResultadoDas>
  valor_das_total: number
  alertas: string[]
  notas_devolucao: NotaDevolucao[]
}

// ──────────────────────────────────────────────────────────────────────────
// Função: encontrar faixa do RBT12
// ──────────────────────────────────────────────────────────────────────────
export function encontrarFaixa(rbt12: number, tabela: FaixaSimples[]): FaixaSimples | null {
  if (rbt12 <= 0) return tabela[0]
  return tabela.find(f => rbt12 >= f.de && rbt12 <= f.ate) ?? null
}

// ──────────────────────────────────────────────────────────────────────────
// Função: calcular alíquota efetiva
// ──────────────────────────────────────────────────────────────────────────
export function calcularAliquotaEfetiva(
  rbt12: number,
  anexo: AnexoSimples,
): ResultadoFaixa | null {
  const tabela = TABELAS_ANEXOS[anexo]
  const faixa = encontrarFaixa(rbt12, tabela)
  if (!faixa) return null

  const aliquotaEfetiva = rbt12 > 0
    ? ((rbt12 * faixa.aliquota) - faixa.parcela) / rbt12
    : faixa.aliquota

  return {
    faixa: faixa.faixa,
    aliquotaNominal: faixa.aliquota,
    parcelaDeduzir: faixa.parcela,
    aliquotaEfetiva,
    aliquotaEfetivaPerc: Math.round(aliquotaEfetiva * 10_000) / 100,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Função: calcular DAS para um anexo específico
// ──────────────────────────────────────────────────────────────────────────
export function calcularDas(
  receita: number,
  rbt12: number,
  anexo: AnexoSimples,
): ResultadoDas | null {
  if (receita <= 0) return null
  const resultado = calcularAliquotaEfetiva(rbt12, anexo)
  if (!resultado) return null

  const valorDas = Math.round(receita * resultado.aliquotaEfetiva * 100) / 100
  const distribuicao = DISTRIBUICOES_ANEXOS[anexo][resultado.faixa]

  const breakdown = {} as Record<keyof DistribuicaoSimples, number>
  for (const tributo of Object.keys(distribuicao) as Array<keyof DistribuicaoSimples>) {
    breakdown[tributo] = Math.round(valorDas * (distribuicao[tributo] / 100) * 100) / 100
  }

  return {
    receita,
    rbt12,
    faixa: resultado,
    valorDas,
    distribuicao,
    breakdown,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Função principal: apurar Simples Nacional a partir dos documentos
// ──────────────────────────────────────────────────────────────────────────
export function apurarSimples(params: {
  documentos: DocumentoFiscal[]
  itens: DocumentoFiscalItem[]
  rbt12: number
  origem_rbt12: OrigemRbt12
  cnpjEmpresa: string
  competencia: string
  ehIndustrial?: boolean
  anexoServico?: AnexoSimples  // III, IV ou V — configurável por empresa
}): ResultadoApuracao {
  const {
    documentos, itens, rbt12, origem_rbt12,
    cnpjEmpresa, competencia, ehIndustrial = false,
    anexoServico = 'III',
  } = params

  const alertas: string[] = []
  const notas_devolucao: NotaDevolucao[] = []

  let receita_vendas_bruta = 0
  let receita_devolucoes = 0
  let receita_st = 0
  let receita_exportacao = 0

  // Receitas por anexo (liquidas, já sem ST, exportação e devoluções)
  const receitas_por_anexo: Record<string, number> = {}

  // ── Processar documentos ──────────────────────────────────────────────
  for (const doc of documentos) {
    if (doc.status === 'cancelada') continue

    const valorDoc = doc.valor_total ?? 0

    if (doc.impacto_receita === 'soma_receita') {
      // Determinar tipo de receita pelo primeiro item ou pelo documento
      const itensDoc = itens.filter(i => i.documento_id === doc.id)

      if (itensDoc.length > 0) {
        // Classificar por item — usar valor líquido (vProd − vDesc) per LC 123/2006 art. 3º §1º
        //
        // Correção de bug legado: versões antigas do parser aplicavam desconto proporcional
        // do documento (vDescNota) a TODOS os itens sem vDesc próprio, mesmo quando itens
        // com vDesc individual já somavam o total do desconto. Isso produz somaDescItens > vDescDoc.
        // Detectamos isso e zeramos o desconto nos itens que o receberam proporcionalmente (ratio ≈ global).
        const vDescDoc = doc.valor_desconto ?? 0
        const somaDescItens = itensDoc.reduce((s, i) => s + (i.valor_desconto ?? 0), 0)
        const vProdTotal = itensDoc.reduce((s, i) => s + (i.valor_total ?? 0), 0)
        const bugDetectado = somaDescItens > vDescDoc + 0.5 && vDescDoc > 0 && vProdTotal > 0
        const globalRatio = bugDetectado ? vDescDoc / vProdTotal : 0

        for (const item of itensDoc) {
          let valorDesc = item.valor_desconto ?? 0
          if (bugDetectado && valorDesc > 0) {
            // Ratio do item ≈ ratio global → desconto foi aplicado proporcionalmente (bug) → zerar
            const itemRatio = (item.valor_total ?? 0) > 0 ? valorDesc / (item.valor_total ?? 0) : 0
            if (Math.abs(itemRatio - globalRatio) < 0.005) valorDesc = 0
          }
          const vItem = Math.max(0, (item.valor_total ?? 0) - valorDesc)
          if (vItem <= 0) continue

          acumularReceita(item, vItem, ehIndustrial, anexoServico,
            receitas_por_anexo, incrementarSt, incrementarExp)
        }
      } else {
        // Documento sem itens detalhados — usar classificação do documento
        acumularReceitaDoc(doc, valorDoc, ehIndustrial, anexoServico,
          receitas_por_anexo)
      }

      receita_vendas_bruta += valorDoc

    } else if (doc.impacto_receita === 'reduz_receita') {
      receita_devolucoes += valorDoc
      notas_devolucao.push({
        chave: doc.chave_acesso,
        numero: doc.numero,
        emitente: doc.emitente_nome ?? doc.emitente_cnpj,
        valor: valorDoc,
        origem_devolucao: doc.origem_devolucao === 'emitida_terceiro'
          ? 'emitida_terceiro'
          : 'emitida_propria',
        competencia: doc.data_competencia,
      })

    } else if (doc.impacto_receita === 'pendente_revisao') {
      alertas.push(`Nota ${doc.numero ?? doc.chave_acesso ?? '?'} com classificação pendente de revisão`)
    }
  }

  // Função auxiliar — incrementa acumuladores de ST e exportação
  function incrementarSt(v: number) { receita_st += v }
  function incrementarExp(v: number) { receita_exportacao += v }

  // Subtrair devoluções das receitas por anexo proporcionalmente
  const receita_bruta_tributavel_antes_dev = Object.values(receitas_por_anexo).reduce((a, b) => a + b, 0)
  if (receita_bruta_tributavel_antes_dev > 0 && receita_devolucoes > 0) {
    const propDev = receita_devolucoes / receita_bruta_tributavel_antes_dev
    for (const a of Object.keys(receitas_por_anexo)) {
      receitas_por_anexo[a] = Math.max(0, receitas_por_anexo[a] * (1 - propDev))
    }
  }

  // ── Alertas de consistência ───────────────────────────────────────────
  if (rbt12 > LIMITE_SIMPLES_NACIONAL) {
    alertas.push(`RBT12 (${fmtBRL(rbt12)}) excede o limite do Simples Nacional (${fmtBRL(LIMITE_SIMPLES_NACIONAL)}) — verificar`)
  }
  if (documentos.length === 0) {
    alertas.push('Nenhum documento importado para esta competência')
  }
  if (receita_devolucoes > receita_vendas_bruta) {
    alertas.push('Devoluções excedem a receita de vendas — verificar documentos importados')
  }
  if (receitas_por_anexo['servico_pendente']) {
    alertas.push('Receitas de serviço sem definição de Anexo (III, IV ou V) — configurar regime de serviço da empresa')
  }

  // ── Calcular DAS por anexo ────────────────────────────────────────────
  const por_anexo: Record<string, ResultadoDas> = {}
  let valor_das_total = 0

  for (const [chaveAnexo, receita] of Object.entries(receitas_por_anexo)) {
    if (receita <= 0 || chaveAnexo === 'servico_pendente') continue
    const anexo = chaveAnexo as AnexoSimples
    const das = calcularDas(receita, rbt12, anexo)
    if (das) {
      por_anexo[anexo] = das
      valor_das_total += das.valorDas
    }
  }

  const receita_liquida = Math.max(0, receita_vendas_bruta - receita_devolucoes)

  return {
    competencia,
    rbt12_utilizado: rbt12,
    origem_rbt12,
    receita_vendas_bruta,
    receita_devolucoes,
    receita_liquida,
    receita_st,
    receita_exportacao,
    por_anexo,
    valor_das_total,
    alertas,
    notas_devolucao,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Auxiliares internos
// ──────────────────────────────────────────────────────────────────────────

function acumularReceita(
  item: DocumentoFiscalItem,
  valor: number,
  ehIndustrial: boolean,
  anexoServico: AnexoSimples,
  receitas_por_anexo: Record<string, number>,
  incrSt: (v: number) => void,
  incrExp: (v: number) => void,
) {
  const nat = item.natureza_receita_simples

  if (nat === 'st') {
    incrSt(valor)
    return  // ST não entra na base de cálculo do DAS
  }
  if (nat === 'exportacao') {
    incrExp(valor)
    // Exportação pode ter IRPJ/CSLL no Simples; vamos incluir no Anexo correspondente
    const anexo = item.anexo_sugerido ?? (ehIndustrial ? 'II' : 'I')
    receitas_por_anexo[anexo] = (receitas_por_anexo[anexo] ?? 0) + valor
    return
  }
  if (nat === 'nao_receita' || nat === 'devolucao') return

  const anexo = item.anexo_sugerido
  if (!anexo) {
    // Serviço sem anexo definido ou CFOP pendente
    receitas_por_anexo['servico_pendente'] = (receitas_por_anexo['servico_pendente'] ?? 0) + valor
    return
  }

  const chave = anexo === 'III' || anexo === 'IV' || anexo === 'V'
    ? anexoServico   // usa o anexo configurado para serviços
    : anexo

  receitas_por_anexo[chave] = (receitas_por_anexo[chave] ?? 0) + valor
}

function acumularReceitaDoc(
  doc: DocumentoFiscal,
  valor: number,
  ehIndustrial: boolean,
  anexoServico: AnexoSimples,
  receitas_por_anexo: Record<string, number>,
) {
  // Sem itens detalhados — usar CNAE/tipo da empresa para sugerir anexo
  const anexo = ehIndustrial ? 'II' : 'I'
  receitas_por_anexo[anexo] = (receitas_por_anexo[anexo] ?? 0) + valor
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

// Calcula o RBT12 a partir de um array de receitas mensais (últimos 12 meses)
export function calcularRbt12(receitas: { competencia: string; receita_bruta_mes: number }[]): number {
  return receitas.reduce((acc, r) => acc + (r.receita_bruta_mes ?? 0), 0)
}
