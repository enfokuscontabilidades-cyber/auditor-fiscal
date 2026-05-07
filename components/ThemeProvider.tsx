'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type TemaFiscal = 'claro' | 'escuro'

type ThemeContextValue = {
  tema: TemaFiscal
  alternarTema: () => void
  definirTema: (tema: TemaFiscal) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'af-theme'

function aplicarTema(tema: TemaFiscal) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = tema
  document.documentElement.classList.toggle('dark', tema === 'escuro')
  document.documentElement.style.colorScheme = tema === 'escuro' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<TemaFiscal>('claro')

  useEffect(() => {
    const salvo = window.localStorage.getItem(STORAGE_KEY) as TemaFiscal | null
    const inicial = salvo === 'escuro' || salvo === 'claro' ? salvo : 'claro'
    setTema(inicial)
    aplicarTema(inicial)
  }, [])

  function definirTema(proximoTema: TemaFiscal) {
    setTema(proximoTema)
    window.localStorage.setItem(STORAGE_KEY, proximoTema)
    aplicarTema(proximoTema)
    window.dispatchEvent(new CustomEvent('af-theme-change', { detail: proximoTema }))
  }

  function alternarTema() {
    definirTema(tema === 'escuro' ? 'claro' : 'escuro')
  }

  const value = useMemo(() => ({ tema, alternarTema, definirTema }), [tema])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme precisa ser usado dentro de ThemeProvider')
  }
  return context
}
