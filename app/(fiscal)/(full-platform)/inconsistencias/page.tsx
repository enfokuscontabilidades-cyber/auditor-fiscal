'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AlertaFiscal } from '@/lib/types'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import { ChevronDown, ChevronUp, Building2, TriangleAlert, Package, Users, BarChart3, Hash, Download, Receipt, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'
import PageHeader from '@/components/ui/PageHeader'
import GlassCard from '@/components/ui/GlassCard'
import EmptyState from '@/components/ui/EmptyState'
import PaginationControls, { getPageItems } from '@/components/ui/PaginationControls'
import { useNotifications } from '@/components/notifications/NotificationProvider'
import { DESC_CFOP } from '@/lib/fiscal/descCfop'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type AbaRelatorio = 'inconsistencias' | 'entradas_saidas' | 'documentos' | 'produtos' | 'participantes' | 'cfop' | 'ncm'

type DadoMensal = {
  competencia: string
  origem?: string
  total_entrada: number
  total_saida: number
  count_entrada: number
  count_saida: number
}

type TopProduto = { competencia?: string; tipo_movimento?: string; descricao: string; ncm: string; valor_total: number; quantidade: number; count: number }
type Participante = { cnpj: string; nome: string; valor_total: number; count: number; _cnpj_cache?: Record<string, unknown> }
type CfopItem = { cfop: string; tipo: string; valor_total: number; quantidade: number; count: number; participacao: number }
type NcmItem = { ncm: string; descricao_exemplo: string; valor_total: number; quantidade: number; participacao: number; count_produtos?: number }

type NivelFiscal = 'documento' | 'produto'
type OrdemFiscal = 'documento' | 'cfop' | 'participante' | 'estado' | 'dia' | 'aliquota' | 'produto' | 'ncm' | 'cst'

type RelatorioFiscalResumo = {
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

type RelatorioFiscalDocumento = {
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
  valor_icms: number | null
  valor_pis: number | null
  valor_cofins: number | null
  valor_st: number | null
  valor_ipi: number | null
  status: string
  base_icms?: number | null
  base_st?: number | null
  valor_icms_cabecalho?: number | null
  valor_icms_itens?: number | null
  situacao_icms?: 'cabecalho' | 'itens' | 'zero' | 'nao_informado' | 'nao_aplicavel' | 'divergente'
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
  situacao_iss?: 'retido' | 'devido' | 'zero' | 'nao_informado' | 'nao_aplicavel'
}

type RelatorioFiscalDocumentoJoin = Pick<
  RelatorioFiscalDocumento,
  'id' | 'tipo_documento' | 'tipo_movimento' | 'numero' | 'serie' | 'modelo' | 'data_emissao' | 'data_competencia' | 'emitente_cnpj' | 'emitente_nome' | 'destinatario_cnpj' | 'destinatario_nome' | 'chave_acesso' | 'origem' | 'status' | 'valor_servicos' | 'discriminacao_servico' | 'codigo_servico' | 'codigo_tributacao_municipio' | 'municipio_codigo' | 'codigo_verificacao' | 'base_iss' | 'aliquota_iss' | 'valor_iss' | 'valor_iss_retido' | 'iss_retido' | 'situacao_iss'
>

type RelatorioFiscalProduto = {
  id: string
  documento_id: string
  item_numero: number | null
  codigo_produto: string | null
  descricao: string | null
  ncm: string | null
  cfop: string | null
  cfop_fornecedor?: string | null
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
  fa_documentos_fiscais: RelatorioFiscalDocumentoJoin | RelatorioFiscalDocumentoJoin[] | null
}

type RelatorioFiscalLinha = RelatorioFiscalResumo | RelatorioFiscalDocumento | RelatorioFiscalProduto

type RelatorioFiscalResposta = {
  rows?: RelatorioFiscalLinha[]
  total?: number
  page?: number
  page_size?: number
  totalizadores?: {
    valor_contabil: number
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
  conciliacao?: {
    documentos: number
    documentos_sem_itens: number
    documentos_com_divergencia: number
    documentos_com_dados_incompletos: number
    icms_recuperado_dos_itens: number
    icms_zero: number
    icms_nao_informado: number
  }
  error?: string
}

function workbookToXlsxBlob(wb: XLSX.WorkBook) {
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

const ESTILO_CABECALHO_EXCEL = {
  font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11, name: 'Calibri' },
  fill: { fgColor: { rgb: 'FF0D3340' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: { bottom: { style: 'medium', color: { rgb: 'FF27C7D8' } } },
}

function estilizarTabelaExcel(ws: XLSX.WorkSheet, linhaCabecalho = 0) {
  if (!ws['!ref']) return
  const faixa = XLSX.utils.decode_range(ws['!ref'])
  for (let coluna = faixa.s.c; coluna <= faixa.e.c; coluna += 1) {
    const endereco = XLSX.utils.encode_cell({ r: linhaCabecalho, c: coluna })
    const celula = ws[endereco] as XLSX.CellObject | undefined
    if (celula) celula.s = ESTILO_CABECALHO_EXCEL
  }
  const amostraFim = Math.min(faixa.e.r, linhaCabecalho + 200)
  ws['!cols'] = Array.from({ length: faixa.e.c - faixa.s.c + 1 }, (_, indice) => {
    let largura = 12
    for (let linha = linhaCabecalho; linha <= amostraFim; linha += 1) {
      const celula = ws[XLSX.utils.encode_cell({ r: linha, c: faixa.s.c + indice })] as XLSX.CellObject | undefined
      largura = Math.max(largura, String(celula?.v ?? '').length + 2)
    }
    return { wch: Math.min(largura, 42) }
  })
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: linhaCabecalho, c: faixa.s.c }, e: faixa.e }) }
  ws['!rows'] = Array.from({ length: linhaCabecalho + 1 }, (_, indice) => ({ hpt: indice === linhaCabecalho ? 30 : 22 }))
}

function estilizarResumoExecutivo(ws: XLSX.WorkSheet) {
  ws['!cols'] = [{ wch: 38 }, { wch: 72 }]
  ws['!rows'] = [{ hpt: 28 }]
  const titulo = ws.A1 as XLSX.CellObject | undefined
  if (titulo) {
    titulo.s = { font: { bold: true, sz: 14, color: { rgb: 'FF1A6B7A' }, name: 'Calibri' } }
  }
  if (!ws['!ref']) return
  const faixa = XLSX.utils.decode_range(ws['!ref'])
  for (let linha = 1; linha <= faixa.e.r; linha += 1) {
    const rotulo = ws[XLSX.utils.encode_cell({ r: linha, c: 0 })] as XLSX.CellObject | undefined
    if (rotulo?.v && String(rotulo.v) !== 'Indicador') {
      rotulo.s = { font: { bold: true, color: { rgb: 'FF0D3340' }, name: 'Calibri' } }
    }
  }
  const linhaIndicadores = Array.from({ length: faixa.e.r + 1 }, (_, linha) => linha)
    .find(linha => (ws[XLSX.utils.encode_cell({ r: linha, c: 0 })] as XLSX.CellObject | undefined)?.v === 'Indicador')
  if (linhaIndicadores !== undefined) {
    for (let coluna = 0; coluna <= 1; coluna += 1) {
      const celula = ws[XLSX.utils.encode_cell({ r: linhaIndicadores, c: coluna })] as XLSX.CellObject | undefined
      if (celula) celula.s = ESTILO_CABECALHO_EXCEL
    }
  }
}

type RelatorioFiscalDocumentoJoinLocal = {
  id?: string; tipo_documento?: string | null; tipo_movimento?: string; numero?: string | null; serie?: string | null
  modelo?: string | null; data_emissao?: string | null; data_competencia?: string | null
  emitente_cnpj?: string | null; emitente_nome?: string | null
  destinatario_cnpj?: string | null; destinatario_nome?: string | null
  chave_acesso?: string | null; origem?: string | null; status?: string
  valor_servicos?: number | null; discriminacao_servico?: string | null; codigo_servico?: string | null
  codigo_tributacao_municipio?: string | null; municipio_codigo?: string | null; codigo_verificacao?: string | null
  base_iss?: number | null; aliquota_iss?: number | null; valor_iss?: number | null
  valor_iss_retido?: number | null; iss_retido?: boolean; situacao_iss?: string
}

type RelatorioFiscalProdutoLocal = {
  id: string; documento_id: string; item_numero?: number | null
  codigo_produto?: string | null; descricao?: string | null; ncm?: string | null
  cfop?: string | null; cfop_fornecedor?: string | null; unidade?: string | null; quantidade?: number | null
  valor_unitario?: number | null; valor_total?: number | null; valor_desconto?: number | null
  valor_frete?: number | null; cst_icms?: string | null; csosn?: string | null
  valor_bc_icms?: number | null; aliquota_icms?: number | null; valor_icms?: number | null
  valor_bc_st?: number | null; valor_st?: number | null; cst_pis?: string | null
  valor_pis?: number | null; cst_cofins?: string | null; valor_cofins?: number | null
  valor_ipi?: number | null; tipo_movimento?: string | null
  fa_documentos_fiscais?: RelatorioFiscalDocumentoJoinLocal | RelatorioFiscalDocumentoJoinLocal[] | null
}

