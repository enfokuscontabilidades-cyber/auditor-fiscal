// Motor de cálculo do Simples Nacional
// Cálculo da alíquota efetiva e do DAS por anexo/atividade.

import type { DocumentoFiscal, DocumentoFiscalItem, OrigemRbt12 } from '@/lib/types'
import { anexoVendaMercadoriaPorCfop } from './cfopReceita'
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
  valorDasAPagar?: number
  segregacaoIss?: {
    receitaComRetencao: number
    receitaSemRetencao: number
    valorIssExcluido: number
    semRetencao: {
      receita: number
      valorDas: number
      breakdown: Record<keyof DistribuicaoSimples, number>
    } | null
    comRetencao: {
      receita: number
      valorDas: number
      breakdown: Record<keyof DistribuicaoSimples, number>
    }
  }
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
  receita_vendas_bruta: number        // soma das saídas de faturamento (valor bruto das NFS-e)
  receita_devolucoes: number          // soma das devoluções de venda
  receita_liquida: number             // bruta - devoluções
  receita_st: number                  // segregada; não entra na base
  receita_exportacao: number          // separado para informação
  por_anexo: Record<string, ResultadoDas>
  valor_das_total: number             // DAS bruto (antes de deduzir ISS retido)
  total_iss_retido: number            // valor nominal de ISS retido informado nas NFS-e
  receita_servicos_com_iss_retido: number
  receita_servicos_sem_iss_retido: number
  valor_iss_excluido_das: number      // parcela de ISS do Simples retirada da receita segregada
  valor_das_a_pagar: number           // DAS líquido após excluir somente a parcela de ISS
  alertas: string[]
  notas_devolucao: NotaDevolucao[]
  fator_r?: {
    modo_servico: 'anexo_fixo' | 'fator_r'
    folha12?: number
    percentual?: number
    anexo_servico?: AnexoSimples
  }
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
  opcoes: { excluirIss?: boolean } = {},
): ResultadoDas | null {
  if (receita <= 0) return null
  const resultado = calcularAliquotaEfetiva(rbt12, anexo)
  if (!resultado) return null

  const basePartilha = arredondarCentavos(receita * resultado.aliquotaEfetiva)
  const distribuicao = DISTRIBUICOES_ANEXOS[anexo][resultado.faixa]

  const breakdown = {} as Record<keyof DistribuicaoSimples, number>
  for (const tributo of Object.keys(distribuicao) as Array<keyof DistribuicaoSimples>) {
    breakdown[tributo] = tributo === 'ISS' && opcoes.excluirIss
      ? 0
      : arredondarCentavos(basePartilha * (distribuicao[tributo] / 100))
  }

  // O PGDAS-D arredonda cada tributo em centavos e soma as parcelas apuradas.
  // Somar o breakdown evita divergências de R$ 0,01 em relação ao extrato oficial.
  const valorDas = somarBreakdown(breakdown)

  return {
    receita,
    rbt12,
    faixa: resultado,
    valorDas,
    distribuicao,
    breakdown,
  }
}

