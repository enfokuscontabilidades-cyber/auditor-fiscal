import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import type { SnConfigServicoAtividade } from '@/lib/types'
import {
  criarChaveServicoNfse,
  normalizarCodigoServicoNfse,
  resolverIdentidadeServicoNfse,
  type OrigemCodigoServicoNfse,
} from '@/lib/simples/codigoServicoNfse'

interface ServicoDetectado {
  chave_servico: string
  codigo_servico: string
  origem_codigo_servico: OrigemCodigoServicoNfse
  municipio_codigo?: string
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

  const configsPorChave = new Map<string, SnConfigServicoAtividade>()
  const configsLegadasPorCodigo = new Map<string, SnConfigServicoAtividade>()
  for (const config of (configs ?? []) as SnConfigServicoAtividade[]) {
    if (config.chave_servico) configsPorChave.set(config.chave_servico, config)
    if (!config.chave_servico || config.origem_codigo_servico === 'legado') {
      configsLegadasPorCodigo.set(normalizarCodigoServicoNfse(config.codigo_servico, 'legado'), config)
    }
  }

  // Detectar serviços das NFS-e importadas via itens classificados como 'servico'
  const { data: itens } = await supabase
    .from('fa_documentos_itens')
    .select('codigo_produto, descricao, valor_total, valor_desconto, documento_id')
    .eq('empresa_id', empresaId)
    .eq('classificacao', 'servico')
    .not('codigo_produto', 'is', null)

  const docIds = [...new Set((itens ?? []).map((i: { documento_id: string }) => i.documento_id))]

  type DocumentoServicoRow = { id: string; parsed_data: unknown }
  const docsFiltrados = new Map<string, DocumentoServicoRow>()
  for (let i = 0; i < docIds.length; i += 500) {
    const { data: docs } = await supabase
      .from('fa_documentos_fiscais')
      .select('id, parsed_data')
      .eq('empresa_id', empresaId)
      .eq('tipo_documento', 'nfse')
      .neq('status', 'cancelada')
      .in('id', docIds.slice(i, i + 500))
    for (const d of (docs ?? []) as DocumentoServicoRow[]) docsFiltrados.set(d.id, d)
  }

  type ItemRow = { codigo_produto: string; descricao: string; valor_total: number; valor_desconto: number; documento_id: string }
  const porChave = new Map<string, {
    codigo: string
    origem: OrigemCodigoServicoNfse
    municipioCodigo?: string
    descricao: string
    docs: Set<string>
    valor: number
  }>()
  for (const item of ((itens ?? []) as ItemRow[])) {
    const documento = docsFiltrados.get(item.documento_id)
    if (!documento) continue
    const identidade = resolverIdentidadeServicoNfse(item, documento)
    if (!identidade) continue
    if (!porChave.has(identidade.chave)) {
      porChave.set(identidade.chave, {
        codigo: identidade.codigo,
        origem: identidade.origem,
        municipioCodigo: identidade.municipioCodigo,
        descricao: item.descricao ?? '',
        docs: new Set(),
        valor: 0,
      })
    }
    const entry = porChave.get(identidade.chave)!
    entry.docs.add(item.documento_id)
    entry.valor += Math.max(0, (item.valor_total ?? 0) - (item.valor_desconto ?? 0))
  }

  const servicos: ServicoDetectado[] = Array.from(porChave.entries())
    .map(([chave, d]) => ({
      chave_servico: chave,
      codigo_servico: d.codigo,
      origem_codigo_servico: d.origem,
      municipio_codigo: d.municipioCodigo,
      descricao_servico: d.descricao,
      count_nfse: d.docs.size,
      valor_total: d.valor,
      config: configsPorChave.get(chave) ??
        configsLegadasPorCodigo.get(normalizarCodigoServicoNfse(d.codigo, 'legado')) ?? null,
    }))
    .sort((a, b) => b.valor_total - a.valor_total)

  return NextResponse.json({ configs: configs ?? [], servicos })
}

