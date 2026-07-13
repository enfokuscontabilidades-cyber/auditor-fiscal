import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { validarParametrosEspecificos, salvarNovaVersaoParametrosCliente, type ParametrosEspecificosInput } from '@/lib/fiscal/parametrosClienteReforma'
import { NextResponse } from 'next/server'
import type { RtParametrosCliente } from '@/lib/types'

/**
 * Parâmetros tributários específicos por cliente (empresa analisada),
 * versionados. GET retorna a versão vigente (ativo=true) + o histórico
 * completo; POST sempre cria uma NOVA versão — nunca sobrescreve uma
 * já existente.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  if (!empresaId) return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const { data: historico, error } = await supabase
    .from('rt_parametros_cliente')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('versao', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lista = (historico ?? []) as RtParametrosCliente[]
  const vigente = lista.find(p => p.ativo) ?? null

  return NextResponse.json({ vigente, historico: lista })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  const body = await request.json() as { empresa_id?: string } & Partial<ParametrosEspecificosInput>
  const { empresa_id: empresaId } = body
  if (!empresaId) return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const input: ParametrosEspecificosInput = {
    aliquotaCbs: Number(body.aliquotaCbs),
    aliquotaIbsTotal: body.aliquotaIbsTotal != null ? Number(body.aliquotaIbsTotal) : undefined,
    aliquotaIbsUf: body.aliquotaIbsUf != null ? Number(body.aliquotaIbsUf) : undefined,
    aliquotaIbsMun: body.aliquotaIbsMun != null ? Number(body.aliquotaIbsMun) : undefined,
    cst: String(body.cst ?? ''),
    cclassTrib: String(body.cclassTrib ?? ''),
    observacao: body.observacao?.trim() || undefined,
    vigenciaInicio: String(body.vigenciaInicio ?? ''),
    vigenciaFim: body.vigenciaFim?.trim() || undefined,
  }

  const erros = validarParametrosEspecificos(input)
  if (erros.length > 0) {
    return NextResponse.json({ error: 'Parâmetros inválidos', detalhes: erros }, { status: 400 })
  }

  const admin = createAdminClient()

  const resultado = await salvarNovaVersaoParametrosCliente(admin, {
    orgId, empresaId, input, userId: user.id, userEmail: user.email ?? null,
  })

  if ('erro' in resultado) return NextResponse.json({ error: resultado.erro }, { status: 500 })

  const { data: nova, error } = await admin
    .from('rt_parametros_cliente')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('versao', resultado.versao)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(nova, { status: 201 })
}
