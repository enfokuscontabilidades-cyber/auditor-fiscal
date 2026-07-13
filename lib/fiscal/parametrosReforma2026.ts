// Parâmetros de referência simplificados da Reforma Tributária (IBS/CBS)
// para o período de teste de 2026. Fonte única — nunca espalhar estes
// valores diretamente em componentes ou outras libs; sempre importar daqui.
//
// A maioria dos usuários da área paga é formada por contadores e
// escritórios de contabilidade. Como 2026 é o período inicial de teste do
// IBS/CBS, a análise não tenta ser uma auditoria tributária completa de
// todas as exceções e regimes específicos — apenas verifica se o sistema
// emissor está gerando os campos básicos de acordo com o padrão geral.

export interface ParametrosReferenciaReforma {
  ano: number
  versao: string
  vigenciaInicio: string // YYYY-MM-DD
  vigenciaFim: string    // YYYY-MM-DD
  /** Alíquota de referência da CBS, em percentual (0.90 = 0,90%). */
  aliquotaCbs: number
  /** Alíquota total de referência do IBS (UF + Município), em percentual (0.10 = 0,10%). */
  aliquotaIbsTotal: number
  cst: string
  cClassTrib: string
  ativo: boolean
}

export const PARAMETROS_REFORMA_2026: ParametrosReferenciaReforma = {
  ano: 2026,
  versao: '2026.1',
  vigenciaInicio: '2026-01-01',
  vigenciaFim: '2026-12-31',
  aliquotaCbs: 0.90,
  aliquotaIbsTotal: 0.10,
  cst: '000',
  cClassTrib: '000001',
  ativo: true,
}

/** Histórico de versões — ao criar a próxima (ex: 2027), adicionar aqui sem remover 2026. */
export const VERSOES_PARAMETROS_REFORMA: ParametrosReferenciaReforma[] = [PARAMETROS_REFORMA_2026]

/** Tolerância monetária centralizada para comparação de valores calculados (evita falso-positivo por arredondamento de centavos). */
export const TOLERANCIA_MONETARIA = 0.02

/** Tolerância de alíquota (percentual) para comparação com a referência. */
export const TOLERANCIA_ALIQUOTA = 0.0001

/**
 * Resolve os parâmetros de referência vigentes para a data de emissão do
 * documento. Retorna `null` quando a data está fora de qualquer período
 * versionado — nesse caso a análise não deve aplicar os parâmetros de
 * 2026 a documentos de outros anos.
 */
export function getParametrosReformaPorData(dataEmissaoIso: string | null | undefined): ParametrosReferenciaReforma | null {
  if (!dataEmissaoIso) return PARAMETROS_REFORMA_2026
  const data = dataEmissaoIso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return PARAMETROS_REFORMA_2026
  return VERSOES_PARAMETROS_REFORMA.find(p => p.ativo && data >= p.vigenciaInicio && data <= p.vigenciaFim) ?? null
}
