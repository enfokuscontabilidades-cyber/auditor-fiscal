import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TributarioNcmRegra } from '@/lib/types'

export async function carregarRegrasNcmVigentes(
  supabase: SupabaseClient,
  dataReferencia = new Date().toISOString().slice(0, 10),
): Promise<TributarioNcmRegra[]> {
  const { data, error } = await supabase
    .from('tributario_ncm_regras')
    .select('*')
    .eq('ativo', true)
    .lte('vigencia_inicio', dataReferencia)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${dataReferencia}`)
    .order('prioridade', { ascending: false })
    .order('versao', { ascending: false })

  if (error || !data) return []
  return data as unknown as TributarioNcmRegra[]
}
