// Override por empresa do CFOP considerado faturamento na apuração do Simples Nacional.
// A lista padrão (lib/simples/cfopReceita.ts) continua sendo a fonte de verdade quando
// a empresa não tem override configurado para aquele CFOP.

import type { SupabaseClient } from '@supabase/supabase-js'
import { cfopEhFaturamento } from './cfopReceita'

export interface CfopOverrideRow {
  cfop: string
  considerar_faturamento: boolean
}

/** Carrega os overrides de uma empresa como Map<cfop (4 dígitos), considerar_faturamento>. */
export async function carregarOverridesCfop(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<Map<string, boolean>> {
  const { data } = await supabase
    .from('fa_cfop_faturamento_config')
    .select('cfop, considerar_faturamento')
    .eq('empresa_id', empresaId)

  const overrides = new Map<string, boolean>()
  for (const row of (data ?? []) as CfopOverrideRow[]) {
    overrides.set(row.cfop, row.considerar_faturamento)
  }
  return overrides
}

/** Resolve se um CFOP conta como faturamento, priorizando o override da empresa sobre o padrão. */
export function resolverFaturamentoCfop(
  cfop: string | null | undefined,
  overrides: Map<string, boolean>,
): boolean {
  if (!cfop) return false
  const cfop4 = cfop.replace(/\D/g, '').slice(0, 4)
  if (overrides.has(cfop4)) return overrides.get(cfop4)!
  return cfopEhFaturamento(cfop4)
}
