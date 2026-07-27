export type VinculoCfopEntrada = {
  cfopSaida: string
  cfopEntrada: string
}

export type ItemComCfopEntrada = {
  cfop: string
  cfop_entrada_sugerido?: string
  tipo_nfe?: string | null
  fonte?: string
}

export type ItemIdentificacaoNotaEntrada = {
  chave_nfe?: string
  numero_nota: string
  fornecedor: string
  data: string
}

export function normalizarCfop(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').slice(0, 4)
}

export function cfopEhEntrada(value: string | null | undefined): boolean {
  return /^[123]\d{3}$/.test(normalizarCfop(value))
}

export function itemEhEntradaDeTerceiro(item: ItemComCfopEntrada): boolean {
  if (item.tipo_nfe === 'terceiro') return true
  return item.fonte === 'xml' && /^[567]\d{3}$/.test(normalizarCfop(item.cfop))
}

/**
 * Resolve o CFOP que representa a entrada na escrituração. O vínculo da
 * empresa é autoritativo; o CFOP original da NF-e nunca vira o principal.
 */
export function resolverCfopEntradaEfetivo(
  item: ItemComCfopEntrada,
  vinculos: VinculoCfopEntrada[],
  sugestaoPadrao: string,
): string {
  const original = normalizarCfop(item.cfop)
  if (!itemEhEntradaDeTerceiro(item)) return original

  const vinculado = vinculos.find(v => normalizarCfop(v.cfopSaida) === original)?.cfopEntrada
  const candidatos = [vinculado, item.cfop_entrada_sugerido, sugestaoPadrao]
  return normalizarCfop(candidatos.find(cfopEhEntrada))
}

/** Identidade estável para agrupamento e expansão, inclusive quando não há chave NF-e. */
export function identificadorNotaEntrada(item: ItemIdentificacaoNotaEntrada): string {
  const chave = item.chave_nfe?.trim()
  if (chave) return `chave:${chave}`
  return `nota:${item.numero_nota}__${item.fornecedor}__${item.data}`
}
