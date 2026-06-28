// Motor ICMS por níveis de confiança
// Nível 1: dados reais destacados nas NF-e
// Nível 2: simulação por alíquota quando dados faltam
// Créditos: apenas entradas com CFOP creditável e classificação correta

import type { DocumentoFiscal, DocumentoFiscalItem } from '@/lib/types'
import type {
  DadosBrutosEmpresa,
  PremissesCenario,
  ItemIcms,
  NivelIcms,
  ResultadoIcmsMes,
  ResultadoIcms,
} from './types'

// CFOPs de saída que geram débito de ICMS
const CFOP_SAIDA_TRIBUTADA = new Set([
  '5101', '5102', '5103', '5104', '5105', '5106', '5109', '5110', '5111', '5112', '5113', '5114', '5115', '5116', '5118', '5119', '5120', '5122', '5123', '5124', '5125',
  '6101', '6102', '6103', '6104', '6105', '6106', '6107', '6108', '6109', '6110', '6111', '6112', '6113', '6114', '6116', '6117', '6118', '6119', '6120', '6122', '6123', '6124', '6125',
])

// CSTs de ICMS que geram débito (tributação normal)
const CST_COM_DEBITO = new Set(['00', '10', '20', '70', '90'])
// CSOSN que representam tributação no Simples (sem destaque de ICMS)
const CSOSN_SIMPLES_COM_ICMS = new Set(['102', '103', '300', '400', '500', '900'])

// CFOPs de entrada creditáveis (revenda, insumo, matéria-prima)
const CFOP_ENTRADA_CREDITAVEL = new Set([
  '1101', '1102', '1111', '1113', '1116', '1117', '1118', '1120', '1121', '1122', '1124', '1125',
  '2101', '2102', '2111', '2113', '2116', '2117', '2118', '2120', '2121', '2122', '2124', '2125',
])

// CFOPs de uso e consumo (não creditáveis)
const CFOP_USO_CONSUMO = new Set([
  '1401', '1403', '2401', '2403',
])

