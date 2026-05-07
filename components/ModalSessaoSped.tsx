"use client";

import React, { useEffect, useState } from "react";
import { Calendar, X, Loader2, FileText, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { type DadosSessao, type DadosSessaoLote } from "@/components/ModalSessao";

type Arquivo = {
  nome: string;
  competencia: string;
  tipo: "fiscal" | "contrib";
  subtipo: "matriz" | "filial";
};

type Props = {
  aberto: boolean;
  empresaId: string;
  empresaNome: string;
  arquivos: Arquivo[];
  onConfirmar: (dados: DadosSessao) => Promise<void>;
  onConfirmarLote: (dados: DadosSessaoLote) => Promise<void>;
  onCancelar: () => void;
};

async function criarOuReutilizarSessao(empId: string, comp: string): Promise<string> {
  const listaRes = await fetch(`/api/sessoes?empresa_id=${empId}`);
  const lista = await listaRes.json();
  const existente = Array.isArray(lista)
    ? lista.find((s: { competencia: string }) => s.competencia === comp)
    : null;
  if (existente) return existente.id;
  const r = await fetch("/api/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empresa_id: empId, competencia: comp }),
  });
  if (!r.ok) throw new Error(`Erro ao criar sessão para ${comp}.`);
  return (await r.json()).id;
}

const ARQUIVOS_VISIVEIS = 3;
const PERIODOS_VISIVEIS = 3;

