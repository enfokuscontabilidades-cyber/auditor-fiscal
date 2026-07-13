"use client"

import React, { useRef, useState } from "react"
import {
  Upload, FileText, CheckCircle2, XCircle, AlertTriangle, ChevronRight,
  Download, Loader2, RotateCcw, ArrowLeft, FilePen, Info,
} from "lucide-react"
import PageHeader from "@/components/ui/PageHeader"
import PaginationControls, { getPageItems } from "@/components/ui/PaginationControls"
import * as XLSX from "xlsx"
import { parseSpedEditor } from "@/lib/sped/editor/parser"
import { mesclarSped, validarCnpjPeriodo, getProdutosNovos } from "@/lib/sped/editor/merger"
import { validarArquivoFinal } from "@/lib/sped/editor/validator"
import { gerarSpedTxt } from "@/lib/sped/editor/generator"
import type {
  SpedEditorParsed, ConflitoRegistro, ErroValidacao,
  ResultadoMescla, Sped0200Ext,
} from "@/lib/sped/editor/types"

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S = {
  page:  { minHeight: "100vh", background: "var(--af-surface-2)", color: "var(--af-text)", padding: "28px 24px 64px", fontFamily: "'Segoe UI',system-ui,sans-serif" } as React.CSSProperties,
  inner: { maxWidth: 1200, margin: "0 auto" } as React.CSSProperties,
  card:  { background: "var(--af-surface)", border: "1px solid var(--af-border)", borderRadius: 16, padding: "20px 24px", boxShadow: "0 4px 20px rgba(15,23,42,0.06)" } as React.CSSProperties,
  th:    { padding: "9px 12px", fontSize: 11, fontWeight: 700, color: "var(--af-muted)", textAlign: "left" as const, borderBottom: "1px solid var(--af-border)", background: "var(--af-surface-2)", whiteSpace: "nowrap" as const, letterSpacing: "0.06em", textTransform: "uppercase" as const },
  td:    { padding: "9px 12px", fontSize: 13, color: "var(--af-text-soft)", borderBottom: "1px solid var(--af-border)", verticalAlign: "middle" as const },
  btn:   { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 10, fontWeight: 600, fontSize: 13, padding: "9px 18px", cursor: "pointer", border: "none" } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4, display: "block" } as React.CSSProperties,
}

const TIPO_ITEM: Record<string, string> = {
  "00": "Mercadoria p/ Revenda", "01": "Matéria-Prima", "02": "Embalagem",
  "03": "Produto em Processo",   "04": "Produto Acabado", "05": "Subproduto",
  "06": "Insumo",                "07": "Uso e Consumo",   "08": "Ativo Imobilizado",
  "09": "Serviços",              "10": "Outros Insumos",  "99": "Outras",
}

