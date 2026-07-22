import type { SupabaseClient } from '@supabase/supabase-js'
import { competenciaNoPeriodo, normalizarCompetencia } from '@/lib/fiscal/competencia'
import { fetchAll } from '@/lib/supabase/fetchAll'

export type XmlLegacyItem = {
  competencia: string | null
  tipo_operacao: 'entrada' | 'saida' | string | null
  chave_nfe?: string | null
  numero_nf?: string | null
  data_emissao?: string | null
  emitente_cnpj?: string | null
  emitente_nome?: string | null
  destinatario_cnpj?: string | null
  destinatario_nome?: string | null
  valor_total_nota: number
  descricao?: string
  ncm?: string
  cfop?: string
  cfop_fornecedor?: string
  quantidade: number
  valor_total: number
  codigo_produto?: string
  unidade?: string
  valor_unitario?: number
  valor_desconto?: number
  valor_frete?: number
  cst_icms?: string
  csosn?: string
  valor_bc_icms?: number
  aliquota_icms?: number
  valor_icms?: number
  valor_bc_st?: number
  valor_st?: number
  cst_pis?: string
  valor_pis?: number
  cst_cofins?: string
  valor_cofins?: number
  valor_ipi?: number
  cancelada: boolean
}

export type XmlLegacyDocumento = {
  competencia: string | null
  tipo_operacao: 'entrada' | 'saida' | string | null
  chave_nfe?: string | null
  numero_nf?: string | null
  data_emissao?: string | null
  emitente_cnpj?: string | null
  emitente_nome?: string | null
  destinatario_cnpj?: string | null
  destinatario_nome?: string | null
  valor_total_nota: number
  valor_produtos: number
  base_icms: number | null
  valor_icms: number | null
  valor_st: number | null
  valor_ipi: number | null
  valor_pis: number | null
  valor_cofins: number | null
  itens_count: number
}

type XmlLegacyRow = {
  competencia?: string | null
  chave_nfe?: string | null
  numero_nf?: string | null
  data_emissao?: string | null
  emitente_cnpj?: string | null
  emitente_nome?: string | null
  destinatario_cnpj?: string | null
  destinatario_nome?: string | null
  tipo_operacao?: string | null
  valor_total?: number | null
  status?: string | null
  parsed_data?: {
    itens_entrada?: LegacyEntrada[]
    itens_saida?: LegacySaida[]
  } | null
}

type LegacyEntrada = {
  codigo_produto?: string
  descricao?: string
  ncm?: string
  cfop?: string
  cfop_entrada_sugerido?: string
  valor_contabil?: number
  valor_produto?: number
  valor_desconto?: number
  valor_frete?: number
  cst_icms?: string
  csosn?: string
  base_icms?: number
  aliquota_icms?: number
  valor_icms?: number
  base_st?: number
  valor_st?: number
  cst_pis?: string
  valor_pis?: number
  cst_cofins?: string
  valor_cofins?: number
  valor_ipi?: number
  unidade?: string
  quantidade?: number
  cancelada?: boolean
}

type LegacySaida = {
  codigo_produto?: string
  descricao?: string
  ncm?: string
  cfop?: string
  valor_contabil?: number
  valor_produto?: number
  valor_desconto?: number
  valor_frete?: number
  cst_icms?: string
  csosn?: string
  base_icms?: number
  aliquota_icms?: number
  valor_icms?: number
  base_st?: number
  valor_st?: number
  cst_pis?: string
  valor_pis?: number
  cst_cofins?: string
  valor_cofins?: number
  valor_ipi?: number
  unidade?: string
  quantidade?: number
  cancelada?: boolean
}

function quantidadeOuOcorrencia(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1
}

function getCompetencia(row: XmlLegacyRow): string | null {
  const direta = normalizarCompetencia(row.competencia)
  if (direta) return direta
  if (!row.data_emissao) return null
  const data = new Date(row.data_emissao)
  if (Number.isNaN(data.getTime())) return null
  return `${String(data.getUTCMonth() + 1).padStart(2, '0')}/${data.getUTCFullYear()}`
}