export default function ModalSessaoSped({
  aberto, empresaId, empresaNome, arquivos,
  onConfirmar, onConfirmarLote, onCancelar,
}: Props) {
  const periodosUnicos = Array.from(
    new Set(arquivos.map(a => a.competencia).filter(Boolean))
  ).sort();
  const isMultiPeriodo = periodosUnicos.length > 1;

  const [competencia, setCompetencia] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [expandirArquivos, setExpandirArquivos] = useState(false);
  const [expandirPeriodos, setExpandirPeriodos] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErro("");
    setSalvando(false);
    setExpandirArquivos(false);
    setExpandirPeriodos(false);
    setCompetencia(periodosUnicos.length === 1 ? periodosUnicos[0] : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  async function handleConfirmar() {
    if (!empresaId) { setErro("Nenhuma empresa em análise selecionada."); return; }
    setSalvando(true); setErro("");
    try {
      if (isMultiPeriodo) {
        const sessoes: Array<{ competencia: string; sessaoId: string }> = [];
        for (const comp of periodosUnicos) {
          const sessaoId = await criarOuReutilizarSessao(empresaId, comp);
          sessoes.push({ competencia: comp, sessaoId });
        }
        await onConfirmarLote({ empresaId, empresaNome, sessoes });
        return;
      }
      if (!/^\d{2}\/\d{4}$/.test(competencia)) {
        setErro("Competência inválida. Use MM/YYYY.");
        setSalvando(false);
        return;
      }
      const sessaoId = await criarOuReutilizarSessao(empresaId, competencia);
      await onConfirmar({ sessaoId, empresaId, empresaNome, competencia });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 1000,
    background: "rgba(3,17,27,0.88)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
  };
  const box: React.CSSProperties = {
    background: "var(--af-surface)",
    border: "1px solid var(--af-border)", borderRadius: 16,
    padding: "28px 26px", width: 440, maxWidth: "100%",
    maxHeight: "90vh", overflowY: "auto",
    boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "var(--af-muted)",
    letterSpacing: "0.08em", textTransform: "uppercase" as const,
    marginBottom: 6, display: "block",
  };
  const inp: React.CSSProperties = {
    width: "100%", background: "var(--af-surface-2)",
    border: "1px solid var(--af-border)", borderRadius: 8,
    padding: "9px 12px", fontSize: 13, color: "var(--af-text)",
    outline: "none", boxSizing: "border-box" as const,
  };
  const btnPrimary: React.CSSProperties = {
    flex: 1, padding: "10px 0",
    background: "var(--af-primary-soft)", border: "1px solid rgba(39,199,216,0.3)",
    borderRadius: 8, color: "var(--af-primary)", fontWeight: 700, fontSize: 13,
    cursor: salvando ? "not-allowed" : "pointer", opacity: salvando ? 0.6 : 1,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  };
  const btnSecondary: React.CSSProperties = {
    ...btnPrimary, background: "none",
    border: "1px solid var(--af-border)", color: "var(--af-muted)",
  };

  const arquivosVisiveis = expandirArquivos ? arquivos : arquivos.slice(0, ARQUIVOS_VISIVEIS);
  const periodosVisiveis = expandirPeriodos ? periodosUnicos : periodosUnicos.slice(0, PERIODOS_VISIVEIS);

  function tipoBadge(a: Arquivo) {
    if (a.tipo === "contrib") return { label: "Contrib", color: "var(--af-success)" };
    return { label: a.subtipo === "matriz" ? "Fiscal M" : "Fiscal F", color: "var(--af-primary)" };
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancelar(); }}>
      <div style={box}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Vincular ao banco</p>
            <h2 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 700, color: "var(--af-text)" }}>Confirmar importação</h2>
          </div>
          <button onClick={onCancelar} style={{ background: "none", border: "none", color: "var(--af-muted)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Empresa (read-only) */}
        <div style={{ background: "var(--af-primary-soft)", border: "1px solid var(--af-primary-soft)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle2 size={15} color="var(--af-primary)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 10, color: "var(--af-muted)", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Empresa em análise</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--af-text)", marginTop: 2 }}>{empresaNome}</div>
          </div>
        </div>

        {/* Arquivos */}
        <div style={{ marginBottom: 18 }}>
          <div style={lbl}>{arquivos.length} arquivo{arquivos.length > 1 ? "s" : ""} para importar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {arquivosVisiveis.map((a, i) => {
              const badge = tipoBadge(a);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--af-surface-2)", borderRadius: 8, border: "1px solid var(--af-border)" }}>
                  <FileText size={12} color="var(--af-muted)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, flexShrink: 0 }}>{badge.label}</span>
                  <span style={{ fontSize: 12, color: "var(--af-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{a.nome}</span>
                  {a.competencia && (
                    <span style={{ fontSize: 11, color: "var(--af-muted)", flexShrink: 0 }}>{a.competencia}</span>
                  )}
                </div>
              );
            })}
          </div>
          {arquivos.length > ARQUIVOS_VISIVEIS && (
            <button
              onClick={() => setExpandirArquivos(v => !v)}
              style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--af-muted)", padding: 0, fontWeight: 600 }}
            >
              {expandirArquivos ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expandirArquivos
                ? "Ver menos"
                : `Ver mais ${arquivos.length - ARQUIVOS_VISIVEIS} arquivo${arquivos.length - ARQUIVOS_VISIVEIS > 1 ? "s" : ""}`}
            </button>
          )}
        </div>

        {/* Competência */}
        {isMultiPeriodo ? (
          <div style={{ marginBottom: 22 }}>
            <label style={lbl}>
              <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />
              {periodosUnicos.length} período{periodosUnicos.length > 1 ? "s" : ""} detectado{periodosUnicos.length > 1 ? "s" : ""}
            </label>
            <div style={{ background: "var(--af-surface-2)", border: "1px solid var(--af-border)", borderRadius: 8, overflow: "hidden" }}>
              {periodosVisiveis.map((comp, i) => {
                const qtd = arquivos.filter(a => a.competencia === comp).length;
                return (
                  <div key={comp} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: i < periodosVisiveis.length - 1 ? "1px solid var(--af-border)" : "none" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--af-primary)" }}>{comp}</span>
                    <span style={{ fontSize: 11, color: "var(--af-muted)" }}>
                      {qtd} arquivo{qtd !== 1 ? "s" : ""} · 1 sessão
                    </span>
                  </div>
                );
              })}
            </div>
            {periodosUnicos.length > PERIODOS_VISIVEIS && (
              <button
                onClick={() => setExpandirPeriodos(v => !v)}
                style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--af-muted)", padding: 0, fontWeight: 600 }}
              >
                {expandirPeriodos ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expandirPeriodos
                  ? "Ver menos"
                  : `Ver mais ${periodosUnicos.length - PERIODOS_VISIVEIS} período${periodosUnicos.length - PERIODOS_VISIVEIS > 1 ? "s" : ""}`}
              </button>
            )}
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--af-muted)" }}>
              Será criada uma sessão por período para {empresaNome}.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 22 }}>
            <label style={lbl}>
              <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />
              Competência (MM/YYYY)
            </label>
            <input
              type="text"
              placeholder="04/2026"
              maxLength={7}
              value={competencia}
              onChange={e => {
                let v = e.target.value.replace(/[^\d/]/g, "");
                if (v.length === 2 && !v.includes("/") && competencia.length < 2) v = v + "/";
                setCompetencia(v);
              }}
              style={inp}
            />
            {periodosUnicos.length === 1 && (
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--af-muted)" }}>
                Detectado automaticamente do arquivo
              </p>
            )}
          </div>
        )}

        {erro && (
          <div style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "var(--af-danger)" }}>
            {erro}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button style={btnSecondary} onClick={onCancelar}>Cancelar</button>
          <button style={btnPrimary} onClick={handleConfirmar} disabled={salvando}>
            {salvando
              ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Salvando...</>
              : isMultiPeriodo
                ? `Confirmar ${periodosUnicos.length} período${periodosUnicos.length > 1 ? "s" : ""}`
                : "Confirmar"
            }
          </button>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
