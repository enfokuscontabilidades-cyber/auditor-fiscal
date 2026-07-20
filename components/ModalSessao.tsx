"use client";

import React, { useEffect, useState } from "react";
import { Building2, Calendar, X, Loader2, Plus, ChevronDown, ChevronUp, FileText, AlertTriangle } from "lucide-react";

type Empresa = { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string | null; regime: string | null };

export type DadosSessao = {
  sessaoId: string;
  empresaId: string;
  empresaNome: string;
  competencia: string;
};

export type DadosSessaoLote = {
  empresaId: string;
  empresaNome: string;
  sessoes: Array<{ competencia: string; sessaoId: string }>;
};

export type ArquivoDetectado = {
  nome: string;
  competencia?: string;   // MM/YYYY extraída do arquivo
  qtdNotas?: number;      // para lotes de XML
};

type Props = {
  aberto: boolean;
  cnpjEmpresa?: string;
  nomeEmpresa?: string;
  competenciaArquivo?: string;
  /** Competência atualmente exibida na tela (sessão ativa), para alertar sobre divergência. */
  competenciaAtiva?: string;
  arquivosDetectados?: ArquivoDetectado[];
  // Callback para período único
  onConfirmar: (dados: DadosSessao) => Promise<void>;
  // Callback para múltiplos períodos (quando arquivos têm períodos diferentes)
  onConfirmarLote?: (dados: DadosSessaoLote) => Promise<void>;
  onCancelar: () => void;
};

const REGIMES = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI", "CPF"];

function fmt(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return v;
}