export async function carregarXmlLegacy(params: {
  supabase: SupabaseClient
  empresaId: string
  competenciaInicio?: string | null
  competenciaFim?: string | null
  tipoMovimento?: string | null
}): Promise<XmlLegacyItem[]> {
  const { supabase, empresaId, competenciaInicio, competenciaFim, tipoMovimento } = params
  // fetchAll filtrado por data_emissao para reduzir o conjunto a ser paginado.
  // O filtro em memória (competenciaNoPeriodo) continua sendo aplicado logo abaixo.
  const rows = await fetchAll<XmlLegacyRow>((from, to) => {
    let q = supabase
      .from('fa_arquivos_xml')
      .select('competencia, chave_nfe, numero_nf, data_emissao, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, tipo_operacao, valor_total, status, parsed_data')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (competenciaInicio) q = q.gte('data_emissao', `${competenciaInicio}-01`)
    if (competenciaFim) {
      const [ano, mes] = competenciaFim.split('-').map(Number)
      const nextMes = mes === 12 ? 1 : mes + 1
      const nextAno = mes === 12 ? ano + 1 : ano
      q = q.lt('data_emissao', `${nextAno}-${String(nextMes).padStart(2, '0')}-01`)
    }
    return q as unknown as PromiseLike<{ data: XmlLegacyRow[] | null; error: unknown }>
  })

  const items: XmlLegacyItem[] = []
  const vistos = new Set<string>()

  for (const row of rows) {
    const chaveRegistro = row.chave_nfe || `${row.numero_nf ?? ''}-${row.tipo_operacao ?? ''}-${row.data_emissao ?? ''}-${row.valor_total ?? 0}`
    if (vistos.has(chaveRegistro)) continue
    vistos.add(chaveRegistro)
    if (row.status === 'cancelada') continue
    const competencia = getCompetencia(row)
    if (!competenciaNoPeriodo(competencia, competenciaInicio, competenciaFim)) continue
    if (tipoMovimento && row.tipo_operacao !== tipoMovimento) continue

    const base = {
      competencia,
      tipo_operacao: row.tipo_operacao ?? null,
      chave_nfe: row.chave_nfe ?? null,
      numero_nf: row.numero_nf ?? null,
      data_emissao: row.data_emissao ?? null,
      emitente_cnpj: row.emitente_cnpj ?? null,
      emitente_nome: row.emitente_nome ?? null,
      destinatario_cnpj: row.destinatario_cnpj ?? null,
      destinatario_nome: row.destinatario_nome ?? null,
      valor_total_nota: row.valor_total ?? 0,
    }

    const entradas = row.parsed_data?.itens_entrada ?? []
    const saidas = row.parsed_data?.itens_saida ?? []

    if (entradas.length === 0 && saidas.length === 0) {
      continue
    }

    for (const item of entradas) {
      items.push({
        ...base,
        tipo_operacao: 'entrada',
        descricao: item.descricao,
        ncm: item.ncm,
        cfop: item.cfop_entrada_sugerido || item.cfop,
        cfop_fornecedor: item.cfop,
        quantidade: quantidadeOuOcorrencia(item.quantidade),
        valor_total: item.valor_contabil ?? 0,
        codigo_produto: item.codigo_produto,
        unidade: item.unidade,
        valor_unitario: item.quantidade ? (item.valor_produto ?? item.valor_contabil ?? 0) / item.quantidade : item.valor_produto ?? item.valor_contabil,
        valor_desconto: item.valor_desconto,
        valor_frete: item.valor_frete,
        cst_icms: item.cst_icms,
        csosn: item.csosn,
        valor_bc_icms: item.base_icms,
        aliquota_icms: item.aliquota_icms,
        valor_icms: item.valor_icms,
        valor_bc_st: item.base_st,
        valor_st: item.valor_st,
        cst_pis: item.cst_pis,
        valor_pis: item.valor_pis,
        cst_cofins: item.cst_cofins,
        valor_cofins: item.valor_cofins,
        valor_ipi: item.valor_ipi,
        cancelada: item.cancelada ?? false,
      })
    }

    for (const item of saidas) {
      items.push({
        ...base,
        tipo_operacao: 'saida',
        descricao: item.descricao,
        ncm: item.ncm,
        cfop: item.cfop,
        quantidade: quantidadeOuOcorrencia(item.quantidade),
        valor_total: item.valor_contabil ?? 0,
        codigo_produto: item.codigo_produto,
        unidade: item.unidade,
        valor_unitario: item.quantidade ? (item.valor_produto ?? item.valor_contabil ?? 0) / item.quantidade : item.valor_produto ?? item.valor_contabil,
        valor_desconto: item.valor_desconto,
        valor_frete: item.valor_frete,
        cst_icms: item.cst_icms,
        csosn: item.csosn,
        valor_bc_icms: item.base_icms,
        aliquota_icms: item.aliquota_icms,
        valor_icms: item.valor_icms,
        valor_bc_st: item.base_st,
        valor_st: item.valor_st,
        cst_pis: item.cst_pis,
        valor_pis: item.valor_pis,
        cst_cofins: item.cst_cofins,
        valor_cofins: item.valor_cofins,
        valor_ipi: item.valor_ipi,
        cancelada: item.cancelada ?? false,
      })
    }
  }

  return items.filter(item => !item.cancelada)
}