type ConfigAtividadeInput = {
  chave_servico?: string
  codigo_servico: string
  origem_codigo_servico?: OrigemCodigoServicoNfse
  municipio_codigo?: string | null
  descricao_servico?: string
  modo_tributacao: 'anexo_fixo' | 'fator_r'
  anexo_fixo?: 'III' | 'IV' | 'V' | null
  cnae_vinculado?: string | null
  tratamento_sugerido?: SnConfigServicoAtividade['tratamento_sugerido'] | null
  anexo_sugerido?: SnConfigServicoAtividade['anexo_sugerido'] | null
  confianca_sugestao?: SnConfigServicoAtividade['confianca_sugestao'] | null
  regra_cnae_versao?: string | null
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

  const configInvalida = body.configs.find(c =>
    !c.codigo_servico?.trim() ||
    (c.origem_codigo_servico != null && !['lista_nacional', 'municipal', 'legado'].includes(c.origem_codigo_servico)) ||
    !['anexo_fixo', 'fator_r'].includes(c.modo_tributacao) ||
    (c.modo_tributacao === 'anexo_fixo' && !['III', 'IV', 'V'].includes(c.anexo_fixo ?? '')) ||
    (c.tratamento_sugerido != null && !['anexo_i', 'anexo_ii', 'anexo_iii', 'anexo_iv', 'fator_r', 'inconclusivo'].includes(c.tratamento_sugerido)) ||
    (c.anexo_sugerido != null && !['I', 'II', 'III', 'IV', 'V'].includes(c.anexo_sugerido)) ||
    (c.confianca_sugestao != null && !['alta', 'media', 'baixa'].includes(c.confianca_sugestao))
  )
  if (configInvalida) {
    return NextResponse.json({ error: `Configuração inválida no serviço ${configInvalida.codigo_servico || 'sem código'}.` }, { status: 400 })
  }

  const cnaeInvalido = body.configs.find(c => {
    const codigo = (c.cnae_vinculado ?? '').replace(/\D/g, '')
    return codigo.length > 0 && codigo.length !== 7
  })
  if (cnaeInvalido) {
    return NextResponse.json({ error: `CNAE inválido no serviço ${cnaeInvalido.codigo_servico}. Informe os 7 dígitos.` }, { status: 400 })
  }

  const municipioInvalido = body.configs.find(c => {
    const municipio = (c.municipio_codigo ?? '').replace(/\D/g, '')
    return municipio.length > 0 && municipio.length !== 7
  })
  if (municipioInvalido) {
    return NextResponse.json({ error: `Município inválido no serviço ${municipioInvalido.codigo_servico}.` }, { status: 400 })
  }

  const rows = body.configs.map(c => {
    const origem = c.origem_codigo_servico ?? 'legado'
    const municipio = (c.municipio_codigo ?? '').replace(/\D/g, '').slice(0, 7) || null
    const chaveServico = criarChaveServicoNfse({
      codigo: c.codigo_servico,
      origem,
      municipioCodigo: municipio,
    })
    return {
      org_id: orgId,
      empresa_id: body.empresa_id,
      chave_servico: chaveServico,
      codigo_servico: c.codigo_servico,
      origem_codigo_servico: origem,
      municipio_codigo: municipio,
      descricao_servico: c.descricao_servico ?? null,
      modo_tributacao: c.modo_tributacao,
      anexo_fixo: c.modo_tributacao === 'fator_r' ? null : (c.anexo_fixo ?? null),
      cnae_vinculado: (c.cnae_vinculado ?? '').replace(/\D/g, '') || null,
      tratamento_sugerido: c.tratamento_sugerido ?? null,
      anexo_sugerido: c.anexo_sugerido ?? null,
      confianca_sugestao: c.confianca_sugestao ?? null,
      regra_cnae_versao: c.regra_cnae_versao ?? null,
      observacoes: c.observacoes ?? null,
      updated_at: new Date().toISOString(),
    }
  })

  const { data, error } = await supabase
    .from('sn_config_servicos_atividade')
    .upsert(rows, { onConflict: 'empresa_id,chave_servico' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
