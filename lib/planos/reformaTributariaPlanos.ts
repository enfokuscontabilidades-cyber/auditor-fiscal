import type { PlanoReformaTributariaCodigo } from '@/lib/types'

export interface PlanoReformaTributaria {
  codigo: PlanoReformaTributariaCodigo
  nome: string
  precoCentavos: number
  /** null = sem limite comercial */
  limiteCnpj: number | null
  /** null = sem franquia mensal comercial */
  limiteXmlPorCiclo: number | null
  stripePriceEnvVar: string
  destaque?: boolean
}

export const PLANOS_REFORMA_TRIBUTARIA: PlanoReformaTributaria[] = [
  {
    codigo: 'rt_essencial',
    nome: 'Essencial',
    precoCentavos: 1990,
    limiteCnpj: 1,
    limiteXmlPorCiclo: 100,
    stripePriceEnvVar: 'STRIPE_PRICE_ID_RT_ESSENCIAL',
  },
  {
    codigo: 'rt_profissional',
    nome: 'Profissional',
    precoCentavos: 5990,
    limiteCnpj: 5,
    limiteXmlPorCiclo: null,
    stripePriceEnvVar: 'STRIPE_PRICE_ID_RT_PROFISSIONAL',
    destaque: true,
  },
  {
    codigo: 'rt_ilimitado',
    nome: 'Ilimitado',
    precoCentavos: 9990,
    limiteCnpj: null,
    limiteXmlPorCiclo: null,
    stripePriceEnvVar: 'STRIPE_PRICE_ID_RT_ILIMITADO',
  },
]

export function getPlanoReformaTributaria(codigo: string | null | undefined): PlanoReformaTributaria | undefined {
  return PLANOS_REFORMA_TRIBUTARIA.find(p => p.codigo === codigo)
}

/** Mapeamento reverso: dado um Stripe Price ID, encontra o plano correspondente no catálogo. */
export function getPlanoPorStripePriceId(stripePriceId: string | null | undefined): PlanoReformaTributaria | undefined {
  if (!stripePriceId) return undefined
  return PLANOS_REFORMA_TRIBUTARIA.find(p => process.env[p.stripePriceEnvVar] === stripePriceId)
}

export function formatarPrecoCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarLimite(limite: number | null, unidade: string): string {
  return limite === null ? `${unidade} ilimitado${unidade.endsWith('s') ? '' : 's'}` : `${limite} ${unidade}${limite === 1 ? '' : 's'}`
}
