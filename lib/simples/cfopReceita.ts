// Classificação de CFOP para apuração do Simples Nacional
// Determina o tipo de movimento e o impacto na receita bruta de cada documento.

import type { TipoMovimento, ImpactoReceita, OrigemDevolucao, NaturezaReceitaSimples } from '@/lib/types'
import type { AnexoSimples } from './tabelasAnexos'

// ──────────────────────────────────────────────────────────────────────────
// Listas de CFOPs por categoria
// ──────────────────────────────────────────────────────────────────────────

// Vendas de mercadorias (comércio/revenda) — Anexo I
const CFOP_VENDA_COMERCIO = new Set([
  '5101','5102','5111','5113','5114','5115','5116','5117','5118','5119',
  '6101','6102','6111','6113','6114','6115','6116','6117','6118','6119',
  '5120','5122','5123','5124','5125','6120','6122','6123','6124','6125',
])

// Vendas de produtos industrializados — Anexo II (quando empresa é indústria)
const CFOP_VENDA_INDUSTRIA = new Set([
  '5101','5102','6101','6102',
])

// Vendas com substituição tributária — receita ST (excluída da base Simples)
const CFOP_VENDA_ST = new Set([
  '5401','5402','5403','5405','5500','5501','5502','5503','5504',
  '6401','6402','6403','6404','6405','6500','6501','6502','6503','6504',
])

// Prestação de serviços — Anexo III/IV/V
const CFOP_SERVICO = new Set([
  '5301','5302','5303','5304','5305','5306','5307','5308','5309',
  '6301','6302','6303','6304','6305','6306','6307','6308','6309',
])

// Exportações — receita de exportação (isenção PIS/COFINS; IRPJ/CSLL também no Simples)
const CFOP_EXPORTACAO = new Set([
  '7101','7102','7105','7106','7127',
  '7201','7202','7203','7205','7206','7208','7210','7211',
  '7301','7302','7303','7304','7305','7306',
  '7401','7501','7651','7652','7654','7667','7930',
])

// Devoluções de venda — redutoras da receita bruta
// Podem ser emitidas pela própria empresa (como nota de entrada)
// ou recebidas de terceiros/clientes
const CFOP_DEVOLUCAO_VENDA = new Set([
  '1201','1202','1203','1204','1209','1410','1411',
  '2201','2202','2203','2204','2209','2410','2411',
])

// Devoluções de compra — saídas que não impactam receita de vendas
const CFOP_DEVOLUCAO_COMPRA = new Set([
  '5201','5202','5203','5204','5205','5206','5207','5208','5209','5210',
  '6201','6202','6203','6204','6205','6206','6207','6208','6209','6210',
])

// Remessas, transferências e operações sem receita
const CFOP_REMESSA = new Set([
  '5601','5602','5603','5604','5605','5606','5607',
  '6601','6602','6603','6604','6605','6606','6607',
  '5901','5902','5903','5904','5905','5906','5907','5908','5909',
  '5910','5911','5912','5913','5914','5915','5916',
  '6901','6902','6903','6904','6905','6906','6907','6908','6909',
  '6910','6911','6912','6913','6914','6915','6916',
  '5501','5502','5503','5504','5505',
  '6501','6502','6503','6504','6505',
])

// Transferências entre estabelecimentos do mesmo CNPJ raiz
const CFOP_TRANSFERENCIA = new Set([
  '5151','5152','5153','5154','5155','5156',
  '6151','6152','6153','6154','6155','6156',
  '1151','1152','1153','1154','1155','1156',
  '2151','2152','2153','2154','2155','2156',
])

// ──────────────────────────────────────────────────────────────────────────
// Resultado da classificação
// ──────────────────────────────────────────────────────────────────────────
export interface ClassificacaoCfop {
  tipo_movimento: TipoMovimento
  impacto_receita: ImpactoReceita
  natureza_receita_simples: NaturezaReceitaSimples
  origem_devolucao: OrigemDevolucao
  anexo_sugerido: AnexoSimples | null
  regra_aplicada: string
}

