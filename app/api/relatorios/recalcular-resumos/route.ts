import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { normalizarCompetencia } from '@/lib/fiscal/competencia'
import { carregarXmlLegacy, carregarXmlLegacyDocumentos, type XmlLegacyItem, type XmlLegacyDocumento } from '@/lib/fiscal/xmlLegacy'

type ResumoRpc = {
  documentos?: number
  produtos?: number
  cfops?: number
  ncms?: number
  participantes?: number
}

type ProdutoResumo = {
  org_id: string
  empresa_id: string
  competencia: string
  tipo_movimento: string
  descricao: string
  ncm: string
  valor_total: number
  quantidade: number
  count: number
  updated_at: string
}

type DocumentoResumo = {
  org_id: string
  empresa_id: string
  competencia: string
  tipo_movimento: string
  valor_total: number
  count: number
  updated_at: string
}

type CfopResumo = {
  org_id: string
  empresa_id: string
  competencia: string
  cfop: string
  tipo: string
  valor_total: number
  quantidade: number
  count: number
  updated_at: string
}

type NcmResumo = {
  org_id: string
  empresa_id: string
  competencia: string
  ncm: string
  descricao_exemplo: string
  valor_total: number
  quantidade: number
  count_produtos: number
  updated_at: string
}

type ParticipanteResumo = {
  org_id: string
  empresa_id: string
  competencia: string
  tipo_movimento: string
  cnpj: string
  nome: string
  valor_total: number
  count: number
  updated_at: string
}

function tipoPorCfop(cfop: string) {
  return cfop.startsWith('1') || cfop.startsWith('2') || cfop.startsWith('3') ? 'entrada' : 'saida'
}

function key(...parts: Array<string | null | undefined>) {
  return parts.map(part => part ?? '').join('||')
}

function toResumoRpc(value: unknown): ResumoRpc {
  return value && typeof value === 'object' ? value as ResumoRpc : {}
}

function totalResumo(resumo: ResumoRpc) {
  return Number(resumo.documentos ?? 0)
    + Number(resumo.produtos ?? 0)
    + Number(resumo.cfops ?? 0)
    + Number(resumo.ncms ?? 0)
    + Number(resumo.participantes ?? 0)
}

function upsertProduto(mapa: Map<string, ProdutoResumo>, item: XmlLegacyItem, base: { orgId: string; empresaId: string; competencia: string; updatedAt: string }) {
  const tipo = item.tipo_operacao || 'outros'
  const descricao = item.descricao || ''
  const ncm = item.ncm || ''
  const chave = key(tipo, descricao, ncm)
  if (!mapa.has(chave)) {
    mapa.set(chave, {
      org_id: base.orgId,
      empresa_id: base.empresaId,
      competencia: base.competencia,
      tipo_movimento: tipo,
      descricao,
      ncm,
      valor_total: 0,
      quantidade: 0,
      count: 0,
      updated_at: base.updatedAt,
    })
  }
  const row = mapa.get(chave)!
  row.valor_total += item.valor_total
  row.quantidade += item.quantidade
  row.count += 1
}

function upsertCfop(mapa: Map<string, CfopResumo>, item: XmlLegacyItem, base: { orgId: string; empresaId: string; competencia: string; updatedAt: string }) {
  const cfop = item.cfop || 'sem-cfop'
  const chave = key(cfop)
  if (!mapa.has(chave)) {
    mapa.set(chave, {
      org_id: base.orgId,
      empresa_id: base.empresaId,
      competencia: base.competencia,
      cfop,
      tipo: tipoPorCfop(cfop),
      valor_total: 0,
      quantidade: 0,
      count: 0,
      updated_at: base.updatedAt,
    })
  }
  const row = mapa.get(chave)!
  row.valor_total += item.valor_total
  row.quantidade += item.quantidade
  row.count += 1
}

