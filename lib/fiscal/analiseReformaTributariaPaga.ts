// Motor de análise de IBS/CBS da ÁREA PAGA (assinantes de Reforma Tributária).
//
// Este é um motor separado de `analiseReformaTributaria.ts` (que continua
// intocado e é o motor da ferramenta pública de diagnóstico/captação de
// leads — não deve ser alterado). A área paga precisa de uma análise mais
// profunda (CST e cClassTrib comparados exatamente contra a referência,
// IBS total = UF + Município, orientações práticas por divergência), mas
// isso não pode mudar o comportamento da ferramenta pública.
//
// Único ponto de verdade da área paga: usado pela tela `/reforma_tributaria`,
// pelo resumo do dashboard (`/api/rt/uso`) e pelo relatório em PDF — os três
// sempre devem classificar o mesmo item da mesma forma.

import { n, arred2, money, numberFmt, type SituacaoReforma } from './analiseReformaTributaria'
import {
  getParametrosReformaPorData,
  TOLERANCIA_MONETARIA,
  TOLERANCIA_ALIQUOTA,
  type ParametrosReferenciaReforma,
} from './parametrosReforma2026'

export type { SituacaoReforma }
export { n, money, numberFmt }

export type CodigoDivergenciaReforma =
  | 'GRUPO_IBSCBS_AUSENTE'
  | 'CST_AUSENTE' | 'CST_DIFERENTE'
  | 'CCLASSTRIB_AUSENTE' | 'CCLASSTRIB_DIFERENTE'
  | 'CBS_AUSENTE' | 'CBS_DIFERENTE' | 'CBS_VALOR_DIVERGENTE'
  | 'IBS_AUSENTE' | 'IBS_DIFERENTE' | 'IBS_VALOR_DIVERGENTE'

export interface DivergenciaReformaPaga {
  codigo: CodigoDivergenciaReforma
  gravidade: 'critico' | 'alerta'
  campo: string
  resumo: string
  explicacao: string
  /** Impacto prático resumido — para quem lê o relatório sem contexto técnico. */
  impacto: string
  /** A quem cabe agir: o contador define tratamento tributário, o fornecedor parametriza o leiaute — a ferramenta só verifica. */
  responsavel: string
  valorEncontrado?: string
  valorReferencia?: string
  orientacao: string[]
}

const RESPONSAVEL_CAMPO_AUSENTE = 'Fornecedor do sistema emissor (parametrização/atualização) e contador (confirmação do enquadramento)'
const RESPONSAVEL_TRATAMENTO_ESPECIFICO = 'Contador ou responsável tributário (confirmação do tratamento aplicável à operação)'

export interface CamposReformaPaga {
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
  /** Data de emissão do documento (YYYY-MM-DD) — usada para resolver os parâmetros de referência vigentes. */
  dataEmissao?: string | null
}

export interface AnaliseReformaPaga {
  situacao: SituacaoReforma
  divergencias: DivergenciaReformaPaga[]
  /** Resumos curtos — mantém compatibilidade visual com badges e exportação Excel. */
  alertas: string[]
  destacado: boolean
  parametros: ParametrosReferenciaReforma | null
}

function temGrupoIbsCbs(c: CamposReformaPaga): boolean {
  return Boolean(
    (c.cst && c.cst !== '-') ||
    (c.cclass && c.cclass !== '-') ||
    c.base > 0 ||
    c.valorIbs > 0 ||
    c.valorCbs > 0 ||
    c.aliquotaIbsUf > 0 ||
    c.aliquotaIbsMun > 0 ||
    c.aliquotaCbs > 0,
  )
}

function orientacaoGrupoAusente(p: ParametrosReferenciaReforma, modoEstrutural: boolean): string[] {
  const passos = [
    'Contatar o suporte do sistema emissor',
    'Informar que os XMLs estão sendo gerados sem o grupo IBSCBS',
    'Solicitar a atualização do sistema para o leiaute vigente',
    'Solicitar a habilitação dos campos de IBS e CBS',
  ]
  if (!modoEstrutural) {
    passos.push(
      `Parametrizar CST ${p.cst} e cClassTrib ${p.cClassTrib} para as operações sujeitas ao padrão utilizado na análise`,
      `Configurar a alíquota da CBS em ${numberFmt.format(p.aliquotaCbs)}%`,
      `Configurar a alíquota total do IBS em ${numberFmt.format(p.aliquotaIbsTotal)}%`,
    )
  }
  passos.push('Revisar os cadastros fiscais dos produtos e das operações', 'Emitir novos documentos em ambiente de homologação ou teste')
  return passos
}

