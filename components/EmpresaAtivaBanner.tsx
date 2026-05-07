"use client"

import { useEffect, useMemo, useState } from "react"
import { Star, Building2, ChevronDown, Search } from "lucide-react"
import { useEmpresaAtiva } from "@/lib/hooks/useEmpresaAtiva"

type EmpresaItem = { id: string; razao_social: string; cnpj: string | null }

export default function EmpresaAtivaBanner() {
  const { empresaAtiva, definirEmpresaAtiva } = useEmpresaAtiva()
  const [lista, setLista] = useState<EmpresaItem[]>([])
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState("")

  useEffect(() => {
    fetch("/api/empresas")
      .then(r => r.json())
      .then((d: unknown) => { if (Array.isArray(d)) setLista(d as EmpresaItem[]) })
  }, [])

  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const termoNumerico = termo.replace(/\D/g, "")

    if (!termo) return lista

    return lista.filter(emp => {
      const nome = emp.razao_social.toLowerCase()
      const cnpj = (emp.cnpj ?? "").replace(/\D/g, "")
      return nome.includes(termo) || (!!termoNumerico && cnpj.includes(termoNumerico))
    })
  }, [busca, lista])

  function selecionar(emp: EmpresaItem) {
    definirEmpresaAtiva({ id: emp.id, razao_social: emp.razao_social, cnpj: emp.cnpj ?? undefined })
    setAberto(false)
    setBusca("")
  }

  return (
    <div style={{ position: "relative", marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--af-muted)", textTransform: "uppercase", letterSpacing: "0.11em", marginBottom: 8 }}>
        Empresa em análise
      </div>
      <button
        onClick={() => setAberto(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          background: empresaAtiva ? "var(--af-surface)" : "var(--af-surface-2)",
          border: empresaAtiva ? "1px solid var(--af-border)" : "1px dashed var(--af-border)",
          borderLeft: empresaAtiva ? "4px solid var(--af-primary)" : "4px solid var(--af-border)",
          boxShadow: "var(--af-shadow-sm)",
          borderRadius: 14, padding: "13px 16px", cursor: "pointer",
          width: "100%", maxWidth: 620, textAlign: "left",
        }}
      >
        {empresaAtiva ? (
          <>
            <span className="af-icon-box" style={{ width: 34, height: 34, borderRadius: 10 }}>
              <Star size={16} fill="currentColor" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--af-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{empresaAtiva.razao_social}</div>
              {empresaAtiva.cnpj && <div style={{ fontSize: 12, color: "var(--af-muted)", marginTop: 2 }}>{empresaAtiva.cnpj}</div>}
            </div>
          </>
        ) : (
          <>
            <span className="af-icon-box" style={{ width: 34, height: 34, borderRadius: 10 }}>
              <Building2 size={16} />
            </span>
            <span style={{ fontSize: 13, color: "var(--af-muted)", flex: 1 }}>Clique para selecionar a empresa em análise</span>
          </>
        )}
        <ChevronDown size={16} color="var(--af-muted)" style={{ flexShrink: 0, transform: aberto ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {aberto && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 200,
          background: "var(--af-surface)", border: "1px solid var(--af-border)",
          borderRadius: 14, padding: 8, minWidth: 380, maxWidth: 620,
          boxShadow: "0 24px 60px rgba(15,23,42,0.18)", marginTop: 8,
          maxHeight: 360, overflowY: "auto",
        }}>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Search size={15} color="var(--af-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite nome ou CNPJ para buscar..."
              autoFocus
              style={{
                width: "100%",
                background: "var(--af-surface-2)",
                border: "1px solid var(--af-border)",
                borderRadius: 11,
                padding: "10px 12px 10px 36px",
                color: "var(--af-text)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          {lista.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--af-muted)", padding: "12px 14px" }}>
              Nenhuma empresa cadastrada. <a href="/empresas" style={{ color: "var(--af-primary)", fontWeight: 700 }}>Cadastrar →</a>
            </div>
          ) : empresasFiltradas.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--af-muted)", padding: "12px 14px" }}>
              Nenhuma empresa encontrada para a busca informada.
            </div>
          ) : empresasFiltradas.map(emp => (
            <button
              key={emp.id}
              onClick={() => selecionar(emp)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", textAlign: "left",
                padding: "10px 12px", borderRadius: 10,
                background: empresaAtiva?.id === emp.id ? "var(--af-primary-soft)" : "transparent",
                border: "none", cursor: "pointer",
                color: "var(--af-text)", fontSize: 13,
              }}
            >
              {empresaAtiva?.id === emp.id
                ? <Star size={14} fill="var(--af-primary)" color="var(--af-primary)" />
                : <Building2 size={14} color="var(--af-muted)" />
              }
              <div>
                <div style={{ fontWeight: 700 }}>{emp.razao_social}</div>
                {emp.cnpj && <div style={{ fontSize: 12, color: "var(--af-muted)", marginTop: 1 }}>{emp.cnpj}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