function upsertNcm(mapa: Map<string, NcmResumo>, item: XmlLegacyItem, base: { orgId: string; empresaId: string; competencia: string; updatedAt: string }) {
  const ncm = item.ncm || 'sem-ncm'
  if (!mapa.has(ncm)) {
    mapa.set(ncm, {
      org_id: base.orgId,
      empresa_id: base.empresaId,
      competencia: base.competencia,
      ncm,
      descricao_exemplo: item.descricao || '',
      valor_total: 0,
      quantidade: 0,
      count_produtos: 0,
      updated_at: base.updatedAt,
    })
  }
  const row = mapa.get(ncm)!
  row.valor_total += item.valor_total
  row.quantidade += item.quantidade
  row.count_produtos += 1
  if (!row.descricao_exemplo && item.descricao) row.descricao_exemplo = item.descricao
}

function upsertDocumento(mapa: Map<string, DocumentoResumo>, doc: XmlLegacyDocumento, base: { orgId: string; empresaId: string; competencia: string; updatedAt: string }) {
  const tipo = doc.tipo_operacao || 'outros'
  if (!mapa.has(tipo)) {
    mapa.set(tipo, {
      org_id: base.orgId,
      empresa_id: base.empresaId,
      competencia: base.competencia,
      tipo_movimento: tipo,
      valor_total: 0,
      count: 0,
      updated_at: base.updatedAt,
    })
  }
  const row = mapa.get(tipo)!
  row.valor_total += doc.valor_total_nota
  row.count += 1
}

function upsertParticipante(mapa: Map<string, ParticipanteResumo>, doc: XmlLegacyDocumento, base: { orgId: string; empresaId: string; competencia: string; updatedAt: string }) {
  const tipo = doc.tipo_operacao || 'outros'
  const cnpj = tipo === 'entrada' ? doc.emitente_cnpj : doc.destinatario_cnpj
  const nome = tipo === 'entrada' ? doc.emitente_nome : doc.destinatario_nome
  const cnpjLimpo = (cnpj ?? '').replace(/\D/g, '')
  if (!cnpjLimpo) return
  const chave = key(tipo, cnpjLimpo)
  if (!mapa.has(chave)) {
    mapa.set(chave, {
      org_id: base.orgId,
      empresa_id: base.empresaId,
      competencia: base.competencia,
      tipo_movimento: tipo,
      cnpj: cnpjLimpo,
      nome: nome || 'Nao identificado',
      valor_total: 0,
      count: 0,
      updated_at: base.updatedAt,
    })
  }
  const row = mapa.get(chave)!
  row.valor_total += doc.valor_total_nota
  row.count += 1
}

function upsertParticipanteSeguro(
  mapa: Map<string, ParticipanteResumo>,
  doc: XmlLegacyDocumento,
  base: { orgId: string; empresaId: string; competencia: string; updatedAt: string },
  cnpjEmpresa: string | null,
) {
  const emitente = (doc.emitente_cnpj ?? '').replace(/\D/g, '')
  const destinatario = (doc.destinatario_cnpj ?? '').replace(/\D/g, '')
  const propria = cnpjEmpresa?.replace(/\D/g, '') || ''

  if (propria && emitente === propria && destinatario && destinatario !== propria) {
    upsertParticipante(mapa, { ...doc, tipo_operacao: 'saida' }, base)
    return
  }

  if (propria && destinatario === propria && emitente && emitente !== propria) {
    upsertParticipante(mapa, { ...doc, tipo_operacao: 'entrada' }, base)
    return
  }

  upsertParticipante(mapa, doc, base)
}

async function limparResumosLegacy(admin: ReturnType<typeof createAdminClient>, empresaId: string, competencia: string) {
  await admin.from('rel_resumo_documentos_mensal').delete().eq('empresa_id', empresaId).eq('competencia', competencia)
  await admin.from('rel_resumo_produtos_mensal').delete().eq('empresa_id', empresaId).eq('competencia', competencia)
  await admin.from('rel_resumo_cfop_mensal').delete().eq('empresa_id', empresaId).eq('competencia', competencia)
  await admin.from('rel_resumo_ncm_mensal').delete().eq('empresa_id', empresaId).eq('competencia', competencia)
  await admin.from('rel_resumo_participantes_mensal').delete().eq('empresa_id', empresaId).eq('competencia', competencia)
}

