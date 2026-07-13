import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Serviço centralizado de quota de XMLs da Reforma Tributária. Todo fluxo
 * de importação (XML avulso, múltiplos XMLs, ZIP, reprocessamento) deve
 * passar por aqui — nunca reimplementar a checagem de saldo localmente.
 *
 * A reserva é atômica no banco (lock por assinatura+ciclo dentro da função
 * `rt_reservar_quota_xml`), então duas requisições simultâneas (duas
 * abas, dois uploads de ZIP) nunca conseguem ultrapassar o limite
 * contratado — mesmo que ambas leiam o mesmo saldo "por fora" antes de
 * chamar a reserva.
 */

export interface ReservaQuotaResultado {
  /** Chaves que já constavam como processadas no ciclo — reprocessamento livre, não consome quota. */
  jaProcessadas: string[]
  /** Chaves novas aceitas nesta chamada — quota já debitada atomicamente. */
  reservadas: string[]
  /** Chaves novas que NÃO couberam no saldo disponível — nunca devem ser persistidas. */
  rejeitadas: string[]
  elegiveis: number
  permitidas: number
  usoApos: number
}

/** Início do ciclo de cobrança atual (YYYY-MM-DD). Sem ciclo do Stripe (ex: ativação manual), usa o mês corrente. */
export function periodoInicioAtual(cicloInicio: string | null | undefined): string {
  if (cicloInicio) return cicloInicio.slice(0, 10)
  const agora = new Date()
  return `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function periodoFimDoInicio(periodoInicio: string): string {
  const d = new Date(`${periodoInicio}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Gera uma chave sintética, única por chamada, para documentos sem
 * chave_acesso real (ex: XML malformado que ainda assim gerou um
 * registro). Nunca colide com uma chave real nem com uma chave sintética
 * de outra requisição, então esses documentos são sempre tratados como
 * "novos" para fins de quota — igual ao comportamento anterior.
 */
export function chaveQuotaParaDocumento(chaveAcesso: string | null | undefined, indice: number): string {
  if (chaveAcesso) return chaveAcesso
  return `__sem_chave__${crypto.randomUUID()}__${indice}`
}

interface ReservarQuotaParams {
  assinaturaId: string
  orgId: string
  empresaId: string
  periodoInicio: string
  periodoFim: string
  /** null = sem limite comercial (Profissional/Ilimitado) */
  limite: number | null
  chaves: string[]
}

interface ReservaRpcRow {
  ja_processadas: string[]
  reservadas: string[]
  rejeitadas: string[]
  elegiveis: number
  permitidas: number
  uso_apos: number
}

/** Reserva quota de forma atômica. `admin` deve ser um client com service role. */
export async function reservarQuotaXml(admin: SupabaseClient, params: ReservarQuotaParams): Promise<ReservaQuotaResultado> {
  const { data, error } = await admin.rpc('rt_reservar_quota_xml', {
    p_assinatura_id: params.assinaturaId,
    p_org_id: params.orgId,
    p_empresa_id: params.empresaId,
    p_periodo_inicio: params.periodoInicio,
    p_periodo_fim: params.periodoFim,
    p_limite: params.limite,
    p_chaves: params.chaves,
  })

  if (error) throw new Error(`Falha ao reservar quota de XML: ${error.message}`)

  const row = data as ReservaRpcRow
  return {
    jaProcessadas: row.ja_processadas ?? [],
    reservadas: row.reservadas ?? [],
    rejeitadas: row.rejeitadas ?? [],
    elegiveis: row.elegiveis ?? 0,
    permitidas: row.permitidas ?? 0,
    usoApos: row.uso_apos ?? 0,
  }
}

/**
 * Devolve a quota de chaves que foram reservadas mas não chegaram a ser
 * persistidas (ex: falha ao gravar em fa_documentos_fiscais). Transacional
 * e nunca deixa o contador ficar negativo.
 */
export async function liberarQuotaXml(
  admin: SupabaseClient,
  params: { assinaturaId: string; periodoInicio: string; chaves: string[] },
): Promise<number> {
  if (params.chaves.length === 0) return 0
  const { data, error } = await admin.rpc('rt_liberar_quota_xml', {
    p_assinatura_id: params.assinaturaId,
    p_periodo_inicio: params.periodoInicio,
    p_chaves: params.chaves,
  })
  if (error) throw new Error(`Falha ao liberar quota de XML: ${error.message}`)
  return (data as number) ?? 0
}

export async function reconciliarUsoXml(
  admin: SupabaseClient,
  params: { assinaturaId: string; periodoInicio: string; adminEmail: string; justificativa: string },
): Promise<{ valorAnterior: number; valorRecalculado: number }> {
  const { data, error } = await admin.rpc('rt_reconciliar_uso_xml', {
    p_assinatura_id: params.assinaturaId,
    p_periodo_inicio: params.periodoInicio,
    p_admin_email: params.adminEmail,
    p_justificativa: params.justificativa,
  })
  if (error) throw new Error(`Falha ao reconciliar uso de XML: ${error.message}`)
  const row = data as { valor_anterior: number; valor_recalculado: number }
  return { valorAnterior: row.valor_anterior, valorRecalculado: row.valor_recalculado }
}
