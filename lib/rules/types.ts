import type { NivelRisco, RegraFiscal } from '@/lib/types'

export type { NivelRisco }

export interface AlertaGerado {
  regra_codigo: string
  categoria: string
  nivel_risco: NivelRisco
  titulo: string
  descricao: string
  detalhe: Record<string, unknown>
  valor_impacto?: number
}

export interface ContextoAnalise {
  fiscalData: unknown | null
  contribData: unknown | null
  empresa: {
    cnpj?: string
    regime?: string
    cnae_principal?: string
  }
  competencia: string
  regras: RegraFiscal[]
}

export type ExecutorRegra = (ctx: ContextoAnalise) => AlertaGerado[]
