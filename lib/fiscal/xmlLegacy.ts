import type { SupabaseClient } from '@supabase/supabase-js'
import { competenciaNoPeriodo, normalizarCompetencia } from '@/lib/fiscal/competencia'

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
  quantidade: number
  valor_total: number
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
  descricao?: string
  ncm?: string
  cfop?: string
  cfop_entrada_sugerido?: string
  valor_contabil?: number
  quantidade?: number
  cancelada?: boolean
}

type LegacySaida = {
  descricao?: string
  ncm?: string
  cfop?: string
  valor_contabil?: number
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
  const { data, error } = await supabase
    .from('fa_arquivos_xml')
    .select('competencia, chave_nfe, numero_nf, data_emissao, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, tipo_operacao, valor_total, status, parsed_data')
    .eq('empresa_id', empresaId)
    .limit(100000)

  if (error) throw new Error(error.message)

  const items: XmlLegacyItem[] = []

  for (const row of (data ?? []) as XmlLegacyRow[]) {
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
        quantidade: quantidadeOuOcorrencia(item.quantidade),
        valor_total: item.valor_contabil ?? 0,
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
  const { data, error } = await supabase
    .from('fa_arquivos_xml')
    .select('competencia, chave_nfe, numero_nf, data_emissao, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, tipo_operacao, valor_total, status')
    .eq('empresa_id', empresaId)
    .limit(100000)

  if (error) throw new Error(error.message)

  const docs: XmlLegacyDocumento[] = []
  const vistos = new Set<string>()

  for (const row of (data ?? []) as XmlLegacyRow[]) {
    if (row.status === 'cancelada') continue
    const competencia = getCompetencia(row)
    if (!competenciaNoPeriodo(competencia, competenciaInicio, competenciaFim)) continue
    if (tipoMovimento && row.tipo_operacao !== tipoMovimento) continue

    const chave = row.chave_nfe || `${row.numero_nf ?? ''}-${row.tipo_operacao ?? ''}-${row.valor_total ?? 0}`
    if (vistos.has(chave)) continue
    vistos.add(chave)

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
    })
  }

  return docs
}