function construirExcelFiscal(
  itens: RelatorioFiscalProdutoLocal[],
  aba: 'entradas_saidas' | 'produtos',
  tipoMov: string,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  const CC = 'FF0D3340', CB = 'FFFFFFFF'
  const h = (v: string): XLSX.CellObject => ({
    v, t: 's',
    s: { font: { bold: true, color: { rgb: CB }, sz: 11, name: 'Calibri' }, fill: { fgColor: { rgb: CC } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { bottom: { style: 'medium', color: { rgb: 'FF27C7D8' } } } }
  })
  const c = (v: unknown, b = false, z?: string): XLSX.CellObject => ({
    v: v as string | number, t: typeof v === 'number' ? 'n' : 's', z,
    s: { font: { bold: b, sz: 10, name: 'Calibri' }, alignment: { vertical: 'center' }, border: { bottom: { style: 'thin', color: { rgb: 'FFE0EAED' } }, right: { style: 'thin', color: { rgb: 'FFE0EAED' } } } }
  })
  const wr = (ws: XLSX.WorkSheet, rows: XLSX.CellObject[][]) =>
    rows.forEach((row, r) => row.forEach((cl, col) => { ws[XLSX.utils.encode_cell({ r, c: col })] = cl }))

  const getDoc = (item: RelatorioFiscalProdutoLocal): RelatorioFiscalDocumentoJoinLocal | null => {
    const d = item.fa_documentos_fiscais
    if (!d) return null
    return Array.isArray(d) ? (d[0] ?? null) : d
  }
  const movItem = (item: RelatorioFiscalProdutoLocal): 'entrada' | 'saida' => {
    const doc = getDoc(item)
    if (doc?.tipo_movimento === 'entrada' || doc?.tipo_movimento === 'devolucao_venda') return 'entrada'
    if (doc?.tipo_movimento === 'saida' || doc?.tipo_movimento === 'devolucao_compra') return 'saida'
    const first = item.cfop?.trim().charAt(0) ?? ''
    if (['1', '2', '3'].includes(first)) return 'entrada'
    return 'saida'
  }
  const cfopForn = (cfop: string | null | undefined): string => {
    if (!cfop) return '—'
    if (cfop.charAt(0) === '1') return '5' + cfop.slice(1)
    if (cfop.charAt(0) === '2') return '6' + cfop.slice(1)
    return cfop
  }
  const cfopEntradaEfet = (cfop: string | null | undefined): string => {
    if (!cfop) return '—'
    if (cfop.charAt(0) === '5') return '1' + cfop.slice(1)
    if (cfop.charAt(0) === '6') return '2' + cfop.slice(1)
    return cfop
  }
  const fData = (d?: string | null) => d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR') : '—'
  const origemLabel = (o?: string | null): string => {
    const m: Record<string, string> = { xml_nfe: 'XML NF-e', xml_nfce: 'XML NFC-e', sped_txt: 'SPED', manual: 'Manual', xml_nfse: 'XML NFS-e', outro: 'Outro' }
    return o ? (m[o] ?? o) : '—'
  }
  const tributoExcel = (valor: number | null | undefined) => valor === null || valor === undefined ? 'Não informado' : Number(valor)

  const ehNfseLocal = (doc: RelatorioFiscalDocumentoJoinLocal | null) =>
    doc?.tipo_documento === 'nfse' || doc?.origem === 'xml_nfse' || doc?.modelo === 'NFS-e'
  const servicos = itens.filter(item => ehNfseLocal(getDoc(item)))
  const mercadorias = itens.filter(item => !ehNfseLocal(getDoc(item)))
  const entradas = mercadorias.filter(i => movItem(i) === 'entrada')
  const saidas   = mercadorias.filter(i => movItem(i) === 'saida')

  if (aba === 'entradas_saidas') {
    // ── Notas Entradas ─────────────────────────────────────────────────────────
    if (tipoMov !== 'saida' && entradas.length > 0) {
      type GrpNota = { doc: RelatorioFiscalDocumentoJoinLocal | null; cfops: Map<string, { v: number; b: number; i: number }>; total_itens: number; total: number }
      const notaMap = new Map<string, GrpNota>()
      for (const item of entradas) {
        const doc = getDoc(item)
        const key = doc?.id ?? item.documento_id
        if (!notaMap.has(key)) notaMap.set(key, { doc, cfops: new Map(), total_itens: 0, total: 0 })
        const g = notaMap.get(key)!
        g.total_itens++
        g.total += Number(item.valor_total ?? 0)
        const cfop = item.cfop ?? '—'
        if (!g.cfops.has(cfop)) g.cfops.set(cfop, { v: 0, b: 0, i: 0 })
        const cf = g.cfops.get(cfop)!
        cf.v += Number(item.valor_total ?? 0)
        cf.b += Number(item.valor_bc_icms ?? 0)
        cf.i += Number(item.valor_icms ?? 0)
      }
      const hNE = ['Nº Nota', 'Chave de Acesso', 'Data', 'Fornecedor', 'Itens', 'CFOP', 'Descrição CFOP', 'Valor (CFOP)', 'Base ICMS (CFOP)', 'ICMS (CFOP)', 'Valor Contábil Nota', 'Status']
      const rNE: XLSX.CellObject[][] = [hNE.map(h)]
      for (const [, nota] of notaMap) {
        const { doc, cfops, total_itens, total } = nota
        const numero = doc?.numero ?? '—'
        const chave = doc?.chave_acesso ?? '—'
        const data = fData(doc?.data_emissao)
        const forn = doc?.emitente_nome || doc?.emitente_cnpj || '—'
        Array.from(cfops.entries()).forEach(([cfop, vals], idx) => {
          rNE.push([
            c(idx === 0 ? numero : '', idx === 0), c(idx === 0 ? chave : ''),
            c(idx === 0 ? data : ''), c(idx === 0 ? forn : ''),
            c(idx === 0 ? total_itens : '', false, '0'), c(cfop, true),
            c(DESC_CFOP[cfop] ?? `CFOP ${cfop}`),
            c(vals.v, false, '#,##0.00'), c(vals.b, false, '#,##0.00'), c(vals.i, false, '#,##0.00'),
            c(idx === 0 ? total : '', false, '#,##0.00'), c('—'),
          ])
        })
      }
      const wsNE = XLSX.utils.aoa_to_sheet(rNE.map(r => r.map(x => x.v)))
      wr(wsNE, rNE)
      wsNE['!cols'] = [{ wch: 14 }, { wch: 46 }, { wch: 12 }, { wch: 36 }, { wch: 8 }, { wch: 8 }, { wch: 38 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, wsNE, 'Notas Entradas')
    }

    // ── Resumo Saídas ──────────────────────────────────────────────────────────
    if (tipoMov !== 'entrada' && saidas.length > 0) {
      type GrpSaida = { doc: RelatorioFiscalDocumentoJoinLocal | null; cfops: Map<string, { v: number; b: number; i: number }>; total: number; ticms: number; tpis: number; tcofins: number }
      const notaMapS = new Map<string, GrpSaida>()
      for (const item of saidas) {
        const doc = getDoc(item)
        const key = doc?.id ?? item.documento_id
        if (!notaMapS.has(key)) notaMapS.set(key, { doc, cfops: new Map(), total: 0, ticms: 0, tpis: 0, tcofins: 0 })
        const g = notaMapS.get(key)!
        g.total += Number(item.valor_total ?? 0)
        g.ticms += Number(item.valor_icms ?? 0)
        g.tpis += Number(item.valor_pis ?? 0)
        g.tcofins += Number(item.valor_cofins ?? 0)
        const cfop = item.cfop ?? '—'
        if (!g.cfops.has(cfop)) g.cfops.set(cfop, { v: 0, b: 0, i: 0 })
        const cf = g.cfops.get(cfop)!
        cf.v += Number(item.valor_total ?? 0)
        cf.b += Number(item.valor_bc_icms ?? 0)
        cf.i += Number(item.valor_icms ?? 0)
      }
      const hRS = ['Nº Nota', 'Chave de Acesso', 'Data', 'Destinatário', 'CFOP', 'Descrição CFOP', 'Valor (CFOP)', 'Base ICMS (CFOP)', 'ICMS (CFOP)', 'Valor Contábil Nota', 'ICMS Total Nota', 'PIS Total', 'COFINS Total', 'Status']
      const rRS: XLSX.CellObject[][] = [hRS.map(h)]
      for (const [, nota] of notaMapS) {
        const { doc, cfops, total, ticms, tpis, tcofins } = nota
        const numero = doc?.numero ?? '—'
        const chave = doc?.chave_acesso ?? '—'
        const data = fData(doc?.data_emissao)
        const dest = doc?.destinatario_nome || doc?.destinatario_cnpj || '—'
        Array.from(cfops.entries()).forEach(([cfop, vals], idx) => {
          rRS.push([
            c(idx === 0 ? numero : '', idx === 0), c(idx === 0 ? chave : ''),
            c(idx === 0 ? data : ''), c(idx === 0 ? dest : ''),
            c(cfop, true), c(DESC_CFOP[cfop] ?? `CFOP ${cfop}`),
            c(vals.v, false, '#,##0.00'), c(vals.b, false, '#,##0.00'), c(vals.i, false, '#,##0.00'),
            c(idx === 0 ? total : '', false, '#,##0.00'), c(idx === 0 ? ticms : '', false, '#,##0.00'),
            c(idx === 0 ? tpis : '', false, '#,##0.00'), c(idx === 0 ? tcofins : '', false, '#,##0.00'), c('—'),
          ])
        })
      }
      const wsRS = XLSX.utils.aoa_to_sheet(rRS.map(r => r.map(x => x.v)))
      wr(wsRS, rRS)
      wsRS['!cols'] = [{ wch: 12 }, { wch: 46 }, { wch: 12 }, { wch: 36 }, { wch: 8 }, { wch: 38 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, wsRS, 'Resumo Saídas')
    }
  }

  // ── Itens Entradas ─────────────────────────────────────────────────────────
    if (tipoMov !== 'saida' && entradas.length > 0) {
      const hIE = ['Nº Nota', 'Chave de Acesso', 'Data', 'Fornecedor', 'Cód.', 'Descrição', 'NCM', 'CFOP Forn.', 'CFOP Entrada', 'CST/CSOSN', 'Valor Produto', 'Frete Rateado', 'Despesas Rateadas', 'IPI Item', 'Desconto Rateado', 'Valor Contábil Total', 'Base ICMS', 'Alíq. ICMS', 'ICMS', 'Fonte']
      const rIE: XLSX.CellObject[][] = [hIE.map(h)]
      for (const item of entradas) {
        const doc = getDoc(item)
        rIE.push([
          c(doc?.numero ?? '—', true), c(doc?.chave_acesso ?? '—'),
          c(fData(doc?.data_emissao)),
          c(doc?.emitente_nome || doc?.emitente_cnpj || '—'),
          c(item.codigo_produto ?? ''), c(item.descricao ?? ''), c(item.ncm ?? ''),
          c(item.cfop_fornecedor || cfopForn(item.cfop)), c(cfopEntradaEfet(item.cfop)),
          c(item.cst_icms ?? item.csosn ?? ''),
          c(Number(item.valor_total ?? 0), false, '#,##0.00'),
          c(Number(item.valor_frete ?? 0), false, '#,##0.00'),
          c('—'),
          c(tributoExcel(item.valor_ipi), false, '#,##0.00'),
          c(Number(item.valor_desconto ?? 0), false, '#,##0.00'),
          c(Number(item.valor_total ?? 0), false, '#,##0.00'),
          c(tributoExcel(item.valor_bc_icms), false, '#,##0.00'),
          c(tributoExcel(item.aliquota_icms), false, '0.00'),
          c(tributoExcel(item.valor_icms), false, '#,##0.00'),
          c(origemLabel(doc?.origem)),
        ])
      }
      const wsIE = XLSX.utils.aoa_to_sheet(rIE.map(r => r.map(x => x.v)))
      wr(wsIE, rIE)
      wsIE['!cols'] = [{ wch: 12 }, { wch: 46 }, { wch: 12 }, { wch: 36 }, { wch: 12 }, { wch: 44 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, wsIE, 'Itens Entradas')
    }

  // ── Notas Saídas ───────────────────────────────────────────────────────────
    if (tipoMov !== 'entrada' && saidas.length > 0) {
      const hNS = ['Nº Nota', 'Chave de Acesso', 'Data', 'Destinatário', 'Cód.', 'Descrição', 'NCM', 'CFOP', 'CST ICMS', 'CST PIS', 'CST COFINS', 'Valor Produto', 'Frete Rateado', 'Despesas Rateadas', 'IPI Item', 'Desconto Rateado', 'Valor Contábil Total', 'Base ICMS', 'Alíq. ICMS', 'ICMS', 'ICMS-ST', 'IPI', 'PIS', 'COFINS', 'Status']
      const rNS: XLSX.CellObject[][] = [hNS.map(h)]
      for (const item of saidas) {
        const doc = getDoc(item)
        rNS.push([
          c(doc?.numero ?? '—', true), c(doc?.chave_acesso ?? '—'),
          c(fData(doc?.data_emissao)),
          c(doc?.destinatario_nome || doc?.destinatario_cnpj || '—'),
          c(item.codigo_produto ?? ''), c(item.descricao ?? ''), c(item.ncm ?? ''),
          c(item.cfop ?? ''),
          c(item.cst_icms ?? item.csosn ?? ''), c(item.cst_pis ?? ''), c(item.cst_cofins ?? ''),
          c(Number(item.valor_total ?? 0), false, '#,##0.00'),
          c(Number(item.valor_frete ?? 0), false, '#,##0.00'),
          c('—'),
          c(tributoExcel(item.valor_ipi), false, '#,##0.00'),
          c(Number(item.valor_desconto ?? 0), false, '#,##0.00'),
          c(Number(item.valor_total ?? 0), false, '#,##0.00'),
          c(tributoExcel(item.valor_bc_icms), false, '#,##0.00'),
          c(tributoExcel(item.aliquota_icms), false, '0.00'),
          c(tributoExcel(item.valor_icms), false, '#,##0.00'),
          c(tributoExcel(item.valor_st), false, '#,##0.00'),
          c(tributoExcel(item.valor_ipi), false, '#,##0.00'),
          c(tributoExcel(item.valor_pis), false, '#,##0.00'),
          c(tributoExcel(item.valor_cofins), false, '#,##0.00'),
          c('—'),
        ])
      }
      const wsNS = XLSX.utils.aoa_to_sheet(rNS.map(r => r.map(x => x.v)))
      wr(wsNS, rNS)
      wsNS['!cols'] = [{ wch: 12 }, { wch: 46 }, { wch: 12 }, { wch: 38 }, { wch: 12 }, { wch: 42 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, wsNS, 'Notas Saídas')
    }
  const adicionarResumoCfop = (fonte: RelatorioFiscalProdutoLocal[], nomeAba: string) => {
    if (fonte.length === 0) return
    const mapa = new Map<string, { documentos: Set<string>; itens: number; valor: number; base: number; icms: number }>()
    for (const item of fonte) {
      const cfop = item.cfop || 'Não informado'
      const grupo = mapa.get(cfop) ?? { documentos: new Set<string>(), itens: 0, valor: 0, base: 0, icms: 0 }
      grupo.documentos.add(item.documento_id)
      grupo.itens += 1
      grupo.valor += Number(item.valor_total ?? 0)
      grupo.base += Number(item.valor_bc_icms ?? 0)
      grupo.icms += Number(item.valor_icms ?? 0)
      mapa.set(cfop, grupo)
    }
    const cabecalho = ['CFOP', 'Descrição', 'Qtd. documentos', 'Qtd. itens', 'Valor contábil', 'Base ICMS', 'ICMS']
    const linhas: XLSX.CellObject[][] = [cabecalho.map(h)]
    Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true })).forEach(([cfop, grupo]) => {
      linhas.push([
        c(cfop, true), c(DESC_CFOP[cfop] ?? (cfop === 'Não informado' ? cfop : `CFOP ${cfop}`)),
        c(grupo.documentos.size, false, '0'), c(grupo.itens, false, '0'),
        c(grupo.valor, false, '#,##0.00'), c(grupo.base, false, '#,##0.00'), c(grupo.icms, false, '#,##0.00'),
      ])
    })
    const ws = XLSX.utils.aoa_to_sheet(linhas.map(linha => linha.map(celula => celula.v)))
    wr(ws, linhas)
    ws['!cols'] = [{ wch: 10 }, { wch: 52 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws, nomeAba)
  }

  if (servicos.length > 0) {
    const cabecalhoServicos = [
      'Nº NFS-e', 'Código de verificação', 'Data', 'Movimento', 'Prestador', 'Tomador',
      'Descrição do serviço', 'Item da lista de serviço', 'Código tributário municipal',
      'Município (IBGE)', 'Valor dos serviços', 'Base ISS', 'Alíquota ISS', 'ISS',
      'ISS retido', 'Situação do ISS', 'Origem',
    ]
    const linhasServicos: XLSX.CellObject[][] = [cabecalhoServicos.map(h)]
    for (const item of servicos) {
      const doc = getDoc(item)
      const situacaoIss = doc?.iss_retido
        ? 'Retido pelo tomador'
        : Number(doc?.valor_iss ?? 0) > 0
          ? 'ISS destacado'
          : 'Sem destaque de ISS'
      linhasServicos.push([
        c(doc?.numero ?? '—', true),
        c(doc?.codigo_verificacao ?? ''),
        c(fData(doc?.data_emissao)),
        c(movItem(item) === 'entrada' ? 'Serviço tomado' : 'Serviço prestado'),
        c(doc?.emitente_nome || doc?.emitente_cnpj || '—'),
        c(doc?.destinatario_nome || doc?.destinatario_cnpj || '—'),
        c(doc?.discriminacao_servico || item.descricao || '—'),
        c(doc?.codigo_servico || item.codigo_produto || ''),
        c(doc?.codigo_tributacao_municipio || ''),
        c(doc?.municipio_codigo || ''),
        c(Number(doc?.valor_servicos ?? item.valor_total ?? 0), false, '#,##0.00'),
        c(tributoExcel(doc?.base_iss), false, '#,##0.00'),
        c(tributoExcel(doc?.aliquota_iss), false, '0.0000'),
        c(tributoExcel(doc?.valor_iss), false, '#,##0.00'),
        c(Number(doc?.valor_iss_retido ?? 0), false, '#,##0.00'),
        c(situacaoIss),
        c(origemLabel(doc?.origem)),
      ])
    }
    const wsServicos = XLSX.utils.aoa_to_sheet(linhasServicos.map(linha => linha.map(celula => celula.v)))
    wr(wsServicos, linhasServicos)
    wsServicos['!cols'] = [
      { wch: 13 }, { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 34 }, { wch: 34 },
      { wch: 54 }, { wch: 20 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, wsServicos, 'Serviços NFS-e')
  }

  if (tipoMov !== 'saida') adicionarResumoCfop(entradas, 'Resumo CFOP Entradas')
  if (tipoMov !== 'entrada') adicionarResumoCfop(saidas, 'Resumo CFOP Saídas')

  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome]
    if (ws?.['!ref']) ws['!autofilter'] = { ref: ws['!ref'] }
    if (ws) ws['!rows'] = [{ hpt: 30 }]
  }

  return wb
}

type FiltrosAplicados = { ncm: string; cfop: string; participante: string; nota: string }

type DivergenciaSimplesCandidato = {
  documento_id: string
  numero: string
  data_emissao: string | null
  participante: string
  cfops: string
  movimento: string
  impacto_receita: string
  valor: number
  motivo: string
}

type DivergenciaSimples = {
  competencia: string
  receita_pgdas: number
  receita_xml: number
  faturamento_xml: number
  devolucoes_xml: number
  diferenca: number
  variacao: number
  status: 'alerta' | 'critico' | 'sem_dados' | string
  qtd_documentos: number
  qtd_candidatos: number
  candidatos: DivergenciaSimplesCandidato[]
}

// ─── Constantes alertas ────────────────────────────────────────────────────────

const NIVEIS  = ['', 'critico', 'alto', 'medio', 'baixo']
const STATUS  = ['', 'aberto', 'em_analise', 'resolvido', 'descartado']

const COR_NIVEL: Record<string, string> = {
  critico: 'var(--af-danger)',
  alto:    'var(--af-warning)',
  medio:   'var(--af-warning)',
  baixo:   'var(--af-success)',
}

const LABEL_NIVEL: Record<string, string> = {
  critico: 'Crítico', alto: 'Alto', medio: 'Médio', baixo: 'Baixo',
}

const LABEL_STATUS: Record<string, string> = {
  aberto: 'Aberto', em_analise: 'Em análise', resolvido: 'Resolvido', descartado: 'Descartado',
}

const LABEL_SITUACAO_TRIBUTO: Record<string, string> = {
  cabecalho: 'Cabeçalho',
  itens: 'Consolidado dos itens',
  zero: 'Zero informado',
  nao_informado: 'Não informado',
  nao_aplicavel: 'Não aplicável',
  divergente: 'Possível divergência',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmoe(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function competenciaLabel(comp: string) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const parts = comp.split('-')
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10) - 1
    return `${meses[m] ?? parts[1]}/${parts[0].slice(2)}`
  }
  return comp
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const supabase = createClient()
  const { empresaAtiva: empresa } = useEmpresaAtiva()
  const { runTask } = useNotifications()
  const empresaId = empresa?.id

  // Estado de navegação
  const [abaAtiva, setAbaAtiva] = useState<AbaRelatorio>('inconsistencias')

  // Filtros compartilhados
  const [compInicio, setCompInicio] = useState('')
  const [compFim,    setCompFim]    = useState('')
  const [tipoMov,    setTipoMov]    = useState('') // '' = ambos, 'entrada', 'saida'

  // Filtros adicionais (abas fiscais)
  const [filtroNcm,         setFiltroNcm]         = useState('')
  const [filtroCfop,        setFiltroCfop]        = useState('')
  const [filtroParticipante, setFiltroParticipante] = useState('')
  const [filtroNota,        setFiltroNota]        = useState('')
  const [ordenarPorFiscal,  setOrdenarPorFiscal]  = useState<'data_emissao' | 'numero' | 'participante' | 'valor_total' | 'valor_icms'>('data_emissao')
  const [direcaoFiscal,     setDirecaoFiscal]     = useState<'asc' | 'desc'>('asc')
  const filtrosRef = useRef<FiltrosAplicados>({ ncm: '', cfop: '', participante: '', nota: '' })
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosAplicados>({ ncm: '', cfop: '', participante: '', nota: '' })

  // Estado aba Inconsistências (mantido intacto)
  const [alertas,       setAlertas]      = useState<AlertaFiscal[]>([])
  const [loadingAlert,  setLoadingAlert] = useState(true)
  const [filtroNivel,   setFiltroNivel]  = useState('')
  const [filtroStatus,  setFiltroStatus] = useState('aberto')
  const [expandido,     setExpandido]    = useState<string | null>(null)
  const [divergenciasSimples, setDivergenciasSimples] = useState<DivergenciaSimples[]>([])
  const [loadingDivSimples, setLoadingDivSimples] = useState(false)
  const [erroDivSimples, setErroDivSimples] = useState<string | null>(null)
  const [divSimplesExpandida, setDivSimplesExpandida] = useState<string | null>(null)

  // Estado abas de relatórios
  const [dadosMensais,      setDadosMensais]      = useState<DadoMensal[]>([])
  const [topProdutos,       setTopProdutos]       = useState<TopProduto[]>([])
  const [participantes,     setParticipantes]     = useState<Participante[]>([])
  const [tipoParticipante,  setTipoParticipante]  = useState<'entrada' | 'saida'>('entrada')
  const [cfops,             setCfops]             = useState<CfopItem[]>([])
  const [ncms,              setNcms]              = useState<NcmItem[]>([])
  const [nivelFiscal,       setNivelFiscal]       = useState<NivelFiscal>('documento')
  const [ordemFiscal,       setOrdemFiscal]       = useState<OrdemFiscal>('documento')
  const [resumidoFiscal,    setResumidoFiscal]    = useState(false)
  const [linhasFiscal,      setLinhasFiscal]      = useState<RelatorioFiscalLinha[]>([])
  const [documentoExpandido, setDocumentoExpandido] = useState<string | null>(null)
  const [itensDocumento, setItensDocumento] = useState<Record<string, RelatorioFiscalProduto[]>>({})
  const [carregandoItensDocumento, setCarregandoItensDocumento] = useState<string | null>(null)
  const [totalFiscal,       setTotalFiscal]       = useState(0)
  const [totalizadoresFiscal, setTotalizadoresFiscal] = useState<RelatorioFiscalResposta['totalizadores']>()
  const [loadingRel,        setLoadingRel]        = useState(false)
  const [exportandoExcel,   setExportandoExcel]   = useState(false)
  const [gerandoPdf,        setGerandoPdf]        = useState(false)
  const [erroRel,           setErroRel]           = useState<string | null>(null)
  const [pageSizeRel, setPageSizeRel] = useState(50)
  const [paginasRel, setPaginasRel] = useState<Record<AbaRelatorio, number>>({
    inconsistencias: 1,
    entradas_saidas: 1,
    documentos: 1,
    produtos: 1,
    participantes: 1,
    cfop: 1,
    ncm: 1,
  })

  // CNPJ cache (para aba participantes)
  const [cnpjCache, setCnpjCache] = useState<Record<string, { status: 'carregando' | 'ok' | 'erro'; dados?: Record<string, unknown> }>>({})

  const paginaRel = paginasRel[abaAtiva] ?? 1
  const abaFiscal = abaAtiva === 'entradas_saidas' || abaAtiva === 'produtos' || abaAtiva === 'cfop'
  const setPaginaRel = (pagina: number) => setPaginasRel(prev => ({ ...prev, [abaAtiva]: pagina }))
  const trocarPageSizeRel = (tamanho: number) => {
    setPageSizeRel(tamanho)
    setPaginasRel({
      inconsistencias: 1,
      entradas_saidas: 1,
      documentos: 1,
      produtos: 1,
      participantes: 1,
      cfop: 1,
      ncm: 1,
    })
  }

  // ── Carregar alertas ────────────────────────────────────────────────────────

  const carregarAlertas = useCallback(async () => {
    setLoadingAlert(true)
    let query = supabase
      .from('fa_alertas')
      .select('*, empresa:empresas(razao_social)')
      .order('nivel_risco', { ascending: true })
      .order('created_at', { ascending: false })

    if (empresaId) query = query.eq('empresa_id', empresaId)
    if (filtroNivel)  query = query.eq('nivel_risco', filtroNivel)
    if (filtroStatus) query = query.eq('status', filtroStatus)

    const { data } = await query
    setAlertas((data as AlertaFiscal[]) ?? [])
    setLoadingAlert(false)
  }, [empresaId, filtroNivel, filtroStatus, supabase])

  useEffect(() => {
    if (abaAtiva !== 'inconsistencias') return
    const timer = window.setTimeout(() => { void carregarAlertas() }, 0)
    return () => window.clearTimeout(timer)
  }, [abaAtiva, carregarAlertas])

  const carregarDivergenciasSimples = useCallback(async () => {
    if (!empresaId) {
      setDivergenciasSimples([])
      return
    }

    setLoadingDivSimples(true)
    setErroDivSimples(null)
    const params = new URLSearchParams({ empresa_id: empresaId })
    if (compInicio) params.set('competencia_inicio', compInicio)
    if (compFim) params.set('competencia_fim', compFim)

    try {
      const res = await fetch(`/api/relatorios/divergencias-simples?${params}`)
      const body = await res.json().catch(() => null) as DivergenciaSimples[] | { error?: string } | null
      if (!res.ok) {
        const msg = body && !Array.isArray(body) && body.error ? body.error : `Erro HTTP ${res.status}`
        throw new Error(msg)
      }
      setDivergenciasSimples(Array.isArray(body) ? body : [])
    } catch (err) {
      setDivergenciasSimples([])
      setErroDivSimples(err instanceof Error ? err.message : 'Erro ao carregar divergencias do Simples')
    } finally {
      setLoadingDivSimples(false)
    }
  }, [empresaId, compInicio, compFim])

  useEffect(() => {
    if (abaAtiva !== 'inconsistencias') return
    const timer = window.setTimeout(() => { void carregarDivergenciasSimples() }, 0)
    return () => window.clearTimeout(timer)
  }, [abaAtiva, carregarDivergenciasSimples])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (abaAtiva === 'entradas_saidas') {
        setNivelFiscal('documento')
        setOrdemFiscal('documento')
        setResumidoFiscal(false)
        setPaginasRel(prev => ({ ...prev, entradas_saidas: 1 }))
      } else if (abaAtiva === 'produtos') {
        setNivelFiscal('produto')
        setOrdemFiscal('produto')
        setResumidoFiscal(false)
        setPaginasRel(prev => ({ ...prev, produtos: 1 }))
      } else if (abaAtiva === 'cfop') {
        setNivelFiscal('produto')
        setOrdemFiscal('cfop')
        setResumidoFiscal(true)
        setPaginasRel(prev => ({ ...prev, cfop: 1 }))
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [abaAtiva])

  // ── Carregar relatório ──────────────────────────────────────────────────────

  const carregarRelatorio = useCallback(async () => {
    if (!empresaId || abaAtiva === 'inconsistencias' || abaFiscal) return
    if (!compInicio && !compFim) {
      setDadosMensais([])
      setTopProdutos([])
      setParticipantes([])
      setCfops([])
      setNcms([])
      setLinhasFiscal([])
      setTotalFiscal(0)
      setTotalizadoresFiscal(undefined)
      setErroRel(null)
      return
    }
    setLoadingRel(true)
    setErroRel(null)
    setPaginasRel(prev => ({ ...prev, [abaAtiva]: 1 }))

    const params = new URLSearchParams({ empresa_id: empresaId })
    if (compInicio) params.set('competencia_inicio', compInicio)
    if (compFim)    params.set('competencia_fim', compFim)
    if (tipoMov)    params.set('tipo_movimento', tipoMov)

    try {
      const carregarJson = async (url: string) => {
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 45_000)
        try {
          const res = await fetch(url, { signal: controller.signal })
          const body = await res.json().catch(() => null) as { error?: string } | unknown
          if (!res.ok) {
            const erro = body && typeof body === 'object' && 'error' in body ? String(body.error) : `Erro HTTP ${res.status}`
            throw new Error(erro)
          }
          return body
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error(`A consulta demorou demais na aba ${abaAtiva}. URL: ${url}`)
          }
          throw err
        } finally {
          window.clearTimeout(timeout)
        }
      }

      if (abaAtiva === 'documentos') {
        const r = await carregarJson(`/api/relatorios/documentos?${params}&meses=24`)
        setDadosMensais(Array.isArray(r) ? r : [])
      } else if (abaAtiva === 'participantes') {
        const p = new URLSearchParams(params)
        p.set('tipo', tipoParticipante)
        p.set('limit', '5000')
        const r = await carregarJson(`/api/relatorios/participantes?${p}`)
        setParticipantes(Array.isArray(r) ? r : [])
      } else if (abaAtiva === 'ncm') {
        const p = new URLSearchParams(params)
        p.set('limit', '5000')
        const r = await carregarJson(`/api/relatorios/ncm?${p}`)
        setNcms(Array.isArray(r) ? r : [])
      }
    } catch (err) {
      setErroRel(err instanceof Error ? err.message : 'Erro ao carregar relatorio')
    } finally {
      setLoadingRel(false)
    }
  }, [empresaId, abaAtiva, abaFiscal, compInicio, compFim, tipoMov, tipoParticipante])

  useEffect(() => {
    const timer = window.setTimeout(() => { void carregarRelatorio() }, 0)
    return () => window.clearTimeout(timer)
  }, [carregarRelatorio])

  const carregarRelatorioFiscal = useCallback(async () => {
    if (!empresaId || !abaFiscal) return
    if (!compInicio && !compFim) {
      setLinhasFiscal([])
      setTotalFiscal(0)
      setTotalizadoresFiscal(undefined)
      setErroRel(null)
      return
    }

    setLoadingRel(true)
    setErroRel(null)

    const params = new URLSearchParams({
      empresa_id: empresaId,
      nivel: abaAtiva === 'entradas_saidas' ? 'documento' : 'produto',
      ordem: abaAtiva === 'cfop' ? 'cfop' : ordemFiscal,
      resumido: String(abaAtiva === 'cfop' ? true : resumidoFiscal),
      page: String(paginaRel),
      page_size: String(pageSizeRel),
    })
    if (compInicio) params.set('competencia_inicio', compInicio)
    if (compFim) params.set('competencia_fim', compFim)
    if (tipoMov) params.set('tipo_movimento', tipoMov)
    params.set('ordenar_por', ordenarPorFiscal)
    params.set('direcao', direcaoFiscal)
    const filtros = filtrosRef.current
    if (filtros.ncm) params.set('ncm', filtros.ncm)
    if (filtros.cfop) params.set('cfop', filtros.cfop)
    if (filtros.participante) params.set('participante', filtros.participante)
    if (filtros.nota) params.set('nota', filtros.nota)

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 45_000)
      try {
        const res = await fetch(`/api/relatorios/entradas-saidas?${params}`, { signal: controller.signal })
        const body = await res.json().catch(() => null) as RelatorioFiscalResposta | null
        if (!res.ok) throw new Error(body?.error ?? `Erro HTTP ${res.status}`)
        setLinhasFiscal(Array.isArray(body?.rows) ? body.rows : [])
        setTotalFiscal(Number(body?.total ?? 0))
        setTotalizadoresFiscal(body?.totalizadores)
      } finally {
        window.clearTimeout(timeout)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setErroRel('A consulta demorou demais. Tente gerar um periodo menor ou usar o modo resumido.')
      } else {
        setErroRel(err instanceof Error ? err.message : 'Erro ao carregar relatorio fiscal')
      }
    } finally {
      setLoadingRel(false)
    }
  }, [empresaId, abaAtiva, abaFiscal, compInicio, compFim, tipoMov, ordenarPorFiscal, direcaoFiscal, ordemFiscal, resumidoFiscal, paginaRel, pageSizeRel])

  useEffect(() => {
    const timer = window.setTimeout(() => { void carregarRelatorioFiscal() }, 0)
    return () => window.clearTimeout(timer)
  }, [carregarRelatorioFiscal])

  async function alternarDocumento(doc: RelatorioFiscalDocumento) {
    if (documentoExpandido === doc.id) {
      setDocumentoExpandido(null)
      return
    }
    setDocumentoExpandido(doc.id)
    if (itensDocumento[doc.id] || !empresaId) return
    setCarregandoItensDocumento(doc.id)
    try {
      const params = new URLSearchParams({
        empresa_id: empresaId,
        nivel: 'produto',
        resumido: 'false',
        page: '1',
        page_size: '1000',
        nota: doc.chave_acesso || doc.numero || '',
      })
      if (compInicio) params.set('competencia_inicio', compInicio)
      if (compFim) params.set('competencia_fim', compFim)
      if (tipoMov) params.set('tipo_movimento', tipoMov)
      const res = await fetch(`/api/relatorios/entradas-saidas?${params}`)
      const body = await res.json() as RelatorioFiscalResposta
      if (!res.ok) throw new Error(body.error ?? 'Erro ao carregar os itens do documento.')
      setItensDocumento(atual => ({ ...atual, [doc.id]: (body.rows ?? []).filter(isProdutoFiscal) }))
    } catch (err) {
      setErroRel(err instanceof Error ? err.message : 'Erro ao carregar os itens do documento.')
    } finally {
      setCarregandoItensDocumento(null)
    }
  }

  // ── Consultar CNPJ cache ────────────────────────────────────────────────────

  const consultarCnpj = useCallback(async (cnpj: string) => {
    if (cnpjCache[cnpj]) return
    setCnpjCache(prev => ({ ...prev, [cnpj]: { status: 'carregando' } }))
    try {
      const r = await fetch(`/api/cnpj-cache?cnpj=${cnpj.replace(/\D/g, '')}`)
      if (r.ok) {
        const dados = await r.json()
        setCnpjCache(prev => ({ ...prev, [cnpj]: { status: 'ok', dados } }))
      } else {
        setCnpjCache(prev => ({ ...prev, [cnpj]: { status: 'erro' } }))
      }
    } catch {
      setCnpjCache(prev => ({ ...prev, [cnpj]: { status: 'erro' } }))
    }
  }, [cnpjCache])

  // ── Atualizar status de alerta ──────────────────────────────────────────────

  async function atualizarStatus(id: string, status: string) {
    await supabase.from('fa_alertas').update({ status }).eq('id', id)
    carregarAlertas()
  }

  // ── Estilos ─────────────────────────────────────────────────────────────────

  const fcnpj = (v: string) =>
    v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

  const S: Record<string, React.CSSProperties> = {
    page:      { padding: '30px 36px 64px', color: 'var(--af-text)', width: '100%' },
    tabBar:    { display: 'flex', borderBottom: '2px solid var(--af-border)', marginBottom: 24, gap: 0, flexWrap: 'wrap' as const },
    filterRow: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' },
    input:     { background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 7, color: 'var(--af-text)', fontSize: 12, padding: '7px 10px', outline: 'none' },
    select:    { background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 7, color: 'var(--af-text)', fontSize: 12, padding: '7px 10px', outline: 'none', cursor: 'pointer' },
    table:     { width: '100%', borderCollapse: 'collapse' as const },
    th:        { padding: '11px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--af-muted)', borderBottom: '1px solid var(--af-border)', textAlign: 'left' as const, background: 'var(--af-surface-2)' },
    td:        { padding: '11px 14px', fontSize: 13, color: 'var(--af-text-soft)', borderBottom: '1px solid var(--af-border)' },
    btnAplicar:{ background: 'var(--af-primary)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 18px', cursor: 'pointer' },
  }

  function tabStyle(aba: AbaRelatorio): React.CSSProperties {
    const ativo = abaAtiva === aba
    return {
      background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: ativo ? 700 : 500,
      color: ativo ? 'var(--af-primary)' : 'var(--af-muted)',
      borderBottom: ativo ? '2px solid var(--af-primary)' : '2px solid transparent',
      padding: '10px 16px', marginBottom: -2, whiteSpace: 'nowrap' as const,
    }
  }

  function chipNivel(nivel: string): React.CSSProperties {
    const cor = COR_NIVEL[nivel] ?? 'var(--af-text)'
    return { background: `${cor}1a`, color: cor, border: `1px solid ${cor}44`, borderRadius: 5, fontSize: 10, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }
  }

  function btnAcao(cor: string): React.CSSProperties {
    return { background: `${cor}15`, border: `1px solid ${cor}40`, borderRadius: 6, color: cor, fontSize: 11, fontWeight: 600, padding: '5px 13px', cursor: 'pointer' }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const ABAS: { key: AbaRelatorio; label: string; icon: React.ReactNode }[] = [
    { key: 'inconsistencias', label: 'Inconsistências', icon: <TriangleAlert size={13} /> },
    { key: 'entradas_saidas', label: 'Entradas/Saídas', icon: <BarChart3 size={13} /> },
    { key: 'documentos',      label: 'Qtd. Documentos', icon: <BarChart3 size={13} /> },
    { key: 'produtos',        label: 'Produtos',         icon: <Package size={13} /> },
    { key: 'participantes',   label: 'Participantes',    icon: <Users size={13} /> },
    { key: 'cfop',            label: 'CFOP',             icon: <Hash size={13} /> },
  ]

  const alertasPagina = getPageItems(alertas, paginaRel, pageSizeRel)
  const dadosMensaisPagina = getPageItems(dadosMensais, paginaRel, pageSizeRel)
  const topProdutosPagina = getPageItems(topProdutos, paginaRel, pageSizeRel)
  const participantesPagina = getPageItems(participantes, paginaRel, pageSizeRel)
  const cfopsPagina = getPageItems(cfops, paginaRel, pageSizeRel)
  const ncmsPagina = getPageItems(ncms, paginaRel, pageSizeRel)

  const isResumoFiscal = (linha: RelatorioFiscalLinha): linha is RelatorioFiscalResumo => 'grupo_label' in linha
  const isProdutoFiscal = (linha: RelatorioFiscalLinha): linha is RelatorioFiscalProduto => 'documento_id' in linha
  const isDocumentoFiscal = (linha: RelatorioFiscalLinha): linha is RelatorioFiscalDocumento => !isResumoFiscal(linha) && !isProdutoFiscal(linha)
  const docProduto = (linha: RelatorioFiscalProduto) => Array.isArray(linha.fa_documentos_fiscais)
    ? linha.fa_documentos_fiscais[0]
    : linha.fa_documentos_fiscais
  const participanteFiscal = (doc: RelatorioFiscalDocumento | RelatorioFiscalDocumentoJoin | null | undefined) => {
    if (!doc) return '—'
    return doc.tipo_movimento === 'entrada'
      ? (doc.emitente_nome || doc.emitente_cnpj || '—')
      : (doc.destinatario_nome || doc.destinatario_cnpj || '—')
  }
  const ehNfseFiscal = (doc: RelatorioFiscalDocumento | RelatorioFiscalDocumentoJoin | null | undefined) =>
    doc?.tipo_documento === 'nfse' || doc?.origem === 'xml_nfse' || doc?.modelo === 'NFS-e'
  const movimentoFiscal = (doc: RelatorioFiscalDocumento | RelatorioFiscalDocumentoJoin) => {
    if (ehNfseFiscal(doc)) return doc.tipo_movimento === 'entrada' ? 'Serviço tomado' : 'Serviço prestado'
    return doc.tipo_movimento
  }
  const situacaoIssFiscal = (doc: RelatorioFiscalDocumento | RelatorioFiscalDocumentoJoin) => {
    if (doc.iss_retido) return 'ISS retido'
    if (doc.situacao_iss === 'nao_informado') return 'ISS não informado'
    return Number(doc.valor_iss ?? 0) > 0 ? 'ISS destacado' : 'Sem destaque'
  }
  const linhasDetalhadasRelatorio = linhasFiscal.filter(
    (linha): linha is RelatorioFiscalDocumento | RelatorioFiscalProduto => !isResumoFiscal(linha),
  )
  const temNfseNoRelatorio = linhasDetalhadasRelatorio.some(linha => {
    return isProdutoFiscal(linha) ? ehNfseFiscal(docProduto(linha)) : ehNfseFiscal(linha)
  })
  const somenteNfseNoRelatorio = linhasDetalhadasRelatorio.length > 0 && linhasDetalhadasRelatorio.every(linha =>
    isProdutoFiscal(linha) ? ehNfseFiscal(docProduto(linha)) : ehNfseFiscal(linha),
  )
  const dataFiscal = (data?: string | null) => data ? new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR') : '—'
  const tributoFiscal = (valor: number | null | undefined, situacao?: string) => {
    if (valor === null || valor === undefined) {
      return <span style={{ color: 'var(--af-warning)', fontSize: 11 }}>{LABEL_SITUACAO_TRIBUTO[situacao ?? 'nao_informado'] ?? 'Não informado'}</span>
    }
    return fmoe(Number(valor))
  }
  const cabecalhoOrdenavel = (
    label: string,
    campo: 'data_emissao' | 'numero' | 'participante' | 'valor_total' | 'valor_icms',
  ) => (
    <button
      type="button"
      onClick={() => {
        if (ordenarPorFiscal === campo) setDirecaoFiscal(atual => atual === 'asc' ? 'desc' : 'asc')
        else {
          setOrdenarPorFiscal(campo)
          setDirecaoFiscal('asc')
        }
        setPaginaRel(1)
      }}
      style={{ border: 0, padding: 0, background: 'transparent', color: 'inherit', font: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      title={`Ordenar por ${label}`}
    >
      {label}
      {ordenarPorFiscal === campo && (direcaoFiscal === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
    </button>
  )
  const labelAgrupamentoFiscal: Record<OrdemFiscal, string> = {
    documento: 'Documento',
    cfop: 'CFOP',
    participante: 'Cliente/Fornecedor',
    estado: 'Estado',
    dia: 'Dia',
    aliquota: 'Alíquota',
    produto: 'Produto',
    ncm: 'NCM',
    cst: 'CST/CSOSN',
  }
  const tituloFiscal = resumidoFiscal
    ? `Resumo por ${labelAgrupamentoFiscal[ordemFiscal]}`
    : somenteNfseNoRelatorio
      ? 'Analítico de serviços NFS-e'
      : abaAtiva === 'produtos'
      ? 'Analítico de produtos'
      : 'Analítico de documentos'
  const tituloRelatorioFiscal = abaAtiva === 'cfop'
    ? 'Resumo por CFOP'
    : tituloFiscal

  const competenciaDaLinha = (linha: RelatorioFiscalLinha) => {
    if (isResumoFiscal(linha)) return linha.competencia ?? ''
    if (isProdutoFiscal(linha)) return docProduto(linha)?.data_competencia ?? ''
    return linha.data_competencia ?? ''
  }

  const nomeArquivoExcel = () => {
    const aba = ABAS.find(a => a.key === abaAtiva)?.label.replace(/[^\w.-]+/g, '_') ?? 'relatorio'
    const periodo = [compInicio || 'inicio', compFim || compInicio || 'fim'].join('_a_')
    return `Relatorio_${aba}_${periodo}.xlsx`
  }

  async function buscarFiscalParaExcel(opcoes?: { nivel?: NivelFiscal; resumido?: boolean }) {
    const todas: RelatorioFiscalLinha[] = []
    const tamanho = 1000
    let pagina = 1

    while (true) {
      const params = new URLSearchParams({
        empresa_id: empresaId ?? '',
        nivel: opcoes?.nivel ?? (abaAtiva === 'entradas_saidas' ? 'documento' : 'produto'),
        ordem: abaAtiva === 'cfop' ? 'cfop' : ordemFiscal,
        resumido: String(opcoes?.resumido ?? (abaAtiva === 'cfop' ? true : resumidoFiscal)),
        page: String(pagina),
        page_size: String(tamanho),
      })
      if (compInicio) params.set('competencia_inicio', compInicio)
      if (compFim) params.set('competencia_fim', compFim)
      if (tipoMov) params.set('tipo_movimento', tipoMov)
      params.set('ordenar_por', ordenarPorFiscal)
      params.set('direcao', direcaoFiscal)
      const filtros = filtrosRef.current
      if (filtros.ncm) params.set('ncm', filtros.ncm)
      if (filtros.cfop) params.set('cfop', filtros.cfop)
      if (filtros.participante) params.set('participante', filtros.participante)
      if (filtros.nota) params.set('nota', filtros.nota)

      const res = await fetch(`/api/relatorios/entradas-saidas?${params}`)
      const body = await res.json() as RelatorioFiscalResposta
      if (!res.ok && body.error?.toLowerCase().includes('requested range not satisfiable') && todas.length > 0) break
      if (!res.ok) throw new Error(body.error ?? 'Erro ao exportar relatório.')
      const rows = Array.isArray(body.rows) ? body.rows : []
      if (rows.length === 0) break
      todas.push(...rows)
      if (rows.length < tamanho) break
      pagina += 1
    }

    return todas
  }

  async function buscarTodosItensFiscal(): Promise<RelatorioFiscalProdutoLocal[]> {
    const todas: RelatorioFiscalProdutoLocal[] = []
    const tamanho = 1000
    let pagina = 1

    while (true) {
      const params = new URLSearchParams({
        empresa_id: empresaId ?? '',
        nivel: 'produto',
        resumido: 'false',
        page: String(pagina),
        page_size: String(tamanho),
      })
      if (compInicio) params.set('competencia_inicio', compInicio)
      if (compFim) params.set('competencia_fim', compFim)
      if (tipoMov) params.set('tipo_movimento', tipoMov)
      const filtros = filtrosRef.current
      if (filtros.ncm) params.set('ncm', filtros.ncm)
      if (filtros.cfop) params.set('cfop', filtros.cfop)
      if (filtros.participante) params.set('participante', filtros.participante)
      if (filtros.nota) params.set('nota', filtros.nota)

      const res = await fetch(`/api/relatorios/entradas-saidas?${params}`)
      const body = await res.json() as RelatorioFiscalResposta
      if (!res.ok && body.error?.toLowerCase().includes('requested range not satisfiable') && todas.length > 0) break
      if (!res.ok) throw new Error(body.error ?? 'Erro ao exportar relatório.')
      const rows = Array.isArray(body.rows) ? body.rows : []
      if (rows.length === 0) break
      todas.push(...(rows as RelatorioFiscalProdutoLocal[]))
      if (rows.length < tamanho) break
      pagina += 1
    }

    return todas
  }

  async function exportarExcel() {
    if (!empresaId || abaAtiva === 'inconsistencias') return
    setExportandoExcel(true)
    setErroRel(null)
    try {
      await runTask({
        title: 'Gerando Excel de relatorios',
        runningMessage: 'O relatorio esta sendo preparado.',
        successTitle: 'Excel de relatorios pronto',
        errorTitle: 'Erro ao gerar Excel',
      }, async () => {
      // Abas entradas_saidas e produtos (detalhado): exportação multi-planilha estilizada
      if ((abaAtiva === 'entradas_saidas' || abaAtiva === 'produtos') && !resumidoFiscal) {
        const itens = await buscarTodosItensFiscal()
        const documentos = abaAtiva === 'entradas_saidas'
          ? (await buscarFiscalParaExcel()).filter(isDocumentoFiscal)
          : []
        const wb = construirExcelFiscal(itens, abaAtiva, tipoMov)
        const somenteNfse = documentos.length > 0 && documentos.every(doc => ehNfseFiscal(doc))
        const resumo = [
          ['RELATÓRIO FISCAL — ENFOKUS CONTABILIDADE E FINANÇAS CORPORATIVAS'],
          [],
          ['Empresa', empresa?.razao_social ?? ''],
          ['CNPJ', empresa?.cnpj ?? ''],
          ['Período', `${compInicio || 'início'} até ${compFim || compInicio || 'fim'}`],
          ['Relatório', somenteNfse ? 'Serviços NFS-e' : abaAtiva === 'entradas_saidas' ? 'Entradas e saídas' : 'Produtos'],
          ['Visualização', abaAtiva === 'entradas_saidas' ? 'Documentos e itens' : 'Itens analíticos'],
          ['Gerado em', new Date().toLocaleString('pt-BR')],
          ['Filtros aplicados', filtrosAtivosRelatorio.join(' | ') || 'Nenhum filtro adicional'],
          [],
          ['Indicador', 'Valor'],
          ['Documentos', documentos.length || new Set(itens.map(item => item.documento_id)).size],
          ['Itens', itens.length],
          ['Valor das operações', totalizadoresFiscal?.valor_contabil ?? itens.reduce((soma, item) => soma + Number(item.valor_total ?? 0), 0)],
          ['Base de ICMS', totalizadoresFiscal?.base_icms ?? itens.reduce((soma, item) => soma + Number(item.valor_bc_icms ?? 0), 0)],
          ['ICMS consolidado', totalizadoresFiscal?.valor_icms ?? itens.reduce((soma, item) => soma + Number(item.valor_icms ?? 0), 0)],
          ['ICMS-ST', totalizadoresFiscal?.valor_st ?? itens.reduce((soma, item) => soma + Number(item.valor_st ?? 0), 0)],
          ['IPI', totalizadoresFiscal?.valor_ipi ?? itens.reduce((soma, item) => soma + Number(item.valor_ipi ?? 0), 0)],
          ['PIS', totalizadoresFiscal?.valor_pis ?? itens.reduce((soma, item) => soma + Number(item.valor_pis ?? 0), 0)],
          ['COFINS', totalizadoresFiscal?.valor_cofins ?? itens.reduce((soma, item) => soma + Number(item.valor_cofins ?? 0), 0)],
          ['NFS-e', documentos.filter(doc => ehNfseFiscal(doc)).length],
          ['Valor dos serviços', documentos.reduce((soma, doc) => soma + Number(doc.valor_servicos ?? 0), 0)],
          ['Base de ISS', documentos.reduce((soma, doc) => soma + Number(doc.base_iss ?? 0), 0)],
          ['ISS', documentos.reduce((soma, doc) => soma + Number(doc.valor_iss ?? 0), 0)],
          ['ISS retido', documentos.reduce((soma, doc) => soma + Number(doc.valor_iss_retido ?? 0), 0)],
          ['ICMS recuperado dos itens', documentos.filter(doc => !ehNfseFiscal(doc) && doc.situacao_icms === 'itens').length],
          ['Documentos com divergência', documentos.filter(doc => doc.tem_divergencia).length],
          ['Documentos com dados incompletos', documentos.filter(doc => doc.dados_incompletos).length],
        ]
        const wsResumo = XLSX.utils.aoa_to_sheet(resumo)
        estilizarResumoExecutivo(wsResumo)
        wb.Sheets['Resumo Executivo'] = wsResumo
        wb.SheetNames = ['Resumo Executivo', ...wb.SheetNames.filter(nome => nome !== 'Resumo Executivo')]

        const divergencias = documentos.filter(doc => doc.tem_divergencia || doc.dados_incompletos).map(doc => ({
          Competencia: doc.data_competencia ?? '',
          Tipo_Documento: ehNfseFiscal(doc) ? 'NFS-e' : (doc.modelo === '65' ? 'NFC-e' : 'NF-e'),
          Nota: doc.numero ?? '',
          Chave_Acesso: doc.chave_acesso ?? '',
          Participante: participanteFiscal(doc),
          Valor_Produtos_Cabecalho: doc.valor_produtos ?? null,
          Soma_Produtos_Itens: doc.soma_produtos_itens ?? null,
          Diferenca_Produtos: doc.diferenca_produtos ?? null,
          ICMS_Cabecalho: doc.valor_icms_cabecalho ?? null,
          ICMS_Itens: doc.valor_icms_itens ?? null,
          ICMS_Consolidado: doc.valor_icms ?? null,
          Situacao_ICMS: LABEL_SITUACAO_TRIBUTO[doc.situacao_icms ?? 'nao_informado'] ?? doc.situacao_icms,
          Codigo_Servico: doc.codigo_servico ?? '',
          Base_ISS: doc.base_iss ?? null,
          ISS: doc.valor_iss ?? null,
          ISS_Retido: doc.valor_iss_retido ?? null,
          Situacao_ISS: ehNfseFiscal(doc) ? situacaoIssFiscal(doc) : 'Não aplicável',
          Divergencias: doc.divergencias?.join(' | ') ?? '',
        }))
        if (divergencias.length > 0) {
          const wsDivergencias = XLSX.utils.json_to_sheet(divergencias)
          estilizarTabelaExcel(wsDivergencias)
          XLSX.utils.book_append_sheet(wb, wsDivergencias, 'Divergencias')
        }
        if (wb.SheetNames.length === 0) throw new Error('Não há dados para exportar.')
        return {
          message: 'Clique para baixar o relatorio gerado.',
          action: {
            type: 'download' as const,
            filename: nomeArquivoExcel(),
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            blob: workbookToXlsxBlob(wb),
          },
        }
      }

      const rowsFonte = abaFiscal ? await buscarFiscalParaExcel() : []
      let rows: Record<string, string | number | null | undefined>[] = []

      if (abaFiscal) {
        if (abaAtiva === 'cfop' || resumidoFiscal) {
          rows = rowsFonte.filter(isResumoFiscal).map(r => ({
            Competencia: competenciaDaLinha(r),
            Grupo: r.grupo_label,
            Movimento: r.tipo_movimento ?? '',
            Quantidade: r.quantidade,
            Documentos: r.documentos,
            Valor_Contabil: r.valor_contabil,
            Base_ICMS: r.base_icms,
            ICMS: r.valor_icms,
            ST: r.valor_st,
            IPI: r.valor_ipi,
          }))
        }
      } else if (abaAtiva === 'documentos') {
        rows = dadosMensais.map(d => ({
          Competencia: d.competencia,
          Origem: d.origem ?? '',
          Entradas: d.total_entrada,
          Qtd_Entradas: d.count_entrada,
          Saidas: d.total_saida,
          Qtd_Saidas: d.count_saida,
          Total: d.total_entrada + d.total_saida,
        }))
      } else if (abaAtiva === 'participantes') {
        // Fetch dedicado para exportação: sem limit=5000, retorna todos os participantes
        const pExport = new URLSearchParams({ empresa_id: empresaId ?? '', tipo: tipoParticipante })
        if (compInicio) pExport.set('competencia_inicio', compInicio)
        if (compFim) pExport.set('competencia_fim', compFim)
        const resP = await fetch(`/api/relatorios/participantes?${pExport}`)
        if (!resP.ok) throw new Error('Erro ao exportar participantes.')
        const dataP = await resP.json() as Participante[]
        rows = dataP.map(p => ({
          CNPJ: p.cnpj,
          Razao_Social: p.nome,
          Documentos: p.count,
          Valor_Total: p.valor_total,
        }))
      } else if (abaAtiva === 'ncm') {
        // Fetch dedicado para exportação: sem limit=5000, retorna todos os NCMs
        const pNcm = new URLSearchParams({ empresa_id: empresaId ?? '' })
        if (compInicio) pNcm.set('competencia_inicio', compInicio)
        if (compFim) pNcm.set('competencia_fim', compFim)
        if (tipoMov) pNcm.set('tipo_movimento', tipoMov)
        const resN = await fetch(`/api/relatorios/ncm?${pNcm}`)
        if (!resN.ok) throw new Error('Erro ao exportar NCMs.')
        const dataN = await resN.json() as NcmItem[]
        rows = dataN.map(n => ({
          NCM: n.ncm,
          Produto_Exemplo: n.descricao_exemplo,
          Quantidade: n.quantidade,
          Valor_Total: n.valor_total,
          Participacao: n.participacao,
        }))
      }

      if (rows.length === 0) throw new Error('NÃ£o hÃ¡ dados para exportar.')
      const wb = XLSX.utils.book_new()
      const resumoGeral = XLSX.utils.aoa_to_sheet([
        ['RELATÓRIO FISCAL — ENFOKUS CONTABILIDADE E FINANÇAS CORPORATIVAS'],
        [],
        ['Empresa', empresa?.razao_social ?? ''],
        ['CNPJ', empresa?.cnpj ?? ''],
        ['Período', `${compInicio || 'início'} até ${compFim || compInicio || 'fim'}`],
        ['Relatório', ABAS.find(aba => aba.key === abaAtiva)?.label ?? tituloRelatorioFiscal],
        ['Visualização', resumidoFiscal ? 'Resumida' : 'Detalhada'],
        ['Gerado em', new Date().toLocaleString('pt-BR')],
        ['Filtros aplicados', filtrosAtivosRelatorio.join(' | ') || 'Nenhum filtro adicional'],
        [],
        ['Indicador', 'Valor'],
        ['Resultados exportados', rows.length],
      ])
      estilizarResumoExecutivo(resumoGeral)
      XLSX.utils.book_append_sheet(wb, resumoGeral, 'Resumo Executivo')
      const maxLinhasPorAba = 900000
      for (let i = 0; i < rows.length; i += maxLinhasPorAba) {
        const parte = rows.slice(i, i + maxLinhasPorAba)
        const ws = XLSX.utils.json_to_sheet(parte)
        estilizarTabelaExcel(ws)
        const sufixo = rows.length > maxLinhasPorAba ? `_${Math.floor(i / maxLinhasPorAba) + 1}` : ''
        XLSX.utils.book_append_sheet(wb, ws, `Dados${sufixo}`)
      }
      const filename = nomeArquivoExcel()
      return {
        message: 'Clique para baixar o relatorio gerado.',
        action: {
          type: 'download',
          filename,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          blob: workbookToXlsxBlob(wb),
        },
      }
      })
    } catch (err) {
      setErroRel(err instanceof Error ? err.message : 'Erro ao exportar Excel')
    } finally {
      setExportandoExcel(false)
    }
  }

  async function gerarPdfFiscal() {
    if (!empresa || abaAtiva !== 'entradas_saidas') return
    setGerandoPdf(true)
    setErroRel(null)
    try {
      await runTask({
        title: 'Gerando PDF do relatório fiscal',
        runningMessage: 'O resumo sintético está sendo preparado.',
        successTitle: 'PDF do relatório pronto',
        errorTitle: 'Erro ao gerar PDF',
      }, async () => {
        const documentos = (await buscarFiscalParaExcel({ nivel: 'documento', resumido: false })).filter(isDocumentoFiscal)
        if (documentos.length === 0) throw new Error('Não há documentos para gerar o PDF.')
        const somenteNfse = documentos.every(doc => ehNfseFiscal(doc))
        const { gerarRelatorioFiscalSintetico } = await import('@/lib/pdf/gerarRelatorioFiscalSintetico')
        const soma = (campo: keyof RelatorioFiscalDocumento) => documentos.reduce((total, doc) => total + Number(doc[campo] ?? 0), 0)
        const dataGeracao = new Date()
        const linhas = documentos.map(doc => ({
            data: dataFiscal(doc.data_emissao),
            documento: doc.numero ?? 'Não informado',
            tipo_documento: ehNfseFiscal(doc) ? 'NFS-e' : doc.modelo === '65' ? 'NFC-e' : 'NF-e',
            participante: participanteFiscal(doc),
            valor_total: Number(doc.valor_total ?? 0),
            tributo: ehNfseFiscal(doc) ? 'ISS' : 'ICMS',
            valor_tributo: ehNfseFiscal(doc) ? doc.valor_iss ?? 0 : doc.valor_icms ?? null,
            situacao_tributo: ehNfseFiscal(doc)
              ? situacaoIssFiscal(doc)
              : LABEL_SITUACAO_TRIBUTO[doc.situacao_icms ?? 'nao_informado'] ?? 'Não informado',
            divergencia: Boolean(doc.tem_divergencia || doc.dados_incompletos),
          }))
        const blob = await gerarRelatorioFiscalSintetico({
          empresa: empresa.razao_social,
          cnpj: empresa.cnpj ?? '',
          periodo: `${compInicio || 'início'} até ${compFim || compInicio || 'fim'}`,
          tipo: somenteNfse
            ? tipoMov === 'entrada' ? 'Relatório de serviços tomados' : 'Relatório de serviços prestados'
            : tipoMov === 'entrada' ? 'Relatório de entradas' : tipoMov === 'saida' ? 'Relatório de saídas' : 'Relatório de entradas e saídas',
          filtros: filtrosAtivosRelatorio,
          gerado_em: dataGeracao.toLocaleString('pt-BR'),
          totais: {
            documentos: documentos.length,
            valor_operacoes: soma('valor_total'),
            base_icms: soma('base_icms'),
            icms: soma('valor_icms'),
            st: soma('valor_st'),
            ipi: soma('valor_ipi'),
            pis: soma('valor_pis'),
            cofins: soma('valor_cofins'),
            base_iss: soma('base_iss'),
            iss: soma('valor_iss'),
            iss_retido: soma('valor_iss_retido'),
            divergencias: documentos.filter(doc => doc.tem_divergencia).length,
            incompletos: documentos.filter(doc => doc.dados_incompletos).length,
          },
          linhas,
          observacao: 'O PDF apresenta todos os documentos correspondentes aos filtros aplicados, incluindo NFS-e com ISS. O Excel contém também os itens analíticos, os serviços e o resumo por CFOP.',
        })
        return {
          message: 'Clique para baixar o resumo fiscal em PDF.',
          action: {
            type: 'download' as const,
            filename: nomeArquivoExcel().replace(/\.xlsx$/i, '.pdf'),
            mimeType: 'application/pdf',
            blob,
          },
        }
      })
    } catch (err) {
      setErroRel(err instanceof Error ? err.message : 'Erro ao gerar PDF')
    } finally {
      setGerandoPdf(false)
    }
  }

  function limparFiltrosRelatorio() {
    setCompInicio('')
    setCompFim('')
    setTipoMov('')
    setFiltroNcm('')
    setFiltroCfop('')
    setFiltroParticipante('')
    setFiltroNota('')
    filtrosRef.current = { ncm: '', cfop: '', participante: '', nota: '' }
    setFiltrosAplicados({ ncm: '', cfop: '', participante: '', nota: '' })
    setPaginaRel(1)
  }

  const filtrosAtivosRelatorio = [
    compInicio ? `De ${compInicio}` : '',
    compFim ? `Até ${compFim}` : '',
    tipoMov ? (tipoMov === 'entrada' ? 'Entradas' : 'Saídas') : '',
    filtrosAplicados.ncm ? `NCM: ${filtrosAplicados.ncm}` : '',
    filtrosAplicados.cfop ? `CFOP: ${filtrosAplicados.cfop}` : '',
    filtrosAplicados.participante ? `Participante: ${filtrosAplicados.participante}` : '',
    filtrosAplicados.nota ? `Nota: ${filtrosAplicados.nota}` : '',
  ].filter(Boolean)

  return (
    <div style={S.page}>
      <PageHeader
        title="Relatórios"
        subtitle="Gere relatórios fiscais, cadastrais e gerenciais com base nos XMLs, SPEDs e apurações importadas."
      />

      {/* Barra de abas */}
      <div style={S.tabBar}>
        {ABAS.map(({ key, label, icon }) => (
          <button key={key} style={tabStyle(key)} onClick={() => setAbaAtiva(key)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {label}</span>
          </button>
        ))}
      </div>

      {/* ── ABA: INCONSISTÊNCIAS ──────────────────────────────────────────────── */}
      {abaAtiva === 'inconsistencias' && (
        <>
          {/* Filtros alertas */}
          <div style={S.filterRow}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Filtrar por</span>
            <input style={S.input} type="month" placeholder="Competencia inicial" value={compInicio} onChange={e => setCompInicio(e.target.value)} title="Competencia inicial" />
            <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>ate</span>
            <input style={S.input} type="month" placeholder="Competencia final" value={compFim} onChange={e => setCompFim(e.target.value)} title="Competencia final" />
            <select style={S.select} value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)}>
              <option value="">Todos os níveis</option>
              {NIVEIS.slice(1).map(n => <option key={n} value={n}>{LABEL_NIVEL[n] ?? n}</option>)}
            </select>
            <select style={S.select} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {STATUS.slice(1).map(s => <option key={s} value={s}>{LABEL_STATUS[s]}</option>)}
            </select>
            {!loadingAlert && (
              <span style={{ fontSize: 12, color: 'var(--af-muted)', marginLeft: 4 }}>
                {alertas.length} resultado{alertas.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <GlassCard style={{ marginBottom: 16 }} padding="0">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--af-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={15} color="var(--af-primary)" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--af-text)' }}>Divergencias PGDAS x XML</div>
                  <div style={{ fontSize: 11, color: 'var(--af-muted)', marginTop: 2 }}>Competencias com diferenca no confronto do Simples e notas candidatas para revisao.</div>
                </div>
              </div>
              <button style={btnAcao('var(--af-primary)')} onClick={carregarDivergenciasSimples} disabled={loadingDivSimples}>
                {loadingDivSimples ? 'Consultando...' : 'Consultar'}
              </button>
            </div>

            {erroDivSimples && (
              <div style={{ padding: 14, color: 'var(--af-danger)', fontSize: 12, fontWeight: 700 }}>
                {erroDivSimples}
              </div>
            )}

            {!erroDivSimples && loadingDivSimples && (
              <div style={{ padding: 14, color: 'var(--af-muted)', fontSize: 12 }}>Carregando divergencias do Simples...</div>
            )}

            {!erroDivSimples && !loadingDivSimples && divergenciasSimples.length === 0 && (
              <div style={{ padding: 14, color: 'var(--af-muted)', fontSize: 12 }}>Nenhuma divergencia PGDAS x XML encontrada para os filtros.</div>
            )}

            {!erroDivSimples && !loadingDivSimples && divergenciasSimples.length > 0 && (
              <div
                key={`${abaAtiva}-${resumidoFiscal ? 'resumido' : 'detalhado'}-${ordemFiscal}-${paginaRel}-${compInicio}-${compFim}-${tipoMov}-${filtrosAplicados.ncm}-${filtrosAplicados.cfop}-${filtrosAplicados.participante}-${filtrosAplicados.nota}`}
                style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
              >
                <table style={{ ...S.table, minWidth: 980 }}>
                  <thead>
                    <tr>
                      <th style={S.th}>Competencia</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>PGDAS</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>XML considerado</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Diferenca</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Variacao</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Docs</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Candidatas</th>
                      <th style={S.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divergenciasSimples.map(div => {
                      const aberta = divSimplesExpandida === div.competencia
                      const cor = div.status === 'critico' ? 'var(--af-danger)' : 'var(--af-warning)'
                      return (
                        <>
                          <tr key={div.competencia} style={{ cursor: 'pointer' }} onClick={() => setDivSimplesExpandida(aberta ? null : div.competencia)}>
                            <td style={{ ...S.td, fontWeight: 800, color: 'var(--af-text)' }}>{competenciaLabel(div.competencia)}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(div.receita_pgdas)}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(div.receita_xml)}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: cor, fontWeight: 800 }}>{fmoe(div.diferenca)}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: cor, fontWeight: 700 }}>{(div.variacao * 100).toFixed(2).replace('.', ',')}%</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{div.qtd_documentos}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{div.qtd_candidatos}</td>
                            <td style={S.td}>
                              <span style={chipNivel(div.status === 'critico' ? 'critico' : 'medio')}>{div.status === 'critico' ? 'Critico' : 'Divergencia'}</span>
                              <span style={{ marginLeft: 8, verticalAlign: 'middle' }}>{aberta ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
                            </td>
                          </tr>
                          {aberta && (
                            <tr>
                              <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid var(--af-border)' }}>
                                <div style={{ padding: 14, background: 'var(--af-surface-2)' }}>
                                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--af-text)', marginBottom: 8 }}>Notas candidatas</div>
                                  {div.candidatos.length === 0 ? (
                                    <div style={{ fontSize: 12, color: 'var(--af-muted)' }}>Nenhuma nota candidata encontrada automaticamente.</div>
                                  ) : (
                                    <table style={{ ...S.table, minWidth: 900 }}>
                                      <thead>
                                        <tr>
                                          <th style={S.th}>Nota</th>
                                          <th style={S.th}>Data</th>
                                          <th style={S.th}>Participante</th>
                                          <th style={S.th}>CFOPs</th>
                                          <th style={S.th}>Motivo</th>
                                          <th style={{ ...S.th, textAlign: 'right' }}>Valor</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {div.candidatos.map(c => (
                                          <tr key={`${div.competencia}-${c.documento_id}`}>
                                            <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-text)' }}>{c.numero}</td>
                                            <td style={S.td}>{dataFiscal(c.data_emissao)}</td>
                                            <td style={S.td}>{c.participante}</td>
                                            <td style={S.td}>{c.cfops || '-'}</td>
                                            <td style={S.td}>{c.motivo}</td>
                                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmoe(c.valor)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          {!empresa && (
            <GlassCard style={{ marginBottom: 16 }}>
              <EmptyState icon={<Building2 size={22} />} title="Nenhuma empresa selecionada" description="Selecione uma empresa na barra lateral para filtrar os alertas." />
            </GlassCard>
          )}

          {loadingAlert && <div style={{ color: 'var(--af-muted)', fontSize: 13 }}>Carregando alertas...</div>}

          {!loadingAlert && alertas.length === 0 && (
            <GlassCard>
              <EmptyState title="Nenhum alerta encontrado" description="Não há alertas com os filtros selecionados." />
            </GlassCard>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alertasPagina.map(a => {
              const cor = COR_NIVEL[a.nivel_risco] ?? 'var(--af-text)'
              const aberto = expandido === a.id
              return (
                <div key={a.id} style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderLeft: `3px solid ${cor}`, borderRadius: '0 8px 8px 0', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', justifyContent: 'space-between' }} onClick={() => setExpandido(aberto ? null : a.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <span style={chipNivel(a.nivel_risco)}>{LABEL_NIVEL[a.nivel_risco] ?? a.nivel_risco}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--af-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{a.titulo}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--af-muted)', whiteSpace: 'nowrap' as const }}>
                        {(a.empresa as { razao_social?: string } | undefined)?.razao_social ?? ''}{a.competencia ? ` · ${a.competencia}` : ''}
                      </span>
                      {aberto ? <ChevronUp size={14} color="var(--af-muted)" /> : <ChevronDown size={14} color="var(--af-muted)" />}
                    </div>
                  </div>
                  {aberto && (
                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--af-border)' }} onClick={e => e.stopPropagation()}>
                      <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--af-muted)', lineHeight: 1.55 }}>{a.descricao}</p>
                      {a.valor_impacto !== undefined && a.valor_impacto !== null && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--af-warning)', fontWeight: 600 }}>
                          Impacto estimado: R$ {a.valor_impacto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                      {Object.keys(a.detalhe ?? {}).length > 0 && (
                        <div style={{ marginTop: 10, background: 'var(--af-surface-2)', borderRadius: 6, padding: '10px 12px' }}>
                          <pre style={{ margin: 0, fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--af-muted)' }}>{JSON.stringify(a.detalhe, null, 2)}</pre>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        {a.status !== 'em_analise'  && <button style={btnAcao('var(--af-warning)')} onClick={() => atualizarStatus(a.id, 'em_analise')}>Em análise</button>}
                        {a.status !== 'resolvido'   && <button style={btnAcao('var(--af-success)')} onClick={() => atualizarStatus(a.id, 'resolvido')}>Resolvido</button>}
                        {a.status !== 'descartado'  && <button style={btnAcao('var(--af-muted)')}   onClick={() => atualizarStatus(a.id, 'descartado')}>Descartar</button>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <PaginationControls
            total={alertas.length}
            page={paginaRel}
            pageSize={pageSizeRel}
            onPageChange={setPaginaRel}
            onPageSizeChange={trocarPageSizeRel}
          />
        </>
      )}

      {/* ── FILTROS COMPARTILHADOS (abas de relatórios) ───────────────────────── */}
      {abaAtiva !== 'inconsistencias' && (
        <>
          <div style={S.filterRow}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Filtros</span>
            <input style={S.input} type="month" placeholder="Competência inicial" value={compInicio} onChange={e => setCompInicio(e.target.value)} title="Competência inicial" />
            <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>até</span>
            <input style={S.input} type="month" placeholder="Competência final" value={compFim} onChange={e => setCompFim(e.target.value)} title="Competência final" />
            <select style={S.select} value={tipoMov} onChange={e => setTipoMov(e.target.value)}>
              <option value="">Entradas e Saídas</option>
              <option value="entrada">Somente Entradas</option>
              <option value="saida">Somente Saídas</option>
            </select>
            <button style={S.btnAplicar} onClick={() => {
              if (abaFiscal) {
                const comNcmCfop = abaAtiva === 'produtos' || abaAtiva === 'cfop'
                const novosFiltros = {
                  ncm: comNcmCfop ? filtroNcm : '',
                  cfop: comNcmCfop ? filtroCfop : '',
                  participante: filtroParticipante,
                  nota: filtroNota,
                }
                filtrosRef.current = novosFiltros
                setFiltrosAplicados(novosFiltros)
                void carregarRelatorioFiscal()
              } else {
                void carregarRelatorio()
              }
            }}>Consultar</button>
            <button
              style={{ ...S.btnAplicar, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--af-surface-2)', border: '1px solid var(--af-border)', color: 'var(--af-text)' }}
              onClick={exportarExcel}
              disabled={exportandoExcel || !empresa}
            >
              <Download size={13} /> {exportandoExcel ? 'Gerando...' : 'Excel'}
            </button>
            {abaAtiva === 'entradas_saidas' && (
              <button
                style={{ ...S.btnAplicar, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--af-surface-2)', border: '1px solid var(--af-border)', color: 'var(--af-text)' }}
                onClick={gerarPdfFiscal}
                disabled={gerandoPdf || !empresa}
              >
                <FileText size={13} /> {gerandoPdf ? 'Gerando...' : 'PDF'}
              </button>
            )}
            <button
              style={{ ...S.btnAplicar, background: 'transparent', border: '1px solid var(--af-border)', color: 'var(--af-muted)' }}
              onClick={limparFiltrosRelatorio}
            >
              Limpar todos
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '-8px 0 16px' }}>
            {filtrosAtivosRelatorio.map(filtro => (
              <span key={filtro} style={{ border: '1px solid rgba(39,199,216,.28)', background: 'rgba(39,199,216,.08)', color: 'var(--af-text-soft)', borderRadius: 999, padding: '4px 9px', fontSize: 10.5, fontWeight: 700 }}>
                {filtro}
              </span>
            ))}
            {!loadingRel && abaFiscal && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--af-muted)' }}>{totalFiscal} resultado(s)</span>}
          </div>

          {abaFiscal && (
            <div style={{ ...S.filterRow, marginTop: -8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Busca</span>
              {(abaAtiva === 'produtos' || abaAtiva === 'cfop') && (
                <>
                  <input style={{ ...S.input, width: 110 }} type="text" placeholder="NCM" value={filtroNcm} onChange={e => setFiltroNcm(e.target.value)} title="Filtrar por NCM" />
                  <input style={{ ...S.input, width: 80 }} type="text" placeholder="CFOP" value={filtroCfop} onChange={e => setFiltroCfop(e.target.value)} title="Filtrar por CFOP" />
                </>
              )}
              <input style={{ ...S.input, width: 200 }} type="text" placeholder="Fornecedor/Cliente" value={filtroParticipante} onChange={e => setFiltroParticipante(e.target.value)} title="Filtrar por fornecedor ou cliente (nome ou CNPJ)" />
              <input style={{ ...S.input, width: 200 }} type="text" placeholder="Nota ou chave de acesso" value={filtroNota} onChange={e => setFiltroNota(e.target.value)} title="Filtrar por número da nota ou chave de acesso" />
              <span style={{ fontSize: 10, color: 'var(--af-muted)' }}>↵ Clique Consultar para aplicar</span>
            </div>
          )}

          {abaFiscal && (
            <div style={{ ...S.filterRow, marginTop: -8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Visualização</span>
              {abaAtiva === 'cfop' ? (
                <span style={{ fontSize: 12, color: 'var(--af-text-soft)' }}>Resumo por CFOP</span>
              ) : (
                <>
                  <select
                    style={S.select}
                    value={resumidoFiscal ? 'resumido' : 'detalhado'}
                    onChange={e => {
                      setResumidoFiscal(e.target.value === 'resumido')
                      setPaginaRel(1)
                    }}
                  >
                    <option value="detalhado">Detalhado</option>
                    <option value="resumido">Resumido</option>
                  </select>
                  {resumidoFiscal && (
                    <select
                      style={S.select}
                      value={ordemFiscal}
                      onChange={e => {
                        setOrdemFiscal(e.target.value as OrdemFiscal)
                        setPaginaRel(1)
                      }}
                    >
                      {abaAtiva === 'entradas_saidas' && <option value="documento">Agrupar por documento</option>}
                      {abaAtiva === 'entradas_saidas' && <option value="participante">Agrupar por cliente/fornecedor</option>}
                      <option value="dia">Agrupar por dia</option>
                      {abaAtiva === 'produtos' && <option value="produto">Agrupar por produto</option>}
                      {abaAtiva === 'produtos' && <option value="ncm">Agrupar por NCM</option>}
                      {abaAtiva === 'produtos' && <option value="aliquota">Agrupar por alíquota</option>}
                      {abaAtiva === 'produtos' && <option value="cst">Agrupar por CST/CSOSN</option>}
                    </select>
                  )}
                </>
              )}
              {totalizadoresFiscal && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--af-muted)' }}>
                  Total exibido: <strong style={{ color: 'var(--af-primary)' }}>{fmoe(totalizadoresFiscal.valor_contabil)}</strong>
                </span>
              )}
            </div>
          )}

          {!empresa && (
            <GlassCard>
              <EmptyState icon={<Building2 size={22} />} title="Nenhuma empresa selecionada" description="Selecione uma empresa na barra lateral para gerar relatórios." />
            </GlassCard>
          )}

          {erroRel && empresa && (
            <div style={{ marginBottom: 16, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.28)', borderRadius: 8, padding: '10px 12px', color: 'var(--af-danger)', fontSize: 13, fontWeight: 600 }}>
              Erro ao carregar relatório: {erroRel}
            </div>
          )}
        </>
      )}

      {abaFiscal && empresa && (
        <GlassCard
          title={tituloRelatorioFiscal}
          padding="0"
        >
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : linhasFiscal.length === 0 ? (
            <EmptyState title="Sem dados" description="Nenhuma movimentação encontrada com os filtros aplicados." />
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                {resumidoFiscal ? (
                  <table style={{ ...S.table, minWidth: 860 }}>
                    <thead><tr>
                      <th style={S.th}>CompetÃªncia</th>
                      <th style={S.th}>Grupo</th>
                      <th style={S.th}>Movimento</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Qtd.</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Docs</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Valor Contábil</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Base ICMS</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>ICMS</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>ST</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>IPI</th>
                      {temNfseNoRelatorio && <th style={{ ...S.th, textAlign: 'right' }}>Serviços</th>}
                      {temNfseNoRelatorio && <th style={{ ...S.th, textAlign: 'right' }}>Base ISS</th>}
                      {temNfseNoRelatorio && <th style={{ ...S.th, textAlign: 'right' }}>ISS</th>}
                      {temNfseNoRelatorio && <th style={{ ...S.th, textAlign: 'right' }}>ISS retido</th>}
                    </tr></thead>
                    <tbody>
                      {linhasFiscal.filter(isResumoFiscal).map((r, i) => (
                        <tr key={`${r.grupo}-${i}`}>
                          <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-muted)' }}>{r.competencia ? competenciaLabel(r.competencia) : 'â€”'}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-text)' }}>{r.grupo_label}</td>
                          <td style={{ ...S.td, textTransform: 'capitalize' as const }}>{r.tipo_movimento || '—'}</td>
                          <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{r.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                          <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{r.documentos.toLocaleString('pt-BR')}</td>
                          <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: 'var(--af-primary)' }}>{fmoe(r.valor_contabil)}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.base_icms)}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.valor_icms)}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.valor_st)}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.valor_ipi)}</td>
                          {temNfseNoRelatorio && <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.valor_servicos)}</td>}
                          {temNfseNoRelatorio && <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.base_iss)}</td>}
                          {temNfseNoRelatorio && <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.valor_iss)}</td>}
                          {temNfseNoRelatorio && <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.valor_iss_retido)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : abaAtiva === 'produtos' ? (
                  <table style={{ ...S.table, minWidth: 1060, tableLayout: 'fixed' }}>
                    <thead><tr>
                      <th style={{ ...S.th, width: 86 }}>Data</th>
                      <th style={{ ...S.th, width: 72 }}>Nota</th>
                      <th style={{ ...S.th, width: 170 }}>Cliente/Fornecedor</th>
                      <th style={{ ...S.th, width: 240 }}>{temNfseNoRelatorio ? 'Produto / Serviço' : 'Produto'}</th>
                      <th style={{ ...S.th, width: 88 }}>{temNfseNoRelatorio ? 'NCM / Serviço' : 'NCM'}</th>
                      <th style={{ ...S.th, width: 76 }}>{temNfseNoRelatorio ? 'CFOP / Cód. mun.' : 'CFOP'}</th>
                      <th style={{ ...S.th, width: 78 }}>{temNfseNoRelatorio ? 'CST / Município' : 'CST'}</th>
                      <th style={{ ...S.th, width: 62, textAlign: 'right' }}>Qtd.</th>
                      <th style={{ ...S.th, width: 100, textAlign: 'right' }}>Valor</th>
                      <th style={{ ...S.th, width: 92, textAlign: 'right' }}>{temNfseNoRelatorio ? 'Base ICMS / ISS' : 'Base ICMS'}</th>
                      <th style={{ ...S.th, width: 64, textAlign: 'right' }}>Alíq.</th>
                      <th style={{ ...S.th, width: 86, textAlign: 'right' }}>{temNfseNoRelatorio ? 'ICMS / ISS' : 'ICMS'}</th>
                    </tr></thead>
                    <tbody>
                      {linhasFiscal.filter(isProdutoFiscal).map(p => {
                        const doc = docProduto(p)
                        const ehServico = ehNfseFiscal(doc)
                        return (
                          <tr key={p.id}>
                            <td style={S.td}>{dataFiscal(doc?.data_emissao)}</td>
                            <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{doc?.numero || '—'}</td>
                            <td style={{ ...S.td, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35 }}>{participanteFiscal(doc)}</td>
                            <td style={{ ...S.td, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35 }}>{p.descricao || '—'}</td>
                            <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{ehServico ? (doc?.codigo_servico || p.codigo_produto || '—') : (p.ncm || '—')}</td>
                            <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{ehServico ? (doc?.codigo_tributacao_municipio || '—') : (p.cfop || '—')}</td>
                            <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{ehServico ? (doc?.municipio_codigo || '—') : (p.cst_icms || p.csosn || '—')}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{Number(p.quantidade ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: 'var(--af-primary)' }}>{fmoe(Number(p.valor_total ?? 0))}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{ehServico ? fmoe(Number(doc?.base_iss ?? 0)) : tributoFiscal(p.valor_bc_icms, p.cst_icms || p.csosn ? 'zero' : 'nao_informado')}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{ehServico ? `${Number(doc?.aliquota_iss ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%` : p.aliquota_icms === null ? '—' : `${Number(p.aliquota_icms ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{ehServico ? fmoe(Number(doc?.valor_iss ?? 0)) : tributoFiscal(p.valor_icms, p.cst_icms || p.csosn ? 'zero' : 'nao_informado')}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table style={{ ...S.table, minWidth: 956, tableLayout: 'fixed' }}>
                    <thead><tr>
                      <th style={{ ...S.th, width: 34 }} aria-label="Expandir itens" />
                      <th style={{ ...S.th, width: 86 }}>{cabecalhoOrdenavel('Data', 'data_emissao')}</th>
                      <th style={{ ...S.th, width: 76 }}>{cabecalhoOrdenavel('Nota', 'numero')}</th>
                      <th style={{ ...S.th, width: 90 }}>Movimento</th>
                      <th style={{ ...S.th, width: 220 }}>{cabecalhoOrdenavel('Cliente/Fornecedor', 'participante')}</th>
                      <th style={{ ...S.th, width: 60, textAlign: 'right' }}>Itens</th>
                      <th style={{ ...S.th, width: 110, textAlign: 'right' }}>{cabecalhoOrdenavel('Valor', 'valor_total')}</th>
                      <th style={{ ...S.th, width: 105, textAlign: 'right' }}>{temNfseNoRelatorio ? 'Base ICMS / ISS' : 'Base ICMS'}</th>
                      <th style={{ ...S.th, width: 105, textAlign: 'right' }}>{temNfseNoRelatorio ? 'ICMS / ISS' : cabecalhoOrdenavel('ICMS', 'valor_icms')}</th>
                      <th style={{ ...S.th, width: 90 }}>Auditoria</th>
                    </tr></thead>
                    <tbody>
                      {linhasFiscal.filter(isDocumentoFiscal).map(d => [
                        <tr key={`${d.id}-documento`}>
                          <td style={{ ...S.td, paddingLeft: 9, paddingRight: 4 }}>
                            <button type="button" onClick={() => void alternarDocumento(d)} title="Visualizar itens vinculados" style={{ border: 0, background: 'transparent', color: 'var(--af-primary)', cursor: 'pointer', padding: 3, display: 'inline-flex' }}>
                              {documentoExpandido === d.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                          </td>
                          <td style={S.td}>{dataFiscal(d.data_emissao)}</td>
                          <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }} title={`${ehNfseFiscal(d) ? 'NFS-e' : 'NF-e/NFC-e'} · Série ${d.serie || '—'} · Modelo ${d.modelo || '—'}`}>{d.numero || '—'}</td>
                          <td style={{ ...S.td, textTransform: 'capitalize' as const }}>{movimentoFiscal(d)}</td>
                          <td style={{ ...S.td, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.35 }}>{participanteFiscal(d)}</td>
                          <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{d.itens_count ?? '—'}</td>
                          <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: 'var(--af-primary)' }}>{fmoe(Number(d.valor_total ?? 0))}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{ehNfseFiscal(d) ? fmoe(Number(d.base_iss ?? 0)) : tributoFiscal(d.base_icms, d.dados_incompletos ? 'nao_informado' : 'itens')}</td>
                          <td style={{ ...S.td, textAlign: 'right', color: !ehNfseFiscal(d) && d.situacao_icms === 'divergente' ? 'var(--af-danger)' : undefined }} title={ehNfseFiscal(d) ? `${situacaoIssFiscal(d)} · ISS retido: ${fmoe(Number(d.valor_iss_retido ?? 0))}` : `${LABEL_SITUACAO_TRIBUTO[d.situacao_icms ?? 'nao_informado'] ?? 'Não informado'} · Cabeçalho: ${fmoe(Number(d.valor_icms_cabecalho ?? 0))} · Itens: ${fmoe(Number(d.valor_icms_itens ?? 0))}`}>{ehNfseFiscal(d) ? fmoe(Number(d.valor_iss ?? 0)) : tributoFiscal(d.valor_icms, d.situacao_icms)}</td>
                          <td style={S.td} title={d.divergencias?.join(' ')}>
                            {d.tem_divergencia
                              ? <span style={{ color: 'var(--af-danger)', fontSize: 11, fontWeight: 800 }}>Revisar</span>
                              : d.dados_incompletos
                                ? <span style={{ color: 'var(--af-warning)', fontSize: 11, fontWeight: 800 }}>Incompleto</span>
                                : <span style={{ color: 'var(--af-success)', fontSize: 11, fontWeight: 800 }}>Conciliado</span>}
                          </td>
                        </tr>,
                        documentoExpandido === d.id && (
                          <tr key={`${d.id}-itens`}>
                            <td colSpan={10} style={{ padding: 0, background: 'var(--af-surface-2)', borderBottom: '1px solid var(--af-border)' }}>
                              {carregandoItensDocumento === d.id ? (
                                <div style={{ padding: 16, color: 'var(--af-muted)', fontSize: 12 }}>Carregando itens...</div>
                              ) : (itensDocumento[d.id] ?? []).length === 0 ? (
                                <div style={{ padding: 16, color: 'var(--af-warning)', fontSize: 12 }}>Nenhum item estruturado ou legado foi localizado para este documento.</div>
                              ) : (
                                <div style={{ padding: 12, overflowX: 'auto' }}>
                                  <table style={{ ...S.table, minWidth: 850 }}>
                                    <thead><tr>
                                      {ehNfseFiscal(d) ? <>
                                        <th style={S.th}>Item</th><th style={S.th}>Descrição do serviço</th><th style={S.th}>Item serviço</th><th style={S.th}>Cód. municipal</th><th style={S.th}>Município (IBGE)</th>
                                        <th style={{ ...S.th, textAlign: 'right' }}>Valor serviço</th><th style={{ ...S.th, textAlign: 'right' }}>Base ISS</th><th style={{ ...S.th, textAlign: 'right' }}>ISS</th>
                                      </> : <>
                                        <th style={S.th}>Item</th><th style={S.th}>Descrição</th><th style={S.th}>NCM</th><th style={S.th}>CFOP</th><th style={S.th}>CST/CSOSN</th>
                                        <th style={{ ...S.th, textAlign: 'right' }}>Valor</th><th style={{ ...S.th, textAlign: 'right' }}>Base ICMS</th><th style={{ ...S.th, textAlign: 'right' }}>ICMS</th>
                                      </>}
                                    </tr></thead>
                                    <tbody>{(itensDocumento[d.id] ?? []).map(item => (
                                      <tr key={item.id}>
                                        <td style={S.td}>{item.item_numero ?? '—'}</td>
                                        {ehNfseFiscal(d) ? <>
                                          <td style={{ ...S.td, whiteSpace: 'normal', lineHeight: 1.35 }}>{d.discriminacao_servico || item.descricao || 'Não informado'}</td>
                                          <td style={S.td}>{d.codigo_servico || item.codigo_produto || '—'}</td>
                                          <td style={S.td}>{d.codigo_tributacao_municipio || '—'}</td>
                                          <td style={S.td}>{d.municipio_codigo || '—'}</td>
                                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(d.valor_servicos ?? item.valor_total ?? 0))}</td>
                                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(d.base_iss ?? 0))}</td>
                                          <td style={{ ...S.td, textAlign: 'right' }} title={`${situacaoIssFiscal(d)} · Alíquota ${Number(d.aliquota_iss ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% · Retido ${fmoe(Number(d.valor_iss_retido ?? 0))}`}>{fmoe(Number(d.valor_iss ?? 0))}</td>
                                        </> : <>
                                          <td style={S.td}>{item.descricao || 'Não informado'}</td>
                                          <td style={S.td}>{item.ncm || '—'}</td>
                                          <td style={S.td}>{item.cfop || '—'}</td>
                                          <td style={S.td}>{item.cst_icms || item.csosn || '—'}</td>
                                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(item.valor_total ?? 0))}</td>
                                          <td style={{ ...S.td, textAlign: 'right' }}>{tributoFiscal(item.valor_bc_icms, item.cst_icms || item.csosn ? 'zero' : 'nao_informado')}</td>
                                          <td style={{ ...S.td, textAlign: 'right' }}>{tributoFiscal(item.valor_icms, item.cst_icms || item.csosn ? 'zero' : 'nao_informado')}</td>
                                        </>}
                                      </tr>
                                    ))}</tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        ),
                      ])}
                    </tbody>
                  </table>
                )}
              </div>
              <PaginationControls
                total={totalFiscal}
                page={paginaRel}
                pageSize={pageSizeRel}
                onPageChange={setPaginaRel}
                onPageSizeChange={trocarPageSizeRel}
                pageSizeOptions={[25, 50, 100, 250, 500]}
              />
            </>
          )}
        </GlassCard>
      )}

      {/* ── ABA: DOCUMENTOS ──────────────────────────────────────────────────── */}
      {abaAtiva === 'documentos' && empresa && (
        <GlassCard title="Quantidade de documentos por competência" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : dadosMensais.length === 0 ? (
            <EmptyState title="Sem dados" description="Nenhum documento encontrado com os filtros aplicados." />
          ) : (
            <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Competência</th>
                <th style={S.th}>Origem</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Entradas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd. Entradas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Saídas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd. Saídas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Total</th>
              </tr></thead>
              <tbody>
                {dadosMensaisPagina.map((d, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{competenciaLabel(d.competencia)}</td>
                    <td style={S.td}>{d.origem || '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-primary)' }}>{fmoe(d.total_entrada)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{d.count_entrada}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-accent)' }}>{fmoe(d.total_saida)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{d.count_saida}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmoe(d.total_entrada + d.total_saida)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls total={dadosMensais.length} page={paginaRel} pageSize={pageSizeRel} onPageChange={setPaginaRel} onPageSizeChange={trocarPageSizeRel} />
            </>
          )}
        </GlassCard>
      )}

      {/* ── ABA: PRODUTOS ────────────────────────────────────────────────────── */}
      {false && abaAtiva === 'produtos' && empresa && (
        <GlassCard title="Produtos mais movimentados" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : topProdutos.length === 0 ? (
            <EmptyState icon={<Package size={22} />} title="Sem dados" description="Nenhum produto encontrado com os filtros aplicados." />
          ) : (
            <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Descrição</th>
                <th style={S.th}>Competência</th>
                <th style={S.th}>Movimento</th>
                <th style={S.th}>NCM</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Ocorrências</th>
              </tr></thead>
              <tbody>
                {topProdutosPagina.map((p, i) => (
                  <tr key={i}>
                    <td style={S.td}>{p.descricao || '—'}</td>
                    <td style={S.td}>{p.competencia ? competenciaLabel(p.competencia) : '—'}</td>
                    <td style={S.td}>{p.tipo_movimento === 'entrada' ? 'Entrada' : p.tipo_movimento === 'saida' ? 'Saída' : (p.tipo_movimento || '—')}</td>
                    <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{p.ncm || '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{p.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: 'var(--af-primary)' }}>{fmoe(p.valor_total)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls total={topProdutos.length} page={paginaRel} pageSize={pageSizeRel} onPageChange={setPaginaRel} onPageSizeChange={trocarPageSizeRel} />
            </>
          )}
        </GlassCard>
      )}

      {/* ── ABA: PARTICIPANTES ───────────────────────────────────────────────── */}
      {abaAtiva === 'participantes' && empresa && (
        <GlassCard
          title={tipoParticipante === 'saida' ? 'Clientes por valor movimentado' : 'Fornecedores por valor movimentado'}
          titleRight={
            <div style={{ display: 'flex', gap: 4 }}>
              {(['entrada', 'saida'] as const).map(t => (
                <button key={t} onClick={() => setTipoParticipante(t)}
                  style={{ border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', cursor: 'pointer',
                    background: tipoParticipante === t ? 'var(--af-primary)' : 'var(--af-surface-2)',
                    color: tipoParticipante === t ? '#fff' : 'var(--af-muted)' }}>
                  {t === 'entrada' ? 'Fornecedores' : 'Clientes'}
                </button>
              ))}
            </div>
          }
          padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : participantes.length === 0 ? (
            <EmptyState icon={<Users size={22} />} title="Sem dados" description="Nenhum participante encontrado com os filtros aplicados." />
          ) : (
            <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>CNPJ</th>
                <th style={S.th}>Razão Social</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Docs</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={S.th}>Dados Receita</th>
              </tr></thead>
              <tbody>
                {participantesPagina.map((p, i) => {
                  const cache = cnpjCache[p.cnpj]
                  const razaoSocial = (cache?.dados?.razao_social as string) || p.nome || '—'
                  return (
                    <tr key={i}>
                      <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{fcnpj(p.cnpj.replace(/\D/g,''))}</td>
                      <td style={S.td}>{razaoSocial}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{p.count}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: 'var(--af-primary)' }}>{fmoe(p.valor_total)}</td>
                      <td style={S.td}>
                        {!cache && (
                          <button
                            onClick={() => consultarCnpj(p.cnpj)}
                            style={{ background: 'var(--af-primary-soft)', border: '1px solid var(--af-glass-border)', borderRadius: 5, color: 'var(--af-primary)', fontSize: 11, fontWeight: 600, padding: '3px 10px', cursor: 'pointer' }}
                          >
                            Consultar
                          </button>
                        )}
                        {cache?.status === 'carregando' && <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>Consultando…</span>}
                        {cache?.status === 'ok' && (
                          <span style={{ fontSize: 11, color: 'var(--af-success)' }}>
                            {(cache.dados?.estabelecimento as { situacao_cadastral?: { descricao?: string } } | undefined)?.situacao_cadastral?.descricao ?? 'Consultado'}
                          </span>
                        )}
                        {cache?.status === 'erro' && <span style={{ fontSize: 11, color: 'var(--af-danger)' }}>Erro na consulta</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <PaginationControls total={participantes.length} page={paginaRel} pageSize={pageSizeRel} onPageChange={setPaginaRel} onPageSizeChange={trocarPageSizeRel} />
            </>
          )}
        </GlassCard>
      )}

      {/* ── ABA: CFOP ────────────────────────────────────────────────────────── */}
      {false && abaAtiva === 'cfop' && empresa && (
        <GlassCard title="CFOPs utilizados" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : cfops.length === 0 ? (
            <EmptyState icon={<Hash size={22} />} title="Sem dados" description="Nenhum CFOP encontrado com os filtros aplicados." />
          ) : (
            <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>CFOP</th>
                <th style={S.th}>Tipo</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Itens</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Participação</th>
              </tr></thead>
              <tbody>
                {cfopsPagina.map((c, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-primary)', fontFamily: 'var(--font-geist-mono)' }}>{c.cfop}</td>
                    <td style={{ ...S.td, textTransform: 'capitalize' as const }}>{c.tipo}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{c.count.toLocaleString('pt-BR')}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmoe(c.valor_total)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{c.participacao?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls total={cfops.length} page={paginaRel} pageSize={pageSizeRel} onPageChange={setPaginaRel} onPageSizeChange={trocarPageSizeRel} />
            </>
          )}
        </GlassCard>
      )}

      {/* ── ABA: NCM ─────────────────────────────────────────────────────────── */}
      {abaAtiva === 'ncm' && empresa && (
        <GlassCard title="NCMs mais movimentados" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : ncms.length === 0 ? (
            <EmptyState icon={<Hash size={22} />} title="Sem dados" description="Nenhum NCM encontrado com os filtros aplicados." />
          ) : (
            <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>NCM</th>
                <th style={S.th}>Exemplo de produto</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Participação</th>
              </tr></thead>
              <tbody>
                {ncmsPagina.map((n, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-primary)', fontFamily: 'var(--font-geist-mono)' }}>{n.ncm || '—'}</td>
                    <td style={{ ...S.td, color: 'var(--af-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{n.descricao_exemplo || '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{n.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmoe(n.valor_total)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{n.participacao?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls total={ncms.length} page={paginaRel} pageSize={pageSizeRel} onPageChange={setPaginaRel} onPageSizeChange={trocarPageSizeRel} />
            </>
          )}
        </GlassCard>
      )}
    </div>
  )
}