type LinhaResumo = ProdutoResumo | DocumentoResumo | CfopResumo | NcmResumo | ParticipanteResumo

async function inserir(admin: ReturnType<typeof createAdminClient>, tabela: string, rows: LinhaResumo[]) {
  if (rows.length === 0) return
  const { error } = await admin.from(tabela).insert(rows)
  if (error) throw new Error(`${tabela}: ${error.message}`)
}

async function refreshLegacy(params: {
  empresaId: string
  orgId: string
  competencia: string
  cnpjEmpresa: string | null
}) {
  const admin = createAdminClient()
  const { empresaId, orgId, competencia, cnpjEmpresa } = params
  const updatedAt = new Date().toISOString()
  const base = { orgId, empresaId, competencia, updatedAt }

  const [itens, documentos] = await Promise.all([
    carregarXmlLegacy({ supabase: admin, empresaId, competenciaInicio: competencia, competenciaFim: competencia }),
    carregarXmlLegacyDocumentos({ supabase: admin, empresaId, competenciaInicio: competencia, competenciaFim: competencia }),
  ])

  const produtos = new Map<string, ProdutoResumo>()
  const cfops = new Map<string, CfopResumo>()
  const ncms = new Map<string, NcmResumo>()
  const docs = new Map<string, DocumentoResumo>()
  const participantes = new Map<string, ParticipanteResumo>()

  for (const item of itens) {
    upsertProduto(produtos, item, base)
    upsertCfop(cfops, item, base)
    upsertNcm(ncms, item, base)
  }

  for (const doc of documentos) {
    upsertDocumento(docs, doc, base)
    upsertParticipanteSeguro(participantes, doc, base, cnpjEmpresa)
  }

  await limparResumosLegacy(admin, empresaId, competencia)
  await inserir(admin, 'rel_resumo_documentos_mensal', Array.from(docs.values()))
  await inserir(admin, 'rel_resumo_produtos_mensal', Array.from(produtos.values()))
  await inserir(admin, 'rel_resumo_cfop_mensal', Array.from(cfops.values()))
  await inserir(admin, 'rel_resumo_ncm_mensal', Array.from(ncms.values()))
  await inserir(admin, 'rel_resumo_participantes_mensal', Array.from(participantes.values()))

  return {
    origem: 'fa_arquivos_xml',
    documentos: docs.size,
    produtos: produtos.size,
    cfops: cfops.size,
    ncms: ncms.size,
    participantes: participantes.size,
    itens_lidos: itens.length,
    documentos_lidos: documentos.length,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const body = await request.json() as { empresa_id?: string; competencia?: string }
  const empresaId = body.empresa_id
  const competencia = normalizarCompetencia(body.competencia)

  if (!empresaId || !competencia) {
    return NextResponse.json({ error: 'empresa_id e competencia sao obrigatorios' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const admin = createAdminClient()
  const { data: empresaRow, error: empresaError } = await admin
    .from('empresas')
    .select('cnpj')
    .eq('id', empresaId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (empresaError) return NextResponse.json({ error: empresaError.message }, { status: 500 })

  const { data, error } = await supabase.rpc('refresh_relatorios_mensais', {
    p_empresa_id: empresaId,
    p_competencia: competencia,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const resumoSql = toResumoRpc(data)
  if (totalResumo(resumoSql) > 0) {
    return NextResponse.json({ ok: true, competencia, resumo: { origem: 'fa_documentos_fiscais', ...resumoSql } })
  }

  const cnpjEmpresa = typeof empresaRow?.cnpj === 'string' ? empresaRow.cnpj : null
  const resumoLegacy = await refreshLegacy({ empresaId, orgId, competencia, cnpjEmpresa })

  return NextResponse.json({ ok: true, competencia, resumo: resumoLegacy })
}
