import type { SupabaseClient } from '@supabase/supabase-js'

export async function getOrgId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('membros_organizacao')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  return data?.org_id ?? null
}
