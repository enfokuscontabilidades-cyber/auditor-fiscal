import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Verifica se uma empresa pertence à organização do usuário autenticado.
 * Usa duas camadas: filtro explícito por org_id + RLS SELECT da tabela empresas.
 * Retorna false se o empresa_id não existir ou pertencer a outra org.
 */
export async function validarEmpresaDaOrg(
  supabase: SupabaseClient,
  empresaId: string,
  orgId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('empresas')
    .select('id', { count: 'exact', head: true })
    .eq('id', empresaId)
    .eq('org_id', orgId)
  return (count ?? 0) > 0
}

/**
 * Verifica se uma sessão de análise pertence à organização do usuário autenticado.
 * Retorna false se o sessao_id não existir ou pertencer a outra org.
 */
export async function validarSessaoDaOrg(
  supabase: SupabaseClient,
  sessaoId: string,
  orgId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('fa_sessoes_analise')
    .select('id', { count: 'exact', head: true })
    .eq('id', sessaoId)
    .eq('org_id', orgId)
  return (count ?? 0) > 0
}

/**
 * Verifica se um documento fiscal pertence à organização do usuário autenticado.
 * Retorna false se o documento_id não existir ou pertencer a outra org.
 */
export async function validarDocumentoDaOrg(
  supabase: SupabaseClient,
  documentoId: string,
  orgId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('fa_documentos_fiscais')
    .select('id', { count: 'exact', head: true })
    .eq('id', documentoId)
    .eq('org_id', orgId)
  return (count ?? 0) > 0
}

/**
 * Verifica se um membro pertence à organização do usuário autenticado.
 * Retorna false se o membro_id não existir ou pertencer a outra org.
 */
export async function validarMembroDaOrg(
  supabase: SupabaseClient,
  membroId: string,
  orgId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('membros_organizacao')
    .select('id', { count: 'exact', head: true })
    .eq('id', membroId)
    .eq('org_id', orgId)
  return (count ?? 0) > 0
}

/**
 * Resposta padronizada 403 para operações negadas.
 * Não revela se o recurso existe em outra organização.
 */
export function respostaForbidden(recurso = 'recurso') {
  return NextResponse.json(
    { error: `${recurso} inválido ou sem permissão` },
    { status: 403 },
  )
}