export async function carregarXmlLegacyDocumentos(params: {
  supabase: SupabaseClient
  empresaId: string
  competenciaInicio?: string | null
  competenciaFim?: string | null
  tipoMovimento?: string | null
}): Promise<XmlLegacyDocumento[]> {
  const { supabase, empresaId, competenciaInicio, competenciaFim, tipoMovimento } = params
  // fetchAll filtrado por data_emissao para reduzir o conjunto a ser paginado.
  const rows = await fetchAll<XmlLegacyRow>((from, to) => {
    let q = supabase
      .from('fa_arquivos_xml')
      .select('competencia, chave_nfe, numero_nf, data_emissao, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, tipo_operacao, valor_total, status, parsed_data')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (competenciaInicio) q = q.gte('data_emissao', `${competenciaInicio}-01`)
    if (competenciaFim) {
      const [ano, mes] = competenciaFim.split('-').map(Number)
      const nextMes = mes === 12 ? 1 : mes + 1
      const nextAno = mes === 12 ? ano + 1 : ano
      q = q.lt('data_emissao', `${nextAno}-${String(nextMes).padStart(2, '0')}-01`)
    }
    return q as unknown as PromiseLike<{ data: XmlLegacyRow[] | null; error: unknown }>
  })

  const docs: XmlLegacyDocumento[] = []
  const vistos = new Set<string>()

  for (const row of rows) {
    const chave = row.chave_nfe || `${row.numero_nf ?? ''}-${row.tipo_operacao ?? ''}-${row.data_emissao ?? ''}-${row.valor_total ?? 0}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    if (row.status === 'cancelada') continue
    const competencia = getCompetencia(row)
    if (!competenciaNoPeriodo(competencia, competenciaInicio, competenciaFim)) continue
    if (tipoMovimento && row.tipo_operacao !== tipoMovimento) continue

    const itens = row.tipo_operacao === 'saida'
      ? row.parsed_data?.itens_saida ?? []
      : row.parsed_data?.itens_entrada ?? []
    type CampoNumericoLegado = 'valor_produto' | 'valor_contabil' | 'base_icms' | 'valor_icms' | 'valor_st' | 'valor_ipi' | 'valor_pis' | 'valor_cofins'
    const soma = (campo: CampoNumericoLegado): number | null => {
      if (itens.length === 0) return null
      const informados = itens.filter(item => item[campo] !== null && item[campo] !== undefined)
      if (informados.length === 0) return null
      return informados.reduce((total, item) => total + Number(item[campo] ?? 0), 0)
    }

    docs.push({
      competencia,
      tipo_operacao: row.tipo_operacao ?? null,
      chave_nfe: row.chave_nfe ?? null,
      numero_nf: row.numero_nf ?? null,
      data_emissao: row.data_emissao ?? null,
      emitente_cnpj: row.emitente_cnpj ?? null,
      emitente_nome: row.emitente_nome ?? null,
      destinatario_cnpj: row.destinatario_cnpj ?? null,
      destinatario_nome: row.destinatario_nome ?? null,
      valor_total_nota: row.valor_total ?? 0,
      valor_produtos: soma('valor_produto') ?? soma('valor_contabil') ?? 0,
      base_icms: soma('base_icms'),
      valor_icms: soma('valor_icms'),
      valor_st: soma('valor_st'),
      valor_ipi: soma('valor_ipi'),
      valor_pis: soma('valor_pis'),
      valor_cofins: soma('valor_cofins'),
      itens_count: itens.length,
    })
  }

  return docs
}
