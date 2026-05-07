"use client"

import React, { useMemo, useState, useRef } from "react"
import { Upload, Trash2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, FileText, X } from "lucide-react"
import { type DadosSessao, type DadosSessaoLote } from "@/components/ModalSessao"
import ModalSessaoSped from "@/components/ModalSessaoSped"
import { useEmpresaAtiva } from "@/lib/hooks/useEmpresaAtiva"
import {
  parseFiscal, parseContrib,
  mergeFiscalDatasets, mergeContribDatasets,
  detectarTipoSped, extractCnpjFromHeader,
  baseCnpj, isMatrix, formatarPeriodo,
} from "@/lib/sped/parsers"
import { cruzarDocumentos, validarTudo } from "@/lib/sped/validators"
import type { SpedFiscalParsed, SpedContribParsed } from "@/lib/sped/types"

// ─── Tipos locais ─────────────────────────────────────────────────────────────

type ArquivoCarregado = {
  id: string; nome: string; tipo: "fiscal" | "contrib"; subtipo: "matriz" | "filial"
  periodo: string; competencia: string; cnpj: string
  data: SpedFiscalParsed | SpedContribParsed
}

type FilaPendente = {
  file: File; tipo: "fiscal" | "contrib"; subtipo: "matriz" | "filial"
  periodo: string; competencia: string; cnpjArquivo: string; nomeEmpresaArquivo: string
  tamanhoBytes: number; totalLinhas: number; data: SpedFiscalParsed | SpedContribParsed
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S = {
  page:  { minHeight: "100vh", background: "var(--af-surface-2)", color: "var(--af-text)", padding: "28px 24px 64px", fontFamily: "'Segoe UI',system-ui,sans-serif" } as React.CSSProperties,
  inner: { maxWidth: 1400, margin: "0 auto" } as React.CSSProperties,
  card:  { background: "var(--af-surface)", border: "1px solid var(--af-border)", borderRadius: 16, padding: "20px 24px", boxShadow: "0 4px 20px rgba(15,23,42,0.06)" } as React.CSSProperties,
  th:    { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--af-muted)", textAlign: "left" as const, borderBottom: "1px solid var(--af-border)", background: "var(--af-surface-2)", whiteSpace: "nowrap" as const, letterSpacing: "0.06em", textTransform: "uppercase" as const },
  td:    { padding: "9px 14px", fontSize: 12, color: "var(--af-text-soft)", borderBottom: "1px solid var(--af-border)", verticalAlign: "middle" as const },
  btn:   { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 10, fontWeight: 600, fontSize: 13, padding: "9px 16px", cursor: "pointer", border: "none" } as React.CSSProperties,
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

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

function ChipStatus({ status }: { status: "OK" | "só fiscal" | "só contrib" }) {
  const map = {
    "OK":         { bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.25)",  color: "var(--af-success)", label: "OK" },
    "só fiscal":  { bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.25)", color: "var(--af-warning)", label: "Só Fiscal" },
    "só contrib": { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)",  color: "var(--af-danger)",  label: "Só Contrib" },
  }
  const c = map[status]
  return <span style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, color: c.color, whiteSpace: "nowrap" }}>{c.label}</span>
}