const ORIENTACAO_CODIGO_AUSENTE = [
  'Confirmar a classificação/enquadramento com o contador responsável',
  'Parametrizar o código no cadastro fiscal para as operações no padrão geral',
  'Confirmar com o fornecedor do sistema como o código será enviado no XML',
  'Emitir nova nota de teste',
  'Reanalisar',
]

const ORIENTACAO_CODIGO_DIFERENTE = [
  'Confirmar com o contador se há tratamento tributário específico para esta operação',
  'Caso não haja, ajustar a parametrização para o padrão geral',
  'Reanalisar',
]

const ORIENTACAO_ALIQUOTA_VALOR = [
  'Confirmar o tratamento tributário da operação com o contador',
  'Revisar a base de cálculo',
  'Revisar a alíquota aplicada',
  'Revisar o arredondamento',
  'Revisar os totalizadores',
  'Emitir novo XML',
  'Reanalisar',
]

export interface OpcoesAnaliseReformaPaga {
  /**
   * Sobrescreve os parâmetros de referência resolvidos por data de emissão
   * (ex: padrão geral de 2026 confirmado explicitamente, ou parâmetros
   * específicos informados pelo contador para o cliente). Se omitido,
   * comporta-se exatamente como antes: resolve por `campos.dataEmissao`.
   */
  parametros?: ParametrosReferenciaReforma | null
  /**
   * Quando true, analisa somente presença/estrutura dos campos — nunca
   * compara com as alíquotas, o CST ou o cClassTrib de referência. Usado
   * quando o contador não quer afirmar qual tratamento tributário é
   * aplicável ao cliente (Opção 3 do modal de geração de relatório).
   */
  modoEstrutural?: boolean
}

/**
 * Classifica um item quanto a IBS/CBS em três níveis:
 * ADEQUADO (ok) — tudo presente e dentro da referência aplicada;
 * ATENÇÃO (alerta) — campos presentes mas diferentes da referência (pode ser tratamento específico legítimo);
 * CRÍTICO (critico) — grupo ou campo obrigatório ausente (indício de sistema emissor desatualizado).
 *
 * Documentos fora da vigência dos parâmetros de 2026 (`getParametrosReformaPorData` retorna null)
 * não são avaliados contra essa referência — nunca aplicar o padrão de 2026 a outros anos.
 *
 * `opcoes` permite reaproveitar este MESMO motor para a versão do
 * relatório do contador (parâmetros específicos do cliente ou modo
 * estrutural sem validação de alíquotas/códigos) sem duplicar nenhuma regra.
 */