const CAMPO_LABEL: Record<string, string> = {
  descr_item: "Descrição", unid_inv: "Unidade", tipo_item: "Tipo do Item",
  cod_ncm: "NCM", aliq_icms: "Alíq. ICMS", cest: "CEST",
}

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "")
  if (d.length !== 14) return v
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
function formatPeriodo(ini: string, fin: string) {
  const fmt = (s: string) => s.length === 8 ? `${s.slice(2,4)}/${s.slice(4)}` : s
  return `${fmt(ini)} – ${fmt(fin)}`
}
function fmtKB(b: number) { return b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB` }

async function lerArquivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = e => resolve((e.target?.result as string) ?? "")
    r.onerror = () => reject(new Error("Erro ao ler arquivo"))
    r.readAsText(file, "iso-8859-1")
  })
}

// ─── StepBar ──────────────────────────────────────────────────────────────────

const ETAPAS = ["Importar", "Validar", "Comparar", "Conflitos", "Editar", "Verificar", "Gerar"]

function StepBar({ etapa }: { etapa: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28, overflowX: "auto" as const, paddingBottom: 4 }}>
      {ETAPAS.map((label, i) => {
        const n = i + 1
        const ativo = n === etapa
        const feito = n < etapa
        return (
          <React.Fragment key={n}>
            <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", minWidth: 72 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                background: feito ? "var(--af-primary)" : ativo ? "rgba(39,199,216,0.15)" : "var(--af-surface-2)",
                border: ativo ? "2px solid var(--af-primary)" : feito ? "2px solid var(--af-primary)" : "2px solid var(--af-border)",
                color: feito ? "#fff" : ativo ? "var(--af-primary)" : "var(--af-muted)",
              }}>
                {feito ? <CheckCircle2 size={16} /> : n}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: ativo ? "var(--af-primary)" : "var(--af-muted)", marginTop: 4, whiteSpace: "nowrap" as const }}>{label}</div>
            </div>
            {i < ETAPAS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i + 1 < etapa ? "var(--af-primary)" : "var(--af-border)", minWidth: 16, margin: "0 4px", marginBottom: 16 }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({ label, sublabel, file, cor, onSelect }: {
  label: string; sublabel: string; file: File | null; cor: string; onSelect: (f: File) => void
}) {
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onSelect(f) }}
      style={{
        border: `2px dashed ${drag ? cor : file ? cor : "var(--af-border)"}`,
        borderRadius: 14, padding: "28px 20px", cursor: "pointer", textAlign: "center",
        background: drag ? "rgba(39,199,216,0.05)" : file ? "rgba(39,199,216,0.03)" : "var(--af-surface-2)",
        transition: "all 0.2s", flex: 1,
      }}
    >
      <input ref={ref} type="file" accept=".txt" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onSelect(f) }} />
      {file ? (
        <>
          <FileText size={28} style={{ color: cor, margin: "0 auto 10px" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--af-text)", marginBottom: 4 }}>{file.name}</div>
          <div style={{ fontSize: 12, color: "var(--af-muted)" }}>{fmtKB(file.size)} · Clique para trocar</div>
        </>
      ) : (
        <>
          <Upload size={28} style={{ color: "var(--af-muted)", margin: "0 auto 10px" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--af-text-soft)", marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 12, color: "var(--af-muted)" }}>{sublabel}</div>
          <div style={{ fontSize: 11, color: "var(--af-muted)", marginTop: 6 }}>Arraste ou clique · .txt</div>
        </>
      )}
    </div>
  )
}

// ─── ResumoCard ───────────────────────────────────────────────────────────────

function ResumoCard({ label, cor, parsed }: { label: string; cor: string; parsed: SpedEditorParsed }) {
  const r = parsed.resumo
  return (
    <div style={{ ...S.card, flex: 1, borderTop: `3px solid ${cor}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: cor, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>{label}</div>
      <Row k="Empresa"  v={r.nome || "—"} />
      <Row k="CNPJ"     v={formatCnpj(r.cnpj)} />
      <Row k="Período"  v={formatPeriodo(r.periodoInicial, r.periodoFinal)} />
      <Row k="UF"       v={r.uf || "—"} />
      <Row k="Linhas"   v={r.totalLinhas.toLocaleString("pt-BR")} />
      <Row k="Blocos"   v={r.blocos.join("  ")} mono />
      <Row k="0200"     v={`${r.totalRegistros0200} produto(s)`} />
      <Row k="Bloco K"  v={r.temBlocoK ? `✓ ${r.totalRegistrosK} registro(s)` : "Ausente"} cor={r.temBlocoK ? "#22c55e" : "#ef4444"} />
      {r.produtosNoK.length > 0 && (
        <Row k="Prods. K" v={`${r.produtosNoK.length} produto(s) referenciado(s)`} />
      )}
    </div>
  )
}

function Row({ k, v, mono, cor }: { k: string; v: string; mono?: boolean; cor?: string }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--af-border)", fontSize: 13 }}>
      <span style={{ color: "var(--af-muted)", minWidth: 80 }}>{k}</span>
      <span style={{ fontWeight: 600, fontFamily: mono ? "monospace" : undefined, color: cor ?? "var(--af-text)" }}>{v}</span>
    </div>
  )
}

// ─── Alert ────────────────────────────────────────────────────────────────────

function Alert({ tipo, msgs }: { tipo: "erro" | "aviso" | "ok"; msgs: string[] }) {
  if (msgs.length === 0) return null
  const colors = { erro: "#ef4444", aviso: "#f59e0b", ok: "#22c55e" }
  const icons  = { erro: <XCircle size={16} />, aviso: <AlertTriangle size={16} />, ok: <CheckCircle2 size={16} /> }
  return (
    <div style={{ background: `${colors[tipo]}14`, border: `1px solid ${colors[tipo]}40`, borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10 }}>
      <span style={{ color: colors[tipo], flexShrink: 0, paddingTop: 2 }}>{icons[tipo]}</span>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {msgs.map((m, i) => <li key={i} style={{ fontSize: 13, color: colors[tipo], marginBottom: i < msgs.length - 1 ? 4 : 0 }}>{m}</li>)}
      </ul>
    </div>
  )
}

// ─── NavButtons ───────────────────────────────────────────────────────────────