function fmtCnpjInput(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default function ModalSessao({
  aberto, cnpjEmpresa, nomeEmpresa, competenciaArquivo, competenciaAtiva, arquivosDetectados = [],
  onConfirmar, onConfirmarLote, onCancelar,
}: Props) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [competencia, setCompetencia] = useState(competenciaArquivo ?? "");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [cnpjNaoEncontrado, setCnpjNaoEncontrado] = useState(false);

  // Cadastro inline
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [novaRazao, setNovaRazao] = useState(nomeEmpresa ?? "");
  const [novaCnpj, setNovaCnpj] = useState(cnpjEmpresa ? fmt(cnpjEmpresa) : "");
  const [novoRegime, setNovoRegime] = useState("");
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const [erroEmpresa, setErroEmpresa] = useState("");

  // Detecta período predominante entre os arquivos
  const periodosUnicos = Array.from(new Set(
    arquivosDetectados.map(a => a.competencia).filter(Boolean) as string[]
  ));
  const competenciasXml = arquivosDetectados.reduce<Record<string, number>>((acc, a) => {
    if (a.competencia) acc[a.competencia] = (acc[a.competencia] || 0) + (a.qtdNotas ?? 1);
    return acc;
  }, {});
  const periodosMisturados = periodosUnicos.length > 1;

  useEffect(() => {
    if (!aberto) return;
    setErro(""); setSalvando(false); setMostrarCadastro(false);
    setErroEmpresa(""); setSalvandoEmpresa(false);
    setNovaRazao(nomeEmpresa ?? ""); setNovaCnpj(cnpjEmpresa ? fmt(cnpjEmpresa) : "");
    setNovoRegime("");

    // Competência: usa a mais frequente entre os arquivos detectados, ou a passada
    const compAuto = periodosUnicos.length === 1 ? periodosUnicos[0] : competenciaArquivo ?? "";
    setCompetencia(compAuto);

    setCarregando(true);
    fetch("/api/empresas")
      .then(r => r.json())
      .then((lista: unknown) => {
        if (!Array.isArray(lista)) { setErro("Erro ao carregar empresas."); return; }
        setEmpresas(lista as Empresa[]);
        if (cnpjEmpresa) {
          const base = cnpjEmpresa.replace(/\D/g, "");
          const match = (lista as Empresa[]).find(e => (e.cnpj ?? "").replace(/\D/g, "") === base);
          if (match) { setEmpresaId(match.id); setCnpjNaoEncontrado(false); }
          else { setEmpresaId(""); setCnpjNaoEncontrado(true); setMostrarCadastro(true); }
        } else { setEmpresaId(""); setCnpjNaoEncontrado(false); }
      })
      .catch(() => setErro("Erro ao carregar empresas."))
      .finally(() => setCarregando(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  async function salvarNovaEmpresa() {
    if (!novaRazao.trim()) { setErroEmpresa("Informe a razão social."); return; }
    setSalvandoEmpresa(true); setErroEmpresa("");
    try {
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razao_social: novaRazao.trim(), cnpj: novaCnpj.replace(/\D/g, ""), regime: novoRegime || null }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Erro ao cadastrar."); }
      const nova: Empresa = await res.json();
      setEmpresas(prev => [...prev, nova].sort((a, b) => a.razao_social.localeCompare(b.razao_social)));
      setEmpresaId(nova.id);
      setMostrarCadastro(false);
      setCnpjNaoEncontrado(false);
    } catch (e) {
      setErroEmpresa(e instanceof Error ? e.message : "Erro ao cadastrar empresa.");
    } finally {
      setSalvandoEmpresa(false);
    }
  }

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

  async function handleConfirmar() {
    if (!empresaId) { setErro("Selecione ou cadastre uma empresa."); return; }
    setSalvando(true); setErro("");

    const empresaObj = empresas.find(e => e.id === empresaId)!;

    try {
      // Multi-período: cria uma sessão para cada período detectado
      if (periodosMisturados && onConfirmarLote) {
        const sessoes: Array<{ competencia: string; sessaoId: string }> = [];
        for (const comp of periodosUnicos) {
          const sessaoId = await criarOuReutilizarSessao(empresaId, comp);
          sessoes.push({ competencia: comp, sessaoId });
        }
        await onConfirmarLote({ empresaId, empresaNome: empresaObj.razao_social, sessoes });
        return;
      }

      // Período único
      if (!/^\d{2}\/\d{4}$/.test(competencia)) { setErro("Competência inválida. Use MM/YYYY."); setSalvando(false); return; }
      const sessaoId = await criarOuReutilizarSessao(empresaId, competencia);
      await onConfirmar({ sessaoId, empresaId, empresaNome: empresaObj.razao_social, competencia });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  // ── Estilos ──────────────────────────────────────────────────────────────────
  const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(3,17,27,0.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" };
  const box: React.CSSProperties = { background: "var(--af-surface)", border: "1px solid var(--af-border)", borderRadius: 16, padding: "28px 26px", width: 460, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.7)" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--af-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block" };
  const inp: React.CSSProperties = { width: "100%", background: "var(--af-surface-2)", border: "1px solid var(--af-border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--af-text)", outline: "none", boxSizing: "border-box" };
  const inpSm: React.CSSProperties = { ...inp, padding: "7px 10px", fontSize: 12 };
  const btnPrimary: React.CSSProperties = { flex: 1, padding: "10px 0", background: "var(--af-primary-soft)", border: "1px solid rgba(39,199,216,0.3)", borderRadius: 8, color: "var(--af-primary)", fontWeight: 700, fontSize: 13, cursor: salvando ? "not-allowed" : "pointer", opacity: salvando ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };
  const btnSecondary: React.CSSProperties = { ...btnPrimary, background: "none", border: "1px solid var(--af-border)", color: "var(--af-muted)" };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onCancelar(); }}>
      <div style={box}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Vincular ao banco</p>
            <h2 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 700, color: "var(--af-text)" }}>Empresa e Competência</h2>
          </div>
          <button onClick={onCancelar} style={{ background: "none", border: "none", color: "var(--af-muted)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Sumário de arquivos detectados */}
        {arquivosDetectados.length > 0 && (
          <div style={{ background: "var(--af-primary-soft)", border: "1px solid var(--af-primary-soft)", borderRadius: 10, padding: "10px 14px", marginBottom: 18 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Arquivos detectados
            </p>
            {arquivosDetectados.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i < arquivosDetectados.length - 1 ? 5 : 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--af-text-soft)", overflow: "hidden" }}>
                  <FileText size={11} color="var(--af-primary)" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{a.nome}</span>
                </span>
                <span style={{ fontSize: 11, color: "var(--af-muted)", flexShrink: 0, marginLeft: 8 }}>
                  {a.qtdNotas ? `${a.qtdNotas} NF-e` : ""}{a.competencia ? (a.qtdNotas ? " · " : "") + a.competencia : ""}
                </span>
              </div>
            ))}
            {periodosMisturados && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 10, padding: "7px 10px", background: "rgba(255,180,60,0.07)", border: "1px solid rgba(255,180,60,0.2)", borderRadius: 7 }}>
                <AlertTriangle size={12} color="var(--af-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, color: "var(--af-warning)" }}>
                  Períodos misturados detectados:{" "}
                  {Object.entries(competenciasXml).map(([comp, qtd]) => `${comp} (${qtd})`).join(", ")}.
                  Defina a competência da sessão abaixo.
                </span>
              </div>
            )}
          </div>
        )}

        {/* CNPJ identificado no arquivo */}
        {cnpjEmpresa && (
          <div style={{ background: "var(--af-primary-soft)", border: "1px solid var(--af-primary-soft)", borderRadius: 8, padding: "7px 12px", marginBottom: 16, fontSize: 12, color: "var(--af-muted)" }}>
            CNPJ da empresa analisada: <strong style={{ color: "var(--af-primary)" }}>{fmt(cnpjEmpresa)}</strong>
            {cnpjNaoEncontrado && <span style={{ color: "var(--af-warning)", marginLeft: 8 }}>— não cadastrada</span>}
          </div>
        )}

        {/* Seleção de empresa */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}><Building2 size={11} style={{ display: "inline", marginRight: 4 }} />Empresa</label>
          {carregando ? (
            <div style={{ ...inp, color: "var(--af-muted)", display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Carregando...
            </div>
          ) : (
            <select value={empresaId} onChange={e => { setEmpresaId(e.target.value); if (e.target.value) setMostrarCadastro(false); }} style={{ ...inp, cursor: "pointer" }}>
              <option value="">— Selecione —</option>
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.razao_social}{e.cnpj ? ` — ${fmt(e.cnpj)}` : ""}</option>
              ))}
            </select>
          )}

          {/* Botão cadastrar nova empresa */}
          {!carregando && (
            <button
              type="button"
              onClick={() => setMostrarCadastro(v => !v)}
              style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: mostrarCadastro ? "var(--af-primary)" : "var(--af-primary)", padding: 0, fontWeight: 600 }}
            >
              {mostrarCadastro ? <ChevronUp size={13} /> : <Plus size={13} />}
              {mostrarCadastro ? "Cancelar cadastro" : "Cadastrar nova empresa"}
            </button>
          )}
        </div>

        {/* Formulário inline de nova empresa */}
        {mostrarCadastro && (
          <div style={{ background: "rgba(5,18,28,0.6)", border: "1px solid var(--af-border)", borderRadius: 10, padding: "14px 14px 10px", marginBottom: 14 }}>
            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "var(--af-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Nova empresa</p>

            <div style={{ marginBottom: 10 }}>
              <label style={{ ...lbl, marginBottom: 4 }}>Razão Social *</label>
              <input type="text" placeholder="Nome da empresa" value={novaRazao} onChange={e => setNovaRazao(e.target.value)} style={inpSm} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ ...lbl, marginBottom: 4 }}>CNPJ</label>
                <input
                  type="text"
                  placeholder="XX.XXX.XXX/XXXX-XX"
                  maxLength={18}
                  value={novaCnpj}
                  onChange={e => setNovaCnpj(fmtCnpjInput(e.target.value))}
                  style={inpSm}
                />
              </div>
              <div>
                <label style={{ ...lbl, marginBottom: 4 }}>Regime</label>
                <select value={novoRegime} onChange={e => setNovoRegime(e.target.value)} style={{ ...inpSm, cursor: "pointer" }}>
                  <option value="">— opcional —</option>
                  {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {erroEmpresa && (
              <div style={{ fontSize: 11, color: "var(--af-danger)", background: "rgba(255,80,80,0.07)", borderRadius: 6, padding: "5px 10px", marginBottom: 8 }}>
                {erroEmpresa}
              </div>
            )}

            <button
              type="button"
              onClick={salvarNovaEmpresa}
              disabled={salvandoEmpresa}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--af-primary-soft)", border: "1px solid rgba(39,199,216,0.25)", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, color: "var(--af-primary)", cursor: salvandoEmpresa ? "not-allowed" : "pointer", opacity: salvandoEmpresa ? 0.6 : 1 }}
            >
              {salvandoEmpresa ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />Salvando...</> : <><Plus size={12} />Salvar empresa</>}
            </button>
          </div>
        )}

        {/* Competência — modo único ou multi-período */}
        {periodosMisturados && onConfirmarLote ? (
          <div style={{ marginBottom: 22 }}>
            <label style={lbl}><Calendar size={11} style={{ display: "inline", marginRight: 4 }} />Períodos detectados ({periodosUnicos.length})</label>
            <div style={{ background: "rgba(5,18,28,0.6)", border: "1px solid var(--af-border)", borderRadius: 8, overflow: "hidden" }}>
              {periodosUnicos.sort().map((comp, i) => {
                const qtd = arquivosDetectados.filter(a => a.competencia === comp).length;
                return (
                  <div key={comp} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: i < periodosUnicos.length - 1 ? "1px solid var(--af-border)" : "none" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--af-primary)" }}>{comp}</span>
                    <span style={{ fontSize: 11, color: "var(--af-muted)" }}>{qtd} arquivo{qtd !== 1 ? "s" : ""} · será criada 1 sessão</span>
                  </div>
                );
              })}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--af-muted)" }}>
              Será criada uma sessão por período para a empresa selecionada.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 22 }}>
            <label style={lbl}><Calendar size={11} style={{ display: "inline", marginRight: 4 }} />Competência (MM/YYYY)</label>
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
            {periodosUnicos.length > 0 && !periodosMisturados && (
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--af-muted)" }}>
                Detectado automaticamente do arquivo
              </p>
            )}
            {competenciaAtiva && competencia && competencia !== competenciaAtiva && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8, padding: "7px 10px", background: "rgba(255,180,60,0.07)", border: "1px solid rgba(255,180,60,0.2)", borderRadius: 7 }}>
                <AlertTriangle size={12} color="var(--af-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, color: "var(--af-warning)" }}>
                  Você está vendo a competência <strong>{competenciaAtiva}</strong> na tela, mas este arquivo será
                  salvo em <strong>{competencia}</strong> — um período diferente. As notas já importadas de{" "}
                  {competenciaAtiva} não vão desaparecer, mas a tela vai passar a mostrar {competencia} depois de
                  confirmar. Ajuste o campo acima se o período estiver errado.
                </span>
              </div>
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
              : periodosMisturados && onConfirmarLote
                ? `Confirmar ${periodosUnicos.length} períodos`
                : "Confirmar"
            }
          </button>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
