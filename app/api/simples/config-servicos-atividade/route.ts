import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import type { SnConfigServicoAtividade } from '@/lib/types'

interface ServicoDetectado {
  codigo_servico: string
  descricao_servico: string
  count_nfse: number
  valor_total: number
  config: SnConfigServicoAtividade | null
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

  const { data: configs } = await supabase
    .from('sn_config_servicos_atividade')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('codigo_servico')

  const configsPorCodigo = new Map<string, SnConfigServicoAtividade>()
  for (const c of (configs ?? [])) configsPorCodigo.set(c.codigo_servico, c as SnConfigServicoAtividade)

  // Detectar serviços das NFS-e importadas via itens classificados como 'servico'
  const { data: itens } = await supabase
    .from('fa_documentos_itens')
    .select('codigo_produto, descricao, valor_total, valor_desconto, documento_id')
    .eq('empresa_id', empresaId)
    .eq('classificacao', 'servico')
    .not('codigo_produto', 'is', null)

  const docIds = [...new Set((itens ?? []).map((i: { documento_id: string }) => i.documento_id))]

  const docsFiltrados = new Set<string>()
  for (let i = 0; i < docIds.length; i += 500) {
    const { data: docs } = await supabase
      .from('fa_documentos_fiscais')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('tipo_documento', 'nfse')
      .neq('status', 'cancelada')
      .in('id', docIds.slice(i, i + 500))
    for (const d of (docs ?? [])) docsFiltrados.add(d.id)
  }

  type ItemRow = { codigo_produto: string; descricao: string; valor_total: number; valor_desconto: number; documento_id: string }
  const porCodigo = new Map<string, { descricao: string; docs: Set<string>; valor: number }>()
  for (const item of ((itens ?? []) as ItemRow[])) {
    if (!docsFiltrados.has(item.documento_id)) continue
    const codigo = item.codigo_produto
    if (!porCodigo.has(codigo)) porCodigo.set(codigo, { descricao: item.descricao ?? '', docs: new Set(), valor: 0 })
    const entry = porCodigo.get(codigo)!
    entry.docs.add(item.documento_id)
    entry.valor += Math.max(0, (item.valor_total ?? 0) - (item.valor_desconto ?? 0))
  }

  const servicos: ServicoDetectado[] = Array.from(porCodigo.entries())
    .map(([codigo, d]) => ({
      codigo_servico: codigo,
      descricao_servico: d.descricao,
      count_nfse: d.docs.size,
      valor_total: d.valor,
      config: configsPorCodigo.get(codigo) ?? null,
    }))
    .sort((a, b) => b.valor_total - a.valor_total)

  return NextResponse.json({ configs: configs ?? [], servicos })
}

type ConfigAtividadeInput = {
  codigo_servico: string
  descricao_servico?: string
  modo_tributacao: 'anexo_fixo' | 'fator_r'
  anexo_fixo?: 'III' | 'IV' | 'V' | null
  observacoes?: string | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json() as { empresa_id: string; configs: ConfigAtividadeInput[] }
  if (!body.empresa_id || !Array.isArray(body.configs) || body.configs.length === 0) {
    return NextResponse.json({ error: 'empresa_id e configs[] são obrigatórios' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })
  if (!await validarEmpresaDaOrg(supabase, body.empresa_id, orgId)) return respostaForbidden('empresa_id')

  const rows = body.configs.map(c => ({
    org_id: orgId,
    empresa_id: body.empresa_id,
    codigo_servico: c.codigo_servico,
    descricao_servico: c.descricao_servico ?? null,
    modo_tributacao: c.modo_tributacao,
    anexo_fixo: c.modo_tributacao === 'fator_r' ? null : (c.anexo_fixo ?? null),
    observacoes: c.observacoes ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('sn_config_servicos_atividade')
    .upsert(rows, { onConflict: 'empresa_id,codigo_servico' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
