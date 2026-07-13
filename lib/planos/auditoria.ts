import type { SupabaseClient } from '@supabase/supabase-js'

export type TipoEventoRt =
  | 'assinatura_criada' | 'assinatura_ativada' | 'assinatura_alterada' | 'assinatura_cancelada'
  | 'assinatura_suspensa' | 'assinatura_reativada'
  | 'cnpj_vinculado' | 'cnpj_corrigido'
  | 'limite_cnpj_atingido' | 'limite_xml_atingido' | 'uso_xml_reconciliado'
  | 'webhook_falha' | 'acesso_nao_autorizado'

interface RegistrarEventoParams {
  orgId: string
  assinaturaId?: string | null
  tipo: TipoEventoRt
  detalhes?: Record<string, unknown>
  atorUserId?: string | null
}

/**
 * Grava um evento de auditoria comercial. Nunca inclui XML ou dado fiscal
 * bruto em `detalhes` — só metadados (ids, contagens, códigos de plano).
 * `admin` deve ser um client com service role (createAdminClient()).
 */
export async function registrarEventoRt(admin: SupabaseClient, params: RegistrarEventoParams): Promise<void> {
  await admin.from('rt_auditoria').insert({
    org_id: params.orgId,
    assinatura_id: params.assinaturaId ?? null,
    tipo_evento: params.tipo,
    detalhes: params.detalhes ?? null,
    ator_user_id: params.atorUserId ?? null,
  })
}
