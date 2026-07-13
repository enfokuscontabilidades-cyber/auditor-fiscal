// Ponte entre os parâmetros tributários específicos de um cliente
// (rt_parametros_cliente, cadastrados pelo contador) e o formato que o
// motor de análise já entende (ParametrosReferenciaReforma). Não duplica
// nenhuma regra de IBS/CBS — só converte e valida o formulário.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { RtParametrosCliente } from '@/lib/types'
import type { ParametrosReferenciaReforma } from './parametrosReforma2026'

export interface ParametrosEspecificosInput {
  aliquotaCbs: number
  aliquotaIbsTotal?: number
  aliquotaIbsUf?: number
  aliquotaIbsMun?: number
  cst: string
  cclassTrib: string
  observacao?: string
  vigenciaInicio: string
  vigenciaFim?: string
}

export interface ErroValidacaoParametros {
  campo: string
  mensagem: string
}

const REGEX_CST = /^\d{3}$/
const REGEX_CCLASS = /^\d{6}$/
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/

/** IBS total = UF + Município quando informados separadamente; caso contrário, o valor total direto. */
export function ibsTotalEfetivo(input: Pick<ParametrosEspecificosInput, 'aliquotaIbsTotal' | 'aliquotaIbsUf' | 'aliquotaIbsMun'>): number {
  if (input.aliquotaIbsUf != null || input.aliquotaIbsMun != null) {
    return (input.aliquotaIbsUf ?? 0) + (input.aliquotaIbsMun ?? 0)
  }
  return input.aliquotaIbsTotal ?? 0
}

export function validarParametrosEspecificos(input: ParametrosEspecificosInput): ErroValidacaoParametros[] {
  const erros: ErroValidacaoParametros[] = []

  if (!Number.isFinite(input.aliquotaCbs) || input.aliquotaCbs < 0 || input.aliquotaCbs > 100) {
    erros.push({ campo: 'aliquotaCbs', mensagem: 'Informe a alíquota da CBS em percentual (ex: 0,90 para 0,90%).' })
  }

  const ibsTotal = ibsTotalEfetivo(input)
  if (!Number.isFinite(ibsTotal) || ibsTotal <= 0 || ibsTotal > 100) {
    erros.push({ campo: 'aliquotaIbsTotal', mensagem: 'Informe a alíquota total do IBS ou os componentes estadual/municipal.' })
  }

  if (!REGEX_CST.test(input.cst ?? '')) {
    erros.push({ campo: 'cst', mensagem: 'O CST deve ter 3 dígitos (ex: 000).' })
  }
  if (!REGEX_CCLASS.test(input.cclassTrib ?? '')) {
    erros.push({ campo: 'cclassTrib', mensagem: 'O cClassTrib deve ter 6 dígitos (ex: 000001).' })
  }
  if (!REGEX_DATA.test(input.vigenciaInicio ?? '')) {
    erros.push({ campo: 'vigenciaInicio', mensagem: 'Informe a data inicial de vigência (AAAA-MM-DD).' })
  }
  if (input.vigenciaFim) {
    if (!REGEX_DATA.test(input.vigenciaFim)) {
      erros.push({ campo: 'vigenciaFim', mensagem: 'Data final de vigência inválida (AAAA-MM-DD).' })
    } else if (REGEX_DATA.test(input.vigenciaInicio) && input.vigenciaFim < input.vigenciaInicio) {
      erros.push({ campo: 'vigenciaFim', mensagem: 'A data final de vigência não pode ser anterior à inicial.' })
    }
  }

  return erros
}

/** Converte a versão vigente de parâmetros do cliente para o formato do motor de análise. */
export function parametrosClienteParaReferencia(p: RtParametrosCliente): ParametrosReferenciaReforma {
  const ibsTotal = p.aliquota_ibs_uf != null || p.aliquota_ibs_mun != null
    ? (p.aliquota_ibs_uf ?? 0) + (p.aliquota_ibs_mun ?? 0)
    : p.aliquota_ibs_total

  return {
    ano: Number(p.vigencia_inicio.slice(0, 4)) || new Date().getFullYear(),
    versao: `cliente-v${p.versao}`,
    vigenciaInicio: p.vigencia_inicio,
    vigenciaFim: p.vigencia_fim ?? '9999-12-31',
    aliquotaCbs: p.aliquota_cbs,
    aliquotaIbsTotal: ibsTotal,
    cst: p.cst,
    cClassTrib: p.cclass_trib,
    ativo: true,
  }
}

/** Converte parâmetros específicos recém-digitados (ainda não salvos) para o formato do motor de análise. */
export function parametrosEspecificosParaReferencia(input: ParametrosEspecificosInput, versao: string): ParametrosReferenciaReforma {
  return {
    ano: Number(input.vigenciaInicio.slice(0, 4)) || new Date().getFullYear(),
    versao,
    vigenciaInicio: input.vigenciaInicio,
    vigenciaFim: input.vigenciaFim ?? '9999-12-31',
    aliquotaCbs: input.aliquotaCbs,
    aliquotaIbsTotal: ibsTotalEfetivo(input),
    cst: input.cst,
    cClassTrib: input.cclassTrib,
    ativo: true,
  }
}

/**
 * Cria uma NOVA versão dos parâmetros específicos de um cliente — nunca
 * sobrescreve a anterior, só marca como não vigente. Reaproveitada tanto
 * pela API de parâmetros por cliente quanto pela geração de relatório
 * (opção "salvar como referência deste cliente").
 */
export async function salvarNovaVersaoParametrosCliente(
  admin: SupabaseClient,
  params: { orgId: string; empresaId: string; input: ParametrosEspecificosInput; userId: string; userEmail: string | null },
): Promise<{ versao: number } | { erro: string }> {
  const erros = validarParametrosEspecificos(params.input)
  if (erros.length > 0) return { erro: erros.map(e => e.mensagem).join(' ') }

  const { data: ultimaVersao } = await admin
    .from('rt_parametros_cliente')
    .select('versao')
    .eq('empresa_id', params.empresaId)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  const proximaVersao = (ultimaVersao?.versao ?? 0) + 1

  await admin.from('rt_parametros_cliente').update({ ativo: false }).eq('empresa_id', params.empresaId).eq('ativo', true)

  const { error } = await admin.from('rt_parametros_cliente').insert({
    org_id: params.orgId,
    empresa_id: params.empresaId,
    versao: proximaVersao,
    aliquota_cbs: params.input.aliquotaCbs,
    aliquota_ibs_total: ibsTotalEfetivo(params.input),
    aliquota_ibs_uf: params.input.aliquotaIbsUf ?? null,
    aliquota_ibs_mun: params.input.aliquotaIbsMun ?? null,
    cst: params.input.cst,
    cclass_trib: params.input.cclassTrib,
    observacao: params.input.observacao ?? null,
    vigencia_inicio: params.input.vigenciaInicio,
    vigencia_fim: params.input.vigenciaFim ?? null,
    ativo: true,
    criado_por: params.userId,
    criado_por_email: params.userEmail,
  })

  if (error) return { erro: error.message }
  return { versao: proximaVersao }
}
