import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const { sessao_id, empresa_id, competencia, xmls } = body

  if (!sessao_id || !empresa_id || !competencia || !Array.isArray(xmls)) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: sessao_id, empresa_id, competencia, xmls[]' },
      { status: 400 }
    )
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  const rows = xmls.map((x: {
    chave_nfe?: string
    numero_nf?: string
    data_emissao?: string | null
    emitente_cnpj?: string
    emitente_nome?: string
    destinatario_cnpj?: string
    destinatario_nome?: string
    tipo_operacao?: string
    valor_total?: number
    parsed_data?: unknown
  }) => ({
    org_id: orgId,
    sessao_id,
    empresa_id,
    competencia,
    chave_nfe: x.chave_nfe ?? null,
    numero_nf: x.numero_nf ?? null,
    data_emissao: x.data_emissao ?? null,
    emitente_cnpj: x.emitente_cnpj ?? null,
    emitente_nome: x.emitente_nome ?? null,
    destinatario_cnpj: x.destinatario_cnpj ?? null,
    destinatario_nome: x.destinatario_nome ?? null,
    tipo_operacao: x.tipo_operacao ?? null,
    valor_total: x.valor_total ?? null,
    parsed_data: x.parsed_data ?? null,
    status: 'ok',
  }))

  const { data, error } = await supabase
    .from('fa_arquivos_xml')
    .insert(rows)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ salvos: data?.length ?? 0 }, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessaoId = searchParams.get('sessao_id')
  const empresaId = searchParams.get('empresa_id')
  const tipoOperacao = searchParams.get('tipo_operacao')

  if (!sessaoId && !empresaId) {
    return NextResponse.json({ error: 'sessao_id ou empresa_id é obrigatório' }, { status: 400 })
  }

  let query = supabase
    .from('fa_arquivos_xml')
    .select('id, empresa_id, sessao_id, chave_nfe, numero_nf, data_emissao, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, tipo_operacao, valor_total, status, created_at')
    .order('data_emissao', { ascending: true })

  if (sessaoId) query = query.eq('sessao_id', sessaoId)
  if (empresaId) query = query.eq('empresa_id', empresaId)
  if (tipoOperacao) query = query.eq('tipo_operacao', tipoOperacao)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
