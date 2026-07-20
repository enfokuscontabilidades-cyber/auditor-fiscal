import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { CFOP_FATURAMENTO_PADRAO } from '@/lib/simples/cfopReceita'
import type { FaCfopFaturamentoConfig } from '@/lib/types'

interface CfopListado {
  cfop: string
  descricao: string
  considerar_faturamento: boolean
  origem: 'padrao' | 'usuario'
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  if (!empresaId) return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })
  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) return respostaForbidden('empresa_id')

  const { data: overrides, error } = await supabase
    .from('fa_cfop_faturamento_config')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('cfop')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const overridesPorCfop = new Map<string, FaCfopFaturamentoConfig>()
  for (const o of (overrides ?? []) as FaCfopFaturamentoConfig[]) overridesPorCfop.set(o.cfop, o)

  const porCfop = new Map<string, CfopListado>()
  for (const padrao of CFOP_FATURAMENTO_PADRAO) {
    porCfop.set(padrao.cfop, {
      cfop: padrao.cfop,
      descricao: padrao.descricao,
      considerar_faturamento: true,
      origem: 'padrao',
    })
  }
  for (const o of overridesPorCfop.values()) {
    porCfop.set(o.cfop, {
      cfop: o.cfop,
      descricao: o.descricao || porCfop.get(o.cfop)?.descricao || `CFOP ${o.cfop}`,
      considerar_faturamento: o.considerar_faturamento,
      origem: 'usuario',
    })
  }

  const lista = Array.from(porCfop.values()).sort((a, b) => a.cfop.localeCompare(b.cfop))

  return NextResponse.json({ cfops: lista, overrides: overrides ?? [] })
}

interface ConfigCfopInput {
  cfop: string
  descricao?: string | null
  considerar_faturamento: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json() as { empresa_id: string; configs: ConfigCfopInput[] }
  if (!body.empresa_id || !Array.isArray(body.configs) || body.configs.length === 0) {
    return NextResponse.json({ error: 'empresa_id e configs[] são obrigatórios' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })
  if (!await validarEmpresaDaOrg(supabase, body.empresa_id, orgId)) return respostaForbidden('empresa_id')

  const rows = body.configs.map(c => ({
    org_id: orgId,
    empresa_id: body.empresa_id,
    cfop: c.cfop.replace(/\D/g, '').slice(0, 4),
    descricao: c.descricao ?? null,
    considerar_faturamento: c.considerar_faturamento,
    origem: 'usuario' as const,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('fa_cfop_faturamento_config')
    .upsert(rows, { onConflict: 'empresa_id,cfop' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  const cfop = searchParams.get('cfop')
  if (!empresaId || !cfop) {
    return NextResponse.json({ error: 'empresa_id e cfop são obrigatórios' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })
  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) return respostaForbidden('empresa_id')

  const { error } = await supabase
    .from('fa_cfop_faturamento_config')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('cfop', cfop)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
