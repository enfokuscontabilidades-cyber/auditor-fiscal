import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { competenciasEntre } from '@/lib/fiscal/competencia'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { carregarXmlLegacy, carregarXmlLegacyDocumentos, type XmlLegacyDocumento, type XmlLegacyItem } from '@/lib/fiscal/xmlLegacy'

type NivelRelatorio = 'documento' | 'produto'
type OrdemRelatorio = 'documento' | 'cfop' | 'participante' | 'estado' | 'dia' | 'aliquota' | 'produto' | 'ncm' | 'cst'

type DocumentoDetalhado = {
  id: string
  tipo_movimento: string
  numero: string | null
  serie: string | null
  modelo: string | null
  data_emissao: string | null
  data_competencia: string | null
  emitente_cnpj: string | null
  emitente_nome: string | null
  destinatario_cnpj: string | null
  destinatario_nome: string | null
  valor_total: number | null
  valor_produtos: number | null
  valor_desconto: number | null
  valor_frete: number | null
  valor_icms: number | null
  valor_pis: number | null
  valor_cofins: number | null
  valor_st: number | null
  valor_ipi: number | null
  status: string
}

type DocumentoJoin = {
  id: string
  tipo_movimento: string
  numero: string | null
  serie: string | null
  modelo: string | null
  data_emissao: string | null
  data_competencia: string | null
  emitente_cnpj: string | null
  emitente_nome: string | null
  destinatario_cnpj: string | null
  destinatario_nome: string | null
  status: string
}

type ProdutoDetalhado = {
  id: string
  documento_id: string
  item_numero: number | null
  codigo_produto: string | null
  descricao: string | null
  ncm: string | null
  cfop: string | null
  unidade: string | null
  quantidade: number | null
  valor_unitario: number | null
  valor_total: number | null
  valor_desconto: number | null
  valor_frete: number | null
  cst_icms: string | null
  csosn: string | null
  valor_bc_icms: number | null
  aliquota_icms: number | null
  valor_icms: number | null
  valor_bc_st: number | null
  valor_st: number | null
  cst_pis: string | null
  valor_pis: number | null
  cst_cofins: string | null
  valor_cofins: number | null
  valor_ipi: number | null
  tipo_movimento: string | null
  fa_documentos_fiscais: DocumentoJoin | DocumentoJoin[] | null
}

type LinhaResumo = {
  grupo: string
  grupo_label: string
  tipo_movimento?: string
  quantidade: number
  documentos: number
  valor_contabil: number
  valor_produtos: number
  valor_desconto: number
  valor_frete: number
  base_icms: number
  valor_icms: number
  valor_st: number
  valor_ipi: number
  valor_pis: number
  valor_cofins: number
}

function numero(value: number | null | undefined) {
  return Number(value ?? 0)
}

function texto(value: string | null | undefined, fallback = 'Nao informado') {
  const clean = value?.trim()
  return clean || fallback
}