export function analisarItemReformaPaga(campos: CamposReformaPaga, opcoes?: OpcoesAnaliseReformaPaga): AnaliseReformaPaga {
  const parametros = opcoes && 'parametros' in opcoes ? (opcoes.parametros ?? null) : getParametrosReformaPorData(campos.dataEmissao)
  const modoEstrutural = opcoes?.modoEstrutural ?? false
  const destacado = temGrupoIbsCbs(campos)

  if (!parametros) {
    return { situacao: 'ok', divergencias: [], alertas: [], destacado, parametros: null }
  }

  const divergencias: DivergenciaReformaPaga[] = []

  if (!destacado) {
    divergencias.push({
      codigo: 'GRUPO_IBSCBS_AUSENTE',
      gravidade: 'critico',
      campo: 'Grupo IBSCBS',
      resumo: 'Grupo IBSCBS ausente',
      explicacao: 'O XML não possui o grupo de tributação do IBS e da CBS nos itens analisados. Isso indica que o sistema emissor pode não estar atualizado ou configurado para gerar as novas informações da Reforma Tributária.',
      impacto: 'Sem o grupo IBSCBS, não é possível confirmar se a operação está sendo tributada corretamente pela Reforma — risco de inconsistência fiscal a partir da vigência plena.',
      responsavel: RESPONSAVEL_CAMPO_AUSENTE,
      orientacao: orientacaoGrupoAusente(parametros, modoEstrutural),
    })
  } else {
    if (!campos.cst || campos.cst === '-') {
      divergencias.push({
        codigo: 'CST_AUSENTE', gravidade: 'critico', campo: 'CST',
        resumo: 'CST do IBS/CBS ausente',
        explicacao: 'O código de situação tributária (CST) do IBS/CBS não foi informado. Esse código identifica a situação tributária da operação.',
        impacto: 'Sem o CST, não é possível confirmar o enquadramento tributário do item perante o IBS/CBS.',
        responsavel: RESPONSAVEL_CAMPO_AUSENTE,
        orientacao: ORIENTACAO_CODIGO_AUSENTE,
      })
    } else if (!modoEstrutural && campos.cst !== parametros.cst) {
      divergencias.push({
        codigo: 'CST_DIFERENTE', gravidade: 'alerta', campo: 'CST',
        resumo: `CST diferente de ${parametros.cst}`,
        explicacao: 'O CST informado é diferente da referência padrão utilizada nesta análise para o período de teste de 2026. A diferença pode decorrer de tratamento tributário específico e deve ser confirmada pelo responsável fiscal.',
        impacto: 'Pode ser um tratamento tributário específico legítimo (redução, isenção, diferimento) ou uma parametrização equivocada — requer confirmação.',
        responsavel: RESPONSAVEL_TRATAMENTO_ESPECIFICO,
        valorEncontrado: campos.cst, valorReferencia: parametros.cst,
        orientacao: ORIENTACAO_CODIGO_DIFERENTE,
      })
    }

    if (!campos.cclass || campos.cclass === '-') {
      divergencias.push({
        codigo: 'CCLASSTRIB_AUSENTE', gravidade: 'critico', campo: 'cClassTrib',
        resumo: 'cClassTrib ausente',
        explicacao: 'O código de classificação tributária (cClassTrib) não foi informado. Esse código identifica a classificação tributária da operação.',
        impacto: 'Sem o cClassTrib, não é possível confirmar a classificação tributária específica do item perante o IBS/CBS.',
        responsavel: RESPONSAVEL_CAMPO_AUSENTE,
        orientacao: ORIENTACAO_CODIGO_AUSENTE,
      })
    } else if (!modoEstrutural && campos.cclass !== parametros.cClassTrib) {
      divergencias.push({
        codigo: 'CCLASSTRIB_DIFERENTE', gravidade: 'alerta', campo: 'cClassTrib',
        resumo: `cClassTrib diferente de ${parametros.cClassTrib}`,
        explicacao: 'O cClassTrib encontrado é diferente da referência padrão utilizada para o período de teste de 2026. O código pode estar relacionado a uma operação com tratamento específico e deve ser confirmado pelo contador ou responsável tributário.',
        impacto: 'Pode ser um tratamento tributário específico legítimo ou uma parametrização equivocada — requer confirmação.',
        responsavel: RESPONSAVEL_TRATAMENTO_ESPECIFICO,
        valorEncontrado: campos.cclass, valorReferencia: parametros.cClassTrib,
        orientacao: ORIENTACAO_CODIGO_DIFERENTE,
      })
    }

    const cbsAusente = campos.aliquotaCbs === 0 && campos.valorCbs === 0
    if (cbsAusente) {
      divergencias.push({
        codigo: 'CBS_AUSENTE', gravidade: 'critico', campo: 'CBS',
        resumo: 'Alíquota/valor de CBS ausente',
        explicacao: 'A alíquota e o valor da CBS não foram informados no item.',
        impacto: 'Sem alíquota e valor de CBS, a apuração da contribuição fica incompleta para este item.',
        responsavel: RESPONSAVEL_CAMPO_AUSENTE,
        orientacao: ['Revisar cadastro e regra fiscal do produto', `Configurar CBS de ${numberFmt.format(parametros.aliquotaCbs)}%`, 'Emitir nova nota', 'Reanalisar'],
      })
    } else if (!modoEstrutural && campos.aliquotaCbs > 0 && Math.abs(campos.aliquotaCbs - parametros.aliquotaCbs) > TOLERANCIA_ALIQUOTA) {
      divergencias.push({
        codigo: 'CBS_DIFERENTE', gravidade: 'alerta', campo: 'CBS',
        resumo: `Alíquota CBS diferente de ${numberFmt.format(parametros.aliquotaCbs)}%`,
        explicacao: `A alíquota da CBS informada é diferente da referência padrão de ${numberFmt.format(parametros.aliquotaCbs)}% utilizada nesta análise para 2026. Confirme se existe tratamento específico para a operação.`,
        impacto: 'Pode ser uma redução/benefício legítimo ou um erro de parametrização — requer confirmação.',
        responsavel: RESPONSAVEL_TRATAMENTO_ESPECIFICO,
        valorEncontrado: `${numberFmt.format(campos.aliquotaCbs)}%`, valorReferencia: `${numberFmt.format(parametros.aliquotaCbs)}%`,
        orientacao: ORIENTACAO_ALIQUOTA_VALOR,
      })
    }

    const aliquotaIbsTotalEncontrada = campos.aliquotaIbsUf + campos.aliquotaIbsMun
    const ibsAusente = aliquotaIbsTotalEncontrada === 0 && campos.valorIbs === 0
    if (ibsAusente) {
      divergencias.push({
        codigo: 'IBS_AUSENTE', gravidade: 'critico', campo: 'IBS',
        resumo: 'Alíquota/valor de IBS ausente',
        explicacao: 'A alíquota e o valor do IBS (estadual/municipal) não foram informados no item.',
        impacto: 'Sem alíquota e valor de IBS, a apuração do imposto fica incompleta para este item.',
        responsavel: RESPONSAVEL_CAMPO_AUSENTE,
        orientacao: ['Verificar a distribuição do IBS nos campos exigidos (UF/Município)', `Configurar IBS total de ${numberFmt.format(parametros.aliquotaIbsTotal)}%`, 'Emitir nova nota', 'Reanalisar'],
      })
    } else if (!modoEstrutural && aliquotaIbsTotalEncontrada > 0 && Math.abs(aliquotaIbsTotalEncontrada - parametros.aliquotaIbsTotal) > TOLERANCIA_ALIQUOTA) {
      divergencias.push({
        codigo: 'IBS_DIFERENTE', gravidade: 'alerta', campo: 'IBS',
        resumo: `Alíquota total do IBS diferente de ${numberFmt.format(parametros.aliquotaIbsTotal)}%`,
        explicacao: `A alíquota total do IBS encontrada (${numberFmt.format(aliquotaIbsTotalEncontrada)}%, soma de UF e Município) é diferente da referência de ${numberFmt.format(parametros.aliquotaIbsTotal)}% utilizada nesta análise para 2026. Confirme se a operação possui tratamento tributário específico.`,
        impacto: 'Pode ser uma redução/benefício legítimo ou um erro de parametrização — requer confirmação.',
        responsavel: RESPONSAVEL_TRATAMENTO_ESPECIFICO,
        valorEncontrado: `${numberFmt.format(aliquotaIbsTotalEncontrada)}%`, valorReferencia: `${numberFmt.format(parametros.aliquotaIbsTotal)}%`,
        orientacao: ORIENTACAO_ALIQUOTA_VALOR,
      })
    }

    const baseCalculo = campos.base || campos.valorItem
    if (!modoEstrutural && baseCalculo > 0 && !cbsAusente && campos.valorCbs > 0) {
      const esperado = arred2(baseCalculo * (parametros.aliquotaCbs / 100))
      if (Math.abs(campos.valorCbs - esperado) > TOLERANCIA_MONETARIA) {
        divergencias.push({
          codigo: 'CBS_VALOR_DIVERGENTE', gravidade: 'alerta', campo: 'Valor CBS',
          resumo: 'Valor de CBS diferente do esperado',
          explicacao: `O valor de CBS encontrado (${money.format(campos.valorCbs)}) diverge do valor esperado pela alíquota de referência (${money.format(esperado)}) além da tolerância de arredondamento.`,
          impacto: 'Pode indicar erro de arredondamento, base de cálculo incorreta ou tratamento específico não identificado.',
          responsavel: RESPONSAVEL_TRATAMENTO_ESPECIFICO,
          valorEncontrado: money.format(campos.valorCbs), valorReferencia: money.format(esperado),
          orientacao: ORIENTACAO_ALIQUOTA_VALOR,
        })
      }
    }

    if (!modoEstrutural && baseCalculo > 0 && !ibsAusente && campos.valorIbs > 0) {
      const esperado = arred2(baseCalculo * (parametros.aliquotaIbsTotal / 100))
      if (Math.abs(campos.valorIbs - esperado) > TOLERANCIA_MONETARIA) {
        divergencias.push({
          codigo: 'IBS_VALOR_DIVERGENTE', gravidade: 'alerta', campo: 'Valor IBS',
          resumo: 'Valor de IBS diferente do esperado',
          explicacao: `O valor de IBS encontrado (${money.format(campos.valorIbs)}) diverge do valor esperado pela alíquota de referência (${money.format(esperado)}) além da tolerância de arredondamento.`,
          impacto: 'Pode indicar erro de arredondamento, base de cálculo incorreta ou tratamento específico não identificado.',
          responsavel: RESPONSAVEL_TRATAMENTO_ESPECIFICO,
          valorEncontrado: money.format(campos.valorIbs), valorReferencia: money.format(esperado),
          orientacao: ORIENTACAO_ALIQUOTA_VALOR,
        })
      }
    }
  }

  const situacao: SituacaoReforma = divergencias.some(d => d.gravidade === 'critico')
    ? 'critico'
    : divergencias.length > 0 ? 'alerta' : 'ok'

  return {
    situacao,
    divergencias,
    alertas: divergencias.map(d => d.resumo),
    destacado,
    parametros,
  }
}

export function montarLinhaPaga<T extends CamposReformaPaga>(base: T, opcoes?: OpcoesAnaliseReformaPaga): T & AnaliseReformaPaga {
  return { ...base, ...analisarItemReformaPaga(base, opcoes) }
}
