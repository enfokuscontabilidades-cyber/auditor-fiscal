import type { SupabaseClient } from '@supabase/supabase-js'

export class OrgMembershipConflictError extends Error {
  constructor(userId: string) {
    super(`Usuário ${userId} possui mais de um vínculo de organização ativo`)
    this.name = 'OrgMembershipConflictError'
  }
}

export async function getOrgId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('membros_organizacao')
    .select('org_id')
    .eq('user_id', userId)
    .limit(2)

  if (error) throw error
  if ((data?.length ?? 0) > 1) throw new OrgMembershipConflictError(userId)

  return data?.[0]?.org_id ?? null
}