function documentoRelacionado(value: ProdutoDetalhado['fa_documentos_fiscais']) {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function dataDia(value: string | null | undefined) {
  return value ? value.slice(0, 10) : 'sem-data'
}

function movimentoPorCfop(cfop: string | null | undefined): 'entrada' | 'saida' | null {
  const primeiro = cfop?.trim().charAt(0)
  if (!primeiro) return null
  if (['1', '2', '3'].includes(primeiro)) return 'entrada'
  if (['5', '6', '7'].includes(primeiro)) return 'saida'
  return null
}

function movimentoDocumento(doc: DocumentoDetalhado | DocumentoJoin): 'entrada' | 'saida' | null {
  if (doc.tipo_movimento === 'entrada' || doc.tipo_movimento === 'devolucao_venda') return 'entrada'
  if (doc.tipo_movimento === 'saida' || doc.tipo_movimento === 'devolucao_compra') return 'saida'
  return null
}

function movimentoProduto(item: ProdutoDetalhado): 'entrada' | 'saida' | null {
  const doc = documentoRelacionado(item.fa_documentos_fiscais)
  return movimentoPorCfop(item.cfop) ?? (doc ? movimentoDocumento(doc) : null)
}

function aplicarFiltroDocumentos(rows: DocumentoDetalhado[], tipoMovimento: string | null) {
  if (tipoMovimento !== 'entrada' && tipoMovimento !== 'saida') return rows
  return rows.filter(doc => movimentoDocumento(doc) === tipoMovimento)
}

function aplicarFiltroProdutos(rows: ProdutoDetalhado[], tipoMovimento: string | null) {
  if (tipoMovimento !== 'entrada' && tipoMovimento !== 'saida') return rows
  return rows.filter(item => movimentoProduto(item) === tipoMovimento)
}

function participanteDoc(doc: DocumentoDetalhado | DocumentoJoin) {
  if (doc.tipo_movimento === 'entrada') {
    return {
      cnpj: texto(doc.emitente_cnpj, ''),
      nome: texto(doc.emitente_nome),
    }
  }

  return {
    cnpj: texto(doc.destinatario_cnpj, ''),
    nome: texto(doc.destinatario_nome),
  }
}

function grupoDocumento(doc: DocumentoDetalhado, ordem: OrdemRelatorio) {
  const participante = participanteDoc(doc)
  if (ordem === 'participante') return { key: participante.cnpj || participante.nome, label: participante.nome }
  if (ordem === 'estado') return { key: 'sem-uf', label: 'Sem UF no documento' }
  if (ordem === 'dia') return { key: dataDia(doc.data_emissao), label: dataDia(doc.data_emissao) }
  if (ordem === 'documento') return { key: texto(doc.numero), label: `NF ${texto(doc.numero)}` }
  return { key: doc.tipo_movimento || 'outros', label: doc.tipo_movimento || 'Outros' }
}

function grupoProduto(item: ProdutoDetalhado, ordem: OrdemRelatorio) {
  const doc = documentoRelacionado(item.fa_documentos_fiscais)
  const participante = doc ? participanteDoc(doc) : { cnpj: '', nome: 'Nao informado' }

  if (ordem === 'produto') return { key: `${texto(item.codigo_produto, '')}|${texto(item.descricao)}|${texto(item.ncm, '')}`, label: texto(item.descricao) }
  if (ordem === 'ncm') return { key: texto(item.ncm, 'sem-ncm'), label: texto(item.ncm, 'Sem NCM') }
  if (ordem === 'cfop') return { key: texto(item.cfop, 'sem-cfop'), label: texto(item.cfop, 'Sem CFOP') }
  if (ordem === 'participante') return { key: participante.cnpj || participante.nome, label: participante.nome }
  if (ordem === 'dia') return { key: dataDia(doc?.data_emissao), label: dataDia(doc?.data_emissao) }
  if (ordem === 'aliquota') return { key: String(numero(item.aliquota_icms)), label: `${numero(item.aliquota_icms).toLocaleString('pt-BR')}%` }
  if (ordem === 'cst') return { key: texto(item.cst_icms ?? item.csosn, 'sem-cst'), label: texto(item.cst_icms ?? item.csosn, 'Sem CST/CSOSN') }
  if (ordem === 'documento') return { key: texto(doc?.numero), label: `NF ${texto(doc?.numero)}` }
  return { key: 'outros', label: 'Outros' }
}

function novaLinhaResumo(grupo: string, label: string, tipo?: string): LinhaResumo {
  return {
    grupo,
    grupo_label: label,
    tipo_movimento: tipo,
    quantidade: 0,
    documentos: 0,
    valor_contabil: 0,
    valor_produtos: 0,
    valor_desconto: 0,
    valor_frete: 0,
    base_icms: 0,
    valor_icms: 0,
    valor_st: 0,
    valor_ipi: 0,
    valor_pis: 0,
    valor_cofins: 0,
  }
}

function acumularDocumento(mapa: Map<string, LinhaResumo>, doc: DocumentoDetalhado, ordem: OrdemRelatorio) {
  const grupo = grupoDocumento(doc, ordem)
  const key = `${grupo.key}|${doc.tipo_movimento}`
  if (!mapa.has(key)) mapa.set(key, novaLinhaResumo(grupo.key, grupo.label, doc.tipo_movimento))
  const linha = mapa.get(key)!
  linha.quantidade += 1
  linha.documentos += 1
  linha.valor_contabil += numero(doc.valor_total)
  linha.valor_produtos += numero(doc.valor_produtos)
  linha.valor_desconto += numero(doc.valor_desconto)
  linha.valor_frete += numero(doc.valor_frete)
  linha.valor_icms += numero(doc.valor_icms)
  linha.valor_st += numero(doc.valor_st)
  linha.valor_ipi += numero(doc.valor_ipi)
  linha.valor_pis += numero(doc.valor_pis)
  linha.valor_cofins += numero(doc.valor_cofins)
}

function acumularProduto(mapa: Map<string, LinhaResumo>, item: ProdutoDetalhado, ordem: OrdemRelatorio) {
  const doc = documentoRelacionado(item.fa_documentos_fiscais)
  const tipo = movimentoProduto(item) || item.tipo_movimento || doc?.tipo_movimento || 'outros'
  const grupo = grupoProduto(item, ordem)
  const key = `${grupo.key}|${tipo}`
  if (!mapa.has(key)) mapa.set(key, novaLinhaResumo(grupo.key, grupo.label, tipo))
  const linha = mapa.get(key)!
  linha.quantidade += numero(item.quantidade) || 1
  linha.documentos += doc?.id ? 1 : 0
  linha.valor_contabil += numero(item.valor_total)
  linha.valor_produtos += numero(item.valor_total)
  linha.valor_desconto += numero(item.valor_desconto)
  linha.valor_frete += numero(item.valor_frete)
  linha.base_icms += numero(item.valor_bc_icms)
  linha.valor_icms += numero(item.valor_icms)
  linha.valor_st += numero(item.valor_st)
  linha.valor_ipi += numero(item.valor_ipi)
  linha.valor_pis += numero(item.valor_pis)
  linha.valor_cofins += numero(item.valor_cofins)
}

function ordenarResumo(rows: LinhaResumo[], ordem: OrdemRelatorio) {
  if (ordem === 'cfop') {
    return rows.sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR', { numeric: true }))
  }

  return rows.sort((a, b) => b.valor_contabil - a.valor_contabil)
}

function totalizadores(rows: Array<LinhaResumo | DocumentoDetalhado | ProdutoDetalhado>) {
  return rows.reduce((acc, row) => {
    if ('valor_contabil' in row) {
      acc.valor_contabil += row.valor_contabil
      acc.base_icms += row.base_icms
      acc.valor_icms += row.valor_icms
      acc.valor_st += row.valor_st
      acc.valor_ipi += row.valor_ipi
      acc.valor_pis += row.valor_pis
      acc.valor_cofins += row.valor_cofins
      return acc
    }

    if ('valor_bc_icms' in row) {
      acc.valor_contabil += numero(row.valor_total)
      acc.base_icms += numero(row.valor_bc_icms)
      acc.valor_icms += numero(row.valor_icms)
      acc.valor_st += numero(row.valor_st)
      acc.valor_ipi += numero(row.valor_ipi)
      acc.valor_pis += numero(row.valor_pis)
      acc.valor_cofins += numero(row.valor_cofins)
      return acc
    }

    acc.valor_contabil += numero(row.valor_total)
    acc.valor_icms += numero(row.valor_icms)
    acc.valor_st += numero(row.valor_st)
    acc.valor_ipi += numero(row.valor_ipi)
    acc.valor_pis += numero(row.valor_pis)
    acc.valor_cofins += numero(row.valor_cofins)
    return acc
  }, {
    valor_contabil: 0,
    base_icms: 0,
    valor_icms: 0,
    valor_st: 0,
    valor_ipi: 0,
    valor_pis: 0,
    valor_cofins: 0,
  })
}

function legacyDocToDocumento(item: XmlLegacyDocumento, index: number): DocumentoDetalhado {
  return {
    id: `legacy-doc-${item.chave_nfe || item.numero_nf || index}`,
    tipo_movimento: item.tipo_operacao || 'outros',
    numero: item.numero_nf ?? null,
    serie: null,
    modelo: '55',
    data_emissao: item.data_emissao ?? null,
    data_competencia: item.competencia,
    emitente_cnpj: item.emitente_cnpj ?? null,
    emitente_nome: item.emitente_nome ?? null,
    destinatario_cnpj: item.destinatario_cnpj ?? null,
    destinatario_nome: item.destinatario_nome ?? null,
    valor_total: item.valor_total_nota,
    valor_produtos: item.valor_total_nota,
    valor_desconto: 0,
    valor_frete: 0,
    valor_icms: 0,
    valor_pis: 0,
    valor_cofins: 0,
    valor_st: 0,
    valor_ipi: 0,
    status: 'ok',
  }
}

function legacyItemToProduto(item: XmlLegacyItem, index: number): ProdutoDetalhado {
  const doc: DocumentoJoin = {
    id: `legacy-doc-${item.chave_nfe || item.numero_nf || index}`,
    tipo_movimento: item.tipo_operacao || 'outros',
    numero: item.numero_nf ?? null,
    serie: null,
    modelo: '55',
    data_emissao: item.data_emissao ?? null,
    data_competencia: item.competencia,
    emitente_cnpj: item.emitente_cnpj ?? null,
    emitente_nome: item.emitente_nome ?? null,
    destinatario_cnpj: item.destinatario_cnpj ?? null,
    destinatario_nome: item.destinatario_nome ?? null,
    status: 'ok',
  }

  return {
    id: `legacy-item-${item.chave_nfe || item.numero_nf || 'sem-doc'}-${index}`,
    documento_id: doc.id,
    item_numero: index + 1,
    codigo_produto: null,
    descricao: item.descricao ?? null,
    ncm: item.ncm ?? null,
    cfop: item.cfop ?? null,
    unidade: null,
    quantidade: item.quantidade,
    valor_unitario: item.quantidade > 0 ? item.valor_total / item.quantidade : item.valor_total,
    valor_total: item.valor_total,
    valor_desconto: 0,
    valor_frete: 0,
    cst_icms: null,
    csosn: null,
    valor_bc_icms: 0,
    aliquota_icms: 0,
    valor_icms: 0,
    valor_bc_st: 0,
    valor_st: 0,
    cst_pis: null,
    valor_pis: 0,
    cst_cofins: null,
    valor_cofins: 0,
    valor_ipi: 0,
    tipo_movimento: item.tipo_operacao,
    fa_documentos_fiscais: doc,
  }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresa_id')
  const competenciaInicio = url.searchParams.get('competencia_inicio')
  const competenciaFim = url.searchParams.get('competencia_fim')
  const competenciasFiltro = competenciasEntre(competenciaInicio, competenciaFim)
  const tipoMovimento = url.searchParams.get('tipo_movimento')
  const nivel = (url.searchParams.get('nivel') || 'documento') as NivelRelatorio
  const ordem = (url.searchParams.get('ordem') || (nivel === 'produto' ? 'produto' : 'documento')) as OrdemRelatorio
  const resumido = url.searchParams.get('resumido') === 'true'
  const status = url.searchParams.get('status')
  const page = Math.max(parseInt(url.searchParams.get('page') ?? '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get('page_size') ?? '100', 10) || 100, 10), 500)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })
  if (competenciasFiltro.length === 0) {
    return NextResponse.json({ error: 'Informe uma competencia inicial ou final para carregar o relatorio.' }, { status: 400 })
  }
  if (!['documento', 'produto'].includes(nivel)) {
    return NextResponse.json({ error: 'nivel invalido' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const buildDocumentosQuery = (withCount = false, filtrarMovimento = true) => {
    let query = supabase
      .from('fa_documentos_fiscais')
      .select('id, tipo_movimento, numero, serie, modelo, data_emissao, data_competencia, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, valor_total, valor_produtos, valor_desconto, valor_frete, valor_icms, valor_pis, valor_cofins, valor_st, valor_ipi, status', withCount ? { count: 'exact' } : undefined)
      .eq('empresa_id', empresaId)
      .in('data_competencia', competenciasFiltro)

    if (filtrarMovimento && tipoMovimento) query = query.eq('tipo_movimento', tipoMovimento)
    if (status) query = query.eq('status', status)

    return query.order('data_emissao', { ascending: true }).order('numero', { ascending: true })
  }

  const carregarDocumentosEstruturados = async (filtrarMovimento = true) => {
    const docs = await fetchAll<DocumentoDetalhado>(async (inicio, fim) => {
      const { data, error } = await buildDocumentosQuery(false, filtrarMovimento).range(inicio, fim)
      return { data: data as DocumentoDetalhado[] | null, error }
    })
    return filtrarMovimento ? aplicarFiltroDocumentos(docs, tipoMovimento) : docs
  }

  const carregarProdutosEstruturados = async () => {
    const documentos = await carregarDocumentosEstruturados(false)
    if (documentos.length === 0) return []

    const docById = new Map(documentos.map(doc => [doc.id, doc]))
    const ids = documentos.map(doc => doc.id)
    const itens: ProdutoDetalhado[] = []

    for (let i = 0; i < ids.length; i += 500) {
      const loteIds = ids.slice(i, i + 500)
      const lote = await fetchAll<ProdutoDetalhado>(async (inicio, fim) => {
        const { data, error } = await supabase
          .from('fa_documentos_itens')
          .select('id, documento_id, item_numero, codigo_produto, descricao, ncm, cfop, unidade, quantidade, valor_unitario, valor_total, valor_desconto, valor_frete, cst_icms, csosn, valor_bc_icms, aliquota_icms, valor_icms, valor_bc_st, valor_st, cst_pis, valor_pis, cst_cofins, valor_cofins, valor_ipi, tipo_movimento')
          .eq('empresa_id', empresaId)
          .in('documento_id', loteIds)
          .order('created_at', { ascending: true })
          .range(inicio, fim)

        return { data: data as ProdutoDetalhado[] | null, error }
      })

      for (const item of lote) {
        itens.push({
          ...item,
          fa_documentos_fiscais: docById.get(item.documento_id) ?? null,
        })
      }
    }

    return aplicarFiltroProdutos(itens, tipoMovimento)
  }

  if (resumido) {
    if (nivel === 'documento') {
      if (ordem === 'cfop') {
        let itens = await carregarProdutosEstruturados()
        if (itens.length === 0) {
          const legacy = await carregarXmlLegacy({ supabase, empresaId, competenciaInicio, competenciaFim })
          itens = aplicarFiltroProdutos(legacy.map(legacyItemToProduto), tipoMovimento)
        }
        const mapa = new Map<string, LinhaResumo>()
        for (const item of itens) acumularProduto(mapa, item, 'cfop')
        const rows = ordenarResumo(Array.from(mapa.values()), ordem)
        return NextResponse.json({
          rows: rows.slice(from, to + 1),
          total: rows.length,
          page,
          page_size: pageSize,
          totalizadores: totalizadores(rows),
        })
      }

      let documentos = await carregarDocumentosEstruturados()
      if (documentos.length === 0) {
        const legacy = await carregarXmlLegacyDocumentos({ supabase, empresaId, competenciaInicio, competenciaFim, tipoMovimento })
        documentos = aplicarFiltroDocumentos(legacy.map(legacyDocToDocumento), tipoMovimento)
      }
      const mapa = new Map<string, LinhaResumo>()
      for (const doc of documentos) acumularDocumento(mapa, doc, ordem)
      const rows = ordenarResumo(Array.from(mapa.values()), ordem)
      return NextResponse.json({
        rows: rows.slice(from, to + 1),
        total: rows.length,
        page,
        page_size: pageSize,
        totalizadores: totalizadores(rows),
      })
    }

    let itens = await carregarProdutosEstruturados()
    if (itens.length === 0) {
      const legacy = await carregarXmlLegacy({ supabase, empresaId, competenciaInicio, competenciaFim })
      itens = aplicarFiltroProdutos(legacy.map(legacyItemToProduto), tipoMovimento)
    }
    const mapa = new Map<string, LinhaResumo>()
    for (const item of itens) acumularProduto(mapa, item, ordem)
    const rows = ordenarResumo(Array.from(mapa.values()), ordem)
    return NextResponse.json({
      rows: rows.slice(from, to + 1),
      total: rows.length,
      page,
      page_size: pageSize,
      totalizadores: totalizadores(rows),
    })
  }

  if (nivel === 'documento') {
    const { data, error, count } = await buildDocumentosQuery(true).range(from, to)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    let rows = aplicarFiltroDocumentos((data ?? []) as DocumentoDetalhado[], tipoMovimento)
    let total = count ?? rows.length
    if (rows.length === 0) {
      const legacy = await carregarXmlLegacyDocumentos({ supabase, empresaId, competenciaInicio, competenciaFim, tipoMovimento })
      const legacyRows = aplicarFiltroDocumentos(legacy.map(legacyDocToDocumento), tipoMovimento)
      rows = legacyRows.slice(from, to + 1)
      total = legacyRows.length
    } else if (tipoMovimento === 'entrada' || tipoMovimento === 'saida') {
      const todosFiltrados = aplicarFiltroDocumentos(await carregarDocumentosEstruturados(), tipoMovimento)
      rows = todosFiltrados.slice(from, to + 1)
      total = todosFiltrados.length
    }
    return NextResponse.json({
      rows,
      total,
      page,
      page_size: pageSize,
      totalizadores: totalizadores(rows),
    })
  }

  let produtos = await carregarProdutosEstruturados()
  if (produtos.length === 0) {
    const legacy = await carregarXmlLegacy({ supabase, empresaId, competenciaInicio, competenciaFim })
    produtos = aplicarFiltroProdutos(legacy.map(legacyItemToProduto), tipoMovimento)
  }
  const rows = produtos.slice(from, to + 1)
  return NextResponse.json({
    rows,
    total: produtos.length,
    page,
    page_size: pageSize,
    totalizadores: totalizadores(rows),
  })
}
