// Regras de conferência de IBS/CBS (Reforma Tributária) nos itens de NF-e.
// Único ponto de verdade: usado tanto pela página interna autenticada
// (app/(fiscal)/reforma_tributaria) quanto pela página pública de diagnóstico
// (app/diagnostico-reforma-tributaria), para que os dois nunca divirjam.

export const ALIQUOTA_IBS_UF_2026 = 0.1
export const ALIQUOTA_CBS_2026 = 0.9

export const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const numberFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })

export type SituacaoReforma = 'ok' | 'alerta' | 'critico'

export interface CamposReforma {
  cst: string
  cclass: string
  base: number
  valorItem: number
  aliquotaIbsUf: number
  valorIbsUf: number
  aliquotaIbsMun: number
  valorIbsMun: number
  valorIbs: number
  aliquotaCbs: number
  valorCbs: number
}

export interface AnaliseReforma {
  alertas: string[]
  situacao: SituacaoReforma
}

export function n(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export function arred2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

export function temReforma(item: Pick<CamposReforma, 'cst' | 'cclass' | 'base' | 'valorIbs' | 'valorCbs' | 'valorIbsUf' | 'valorIbsMun'>): boolean {
  return Boolean(
    (item.cst && item.cst !== '-') ||
    (item.cclass && item.cclass !== '-') ||
    item.base > 0 ||
    item.valorIbs > 0 ||
    item.valorCbs > 0 ||
    item.valorIbsUf > 0 ||
    item.valorIbsMun > 0,
  )
}

export function analisarLinha(base: CamposReforma & { destacado: boolean }): AnaliseReforma {
  const alertas: string[] = []

  if (!base.destacado) {
    alertas.push('Sem destaque de IBS/CBS')
  } else {
    if (!base.cst || base.cst === '-') alertas.push('CST IBS/CBS ausente')
    if (!base.cclass || base.cclass === '-') alertas.push('cClassTrib ausente')
    if (base.aliquotaIbsUf > 0 && Math.abs(base.aliquotaIbsUf - ALIQUOTA_IBS_UF_2026) > 0.0001) {
      alertas.push(`Alíquota IBS UF diferente de ${numberFmt.format(ALIQUOTA_IBS_UF_2026)}%`)
    }
    if (base.aliquotaCbs > 0 && Math.abs(base.aliquotaCbs - ALIQUOTA_CBS_2026) > 0.0001) {
      alertas.push(`Alíquota CBS diferente de ${numberFmt.format(ALIQUOTA_CBS_2026)}%`)
    }
    const baseCalculo = base.base || base.valorItem
    if (baseCalculo > 0 && base.valorIbsUf > 0) {
      const esperado = arred2(baseCalculo * (ALIQUOTA_IBS_UF_2026 / 100))
      if (Math.abs(base.valorIbsUf - esperado) > 0.02) alertas.push(`IBS UF esperado: ${money.format(esperado)}`)
    }
    if (baseCalculo > 0 && base.valorCbs > 0) {
      const esperado = arred2(baseCalculo * (ALIQUOTA_CBS_2026 / 100))
      if (Math.abs(base.valorCbs - esperado) > 0.02) alertas.push(`CBS esperado: ${money.format(esperado)}`)
    }
  }

  return { alertas, situacao: alertas.length ? (base.destacado ? 'alerta' : 'critico') : 'ok' }
}

export function montarLinha<T extends CamposReforma & { destacado?: boolean }>(
  base: T,
): T & AnaliseReforma & { destacado: boolean } {
  const destacado = base.destacado ?? temReforma(base)
  const linhaBase = { ...base, destacado }
  return { ...linhaBase, ...analisarLinha(linhaBase) }
}