function NavButtons({ onBack, onNext, nextLabel = "Próximo", nextDisabled = false, loading = false }: {
  onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; loading?: boolean
}) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
      {onBack ? (
        <button style={{ ...S.btn, background: "var(--af-surface-2)", color: "var(--af-text-soft)", border: "1px solid var(--af-border)" }} onClick={onBack}>
          <ArrowLeft size={15} /> Voltar
        </button>
      ) : <div />}
      {onNext && (
        <button
          style={{ ...S.btn, background: nextDisabled ? "var(--af-border)" : "var(--af-primary)", color: nextDisabled ? "var(--af-muted)" : "#000", cursor: nextDisabled ? "not-allowed" : "pointer" }}
          onClick={nextDisabled ? undefined : onNext}
          disabled={nextDisabled}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {nextLabel} {!loading && <ChevronRight size={15} />}
        </button>
      )}
    </div>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-block", background: `${color}18`, border: `1px solid ${color}40`, color, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" as const }}>
      {label}
    </span>
  )
}

// ─── Page principal ──────────────────────────────────────────────────────────

export default function EditorSpedPage() {
  const [etapa,  setEtapa]  = useState(1)
  const [fileA,  setFileA]  = useState<File | null>(null)
  const [fileB,  setFileB]  = useState<File | null>(null)

  const [parsedA, setParsedA] = useState<SpedEditorParsed | null>(null)
  const [parsedB, setParsedB] = useState<SpedEditorParsed | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erroParsing, setErroParsing] = useState<string | null>(null)
  const [alertasImport, setAlertasImport] = useState<string[]>([])

  const [conflitos,  setConflitos]  = useState<ConflitoRegistro[]>([])
  const [resolucoes, setResolucoes] = useState<Record<string, "A" | "B">>({})
  const [produtosEditados, setProdutosEditados] = useState<Record<string, Sped0200Ext>>({})

  const [errosValidacao, setErrosValidacao] = useState<ErroValidacao[]>([])
  const [mesclaFinal, setMesclaFinal]       = useState<ResultadoMescla | null>(null)
  const [txtGerado,   setTxtGerado]         = useState<string | null>(null)
  const [paginaLog, setPaginaLog] = useState(1)
  const [linhasLog, setLinhasLog] = useState(50)

  const logPagina = mesclaFinal ? getPageItems(mesclaFinal.log, paginaLog, linhasLog) : []

  // ── Etapa 1: processar arquivos ─────────────────────────────────────────────

  async function processarArquivos() {
    if (!fileA || !fileB) return
    setCarregando(true)
    setErroParsing(null)
    try {
      const [txtA, txtB] = await Promise.all([lerArquivo(fileA), lerArquivo(fileB)])
      const pA = parseSpedEditor(txtA)
      const pB = parseSpedEditor(txtB)
      setParsedA(pA)
      setParsedB(pB)

      const alerts = validarCnpjPeriodo(pA, pB)
      setAlertasImport(alerts)

      const merged = mesclarSped(pA, pB, {}, {})
      setConflitos(merged.conflitos)

      setEtapa(2)
    } catch (e) {
      setErroParsing(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }

  // ── Etapa 3 → 4/5 ───────────────────────────────────────────────────────────

  function irAposComparacao() {
    if (conflitos.length > 0) setEtapa(4)
    else setEtapa(5)
  }

  // ── Etapa 5 → 6: validação ──────────────────────────────────────────────────

  function executarValidacao() {
    if (!parsedA || !parsedB) return
    const merged = mesclarSped(parsedA, parsedB, resolucoes, produtosEditados)
    const erros  = validarArquivoFinal(merged.registros, parsedA, parsedB)
    setErrosValidacao(erros)
    setMesclaFinal(merged)
    setEtapa(6)
  }

  // ── Etapa 6 → 7: gerar ──────────────────────────────────────────────────────

  function gerarArquivo() {
    if (!parsedA || !parsedB) return
    const merged = mesclaFinal ?? mesclarSped(parsedA, parsedB, resolucoes, produtosEditados)
    setMesclaFinal(merged)
    const txt = gerarSpedTxt(merged.registros)
    setTxtGerado(txt)
    setEtapa(7)
  }

  // ── Downloads ────────────────────────────────────────────────────────────────

  function downloadTxt() {
    if (!txtGerado) return
    const blob = new Blob([txtGerado], { type: "text/plain;charset=utf-8" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = "sped_fiscal_mesclado.txt"; a.click()
    URL.revokeObjectURL(url)
  }

  function exportarLog() {
    if (!mesclaFinal) return
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(mesclaFinal.log.map(l => ({
      "Tipo":      l.tipo,
      "Bloco":     l.bloco,
      "Registro":  l.registro,
      "Descrição": l.descricao,
      "Origem":    l.origem,
      "Timestamp": l.timestamp,
    })))
    XLSX.utils.book_append_sheet(wb, ws, "Log Alterações")
    if (mesclaFinal.warnings.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(mesclaFinal.warnings.map(w => ({ Aviso: w })))
      XLSX.utils.book_append_sheet(wb, ws2, "Avisos")
    }
    XLSX.writeFile(wb, "log_editor_sped.xlsx")
  }

  // ── Reiniciar ────────────────────────────────────────────────────────────────

  function reiniciar() {
    setEtapa(1); setFileA(null); setFileB(null); setParsedA(null); setParsedB(null)
    setErroParsing(null); setAlertasImport([]); setConflitos([]); setResolucoes({})
    setProdutosEditados({}); setErrosValidacao([]); setMesclaFinal(null); setTxtGerado(null)
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const temErroCritico = errosValidacao.some(e => e.nivel === "erro" && e.id !== "OK")

  return (
    <div style={S.page}>
      <div style={S.inner}>

        {/* Header */}
        <PageHeader
          title="Editor SPED Fiscal"
          subtitle="Mescle dois arquivos SPED — base fiscal + Bloco K correto — em 7 etapas."
        />

        <StepBar etapa={etapa} />

        {/* ─── ETAPA 1: Importar ──────────────────────────────────────────────── */}
        {etapa === 1 && (
          <div style={S.card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Etapa 1 — Importar arquivos SPED</h2>
            <p style={{ fontSize: 13, color: "var(--af-muted)", marginBottom: 20 }}>
              Selecione dois arquivos SPED Fiscal (.txt). O arquivo A será a base; o Bloco K virá do arquivo B.
            </p>

            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...S.label, color: "var(--af-primary)" }}>Arquivo A — Base (dados fiscais corretos)</div>
                <DropZone
                  label="SPED Base" sublabel="Com dados fiscais corretos"
                  file={fileA} cor="var(--af-primary)"
                  onSelect={setFileA}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...S.label, color: "#f59e0b" }}>Arquivo B — Fonte do Bloco K</div>
                <DropZone
                  label="SPED Bloco K" sublabel="Com Bloco K correto"
                  file={fileB} cor="#f59e0b"
                  onSelect={setFileB}
                />
              </div>
            </div>

            {erroParsing && <Alert tipo="erro" msgs={[erroParsing]} />}

            <div style={{ background: "rgba(39,199,216,0.06)", border: "1px solid rgba(39,199,216,0.2)", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10, marginBottom: 16 }}>
              <Info size={15} style={{ color: "var(--af-primary)", flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 12, color: "var(--af-muted)", lineHeight: 1.6 }}>
                O sistema irá: usar todos os registros do arquivo A, substituir/adicionar o Bloco K do arquivo B,
                e importar automaticamente os cadastros de produtos (0200), unidades (0190) e fatores de conversão (0220)
                necessários para o Bloco K. Conflitos serão apresentados para resolução manual.
              </p>
            </div>

            <NavButtons
              onNext={processarArquivos}
              nextLabel={carregando ? "Processando…" : "Processar Arquivos"}
              nextDisabled={!fileA || !fileB || carregando}
              loading={carregando}
            />
          </div>
        )}

        {/* ─── ETAPA 2: Validar ───────────────────────────────────────────────── */}
        {etapa === 2 && parsedA && parsedB && (
          <div style={S.card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Etapa 2 — Validar empresa e período</h2>
            <p style={{ fontSize: 13, color: "var(--af-muted)", marginBottom: 20 }}>Confirme que os dois arquivos são da mesma empresa e período.</p>

            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <ResumoCard label="Arquivo A — Base" cor="var(--af-primary)" parsed={parsedA} />
              <ResumoCard label="Arquivo B — Bloco K"  cor="#f59e0b"            parsed={parsedB} />
            </div>

            {alertasImport.length > 0
              ? <Alert tipo="aviso" msgs={alertasImport} />
              : <Alert tipo="ok"   msgs={["CNPJ e período compatíveis — prossiga para a próxima etapa."]} />
            }

            <NavButtons
              onBack={() => setEtapa(1)}
              onNext={() => setEtapa(3)}
              nextLabel="Próximo"
            />
          </div>
        )}

        {/* ─── ETAPA 3: Comparar ──────────────────────────────────────────────── */}
        {etapa === 3 && parsedA && parsedB && (
          <div style={S.card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Etapa 3 — Comparar blocos</h2>
            <p style={{ fontSize: 13, color: "var(--af-muted)", marginBottom: 20 }}>Resumo dos blocos e produtos que serão mesclados.</p>

            {/* Bloco comparison table */}
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--af-text)", marginBottom: 8 }}>Blocos identificados</h3>
            <div style={{ overflowX: "auto", marginBottom: 24 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={S.th}>Bloco</th>
                    <th style={S.th}>No Arquivo A</th>
                    <th style={S.th}>No Arquivo B</th>
                    <th style={S.th}>Linhas A</th>
                    <th style={S.th}>Linhas B</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set([...parsedA.resumo.blocos, ...parsedB.resumo.blocos])).sort().map(bloco => {
                    const linhasA = parsedA.raw.filter(r => r.bloco === bloco).length
                    const linhasB = parsedB.raw.filter(r => r.bloco === bloco).length
                    const emA = parsedA.resumo.blocos.includes(bloco)
                    const emB = parsedB.resumo.blocos.includes(bloco)
                    return (
                      <tr key={bloco}>
                        <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700 }}>{bloco}</td>
                        <td style={S.td}>{emA ? <Chip label="✓ Presente" color="#22c55e" /> : <Chip label="Ausente" color="#ef4444" />}</td>
                        <td style={S.td}>{emB ? <Chip label="✓ Presente" color="#22c55e" /> : <Chip label="Ausente" color="#ef4444" />}</td>
                        <td style={{ ...S.td, fontVariantNumeric: "tabular-nums" }}>{emA ? linhasA.toLocaleString("pt-BR") : "—"}</td>
                        <td style={{ ...S.td, fontVariantNumeric: "tabular-nums" }}>{emB ? linhasB.toLocaleString("pt-BR") : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Produtos do K */}
            {parsedB.resumo.produtosNoK.length > 0 && (
              <>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--af-text)", marginBottom: 8 }}>
                  Produtos referenciados no Bloco K ({parsedB.resumo.produtosNoK.length})
                </h3>
                <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto", marginBottom: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={S.th}>Código</th>
                        <th style={S.th}>Descrição (Arq. B)</th>
                        <th style={S.th}>NCM</th>
                        <th style={S.th}>Em 0200-A</th>
                        <th style={S.th}>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedB.resumo.produtosNoK.map(cod => {
                        const prodB = parsedB.r0200[cod]
                        const emA   = !!parsedA.r0200[cod]
                        const emB   = !!prodB
                        const conf  = conflitos.find(c => c.codigo === cod)
                        let situacao: React.ReactNode = null
                        if (!emB)       situacao = <Chip label="Sem 0200 em B" color="#ef4444" />
                        else if (!emA)  situacao = <Chip label="Será importado" color="#22c55e" />
                        else if (conf)  situacao = <Chip label="Conflito" color="#f59e0b" />
                        else            situacao = <Chip label="OK — já existe em A" color="#6b7280" />
                        return (
                          <tr key={cod}>
                            <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 600 }}>{cod}</td>
                            <td style={S.td}>{prodB?.descr_item || "—"}</td>
                            <td style={{ ...S.td, fontFamily: "monospace" }}>{prodB?.cod_ncm || "—"}</td>
                            <td style={S.td}>{emA ? <Chip label="✓ Sim" color="#22c55e" /> : <Chip label="Não" color="#ef4444" />}</td>
                            <td style={S.td}>{situacao}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {conflitos.length > 0 && (
              <Alert tipo="aviso" msgs={[`${conflitos.length} conflito(s) de cadastro detectado(s) — próximo passo: resolver conflitos.`]} />
            )}
            {!parsedB.resumo.temBlocoK && (
              <Alert tipo="erro" msgs={["O arquivo B não contém o Bloco K. Verifique se o arquivo correto foi selecionado."]} />
            )}

            <NavButtons
              onBack={() => setEtapa(2)}
              onNext={irAposComparacao}
              nextLabel={conflitos.length > 0 ? `Resolver ${conflitos.length} conflito(s)` : "Próximo"}
            />
          </div>
        )}

        {/* ─── ETAPA 4: Conflitos ─────────────────────────────────────────────── */}
        {etapa === 4 && conflitos.length > 0 && (() => {
          const resolvidos    = conflitos.filter(c => !!resolucoes[c.codigo]).length
          const naoResolvidos = conflitos.length - resolvidos
          const todosA        = conflitos.every(c => resolucoes[c.codigo] === "A")
          const todosB        = conflitos.every(c => resolucoes[c.codigo] === "B")

          function selecionarTodos(origem: "A" | "B") {
            setResolucoes(prev => {
              const next = { ...prev }
              conflitos.forEach(c => { next[c.codigo] = origem })
              return next
            })
          }

          function limparTodos() {
            setResolucoes(prev => {
              const next = { ...prev }
              conflitos.forEach(c => { delete next[c.codigo] })
              return next
            })
          }

          return (
            <div style={S.card}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Etapa 4 — Resolver conflitos</h2>
              <p style={{ fontSize: 13, color: "var(--af-muted)", marginBottom: 16 }}>
                Os produtos abaixo existem nos dois arquivos com dados divergentes. Escolha qual versão manter.
              </p>

              {/* ── Barra de ações em massa ─────────────────────────────── */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--af-surface-2)", borderRadius: 12, marginBottom: 16, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginRight: 4 }}>
                  Selecionar tudo:
                </span>
                <button
                  style={{ ...S.btn, fontSize: 12, padding: "6px 14px", background: todosA ? "rgba(39,199,216,0.15)" : "var(--af-surface)", border: `1px solid ${todosA ? "var(--af-primary)" : "var(--af-border)"}`, color: todosA ? "var(--af-primary)" : "var(--af-text-soft)" }}
                  onClick={() => selecionarTodos("A")}
                >
                  Todos → Arquivo A
                </button>
                <button
                  style={{ ...S.btn, fontSize: 12, padding: "6px 14px", background: todosB ? "rgba(245,158,11,0.15)" : "var(--af-surface)", border: `1px solid ${todosB ? "#f59e0b" : "var(--af-border)"}`, color: todosB ? "#f59e0b" : "var(--af-text-soft)" }}
                  onClick={() => selecionarTodos("B")}
                >
                  Todos → Arquivo B
                </button>
                {resolvidos > 0 && (
                  <button
                    style={{ ...S.btn, fontSize: 12, padding: "6px 14px", background: "var(--af-surface)", border: "1px solid var(--af-border)", color: "var(--af-muted)" }}
                    onClick={limparTodos}
                  >
                    Limpar seleções
                  </button>
                )}
                <span style={{ marginLeft: "auto", fontSize: 12, color: resolvidos === conflitos.length ? "#22c55e" : "var(--af-muted)", fontWeight: 600 }}>
                  {resolvidos}/{conflitos.length} resolvido(s)
                </span>
              </div>

              {/* ── Cards por produto ──────────────────────────────────── */}
              {conflitos.map(conf => {
                const res = resolucoes[conf.codigo] ?? null
                return (
                  <div key={conf.codigo} style={{ ...S.card, marginBottom: 10, padding: "12px 16px", borderLeft: `3px solid ${res === "A" ? "var(--af-primary)" : res === "B" ? "#f59e0b" : "var(--af-border)"}` }}>
                    {/* Cabeçalho do card */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" as const }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "var(--af-text)" }}>{conf.codigo}</span>
                      <span style={{ fontSize: 12, color: "var(--af-muted)", flex: 1 }}>{conf.label}</span>
                      <Chip label={`${conf.camposDivergentes.length} campo(s) divergente(s)`} color="#f59e0b" />
                      {res && <Chip label={res === "A" ? "✓ Arquivo A" : "✓ Arquivo B"} color={res === "A" ? "#27c7d8" : "#f59e0b"} />}
                    </div>

                    {/* Tabela de campos divergentes */}
                    <div style={{ overflowX: "auto", marginBottom: 10 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ ...S.th, fontSize: 10 }}>Campo</th>
                            <th style={{ ...S.th, fontSize: 10, background: res === "A" ? "rgba(39,199,216,0.08)" : undefined }}>Arquivo A</th>
                            <th style={{ ...S.th, fontSize: 10, background: res === "B" ? "rgba(245,158,11,0.08)" : undefined }}>Arquivo B</th>
                          </tr>
                        </thead>
                        <tbody>
                          {conf.camposDivergentes.map(campo => (
                            <tr key={campo}>
                              <td style={{ ...S.td, fontWeight: 600, fontSize: 12 }}>{CAMPO_LABEL[campo] ?? campo}</td>
                              <td style={{ ...S.td, fontSize: 12, background: res === "A" ? "rgba(39,199,216,0.06)" : "transparent" }}>{conf.valorA[campo] || <span style={{ color: "var(--af-muted)" }}>—</span>}</td>
                              <td style={{ ...S.td, fontSize: 12, background: res === "B" ? "rgba(245,158,11,0.06)" : "transparent" }}>{conf.valorB[campo] || <span style={{ color: "var(--af-muted)" }}>—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Botões de escolha */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        style={{ ...S.btn, fontSize: 12, padding: "5px 13px", background: res === "A" ? "rgba(39,199,216,0.15)" : "var(--af-surface-2)", border: `1px solid ${res === "A" ? "var(--af-primary)" : "var(--af-border)"}`, color: res === "A" ? "var(--af-primary)" : "var(--af-text-soft)" }}
                        onClick={() => setResolucoes(p => ({ ...p, [conf.codigo]: "A" }))}
                      >
                        {res === "A" ? "✓ " : ""}Manter Arquivo A
                      </button>
                      <button
                        style={{ ...S.btn, fontSize: 12, padding: "5px 13px", background: res === "B" ? "rgba(245,158,11,0.15)" : "var(--af-surface-2)", border: `1px solid ${res === "B" ? "#f59e0b" : "var(--af-border)"}`, color: res === "B" ? "#f59e0b" : "var(--af-text-soft)" }}
                        onClick={() => setResolucoes(p => ({ ...p, [conf.codigo]: "B" }))}
                      >
                        {res === "B" ? "✓ " : ""}Usar Arquivo B
                      </button>
                    </div>
                  </div>
                )
              })}

              {naoResolvidos > 0
                ? <Alert tipo="aviso" msgs={[`${naoResolvidos} conflito(s) sem resolução — será mantida a versão do arquivo A para esses produtos.`]} />
                : <Alert tipo="ok"   msgs={["Todos os conflitos resolvidos."]} />
              }

              <NavButtons
                onBack={() => setEtapa(3)}
                onNext={() => setEtapa(5)}
                nextLabel="Próximo"
              />
            </div>
          )
        })()}

        {/* ─── ETAPA 5: Editar produtos novos ─────────────────────────────────── */}
        {etapa === 5 && parsedA && parsedB && (
          <div style={S.card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Etapa 5 — Editar produtos importados (opcional)</h2>
            <p style={{ fontSize: 13, color: "var(--af-muted)", marginBottom: 20 }}>
              Produtos novos que serão incluídos no 0200 do arquivo final (presentes no Bloco K de B, ausentes em A).
              Edite os campos se necessário.
            </p>

            {(() => {
              const novos = getProdutosNovos(parsedA, parsedB)
              if (novos.length === 0) {
                return <Alert tipo="ok" msgs={["Nenhum produto novo para importar — todos os produtos do Bloco K já existem no arquivo A."]} />
              }
              return (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={S.th}>Código</th>
                        <th style={S.th}>Descrição</th>
                        <th style={S.th}>NCM</th>
                        <th style={S.th}>Unidade</th>
                        <th style={S.th}>Tipo</th>
                        <th style={S.th}>Alíq. ICMS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {novos.map(p => {
                        const editado = produtosEditados[p.cod_item] ?? p
                        return (
                          <tr key={p.cod_item}>
                            <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 600 }}>{p.cod_item}</td>
                            {(["descr_item", "cod_ncm", "unid_inv", "tipo_item", "aliq_icms"] as const).map(campo => (
                              <td key={campo} style={S.td}>
                                <input
                                  type="text"
                                  value={editado[campo] ?? ""}
                                  onChange={e => setProdutosEditados(prev => ({
                                    ...prev,
                                    [p.cod_item]: { ...(prev[p.cod_item] ?? p), [campo]: e.target.value },
                                  }))}
                                  style={{
                                    width: "100%", background: "var(--af-surface-2)", border: "1px solid var(--af-border)",
                                    borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "var(--af-text)",
                                    outline: "none",
                                  }}
                                />
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            <NavButtons
              onBack={() => setEtapa(conflitos.length > 0 ? 4 : 3)}
              onNext={executarValidacao}
              nextLabel="Validar Arquivo Final"
            />
          </div>
        )}

        {/* ─── ETAPA 6: Validação final ────────────────────────────────────────── */}
        {etapa === 6 && (
          <div style={S.card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>Etapa 6 — Verificar arquivo final</h2>
            <p style={{ fontSize: 13, color: "var(--af-muted)", marginBottom: 20 }}>
              Resultado da validação do arquivo mesclado antes da geração.
            </p>

            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 20 }}>
              {errosValidacao.filter(e => e.id !== "OK").map(e => (
                <div key={e.id} style={{
                  display: "flex", gap: 10, padding: "10px 14px", borderRadius: 10,
                  background: e.nivel === "erro" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                  border: `1px solid ${e.nivel === "erro" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                }}>
                  <span style={{ color: e.nivel === "erro" ? "#ef4444" : "#f59e0b", flexShrink: 0, paddingTop: 1 }}>
                    {e.nivel === "erro" ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: e.nivel === "erro" ? "#ef4444" : "#f59e0b", marginBottom: 2 }}>{e.id}</div>
                    <div style={{ fontSize: 13, color: "var(--af-text-soft)" }}>{e.descricao}</div>
                    {e.detalhes && <div style={{ fontSize: 11, color: "var(--af-muted)", marginTop: 2, fontFamily: "monospace" }}>{e.detalhes}</div>}
                  </div>
                </div>
              ))}
              {!temErroCritico && (
                <Alert tipo="ok" msgs={["Nenhum erro crítico encontrado — arquivo pronto para geração."]} />
              )}
            </div>

            {mesclaFinal && (
              <div style={{ background: "var(--af-surface-2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--af-muted)", marginBottom: 8 }}>RESUMO DA MESCLAGEM</div>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const }}>
                  <div><span style={{ fontSize: 12, color: "var(--af-muted)" }}>Registros totais: </span><span style={{ fontWeight: 700, fontSize: 13 }}>{mesclaFinal.registros.length.toLocaleString("pt-BR")}</span></div>
                  <div><span style={{ fontSize: 12, color: "var(--af-muted)" }}>Alterações: </span><span style={{ fontWeight: 700, fontSize: 13 }}>{mesclaFinal.log.length}</span></div>
                  <div><span style={{ fontSize: 12, color: "var(--af-muted)" }}>Avisos: </span><span style={{ fontWeight: 700, fontSize: 13 }}>{mesclaFinal.warnings.length}</span></div>
                </div>
              </div>
            )}

            <NavButtons
              onBack={() => setEtapa(5)}
              onNext={gerarArquivo}
              nextLabel="Gerar SPED Final"
              nextDisabled={temErroCritico}
            />
          </div>
        )}

        {/* ─── ETAPA 7: Gerar ─────────────────────────────────────────────────── */}
        {etapa === 7 && mesclaFinal && txtGerado && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <CheckCircle2 size={28} style={{ color: "#22c55e" }} />
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Etapa 7 — SPED Final Gerado</h2>
                <p style={{ fontSize: 13, color: "var(--af-muted)", margin: 0 }}>Arquivo pronto para download.</p>
              </div>
            </div>

            {/* Download buttons */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" as const }}>
              <button style={{ ...S.btn, background: "var(--af-primary)", color: "#000" }} onClick={downloadTxt}>
                <Download size={15} /> Baixar SPED Final (.txt)
              </button>
              <button style={{ ...S.btn, background: "var(--af-surface-2)", color: "var(--af-text)", border: "1px solid var(--af-border)" }} onClick={exportarLog}>
                <Download size={15} /> Baixar Log de Alterações (.xlsx)
              </button>
              <button style={{ ...S.btn, background: "var(--af-surface-2)", color: "var(--af-text)", border: "1px solid var(--af-border)" }} onClick={reiniciar}>
                <RotateCcw size={15} /> Nova Mesclagem
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" as const }}>
              {[
                { label: "Linhas geradas", value: txtGerado.split("\n").filter(Boolean).length.toLocaleString("pt-BR") },
                { label: "Tamanho estimado", value: fmtKB(new Blob([txtGerado]).size) },
                { label: "Alterações registradas", value: mesclaFinal.log.length.toString() },
                { label: "Avisos", value: mesclaFinal.warnings.length.toString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ ...S.card, padding: "12px 18px", flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--af-primary)" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Log */}
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Log de Alterações</h3>
            <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={S.th}>Tipo</th>
                    <th style={S.th}>Bloco</th>
                    <th style={S.th}>Registro</th>
                    <th style={S.th}>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {logPagina.map((l, i) => (
                    <tr key={i}>
                      <td style={S.td}>
                        <Chip label={l.tipo} color={l.tipo === "inserido" ? "#22c55e" : l.tipo === "substituido" ? "#f59e0b" : "#6b7280"} />
                      </td>
                      <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 600 }}>{l.bloco}</td>
                      <td style={{ ...S.td, fontFamily: "monospace" }}>{l.registro}</td>
                      <td style={S.td}>{l.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              total={mesclaFinal.log.length}
              page={paginaLog}
              pageSize={linhasLog}
              onPageChange={setPaginaLog}
              onPageSizeChange={tamanho => { setLinhasLog(tamanho); setPaginaLog(1) }}
            />

            {mesclaFinal.warnings.length > 0 && (
              <>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 10 }}>Avisos</h3>
                <Alert tipo="aviso" msgs={mesclaFinal.warnings} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
