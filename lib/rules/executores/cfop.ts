import type { AlertaGerado, ContextoAnalise } from '../types'

// CFOPs de saída que não deveriam aparecer como entrada
const CFOP_SAIDA = /^[56]/
// CFOPs de entrada que não deveriam aparecer como saída
const CFOP_ENTRADA = /^[12]/

export function executarCfopSaidaEmEntrada(ctx: ContextoAnalise): AlertaGerado[] {
  const fiscal = ctx.fiscalData as {
    entradas?: Array<{ cfop?: string; chave?: string }>
  } | null

  if (!fiscal?.entradas) return []

  const erros = fiscal.entradas.filter(d => d.cfop && CFOP_SAIDA.test(d.cfop))

  if (erros.length === 0) return []

  return [
    {
      regra_codigo: 'ICMS_CFOP_SAIDA_EM_ENTRADA',
      categoria: 'cfop',
      nivel_risco: 'alto',
      titulo: 'CFOP de saída registrado como entrada',
      descricao: `${erros.length} documento(s) de entrada com CFOP iniciado em 5 ou 6, que é exclusivo de saídas.`,
      detalhe: {
        quantidade: erros.length,
        exemplos: erros.slice(0, 5).map(d => ({ cfop: d.cfop, chave: d.chave })),
      },
    },
  ]
}

export function executarCfopEntradaEmSaida(ctx: ContextoAnalise): AlertaGerado[] {
  const fiscal = ctx.fiscalData as {
    saidas?: Array<{ cfop?: string; chave?: string }>
  } | null

  if (!fiscal?.saidas) return []

  const erros = fiscal.saidas.filter(d => d.cfop && CFOP_ENTRADA.test(d.cfop))

  if (erros.length === 0) return []

  return [
    {
      regra_codigo: 'ICMS_CFOP_ENTRADA_EM_SAIDA',
      categoria: 'cfop',
      nivel_risco: 'alto',
      titulo: 'CFOP de entrada registrado como saída',
      descricao: `${erros.length} documento(s) de saída com CFOP iniciado em 1 ou 2, que é exclusivo de entradas.`,
      detalhe: {
        quantidade: erros.length,
        exemplos: erros.slice(0, 5).map(d => ({ cfop: d.cfop, chave: d.chave })),
      },
    },
  ]
}

// CFOP de industrialização em empresa que não tem CNAE industrial
const CFOP_INDUSTRIALIZACAO = ['5101', '5102', '6101', '6102', '1101', '1102', '2101', '2102']
const CNAE_INDUSTRIAL = /^(1[0-9]|2[0-9]|3[0-3])/

export function executarCfopIncompatCnae(ctx: ContextoAnalise): AlertaGerado[] {
  const { empresa } = ctx
  if (!empresa.cnae_principal) return []
  if (CNAE_INDUSTRIAL.test(empresa.cnae_principal)) return []

  const fiscal = ctx.fiscalData as {
    saidas?: Array<{ cfop?: string }>
    entradas?: Array<{ cfop?: string }>
  } | null

  if (!fiscal) return []

  const todos = [...(fiscal.saidas ?? []), ...(fiscal.entradas ?? [])]
  const erros = todos.filter(d => d.cfop && CFOP_INDUSTRIALIZACAO.includes(d.cfop))

  if (erros.length === 0) return []

  return [
    {
      regra_codigo: 'CFOP_INCOMPAT_CNAE',
      categoria: 'cfop',
      nivel_risco: 'medio',
      titulo: 'CFOP de industrialização em empresa não industrial',
      descricao: `${erros.length} documento(s) com CFOP de industrialização (${[...new Set(erros.map(d => d.cfop))].join(', ')}) para empresa com CNAE ${empresa.cnae_principal}, que não é industrial.`,
      detalhe: {
        quantidade: erros.length,
        cnae: empresa.cnae_principal,
        cfops: [...new Set(erros.map(d => d.cfop))],
      },
    },
  ]
}
