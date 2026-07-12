import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'

type ConfigBody = {
  empresa_id: string
  modo_servico?: 'anexo_fixo' | 'fator_r'
  anexo_fixo?: 'III' | 'IV' | 'V' | null
  atividade_descricao?: string | null
  observacoes?: string | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  if (!empresaId) return NextResponse.json({ error: 'empresa_id e obrigatorio' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })
  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) return respostaForbidden('empresa_id')

  const { data, error } = await supabase
    .from('sn_config_servicos_empresa')
    .select('*')
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (error && !error.message.includes('does not exist')) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? null)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const body = await request.json() as ConfigBody
  if (!body.empresa_id) return NextResponse.json({ error: 'empresa_id e obrigatorio' }, { status: 400 })

  const modo = body.modo_servico ?? 'anexo_fixo'
  if (modo !== 'anexo_fixo' && modo !== 'fator_r') {
    return NextResponse.json({ error: 'modo_servico invalido' }, { status: 400 })
  }
  if (modo === 'anexo_fixo' && !body.anexo_fixo) {
    return NextResponse.json({ error: 'anexo_fixo e obrigatorio no modo anexo_fixo' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })
  if (!await validarEmpresaDaOrg(supabase, body.empresa_id, orgId)) return respostaForbidden('empresa_id')

  const row = {
    org_id: orgId,
    empresa_id: body.empresa_id,
    modo_servico: modo,
    anexo_fixo: body.anexo_fixo ?? (modo === 'fator_r' ? 'V' : 'III'),
    atividade_descricao: body.atividade_descricao ?? null,
    observacoes: body.observacoes ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('sn_config_servicos_empresa')
    .upsert(row, { onConflict: 'empresa_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
