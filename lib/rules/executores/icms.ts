import type { AlertaGerado, ContextoAnalise } from '../types'

// Detecta documentos no SPED Fiscal sem correspondência no SPED Contribuições
export function executarDivergenciaFiscalContrib(ctx: ContextoAnalise): AlertaGerado[] {
  const fiscal = ctx.fiscalData as { c190?: Array<{ chave?: string; valor?: number }> } | null
  const contrib = ctx.contribData as { documentos?: Set<string> | string[] } | null

  if (!fiscal || !contrib) return []

  const docsFiscal = fiscal.c190 ?? []
  const docsContrib = new Set(
    Array.isArray(contrib.documentos) ? contrib.documentos : []
  )

  const divergentes = docsFiscal.filter(
    d => d.chave && !docsContrib.has(d.chave)
  )

  if (divergentes.length === 0) return []

  return [
    {
      regra_codigo: 'ICMS_DIVERGENCIA_FISCAL_CONTRIB',
      categoria: 'icms',
      nivel_risco: 'medio',
      titulo: 'Documentos no Fiscal sem correspondência no Contribuições',
      descricao: `${divergentes.length} documento(s) presentes no SPED Fiscal não foram encontrados no SPED Contribuições.`,
      detalhe: {
        quantidade: divergentes.length,
        exemplos: divergentes.slice(0, 5).map(d => d.chave),
      },
    },
  ]
}

// Detecta itens classificados como Uso e Consumo com crédito de ICMS
export function executarUcComCredito(ctx: ContextoAnalise): AlertaGerado[] {
  const fiscal = ctx.fiscalData as {
    c170?: Array<{ classificacao?: string; vl_icms?: number; chave?: string }>
  } | null

  if (!fiscal?.c170) return []

  const ucComCredito = fiscal.c170.filter(
    item =>
      item.classificacao === 'uso_consumo' &&
      typeof item.vl_icms === 'number' &&
      item.vl_icms > 0
  )

  if (ucComCredito.length === 0) return []

  const totalCredito = ucComCredito.reduce((s, i) => s + (i.vl_icms ?? 0), 0)

  return [
    {
      regra_codigo: 'ICMS_UC_COM_CREDITO',
      categoria: 'icms',
      nivel_risco: 'alto',
      titulo: 'Crédito de ICMS em itens de Uso e Consumo',
      descricao: `${ucComCredito.length} item(ns) classificado(s) como Uso e Consumo com crédito de ICMS apropriado indevidamente. Vedado pelo Art. 33 da LC 87/1996.`,
      detalhe: { quantidade: ucComCredito.length, valor_total: totalCredito },
      valor_impacto: totalCredito,
    },
  ]
}

// Detecta crédito de ICMS em ativo imobilizado sem controle CIAP identificado
export function executarImobSemCiap(ctx: ContextoAnalise): AlertaGerado[] {
  const fiscal = ctx.fiscalData as {
    c170?: Array<{ classificacao?: string; vl_icms?: number }>
    temCiap?: boolean
  } | null

  if (!fiscal?.c170) return []

  const imobComCredito = fiscal.c170.filter(
    item =>
      item.classificacao === 'imobilizado' &&
      typeof item.vl_icms === 'number' &&
      item.vl_icms > 0
  )

  if (imobComCredito.length === 0) return []
  if (fiscal.temCiap) return []

  const totalCredito = imobComCredito.reduce((s, i) => s + (i.vl_icms ?? 0), 0)

  return [
    {
      regra_codigo: 'ICMS_IMOB_SEM_CIAP',
      categoria: 'icms',
      nivel_risco: 'alto',
      titulo: 'ICMS em ativo imobilizado sem controle CIAP',
      descricao: `${imobComCredito.length} item(ns) de ativo imobilizado com crédito de ICMS, mas nenhum registro de CIAP identificado no SPED. Exigido pelo Art. 20 §5º da LC 87/1996.`,
      detalhe: { quantidade: imobComCredito.length, valor_total: totalCredito },
      valor_impacto: totalCredito,
    },
  ]
}
