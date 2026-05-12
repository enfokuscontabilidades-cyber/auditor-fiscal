"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Upload, X, FileText, AlertTriangle, ChevronDown, ChevronRight, Trash2, Download } from "lucide-react"
import * as XLSX from "xlsx"
import { useEmpresaAtiva } from "@/lib/hooks/useEmpresaAtiva"
import { parsePgdasPdf } from "@/lib/simples/parsePgdas"
import type { SnDeclaracao, SnParsedData } from "@/lib/types"

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
        <p style={{ fontSize: 11, marginTop: 4 }}>Clique em "+ Importar PDF" para começar.</p>
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SimplesNacionalPage() {
  const { empresaAtiva } = useEmpresaAtiva()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [declaracoes, setDeclaracoes] = useState<SnDeclaracao[]>([])
  const [carregando, setCarregando]   = useState(false)
  const [processando, setProcessando] = useState<string[]>([])
  const [erros, setErros]             = useState<string[]>([])
  const [modalItems, setModalItems]   = useState<ModalItem[] | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)

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

  const ultimaDeclaracao = useMemo(
    () => declaracoes.length === 0 ? null
      : [...declaracoes].sort((a, b) => b.competencia.localeCompare(a.competencia))[0],
    [declaracoes]
  )
  const totalImposto = useMemo(() => declaracoes.reduce((s, d) => s + (d.valor_total_devido ?? 0), 0), [declaracoes])
  const totalReceita = useMemo(() => declaracoes.reduce((s, d) => s + (d.receita_bruta_mes   ?? 0), 0), [declaracoes])

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Simples Nacional</h1>
            <p style={{ fontSize: 12, color: "var(--af-muted)", margin: "4px 0 0" }}>
              {empresaAtiva
                ? `${empresaAtiva.razao_social}${empresaAtiva.cnpj ? ` · ${empresaAtiva.cnpj}` : ''}`
                : "Nenhuma empresa selecionada"}
            </p>
          </div>
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
        </div>

        {/* Sem empresa */}
        {semEmpresa && (
          <div style={{ ...S.card, padding: 20, color: "var(--af-warning)", display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: 13 }}>Selecione uma empresa no menu lateral para visualizar as declarações.</span>
          </div>
        )}

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

      </div>

      {/* Modal */}
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
    </div>
  )
}
