import type { AlertaGerado, ContextoAnalise } from '../types'
import type { SpedC170Item } from '@/lib/sped/types'

// Produtos com benefício fiscal de Goiás sem cBenef informado
export function executarBeneficioNaoAplicado(ctx: ContextoAnalise): AlertaGerado[] {
  const fiscal = ctx.fiscalData as {
    c170?: Array<{
      ncm?: string
      cst_icms?: string
      c_benef?: string
      chave?: string
    }>
  } | null

  if (!fiscal?.c170) return []

  // CST que indicam isenção ou redução de base, mas sem cBenef preenchido
  const cstComBeneficio = ['20', '30', '40', '41', '50', '51', '70', '90']

  const erros = fiscal.c170.filter(
    item =>
      item.cst_icms &&
      cstComBeneficio.includes(item.cst_icms) &&
      (!item.c_benef || item.c_benef.trim() === '')
  )

  if (erros.length === 0) return []

  return [
    {
      regra_codigo: 'NCM_BENEFICIO_NAO_APLICADO',
      categoria: 'ncm',
      nivel_risco: 'medio',
      titulo: 'Benefício fiscal sem cBenef informado',
      descricao: `${erros.length} item(ns) com CST indicando benefício fiscal (isenção/redução) mas sem código cBenef preenchido. Obrigatório pela IN 1518/2022-GSE para empresas de Goiás.`,
      detalhe: {
        quantidade: erros.length,
        csts_encontrados: [...new Set(erros.map(d => d.cst_icms))],
      },
    },
  ]
}

// NCMs do Anexo VIII RICMS/GO sujeitos à ST — CST esperado 10, 30, 60 ou 70
const NCM_ST_GOIAS: string[] = [
  "2402","2403","2710",
  "3303","3304","3305","3306","3307",
  "3401","3402","3808",
  "6910","6911","6912","7010","7013",
  "8214","8215",
  "8414","8415","8418","8421","8422","8450","8467",
  "8508","8509","8516","8539","8544",
  "9006","9018",
  "9603","9608",
]

function ncmStartsWith(ncm: string, prefixes: string[]): string | null {
  const digits = String(ncm || "").replace(/\D/g, "")
  return digits ? (prefixes.find(p => digits.startsWith(p)) ?? null) : null
}

export function executarNcmStSemTratamento(ctx: ContextoAnalise): AlertaGerado[] {
  const fiscal = ctx.fiscalData as { c170Items?: SpedC170Item[] } | null
  if (!fiscal?.c170Items?.length) return []

  const cstsSt = ["10","30","60","70"]
  type Ocorrencia = { nota: string; ncm: string; cst: string; prefixo: string }
  const ocorrencias: Ocorrencia[] = []

  for (const item of fiscal.c170Items) {
    const prefixo = ncmStartsWith(item.ncm, NCM_ST_GOIAS)
    if (!prefixo) continue
    const cst = item.cstIcms.replace(/\D/g, "")
    if (!cstsSt.includes(cst)) {
      ocorrencias.push({ nota: item.numDoc, ncm: item.ncm, cst: item.cstIcms, prefixo })
    }
  }

  if (ocorrencias.length === 0) return []

  // Deduplica para exibição (máximo 10 exemplos)
  const exemplos = ocorrencias.slice(0, 10).map(
    o => `NF ${o.nota} — NCM ${o.ncm} (prefixo ST: ${o.prefixo}) — CST atual: ${o.cst || "(vazio)"}`
  )

  return [
    {
      regra_codigo: "NCM_ST_SEM_TRATAMENTO",
      categoria: "ncm",
      nivel_risco: "medio",
      titulo: "NCM sujeito à ST sem CST adequado (RICMS/GO Anexo VIII)",
      descricao: `${ocorrencias.length} item(ns) com NCM sujeito à substituição tributária no RICMS/GO mas com CST fora do padrão esperado (10, 30, 60 ou 70). Pode indicar classificação incorreta ou não retenção da ST.`,
      detalhe: {
        quantidade: ocorrencias.length,
        exemplos,
      },
    },
  ]
}

// SPED com movimento zerado mas empresa tem receita declarada em outro período
export function executarSpedZeradoComReceita(ctx: ContextoAnalise): AlertaGerado[] {
  const fiscal = ctx.fiscalData as {
    totalSaidas?: number
    totalEntradas?: number
    receita?: number
  } | null

  if (!fiscal) return []

  const semMovimento =
    (fiscal.totalSaidas ?? 0) === 0 && (fiscal.totalEntradas ?? 0) === 0

  const temReceita = typeof fiscal.receita === 'number' && fiscal.receita > 0

  if (!semMovimento || !temReceita) return []

  return [
    {
      regra_codigo: 'OBRIG_SPED_ZERADO_COM_RECEITA',
      categoria: 'obrigacao_acessoria',
      nivel_risco: 'alto',
      titulo: 'SPED zerado com empresa ativa',
      descricao: 'O SPED Fiscal não apresenta movimentação, mas a empresa possui receita registrada. Pode indicar omissão de receitas ou erro no arquivo.',
      detalhe: {
        total_saidas: fiscal.totalSaidas,
        total_entradas: fiscal.totalEntradas,
        receita_registrada: fiscal.receita,
      },
    },
  ]
}
