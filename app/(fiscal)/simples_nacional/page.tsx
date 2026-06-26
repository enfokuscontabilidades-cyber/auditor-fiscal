"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from 'next/navigation'
import { Upload, X, FileText, AlertTriangle, ChevronDown, ChevronRight, Trash2, Download, TrendingUp, Calculator, Settings, RefreshCw, CheckCircle2, Info, Printer } from "lucide-react"
import * as XLSX from "xlsx"
import { useEmpresaAtiva } from "@/lib/hooks/useEmpresaAtiva"
import { parsePgdasPdf } from "@/lib/simples/parsePgdas"
import { parseNfeParaDocumento, detectarCancelamento } from "@/lib/nfe/parseNfe"
import { apurarSimples } from "@/lib/simples/calcularSimples"
import { classificarCfop } from "@/lib/simples/cfopReceita"
import { extrairXmlsDeArquivos } from "@/lib/fiscal/xmlArchive"
import type { SnDeclaracao, SnParsedData, ArquivoXml, DocumentoFiscal, DocumentoFiscalItem, DocumentoFiscalItemInput, SnReceitaMensal } from "@/lib/types"
import type { ResultadoApuracao } from "@/lib/simples/calcularSimples"
import type { NfeParseResult } from "@/lib/nfe/parseNfe"
import PageHeader from "@/components/ui/PageHeader"

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S = {
  page:  { minHeight: "100vh", background: "var(--af-surface-2)", color: "var(--af-text)", padding: "28px 24px 64px", fontFamily: "'Segoe UI',system-ui,sans-serif" } as React.CSSProperties,
  inner: { maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
  card:  { background: "var(--af-surface)", border: "1px solid var(--af-border)", borderRadius: 16, padding: "20px 24px", boxShadow: "0 4px 20px rgba(15,23,42,0.06)" } as React.CSSProperties,
  th:    { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--af-muted)", textAlign: "left" as const, borderBottom: "1px solid var(--af-border)", background: "var(--af-surface-2)", whiteSpace: "nowrap" as const, letterSpacing: "0.06em", textTransform: "uppercase" as const },
  thR:   { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--af-muted)", textAlign: "right" as const, borderBottom: "1px solid var(--af-border)", background: "var(--af-surface-2)", whiteSpace: "nowrap" as const, letterSpacing: "0.06em", textTransform: "uppercase" as const },
  td:    { padding: "10px 14px", fontSize: 13, color: "var(--af-text-soft)", borderBottom: "1px solid var(--af-border)", verticalAlign: "middle" as const },
  tdNum: { padding: "10px 14px", fontSize: 13, color: "var(--af-text-soft)", borderBottom: "1px solid var(--af-border)", verticalAlign: "middle" as const, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const },
  btn:   { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 10, fontWeight: 600, fontSize: 13, padding: "9px 16px", cursor: "pointer", border: "none" } as React.CSSProperties,
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const pct   = (v: number) => (v * 100).toFixed(2).replace('.', ',') + '%'

function normalizaCnpj(cnpj: string | undefined | null) {
  return (cnpj ?? '').replace(/\D/g, '')
}

// "2025-01-15" ou "2025-01-15T..." → "01/2025"
function dataParaCompetencia(dataEmissao: string): string {
  const ymd = dataEmissao.split('T')[0].split('-')
  if (ymd.length < 2) return ''
  return `${ymd[1]}/${ymd[0]}`
}

// Retorna os N meses anteriores à competência informada (mesmo algoritmo da API)
type ParsedXmlItens = {
  documento?: {
    tipo_movimento?: unknown
    impacto_receita?: unknown
  }
  metadados?: {
    tpNF?: unknown
    emitente_cnpj?: unknown
  }
  itens?: Array<Partial<DocumentoFiscalItem>>
  itens_entrada?: Array<{ cfop?: unknown; cfop_entrada_sugerido?: unknown; descricao?: unknown; ncm?: unknown; valor_contabil?: unknown; valor_total?: unknown }>
  itens_saida?: Array<{ cfop?: unknown; descricao?: unknown; ncm?: unknown; valor_contabil?: unknown; valor_total?: unknown }>
}

function movimentoPorCfopXml(cfop: unknown): 'entrada' | 'saida' | null {
  if (typeof cfop !== 'string') return null
  const primeiro = cfop.trim().charAt(0)
  if (['1', '2', '3'].includes(primeiro)) return 'entrada'
  if (['5', '6', '7'].includes(primeiro)) return 'saida'
  return null
}

function movimentoPorItensXml(parsedData: unknown): 'entrada' | 'saida' | null {
  if (!parsedData || typeof parsedData !== 'object') return null
  const parsed = parsedData as ParsedXmlItens
  let entradas = 0
  let saidas = 0

  for (const item of parsed.itens_entrada ?? []) {
    const movimento = movimentoPorCfopXml(item.cfop_entrada_sugerido) ?? movimentoPorCfopXml(item.cfop)
    if (movimento === 'entrada') entradas++
    if (movimento === 'saida') saidas++
  }

  for (const item of parsed.itens_saida ?? []) {
    const movimento = movimentoPorCfopXml(item.cfop)
    if (movimento === 'entrada') entradas++
    if (movimento === 'saida') saidas++
  }

  for (const item of parsed.itens ?? []) {
    const movimento = movimentoPorCfopXml(item.cfop)
    if (movimento === 'entrada') entradas++
    if (movimento === 'saida') saidas++
  }

  if (entradas === 0 && saidas === 0) return null
  return saidas > entradas ? 'saida' : 'entrada'
}

function impactoPorParsedXml(parsedData: unknown): 'soma_receita' | 'reduz_receita' | 'sem_impacto' | 'pendente_revisao' | null {
  if (!parsedData || typeof parsedData !== 'object') return null
  const parsed = parsedData as ParsedXmlItens
  const impactos = (parsed.itens ?? []).map(item => item.impacto_receita).filter(Boolean)
  if (impactos.some(impacto => impacto === 'soma_receita')) return 'soma_receita'
  if (impactos.some(impacto => impacto === 'reduz_receita')) return 'reduz_receita'
  if (impactos.length > 0 && impactos.every(impacto => impacto === 'sem_impacto')) return 'sem_impacto'
  const impacto = parsed.documento?.impacto_receita
  if (impacto === 'soma_receita' || impacto === 'reduz_receita' || impacto === 'sem_impacto' || impacto === 'pendente_revisao') return impacto
  return null
}

function numeroXml(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function itensPorParsedXml(doc: DocumentoFiscal, cnpjEmpresa: string, ehIndustrial: boolean): DocumentoFiscalItem[] {
  if (!doc.parsed_data || typeof doc.parsed_data !== 'object') return []
  const parsed = doc.parsed_data as ParsedXmlItens
  const itens: DocumentoFiscalItem[] = []
  const tpNF = typeof parsed.metadados?.tpNF === 'string' ? parsed.metadados.tpNF : (doc.tipo_movimento === 'saida' ? '1' : '0')
  const emitente = typeof parsed.metadados?.emitente_cnpj === 'string' ? parsed.metadados.emitente_cnpj : doc.emitente_cnpj ?? ''

  for (const [idx, item] of (parsed.itens ?? []).entries()) {
    const cfop = typeof item.cfop === 'string' ? item.cfop : ''
    if (!cfop) continue
    const classificacao = classificarCfop(cfop, tpNF, emitente, cnpjEmpresa, ehIndustrial)
    itens.push({
      id: `${doc.id}-xml-${idx}`,
      org_id: doc.org_id,
      empresa_id: doc.empresa_id,
      documento_id: doc.id,
      item_numero: typeof item.item_numero === 'number' ? item.item_numero : idx + 1,
      codigo_produto: item.codigo_produto,
      descricao: item.descricao,
      ncm: item.ncm,
      cest: item.cest,
      cfop,
      unidade: item.unidade,
      quantidade: numeroXml(item.quantidade) || 1,
      valor_unitario: numeroXml(item.valor_unitario),
      valor_total: numeroXml(item.valor_total),
      valor_desconto: numeroXml(item.valor_desconto),
      valor_frete: numeroXml(item.valor_frete),
      cst_icms: item.cst_icms,
      csosn: item.csosn,
      valor_bc_icms: numeroXml(item.valor_bc_icms),
      aliquota_icms: numeroXml(item.aliquota_icms),
      valor_icms: numeroXml(item.valor_icms),
      valor_bc_st: numeroXml(item.valor_bc_st),
      valor_st: numeroXml(item.valor_st),
      cst_pis: item.cst_pis,
      valor_bc_pis: numeroXml(item.valor_bc_pis),
      aliquota_pis: numeroXml(item.aliquota_pis),
      valor_pis: numeroXml(item.valor_pis),
      cst_cofins: item.cst_cofins,
      valor_bc_cofins: numeroXml(item.valor_bc_cofins),
      aliquota_cofins: numeroXml(item.aliquota_cofins),
      valor_cofins: numeroXml(item.valor_cofins),
      valor_ipi: numeroXml(item.valor_ipi),
      classificacao: item.classificacao ?? 'outros',
      natureza_receita_simples: classificacao.natureza_receita_simples,
      tipo_movimento: classificacao.tipo_movimento,
      impacto_receita: classificacao.impacto_receita,
      anexo_sugerido: classificacao.anexo_sugerido ?? undefined,
      regra_aplicada: classificacao.regra_aplicada,
      classificacao_manual: item.classificacao_manual ?? false,
      created_at: doc.created_at,
    })
  }

  for (const [idx, item] of (parsed.itens_saida ?? []).entries()) {
    const cfop = typeof item.cfop === 'string' ? item.cfop : ''
    if (!cfop) continue
    const classificacao = classificarCfop(cfop, '1', emitente, cnpjEmpresa, ehIndustrial)
    itens.push({
      id: `${doc.id}-saida-${idx}`,
      org_id: doc.org_id,
      empresa_id: doc.empresa_id,
      documento_id: doc.id,
      item_numero: idx + 1,
      cfop,
      quantidade: 1,
      valor_unitario: numeroXml(item.valor_contabil ?? item.valor_total),
      valor_total: numeroXml(item.valor_contabil ?? item.valor_total),
      valor_desconto: 0,
      valor_frete: 0,
      valor_bc_icms: 0,
      aliquota_icms: 0,
      valor_icms: 0,
      valor_bc_st: 0,
      valor_st: 0,
      valor_bc_pis: 0,
      aliquota_pis: 0,
      valor_pis: 0,
      valor_bc_cofins: 0,
      aliquota_cofins: 0,
      valor_cofins: 0,
      valor_ipi: 0,
      classificacao: 'outros',
      natureza_receita_simples: classificacao.natureza_receita_simples,
      tipo_movimento: classificacao.tipo_movimento,
      impacto_receita: classificacao.impacto_receita,
      anexo_sugerido: classificacao.anexo_sugerido ?? undefined,
      regra_aplicada: classificacao.regra_aplicada,
      classificacao_manual: false,
      created_at: doc.created_at,
    })
  }

  for (const [idx, item] of (parsed.itens_entrada ?? []).entries()) {
    const cfop = typeof item.cfop_entrada_sugerido === 'string'
      ? item.cfop_entrada_sugerido
      : typeof item.cfop === 'string'
        ? item.cfop
        : ''
    if (!cfop) continue
    const classificacao = classificarCfop(cfop, '0', emitente, cnpjEmpresa, ehIndustrial)
    itens.push({
      id: `${doc.id}-entrada-${idx}`,
      org_id: doc.org_id,
      empresa_id: doc.empresa_id,
      documento_id: doc.id,
      item_numero: idx + 1,
      descricao: typeof item.descricao === 'string' ? item.descricao : undefined,
      ncm: typeof item.ncm === 'string' ? item.ncm : undefined,
      cfop,
      quantidade: 1,
      valor_unitario: numeroXml(item.valor_contabil ?? item.valor_total),
      valor_total: numeroXml(item.valor_contabil ?? item.valor_total),
      valor_desconto: 0,
      valor_frete: 0,
      valor_bc_icms: 0,
      aliquota_icms: 0,
      valor_icms: 0,
      valor_bc_st: 0,
      valor_st: 0,
      valor_bc_pis: 0,
      aliquota_pis: 0,
      valor_pis: 0,
      valor_bc_cofins: 0,
      aliquota_cofins: 0,
      valor_cofins: 0,
      valor_ipi: 0,
      classificacao: 'outros',
      natureza_receita_simples: classificacao.natureza_receita_simples,
      tipo_movimento: classificacao.tipo_movimento,
      impacto_receita: classificacao.impacto_receita,
      anexo_sugerido: classificacao.anexo_sugerido ?? undefined,
      regra_aplicada: classificacao.regra_aplicada,
      classificacao_manual: false,
      created_at: doc.created_at,
    })
  }

  return itens
}

function impactoPorItensDocumento(itens: DocumentoFiscalItem[]): 'soma_receita' | 'reduz_receita' | 'sem_impacto' | 'pendente_revisao' | null {
  if (itens.length === 0) return null
  if (itens.some(item => item.impacto_receita === 'reduz_receita')) return 'reduz_receita'
  if (itens.some(item => item.impacto_receita === 'soma_receita')) return 'soma_receita'
  if (itens.some(item => item.impacto_receita === 'pendente_revisao')) return 'pendente_revisao'
  return 'sem_impacto'
}

function competenciasAnteriores(competencia: string, meses = 12): string[] {
  const [mm, yyyy] = competencia.split('/')
  if (!mm || !yyyy) return []
  let mes = parseInt(mm, 10)
  let ano = parseInt(yyyy, 10)
  const resultado: string[] = []
  for (let i = 0; i < meses; i++) {
    mes--
    if (mes === 0) { mes = 12; ano-- }
    resultado.push(`${String(mes).padStart(2, '0')}/${ano}`)
  }
  return resultado
}

// Formata competência "MM/YYYY" como "Mês/Ano" legível (ex: "Janeiro/2024")
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
function fmtCompetencia(comp: string): string {
  const [mm, yyyy] = comp.split('/')
  if (!mm || !yyyy) return comp
  const nome = MESES_PT[parseInt(mm, 10) - 1] ?? mm
  return `${nome}/${yyyy}`
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function KpiCard({ title, value, sub, color = "var(--af-primary)" }: { title: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...S.card, padding: "16px 20px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--af-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function ChipRetif() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700, color: "var(--af-warning)", whiteSpace: "nowrap" as const }}>
      Retificadora
    </span>
  )
}

function ChipAnexo({ anexo, atividade }: { anexo: string; atividade: string }) {
  if (!anexo) return <span style={{ color: "var(--af-muted)", fontSize: 12 }}>—</span>
  return (
    <span
      title={atividade || anexo}
      style={{ display: "inline-flex", alignItems: "center", background: "rgba(39,199,216,0.10)", border: "1px solid rgba(39,199,216,0.25)", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, color: "var(--af-primary)", whiteSpace: "nowrap" as const, cursor: "help" }}
    >
      {anexo}
    </span>
  )
}

// ─── Modal de confirmação ─────────────────────────────────────────────────────

type ModalItem = { parsed: SnParsedData; fileName: string; cnpjDivergente: boolean }

function ModalConfirmarImport({
  items, cnpjEmpresa, onConfirm, onCancel, saving, saveError,
}: {
  items: ModalItem[]
  cnpjEmpresa: string | undefined
  onConfirm: () => void
  onCancel: () => void
  saving: boolean
  saveError: string | null
}) {
  const temDivergencia = items.some(i => i.cnpjDivergente)

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--af-surface)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 580, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Confirmar importação</span>
          <button onClick={onCancel} disabled={saving} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--af-muted)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {temDivergencia && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <AlertTriangle size={16} style={{ color: "var(--af-warning)", flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12 }}>
              <strong style={{ color: "var(--af-warning)" }}>CNPJ divergente</strong>
              <span style={{ color: "var(--af-text-soft)" }}> — um ou mais arquivos pertencem a um CNPJ diferente da empresa em análise</span>
              {cnpjEmpresa && <span style={{ color: "var(--af-muted)" }}> ({cnpjEmpresa})</span>}
              <span style={{ color: "var(--af-text-soft)" }}>. Verifique antes de confirmar.</span>
            </div>
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--af-muted)", marginBottom: 12 }}>
          {items.length === 1 ? "1 declaração detectada:" : `${items.length} declarações detectadas:`}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto", marginBottom: 20 }}>
          {items.map((item, i) => (
            <div key={i} style={{ ...S.card, padding: "12px 16px", borderColor: item.cnpjDivergente ? "rgba(251,191,36,0.4)" : "var(--af-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{item.parsed.periodo}</span>
                  {item.parsed.tipo_declaracao === 'Retificadora' && <ChipRetif />}
                  {item.parsed.anexo && <ChipAnexo anexo={item.parsed.anexo} atividade={item.parsed.atividade} />}
                  {item.cnpjDivergente && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 600, color: "var(--af-warning)" }}>
                      <AlertTriangle size={10} /> CNPJ diferente
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "var(--af-muted)" }}>{item.fileName}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--af-muted)", fontFamily: "monospace", marginBottom: 6 }}>{item.parsed.cnpj}</div>
              {item.cnpjDivergente && cnpjEmpresa && (
                <div style={{ fontSize: 11, color: "var(--af-warning)", marginBottom: 6 }}>Empresa em análise: {cnpjEmpresa}</div>
              )}
              <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                <span>Receita: <strong>{money.format(item.parsed.receita_bruta_mes)}</strong></span>
                <span>Imposto: <strong style={{ color: "var(--af-danger)" }}>{money.format(item.parsed.total_devido)}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {saveError && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--af-danger)" }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{saveError}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={saving} style={{ ...S.btn, background: "var(--af-surface-2)", color: "var(--af-text-soft)", opacity: saving ? 0.5 : 1 }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={saving} style={{ ...S.btn, background: temDivergencia ? "var(--af-warning)" : "var(--af-primary)", color: "#fff", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Salvando…" : temDivergencia ? "Importar mesmo assim" : "Confirmar e Salvar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tabela de declarações — linhas = períodos ────────────────────────────────

const TRIBUTOS_ORDEM = ['IRPJ', 'CSLL', 'COFINS', 'PIS/PASEP', 'INSS/CPP', 'ICMS', 'IPI', 'ISS']

function getTributo(d: SnDeclaracao, nome: string): number {
  return d.parsed_data?.tributos?.find(t => t.nome.toUpperCase() === nome.toUpperCase())?.valor ?? 0
}

function LinhaDeclaracao({ d, onDelete }: { d: SnDeclaracao; onDelete: (id: string) => void }) {
  const [expandida, setExpandida] = useState(false)
  const rb     = d.receita_bruta_mes ?? 0
  const total  = d.valor_total_devido ?? 0
  const aliq   = rb > 0 ? total / rb : 0
  const tipo   = d.parsed_data?.tipo_declaracao ?? 'Original'
  const anexo  = d.parsed_data?.anexo ?? ''
  const atividade = d.parsed_data?.atividade ?? ''

  const tributos = TRIBUTOS_ORDEM
    .map(nome => ({ nome, valor: getTributo(d, nome) }))
    .filter(t => t.valor > 0)

  return (
    <>
      <tr style={{ cursor: "pointer" }} onClick={() => setExpandida(e => !e)}>
        {/* Expand toggle */}
        <td style={{ ...S.td, width: 36, paddingRight: 0 }}>
          <span style={{ color: "var(--af-muted)", display: "flex", alignItems: "center" }}>
            {expandida ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
        </td>

        {/* Período */}
        <td style={{ ...S.td, fontWeight: 700, color: "var(--af-text)", whiteSpace: "nowrap" as const }}>
          {d.competencia}
        </td>

        {/* Tipo */}
        <td style={{ ...S.td }}>
          {tipo === 'Retificadora' ? <ChipRetif /> : (
            <span style={{ fontSize: 12, color: "var(--af-muted)" }}>Original</span>
          )}
        </td>

        {/* Anexo */}
        <td style={{ ...S.td }}>
          <ChipAnexo anexo={anexo} atividade={atividade} />
        </td>

        {/* Receita Bruta */}
        <td style={{ ...S.tdNum, fontWeight: 600, color: "var(--af-text)" }}>
          {money.format(rb)}
        </td>

        {/* Total Impostos */}
        <td style={{ ...S.tdNum, fontWeight: 600, color: "var(--af-danger)" }}>
          {money.format(total)}
        </td>

        {/* Alíquota */}
        <td style={{ ...S.tdNum, color: "var(--af-warning)", fontWeight: 600 }}>
          {pct(aliq)}
        </td>

        {/* Ações */}
        <td style={{ ...S.td, width: 40 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onDelete(d.id)}
            title="Remover declaração"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--af-muted)", padding: 4, display: "flex", alignItems: "center", borderRadius: 6 }}
          >
            <X size={14} />
          </button>
        </td>
      </tr>

      {/* Linha expandida */}
      {expandida && (
        <tr>
          <td colSpan={8} style={{ padding: "0 14px 14px 52px", borderBottom: "1px solid var(--af-border)", background: "var(--af-surface-2)" }}>
            {d.parsed_data?.atividades && d.parsed_data.atividades.length >= 2 ? (
              /* Múltiplas atividades — breakdown por atividade */
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10 }}>
                {d.parsed_data.atividades.map((atv, i) => (
                  <div key={i} style={{ background: "var(--af-surface)", border: "1px solid var(--af-border)", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" as const }}>
                      {atv.anexo
                        ? <ChipAnexo anexo={atv.anexo} atividade={atv.nome} />
                        : <span style={{ fontSize: 11, fontWeight: 600, color: "var(--af-muted)" }}>Atividade {i + 1}</span>
                      }
                      {atv.nome && (
                        <span style={{ fontSize: 11, color: "var(--af-muted)", flex: 1, overflow: "hidden" as const, textOverflow: "ellipsis", whiteSpace: "nowrap" as const, minWidth: 0 }}>
                          {atv.nome}
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--af-danger)", flexShrink: 0 }}>
                        {money.format(atv.total)}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {atv.tributos.map(t => (
                        <div key={t.nome} style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "var(--af-surface-2)", border: "1px solid var(--af-border)", borderRadius: 8, padding: "4px 12px", minWidth: 80 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 2 }}>{t.nome}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--af-text)", fontVariantNumeric: "tabular-nums" as const }}>{money.format(t.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Atividade única — chips de tributos */
              <>
                {tributos.length === 0 ? (
                  <span style={{ fontSize: 12, color: "var(--af-muted)" }}>Sem tributos registrados</span>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 10 }}>
                    {tributos.map(t => (
                      <div key={t.nome} style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "var(--af-surface)", border: "1px solid var(--af-border)", borderRadius: 10, padding: "6px 14px", minWidth: 90 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 2 }}>{t.nome}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--af-text)", fontVariantNumeric: "tabular-nums" as const }}>{money.format(t.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {atividade && (
                  <div style={{ marginTop: 10, fontSize: 11, color: "var(--af-muted)", lineHeight: 1.5 }}>
                    <strong>Atividade: </strong>{atividade}
                  </div>
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function TabelaDeclaracoes({ declaracoes, onDelete }: { declaracoes: SnDeclaracao[]; onDelete: (id: string) => void }) {
  const sorted = useMemo(
    () => [...declaracoes].sort((a, b) => b.competencia.localeCompare(a.competencia)),
    [declaracoes]
  )

  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--af-muted)", fontSize: 13 }}>
        <FileText size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
        <p>Nenhuma declaração importada.</p>
        <p style={{ fontSize: 11, marginTop: 4 }}>Clique em &quot;+ Importar PDF&quot; para começar.</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...S.th, width: 36, paddingRight: 0 }} />
            <th style={S.th}>Período</th>
            <th style={S.th}>Tipo</th>
            <th style={S.th}>Anexo</th>
            <th style={S.thR}>Receita Bruta</th>
            <th style={S.thR}>Total Impostos</th>
            <th style={S.thR}>Alíquota Efetiva</th>
            <th style={{ ...S.th, width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(d => (
            <LinhaDeclaracao key={d.id} d={d} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Aba Confronto NF-e × PGDAS ──────────────────────────────────────────────

type ItemConfronto = {
  comp: string
  receitaPgdas: number
  totalNfe: number
  qtdNfe: number
  diff: number
  diffPct: number
  status: 'ok' | 'alerta' | 'critico' | 'sem_pgdas' | 'sem_nfe'
}

type DocumentoFiscalComItens = DocumentoFiscal & {
  fa_documentos_itens?: DocumentoFiscalItem[]
}

function BadgeConfronto({ status }: { status: ItemConfronto['status'] }) {
  const cfg: Record<ItemConfronto['status'], { label: string; bg: string; border: string; color: string }> = {
    ok:        { label: 'OK',           bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)',   color: '#16a34a' },
    alerta:    { label: 'Divergência',  bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', color: 'var(--af-warning)' },
    critico:   { label: 'Crítico',      bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',   color: 'var(--af-danger)' },
    sem_pgdas: { label: 'Sem PGDAS',    bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', color: 'var(--af-muted)' },
    sem_nfe:   { label: 'Sem NF-e',     bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)', color: 'var(--af-muted)' },
  }
  const { label, bg, border, color } = cfg[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap' as const }}>
      {label}
    </span>
  )
}

function AbaConfronto({ items, carregando }: { items: ItemConfronto[]; carregando: boolean }) {
  if (carregando) {
    return (
      <div style={{ ...S.card, padding: '48px 24px', textAlign: 'center', color: 'var(--af-muted)', fontSize: 13 }}>
        Carregando NF-e…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ ...S.card, padding: '48px 24px', textAlign: 'center' }}>
        <TrendingUp size={32} style={{ color: 'var(--af-muted)', marginBottom: 12, opacity: 0.4 }} />
        <p style={{ color: 'var(--af-muted)', fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>Nenhum dado para confrontar</p>
        <p style={{ color: 'var(--af-muted)', fontSize: 12, margin: 0, lineHeight: 1.55 }}>
          Importe declarações PGDAS-D nesta página e XMLs no Validador NF-e para o mesmo período.
        </p>
      </div>
    )
  }

  const criticos = items.filter(i => i.status === 'critico').length
  const alertas  = items.filter(i => i.status === 'alerta').length

  return (
    <>
      {(criticos > 0 || alertas > 0) && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <AlertTriangle size={16} style={{ color: 'var(--af-danger)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13 }}>
            {criticos > 0 && (
              <span style={{ color: 'var(--af-danger)', fontWeight: 700 }}>
                {criticos} período(s) com divergência crítica (&gt; 5%)
              </span>
            )}
            {criticos > 0 && alertas > 0 && <span style={{ color: 'var(--af-muted)' }}> · </span>}
            {alertas > 0 && (
              <span style={{ color: 'var(--af-warning)', fontWeight: 600 }}>
                {alertas} período(s) com divergência entre 1% e 5%
              </span>
            )}
            <span style={{ color: 'var(--af-text-soft)', display: 'block', fontSize: 11, marginTop: 3 }}>
              Receita declarada no PGDAS-D vs. receita XML considerada na apuração.
            </span>
          </div>
        </div>
      )}

      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Período</th>
                <th style={S.thR}>Receita PGDAS</th>
                <th style={S.thR}>Receita XML considerada</th>
                <th style={{ ...S.th, textAlign: 'center' as const }}>Qtd. docs</th>
                <th style={S.thR}>Diferença</th>
                <th style={{ ...S.thR, paddingRight: 14 }}>Variação</th>
                <th style={{ ...S.th, textAlign: 'center' as const }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const diffPositivo = item.diff >= 0
                const corDiff = item.diff === 0 ? 'var(--af-muted)' : diffPositivo ? 'var(--af-warning)' : 'var(--af-danger)'
                const corPct = item.diffPct === 0 ? 'var(--af-muted)' : item.diffPct <= 0.01 ? '#16a34a' : item.diffPct <= 0.05 ? 'var(--af-warning)' : 'var(--af-danger)'
                const semDados = item.receitaPgdas === 0 && item.totalNfe === 0
                return (
                  <tr key={item.comp}>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-text)' }}>{item.comp}</td>
                    <td style={S.tdNum}>
                      {item.receitaPgdas > 0 ? money.format(item.receitaPgdas) : <span style={{ color: 'var(--af-muted)' }}>—</span>}
                    </td>
                    <td style={S.tdNum}>
                      {item.totalNfe > 0 ? money.format(item.totalNfe) : <span style={{ color: 'var(--af-muted)' }}>—</span>}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' as const, color: 'var(--af-text-soft)' }}>
                      {item.qtdNfe > 0 ? item.qtdNfe : <span style={{ color: 'var(--af-muted)' }}>—</span>}
                    </td>
                    <td style={{ ...S.tdNum, color: corDiff, fontWeight: 600 }}>
                      {semDados ? '—' : `${diffPositivo ? '+' : ''}${money.format(item.diff)}`}
                    </td>
                    <td style={{ ...S.tdNum, color: corPct, fontWeight: 600 }}>
                      {item.receitaPgdas > 0 ? pct(item.diffPct) : '—'}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' as const }}>
                      <BadgeConfronto status={item.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, marginTop: 12, fontSize: 11, color: 'var(--af-muted)' }}>
        <span>OK = diferença ≤ 1%</span>
        <span>Divergência = 1% a 5%</span>
        <span>Crítico = &gt; 5%</span>
        <span>XML positivo = XML &gt; PGDAS (possível sub-declaração)</span>
      </div>
    </>
  )
}

// ─── Aba Apuração pelo Sistema ────────────────────────────────────────────────

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtPct = (v: number) => `${(v * 100).toFixed(2).replace('.', ',')}%`
const fmtPctNum = (v: number) => `${v.toFixed(2).replace('.', ',')}%`

type XmlPreviewItem = {
  nomeArq: string; numero: string; emitente: string; valor: number;
  tipo_movimento: string; impacto_receita: string; chave?: string;
  doc: NfeParseResult | null
}

function chipMovimento(tipo: string) {
  const cores: Record<string, [string, string]> = {
    saida:           ['rgba(39,199,216,0.12)', 'var(--af-primary)'],
    devolucao_venda: ['rgba(251,191,36,0.12)', 'var(--af-warning)'],
    entrada:         ['rgba(52,211,153,0.12)', '#34d399'],
    remessa:         ['rgba(107,114,128,0.12)', 'var(--af-muted)'],
    transferencia:   ['rgba(107,114,128,0.12)', 'var(--af-muted)'],
    cancelamento:    ['rgba(239,68,68,0.12)', 'var(--af-danger)'],
  }
  const [bg, color] = cores[tipo] ?? ['rgba(107,114,128,0.12)', 'var(--af-muted)']
  const labels: Record<string, string> = {
    saida: 'Saída/Venda', devolucao_venda: 'Dev. Venda', entrada: 'Entrada',
    remessa: 'Remessa', transferencia: 'Transfer.', cancelamento: 'Cancelamento', outros: 'Outros',
  }
  return (
    <span style={{ background: bg, color, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' as const }}>
      {labels[tipo] ?? tipo}
    </span>
  )
}

function chipImpacto(imp: string) {
  if (imp === 'soma_receita')    return <span style={{ color: '#34d399', fontSize: 11, fontWeight: 600 }}>+ Receita</span>
  if (imp === 'reduz_receita')   return <span style={{ color: 'var(--af-danger)', fontSize: 11, fontWeight: 600 }}>− Receita</span>
  if (imp === 'sem_impacto')     return <span style={{ color: 'var(--af-muted)', fontSize: 11 }}>Sem impacto</span>
  return <span style={{ color: 'var(--af-warning)', fontSize: 11 }}>Pendente</span>
}

function RelatorioConferenciaSimples({
  xmlItens,
  declaracaoPgdas,
}: {
  xmlItens: DocumentoFiscalItem[]
  declaracaoPgdas: SnDeclaracao | null
}) {
  const valorItem = (item: DocumentoFiscalItem) => Math.max(0, (item.valor_total ?? 0) - (item.valor_desconto ?? 0))
  const itensReceita = xmlItens.filter(item => item.impacto_receita === 'soma_receita')
  const itensDevolucao = xmlItens.filter(item => item.impacto_receita === 'reduz_receita')
  const totalFaturamento = itensReceita.reduce((s, item) => s + valorItem(item), 0)
  const totalDevolucao = itensDevolucao.reduce((s, item) => s + valorItem(item), 0)
  const totalXml = totalFaturamento - totalDevolucao
  const totalPgdas = declaracaoPgdas?.receita_bruta_mes ?? null
  const diferenca = totalPgdas == null ? null : totalXml - totalPgdas

  if (xmlItens.length === 0 && !declaracaoPgdas) return null

  return (
    <div style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--af-border)' }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Conferência XML x Simples</div>
        <div style={{ fontSize: 12, color: 'var(--af-muted)', marginTop: 4 }}>
          Compara a receita considerada pelo sistema contra a receita informada no PGDAS-D.
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <KpiCard title="Faturamento XML" value={fmtBRL.format(totalFaturamento)} sub="operações de receita" />
          <KpiCard title="Devoluções XML" value={fmtBRL.format(totalDevolucao)} sub="redutor da receita" color="var(--af-danger)" />
          <KpiCard title="Receita XML considerada" value={fmtBRL.format(totalXml)} sub="faturamento - devoluções" />
          <KpiCard title="Receita PGDAS-D" value={totalPgdas == null ? '—' : fmtBRL.format(totalPgdas)} sub={declaracaoPgdas?.competencia ?? 'sem PGDAS importado'} />
          <KpiCard
            title="Diferença"
            value={diferenca == null ? '—' : fmtBRL.format(diferenca)}
            sub={diferenca == null ? 'importe o PGDAS-D para comparar' : diferenca > 0 ? 'XML maior que PGDAS-D' : 'PGDAS-D maior que XML'}
            color={diferenca && Math.abs(diferenca) > 0.01 ? 'var(--af-warning)' : 'var(--af-primary)'}
          />
        </div>
      </div>
    </div>
  )
}

function AbaApuracaoSistema({
  empresaAtiva, xmlCompetencia, setXmlCompetencia,
  xmlDocumentos, xmlItens, carregandoXmlDocs, limpandoCompetencia,
  rbt12Carregado, receitas12m,
  apuracao, apuracaoErro, declaracaoPgdas,
  onApurar, onLimparCompetencia, onIrParaValidador,
}: {
  empresaAtiva: { id: string; razao_social: string; cnpj?: string; cnae_principal?: string }
  xmlCompetencia: string
  setXmlCompetencia: (v: string) => void
  xmlDocumentos: DocumentoFiscal[]
  xmlItens: DocumentoFiscalItem[]
  carregandoXmlDocs: boolean
  limpandoCompetencia: boolean
  rbt12Carregado: number | null
  receitas12m: SnReceitaMensal[]
  apuracao: ResultadoApuracao | null
  apuracaoErro: string | null
  declaracaoPgdas: SnDeclaracao | null
  onApurar: () => void
  onLimparCompetencia: () => void
  onIrParaValidador: () => void
}) {
  const docsSomam = xmlDocumentos.filter(d => d.impacto_receita === 'soma_receita' && d.status !== 'cancelada')
  const docsReduzem = xmlDocumentos.filter(d => d.impacto_receita === 'reduz_receita' && d.status !== 'cancelada')
  const itensSomam = xmlItens.filter(i => i.impacto_receita === 'soma_receita')
  const itensReduzem = xmlItens.filter(i => i.impacto_receita === 'reduz_receita')
  const docsSomamPorItem = new Set(itensSomam.map(i => i.documento_id))
  const totalBrutoItens = itensSomam.reduce((s, i) => s + Math.max(0, (i.valor_total ?? 0) - (i.valor_desconto ?? 0)), 0)
  const totalDevItens = itensReduzem.reduce((s, i) => s + Math.max(0, (i.valor_total ?? 0) - (i.valor_desconto ?? 0)), 0)
  const totalBruto = xmlItens.length > 0 ? totalBrutoItens : docsSomam.reduce((s, d) => s + (d.valor_total ?? 0), 0)
  const totalDev = xmlItens.length > 0 ? totalDevItens : docsReduzem.reduce((s, d) => s + (d.valor_total ?? 0), 0)
  const qtdDocsSomam = xmlItens.length > 0 ? docsSomamPorItem.size : docsSomam.length
  const totalLiq = totalBruto - totalDev
  const temHistorico = receitas12m.length >= 12
  const mesesFaltantesLocal = useMemo(() => {
    if (!xmlCompetencia) return []
    const todos = competenciasAnteriores(xmlCompetencia)
    const disponiveis = new Set(receitas12m.map(r => r.competencia))
    return todos.filter(m => !disponiveis.has(m))
  }, [xmlCompetencia, receitas12m])
  const resultadoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (apuracao) {
      setTimeout(() => resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [apuracao])

  return (
    <div>
      {/* Seletor de competência + botão importar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' as const, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--af-muted)', display: 'block', marginBottom: 4 }}>COMPETÊNCIA</label>
          <input
            type="text"
            placeholder="MM/AAAA"
            value={xmlCompetencia}
            onChange={e => {
              const raw = e.target.value.replace(/\D/g, '')
              if (raw.length <= 2) setXmlCompetencia(raw)
              else if (raw.length <= 6) setXmlCompetencia(raw.slice(0, 2) + '/' + raw.slice(2))
              else setXmlCompetencia(raw.slice(0, 2) + '/' + raw.slice(2, 6))
            }}
            style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--af-text)', width: 120 }}
          />
        </div>
        {xmlDocumentos.length > 0 && (
          <button
            onClick={onApurar}
            disabled={xmlDocumentos.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(39,199,216,0.1)', color: 'var(--af-primary)', border: '1px solid rgba(39,199,216,0.3)', borderRadius: 10, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            <Calculator size={15} />
            Calcular Apuração
          </button>
        )}
        {xmlCompetencia && (
          <button
            onClick={onLimparCompetencia}
            disabled={limpandoCompetencia}
            title={`Limpar todos os XMLs e documentos de ${xmlCompetencia} para reimportar do zero`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.08)', color: 'var(--af-danger)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '9px 16px', fontWeight: 600, fontSize: 13, cursor: limpandoCompetencia ? 'wait' : 'pointer', opacity: limpandoCompetencia ? 0.6 : 1 }}
          >
            <Trash2 size={15} />
            {limpandoCompetencia ? 'Limpando…' : `Limpar ${xmlCompetencia}`}
          </button>
        )}
      </div>

      {/* Aviso sem competência */}
      {!xmlCompetencia && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--af-muted)', fontSize: 12, marginBottom: 16 }}>
          <Info size={14} />
          Informe a competência para carregar os documentos importados.
        </div>
      )}

      {/* KPIs de documentos carregados */}
      {xmlCompetencia && (
        <>
          {carregandoXmlDocs ? (
            <div style={{ color: 'var(--af-muted)', fontSize: 13, marginBottom: 16 }}>Carregando documentos…</div>
          ) : xmlDocumentos.length === 0 ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <Info size={15} style={{ color: 'var(--af-warning)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, flex: 1 }}>
                <strong style={{ color: 'var(--af-warning)' }}>Nenhum XML encontrado para {xmlCompetencia}</strong>
                <span style={{ color: 'var(--af-text-soft)', display: 'block', marginTop: 4 }}>
                  Importe os XMLs no <strong>Validador NF-e</strong> — os documentos ficam disponíveis automaticamente aqui.
                </span>
                <button
                  onClick={onIrParaValidador}
                  style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(39,199,216,0.1)', color: 'var(--af-primary)', border: '1px solid rgba(39,199,216,0.3)', borderRadius: 8, padding: '7px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                >
                  <FileText size={13} />
                  Ir para o Validador NF-e →
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
              <KpiCard title="Notas de Venda" value={String(qtdDocsSomam)} sub={fmtBRL.format(totalBruto)} />
              <KpiCard title="Receita Líquida" value={fmtBRL.format(totalLiq)} color="var(--af-primary)" />
              <KpiCard
                title="RBT12"
                value={rbt12Carregado != null ? fmtBRL.format(rbt12Carregado) : '—'}
                sub={
                  temHistorico
                    ? `${receitas12m.length} meses disponíveis`
                    : mesesFaltantesLocal.length > 0
                      ? `Faltam ${mesesFaltantesLocal.length} meses (${fmtCompetencia(mesesFaltantesLocal[mesesFaltantesLocal.length - 1])} a ${fmtCompetencia(mesesFaltantesLocal[0])})`
                      : 'Histórico não encontrado'
                }
                color={temHistorico ? 'var(--af-text)' : 'var(--af-warning)'}
              />
            </div>
          )}

          {/* Aviso de RBT12 indisponível */}
          {xmlDocumentos.length > 0 && (
            <RelatorioConferenciaSimples
              xmlItens={xmlItens}
              declaracaoPgdas={declaracaoPgdas}
            />
          )}

          {!temHistorico && rbt12Carregado == null && xmlDocumentos.length > 0 && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              <AlertTriangle size={15} style={{ color: 'var(--af-warning)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12 }}>
                <strong style={{ color: 'var(--af-warning)' }}>Histórico de receitas incompleto</strong>
                {mesesFaltantesLocal.length > 0 ? (
                  <span style={{ color: 'var(--af-text-soft)', display: 'block', marginTop: 2 }}>
                    Faltam {mesesFaltantesLocal.length} meses para o RBT12 de {xmlCompetencia}:{' '}
                    {mesesFaltantesLocal.map(fmtCompetencia).join(', ')}.
                    Importe os PGDAS-D desses meses ou informe as receitas manualmente ao clicar em &quot;Calcular Apuração&quot;.
                  </span>
                ) : (
                  <span style={{ color: 'var(--af-text-soft)', display: 'block', marginTop: 2 }}>
                    Para calcular a alíquota efetiva, informe o RBT12 (receita bruta acumulada nos 12 meses anteriores à competência) ao clicar em &quot;Calcular Apuração&quot;.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Resultado da apuração */}
          <div ref={resultadoRef}>
            {apuracaoErro && (
              <div style={{ color: 'var(--af-danger)', fontSize: 13, marginBottom: 16 }}>{apuracaoErro}</div>
            )}
            {apuracao && (
              <ExtratoPgdasSimulado
                apuracao={apuracao}
                empresa={empresaAtiva}
                declaracaoPgdas={declaracaoPgdas}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Extrato PGDAS Simulado ───────────────────────────────────────────────────

const NOME_ANEXO: Record<string, string> = {
  I: 'Comércio / Revenda',
  II: 'Indústria / Fabricação',
  III: 'Serviços — Anexo III',
  IV: 'Serviços — Anexo IV',
  V: 'Serviços — Anexo V',
}

const LABEL_TRIBUTO: Record<string, string> = {
  IRPJ: 'IRPJ', CSLL: 'CSLL', COFINS: 'COFINS',
  PIS: 'PIS/PASEP', CPP: 'INSS/CPP', ICMS: 'ICMS', IPI: 'IPI', ISS: 'ISS',
}

const ORDEM_TRIBUTOS = ['IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'ICMS', 'IPI', 'ISS']

function LinhaReceitaExtrato({ label, valor, tipo, destaque }: {
  label: string; valor: number; tipo: '+' | '-' | '='; destaque?: boolean
}) {
  const cor = tipo === '+' ? 'var(--af-text-soft)' : tipo === '-' ? 'var(--af-danger)' : 'var(--af-text)'
  const fw = tipo === '=' || destaque ? 700 : 400
  const bg = tipo === '=' ? 'rgba(39,199,216,0.05)' : 'transparent'
  return (
    <tr style={{ background: bg }}>
      <td style={{ padding: '7px 16px', fontSize: 12, color: 'var(--af-muted)', fontWeight: 600, width: 28 }}>{tipo}</td>
      <td style={{ padding: '7px 4px', fontSize: 13, color: cor, fontWeight: fw }}>{label}</td>
      <td style={{ padding: '7px 16px', fontSize: 13, color: cor, fontWeight: fw, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' as const }}>
        {tipo === '-' && valor > 0 ? `(${fmtBRL.format(valor)})` : fmtBRL.format(valor)}
      </td>
    </tr>
  )
}

function BlocoAnexo({ anexo, das, rbt12 }: {
  anexo: string
  das: import('@/lib/simples/calcularSimples').ResultadoDas
  rbt12: number
}) {
  const faixa = das.faixa
  const rbt12Fmt = fmtBRL.format(rbt12)
  const aliqNomPct = fmtPctNum(faixa.aliquotaNominal * 100)
  const parcelaFmt = fmtBRL.format(faixa.parcelaDeduzir)
  const numerador = rbt12 * faixa.aliquotaNominal - faixa.parcelaDeduzir
  const numeradorFmt = fmtBRL.format(Math.max(0, numerador))
  const efetivaPct = fmtPctNum(faixa.aliquotaEfetivaPerc)

  const tributos = ORDEM_TRIBUTOS
    .filter(t => (das.breakdown as unknown as Record<string, number>)[t] > 0)

  return (
    <div style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
      {/* Título do bloco */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--af-border)', background: 'rgba(39,199,216,0.04)' }}>
        <span style={{ background: 'rgba(39,199,216,0.15)', border: '1px solid rgba(39,199,216,0.3)', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700, color: 'var(--af-primary)' }}>
          Anexo {anexo}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--af-text-soft)' }}>{NOME_ANEXO[anexo] ?? ''}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--af-muted)' }}>Faixa {faixa.faixa}</span>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Campos da faixa */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Receita do Período', value: fmtBRL.format(das.receita) },
            { label: 'Alíq. Nominal (tabela)', value: aliqNomPct },
            { label: 'Parcela Dedutível', value: parcelaFmt },
            { label: 'RBT12 Utilizado', value: rbt12Fmt },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--af-surface-2)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--af-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--af-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Fórmula */}
        <div style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(39,199,216,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontFamily: 'monospace' }}>
          <div style={{ fontSize: 10, color: 'var(--af-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'inherit' }}>FÓRMULA DA ALÍQUOTA EFETIVA</div>
          <div style={{ fontSize: 12, color: 'var(--af-text-soft)', lineHeight: 1.8 }}>
            <span style={{ color: 'var(--af-muted)' }}>(RBT12 × Alíq.Nom. − Parcela) ÷ RBT12</span>
            <br />
            <span style={{ color: 'var(--af-text-soft)' }}>= ({rbt12Fmt} × {aliqNomPct} − {parcelaFmt}) ÷ {rbt12Fmt}</span>
            <br />
            <span style={{ color: 'var(--af-text-soft)' }}>= {numeradorFmt} ÷ {rbt12Fmt}</span>
            <br />
            <span style={{ color: 'var(--af-primary)', fontWeight: 700 }}>= {efetivaPct} (alíquota efetiva)</span>
          </div>
        </div>

        {/* DAS do período */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(39,199,216,0.08)', border: '1px solid rgba(39,199,216,0.2)', borderRadius: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>DAS do Período — Anexo {anexo}</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--af-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL.format(das.valorDas)}</span>
        </div>

        {/* Partilha por tributo */}
        {tributos.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--af-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 8 }}>Partilha por Tributo</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                <thead>
                  <tr>
                    {tributos.map(t => (
                      <th key={t} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'var(--af-muted)', textAlign: 'center', borderBottom: '1px solid var(--af-border)', background: 'var(--af-surface-2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                        {LABEL_TRIBUTO[t] ?? t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {tributos.map(t => (
                      <td key={t} style={{ padding: '4px 10px', fontSize: 11, textAlign: 'center', borderBottom: '1px solid var(--af-border)', color: 'var(--af-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtPctNum((das.distribuicao as unknown as Record<string, number>)[t] ?? 0)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    {tributos.map(t => (
                      <td key={t} style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, textAlign: 'center', color: 'var(--af-text)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtBRL.format((das.breakdown as unknown as Record<string, number>)[t] ?? 0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ExtratoPgdasSimulado({
  apuracao, empresa, declaracaoPgdas,
}: {
  apuracao: ResultadoApuracao
  empresa: { razao_social: string; cnpj?: string }
  declaracaoPgdas: SnDeclaracao | null
}) {
  const anexos = Object.entries(apuracao.por_anexo)
  const printRef = useRef<HTMLDivElement>(null)
  const dasPgdas = declaracaoPgdas?.valor_total_devido ?? null
  const diffDas = dasPgdas != null ? apuracao.valor_das_total - dasPgdas : null
  const diffDasPct = dasPgdas && dasPgdas > 0 ? Math.abs((diffDas ?? 0)) / dasPgdas : null
  const statusConfronto = diffDasPct == null ? null
    : diffDasPct <= 0.01 ? 'ok'
    : diffDasPct <= 0.05 ? 'alerta'
    : 'critico'
  const baseDas = apuracao.receita_liquida - apuracao.receita_st
  const handleGerarPdf = () => {
    const conteudo = printRef.current?.innerHTML
    if (!conteudo) return
    const janela = window.open('', '_blank', 'width=1024,height=768')
    if (!janela) return
    janela.document.write(`<!doctype html>
      <html>
        <head>
          <title>Apuração Simples Nacional - ${apuracao.competencia}</title>
          <style>
            :root {
              --af-surface: #ffffff;
              --af-surface-2: #f1f5f9;
              --af-border: #cbd5e1;
              --af-text: #0f172a;
              --af-text-soft: #334155;
              --af-muted: #64748b;
              --af-primary: #0891b2;
              --af-warning: #b45309;
              --af-danger: #b91c1c;
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: var(--af-text);
              font-family: "Segoe UI", Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            #page {
              width: 198mm;
              min-height: 285mm;
              overflow: hidden;
              padding: 0;
            }
            #print-content {
              transform-origin: top left;
              width: 100%;
            }
            button, .no-print { display: none !important; }
            #print-content * {
              box-shadow: none !important;
            }
            #print-content > div {
              margin-bottom: 7px !important;
            }
            #print-content div {
              border-radius: 7px !important;
            }
            #print-content table {
              page-break-inside: avoid;
              border-collapse: collapse !important;
            }
            #print-content th,
            #print-content td {
              padding: 3px 6px !important;
              font-size: 9px !important;
              line-height: 1.25 !important;
            }
            #print-content span,
            #print-content div {
              line-height: 1.25 !important;
            }
            tr, div { break-inside: avoid; }
            @page { size: A4 portrait; margin: 6mm; }
          </style>
        </head>
        <body>
          <div id="page">
            <div id="print-content">${conteudo}</div>
          </div>
          <script>
            function fitToOnePage() {
              var page = document.getElementById('page');
              var content = document.getElementById('print-content');
              if (!page || !content) return;
              content.style.transform = 'none';
              var scaleX = page.clientWidth / content.scrollWidth;
              var scaleY = page.clientHeight / content.scrollHeight;
              var scale = Math.min(1, scaleX, scaleY);
              content.style.transform = 'scale(' + scale + ')';
            }
            requestAnimationFrame(function() {
              fitToOnePage();
              setTimeout(function() {
                window.print();
                window.close();
              }, 250);
            });
          </script>
        </body>
      </html>`)
    janela.document.close()
    janela.focus()
  }

  return (
    <div ref={printRef} style={{ marginTop: 4, marginBottom: 20 }}>
      {/* ── Cabeçalho ── */}
      <div style={{ background: 'linear-gradient(135deg, rgba(39,199,216,0.08) 0%, rgba(15,23,42,0.6) 100%)', border: '1px solid rgba(39,199,216,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--af-primary)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Demonstrativo de Apuração — Simples Nacional
          </div>
          <button
            type="button"
            className="no-print"
            onClick={handleGerarPdf}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(39,199,216,0.1)', color: 'var(--af-primary)', border: '1px solid rgba(39,199,216,0.3)', borderRadius: 8, padding: '7px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            <Printer size={14} />
            Gerar PDF
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {[
            { label: 'Empresa', value: empresa.razao_social },
            { label: 'CNPJ', value: empresa.cnpj ?? '—' },
            { label: 'Competência', value: apuracao.competencia },
            { label: 'Regime', value: 'Simples Nacional' },
            { label: 'RBT12 Utilizado', value: fmtBRL.format(apuracao.rbt12_utilizado) },
            { label: 'Origem RBT12', value: apuracao.origem_rbt12 },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: 'var(--af-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--af-text)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Receitas do Período ── */}
      <div style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--af-border)', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--af-muted)', background: 'var(--af-surface-2)' }}>
          Receitas do Período
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <LinhaReceitaExtrato tipo="+" label="Receita Bruta de Vendas" valor={apuracao.receita_vendas_bruta} />
            <LinhaReceitaExtrato tipo="-" label="Devoluções de Venda" valor={apuracao.receita_devolucoes} />
            <LinhaReceitaExtrato tipo="=" label="Receita Líquida do Período" valor={apuracao.receita_liquida} destaque />
            {apuracao.receita_st > 0 && (
              <LinhaReceitaExtrato tipo="-" label="ST / Monofásico (excluído da base do DAS)" valor={apuracao.receita_st} />
            )}
            {apuracao.receita_exportacao > 0 && (
              <LinhaReceitaExtrato tipo="+" label="Exportação" valor={apuracao.receita_exportacao} />
            )}
            <LinhaReceitaExtrato tipo="=" label="Base de Cálculo do DAS" valor={baseDas > 0 ? baseDas : apuracao.receita_liquida} destaque />
          </tbody>
        </table>
      </div>

      {/* ── Blocos por Anexo ── */}
      {anexos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--af-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Apuração por Atividade
          </div>
          {anexos.map(([anexo, das]) => (
            <BlocoAnexo key={anexo} anexo={anexo} das={das} rbt12={apuracao.rbt12_utilizado} />
          ))}
        </div>
      )}

      {/* ── Resultado Final ── */}
      <div style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--af-border)', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--af-muted)', background: 'var(--af-surface-2)' }}>
          Resultado Final
        </div>
        <div style={{ padding: '16px 20px' }}>
          {/* DAS calculado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--af-border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>DAS Calculado pelo Sistema</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--af-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL.format(apuracao.valor_das_total)}</span>
          </div>

          {/* Comparação com PGDAS */}
          {dasPgdas != null && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--af-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--af-text-soft)' }}>DAS Declarado no PGDAS-D</span>
                <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL.format(dasPgdas)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--af-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--af-text-soft)' }}>Diferença</span>
                <span style={{
                  fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: diffDas === 0 ? 'var(--af-muted)' : (diffDas ?? 0) > 0 ? 'var(--af-warning)' : 'var(--af-danger)',
                }}>
                  {(diffDas ?? 0) >= 0 ? '+' : ''}{fmtBRL.format(diffDas ?? 0)}
                  {diffDasPct != null && ` (${fmtPctNum(diffDasPct * 100)})`}
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                {statusConfronto === 'ok' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#16a34a', fontSize: 13 }}>
                    <CheckCircle2 size={15} />
                    <span>Dentro da margem aceitável (diferença ≤ 1%)</span>
                  </div>
                )}
                {statusConfronto === 'alerta' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--af-warning)', fontSize: 13 }}>
                    <AlertTriangle size={15} />
                    <span>Divergência moderada (1% a 5%) — verificar lançamentos</span>
                  </div>
                )}
                {statusConfronto === 'critico' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--af-danger)', fontSize: 13 }}>
                    <AlertTriangle size={15} />
                    <span>Divergência crítica (&gt; 5%) — revisão necessária</span>
                  </div>
                )}
              </div>
            </>
          )}

          {dasPgdas == null && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--af-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Info size={13} />
              Importe o PGDAS-D desta competência na aba &quot;PGDAS-D&quot; para ver a comparação.
            </div>
          )}
        </div>
      </div>

      {/* ── Alertas ── */}
      {apuracao.alertas.length > 0 && (
        <div style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-warning)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Alertas</div>
          {apuracao.alertas.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--af-warning)', marginBottom: 4, alignItems: 'flex-start' }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{a}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SimplesNacionalPage() {
  const { empresaAtiva } = useEmpresaAtiva()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [abaAtiva, setAbaAtiva]       = useState<'declaracoes' | 'apuracao_sistema' | 'confronto_apuracao' | 'configuracoes'>('apuracao_sistema')
  const [declaracoes, setDeclaracoes] = useState<SnDeclaracao[]>([])
  const [carregando, setCarregando]   = useState(false)
  const [processando, setProcessando] = useState<string[]>([])
  const [erros, setErros]             = useState<string[]>([])
  const [modalItems, setModalItems]   = useState<ModalItem[] | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [docsConfronto, setDocsConfronto] = useState<DocumentoFiscal[]>([])
  const [itensConfronto, setItensConfronto] = useState<DocumentoFiscalItem[]>([])
  const [carregandoNfe, setCarregandoNfe] = useState(false)

  // ── Estado Apuração XML ──────────────────────────────────────────────────
  const xmlInputRef                   = useRef<HTMLInputElement>(null)
  const [xmlCompetencia, setXmlCompetencia] = useState<string>('')
  const [xmlDocumentos, setXmlDocumentos]   = useState<DocumentoFiscal[]>([])
  const [xmlItens, setXmlItens]             = useState<DocumentoFiscalItem[]>([])
  const [carregandoXmlDocs, setCarregandoXmlDocs] = useState(false)
  const [importandoXml, setImportandoXml]   = useState(false)
  const [xmlErros, setXmlErros]             = useState<string[]>([])
  const [xmlPreview, setXmlPreview]         = useState<XmlPreviewItem[] | null>(null)
  const [rbt12Modal, setRbt12Modal]         = useState(false)
  const [rbt12Valor, setRbt12Valor]         = useState<string>('')
  const [rbt12MesesInputs, setRbt12MesesInputs] = useState<Record<string, string>>({})
  const [receitas12m, setReceitas12m]       = useState<SnReceitaMensal[]>([])
  const [rbt12Carregado, setRbt12Carregado] = useState<number | null>(null)
  // Sugestão do PGDAS-D — não aplicada automaticamente; exige confirmação do usuário no modal
  const [rbt12Sugestao, setRbt12Sugestao]   = useState<number | null>(null)
  const [apuracao, setApuracao]             = useState<ResultadoApuracao | null>(null)
  const [apuracaoErro, setApuracaoErro]     = useState<string | null>(null)
  const [limpandoCompetencia, setLimpandoCompetencia] = useState(false)

  // Ler URL params no mount para navegação vinda do Validador NF-e
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const aba = params.get('aba')
    const comp = params.get('competencia')
    if (aba) setAbaAtiva(aba as 'declaracoes' | 'apuracao_sistema' | 'confronto_apuracao' | 'configuracoes')
    if (comp) setXmlCompetencia(comp)
  }, [])

  const carregarDeclaracoes = useCallback(async (empresaId: string) => {
    setCarregando(true)
    try {
      const res = await fetch(`/api/simples_nacional?empresa_id=${empresaId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const rows: SnDeclaracao[] = await res.json()
      setDeclaracoes(Array.isArray(rows) ? rows : [])
    } catch {
      setDeclaracoes([])
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (!empresaAtiva) { setDeclaracoes([]); return }
    carregarDeclaracoes(empresaAtiva.id)
  }, [empresaAtiva, carregarDeclaracoes])

  const carregarDocsConfronto = useCallback(async (empresaId: string, cnpjEmpresa?: string, ehIndustrial = false) => {
    setCarregandoNfe(true)
    try {
      // Tenta fa_documentos_fiscais primeiro
      const res = await fetch(`/api/documentos-fiscais?empresa_id=${encodeURIComponent(empresaId)}&incluir_itens=true`)
      if (res.ok) {
        const rows: DocumentoFiscalComItens[] = await res.json()
        if (Array.isArray(rows) && rows.length > 0) {
          setDocsConfronto(rows)
          setItensConfronto(rows.flatMap(row => row.fa_documentos_itens ?? []))
          return
        }
      }
      // Fallback: fa_arquivos_xml (legacy — sempre disponível)
      const resXml = await fetch(`/api/arquivos-xml?empresa_id=${encodeURIComponent(empresaId)}&incluir_dados=true`)
      if (!resXml.ok) { setDocsConfronto([]); setItensConfronto([]); return }
      const xmlRows: ArquivoXml[] = await resXml.json()
      const seenConfronto = new Set<string>()
      const docsConvertidos: DocumentoFiscal[] = (Array.isArray(xmlRows) ? xmlRows : [])
        .filter(x => {
          if (!x.data_emissao) return false
          const key = x.chave_nfe || `${x.numero_nf}_${x.emitente_cnpj}_${x.data_emissao}`
          if (seenConfronto.has(key)) return false
          seenConfronto.add(key)
          return true
        })
        .map(x => {
          const comp = dataParaCompetencia(x.data_emissao!)
          const movimentoItens = movimentoPorItensXml(x.parsed_data)
          const impactoParsed = impactoPorParsedXml(x.parsed_data)
          const ehSaida = movimentoItens ? movimentoItens === 'saida' : x.tipo_operacao === 'saida'
          const impactoReceita = impactoParsed ?? (ehSaida ? 'soma_receita' : 'sem_impacto')
          return {
            id: x.id,
            org_id: '',
            empresa_id: x.empresa_id,
            sessao_id: x.sessao_id,
            tipo_documento: 'nfe' as const,
            origem: 'xml_nfe' as const,
            chave_acesso: x.chave_nfe,
            numero: x.numero_nf,
            data_emissao: x.data_emissao,
            data_competencia: comp,
            emitente_cnpj: x.emitente_cnpj,
            emitente_nome: x.emitente_nome,
            destinatario_cnpj: x.destinatario_cnpj,
            destinatario_nome: x.destinatario_nome,
            valor_total: x.valor_total ?? 0,
            valor_produtos: 0,
            valor_servicos: 0,
            valor_desconto: 0,
            valor_frete: 0,
            valor_icms: 0,
            valor_pis: 0,
            valor_cofins: 0,
            valor_st: 0,
            valor_ipi: 0,
            tipo_movimento: (ehSaida ? 'saida' : 'entrada') as import('@/lib/types').TipoMovimento,
            impacto_receita: impactoReceita as import('@/lib/types').ImpactoReceita,
            origem_devolucao: 'nao_aplicavel' as const,
            status: 'ok' as const,
            parsed_data: x.parsed_data,
            created_at: x.created_at,
            updated_at: x.created_at,
          } as DocumentoFiscal
        })
      setDocsConfronto(docsConvertidos)
      setItensConfronto(docsConvertidos.flatMap(doc =>
        itensPorParsedXml(doc, (cnpjEmpresa ?? '').replace(/\D/g, ''), ehIndustrial)
      ))
    } catch {
      setDocsConfronto([])
      setItensConfronto([])
    } finally {
      setCarregandoNfe(false)
    }
  }, [])

  useEffect(() => {
    if (!empresaAtiva) { setDocsConfronto([]); setItensConfronto([]); return }
    if (abaAtiva === 'confronto_apuracao') {
      carregarDocsConfronto(
        empresaAtiva.id,
        empresaAtiva.cnpj,
        /^(1[0-9]|2[0-9]|3[0-3])/.test(empresaAtiva.cnae_principal ?? ''),
      )
    }
  }, [empresaAtiva, abaAtiva, carregarDocsConfronto])

  // ── Carregar documentos XML salvos para a competência ──────────────────
  const carregarXmlDocumentos = useCallback(async (empresaId: string, competencia: string, cnpjEmpresa?: string, ehIndustrial = false) => {
    if (!competencia) return
    setCarregandoXmlDocs(true)
    try {
      const resDocs = await fetch(
        `/api/documentos-fiscais?empresa_id=${empresaId}&competencia=${encodeURIComponent(competencia)}&incluir_itens=true`
      )
      if (resDocs.ok) {
        const docsComItens: DocumentoFiscalComItens[] = await resDocs.json()
        const docsValidos = Array.isArray(docsComItens)
          ? docsComItens.filter(doc => doc.status !== 'cancelada')
          : []
        if (docsValidos.length > 0) {
          setXmlDocumentos(docsValidos)
          setXmlItens(docsValidos.flatMap(doc => doc.fa_documentos_itens ?? []))
          return
        }
      }
      // Fonte principal: fa_arquivos_xml — sempre disponível, sempre completo
      // fa_documentos_fiscais não é usado aqui porque pode ter dados parciais
      // (ON CONFLICT ignoreDuplicates pode ter pulado documentos em importações anteriores)
      const resXml = await fetch(`/api/arquivos-xml?empresa_id=${empresaId}&competencia=${encodeURIComponent(competencia)}&incluir_dados=true`)
      if (!resXml.ok) { setXmlDocumentos([]); setXmlItens([]); return }
      const xmlRows: ArquivoXml[] = await resXml.json()

      // Deduplicação em dois passos para lidar com registros onde um tem chave_nfe
      // preenchida e um duplicado tem chave_nfe=null (importações de sessões distintas).
      // Passo 1: agrupa por chave_nfe (44 chars) quando disponível
      // Passo 2: registros sem chave_nfe só entram se não há versão com chave para o mesmo (numero_nf, emitente, data)
      const todosDaComp = (Array.isArray(xmlRows) ? xmlRows : [])
        .filter(x => x.data_emissao && dataParaCompetencia(x.data_emissao) === competencia)

      // Mapa: fallback key → true (registros COM chave_nfe válida)
      const fallbacksComChave = new Set<string>()
      const porChave = new Map<string, ArquivoXml>()
      for (const x of todosDaComp) {
        const chave = x.chave_nfe?.trim()
        if (chave && chave.length >= 40) {
          if (!porChave.has(chave)) porChave.set(chave, x)
          fallbacksComChave.add(`${x.numero_nf}_${x.emitente_cnpj}_${x.data_emissao}`)
        }
      }
      // Registros sem chave_nfe: só inclui se não existe versão com chave para o mesmo doc
      const porFallback = new Map<string, ArquivoXml>()
      for (const x of todosDaComp) {
        const chave = x.chave_nfe?.trim()
        if (chave && chave.length >= 40) continue // já tratado acima
        const fk = `${x.numero_nf}_${x.emitente_cnpj}_${x.data_emissao}`
        if (!fallbacksComChave.has(fk) && !porFallback.has(fk)) porFallback.set(fk, x)
      }
      const filtrados = [...porChave.values(), ...porFallback.values()]
      const docsConvertidos: DocumentoFiscal[] = filtrados.map(x => {
        // tipo_operacao='saida' → saída emitida pela empresa → soma_receita
        // tipo_operacao='entrada' com tipo_operacao → entrada de terceiro → sem_impacto
        // CNPJ check como fallback para XMLs salvos sem tipo_operacao
        const cnpjLimpo = (cnpjEmpresa ?? '').replace(/\D/g, '')
        const emitenteNorm = (x.emitente_cnpj ?? '').replace(/\D/g, '')
        const movimentoItens = movimentoPorItensXml(x.parsed_data)
        const impactoParsed = impactoPorParsedXml(x.parsed_data)
        const ehSaida = movimentoItens ? movimentoItens === 'saida' : x.tipo_operacao === 'saida'
          || (!x.tipo_operacao && cnpjLimpo.length >= 8 && emitenteNorm.length >= 8 && emitenteNorm === cnpjLimpo)
        const impactoReceita = impactoParsed ?? (ehSaida ? 'soma_receita' : 'sem_impacto')
        return {
          id: x.id,
          org_id: '',
          empresa_id: x.empresa_id,
          sessao_id: x.sessao_id,
          tipo_documento: 'nfe' as const,
          origem: 'xml_nfe' as const,
          chave_acesso: x.chave_nfe,
          numero: x.numero_nf,
          data_emissao: x.data_emissao,
          data_competencia: competencia,
          emitente_cnpj: x.emitente_cnpj,
          emitente_nome: x.emitente_nome,
          destinatario_cnpj: x.destinatario_cnpj,
          destinatario_nome: x.destinatario_nome,
          valor_total: x.valor_total ?? 0,
          valor_produtos: 0,
          valor_servicos: 0,
          valor_desconto: 0,
          valor_frete: 0,
          valor_icms: 0,
          valor_pis: 0,
          valor_cofins: 0,
          valor_st: 0,
          valor_ipi: 0,
          tipo_movimento: (ehSaida ? 'saida' : 'entrada') as import('@/lib/types').TipoMovimento,
          impacto_receita: impactoReceita as import('@/lib/types').ImpactoReceita,
          origem_devolucao: 'nao_aplicavel' as const,
          status: 'ok' as const,
          parsed_data: x.parsed_data,
          created_at: x.created_at,
          updated_at: x.created_at,
        } as DocumentoFiscal
      })
      const itensExtraidos = docsConvertidos.flatMap(doc =>
        itensPorParsedXml(doc, (cnpjEmpresa ?? '').replace(/\D/g, ''), ehIndustrial)
      )
      const itensPorDocumento = itensExtraidos.reduce((mapa, item) => {
        const lista = mapa.get(item.documento_id) ?? []
        lista.push(item)
        mapa.set(item.documento_id, lista)
        return mapa
      }, new Map<string, DocumentoFiscalItem[]>())
      const docsComImpactoItens = docsConvertidos.map(doc => {
        const impactoItens = impactoPorItensDocumento(itensPorDocumento.get(doc.id) ?? [])
        if (!impactoItens) return doc
        return {
          ...doc,
          impacto_receita: impactoItens as import('@/lib/types').ImpactoReceita,
          tipo_movimento: impactoItens === 'reduz_receita'
            ? 'devolucao_venda' as import('@/lib/types').TipoMovimento
            : doc.tipo_movimento,
        }
      })
      setXmlDocumentos(docsComImpactoItens)
      // Carregar itens de fa_documentos_itens para classificação ST/monofásico
      try {
        const resItens = await fetch(
          `/api/documentos-fiscais?empresa_id=${empresaId}&competencia=${encodeURIComponent(competencia)}&incluir_itens=true`
        )
        if (resItens.ok) {
          const docsComItens: Array<{ fa_documentos_itens?: DocumentoFiscalItem[] }> = await resItens.json()
          const itensEstruturados = Array.isArray(docsComItens) ? docsComItens.flatMap(d => d.fa_documentos_itens ?? []) : []
          setXmlItens(itensExtraidos.length > 0 ? itensExtraidos : itensEstruturados)
        } else {
          setXmlItens(itensExtraidos)
        }
      } catch {
        setXmlItens(itensExtraidos)
      }
    } catch {
      setXmlDocumentos([])
      setXmlItens([])
    } finally {
      setCarregandoXmlDocs(false)
    }
  }, [])

  // ── Carregar RBT12 para a competência ─────────────────────────────────
  const carregarRbt12 = useCallback(async (empresaId: string, competencia: string) => {
    if (!competencia) return
    try {
      const res = await fetch(`/api/simples/receitas-mensais?empresa_id=${empresaId}&competencia=${encodeURIComponent(competencia)}`)
      if (!res.ok) { setRbt12Carregado(null); return }
      const body: { receitas: SnReceitaMensal[]; rbt12: number } = await res.json()
      const receitas = body.receitas ?? []
      setReceitas12m(receitas)
      // Só aceitar como RBT12 completo quando os 12 meses estiverem disponíveis.
      // Se < 12 meses, deixar null para o fallback (PGDAS) ou o modal tratarem —
      // uma soma parcial produziria um RBT12 incorreto sem aviso ao usuário.
      if (receitas.length >= 12 && (body.rbt12 ?? 0) > 0) {
        setRbt12Carregado(body.rbt12)
      } else {
        setRbt12Carregado(null)
      }
    } catch {
      setRbt12Carregado(null)
    }
  }, [])

  // Sugestão RBT12 do PGDAS-D — apenas armazenada; nunca aplicada automaticamente.
  // O usuário deve confirmar no modal para que o valor seja usado na apuração.
  useEffect(() => {
    if (!xmlCompetencia || declaracoes.length === 0) return
    const decl = declaracoes.find(d => d.competencia === xmlCompetencia)
    setRbt12Sugestao(
      decl?.receita_bruta_acumulada_12m && decl.receita_bruta_acumulada_12m > 0
        ? decl.receita_bruta_acumulada_12m
        : null
    )
  }, [xmlCompetencia, declaracoes])

  useEffect(() => {
    if (!empresaAtiva || !xmlCompetencia || abaAtiva !== 'apuracao_sistema') return
    const cnpj = (empresaAtiva.cnpj ?? '').replace(/\D/g, '')
    const ehIndustrial = /^(1[0-9]|2[0-9]|3[0-3])/.test(empresaAtiva.cnae_principal ?? '')
    carregarXmlDocumentos(empresaAtiva.id, xmlCompetencia, cnpj, ehIndustrial)
    carregarRbt12(empresaAtiva.id, xmlCompetencia)
  }, [empresaAtiva, xmlCompetencia, abaAtiva, carregarXmlDocumentos, carregarRbt12])

  // ── Processar XMLs selecionados (pré-visualização) ─────────────────────
  const handleXmlFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!empresaAtiva) { alert('Selecione uma empresa ativa.'); return }
    if (!xmlCompetencia) { alert('Informe a competência antes de importar os XMLs.'); return }

    const cnpj = (empresaAtiva.cnpj ?? '').replace(/\D/g, '')
    const ehIndustrial = /^(1[0-9]|2[0-9]|3[0-3])/.test(empresaAtiva.cnae_principal ?? '')
    const extraidos = await extrairXmlsDeArquivos(files)
    if (extraidos.arquivos.length === 0) {
      alert(['Nenhum XML encontrado. Selecione XMLs ou um ZIP contendo XMLs.', ...extraidos.avisos].join('\n'))
      return
    }

    setImportandoXml(true)
    setXmlErros(extraidos.avisos)
    setXmlPreview(null)

    const previews: NonNullable<typeof xmlPreview> = []
    const errosList: string[] = [...extraidos.avisos]

    for (const file of extraidos.arquivos) {
      const txt = file.txt
      if (!txt) { errosList.push(`${file.nome}: não foi possível ler o arquivo`); continue }

      // Detectar cancelamento
      const chaveCancelada = detectarCancelamento(txt)
      if (chaveCancelada) {
        // Sinalizar como cancelamento para enviar PATCH depois
        previews.push({
          nomeArq: file.nome, numero: `Cancelamento de ${chaveCancelada.slice(-6)}`,
          emitente: 'Evento de cancelamento', valor: 0,
          tipo_movimento: 'cancelamento', impacto_receita: 'sem_impacto',
          chave: chaveCancelada, doc: null,
        })
        continue
      }

      const resultado = parseNfeParaDocumento(txt, cnpj, ehIndustrial, file.nome)
      if (!resultado) { errosList.push(`${file.nome}: não foi possível extrair dados do XML`); continue }

      previews.push({
        nomeArq: file.nome,
        numero: resultado.metadados.numero || '?',
        emitente: resultado.metadados.emitente_nome || resultado.metadados.emitente_cnpj || '?',
        valor: resultado.metadados.valor_total,
        tipo_movimento: resultado.documento.tipo_movimento,
        impacto_receita: resultado.documento.impacto_receita,
        chave: resultado.metadados.chave_acesso ?? undefined,
        doc: resultado,
      })
    }

    setXmlErros(errosList)
    setXmlPreview(previews.length > 0 ? previews : null)
    setImportandoXml(false)
  }, [empresaAtiva, xmlCompetencia])

  // ── Confirmar importação dos XMLs ──────────────────────────────────────
  const handleConfirmarXml = useCallback(async () => {
    if (!xmlPreview || !empresaAtiva || !xmlCompetencia) return
    setImportandoXml(true)
    setXmlErros([])

    const docEntries = xmlPreview.filter(p => p.doc)
    const cancelamentos = xmlPreview.filter(p => p.tipo_movimento === 'cancelamento' && p.chave)

    // Processar cancelamentos (silencioso — tabela pode não existir)
    for (const canc of cancelamentos) {
      await fetch('/api/documentos-fiscais/importar-nfe', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaAtiva.id, chave_acesso: canc.chave }),
      }).catch(() => {})
    }

    if (docEntries.length > 0) {
      let salvo = false

      // Tentativa 1: fa_documentos_fiscais (requer migração fase A)
      try {
        const documentos = docEntries.map(p => ({
          ...p.doc!.documento,
          empresa_id: empresaAtiva.id,
          data_competencia: xmlCompetencia,
        }))
        const itens: Record<string, Omit<DocumentoFiscalItemInput, 'empresa_id' | 'documento_id'>[]> = {}
        for (const p of docEntries) {
          const chave = p.doc!.metadados.chave_acesso ?? p.nomeArq
          itens[chave] = p.doc!.itens
        }
        const res = await fetch('/api/documentos-fiscais/importar-nfe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empresa_id: empresaAtiva.id, documentos, itens }),
        })
        if (res.ok) salvo = true
      } catch { /* silencioso */ }

      // Tentativa 2: fa_arquivos_xml (sempre disponível — cria sessão automaticamente)
      try {
        // Obter ou criar sessão exclusiva desta aba (observacoes='apuracao_simples')
        // Nunca reutilizar sessões do Validador para evitar mistura de dados
        const sessaoRes = await fetch(`/api/sessoes?empresa_id=${empresaAtiva.id}`)
        const sessoes = sessaoRes.ok ? (await sessaoRes.json() as { id: string; competencia: string; observacoes?: string }[]) : []
        let sessaoId = Array.isArray(sessoes)
          ? (sessoes.find(s => s.competencia === xmlCompetencia && s.observacoes === 'apuracao_simples')?.id ?? null)
          : null

        if (!sessaoId) {
          const novaRes = await fetch('/api/sessoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empresa_id: empresaAtiva.id, competencia: xmlCompetencia, observacoes: 'apuracao_simples' }),
          })
          if (novaRes.ok) sessaoId = (await novaRes.json() as { id: string }).id
        }

        if (sessaoId) {
          const xmlsParaSalvar = docEntries.map(p => ({
            chave_nfe: p.doc!.metadados.chave_acesso ?? null,
            numero_nf: p.doc!.metadados.numero ?? null,
            data_emissao: p.doc!.metadados.data_emissao ?? null,
            emitente_cnpj: p.doc!.metadados.emitente_cnpj || null,
            emitente_nome: p.doc!.metadados.emitente_nome || null,
            destinatario_cnpj: p.doc!.metadados.destinatario_cnpj || null,
            destinatario_nome: p.doc!.metadados.destinatario_nome || null,
            tipo_operacao: p.doc!.metadados.tpNF === '1' ? 'saida' : 'entrada',
            valor_total: p.doc!.metadados.valor_total ?? 0,
          }))

          const xmlRes = await fetch('/api/arquivos-xml', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessao_id: sessaoId,
              empresa_id: empresaAtiva.id,
              competencia: xmlCompetencia,
              xmls: xmlsParaSalvar,
              replace_sessao: true,
            }),
          })
          if (xmlRes.ok) {
            salvo = true
          } else {
            const errBody = await xmlRes.json().catch(() => ({}))
            setXmlErros(prev => [...prev, `Erro ao salvar XMLs (${xmlRes.status}): ${errBody.error ?? 'falha desconhecida'}`])
          }
        }
      } catch (e2) {
        setXmlErros(prev => [...prev, `Erro inesperado ao salvar XMLs: ${e2 instanceof Error ? e2.message : String(e2)}`])
      }

      if (!salvo) {
        setImportandoXml(false)
        return
      }
    }

    setXmlPreview(null)
    setImportandoXml(false)
    carregarXmlDocumentos(
      empresaAtiva.id,
      xmlCompetencia,
      (empresaAtiva.cnpj ?? '').replace(/\D/g, ''),
      /^(1[0-9]|2[0-9]|3[0-3])/.test(empresaAtiva.cnae_principal ?? ''),
    )
    carregarRbt12(empresaAtiva.id, xmlCompetencia)
  }, [xmlPreview, empresaAtiva, xmlCompetencia, carregarXmlDocumentos, carregarRbt12])

  // ── Abrir modal RBT12 pré-preenchendo com sugestão do PGDAS-D ────────
  const abrirModalRbt12 = useCallback(() => {
    if (rbt12Sugestao != null) {
      const formatted = rbt12Sugestao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      setRbt12Valor(formatted)
    } else {
      setRbt12Valor('')
    }
    setRbt12Modal(true)
  }, [rbt12Sugestao])

  // ── Executar apuração ──────────────────────────────────────────────────
  const handleApurar = useCallback(() => {
    if (!empresaAtiva || xmlDocumentos.length === 0) return

    let rbt12 = rbt12Carregado
    let origemRbt12: 'pgdas' | 'xml' | 'manual' | 'estimado' =
      receitas12m.length >= 12 ? 'pgdas' : 'manual'

    if (!rbt12 || rbt12 <= 0) {
      // Empresa com histórico parcial: média proporcional (< 12 meses disponíveis)
      if (receitas12m.length > 0) {
        const soma = receitas12m.reduce((s, r) => s + (r.receita_bruta_mes ?? 0), 0)
        const rbt12Estimado = Math.round((soma / receitas12m.length) * 12 * 100) / 100
        const confirmado = window.confirm(
          `Histórico parcial: apenas ${receitas12m.length} mês(es) encontrado(s) para os 12 meses anteriores a ${xmlCompetencia}.\n\n` +
          `RBT12 estimado por média proporcional: ${money.format(rbt12Estimado)}\n\n` +
          `Para maior precisão, informe as receitas dos meses faltantes antes de apurar.\n` +
          `Prosseguir com o valor estimado?`
        )
        if (!confirmado) { abrirModalRbt12(); return }
        rbt12 = rbt12Estimado
        origemRbt12 = 'estimado'
      } else {
        abrirModalRbt12()
        return
      }
    }

    const cnpj = (empresaAtiva.cnpj ?? '').replace(/\D/g, '')
    const ehIndustrial = /^(1[0-9]|2[0-9]|3[0-3])/.test(empresaAtiva.cnae_principal ?? '')
    try {
      const resultado = apurarSimples({
        documentos: xmlDocumentos,
        itens: xmlItens,
        rbt12,
        origem_rbt12: origemRbt12,
        cnpjEmpresa: cnpj,
        competencia: xmlCompetencia,
        ehIndustrial,
      })
      setApuracao(resultado)
      setApuracaoErro(null)
    } catch (e) {
      setApuracaoErro(e instanceof Error ? e.message : 'Erro ao calcular apuração')
    }
  }, [empresaAtiva, xmlDocumentos, xmlItens, rbt12Carregado, receitas12m, xmlCompetencia, abrirModalRbt12])

  // ── Confirmar RBT12 total (distribui pelos 12 meses anteriores) ──────────
  const handleConfirmarRbt12 = useCallback(async () => {
    if (!empresaAtiva) return
    const val = parseFloat(rbt12Valor.replace(/\./g, '').replace(',', '.'))
    if (!val || val <= 0) { alert('Informe um RBT12 válido.'); return }
    // Distribuir uniformemente pelos 12 meses ANTERIORES à competência apurada
    const mesesPrior = competenciasAnteriores(xmlCompetencia)
    try {
      await fetch('/api/simples/receitas-mensais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaAtiva.id,
          entradas: mesesPrior.map(comp => ({
            competencia: comp,
            receita_bruta_mes: val / 12,
            origem: 'estimado',
          })),
        }),
      })
    } catch { /* silencioso */ }
    setRbt12Carregado(val)
    setRbt12Modal(false)
    // Apurar com o valor informado
    const cnpj = (empresaAtiva.cnpj ?? '').replace(/\D/g, '')
    const ehIndustrial = /^(1[0-9]|2[0-9]|3[0-3])/.test(empresaAtiva.cnae_principal ?? '')
    try {
      const resultado = apurarSimples({
        documentos: xmlDocumentos, itens: xmlItens,
        rbt12: val, origem_rbt12: 'estimado',
        cnpjEmpresa: cnpj, competencia: xmlCompetencia, ehIndustrial,
      })
      setApuracao(resultado)
      setApuracaoErro(null)
    } catch (e) {
      setApuracaoErro(e instanceof Error ? e.message : 'Erro ao calcular apuração')
    }
  }, [empresaAtiva, rbt12Valor, xmlCompetencia, xmlDocumentos, xmlItens])

  // ── Salvar receitas mensais individuais e recarregar ───────────────────
  const handleSalvarMesesIndividuais = useCallback(async () => {
    if (!empresaAtiva) return
    const entradas = Object.entries(rbt12MesesInputs)
      .filter(([, v]) => v.trim() !== '')
      .map(([comp, v]) => ({
        competencia: comp,
        receita_bruta_mes: parseFloat(v.replace(/\./g, '').replace(',', '.')),
        origem: 'manual' as const,
      }))
      .filter(e => Number.isFinite(e.receita_bruta_mes) && e.receita_bruta_mes >= 0)

    if (entradas.length === 0) { alert('Informe ao menos uma receita mensal.'); return }

    try {
      await fetch('/api/simples/receitas-mensais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaAtiva.id, entradas }),
      })
    } catch { /* silencioso */ }

    setRbt12MesesInputs({})
    setRbt12Modal(false)
    // Recarregar receitas — se agora tiver 12 meses, o RBT12 será calculado automaticamente
    await carregarRbt12(empresaAtiva.id, xmlCompetencia)
  }, [empresaAtiva, rbt12MesesInputs, xmlCompetencia, carregarRbt12])

  // ── Limpar competência completa (XMLs + documentos fiscais) ───────────────
  const handleLimparCompetencia = useCallback(async () => {
    if (!empresaAtiva || !xmlCompetencia) return
    const ok = confirm(
      `Limpar TODOS os XMLs de ${xmlCompetencia} da empresa "${empresaAtiva.razao_social}"?\n\n` +
      `Serão removidos:\n` +
      `• XMLs importados para apuração (fa_arquivos_xml)\n` +
      `• Documentos fiscais estruturados (fa_documentos_fiscais)\n\n` +
      `Os dados do PGDAS-D NÃO são afetados.\n\n` +
      `Após a limpeza, reimporte os XMLs.`
    )
    if (!ok) return

    setLimpandoCompetencia(true)
    try {
      const params = new URLSearchParams({ empresa_id: empresaAtiva.id, competencia: xmlCompetencia })
      const res = await fetch(`/api/fiscal/limpar-competencia?${params}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(`Erro ao limpar: ${body.error ?? 'Erro desconhecido'}`)
        return
      }
      setXmlDocumentos([])
      setXmlItens([])
      setApuracao(null)
      setApuracaoErro(null)
      const xmlsInfo = body.xmls_removidos === -1 ? 'realizada' : `${body.xmls_removidos ?? 0} removidos`
      alert(
        `Limpeza concluída.\n` +
        `• XMLs: ${xmlsInfo}\n` +
        `• Documentos fiscais: ${body.documentos_removidos ?? 0} removidos\n\n` +
        `Agora você pode reimportar os XMLs.`
      )
    } catch {
      alert('Erro de rede ao limpar competência.')
    } finally {
      setLimpandoCompetencia(false)
    }
  }, [empresaAtiva, xmlCompetencia])

  const declaracaoPgdas = useMemo(
    () => declaracoes.find(d => d.competencia === xmlCompetencia) ?? null,
    [declaracoes, xmlCompetencia]
  )

  const ultimaDeclaracao = useMemo(
    () => declaracoes.length === 0 ? null
      : [...declaracoes].sort((a, b) => b.competencia.localeCompare(a.competencia))[0],
    [declaracoes]
  )
  const totalImposto = useMemo(() => declaracoes.reduce((s, d) => s + (d.valor_total_devido ?? 0), 0), [declaracoes])
  const totalReceita = useMemo(() => declaracoes.reduce((s, d) => s + (d.receita_bruta_mes   ?? 0), 0), [declaracoes])

  // Meses do RBT12 que ainda não têm receita registrada em sn_receitas_mensais
  const mesesFaltantes = useMemo(() => {
    if (!xmlCompetencia) return []
    const todos = competenciasAnteriores(xmlCompetencia)
    const disponiveis = new Set(receitas12m.map(r => r.competencia))
    return todos.filter(m => !disponiveis.has(m))
  }, [xmlCompetencia, receitas12m])

  const confrontoData = useMemo((): ItemConfronto[] => {
    const valorItem = (item: DocumentoFiscalItem) => Math.max(0, (item.valor_total ?? 0) - (item.valor_desconto ?? 0))
    const docByComp = new Map<string, { count: number; total: number; totalDev: number }>()
    const docsMap = new Map(docsConfronto.map(doc => [doc.id, doc]))

    if (itensConfronto.length > 0) {
      const docsReceitaPorComp = new Map<string, Set<string>>()
      for (const item of itensConfronto) {
        const doc = docsMap.get(item.documento_id)
        if (!doc || doc.status === 'cancelada') continue
        const comp = doc.data_competencia
        if (!comp) continue
        const entry = docByComp.get(comp) ?? { count: 0, total: 0, totalDev: 0 }
        if (item.impacto_receita === 'soma_receita') {
          entry.total += valorItem(item)
          if (!docsReceitaPorComp.has(comp)) docsReceitaPorComp.set(comp, new Set())
          docsReceitaPorComp.get(comp)!.add(item.documento_id)
        } else if (item.impacto_receita === 'reduz_receita') {
          entry.totalDev += valorItem(item)
        }
        docByComp.set(comp, entry)
      }
      for (const [comp, docs] of docsReceitaPorComp.entries()) {
        const entry = docByComp.get(comp)
        if (entry) entry.count = docs.size
      }
    } else {
      for (const doc of docsConfronto) {
        if (doc.status === 'cancelada') continue
        const comp = doc.data_competencia
        if (!comp) continue
        const entry = docByComp.get(comp) ?? { count: 0, total: 0, totalDev: 0 }
        if (doc.impacto_receita === 'soma_receita') {
          entry.count++
          entry.total += doc.valor_total ?? 0
        } else if (doc.impacto_receita === 'reduz_receita') {
          entry.totalDev += doc.valor_total ?? 0
        }
        docByComp.set(comp, entry)
      }
    }

    const allPeriods = new Set([
      ...declaracoes.map(d => d.competencia),
      ...docByComp.keys(),
    ])
    return [...allPeriods].sort((a, b) => b.localeCompare(a)).map(comp => {
      const pgdas = declaracoes.find(d => d.competencia === comp)
      const doc   = docByComp.get(comp)
      const receitaPgdas = pgdas?.receita_bruta_mes ?? 0
      const totalBruto   = doc?.total ?? 0
      const totalDev     = doc?.totalDev ?? 0
      const totalNfe     = totalBruto - totalDev
      const qtdNfe       = doc?.count ?? 0
      const diff         = totalNfe - receitaPgdas
      const diffPct      = receitaPgdas > 0 ? Math.abs(diff) / receitaPgdas : (totalNfe > 0 ? 1 : 0)
      let status: ItemConfronto['status']
      if (!pgdas)                      status = 'sem_pgdas'
      else if (!doc || totalNfe === 0) status = 'sem_nfe'
      else if (diffPct <= 0.01)        status = 'ok'
      else if (diffPct <= 0.05)        status = 'alerta'
      else                             status = 'critico'
      return { comp, receitaPgdas, totalNfe, qtdNfe, diff, diffPct, status }
    })
  }, [declaracoes, docsConfronto, itensConfronto])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (!empresaAtiva) { alert("Selecione uma empresa ativa antes de importar."); return }

    const arr = Array.from(files).filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
    if (arr.length === 0) { alert("Selecione apenas arquivos PDF (PGDAS-D)."); return }

    setErros([])
    setSaveError(null)
    setProcessando(arr.map(f => f.name))

    const results: ModalItem[] = []
    const errosList: string[] = []
    const cnpjEmpresa = normalizaCnpj(empresaAtiva.cnpj)

    for (const file of arr) {
      const parsed = await parsePgdasPdf(file)
      if (!parsed) {
        errosList.push(`${file.name}: não foi possível extrair dados (verifique se é um PGDAS-D válido)`)
      } else {
        const cnpjArquivo = normalizaCnpj(parsed.cnpj)
        const cnpjDivergente = cnpjEmpresa.length >= 8 && cnpjArquivo.length >= 8
          && cnpjArquivo.slice(0, 8) !== cnpjEmpresa.slice(0, 8)
        results.push({ parsed, fileName: file.name, cnpjDivergente })
      }
    }

    setProcessando([])
    setErros(errosList)
    if (results.length > 0) setModalItems(results)
  }, [empresaAtiva])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleConfirmar = useCallback(async () => {
    if (!modalItems || !empresaAtiva) return
    setSaving(true)
    setSaveError(null)

    let algumErro: string | null = null
    let salvos = 0

    for (const { parsed, fileName } of modalItems) {
      try {
        const res = await fetch('/api/simples_nacional', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresa_id:                  empresaAtiva.id,
            competencia:                 parsed.periodo,
            receita_bruta_mes:           parsed.receita_bruta_mes,
            receita_bruta_acumulada_12m: parsed.receita_bruta_acumulada_12m,
            receita_bruta_ano:           parsed.receita_bruta_ano,
            valor_total_devido:          parsed.total_devido,
            numero_recibo:               parsed.numero_recibo,
            nome_arquivo:                fileName,
            parsed_data:                 parsed,
          }),
        })
        if (res.ok) { salvos++ } else {
          const body = await res.json().catch(() => ({}))
          algumErro = body.error ?? `Erro HTTP ${res.status} ao salvar ${fileName}`
        }
      } catch (err) {
        algumErro = `Falha de rede ao salvar ${fileName}${err instanceof Error ? ': ' + err.message : ''}`
      }
    }

    setSaving(false)
    if (algumErro) {
      setSaveError(algumErro)
      if (salvos > 0) await carregarDeclaracoes(empresaAtiva.id)
    } else {
      await carregarDeclaracoes(empresaAtiva.id)
      setModalItems(null)
    }
  }, [modalItems, empresaAtiva, carregarDeclaracoes])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Remover esta declaração?")) return
    const res = await fetch(`/api/simples_nacional?id=${id}`, { method: 'DELETE' })
    if (res.ok) setDeclaracoes(prev => prev.filter(d => d.id !== id))
  }, [])

  const handleLimparTudo = useCallback(async () => {
    if (declaracoes.length === 0) return
    if (!confirm(`Remover todas as ${declaracoes.length} declaração(ões) desta empresa? Esta ação não pode ser desfeita.`)) return
    await Promise.all(declaracoes.map(d => fetch(`/api/simples_nacional?id=${d.id}`, { method: 'DELETE' })))
    setDeclaracoes([])
  }, [declaracoes])

  const handleExportarExcel = useCallback(() => {
    if (declaracoes.length === 0) return

    const sorted = [...declaracoes].sort((a, b) => a.competencia.localeCompare(b.competencia))
    const getTrib = (d: SnDeclaracao, nome: string) =>
      d.parsed_data?.tributos?.find(t => t.nome.toUpperCase() === nome)?.valor ?? 0

    // Planilha 1 — resumo por período
    const h1 = ['Período','Tipo','Anexo','Atividade','Receita Bruta','Acumulado 12m','Receita Ano','Total Impostos','Alíq. Efetiva (%)','IRPJ','CSLL','COFINS','PIS/PASEP','INSS/CPP','ICMS','IPI','ISS','Nº Recibo']
    const r1 = sorted.map(d => {
      const rb    = d.receita_bruta_mes ?? 0
      const total = d.valor_total_devido ?? 0
      return [
        d.competencia,
        d.parsed_data?.tipo_declaracao ?? 'Original',
        d.parsed_data?.anexo ?? '',
        d.parsed_data?.atividade ?? '',
        rb,
        d.receita_bruta_acumulada_12m ?? 0,
        d.receita_bruta_ano ?? 0,
        total,
        rb > 0 ? Number((total / rb * 100).toFixed(2)) : 0,
        getTrib(d,'IRPJ'), getTrib(d,'CSLL'), getTrib(d,'COFINS'),
        getTrib(d,'PIS/PASEP'), getTrib(d,'INSS/CPP'), getTrib(d,'ICMS'),
        getTrib(d,'IPI'), getTrib(d,'ISS'),
        d.numero_recibo ?? '',
      ]
    })
    const ws1 = XLSX.utils.aoa_to_sheet([h1, ...r1])
    ws1['!cols'] = [{wch:10},{wch:12},{wch:10},{wch:50},{wch:16},{wch:16},{wch:14},{wch:16},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:10},{wch:10},{wch:25}]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'PGDAS-D')

    // Planilha 2 — breakdown por atividade (se houver registros multi-atividade)
    const h2 = ['Período','Atividade','Anexo','IRPJ','CSLL','COFINS','PIS/PASEP','INSS/CPP','ICMS','IPI','ISS','Total']
    const r2: (string | number)[][] = []
    for (const d of sorted) {
      const atividades = d.parsed_data?.atividades
      if (!atividades || atividades.length < 2) continue
      for (const atv of atividades) {
        const g = (n: string) => atv.tributos.find(t => t.nome.toUpperCase() === n)?.valor ?? 0
        r2.push([d.competencia, atv.nome, atv.anexo, g('IRPJ'), g('CSLL'), g('COFINS'), g('PIS/PASEP'), g('INSS/CPP'), g('ICMS'), g('IPI'), g('ISS'), atv.total])
      }
    }
    if (r2.length > 0) {
      const ws2 = XLSX.utils.aoa_to_sheet([h2, ...r2])
      ws2['!cols'] = [{wch:10},{wch:50},{wch:10},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:10},{wch:10},{wch:14}]
      XLSX.utils.book_append_sheet(wb, ws2, 'Por Atividade')
    }

    const nome = `simples_nacional_${(empresaAtiva?.razao_social ?? 'empresa').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, nome)
  }, [declaracoes, empresaAtiva])

  const semEmpresa = !empresaAtiva

  return (
    <div style={S.page}>
      <div style={S.inner}>

        {/* Header */}
        <PageHeader
          title="Simples Nacional"
          subtitle="Apuração, confronto com PGDAS-D e conferência de declarações importadas."
          actions={
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {processando.length > 0 && (
                <span style={{ fontSize: 12, color: "var(--af-primary)" }}>Processando {processando.length} arquivo(s)…</span>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple
                style={{ display: "none" }}
                onChange={e => handleFiles(e.target.files)}
                onClick={e => { (e.target as HTMLInputElement).value = '' }}
              />
              {declaracoes.length > 0 && (
                <button
                  disabled={processando.length > 0}
                  onClick={handleLimparTudo}
                  title="Remover todas as declarações desta empresa"
                  style={{ ...S.btn, background: "rgba(239,68,68,0.10)", color: "var(--af-danger)", border: "1px solid rgba(239,68,68,0.25)" }}
                >
                  <Trash2 size={15} />
                  Limpar tudo
                </button>
              )}
              <button
                disabled={semEmpresa || processando.length > 0}
                onClick={() => fileInputRef.current?.click()}
                style={{ ...S.btn, background: "var(--af-primary)", color: "#fff", opacity: semEmpresa ? 0.4 : 1 }}
              >
                <Upload size={15} />
                Importar PDF
              </button>
            </div>
          }
        />

        {/* Abas */}
        {!semEmpresa && (
          <div style={{ display: 'flex', borderBottom: '2px solid var(--af-border)', marginBottom: 20, gap: 0, flexWrap: 'wrap' as const }}>
            {([
              ['apuracao_sistema', 'Apuração pelo Sistema'],
              ['declaracoes', 'PGDAS-D'],
              ['confronto_apuracao', 'Confronto'],
              ['configuracoes', 'Configurações'],
            ] as const).map(([aba, label]) => {
              const ativo = abaAtiva === aba
              return (
                <button
                  key={aba}
                  onClick={() => setAbaAtiva(aba)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '10px 20px', fontSize: 13, fontWeight: ativo ? 700 : 500,
                    color: ativo ? 'var(--af-primary)' : 'var(--af-muted)',
                    borderBottom: ativo ? '2px solid var(--af-primary)' : '2px solid transparent',
                    marginBottom: -2, transition: 'color 0.15s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* Sem empresa */}
        {semEmpresa && (
          <div style={{ ...S.card, padding: 20, color: "var(--af-warning)", display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: 13 }}>Selecione uma empresa no menu lateral para visualizar as declarações.</span>
          </div>
        )}

        {/* Aba: Declarações PGDAS-D */}
        {abaAtiva === 'declaracoes' && (
          <>
            {/* Erros de parse */}
            {erros.length > 0 && (
              <div style={{ ...S.card, padding: 16, marginBottom: 20, borderColor: "rgba(239,68,68,0.3)" }}>
                {erros.map((e, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--af-danger)" }}>
                    <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                    {e}
                  </div>
                ))}
              </div>
            )}

            {/* KPIs */}
            {!semEmpresa && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
                <KpiCard
                  title="Receita Último Período"
                  value={ultimaDeclaracao ? money.format(ultimaDeclaracao.receita_bruta_mes ?? 0) : "—"}
                  sub={ultimaDeclaracao?.competencia}
                />
                <KpiCard
                  title="Imposto Último Período"
                  value={ultimaDeclaracao ? money.format(ultimaDeclaracao.valor_total_devido ?? 0) : "—"}
                  color="var(--af-danger)"
                  sub={ultimaDeclaracao
                    ? `Alíq. ${pct((ultimaDeclaracao.valor_total_devido ?? 0) / (ultimaDeclaracao.receita_bruta_mes || 1))}`
                    : undefined}
                />
                <KpiCard
                  title={`Receita Total (${declaracoes.length} per.)`}
                  value={declaracoes.length > 0 ? money.format(totalReceita) : "—"}
                  color="var(--af-text)"
                />
                <KpiCard
                  title={`Imposto Total (${declaracoes.length} per.)`}
                  value={declaracoes.length > 0 ? money.format(totalImposto) : "—"}
                  color="var(--af-warning)"
                  sub={totalReceita > 0 ? `Alíq. média ${pct(totalImposto / totalReceita)}` : undefined}
                />
                {ultimaDeclaracao && (
                  <KpiCard
                    title="Acumulado 12 Meses"
                    value={money.format(ultimaDeclaracao.receita_bruta_acumulada_12m ?? 0)}
                    color="var(--af-muted)"
                    sub={`Limite: ${money.format(4800000)}`}
                  />
                )}
              </div>
            )}

            {/* Drag & drop quando vazio */}
            {!semEmpresa && declaracoes.length === 0 && processando.length === 0 && !carregando && (
              <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
                style={{ ...S.card, border: "2px dashed var(--af-border)", textAlign: "center", padding: "48px 24px", cursor: "pointer", marginBottom: 24 }}>
                <Upload size={32} style={{ color: "var(--af-primary)", marginBottom: 12 }} />
                <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 6px" }}>Arraste PDFs do PGDAS-D aqui</p>
                <p style={{ fontSize: 12, color: "var(--af-muted)", margin: 0 }}>ou clique para selecionar · Aceita múltiplos arquivos</p>
              </div>
            )}

            {/* Loading */}
            {carregando && declaracoes.length === 0 && (
              <div style={{ ...S.card, padding: "48px 24px", textAlign: "center", color: "var(--af-muted)", fontSize: 13 }}>
                Carregando declarações…
              </div>
            )}

            {/* Tabela */}
            {!semEmpresa && (declaracoes.length > 0 || carregando) && (
              <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--af-border)" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Declarações PGDAS-D</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" as const }}>
                    {carregando && <span style={{ fontSize: 12, color: "var(--af-muted)" }}>Atualizando…</span>}
                    <span style={{ fontSize: 12, color: "var(--af-muted)" }}>{declaracoes.length} período(s)</span>
                    <span style={{ fontSize: 11, color: "var(--af-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700, color: "var(--af-warning)" }}>Retificadora</span>
                      = declaração corrigida
                    </span>
                    <button
                      onClick={handleExportarExcel}
                      title="Exportar para Excel"
                      style={{ ...S.btn, padding: "6px 12px", background: "rgba(39,199,216,0.08)", border: "1px solid rgba(39,199,216,0.2)", color: "var(--af-primary)", fontSize: 12 }}
                    >
                      <Download size={14} />
                      Exportar Excel
                    </button>
                  </div>
                </div>
                <TabelaDeclaracoes declaracoes={declaracoes} onDelete={handleDelete} />
              </div>
            )}
          </>
        )}

        {/* Aba: Apuração pelo Sistema */}
        {abaAtiva === 'apuracao_sistema' && !semEmpresa && (
          <AbaApuracaoSistema
            empresaAtiva={empresaAtiva!}
            xmlCompetencia={xmlCompetencia}
            setXmlCompetencia={setXmlCompetencia}
            xmlDocumentos={xmlDocumentos}
            xmlItens={xmlItens}
            carregandoXmlDocs={carregandoXmlDocs}
            limpandoCompetencia={limpandoCompetencia}
            rbt12Carregado={rbt12Carregado}
            receitas12m={receitas12m}
            apuracao={apuracao}
            apuracaoErro={apuracaoErro}
            declaracaoPgdas={declaracaoPgdas}
            onApurar={handleApurar}
            onLimparCompetencia={handleLimparCompetencia}
            onIrParaValidador={() => router.push('/validador_entradas')}
          />
        )}

        {/* Aba: Confronto PGDAS × Apuração XML */}
        {abaAtiva === 'confronto_apuracao' && !semEmpresa && (
          <AbaConfronto items={confrontoData} carregando={carregandoNfe} />
        )}

        {/* Aba: Configurações (stub) */}
        {abaAtiva === 'configuracoes' && !semEmpresa && (
          <div style={{ ...S.card, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Settings size={18} style={{ color: 'var(--af-primary)' }} />
              <span style={{ fontWeight: 700, fontSize: 15 }}>Configurações da Empresa</span>
            </div>
            <div style={{ color: 'var(--af-muted)', fontSize: 13 }}>
              <p style={{ margin: '0 0 8px' }}>Em desenvolvimento. Aqui você poderá configurar:</p>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                <li>Regime de atividade predominante (Comércio / Indústria / Serviço / Misto)</li>
                <li>Anexo dos serviços prestados (III, IV ou V)</li>
                <li>Fator R — folha de salários dos últimos 12 meses</li>
                <li>Atividades com tratamento diferenciado (ST, monofásicos, exportação)</li>
                <li>Regras personalizadas de classificação de CFOP por empresa</li>
              </ul>
            </div>
          </div>
        )}

      </div>

      {/* Modal PGDAS */}
      {modalItems && (
        <ModalConfirmarImport
          items={modalItems}
          cnpjEmpresa={empresaAtiva?.cnpj}
          onConfirm={handleConfirmar}
          onCancel={() => { setModalItems(null); setSaveError(null) }}
          saving={saving}
          saveError={saveError}
        />
      )}

      {/* Modal RBT12 */}
      {rbt12Modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--af-surface)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Histórico de Receitas — RBT12</span>
              <button onClick={() => setRbt12Modal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--af-muted)', padding: 4 }}><X size={18} /></button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--af-muted)', marginBottom: 16 }}>
              O RBT12 de <strong>{xmlCompetencia}</strong> exige a receita bruta dos
              <strong> 12 meses anteriores</strong> ({fmtCompetencia(competenciasAnteriores(xmlCompetencia)[11])} a {fmtCompetencia(competenciasAnteriores(xmlCompetencia)[0])}).
              {receitas12m.length > 0 && (
                <> {receitas12m.length} meses já disponíveis; {mesesFaltantes.length} ausentes.</>
              )}
            </p>

            {/* Seção 1: meses faltantes individualmente */}
            {mesesFaltantes.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Meses ausentes — informe a receita bruta de cada mês
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mesesFaltantes.map(comp => (
                    <div key={comp} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--af-text-soft)', minWidth: 130 }}>{fmtCompetencia(comp)}</span>
                      <input
                        type="text"
                        placeholder="Ex: 38.000,00"
                        value={rbt12MesesInputs[comp] ?? ''}
                        onChange={e => setRbt12MesesInputs(prev => ({ ...prev, [comp]: e.target.value }))}
                        style={{ flex: 1, background: 'var(--af-surface-2)', border: '1px solid var(--af-border)', borderRadius: 8, padding: '7px 12px', fontSize: 13, color: 'var(--af-text)' }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleSalvarMesesIndividuais}
                  style={{ marginTop: 14, background: 'var(--af-primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' }}
                >
                  Salvar receitas mensais e recalcular
                </button>
              </div>
            )}

            {/* Separador */}
            <div style={{ borderTop: '1px solid var(--af-border)', marginBottom: 16, position: 'relative' }}>
              <span style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: 'var(--af-surface)', padding: '0 10px', fontSize: 11, color: 'var(--af-muted)' }}>
                ou informe o total
              </span>
            </div>

            {/* Seção 2: total RBT12 (distribui uniformemente) */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--af-muted)', display: 'block', marginBottom: 6 }}>
                RBT12 TOTAL — RECEITA BRUTA ACUMULADA 12 MESES (R$)
              </label>

              {/* Sugestão do PGDAS-D — exige confirmação explícita do usuário */}
              {rbt12Sugestao != null && (
                <div style={{ background: 'rgba(39,199,216,0.08)', border: '1px solid rgba(39,199,216,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: 'var(--af-primary)', marginBottom: 2 }}>Sugestão do PGDAS-D de {xmlCompetencia}</div>
                  <div style={{ color: 'var(--af-text-soft)' }}>
                    RBT12 conforme Receita Federal: <strong style={{ color: 'var(--af-text)' }}>{money.format(rbt12Sugestao)}</strong>
                  </div>
                  <div style={{ color: 'var(--af-muted)', marginTop: 4 }}>
                    Este valor foi calculado pela Receita Federal e reflete os 12 meses anteriores a {xmlCompetencia} conforme o PGDAS-D importado.
                    Confirme se corresponde ao período correto antes de usar.
                  </div>
                  <button
                    onClick={() => setRbt12Valor(rbt12Sugestao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                    style={{ marginTop: 8, background: 'rgba(39,199,216,0.15)', border: '1px solid rgba(39,199,216,0.35)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--af-primary)', cursor: 'pointer' }}
                  >
                    Usar este valor
                  </button>
                </div>
              )}

              <input
                type="text"
                placeholder="Ex: 450.000,00"
                value={rbt12Valor}
                onChange={e => setRbt12Valor(e.target.value)}
                style={{ width: '100%', background: 'var(--af-surface-2)', border: '1px solid var(--af-border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--af-text)', boxSizing: 'border-box' as const }}
              />
              <p style={{ fontSize: 11, color: 'var(--af-muted)', marginTop: 6 }}>
                O valor será distribuído uniformemente pelos 12 meses anteriores (origem: estimado).
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setRbt12Modal(false)} style={{ background: 'none', border: '1px solid var(--af-border)', borderRadius: 10, padding: '9px 16px', fontSize: 13, color: 'var(--af-muted)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleConfirmarRbt12} style={{ background: 'var(--af-primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Usar total e calcular
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
