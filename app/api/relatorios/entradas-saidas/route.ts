import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { competenciasEntre } from '@/lib/fiscal/competencia'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { carregarXmlLegacy, carregarXmlLegacyDocumentos, type XmlLegacyDocumento, type XmlLegacyItem } from '@/lib/fiscal/xmlLegacy'
import {
  agruparItensPorDocumento,
  consolidarDocumentoFiscal,
  type SituacaoTributo,
} from '@/lib/relatorios/consolidacaoFiscal'

type NivelRelatorio = 'documento' | 'produto'
type OrdemRelatorio = 'documento' | 'cfop' | 'participante' | 'estado' | 'dia' | 'aliquota' | 'produto' | 'ncm' | 'cst'
type CampoOrdenacao = 'data_emissao' | 'numero' | 'participante' | 'valor_total' | 'valor_icms'
type SituacaoIss = 'retido' | 'devido' | 'zero' | 'nao_informado' | 'nao_aplicavel'

type DocumentoDetalhado = {
  id: string
  tipo_documento: string | null
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
  chave_acesso: string | null
  origem: string | null
  valor_total: number | null
  valor_produtos: number | null
  valor_servicos: number | null
  valor_desconto: number | null
  valor_frete: number | null
  valor_seguro: number | null
  valor_outras_despesas: number | null
  valor_icms: number | null
  valor_pis: number | null
  valor_cofins: number | null
  valor_st: number | null
  valor_ipi: number | null
  status: string
  parsed_data?: unknown
  base_icms?: number | null
  base_st?: number | null
  valor_icms_cabecalho?: number | null
  valor_icms_itens?: number | null
  situacao_icms?: SituacaoTributo
  fonte_icms?: 'cabecalho' | 'itens' | null
  itens_count?: number
  soma_produtos_itens?: number | null
  diferenca_produtos?: number | null
  tem_divergencia?: boolean
  dados_incompletos?: boolean
  divergencias?: string[]
  discriminacao_servico?: string | null
  codigo_servico?: string | null
  codigo_tributacao_municipio?: string | null
  municipio_codigo?: string | null
  codigo_verificacao?: string | null
  base_iss?: number | null
  aliquota_iss?: number | null
  valor_iss?: number | null
  valor_iss_retido?: number | null
  iss_retido?: boolean
  situacao_iss?: SituacaoIss
}

type DocumentoJoin = {
  id: string
  tipo_documento: string | null
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
  chave_acesso: string | null
  origem: string | null
  status: string
  base_iss?: number | null
  valor_iss?: number | null
  valor_iss_retido?: number | null
}

type ProdutoDetalhado = {
  id: string
  documento_id: string
  item_numero: number | null
  codigo_produto: string | null
  descricao: string | null
  ncm: string | null
  cest: string | null
  cfop: string | null
  cfop_fornecedor?: string | null
  unidade: string | null
  quantidade: number | null
  valor_unitario: number | null
  valor_total: number | null
  valor_desconto: number | null
  valor_frete: number | null
  valor_seguro?: number | null
  valor_outras_despesas?: number | null
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
  cst_ipi?: string | null
  valor_bc_ipi?: number | null
  aliquota_ipi?: number | null
  tipo_movimento: string | null
  fa_documentos_fiscais: DocumentoJoin | DocumentoJoin[] | null
}