export function simularIcms(
  empresas: DadosBrutosEmpresa[],
  premissas: PremissesCenario,
): ResultadoIcms {
  const alertasGerais: string[] = []
  const { icms: pi } = premissas

  const itensPorMes = new Map<string, ItemIcms[]>()

  for (const { empresa, documentos, itens } of empresas) {
    if (pi.modo === 'apenas_real' && empresa.regime === 'Simples Nacional') {
      // No modo "apenas real", ignorar notas do Simples que não têm ICMS destacado
      alertasGerais.push(
        `Empresa ${empresa.razao_social}: modo "apenas real" selecionado, mas notas do Simples Nacional não destacam ICMS. Poucos dados reais disponíveis.`
      )
    }

    for (const doc of documentos) {
      if (doc.status === 'cancelada') continue

      const comp = docCompetencia(doc)
      if (!comp) continue

      if (!itensPorMes.has(comp)) itensPorMes.set(comp, [])
      const bucket = itensPorMes.get(comp)!

      const itensDoc = itens.filter(i => i.documento_id === doc.id)

      if (itensDoc.length > 0) {
        for (const item of itensDoc) {
          const resultado = processarItemIcms(item, doc, empresa.id, comp, premissas)
          if (resultado) bucket.push(resultado)
        }
      } else {
        // Documento sem itens: usar valores agregados
        const resultado = processarDocSemItens(doc, empresa.id, comp, premissas)
        if (resultado) bucket.push(resultado)
      }
    }
  }

  const competencias = Array.from(itensPorMes.keys()).sort(sortComp)

  const porMes: ResultadoIcmsMes[] = competencias.map(comp => {
    const itensComp = itensPorMes.get(comp) ?? []

    let debitoReal = 0
    let debitoSimulado = 0
    let creditoAproveitavel = 0
    let creditoGlosado = 0
    let icmsSt = 0
    const alertas: string[] = []

    for (const item of itensComp) {
      if (item.nivel === 'st_encerrado') {
        icmsSt += item.valorIcms
        continue
      }
      if (item.nivel === 'isento_ou_nao_tributado') continue

      if (item.ehCredito) {
        if (item.motivoSemCredito) {
          creditoGlosado += item.valorIcms
        } else {
          creditoAproveitavel += item.valorIcms
        }
      } else {
        if (item.nivel === 'real_destacado') {
          debitoReal += item.valorIcms
        } else if (item.nivel === 'simulado_por_aliquota') {
          debitoSimulado += item.valorIcms
        }
      }
    }

    const icmsEstimadoPagar = round2(
      Math.max(0, (debitoReal + debitoSimulado) - creditoAproveitavel)
    )

    const totalItensReal = itensComp.filter(i => i.nivel === 'real_destacado').length
    const totalItens = itensComp.filter(i => i.nivel !== 'isento_ou_nao_tributado' && i.nivel !== 'st_encerrado').length

    const nivelConfianca: 'alto' | 'medio' | 'baixo' =
      totalItens === 0 ? 'baixo'
      : totalItensReal / totalItens >= 0.8 ? 'alto'
      : totalItensReal / totalItens >= 0.4 ? 'medio'
      : 'baixo'

    if (pi.modo === 'apenas_real' && debitoSimulado > 0) {
      alertas.push('Modo "apenas real" selecionado, mas há itens simulados. Verifique o modo nas premissas.')
    }

    return {
      competencia: comp,
      debitoReal: round2(debitoReal),
      debitoSimulado: round2(debitoSimulado),
      creditoAproveitavel: round2(creditoAproveitavel),
      creditoGlosado: round2(creditoGlosado),
      icmsSt: round2(icmsSt),
      icmsEstimadoPagar,
      nivelConfianca,
      itens: itensComp,
      alertas,
    }
  })

  const totalDebitoReal = porMes.reduce((s, m) => s + m.debitoReal, 0)
  const totalDebitoSimulado = porMes.reduce((s, m) => s + m.debitoSimulado, 0)
  const totalCreditoAproveitavel = porMes.reduce((s, m) => s + m.creditoAproveitavel, 0)
  const totalEstimadoPagar = porMes.reduce((s, m) => s + m.icmsEstimadoPagar, 0)

  alertasGerais.push(
    'Simulação de ICMS é hipotética: empresas no Simples Nacional não destacam ICMS nas saídas. ' +
    'A análise considera como seria o ICMS caso as empresas migrassem para regime normal.'
  )
  alertasGerais.push(
    'Créditos de ICMS de entradas classificadas como uso e consumo NÃO foram considerados (regra geral: LC 87/96 art. 33).'
  )
  if (pi.modo === 'conservador') {
    alertasGerais.push('Modo conservador: créditos de entradas com classificação incerta foram glosados.')
  }

  return {
    porMes,
    totalDebitoReal: round2(totalDebitoReal),
    totalDebitoSimulado: round2(totalDebitoSimulado),
    totalCreditoAproveitavel: round2(totalCreditoAproveitavel),
    totalEstimadoPagar: round2(totalEstimadoPagar),
    alertas: alertasGerais,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Auxiliares internos
// ──────────────────────────────────────────────────────────────────────────────

function processarItemIcms(
  item: DocumentoFiscalItem,
  doc: DocumentoFiscal,
  empresaId: string,
  comp: string,
  premissas: PremissesCenario,
): ItemIcms | null {
  const pi = premissas.icms
  const cfop = item.cfop ?? ''
  const ehSaida = doc.tipo_movimento === 'saida' || doc.tipo_movimento === 'devolucao_compra'
  const ehEntrada = !ehSaida

  // Verificar se ST
  if ((item.valor_st ?? 0) > 0 || item.cst_icms === '60' || item.cst_icms === '10' || item.csosn === '500') {
    return {
      documentoId: doc.id,
      empresaId,
      competencia: comp,
      descricao: item.descricao,
      cfop,
      ncm: item.ncm,
      cstIcms: item.cst_icms,
      csosn: item.csosn,
      valorBase: item.valor_bc_st ?? 0,
      aliquotaUsada: 0,
      valorIcms: item.valor_st ?? 0,
      origemAliquota: 'st_real',
      nivel: 'st_encerrado',
      ehCredito: false,
      motivoSemCredito: 'Operação com ST — tributação encerrada',
    }
  }

  // Verificar isenção / não tributado
  if (
    item.cst_icms === '40' || item.cst_icms === '41' || item.cst_icms === '50' ||
    item.csosn === '300' || item.csosn === '400' ||
    cfop.startsWith('7')  // exportação
  ) {
    return {
      documentoId: doc.id,
      empresaId,
      competencia: comp,
      descricao: item.descricao,
      cfop,
      ncm: item.ncm,
      cstIcms: item.cst_icms,
      csosn: item.csosn,
      valorBase: 0,
      aliquotaUsada: 0,
      valorIcms: 0,
      origemAliquota: 'isencao_ou_exportacao',
      nivel: 'isento_ou_nao_tributado',
      ehCredito: false,
    }
  }

  if (ehSaida) {
    return processarSaida(item, doc, empresaId, comp, pi)
  } else if (ehEntrada) {
    return processarEntrada(item, doc, empresaId, comp, pi)
  }

  return null
}

function processarSaida(
  item: DocumentoFiscalItem,
  doc: DocumentoFiscal,
  empresaId: string,
  comp: string,
  pi: PremissesCenario['icms'],
): ItemIcms {
  const cfop = item.cfop ?? ''

  // Dados reais disponíveis
  if ((item.valor_icms ?? 0) > 0 && (item.aliquota_icms ?? 0) > 0) {
    return {
      documentoId: doc.id,
      empresaId,
      competencia: comp,
      descricao: item.descricao,
      cfop,
      ncm: item.ncm,
      cstIcms: item.cst_icms,
      csosn: item.csosn,
      valorBase: item.valor_bc_icms ?? item.valor_total ?? 0,
      aliquotaUsada: (item.aliquota_icms ?? 0) / 100,
      valorIcms: item.valor_icms,
      origemAliquota: 'nfe_destacado',
      nivel: 'real_destacado',
      ehCredito: false,
    }
  }

  if (pi.modo === 'apenas_real') {
    return {
      documentoId: doc.id,
      empresaId,
      competencia: comp,
      descricao: item.descricao,
      cfop,
      ncm: item.ncm,
      cstIcms: item.cst_icms,
      csosn: item.csosn,
      valorBase: 0,
      aliquotaUsada: 0,
      valorIcms: 0,
      origemAliquota: 'sem_dado_real',
      nivel: 'sem_base_suficiente',
      ehCredito: false,
      motivoSemCredito: 'Modo "apenas real" — sem dado real disponível',
    }
  }

  // Simular alíquota
  const ufDestino = doc.destinatario_cnpj ? ufPorCnpj(doc.destinatario_cnpj) : null
  const aliquota = determinarAliquotaSaida(ufDestino, pi)
  const base = item.valor_bc_icms > 0 ? item.valor_bc_icms : (item.valor_total ?? 0)
  const valorIcms = round2(base * aliquota.valor)

  return {
    documentoId: doc.id,
    empresaId,
    competencia: comp,
    descricao: item.descricao,
    cfop,
    ncm: item.ncm,
    cstIcms: item.cst_icms,
    csosn: item.csosn,
    valorBase: base,
    aliquotaUsada: aliquota.valor,
    valorIcms,
    origemAliquota: aliquota.origem,
    nivel: 'simulado_por_aliquota',
    ehCredito: false,
  }
}

function processarEntrada(
  item: DocumentoFiscalItem,
  doc: DocumentoFiscal,
  empresaId: string,
  comp: string,
  pi: PremissesCenario['icms'],
): ItemIcms {
  const cfop = item.cfop ?? ''
  const classificacao = item.classificacao

  // Uso e consumo: sem crédito (regra geral)
  if (
    classificacao === 'uso_consumo' ||
    CFOP_USO_CONSUMO.has(cfop) ||
    cfop.startsWith('1401') || cfop.startsWith('2401')
  ) {
    return {
      documentoId: doc.id,
      empresaId,
      competencia: comp,
      descricao: item.descricao,
      cfop,
      ncm: item.ncm,
      cstIcms: item.cst_icms,
      csosn: item.csosn,
      valorBase: item.valor_bc_icms ?? item.valor_total ?? 0,
      aliquotaUsada: (item.aliquota_icms ?? 0) / 100,
      valorIcms: item.valor_icms ?? 0,
      origemAliquota: 'entrada_uso_consumo',
      nivel: (item.valor_icms ?? 0) > 0 ? 'real_destacado' : 'simulado_por_aliquota',
      ehCredito: true,
      motivoSemCredito: 'Uso e consumo — crédito vedado (LC 87/96 art. 33)',
    }
  }

  // Imobilizado: crédito via CIAP 1/48 — marcar como glosado neste contexto
  if (classificacao === 'imobilizado') {
    return {
      documentoId: doc.id,
      empresaId,
      competencia: comp,
      descricao: item.descricao,
      cfop,
      ncm: item.ncm,
      valorBase: item.valor_bc_icms ?? item.valor_total ?? 0,
      aliquotaUsada: (item.aliquota_icms ?? 0) / 100,
      valorIcms: item.valor_icms ?? 0,
      origemAliquota: 'entrada_imobilizado',
      nivel: (item.valor_icms ?? 0) > 0 ? 'real_destacado' : 'simulado_por_aliquota',
      ehCredito: true,
      motivoSemCredito: 'Ativo imobilizado — crédito via CIAP (1/48 ao mês); não incluído na simulação',
    }
  }

  // Revenda/insumo: potencialmente creditável
  const eCreditavel =
    classificacao === 'revenda' ||
    classificacao === 'insumo' ||
    CFOP_ENTRADA_CREDITAVEL.has(cfop)

  if (!eCreditavel && pi.modo === 'conservador') {
    return {
      documentoId: doc.id,
      empresaId,
      competencia: comp,
      descricao: item.descricao,
      cfop,
      ncm: item.ncm,
      valorBase: item.valor_bc_icms ?? item.valor_total ?? 0,
      aliquotaUsada: (item.aliquota_icms ?? 0) / 100,
      valorIcms: item.valor_icms ?? 0,
      origemAliquota: 'entrada_sem_classificacao',
      nivel: 'sem_base_suficiente',
      ehCredito: true,
      motivoSemCredito: 'Modo conservador — classificação incerta, crédito glosado por precaução',
    }
  }

  // Dado real
  if ((item.valor_icms ?? 0) > 0) {
    return {
      documentoId: doc.id,
      empresaId,
      competencia: comp,
      descricao: item.descricao,
      cfop,
      ncm: item.ncm,
      cstIcms: item.cst_icms,
      csosn: item.csosn,
      valorBase: item.valor_bc_icms ?? item.valor_total ?? 0,
      aliquotaUsada: (item.aliquota_icms ?? 0) / 100,
      valorIcms: item.valor_icms,
      origemAliquota: 'nfe_destacado',
      nivel: 'real_destacado',
      ehCredito: true,
      motivoCredito: 'Entrada para revenda/insumo com ICMS destacado',
    }
  }

  // Entrada sem ICMS destacado (ex: fornecedor do Simples) — não há crédito
  return {
    documentoId: doc.id,
    empresaId,
    competencia: comp,
    descricao: item.descricao,
    cfop,
    ncm: item.ncm,
    valorBase: item.valor_total ?? 0,
    aliquotaUsada: 0,
    valorIcms: 0,
    origemAliquota: 'entrada_sem_icms',
    nivel: 'sem_base_suficiente',
    ehCredito: true,
    motivoSemCredito: 'Fornecedor sem destaque de ICMS (possivelmente do Simples) — sem crédito',
  }
}

function processarDocSemItens(
  doc: DocumentoFiscal,
  empresaId: string,
  comp: string,
  premissas: PremissesCenario,
): ItemIcms | null {
  const pi = premissas.icms
  const ehSaida = doc.tipo_movimento === 'saida'

  if ((doc.valor_icms ?? 0) > 0) {
    return {
      documentoId: doc.id,
      empresaId,
      competencia: comp,
      valorBase: doc.valor_total ?? 0,
      aliquotaUsada: doc.valor_total > 0 ? (doc.valor_icms / doc.valor_total) : 0,
      valorIcms: doc.valor_icms,
      origemAliquota: 'nfe_destacado_doc',
      nivel: 'real_destacado',
      ehCredito: !ehSaida,
      motivoCredito: !ehSaida ? 'ICMS destacado na nota de entrada' : undefined,
    }
  }

  if (pi.modo === 'apenas_real') return null

  if (ehSaida) {
    const ufDestino = doc.destinatario_cnpj ? ufPorCnpj(doc.destinatario_cnpj) : null
    const aliquota = determinarAliquotaSaida(ufDestino, pi)
    const base = doc.valor_total ?? 0
    const valorIcms = round2(base * aliquota.valor)
    if (valorIcms <= 0) return null
    return {
      documentoId: doc.id,
      empresaId,
      competencia: comp,
      valorBase: base,
      aliquotaUsada: aliquota.valor,
      valorIcms,
      origemAliquota: aliquota.origem,
      nivel: 'simulado_por_aliquota',
      ehCredito: false,
    }
  }

  return null
}

function determinarAliquotaSaida(
  ufDestino: string | null,
  pi: PremissesCenario['icms'],
): { valor: number; origem: string } {
  if (!ufDestino || ufDestino === pi.ufEmpresa) {
    return { valor: pi.aliquotaInternaDefault, origem: `aliquota_interna_${pi.ufEmpresa}` }
  }

  const regioesSul = new Set(['SP', 'MG', 'RS', 'PR', 'SC', 'RJ', 'ES'])
  if (regioesSul.has(ufDestino)) {
    return { valor: pi.aliquotaInterestadualSul, origem: `aliquota_interestadual_sul_${ufDestino}` }
  }

  return { valor: pi.aliquotaInterestadualNorte, origem: `aliquota_interestadual_norte_${ufDestino}` }
}

// Heurística simples: 2 dígitos do CNPJ não revelam UF diretamente
// mas podemos tentar detectar pelo código de município no futuro.
// Por ora, retorna null (sem UF) para evitar erro silencioso.
function ufPorCnpj(_cnpj: string): string | null {
  return null
}

function docCompetencia(doc: DocumentoFiscal): string | null {
  const d = doc.data_competencia ?? doc.data_emissao
  if (!d) return null
  if (/^\d{2}\/\d{4}$/.test(d)) return d
  if (/^\d{4}-\d{2}/.test(d)) {
    const [y, m] = d.split('-')
    return `${m}/${y}`
  }
  return null
}

function parseMesAno(comp: string): number {
  const [m, y] = comp.split('/')
  return parseInt(y) * 100 + parseInt(m)
}

function sortComp(a: string, b: string) {
  return parseMesAno(a) - parseMesAno(b)
}

function round2(v: number) {
  return Math.round(v * 100) / 100
}