// ──────────────────────────────────────────────────────────────────────────
// Função principal de classificação
//
// @param cfop          CFOP do item (4 dígitos)
// @param tpNF          "0" = entrada, "1" = saída (campo tpNF do XML da NF-e)
// @param emitenteCnpj  CNPJ do emitente da NF-e (somente dígitos)
// @param empresaCnpj   CNPJ da empresa analisada (somente dígitos)
// @param ehIndustrial  true quando a empresa tem CNAE industrial (10-33)
// ──────────────────────────────────────────────────────────────────────────
export function classificarCfop(
  cfop: string,
  tpNF: string,
  emitenteCnpj: string,
  empresaCnpj: string,
  ehIndustrial = false,
): ClassificacaoCfop {
  const cfop4 = cfop.replace(/\D/g, '').slice(0, 4)
  const emitenteEhEmpresa = emitenteCnpj.replace(/\D/g, '') === empresaCnpj.replace(/\D/g, '')
  const ehSaida = tpNF === '1'
  const ehEntrada = tpNF === '0'

  // ── Devoluções de venda ────────────────────────────────────────────────
  if (CFOP_DEVOLUCAO_VENDA.has(cfop4)) {
    // Nota de entrada recebida de terceiro (cliente devolveu mercadoria)
    if (ehEntrada && !emitenteEhEmpresa) {
      return {
        tipo_movimento: 'devolucao_venda',
        impacto_receita: 'reduz_receita',
        natureza_receita_simples: 'devolucao',
        origem_devolucao: 'emitida_terceiro',
        anexo_sugerido: null,
        regra_aplicada: `Devolução de venda recebida de terceiro (CFOP ${cfop4})`,
      }
    }
    // Empresa emitiu nota de entrada para anular venda própria
    if (ehEntrada && emitenteEhEmpresa) {
      return {
        tipo_movimento: 'devolucao_venda',
        impacto_receita: 'reduz_receita',
        natureza_receita_simples: 'devolucao',
        origem_devolucao: 'emitida_propria',
        anexo_sugerido: null,
        regra_aplicada: `Devolução de venda emitida pela própria empresa (CFOP ${cfop4})`,
      }
    }
  }

  // ── Devoluções de compra (saídas — não impactam receita) ───────────────
  if (CFOP_DEVOLUCAO_COMPRA.has(cfop4)) {
    return {
      tipo_movimento: 'devolucao_compra',
      impacto_receita: 'sem_impacto',
      natureza_receita_simples: 'nao_receita',
      origem_devolucao: 'nao_aplicavel',
      anexo_sugerido: null,
      regra_aplicada: `Devolução de compra (CFOP ${cfop4})`,
    }
  }

  // ── Transferências ─────────────────────────────────────────────────────
  if (CFOP_TRANSFERENCIA.has(cfop4)) {
    return {
      tipo_movimento: 'transferencia',
      impacto_receita: 'sem_impacto',
      natureza_receita_simples: 'nao_receita',
      origem_devolucao: 'nao_aplicavel',
      anexo_sugerido: null,
      regra_aplicada: `Transferência entre estabelecimentos (CFOP ${cfop4})`,
    }
  }

  // ── Remessas ───────────────────────────────────────────────────────────
  if (CFOP_REMESSA.has(cfop4)) {
    return {
      tipo_movimento: 'remessa',
      impacto_receita: 'sem_impacto',
      natureza_receita_simples: 'nao_receita',
      origem_devolucao: 'nao_aplicavel',
      anexo_sugerido: null,
      regra_aplicada: `Remessa sem receita (CFOP ${cfop4})`,
    }
  }

  if (!ehSaida) {
    // Para entradas que não são devoluções de venda, não somam receita
    return {
      tipo_movimento: 'entrada',
      impacto_receita: 'sem_impacto',
      natureza_receita_simples: 'nao_receita',
      origem_devolucao: 'nao_aplicavel',
      anexo_sugerido: null,
      regra_aplicada: `Nota de entrada sem impacto na receita (CFOP ${cfop4})`,
    }
  }

  // ── A partir daqui: notas de SAÍDA ────────────────────────────────────

  // Exportação
  if (CFOP_EXPORTACAO.has(cfop4)) {
    return {
      tipo_movimento: 'saida',
      impacto_receita: 'soma_receita',
      natureza_receita_simples: 'exportacao',
      origem_devolucao: 'nao_aplicavel',
      anexo_sugerido: ehIndustrial ? 'II' : 'I',
      regra_aplicada: `Exportação (CFOP ${cfop4}) — receita de exportação`,
    }
  }

  // Substituição tributária
  if (CFOP_VENDA_ST.has(cfop4)) {
    return {
      tipo_movimento: 'saida',
      impacto_receita: 'soma_receita',
      natureza_receita_simples: 'st',
      origem_devolucao: 'nao_aplicavel',
      anexo_sugerido: ehIndustrial ? 'II' : 'I',
      regra_aplicada: `Venda com substituição tributária (CFOP ${cfop4})`,
    }
  }

  // Serviços
  if (CFOP_SERVICO.has(cfop4)) {
    return {
      tipo_movimento: 'saida',
      impacto_receita: 'soma_receita',
      natureza_receita_simples: 'tributada',
      origem_devolucao: 'nao_aplicavel',
      // Serviços precisam de análise adicional (Fator R, CNAE, item LC 116)
      // para determinar se vai para III, IV ou V — retorna null por ora
      anexo_sugerido: null,
      regra_aplicada: `Prestação de serviço (CFOP ${cfop4}) — definir anexo pelo CNAE/Fator R`,
    }
  }

  // Vendas de mercadorias/produtos
  if (CFOP_VENDA_COMERCIO.has(cfop4) || CFOP_VENDA_INDUSTRIA.has(cfop4)) {
    const anexo: AnexoSimples = ehIndustrial ? 'II' : 'I'
    return {
      tipo_movimento: 'saida',
      impacto_receita: 'soma_receita',
      natureza_receita_simples: 'tributada',
      origem_devolucao: 'nao_aplicavel',
      anexo_sugerido: anexo,
      regra_aplicada: `Venda de ${ehIndustrial ? 'produto industrializado' : 'mercadoria'} (CFOP ${cfop4}) — Anexo ${anexo}`,
    }
  }

  // CFOPs 5xxx/6xxx não mapeados — presumir venda, pendente revisão
  if (cfop4.startsWith('5') || cfop4.startsWith('6')) {
    return {
      tipo_movimento: 'saida',
      impacto_receita: 'pendente_revisao',
      natureza_receita_simples: 'pendente',
      origem_devolucao: 'nao_aplicavel',
      anexo_sugerido: null,
      regra_aplicada: `CFOP ${cfop4} não classificado — revisão necessária`,
    }
  }

  // CFOPs 7xxx (exportação não mapeada)
  if (cfop4.startsWith('7')) {
    return {
      tipo_movimento: 'saida',
      impacto_receita: 'soma_receita',
      natureza_receita_simples: 'exportacao',
      origem_devolucao: 'nao_aplicavel',
      anexo_sugerido: ehIndustrial ? 'II' : 'I',
      regra_aplicada: `Exportação (CFOP ${cfop4})`,
    }
  }

  return {
    tipo_movimento: 'outros',
    impacto_receita: 'pendente_revisao',
    natureza_receita_simples: 'pendente',
    origem_devolucao: 'nao_aplicavel',
    anexo_sugerido: null,
    regra_aplicada: `CFOP ${cfop4} não reconhecido`,
  }
}

// Retorna true se o CFOP representa uma saída de vendas/faturamento
export function cfopEhFaturamento(cfop: string): boolean {
  const c = cfop.replace(/\D/g, '').slice(0, 4)
  return (
    CFOP_VENDA_COMERCIO.has(c) ||
    CFOP_VENDA_INDUSTRIA.has(c) ||
    CFOP_VENDA_ST.has(c) ||
    CFOP_SERVICO.has(c) ||
    CFOP_EXPORTACAO.has(c)
  )
}

// Retorna true se o CFOP indica devolução de venda (reduz receita)
export function cfopEhDevolucaoVenda(cfop: string): boolean {
  return CFOP_DEVOLUCAO_VENDA.has(cfop.replace(/\D/g, '').slice(0, 4))
}
