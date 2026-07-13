import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlanoReformaTributaria } from '@/lib/planos/reformaTributariaPlanos'
import type { AssinaturaRt, PlanoReformaTributariaCodigo } from '@/lib/types'

export type ProdutoEscopo = 'full_platform' | 'tax_reform_only'

/** Módulos que um workspace `tax_reform_only` pode acessar. Nada fora desta lista. */
export type ModuloFiscal =
  | 'dashboard' | 'empresas' | 'reforma_tributaria' | 'assinatura' | 'configuracoes' | 'suporte'
  | 'auditor_fiscal' | 'editor_sped' | 'validador_entradas' | 'simples_nacional'
  | 'inconsistencias' | 'planejamento' | 'obrigacoes' | 'cobrancas' | 'leads_reforma_tributaria'

export const MODULOS_TAX_REFORM_ONLY: ModuloFiscal[] = [
  'dashboard', 'empresas', 'reforma_tributaria', 'assinatura', 'configuracoes', 'suporte',
]

export interface ContextoAcesso {
  orgId: string
  produtoEscopo: ProdutoEscopo
  assinatura: AssinaturaRt | null
  cnpjSlotsUsados: number
  xmlsUsadosNoCiclo: number
}

/**
 * Único ponto de verdade sobre o que uma organização pode fazer no produto
 * de Reforma Tributária. Usado por layouts (gate de rota), páginas
 * (renderização condicional) e API routes (validação server-side).
 */
export async function getContextoAcesso(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ContextoAcesso> {
  const { data: org } = await supabase
    .from('organizacoes')
    .select('produto_escopo')
    .eq('id', orgId)
    .single()

  const produtoEscopo: ProdutoEscopo = org?.produto_escopo === 'tax_reform_only' ? 'tax_reform_only' : 'full_platform'

  if (produtoEscopo === 'full_platform') {
    return { orgId, produtoEscopo, assinatura: null, cnpjSlotsUsados: 0, xmlsUsadosNoCiclo: 0 }
  }

  const { data: assinatura } = await supabase
    .from('rt_assinaturas')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  const { count: cnpjSlotsUsados } = await supabase
    .from('rt_cnpj_slots')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  let xmlsUsadosNoCiclo = 0
  if (assinatura?.ciclo_inicio) {
    const periodoInicio = assinatura.ciclo_inicio.slice(0, 10)
    const { data: uso } = await supabase
      .from('rt_uso_mensal')
      .select('xmls_processados')
      .eq('assinatura_id', assinatura.id)
      .eq('periodo_inicio', periodoInicio)
      .maybeSingle()
    xmlsUsadosNoCiclo = uso?.xmls_processados ?? 0
  }

  return {
    orgId,
    produtoEscopo,
    assinatura: (assinatura as AssinaturaRt) ?? null,
    cnpjSlotsUsados: cnpjSlotsUsados ?? 0,
    xmlsUsadosNoCiclo,
  }
}

/** A assinatura já foi ativada ao menos uma vez (paga ou liberada manualmente). */
export function assinaturaEstaAtiva(ctx: ContextoAcesso): boolean {
  if (ctx.produtoEscopo === 'full_platform') return true
  if (!ctx.assinatura) return false
  const { status, acesso_ate } = ctx.assinatura
  if (status === 'active' || status === 'manual' || status === 'past_due') return true
  if (status === 'canceled' && acesso_ate) return new Date(acesso_ate).getTime() > Date.now()
  return false
}

/**
 * Nunca foi ativada — é o único caso em que o usuário deve ser mandado
 * de volta para a tela de assinatura/ativação em vez de entrar na área
 * restrita em modo leitura.
 */
export function precisaAtivarAssinatura(ctx: ContextoAcesso): boolean {
  if (ctx.produtoEscopo === 'full_platform') return false
  return !ctx.assinatura || ctx.assinatura.status === 'pending'
}

export function canAccessModule(ctx: ContextoAcesso, modulo: ModuloFiscal): boolean {
  if (ctx.produtoEscopo === 'full_platform') return true
  return MODULOS_TAX_REFORM_ONLY.includes(modulo)
}

export function getPlanoAtual(ctx: ContextoAcesso) {
  if (ctx.produtoEscopo === 'full_platform' || !ctx.assinatura) return undefined
  return getPlanoReformaTributaria(ctx.assinatura.plano_codigo)
}

export function getCompanyLimit(ctx: ContextoAcesso): number | null {
  if (ctx.produtoEscopo === 'full_platform') return null
  return getPlanoAtual(ctx)?.limiteCnpj ?? 0
}

export function getXmlUsageLimit(ctx: ContextoAcesso): number | null {
  if (ctx.produtoEscopo === 'full_platform') return null
  return getPlanoAtual(ctx)?.limiteXmlPorCiclo ?? 0
}

export function canCreateCompany(ctx: ContextoAcesso): boolean {
  if (ctx.produtoEscopo === 'full_platform') return true
  if (!assinaturaEstaAtiva(ctx)) return false
  const limite = getCompanyLimit(ctx)
  return limite === null || ctx.cnpjSlotsUsados < limite
}

/**
 * Checagem informativa (dashboard, UI) — não é a barreira real. A barreira
 * real é a reserva atômica em `lib/planos/quotaXml.ts` (RPC
 * `rt_reservar_quota_xml`), usada dentro de `/api/documentos-fiscais/importar-nfe`.
 * Esta função nunca deve ser usada para decidir se um processamento pode
 * prosseguir — só para exibir estado (ex: desabilitar botão de upload).
 */
export function canProcessXml(ctx: ContextoAcesso): boolean {
  if (ctx.produtoEscopo === 'full_platform') return true
  if (!assinaturaEstaAtiva(ctx)) return false
  const limite = getXmlUsageLimit(ctx)
  return limite === null || ctx.xmlsUsadosNoCiclo < limite
}

export function canGenerateReport(ctx: ContextoAcesso): boolean {
  if (ctx.produtoEscopo === 'full_platform') return true
  return assinaturaEstaAtiva(ctx)
}

export function downgradeCompativel(ctx: ContextoAcesso, novoPlanoCodigo: PlanoReformaTributariaCodigo): boolean {
  const novoPlano = getPlanoReformaTributaria(novoPlanoCodigo)
  if (!novoPlano || novoPlano.limiteCnpj === null) return true
  return ctx.cnpjSlotsUsados <= novoPlano.limiteCnpj
}

/** Mensagens padronizadas (nunca expor erro técnico de banco/API ao usuário). */
export const MENSAGENS_RT = {
  limiteCnpjAtingido: 'Você utilizou todas as vagas de CNPJ do seu plano.',
  limiteXmlAtingido: (dataRenovacao: string) =>
    `Você utilizou os XMLs disponíveis neste ciclo. O limite será renovado em ${dataRenovacao}.`,
  assinaturaInativa: 'Sua assinatura não está ativa. Regularize o pagamento para realizar novas análises.',
  cnpjNaoPodeSerAlterado: 'Este CNPJ está vinculado permanentemente ao seu plano e não pode ser alterado. Fale com o suporte.',
  xmlDeOutroCnpj: (nomeArquivo: string) =>
    `O arquivo "${nomeArquivo}" não pertence à empresa selecionada e não foi processado.`,
  downgradeIncompativel: 'Este plano não comporta a quantidade de CNPJs já vinculados à sua conta.',
} as const