// Configuração por código de serviço (NFS-e) para apuração granular
export interface ConfigServicoAtividade {
  codigo_servico: string
  modo_tributacao: 'anexo_fixo' | 'fator_r'
  anexo_fixo?: 'III' | 'IV' | 'V'
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
  anexoServico?: AnexoSimples        // fallback por empresa (modo antigo)
  fatorR?: ResultadoApuracao['fator_r']
  configServicosAtividade?: ConfigServicoAtividade[]  // configuração por código de serviço
  fatorRAnexo?: AnexoSimples          // resultado pré-calculado do Fator R (III ou V)
}): ResultadoApuracao {
  const {
    documentos: documentosBrutos, itens: itensBrutos, rbt12, origem_rbt12,
    cnpjEmpresa, competencia, ehIndustrial = false,
    anexoServico,
    fatorR,
    configServicosAtividade,
    fatorRAnexo,
  } = params

  // Defesa em profundidade: se a fonte de dados (bug de importação, cache, re-render)
  // entregar o mesmo documento ou item mais de uma vez, o cálculo não deve contar em
  // dobro/quádruplo. A deduplicação "de verdade" (constraint de banco + upsert) mora em
  // fa_documentos_fiscais/fa_documentos_itens — isto aqui é só uma última barreira.
  const documentos = Array.from(new Map(documentosBrutos.map(d => [d.id, d])).values())
  const itens = Array.from(new Map(itensBrutos.map(i => [i.id, i])).values())

  const alertas: string[] = []
  const notas_devolucao: NotaDevolucao[] = []

  // Conferência cruzada: o CFOP determina o anexo, enquanto o CNAE sinaliza
  // combinações que merecem revisão. O aviso não altera silenciosamente a
  // natureza da receita indicada no documento fiscal.
  const divergenciasCnaeCfop = new Map<string, { anexo: 'I' | 'II'; itens: number }>()
  for (const item of itens) {
    if (item.impacto_receita !== 'soma_receita') continue
    const anexoCfop = anexoVendaMercadoriaPorCfop(item.cfop ?? '')
    if (!anexoCfop) continue
    const divergente = (anexoCfop === 'II' && !ehIndustrial) || (anexoCfop === 'I' && ehIndustrial)
    if (!divergente) continue
    const cfop = (item.cfop ?? '').replace(/\D/g, '').slice(0, 4) || 'não informado'
    const atual = divergenciasCnaeCfop.get(cfop) ?? { anexo: anexoCfop, itens: 0 }
    atual.itens += 1
    divergenciasCnaeCfop.set(cfop, atual)
  }
  for (const [cfop, divergencia] of divergenciasCnaeCfop) {
    if (divergencia.anexo === 'II') {
      alertas.push(
        `Conferência CNAE × CFOP: ${divergencia.itens} item(ns) com CFOP ${cfop} indicam produção própria/Anexo II, ` +
        'mas o CNAE principal cadastrado não foi identificado como industrial. Confirme a atividade e o CFOP utilizado.',
      )
    } else {
      alertas.push(
        `Conferência CNAE × CFOP: ${divergencia.itens} item(ns) com CFOP ${cfop} indicam revenda de mercadoria/Anexo I, ` +
        'embora o CNAE principal cadastrado seja industrial. A receita foi mantida no Anexo I; confirme a natureza da operação.',
      )
    }
  }

  let receita_vendas_bruta = 0
  let receita_devolucoes = 0
  let receita_st = 0
  let receita_exportacao = 0
  let total_iss_retido = 0
  let receita_servicos_com_iss_retido = 0
  let receita_servicos_sem_iss_retido = 0

  // Receitas por anexo (liquidas, já sem ST, exportação e devoluções)
  const receitas_por_anexo: Record<string, number> = {}
  const receitas_iss_retido_por_anexo: Record<string, number> = {}
  const usarItensComoBase = itens.length > 0

  // ── Processar documentos ──────────────────────────────────────────────
  for (const doc of documentos) {
    if (doc.status === 'cancelada') continue

    const infoIss = extrairInfoIssNfse(doc)
    if (doc.tipo_documento === 'nfse' && doc.impacto_receita === 'soma_receita' && infoIss.retido) {
      total_iss_retido += infoIss.valorRetido
    }

    const valorDoc = doc.valor_total ?? 0

    if (doc.impacto_receita === 'soma_receita') {
      // Determinar tipo de receita pelo primeiro item ou pelo documento
      const itensDoc = itens.filter(i => i.documento_id === doc.id)
      let valorReceitaDoc = usarItensComoBase ? 0 : valorDoc

      if (itensDoc.length > 0) {
        // Classificar por item — usar valor líquido (vProd − vDesc) per LC 123/2006 art. 3º §1º
        //
        // Correção de bug legado: versões antigas do parser aplicavam desconto proporcional
        // do documento (vDescNota) a TODOS os itens sem vDesc próprio, mesmo quando itens
        // com vDesc individual já somavam o total do desconto. Isso produz somaDescItens > vDescDoc.
        // Detectamos isso e zeramos o desconto nos itens que o receberam proporcionalmente (ratio ≈ global).

        valorReceitaDoc = 0
        const bugDetectado = false
        const globalRatio = 0
        for (const item of itensDoc) {
          let valorDesc = item.valor_desconto ?? 0
          if (bugDetectado && valorDesc > 0) {
            // Ratio do item ≈ ratio global → desconto foi aplicado proporcionalmente (bug) → zerar
            const itemRatio = (item.valor_total ?? 0) > 0 ? valorDesc / (item.valor_total ?? 0) : 0
            if (Math.abs(itemRatio - globalRatio) < 0.005) valorDesc = 0
          }
          const vItem = Math.max(0, (item.valor_total ?? 0) - valorDesc)
          if (vItem <= 0) continue

          if (item.impacto_receita !== 'soma_receita') continue
          valorReceitaDoc += vItem
          const chaveReceita = acumularReceita(item, vItem, ehIndustrial, anexoServico,
            receitas_por_anexo, incrementarSt, incrementarExp,
            configServicosAtividade, fatorRAnexo)
          if (itemEhServicoSimples(item)) {
            if (infoIss.retido) {
              receita_servicos_com_iss_retido += vItem
              if (chaveReceita) {
                receitas_iss_retido_por_anexo[chaveReceita] = (receitas_iss_retido_por_anexo[chaveReceita] ?? 0) + vItem
              }
            } else {
              receita_servicos_sem_iss_retido += vItem
            }
          }
        }
      } else if (!usarItensComoBase) {
        // Documento sem itens detalhados — usar classificação do documento
        const chaveReceita = acumularReceitaDoc(doc, valorDoc, ehIndustrial, anexoServico,
          receitas_por_anexo)
        if (doc.tipo_documento === 'nfse' || doc.valor_servicos > 0) {
          if (infoIss.retido) {
            receita_servicos_com_iss_retido += valorDoc
            if (chaveReceita) {
              receitas_iss_retido_por_anexo[chaveReceita] = (receitas_iss_retido_por_anexo[chaveReceita] ?? 0) + valorDoc
            }
          } else {
            receita_servicos_sem_iss_retido += valorDoc
          }
        }
      }

      receita_vendas_bruta += valorReceitaDoc

    } else if (doc.impacto_receita === 'reduz_receita') {
      const itensDoc = itens.filter(i => i.documento_id === doc.id && i.impacto_receita === 'reduz_receita')
      const valorDevolucao = itensDoc.length > 0
        ? itensDoc.reduce((s, item) => s + Math.max(0, (item.valor_total ?? 0) - (item.valor_desconto ?? 0)), 0)
        : usarItensComoBase ? 0 : valorDoc
      if (valorDevolucao <= 0) continue
      receita_devolucoes += valorDevolucao
      notas_devolucao.push({
        chave: doc.chave_acesso,
        numero: doc.numero,
        emitente: doc.emitente_nome ?? doc.emitente_cnpj,
        valor: valorDevolucao,
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
    for (const a of Object.keys(receitas_iss_retido_por_anexo)) {
      receitas_iss_retido_por_anexo[a] = Math.max(0, receitas_iss_retido_por_anexo[a] * (1 - propDev))
    }
    receita_servicos_com_iss_retido = Math.max(0, receita_servicos_com_iss_retido * (1 - propDev))
    receita_servicos_sem_iss_retido = Math.max(0, receita_servicos_sem_iss_retido * (1 - propDev))
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
    if (configServicosAtividade) {
      alertas.push('Serviços sem configuração de anexo detectados — configure cada serviço na aba Configurações')
    } else {
      alertas.push('Receitas de serviço sem definição de Anexo (III, IV ou V) — configurar regime de serviço da empresa')
    }
  }

  // ── Calcular DAS por anexo ────────────────────────────────────────────
  const por_anexo: Record<string, ResultadoDas> = {}
  let valor_das_total = 0
  let valor_iss_excluido_das = 0
  let valor_das_a_pagar = 0

  for (const [chaveAnexo, receita] of Object.entries(receitas_por_anexo)) {
    if (receita <= 0 || chaveAnexo === 'servico_pendente') continue
    const anexo = chaveAnexo as AnexoSimples
    const das = calcularDas(receita, rbt12, anexo)
    if (das) {
      const receitaComRetencao = Math.min(receita, receitas_iss_retido_por_anexo[chaveAnexo] ?? 0)
      if (receitaComRetencao > 0) {
        const receitaSemRetencao = Math.max(0, receita - receitaComRetencao)
        const dasSemRetencao = calcularDas(receitaSemRetencao, rbt12, anexo)
        const dasComRetencaoBruto = calcularDas(receitaComRetencao, rbt12, anexo)
        const dasComRetencao = calcularDas(receitaComRetencao, rbt12, anexo, { excluirIss: true })

        if (!dasComRetencaoBruto || !dasComRetencao) continue

        const issExcluido = dasComRetencaoBruto.breakdown.ISS
        for (const tributo of Object.keys(das.distribuicao) as Array<keyof DistribuicaoSimples>) {
          das.breakdown[tributo] = arredondarCentavos(
            (dasSemRetencao?.breakdown[tributo] ?? 0) + dasComRetencaoBruto.breakdown[tributo],
          )
        }
        das.valorDas = somarBreakdown(das.breakdown)
        das.valorDasAPagar = arredondarCentavos(
          (dasSemRetencao?.valorDas ?? 0) + dasComRetencao.valorDas,
        )
        das.segregacaoIss = {
          receitaComRetencao,
          receitaSemRetencao,
          valorIssExcluido: issExcluido,
          semRetencao: dasSemRetencao ? {
            receita: receitaSemRetencao,
            valorDas: dasSemRetencao.valorDas,
            breakdown: dasSemRetencao.breakdown,
          } : null,
          comRetencao: {
            receita: receitaComRetencao,
            valorDas: dasComRetencao.valorDas,
            breakdown: dasComRetencao.breakdown,
          },
        }
        valor_iss_excluido_das += issExcluido
      } else {
        das.valorDasAPagar = das.valorDas
      }
      por_anexo[anexo] = das
      valor_das_total += das.valorDas
      valor_das_a_pagar += das.valorDasAPagar
    }
  }

  // A receita com retenção continua sujeita aos tributos federais do Simples.
  // Exclui-se somente a parcela de ISS calculada na repartição do respectivo anexo;
  // o valor nominal retido na NFS-e não é abatido integralmente do DAS.
  valor_das_total = arredondarCentavos(valor_das_total)
  valor_iss_excluido_das = arredondarCentavos(valor_iss_excluido_das)
  valor_das_a_pagar = arredondarCentavos(Math.max(0, valor_das_a_pagar))
  if (receita_servicos_com_iss_retido > 0) {
    alertas.push(
      `Receita de serviços com ISS retido (${fmtBRL(receita_servicos_com_iss_retido)}) segregada; ` +
      `parcela de ISS excluída do DAS: ${fmtBRL(valor_iss_excluido_das)}`,
    )
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
    total_iss_retido,
    receita_servicos_com_iss_retido,
    receita_servicos_sem_iss_retido,
    valor_iss_excluido_das,
    valor_das_a_pagar,
    alertas,
    notas_devolucao,
    fator_r: fatorR,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Auxiliares internos
// ──────────────────────────────────────────────────────────────────────────

function arredondarCentavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

function somarBreakdown(breakdown: Record<keyof DistribuicaoSimples, number>): number {
  return arredondarCentavos(Object.values(breakdown).reduce((total, valor) => total + valor, 0))
}

function acumularReceita(
  item: DocumentoFiscalItem,
  valor: number,
  ehIndustrial: boolean,
  anexoServico: AnexoSimples | undefined,
  receitas_por_anexo: Record<string, number>,
  incrSt: (v: number) => void,
  incrExp: (v: number) => void,
  configServicosAtividade?: ConfigServicoAtividade[],
  fatorRAnexo?: AnexoSimples,
): string | null {
  const nat = item.natureza_receita_simples
  const itemEhServico = itemEhServicoSimples(item)

  if (nat === 'st') {
    incrSt(valor)
    return null  // ST não entra na base de cálculo do DAS
  }
  if (nat === 'exportacao') {
    incrExp(valor)
    // Exportação pode ter IRPJ/CSLL no Simples; vamos incluir no Anexo correspondente
    const anexo = item.anexo_sugerido ?? (ehIndustrial ? 'II' : 'I')
    receitas_por_anexo[anexo] = (receitas_por_anexo[anexo] ?? 0) + valor
    return anexo
  }
  if (nat === 'nao_receita' || nat === 'devolucao') return null

  // Configuração por código de serviço (NFS-e): toma prioridade sobre a config por empresa
  if (itemEhServico && configServicosAtividade) {
    const codigoServico = item.codigo_produto
    const cfgServico = codigoServico
      ? configServicosAtividade.find(c => c.codigo_servico === codigoServico)
      : undefined

    if (!cfgServico) {
      // Código de serviço sem configuração → pendente
      receitas_por_anexo['servico_pendente'] = (receitas_por_anexo['servico_pendente'] ?? 0) + valor
      return 'servico_pendente'
    }

    if (cfgServico.modo_tributacao === 'fator_r') {
      const chave = fatorRAnexo ?? 'V'
      receitas_por_anexo[chave] = (receitas_por_anexo[chave] ?? 0) + valor
      return chave
    }

    const chave = cfgServico.anexo_fixo
    if (!chave) {
      receitas_por_anexo['servico_pendente'] = (receitas_por_anexo['servico_pendente'] ?? 0) + valor
      return 'servico_pendente'
    }
    receitas_por_anexo[chave] = (receitas_por_anexo[chave] ?? 0) + valor
    return chave
  }

  // O CFOP da venda prevalece sobre sugestões antigas persistidas. O CNAE é
  // usado apenas como fallback quando a operação não distingue I de II.
  const anexoPeloCfop = itemEhServico ? null : anexoVendaMercadoriaPorCfop(item.cfop ?? '')
  const anexo = anexoPeloCfop ?? item.anexo_sugerido ?? (item.impacto_receita === 'soma_receita' && !itemEhServico ? (ehIndustrial ? 'II' : 'I') : null)
  if (!anexo) {
    receitas_por_anexo['servico_pendente'] = (receitas_por_anexo['servico_pendente'] ?? 0) + valor
    return 'servico_pendente'
  }

  const chave = anexo === 'III' || anexo === 'IV' || anexo === 'V'
    ? anexoServico   // usa o anexo configurado para serviços
    : anexo

  if (!chave) {
    receitas_por_anexo['servico_pendente'] = (receitas_por_anexo['servico_pendente'] ?? 0) + valor
    return 'servico_pendente'
  }

  receitas_por_anexo[chave] = (receitas_por_anexo[chave] ?? 0) + valor
  return chave
}

function acumularReceitaDoc(
  doc: DocumentoFiscal,
  valor: number,
  ehIndustrial: boolean,
  anexoServico: AnexoSimples | undefined,
  receitas_por_anexo: Record<string, number>,
): string {
  if (doc.tipo_documento === 'nfse' || doc.valor_servicos > 0) {
    if (!anexoServico) {
      receitas_por_anexo['servico_pendente'] = (receitas_por_anexo['servico_pendente'] ?? 0) + valor
      return 'servico_pendente'
    }
    receitas_por_anexo[anexoServico] = (receitas_por_anexo[anexoServico] ?? 0) + valor
    return anexoServico
  }

  // Sem itens detalhados — usar CNAE/tipo da empresa para sugerir anexo
  const anexo = ehIndustrial ? 'II' : 'I'
  receitas_por_anexo[anexo] = (receitas_por_anexo[anexo] ?? 0) + valor
  return anexo
}

function itemEhServicoSimples(item: DocumentoFiscalItem): boolean {
  return item.classificacao === 'servico' ||
    item.anexo_sugerido === 'III' || item.anexo_sugerido === 'IV' || item.anexo_sugerido === 'V'
}

function extrairInfoIssNfse(doc: DocumentoFiscal): { retido: boolean; valorRetido: number } {
  if (doc.tipo_documento !== 'nfse') return { retido: false, valorRetido: 0 }
  const parsed = doc.parsed_data && typeof doc.parsed_data === 'object'
    ? doc.parsed_data as Record<string, unknown>
    : {}
  const meta = parsed.metadados && typeof parsed.metadados === 'object'
    ? parsed.metadados as Record<string, unknown>
    : {}

  const indicador = meta.iss_retido
  const indicadorNormalizado = typeof indicador === 'string' ? indicador.trim().toLowerCase() : indicador
  const tipoRetencao = String(meta.tipo_retencao_iss ?? '').trim()
  let retido = indicadorNormalizado === true || indicadorNormalizado === 1 ||
    ['1', 'true', 's', 'sim', 'yes'].includes(String(indicadorNormalizado)) ||
    ['2', '3'].includes(tipoRetencao)

  const xml = typeof parsed.xml === 'string' ? parsed.xml : ''
  if (!retido && xml) {
    retido = /<(?:[\w.-]+:)?(?:IssRetido|ISSRetido|RetencaoISS|RetemISS)\b[^>]*>\s*(?:1|true|s|sim)\s*</i.test(xml) ||
      /<(?:[\w.-]+:)?(?:tpRetISSQN|TipoRetencaoISSQN|TipoRetencaoIss)\b[^>]*>\s*(?:2|3)\s*</i.test(xml)
  }

  const valorMeta = Number(meta.valor_iss_retido ?? meta.valor_iss ?? 0)
  const valorXmlMatch = xml.match(/<(?:[\w.-]+:)?(?:ValorIssRetido|ValorISSRetido|vISSQNRet|vISSRet|ValorIss|ValorISS|vISSQN)\b[^>]*>\s*([\d.,]+)\s*</i)
  const valorXml = valorXmlMatch?.[1]
    ? Number(valorXmlMatch[1].includes(',') ? valorXmlMatch[1].replace(/\./g, '').replace(',', '.') : valorXmlMatch[1])
    : 0
  const valorRetido = Number.isFinite(valorMeta) && valorMeta > 0
    ? valorMeta
    : Number.isFinite(valorXml) && valorXml > 0 ? valorXml : 0

  return { retido, valorRetido: retido ? valorRetido : 0 }
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

// Calcula o RBT12 a partir de um array de receitas mensais (últimos 12 meses)
export function calcularRbt12(receitas: { competencia: string; receita_bruta_mes: number }[]): number {
  return receitas.reduce((acc, r) => acc + (r.receita_bruta_mes ?? 0), 0)
}