function ChipNivel({ nivel }: { nivel: "alto" | "medio" | "baixo" }) {
  const map = {
    alto:  { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)",  color: "var(--af-danger)",  label: "Alto" },
    medio: { bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.25)", color: "var(--af-warning)", label: "Médio" },
    baixo: { bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.25)",  color: "var(--af-success)", label: "Baixo" },
  }
  const c = map[nivel]
  return <span style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, color: c.color, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{c.label}</span>
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AuditorSpedPage() {
  const { empresaAtiva } = useEmpresaAtiva()

  const [arquivos, setArquivos] = useState<ArquivoCarregado[]>([])
  const [aba, setAba] = useState<"cruzamento" | "apuracao" | "inconsistencias">("cruzamento")
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "OK" | "só fiscal" | "só contrib">("todos")
  const [busca, setBusca] = useState("")

  const [filaPendente, setFilaPendente] = useState<FilaPendente[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [rejeitados, setRejeitados] = useState<{ nome: string; motivo: string }[]>([])
  const [erroImport, setErroImport] = useState("")

  const inputFiscalRef  = useRef<HTMLInputElement>(null)
  const inputContribRef = useRef<HTMLInputElement>(null)

  // ─── Carregamento ──────────────────────────────────────────────────────────

  async function carregarArquivos(files: File[]) {
    if (!empresaAtiva) { setErroImport("Selecione uma empresa em análise antes de importar."); return }

    const lote: FilaPendente[] = []
    const rej: { nome: string; motivo: string }[] = []

    for (const file of files) {
      const text = await file.text()
      const primeiraLinha = text.split(/\r?\n/).find(l => l.trim().length > 0)
      if (!primeiraLinha?.startsWith("|0000|")) { rej.push({ nome: file.name, motivo: "Registro 0000 ausente — não é um arquivo SPED" }); continue }

      const tipo = detectarTipoSped(text)
      if (!tipo) { rej.push({ nome: file.name, motivo: "Não é SPED Fiscal nem SPED Contribuições (ECF/ECD não suportado)" }); continue }

      const cnpjArquivo = extractCnpjFromHeader(text)
      if (cnpjArquivo && empresaAtiva.cnpj && baseCnpj(cnpjArquivo) !== baseCnpj(empresaAtiva.cnpj)) {
        rej.push({ nome: file.name, motivo: `CNPJ ${cnpjArquivo} não pertence à empresa ativa` }); continue
      }

      const subtipo: "matriz" | "filial" = isMatrix(cnpjArquivo) ? "matriz" : "filial"
      const data = tipo === "fiscal" ? parseFiscal(text, subtipo === "matriz" ? "Matriz" : "Filial") : parseContrib(text)
      const company = data.company
      const periodo = company ? `${company.periodoInicial}–${company.periodoFinal}` : "Desconhecido"
      const competencia = company?.periodoInicial?.length === 8 ? formatarPeriodo(company.periodoInicial) : ""

      lote.push({ file, tipo, subtipo, data, periodo, competencia, cnpjArquivo, nomeEmpresaArquivo: company?.nome ?? "", tamanhoBytes: file.size, totalLinhas: text.split(/\r?\n/).length })
    }

    setRejeitados(rej)
    setErroImport("")
    if (lote.length > 0) { setFilaPendente(prev => [...prev, ...lote]); setModalAberto(true) }
  }

  async function salvarArquivo(p: FilaPendente, sessaoId: string, empresaId: string, competencia: string) {
    let parsed_data: Record<string, unknown> | null = null
    if (p.tipo === "fiscal") {
      const d = p.data as SpedFiscalParsed
      parsed_data = { company: d.company, e110: d.e110, c190_count: d.c190.length }
    } else {
      const d = p.data as SpedContribParsed
      parsed_data = { company: d.company, isZeroed: d.isZeroed, m200: d.m200, m600: d.m600 }
    }
    await fetch("/api/arquivos-sped", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessao_id: sessaoId, empresa_id: empresaId, nome_arquivo: p.file.name,
        tipo: p.tipo, subtipo: p.subtipo, competencia,
        periodo_inicial: p.periodo.split("–")[0] ?? "",
        periodo_final:   p.periodo.split("–")[1] ?? "",
        cnpj_declarante: p.cnpjArquivo, tamanho_bytes: p.tamanhoBytes,
        total_linhas: p.totalLinhas, parsed_data,
      }),
    })
  }

  async function onConfirmarSessao(dados: DadosSessao) {
    for (const p of filaPendente) {
      const id = `${p.tipo}-${p.subtipo}-${p.periodo}-${Date.now()}`
      setArquivos(prev => [...prev, { id, nome: p.file.name, tipo: p.tipo, subtipo: p.subtipo, periodo: p.periodo, competencia: p.competencia, cnpj: p.cnpjArquivo, data: p.data }])
      try { await salvarArquivo(p, dados.sessaoId, dados.empresaId, dados.competencia) } catch { /* silencia — offline */ }
    }
    setFilaPendente([]); setModalAberto(false)
  }

  async function onConfirmarSessaoLote(dados: DadosSessaoLote) {
    for (const p of filaPendente) {
      const id = `${p.tipo}-${p.subtipo}-${p.periodo}-${Date.now()}`
      setArquivos(prev => [...prev, { id, nome: p.file.name, tipo: p.tipo, subtipo: p.subtipo, periodo: p.periodo, competencia: p.competencia, cnpj: p.cnpjArquivo, data: p.data }])
      const sessao = dados.sessoes.find(s => s.competencia === p.competencia) ?? dados.sessoes[0]
      try { await salvarArquivo(p, sessao.sessaoId, dados.empresaId, sessao.competencia) } catch { /* silencia */ }
    }
    setFilaPendente([]); setModalAberto(false)
  }

  // ─── Dados consolidados ────────────────────────────────────────────────────

  const fiscalMerged = useMemo(() => {
    const datasets = arquivos.filter(a => a.tipo === "fiscal").map(a => a.data as SpedFiscalParsed)
    return mergeFiscalDatasets(datasets)
  }, [arquivos])

  const contribMerged = useMemo(() => {
    const datasets = arquivos.filter(a => a.tipo === "contrib").map(a => a.data as SpedContribParsed)
    return mergeContribDatasets(datasets)
  }, [arquivos])

  const cruzamento = useMemo(() => cruzarDocumentos(fiscalMerged, contribMerged), [fiscalMerged, contribMerged])
  const inconsistencias = useMemo(() => validarTudo(fiscalMerged, contribMerged), [fiscalMerged, contribMerged])

  const cruzamentoFiltrado = useMemo(() => {
    let lista = cruzamento
    if (filtroStatus !== "todos") lista = lista.filter(i => i.status === filtroStatus)
    if (busca.trim()) {
      const q = busca.trim().toLowerCase()
      lista = lista.filter(i => [i.numDoc, i.participante, i.dtDoc, i.cfopsFiscal, i.cfopsContrib].some(v => v.toLowerCase().includes(q)))
    }
    return lista
  }, [cruzamento, filtroStatus, busca])

  const divergencias = cruzamento.filter(i => i.status !== "OK").length
  const kpiArqFiscal  = arquivos.filter(a => a.tipo === "fiscal").length
  const kpiArqContrib = arquivos.filter(a => a.tipo === "contrib").length

  function toggle(key: string) { setExpandidos(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n }) }

  // ─── Renderização ──────────────────────────────────────────────────────────

  const temDados = arquivos.length > 0

  return (
    <div style={S.page}>
      <div style={S.inner}>

        {/* CABEÇALHO */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--af-text)", letterSpacing: "-0.01em" }}>
            Auditor SPED
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--af-muted)" }}>
            {empresaAtiva ? `${empresaAtiva.razao_social} — CNPJ ${empresaAtiva.cnpj}` : "Selecione uma empresa na barra lateral"}
          </p>
        </div>

        {/* ÁREA DE IMPORTAÇÃO */}
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input ref={inputFiscalRef}  type="file" multiple accept=".txt,.sped,.TXT" style={{ display: "none" }} onChange={e => { if (e.target.files) carregarArquivos(Array.from(e.target.files)); e.target.value = "" }} />
              <input ref={inputContribRef} type="file" multiple accept=".txt,.sped,.TXT" style={{ display: "none" }} onChange={e => { if (e.target.files) carregarArquivos(Array.from(e.target.files)); e.target.value = "" }} />
              <button style={{ ...S.btn, background: "linear-gradient(135deg,var(--af-primary),#1a8fa0)", color: "#fff", boxShadow: "0 4px 14px rgba(39,199,216,0.25)" }} onClick={() => inputFiscalRef.current?.click()}>
                <Upload size={14} />Importar SPED Fiscal
              </button>
              <button style={{ ...S.btn, background: "var(--af-surface)", border: "1px solid var(--af-border)", color: "var(--af-primary)" }} onClick={() => inputContribRef.current?.click()}>
                <Upload size={14} />Importar SPED Contrib
              </button>
            </div>
            {arquivos.length > 0 && (
              <button style={{ ...S.btn, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "var(--af-danger)", fontSize: 12 }} onClick={() => { setArquivos([]); setExpandidos(new Set()); setBusca(""); setFiltroStatus("todos") }}>
                <Trash2 size={13} />Limpar tudo
              </button>
            )}
          </div>

          {/* Erro de importação */}
          {erroImport && (
            <div style={{ marginTop: 12, padding: "8px 14px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 12, color: "var(--af-danger)" }}>
              {erroImport}
            </div>
          )}

          {/* Arquivos rejeitados */}
          {rejeitados.length > 0 && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, fontSize: 12 }}>
              <strong style={{ color: "var(--af-danger)" }}>Arquivos rejeitados:</strong>
              {rejeitados.map((r, i) => <div key={i} style={{ color: "var(--af-text-soft)", marginTop: 2 }}>• {r.nome}: {r.motivo}</div>)}
            </div>
          )}

          {/* Status dos arquivos carregados */}
          {arquivos.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(["fiscal", "contrib"] as const).map(tipo => {
                const lista = arquivos.filter(a => a.tipo === tipo)
                if (!lista.length) return null
                const cor = tipo === "fiscal" ? "var(--af-primary)" : "var(--af-success)"
                const label = tipo === "fiscal" ? "Fiscal" : "Contrib"
                const periodos = [...new Set(lista.map(a => a.competencia || a.periodo))].join(", ")
                return (
                  <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ color: "var(--af-text)", fontWeight: 600 }}>SPED {label}:</span>
                    <span style={{ color: "var(--af-muted)" }}>{lista.length} arquivo(s) · {periodos}</span>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--af-muted)", padding: 0 }} title="Remover todos do tipo" onClick={() => setArquivos(prev => prev.filter(a => a.tipo !== tipo))}>
                      <X size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* KPIs */}
        {temDados && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 12, marginBottom: 20 }}>
            <KpiCard title="Docs Fiscal"  value={String(fiscalMerged?.docs.length  ?? 0)} color="var(--af-primary)" />
            <KpiCard title="Docs Contrib" value={String(contribMerged?.docs.length ?? 0)} color="var(--af-success)" />
            <KpiCard title="Divergências" value={String(divergencias)} color={divergencias > 0 ? "var(--af-warning)" : "var(--af-success)"} sub={divergencias > 0 ? "Docs em apenas um SPED" : "Tudo cruzado"} />
            {fiscalMerged?.e110 && <KpiCard title="ICMS a Recolher" value={money.format(fiscalMerged.e110.vlIcmsRecolher)} color="var(--af-text)" sub={fiscalMerged.e110.periodo} />}
            {contribMerged?.m200 && <KpiCard title="PIS do período"  value={money.format(contribMerged.m200.vlContPagar)} color="var(--af-text)" />}
            {contribMerged?.m600 && <KpiCard title="COFINS do período" value={money.format(contribMerged.m600.vlContPagar)} color="var(--af-text)" />}
            <KpiCard title="Inconsistências" value={String(inconsistencias.length)} color={inconsistencias.length > 0 ? "var(--af-danger)" : "var(--af-success)"} sub={inconsistencias.filter(i => i.nivel === "alto").length > 0 ? `${inconsistencias.filter(i => i.nivel === "alto").length} de nível Alto` : undefined} />
          </div>
        )}

        {/* ABAS */}
        {temDados && (
          <>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {([
                { id: "cruzamento",      label: `Cruzamento${divergencias > 0 ? ` (${divergencias})` : ""}` },
                { id: "apuracao",        label: "Apuração" },
                { id: "inconsistencias", label: `Inconsistências${inconsistencias.length > 0 ? ` (${inconsistencias.length})` : ""}` },
              ] as const).map(a => (
                <button key={a.id} onClick={() => setAba(a.id)} style={{ padding: "8px 18px", borderRadius: "12px 12px 0 0", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: aba === a.id ? "var(--af-surface)" : "rgba(0,0,0,0.04)", color: aba === a.id ? "var(--af-primary)" : "var(--af-muted)", borderBottom: aba === a.id ? "2px solid var(--af-primary)" : "2px solid transparent" }}>
                  {a.label}
                </button>
              ))}
            </div>

            {/* ═══ ABA: CRUZAMENTO ═══ */}
            {aba === "cruzamento" && (
              <div style={{ ...S.card, overflow: "hidden", padding: 0 }}>
                {/* Filtros */}
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--af-border)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nota, participante…" style={{ background: "var(--af-surface-2)", border: "1px solid var(--af-border)", borderRadius: 8, color: "var(--af-text)", fontSize: 12, padding: "6px 10px", outline: "none", minWidth: 220 }} />
                  <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)} style={{ background: "var(--af-surface-2)", border: "1px solid var(--af-border)", borderRadius: 8, color: "var(--af-text)", fontSize: 12, padding: "6px 10px" }}>
                    <option value="todos">Todos os status</option>
                    <option value="OK">OK</option>
                    <option value="só fiscal">Só Fiscal</option>
                    <option value="só contrib">Só Contrib</option>
                  </select>
                  <span style={{ fontSize: 11, color: "var(--af-muted)", marginLeft: "auto" }}>{cruzamentoFiltrado.length} registros</span>
                </div>
                {/* Tabela */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr>
                      <th style={{ ...S.th, width: 32 }}></th>
                      {["Nota", "Data", "Participante", "Valor Fiscal", "Valor Contrib", "CFOP Fiscal", "Status"].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {cruzamentoFiltrado.length === 0
                        ? <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "var(--af-muted)", padding: "40px 20px" }}>{cruzamento.length === 0 ? "Importe arquivos SPED para visualizar o cruzamento." : "Nenhum resultado com os filtros aplicados."}</td></tr>
                        : cruzamentoFiltrado.map(item => {
                          const exp = expandidos.has(item.key)
                          const bgRow = item.status === "OK" ? "transparent" : item.status === "só fiscal" ? "rgba(251,191,36,0.03)" : "rgba(239,68,68,0.03)"
                          return (
                            <React.Fragment key={item.key}>
                              <tr style={{ background: bgRow }}>
                                <td style={{ ...S.td, textAlign: "center", cursor: "pointer" }} onClick={() => toggle(item.key)}>
                                  {exp ? <ChevronDown size={13} color="var(--af-primary)" /> : <ChevronRight size={13} color="var(--af-muted)" />}
                                </td>
                                <td style={{ ...S.td, fontWeight: 700, color: "var(--af-text)" }}>{item.numDoc || "—"}</td>
                                <td style={{ ...S.td, color: "var(--af-muted)" }}>{item.dtDoc || "—"}</td>
                                <td style={{ ...S.td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.participante}</td>
                                <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{item.vlDocFiscal ? money.format(item.vlDocFiscal) : "—"}</td>
                                <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace" }}>{item.vlDocContrib ? money.format(item.vlDocContrib) : "—"}</td>
                                <td style={S.td}>{item.cfopsFiscal || "—"}</td>
                                <td style={S.td}><ChipStatus status={item.status} /></td>
                              </tr>
                              {exp && (
                                <tr style={{ background: "rgba(39,199,216,0.02)" }}>
                                  <td colSpan={8} style={{ padding: "8px 20px 12px 48px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "6px 24px", fontSize: 11 }}>
                                      <div><span style={{ color: "var(--af-muted)", marginRight: 6 }}>Chave NF-e:</span><span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{item.key.length === 44 ? item.key : "—"}</span></div>
                                      <div><span style={{ color: "var(--af-muted)", marginRight: 6 }}>CFOP Contrib:</span>{item.cfopsContrib || "—"}</div>
                                      <div><span style={{ color: "var(--af-muted)", marginRight: 6 }}>Diferença valor:</span>
                                        {item.vlDocFiscal && item.vlDocContrib ? money.format(Math.abs(item.vlDocFiscal - item.vlDocContrib)) : "—"}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ ABA: APURAÇÃO ═══ */}
            {aba === "apuracao" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* ICMS */}
                {fiscalMerged?.e110 ? (
                  <div style={S.card}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--af-text)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      <FileText size={15} style={{ color: "var(--af-primary)" }} />ICMS — Apuração (E110)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                      {[
                        { label: "Total Débitos",    value: fiscalMerged.e110.vlTotDebitos,           color: "var(--af-danger)" },
                        { label: "Total Créditos",   value: fiscalMerged.e110.vlTotCreditos,          color: "var(--af-success)" },
                        { label: "Saldo Apurado",    value: fiscalMerged.e110.vlSldApurado,           color: "var(--af-warning)" },
                        { label: "ICMS a Recolher",  value: fiscalMerged.e110.vlIcmsRecolher,         color: "var(--af-text)" },
                        { label: "Saldo Credor",     value: fiscalMerged.e110.vlSldCredorTransportar, color: "var(--af-success)" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: "var(--af-surface-2)", borderRadius: 10, padding: "12px 16px", border: "1px solid var(--af-border)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color }}>{money.format(value)}</div>
                        </div>
                      ))}
                    </div>
                    {/* Verificação C190 × E110 */}
                    {(() => {
                      const somaC190 = fiscalMerged.c190.filter(c => c.indOper === "1").reduce((s, c) => s + c.icms, 0)
                      if (somaC190 === 0) return null
                      const diff = Math.abs(fiscalMerged.e110.vlTotDebitos - somaC190) / somaC190
                      if (diff < 0.05) return null
                      return (
                        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, fontSize: 12, color: "var(--af-warning)" }}>
                          <AlertTriangle size={14} />
                          E110 diverge {(diff * 100).toFixed(1)}% da soma dos C190 de saída ({money.format(somaC190)}). Verifique os ajustes de apuração.
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div style={{ ...S.card, color: "var(--af-muted)", fontSize: 13 }}>Importe o SPED Fiscal para visualizar a apuração de ICMS (E110).</div>
                )}

                {/* PIS / COFINS */}
                {contribMerged && (contribMerged.m200 || contribMerged.m600) ? (
                  <div style={S.card}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--af-text)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      <FileText size={15} style={{ color: "var(--af-success)" }} />PIS / COFINS — Apuração (M200 / M600)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                      {[
                        { label: "Receita Bruta",     value: contribMerged.m200?.vlRecBrt ?? 0,     color: "var(--af-text)" },
                        { label: "Base PIS",           value: contribMerged.m200?.vlBcCont ?? 0,    color: "var(--af-text)" },
                        { label: "PIS do período",     value: contribMerged.m200?.vlContPer ?? 0,   color: "var(--af-warning)" },
                        { label: "PIS a recolher",     value: contribMerged.m200?.vlContPagar ?? 0, color: "var(--af-danger)" },
                        { label: "Base COFINS",        value: contribMerged.m600?.vlBcCont ?? 0,    color: "var(--af-text)" },
                        { label: "COFINS do período",  value: contribMerged.m600?.vlContPer ?? 0,   color: "var(--af-warning)" },
                        { label: "COFINS a recolher",  value: contribMerged.m600?.vlContPagar ?? 0, color: "var(--af-danger)" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: "var(--af-surface-2)", borderRadius: 10, padding: "12px 16px", border: "1px solid var(--af-border)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color }}>{money.format(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ ...S.card, color: "var(--af-muted)", fontSize: 13 }}>Importe o SPED Contribuições para visualizar a apuração de PIS/COFINS (M200/M600).</div>
                )}
              </div>
            )}

            {/* ═══ ABA: INCONSISTÊNCIAS ═══ */}
            {aba === "inconsistencias" && (
              <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                {inconsistencias.length === 0 ? (
                  <div style={{ padding: "40px 24px", textAlign: "center" }}>
                    <CheckCircle2 size={32} style={{ color: "var(--af-success)", marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, color: "var(--af-text)", marginBottom: 4 }}>Nenhuma inconsistência detectada</div>
                    <div style={{ fontSize: 12, color: "var(--af-muted)" }}>Todas as validações automáticas passaram. Certifique-se de importar ambos os SPEDs para análise completa.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {inconsistencias.map(inc => {
                      const exp = expandidos.has(inc.id)
                      const corBorda = inc.nivel === "alto" ? "var(--af-danger)" : inc.nivel === "medio" ? "var(--af-warning)" : "var(--af-success)"
                      return (
                        <div key={inc.id} style={{ borderLeft: `3px solid ${corBorda}`, borderBottom: "1px solid var(--af-border)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", cursor: "pointer", justifyContent: "space-between" }} onClick={() => toggle(inc.id)}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                              <ChipNivel nivel={inc.nivel} />
                              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--af-text)" }}>{inc.titulo}</span>
                              <span style={{ fontSize: 11, color: "var(--af-muted)", flexShrink: 0 }}>{inc.registros.length} registros</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                              {inc.valorImpacto !== undefined && (
                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--af-warning)" }}>{money.format(inc.valorImpacto)}</span>
                              )}
                              {exp ? <ChevronDown size={14} color="var(--af-muted)" /> : <ChevronRight size={14} color="var(--af-muted)" />}
                            </div>
                          </div>
                          {exp && (
                            <div style={{ padding: "0 20px 16px", borderTop: "1px solid var(--af-border)" }}>
                              <p style={{ margin: "12px 0 10px", fontSize: 13, color: "var(--af-muted)", lineHeight: 1.55 }}>{inc.descricao}</p>
                              {inc.registros.length > 0 && (
                                <div style={{ overflowX: "auto" }}>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                    <thead><tr>
                                      {Object.keys(inc.registros[0]).map(k => <th key={k} style={{ ...S.th, fontSize: 10 }}>{k}</th>)}
                                    </tr></thead>
                                    <tbody>
                                      {inc.registros.slice(0, 20).map((r, i) => (
                                        <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(39,199,216,0.01)" }}>
                                          {Object.values(r).map((v, j) => <td key={j} style={S.td}>{String(v ?? "—")}</td>)}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {inc.registros.length > 20 && <div style={{ padding: "6px 14px", fontSize: 11, color: "var(--af-muted)" }}>+ {inc.registros.length - 20} registros adicionais</div>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Estado vazio */}
        {!temDados && (
          <div style={{ ...S.card, textAlign: "center", padding: "60px 40px", marginTop: 8 }}>
            <FileText size={36} style={{ color: "var(--af-muted)", marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontWeight: 600, color: "var(--af-text)", marginBottom: 6 }}>Nenhum arquivo carregado</div>
            <div style={{ fontSize: 13, color: "var(--af-muted)" }}>Importe o SPED Fiscal e/ou o SPED Contribuições para iniciar a análise.</div>
          </div>
        )}
      </div>

      {/* Modal de sessão */}
      {modalAberto && empresaAtiva && (
        <ModalSessaoSped
          aberto={modalAberto}
          empresaId={empresaAtiva.id}
          empresaNome={empresaAtiva.razao_social}
          arquivos={filaPendente.map(p => ({ nome: p.file.name, competencia: p.competencia, tipo: p.tipo, subtipo: p.subtipo }))}
          onConfirmar={onConfirmarSessao}
          onConfirmarLote={onConfirmarSessaoLote}
          onCancelar={() => { setModalAberto(false); setFilaPendente([]) }}
        />
      )}
    </div>
  )
}
