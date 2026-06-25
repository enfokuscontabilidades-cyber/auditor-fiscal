import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, validarSessaoDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const {
    sessao_id,
    empresa_id,
    nome_arquivo,
    tipo,
    subtipo,
    competencia,
    periodo_inicial,
    periodo_final,
    cnpj_declarante,
    tamanho_bytes,
    total_linhas,
    parsed_data,
  } = body

  if (!sessao_id || !empresa_id || !nome_arquivo || !tipo || !competencia) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: sessao_id, empresa_id, nome_arquivo, tipo, competencia' },
      { status: 400 }
    )
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresa_id, orgId)) {
    return respostaForbidden('empresa_id')
  }

  if (!await validarSessaoDaOrg(supabase, sessao_id, orgId)) {
    return respostaForbidden('sessao_id')
  }

  const { data, error } = await supabase
    .from('fa_arquivos_sped')
    .insert({
      org_id: orgId,
      sessao_id,
      empresa_id,
      nome_arquivo,
      tipo,
      subtipo,
      competencia,
      periodo_inicial,
      periodo_final,
      cnpj_declarante,
      tamanho_bytes,
      total_linhas,
      parsed_data,
      parsed_at: new Date().toISOString(),
      status: 'ok',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessaoId = searchParams.get('sessao_id')

  if (!sessaoId) {
    return NextResponse.json({ error: 'sessao_id é obrigatório' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('fa_arquivos_sped')
    .select('*')
    .eq('sessao_id', sessaoId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
