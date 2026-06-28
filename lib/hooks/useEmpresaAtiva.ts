"use client"

import { useState, useEffect, useCallback } from "react"

const KEY = "enfokus:empresaAtiva"
const EVENT = "enfokus:empresaAtivaChanged"

export type EmpresaAtiva = {
  id: string
  razao_social: string
  cnpj?: string
  cnae_principal?: string
  inscricao_estadual?: string
}

function lerEmpresaAtiva(): EmpresaAtiva | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useEmpresaAtiva() {
  const [empresaAtiva, setEmpresaAtivaState] = useState<EmpresaAtiva | null>(null)

  useEffect(() => {
    setEmpresaAtivaState(lerEmpresaAtiva())

    const sincronizar = () => setEmpresaAtivaState(lerEmpresaAtiva())

    window.addEventListener(EVENT, sincronizar)
    window.addEventListener("storage", sincronizar)

    return () => {
      window.removeEventListener(EVENT, sincronizar)
      window.removeEventListener("storage", sincronizar)
    }
  }, [])

  const definirEmpresaAtiva = useCallback((e: EmpresaAtiva) => {
    localStorage.setItem(KEY, JSON.stringify(e))
    setEmpresaAtivaState(e)
    window.dispatchEvent(new CustomEvent(EVENT, { detail: e }))
  }, [])

  const limparEmpresaAtiva = useCallback(() => {
    localStorage.removeItem(KEY)
    setEmpresaAtivaState(null)
    window.dispatchEvent(new CustomEvent(EVENT, { detail: null }))
  }, [])

  return { empresaAtiva, definirEmpresaAtiva, limparEmpresaAtiva }
}
