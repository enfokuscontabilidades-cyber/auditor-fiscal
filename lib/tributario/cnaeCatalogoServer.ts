import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TributarioCnaeRegra } from '@/lib/types'

export async function carregarRegrasCnaeVigentes(
  supabase: SupabaseClient,
  dataReferencia = new Date().toISOString().slice(0, 10),
): Promise<TributarioCnaeRegra[]> {
  const { data, error } = await supabase
    .from('tributario_cnae_regras')
    .select('*')
    .eq('ativo', true)
    .lte('vigencia_inicio', dataReferencia)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${dataReferencia}`)
    .order('prioridade', { ascending: false })
    .order('versao', { ascending: false })

  // Fallback deliberado: a consulta continua funcionando antes da migração
  // ou durante indisponibilidade temporária do catálogo.
  if (error || !data) return []
  return data as unknown as TributarioCnaeRegra[]
}