type LinhaResumo = {
  competencia?: string | null
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
  valor_servicos: number
  base_iss: number
  valor_iss: number
  valor_iss_retido: number
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

function registro(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function numeroOpcional(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const convertido = Number(value)
  return Number.isFinite(convertido) ? convertido : null
}

function textoOpcional(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function dadosNfse(parsedData: unknown, valorServicosCabecalho: number | null | undefined) {
  const raiz = registro(parsedData)
  const metadados = registro(raiz?.metadados)
  if (!metadados) {
    return {
      discriminacao_servico: null,
      codigo_servico: null,
      codigo_tributacao_municipio: null,
      municipio_codigo: null,
      codigo_verificacao: null,
      base_iss: null,
      aliquota_iss: null,
      valor_iss: null,
      valor_iss_retido: null,
      iss_retido: false,
      situacao_iss: 'nao_informado' as SituacaoIss,
    }
  }

  const valorServicos = numeroOpcional(metadados.valor_servicos) ?? numero(valorServicosCabecalho)
  const deducoes = numeroOpcional(metadados.valor_deducoes) ?? 0
  const desconto = numeroOpcional(metadados.desconto_incondicionado) ?? 0
  const baseInformada = numeroOpcional(metadados.base_calculo_iss)
  const baseIss = baseInformada !== null && baseInformada > 0
    ? baseInformada
    : Math.max(0, valorServicos - deducoes - desconto)
  const valorIss = numeroOpcional(metadados.valor_iss) ?? 0
  const issRetido = metadados.iss_retido === true
  const valorIssRetido = issRetido
    ? numeroOpcional(metadados.valor_iss_retido) ?? valorIss
    : 0
  const aliquotaInformada = numeroOpcional(metadados.aliquota_iss)
  const aliquotaIss = aliquotaInformada !== null && aliquotaInformada > 0
    ? (aliquotaInformada <= 1 ? aliquotaInformada * 100 : aliquotaInformada)
    : baseIss > 0 && valorIss > 0
      ? Math.round((valorIss / baseIss) * 1000000) / 10000
      : 0

  return {
    discriminacao_servico: textoOpcional(metadados.discriminacao),
    codigo_servico: textoOpcional(metadados.item_lista_servico),
    codigo_tributacao_municipio: textoOpcional(metadados.codigo_tributacao_municipio),
    municipio_codigo: textoOpcional(metadados.municipio_codigo),
    codigo_verificacao: textoOpcional(metadados.codigo_verificacao),
    base_iss: baseIss,
    aliquota_iss: aliquotaIss,
    valor_iss: valorIss,
    valor_iss_retido: valorIssRetido,
    iss_retido: issRetido,
    situacao_iss: issRetido ? 'retido' as const : valorIss > 0 ? 'devido' as const : 'zero' as const,
  }
}

function enriquecerDocumentoServico(documento: DocumentoDetalhado): DocumentoDetalhado {
  if (documento.tipo_documento !== 'nfse') return documento
  return {
    ...documento,
    ...dadosNfse(documento.parsed_data, documento.valor_servicos),
  }
}

function chaveDocumentoRelatorio(doc: {
  chave_acesso?: string | null
  numero?: string | null
  data_emissao?: string | null
  tipo_movimento?: string | null
}) {
  return doc.chave_acesso || `${doc.tipo_movimento ?? ''}|${doc.numero ?? ''}|${doc.data_emissao ?? ''}`
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
  if (ordem === 'documento') return { key: texto(doc.numero), label: `${doc.tipo_documento === 'nfse' ? 'NFS-e' : 'NF'} ${texto(doc.numero)}` }
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

function novaLinhaResumo(grupo: string, label: string, tipo?: string, competencia?: string | null): LinhaResumo {
  return {
    competencia,
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
    valor_servicos: 0,
    base_iss: 0,
    valor_iss: 0,
    valor_iss_retido: 0,
  }
}

function acumularDocumento(mapa: Map<string, LinhaResumo>, doc: DocumentoDetalhado, ordem: OrdemRelatorio, separarCompetencia: boolean) {
  const grupo = grupoDocumento(doc, ordem)
  const competencia = separarCompetencia ? doc.data_competencia : null
  const key = `${competencia ?? ''}|${grupo.key}|${doc.tipo_movimento}`
  if (!mapa.has(key)) mapa.set(key, novaLinhaResumo(grupo.key, grupo.label, doc.tipo_movimento, competencia))
  const linha = mapa.get(key)!
  linha.quantidade += 1
  linha.documentos += 1
  linha.valor_contabil += numero(doc.valor_total)
  linha.valor_produtos += numero(doc.valor_produtos)
  linha.valor_desconto += numero(doc.valor_desconto)
  linha.valor_frete += numero(doc.valor_frete)
  linha.base_icms += numero(doc.base_icms)
  linha.valor_icms += numero(doc.valor_icms)
  linha.valor_st += numero(doc.valor_st)
  linha.valor_ipi += numero(doc.valor_ipi)
  linha.valor_pis += numero(doc.valor_pis)
  linha.valor_cofins += numero(doc.valor_cofins)
  linha.valor_servicos += numero(doc.valor_servicos)
  linha.base_iss += numero(doc.base_iss)
  linha.valor_iss += numero(doc.valor_iss)
  linha.valor_iss_retido += numero(doc.valor_iss_retido)
}

function acumularProduto(
  mapa: Map<string, LinhaResumo>,
  item: ProdutoDetalhado,
  ordem: OrdemRelatorio,
  separarCompetencia: boolean,
  documentosPorGrupo?: Map<string, Set<string>>,
) {
  const doc = documentoRelacionado(item.fa_documentos_fiscais)
  const tipo = movimentoProduto(item) || item.tipo_movimento || doc?.tipo_movimento || 'outros'
  const grupo = grupoProduto(item, ordem)
  const competencia = separarCompetencia ? doc?.data_competencia ?? null : null
  const key = `${competencia ?? ''}|${grupo.key}|${tipo}`
  if (!mapa.has(key)) mapa.set(key, novaLinhaResumo(grupo.key, grupo.label, tipo, competencia))
  const linha = mapa.get(key)!
  linha.quantidade += numero(item.quantidade) || 1
  if (documentosPorGrupo) {
    const documentos = documentosPorGrupo.get(key) ?? new Set<string>()
    documentos.add(doc?.id ?? item.documento_id)
    documentosPorGrupo.set(key, documentos)
    linha.documentos = documentos.size
  }
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
  if (doc?.tipo_documento === 'nfse') {
    linha.valor_servicos += numero(item.valor_total)
    linha.base_iss += numero(doc.base_iss)
    linha.valor_iss += numero(doc.valor_iss)
    linha.valor_iss_retido += numero(doc.valor_iss_retido)
  }
}

function ordenarResumo(rows: LinhaResumo[], ordem: OrdemRelatorio) {
  const porCompetencia = (a: LinhaResumo, b: LinhaResumo) => (a.competencia ?? '').localeCompare(b.competencia ?? '')
  if (ordem === 'cfop') {
    return rows.sort((a, b) => porCompetencia(a, b) || a.grupo.localeCompare(b.grupo, 'pt-BR', { numeric: true }))
  }

  return rows.sort((a, b) => porCompetencia(a, b) || b.valor_contabil - a.valor_contabil)
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
      acc.valor_servicos += row.valor_servicos
      acc.base_iss += row.base_iss
      acc.valor_iss += row.valor_iss
      acc.valor_iss_retido += row.valor_iss_retido
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
      const doc = documentoRelacionado(row.fa_documentos_fiscais)
      if (doc?.tipo_documento === 'nfse') {
        acc.valor_servicos += numero(row.valor_total)
        acc.base_iss += numero((doc as DocumentoDetalhado).base_iss)
        acc.valor_iss += numero((doc as DocumentoDetalhado).valor_iss)
        acc.valor_iss_retido += numero((doc as DocumentoDetalhado).valor_iss_retido)
      }
      return acc
    }

    acc.valor_contabil += numero(row.valor_total)
    acc.valor_icms += numero(row.valor_icms)
    acc.valor_st += numero(row.valor_st)
    acc.valor_ipi += numero(row.valor_ipi)
    acc.valor_pis += numero(row.valor_pis)
    acc.valor_cofins += numero(row.valor_cofins)
    acc.valor_servicos += numero(row.valor_servicos)
    acc.base_iss += numero(row.base_iss)
    acc.valor_iss += numero(row.valor_iss)
    acc.valor_iss_retido += numero(row.valor_iss_retido)
    return acc
  }, {
    valor_contabil: 0,
    base_icms: 0,
    valor_icms: 0,
    valor_st: 0,
    valor_ipi: 0,
    valor_pis: 0,
    valor_cofins: 0,
    valor_servicos: 0,
    base_iss: 0,
    valor_iss: 0,
    valor_iss_retido: 0,
  })
}

function legacyDocToDocumento(item: XmlLegacyDocumento, index: number): DocumentoDetalhado {
  return {
    id: `legacy-doc-${item.chave_nfe || item.numero_nf || index}`,
    tipo_documento: 'nfe',
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
    chave_acesso: item.chave_nfe ?? null,
    origem: 'xml_nfe',
    valor_total: item.valor_total_nota,
    valor_produtos: item.valor_produtos,
    valor_servicos: 0,
    valor_desconto: 0,
    valor_frete: 0,
    valor_seguro: 0,
    valor_outras_despesas: 0,
    valor_icms: item.valor_icms,
    valor_pis: item.valor_pis,
    valor_cofins: item.valor_cofins,
    valor_st: item.valor_st,
    valor_ipi: item.valor_ipi,
    status: 'ok',
    base_icms: item.base_icms,
    base_st: null,
    valor_icms_cabecalho: null,
    valor_icms_itens: item.valor_icms,
    situacao_icms: item.valor_icms === null ? 'nao_informado' : item.valor_icms === 0 ? 'zero' : 'itens',
    fonte_icms: item.valor_icms === null ? null : 'itens',
    itens_count: item.itens_count,
    soma_produtos_itens: item.valor_produtos,
    diferenca_produtos: 0,
    tem_divergencia: false,
    dados_incompletos: item.itens_count === 0 || item.valor_icms === null,
    divergencias: item.itens_count === 0 ? ['Documento legado sem itens no parsed_data.'] : [],
  }
}

function legacyItemToProduto(item: XmlLegacyItem, index: number): ProdutoDetalhado {
  const doc: DocumentoJoin = {
    id: `legacy-doc-${item.chave_nfe || item.numero_nf || index}`,
    tipo_documento: 'nfe',
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
    chave_acesso: item.chave_nfe ?? null,
    origem: 'xml_nfe',
    status: 'ok',
  }

  return {
    id: `legacy-item-${item.chave_nfe || item.numero_nf || 'sem-doc'}-${index}`,
    documento_id: doc.id,
    item_numero: index + 1,
    codigo_produto: item.codigo_produto ?? null,
    descricao: item.descricao ?? null,
    ncm: item.ncm ?? null,
    cest: null,
    cfop: item.cfop ?? null,
    cfop_fornecedor: item.cfop_fornecedor ?? null,
    unidade: item.unidade ?? null,
    quantidade: item.quantidade,
    valor_unitario: item.valor_unitario ?? (item.quantidade > 0 ? item.valor_total / item.quantidade : item.valor_total),
    valor_total: item.valor_total,
    valor_desconto: item.valor_desconto ?? 0,
    valor_frete: item.valor_frete ?? 0,
    cst_icms: item.cst_icms ?? null,
    csosn: item.csosn ?? null,
    valor_bc_icms: item.valor_bc_icms ?? null,
    aliquota_icms: item.aliquota_icms ?? null,
    valor_icms: item.valor_icms ?? null,
    valor_bc_st: item.valor_bc_st ?? null,
    valor_st: item.valor_st ?? null,
    cst_pis: item.cst_pis ?? null,
    valor_pis: item.valor_pis ?? null,
    cst_cofins: item.cst_cofins ?? null,
    valor_cofins: item.valor_cofins ?? null,
    valor_ipi: item.valor_ipi ?? null,
    tipo_movimento: item.tipo_operacao,
    fa_documentos_fiscais: doc,
  }
}

async function carregarRelatorio(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresa_id')
  const competenciaInicio = url.searchParams.get('competencia_inicio')
  const competenciaFim = url.searchParams.get('competencia_fim')
  const competenciasFiltro = competenciasEntre(competenciaInicio, competenciaFim)
  const tipoMovimento = url.searchParams.get('tipo_movimento')
  const ncmFiltro = url.searchParams.get('ncm') ?? ''
  const cfopFiltro = url.searchParams.get('cfop') ?? ''
  const participanteFiltro = url.searchParams.get('participante') ?? ''
  const notaFiltro = url.searchParams.get('nota') ?? ''
  const nivel = (url.searchParams.get('nivel') || 'documento') as NivelRelatorio
  const ordem = (url.searchParams.get('ordem') || (nivel === 'produto' ? 'produto' : 'documento')) as OrdemRelatorio
  const resumido = url.searchParams.get('resumido') === 'true'
  const status = url.searchParams.get('status')
  const icmsFiltro = url.searchParams.get('icms')
  const ordenarPor = (url.searchParams.get('ordenar_por') || 'data_emissao') as CampoOrdenacao
  const direcaoOrdenacao = url.searchParams.get('direcao') === 'desc' ? -1 : 1
  const page = Math.max(parseInt(url.searchParams.get('page') ?? '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get('page_size') ?? '100', 10) || 100, 10), 1000)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const separarCompetencia = competenciasFiltro.length > 1

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
      .select('id, tipo_documento, tipo_movimento, numero, serie, modelo, data_emissao, data_competencia, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, chave_acesso, origem, valor_total, valor_produtos, valor_servicos, valor_desconto, valor_frete, valor_seguro, valor_outras_despesas, valor_icms, valor_pis, valor_cofins, valor_st, valor_ipi, status, parsed_data', withCount ? { count: 'exact' } : undefined)
      .eq('empresa_id', empresaId)
      .in('data_competencia', competenciasFiltro)

    if (status === 'todos') {
      // Sem filtro de status.
    } else if (status) {
      query = query.eq('status', status)
    } else {
      query = query.neq('status', 'cancelada')
    }
    if (notaFiltro) query = query.or(`numero.ilike.%${notaFiltro}%,chave_acesso.ilike.%${notaFiltro}%`)
    if (participanteFiltro) query = query.or(`emitente_nome.ilike.%${participanteFiltro}%,emitente_cnpj.ilike.%${participanteFiltro}%,destinatario_nome.ilike.%${participanteFiltro}%,destinatario_cnpj.ilike.%${participanteFiltro}%`)

    return query.order('data_emissao', { ascending: true }).order('numero', { ascending: true })
  }

  const carregarDocumentosEstruturados = async (filtrarMovimento = true) => {
    const docs = await fetchAll<DocumentoDetalhado>(async (inicio, fim) => {
      const { data, error } = await buildDocumentosQuery(false, filtrarMovimento).range(inicio, fim)
      return { data: data as DocumentoDetalhado[] | null, error }
    })
    const enriquecidos = docs.map(enriquecerDocumentoServico)
    return filtrarMovimento ? aplicarFiltroDocumentos(enriquecidos, tipoMovimento) : enriquecidos
  }

  const carregarProdutosEstruturados = async (
    filtrarMovimento = true,
    documentosBase?: DocumentoDetalhado[],
  ) => {
    const documentos = documentosBase ?? await carregarDocumentosEstruturados(false)
    if (documentos.length === 0) return []

    const docById = new Map(documentos.map(doc => [doc.id, doc]))
    const ids = documentos.map(doc => doc.id)
    const itens: ProdutoDetalhado[] = []

    for (let i = 0; i < ids.length; i += 500) {
      const loteIds = ids.slice(i, i + 500)
      const lote = await fetchAll<ProdutoDetalhado>(async (inicio, fim) => {
        let q = supabase
          .from('fa_documentos_itens')
          .select('id, documento_id, item_numero, codigo_produto, descricao, ncm, cest, cfop, unidade, quantidade, valor_unitario, valor_total, valor_desconto, valor_frete, valor_seguro, valor_outras_despesas, cst_icms, csosn, valor_bc_icms, aliquota_icms, valor_icms, valor_bc_st, valor_st, cst_pis, valor_pis, cst_cofins, valor_cofins, cst_ipi, valor_bc_ipi, aliquota_ipi, valor_ipi, tipo_movimento')
          .eq('empresa_id', empresaId)
          .in('documento_id', loteIds)
          .order('created_at', { ascending: true })

        if (ncmFiltro) q = q.ilike('ncm', `%${ncmFiltro}%`)
        if (cfopFiltro) q = q.ilike('cfop', `%${cfopFiltro}%`)

        const { data, error } = await q.range(inicio, fim)
        return { data: data as ProdutoDetalhado[] | null, error }
      })

      for (const item of lote) {
        itens.push({
          ...item,
          fa_documentos_fiscais: docById.get(item.documento_id) ?? null,
        })
      }
    }

    return filtrarMovimento ? aplicarFiltroProdutos(itens, tipoMovimento) : itens
  }
  if (!['data_emissao', 'numero', 'participante', 'valor_total', 'valor_icms'].includes(ordenarPor)) {
    return NextResponse.json({ error: 'ordenar_por invalido' }, { status: 400 })
  }

  const consolidarDocumentos = async (documentos: DocumentoDetalhado[]) => {
    if (documentos.length === 0) return documentos
    const itens = await carregarProdutosEstruturados(false, documentos)
    const porDocumento = agruparItensPorDocumento(itens)
    const consolidados = documentos.map(documento => {
      const auditoria = consolidarDocumentoFiscal(documento, porDocumento.get(documento.id) ?? [])
      const servico = documento.tipo_documento === 'nfse'
        ? dadosNfse(documento.parsed_data, documento.valor_servicos)
        : null
      return {
        ...documento,
        ...(servico ?? {}),
        base_icms: documento.tipo_documento === 'nfse' ? null : auditoria.base_icms_itens,
        base_st: auditoria.base_st_itens,
        valor_icms_cabecalho: documento.valor_icms,
        valor_icms_itens: auditoria.tributos.icms.valor_itens,
        valor_icms: documento.tipo_documento === 'nfse' ? null : auditoria.tributos.icms.valor,
        valor_st: auditoria.tributos.st.valor,
        valor_ipi: auditoria.tributos.ipi.valor,
        valor_pis: auditoria.tributos.pis.valor,
        valor_cofins: auditoria.tributos.cofins.valor,
        situacao_icms: documento.tipo_documento === 'nfse' ? 'nao_aplicavel' as const : auditoria.tributos.icms.situacao,
        fonte_icms: documento.tipo_documento === 'nfse' ? null : auditoria.tributos.icms.fonte,
        itens_count: auditoria.itens,
        soma_produtos_itens: auditoria.soma_produtos_itens,
        diferenca_produtos: auditoria.diferenca_produtos,
        tem_divergencia: auditoria.tem_divergencia,
        dados_incompletos: auditoria.dados_incompletos,
        divergencias: auditoria.divergencias,
      }
    })
    return consolidados
  }

  const aplicarFiltroIcmsDocumentos = (documentos: DocumentoDetalhado[]) => {
    if (icmsFiltro === 'com_icms') return documentos.filter(doc => numero(doc.valor_icms) > 0)
    if (icmsFiltro === 'zero') return documentos.filter(doc => doc.situacao_icms === 'zero')
    if (icmsFiltro === 'nao_informado') return documentos.filter(doc => doc.situacao_icms === 'nao_informado')
    if (icmsFiltro === 'divergente') return documentos.filter(doc => doc.situacao_icms === 'divergente')
    return documentos
  }

  const ordenarDocumentos = (documentos: DocumentoDetalhado[]) => documentos.sort((a, b) => {
    if (ordenarPor === 'valor_total' || ordenarPor === 'valor_icms') {
      return (numero(a[ordenarPor]) - numero(b[ordenarPor])) * direcaoOrdenacao
    }
    const valorA = ordenarPor === 'participante' ? participanteDoc(a).nome : texto(a[ordenarPor], '')
    const valorB = ordenarPor === 'participante' ? participanteDoc(b).nome : texto(b[ordenarPor], '')
    return valorA.localeCompare(valorB, 'pt-BR', { numeric: true }) * direcaoOrdenacao
  })

  const mesclarDocumentosComLegado = (estruturados: DocumentoDetalhado[], legados: DocumentoDetalhado[]) => {
    const legadoPorChave = new Map(legados.map(doc => [chaveDocumentoRelatorio(doc), doc]))
    const chavesEstruturadas = new Set<string>()
    const mesclados = estruturados.map(doc => {
      const chave = chaveDocumentoRelatorio(doc)
      chavesEstruturadas.add(chave)
      const legado = legadoPorChave.get(chave)
      if (!legado) return doc
      const completarIcms = doc.situacao_icms === 'nao_informado' && legado.valor_icms !== null
      const completarItens = numero(doc.itens_count) === 0 && numero(legado.itens_count) > 0
      if (!completarIcms && !completarItens) return doc
      const itensFinais = completarItens ? numero(legado.itens_count) : numero(doc.itens_count)
      const situacaoIcmsFinal = completarIcms ? legado.situacao_icms : doc.situacao_icms
      return {
        ...doc,
        base_icms: doc.base_icms ?? legado.base_icms,
        valor_icms: completarIcms ? legado.valor_icms : doc.valor_icms,
        valor_icms_itens: completarIcms ? legado.valor_icms_itens : doc.valor_icms_itens,
        situacao_icms: completarIcms ? legado.situacao_icms : doc.situacao_icms,
        fonte_icms: completarIcms ? 'itens' as const : doc.fonte_icms,
        itens_count: completarItens ? legado.itens_count : doc.itens_count,
        soma_produtos_itens: completarItens ? legado.soma_produtos_itens : doc.soma_produtos_itens,
        diferenca_produtos: completarItens && doc.valor_produtos !== null && legado.soma_produtos_itens !== null
          ? Math.round((numero(doc.valor_produtos) - numero(legado.soma_produtos_itens)) * 100) / 100
          : doc.diferenca_produtos,
        valor_st: doc.valor_st ?? legado.valor_st,
        valor_ipi: doc.valor_ipi ?? legado.valor_ipi,
        valor_pis: doc.valor_pis ?? legado.valor_pis,
        valor_cofins: doc.valor_cofins ?? legado.valor_cofins,
        dados_incompletos: itensFinais === 0 || situacaoIcmsFinal === 'nao_informado',
        divergencias: [...(doc.divergencias ?? []), 'Dados tributarios complementados pelo parsed_data legado.'],
      }
    })
    for (const legado of legados) {
      if (!chavesEstruturadas.has(chaveDocumentoRelatorio(legado))) mesclados.push(legado)
    }
    return aplicarFiltroIcmsDocumentos(mesclados)
  }

  const carregarProdutosComLegado = async () => {
    const estruturados = await carregarProdutosEstruturados()
    if (status && !['todos', 'ok'].includes(status)) return estruturados
    const legacy = await carregarXmlLegacy({ supabase, empresaId, competenciaInicio, competenciaFim, tipoMovimento })
    let legados = aplicarFiltroProdutos(legacy.map(legacyItemToProduto), tipoMovimento)
    if (ncmFiltro) legados = legados.filter(item => item.ncm?.toLowerCase().includes(ncmFiltro.toLowerCase()))
    if (cfopFiltro) legados = legados.filter(item => item.cfop?.toLowerCase().includes(cfopFiltro.toLowerCase()))
    if (participanteFiltro) {
      const busca = participanteFiltro.toLowerCase()
      legados = legados.filter(item => {
        const doc = documentoRelacionado(item.fa_documentos_fiscais)
        return [doc?.emitente_nome, doc?.emitente_cnpj, doc?.destinatario_nome, doc?.destinatario_cnpj]
          .some(value => value?.toLowerCase().includes(busca))
      })
    }
    if (notaFiltro) {
      legados = legados.filter(item => {
        const doc = documentoRelacionado(item.fa_documentos_fiscais)
        return doc?.numero?.includes(notaFiltro) || doc?.chave_acesso?.includes(notaFiltro)
      })
    }

    const chavesComItensEstruturados = new Set(estruturados.map(item => {
      const doc = documentoRelacionado(item.fa_documentos_fiscais)
      return doc ? chaveDocumentoRelatorio(doc) : item.documento_id
    }))
    return [
      ...estruturados,
      ...legados.filter(item => {
        const doc = documentoRelacionado(item.fa_documentos_fiscais)
        return !chavesComItensEstruturados.has(doc ? chaveDocumentoRelatorio(doc) : item.documento_id)
      }),
    ]
  }

  if (resumido) {
    if (nivel === 'documento') {
      if (ordem === 'cfop') {
        const itens = (await carregarProdutosComLegado()).filter(item =>
          documentoRelacionado(item.fa_documentos_fiscais)?.tipo_documento !== 'nfse'
        )
        const mapa = new Map<string, LinhaResumo>()
        const documentosPorGrupo = new Map<string, Set<string>>()
        for (const item of itens) acumularProduto(mapa, item, 'cfop', separarCompetencia, documentosPorGrupo)
        const rows = ordenarResumo(Array.from(mapa.values()), ordem)
        return NextResponse.json({
          rows: rows.slice(from, to + 1),
          total: rows.length,
          page,
          page_size: pageSize,
          totalizadores: totalizadores(rows),
        })
      }

      const estruturados = await consolidarDocumentos(await carregarDocumentosEstruturados())
      let legados = status && !['todos', 'ok'].includes(status)
        ? []
        : aplicarFiltroDocumentos(
            (await carregarXmlLegacyDocumentos({ supabase, empresaId, competenciaInicio, competenciaFim, tipoMovimento })).map(legacyDocToDocumento),
            tipoMovimento,
          )
      if (participanteFiltro) {
        const busca = participanteFiltro.toLowerCase()
        legados = legados.filter(doc => {
          const participante = participanteDoc(doc)
          return participante.nome.toLowerCase().includes(busca) || participante.cnpj.includes(participanteFiltro)
        })
      }
      if (notaFiltro) {
        legados = legados.filter(doc => doc.numero?.includes(notaFiltro) || doc.chave_acesso?.includes(notaFiltro))
      }
      const documentos = mesclarDocumentosComLegado(estruturados, legados)
      const mapa = new Map<string, LinhaResumo>()
      for (const doc of documentos) acumularDocumento(mapa, doc, ordem, separarCompetencia)
      const rows = ordenarResumo(Array.from(mapa.values()), ordem)
      return NextResponse.json({
        rows: rows.slice(from, to + 1),
        total: rows.length,
        page,
        page_size: pageSize,
        totalizadores: totalizadores(rows),
      })
    }

    const itens = (await carregarProdutosComLegado()).filter(item =>
      ordem !== 'cfop' || documentoRelacionado(item.fa_documentos_fiscais)?.tipo_documento !== 'nfse'
    )
    const mapa = new Map<string, LinhaResumo>()
    const documentosPorGrupo = new Map<string, Set<string>>()
    for (const item of itens) acumularProduto(mapa, item, ordem, separarCompetencia, documentosPorGrupo)
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
    const estruturados = await consolidarDocumentos(await carregarDocumentosEstruturados())
    let legacyRows = status && !['todos', 'ok'].includes(status)
      ? []
      : aplicarFiltroDocumentos(
          (await carregarXmlLegacyDocumentos({ supabase, empresaId, competenciaInicio, competenciaFim, tipoMovimento })).map(legacyDocToDocumento),
          tipoMovimento,
        )
      if (participanteFiltro) {
        const q = participanteFiltro.toLowerCase()
        legacyRows = legacyRows.filter(d =>
          [d.emitente_nome, d.emitente_cnpj, d.destinatario_nome, d.destinatario_cnpj].some(v => v?.toLowerCase().includes(q))
        )
      }
      if (notaFiltro) {
        legacyRows = legacyRows.filter(d => d.numero?.includes(notaFiltro) || d.chave_acesso?.includes(notaFiltro))
      }
    const todos = ordenarDocumentos(mesclarDocumentosComLegado(estruturados, legacyRows))
    return NextResponse.json({
      rows: todos.slice(from, to + 1),
      total: todos.length,
      page,
      page_size: pageSize,
      totalizadores: totalizadores(todos),
      conciliacao: {
        documentos: todos.length,
        documentos_sem_itens: todos.filter(doc => doc.itens_count === 0).length,
        documentos_com_divergencia: todos.filter(doc => doc.tem_divergencia).length,
        documentos_com_dados_incompletos: todos.filter(doc => doc.dados_incompletos).length,
        icms_recuperado_dos_itens: todos.filter(doc => doc.situacao_icms === 'itens').length,
        icms_zero: todos.filter(doc => doc.situacao_icms === 'zero').length,
        icms_nao_informado: todos.filter(doc => doc.situacao_icms === 'nao_informado').length,
      },
    })
  }

  if (participanteFiltro || notaFiltro) {
    const todos = await carregarProdutosComLegado()
    const rows = todos.slice(from, to + 1)
    return NextResponse.json({
      rows,
      total: todos.length,
      page,
      page_size: pageSize,
      totalizadores: totalizadores(todos),
    })
  }

  const produtos = await carregarProdutosComLegado()
  return NextResponse.json({
    rows: produtos.slice(from, to + 1),
    total: produtos.length,
    page,
    page_size: pageSize,
    totalizadores: totalizadores(produtos),
  })
}

function detalhesErroRelatorio(error: unknown) {
  if (error instanceof Error) {
    return { message: error.message, name: error.name, stack: error.stack }
  }
  if (error && typeof error === 'object') {
    const registro = error as Record<string, unknown>
    return {
      message: typeof registro.message === 'string' ? registro.message : 'Falha na consulta do relatório.',
      code: typeof registro.code === 'string' ? registro.code : undefined,
      details: typeof registro.details === 'string' ? registro.details : undefined,
      hint: typeof registro.hint === 'string' ? registro.hint : undefined,
    }
  }
  return { message: typeof error === 'string' ? error : 'Falha desconhecida na consulta do relatório.' }
}

export async function GET(req: Request) {
  try {
    return await carregarRelatorio(req)
  } catch (error) {
    const detalhes = detalhesErroRelatorio(error)
    console.error('[relatorios/entradas-saidas]', JSON.stringify(detalhes))
    return NextResponse.json({
      error: detalhes.message,
      code: detalhes.code,
      details: detalhes.details,
    }, { status: 500 })
  }
}
