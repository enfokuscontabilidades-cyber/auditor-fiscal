import type { AlertaGerado, ContextoAnalise } from '../types'

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
