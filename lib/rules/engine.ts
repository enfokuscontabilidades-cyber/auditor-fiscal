import type { AlertaGerado, ContextoAnalise, ExecutorRegra } from './types'
import {
  executarDivergenciaFiscalContrib,
  executarUcComCredito,
  executarImobSemCiap,
} from './executores/icms'
import {
  executarCfopSaidaEmEntrada,
  executarCfopEntradaEmSaida,
  executarCfopIncompatCnae,
} from './executores/cfop'
import {
  executarBeneficioNaoAplicado,
  executarSpedZeradoComReceita,
  executarNcmStSemTratamento,
} from './executores/ncm'
import { executarExclusaoIndevida } from './executores/pis_cofins'

const EXECUTORES: Record<string, ExecutorRegra> = {
  ICMS_DIVERGENCIA_FISCAL_CONTRIB: executarDivergenciaFiscalContrib,
  ICMS_UC_COM_CREDITO:             executarUcComCredito,
  ICMS_IMOB_SEM_CIAP:              executarImobSemCiap,
  ICMS_CFOP_SAIDA_EM_ENTRADA:      executarCfopSaidaEmEntrada,
  ICMS_CFOP_ENTRADA_EM_SAIDA:      executarCfopEntradaEmSaida,
  CFOP_INCOMPAT_CNAE:              executarCfopIncompatCnae,
  NCM_BENEFICIO_NAO_APLICADO:      executarBeneficioNaoAplicado,
  NCM_ST_SEM_TRATAMENTO:           executarNcmStSemTratamento,
  OBRIG_SPED_ZERADO_COM_RECEITA:   executarSpedZeradoComReceita,
  CONTRIB_EXCLUSAO_INDEVIDA:       executarExclusaoIndevida,
}

const ORDEM_RISCO = { critico: 0, alto: 1, medio: 2, baixo: 3 }

export function executarMotorRegras(ctx: ContextoAnalise): AlertaGerado[] {
  const alertas: AlertaGerado[] = []

  for (const regra of ctx.regras) {
    if (!regra.ativo) continue
    const executor = EXECUTORES[regra.codigo]
    if (!executor) continue
    try {
      alertas.push(...executor(ctx))
    } catch (err) {
      console.error(`Regra ${regra.codigo} falhou:`, err)
    }
  }

  return alertas.sort(
    (a, b) => ORDEM_RISCO[a.nivel_risco] - ORDEM_RISCO[b.nivel_risco]
  )
}
