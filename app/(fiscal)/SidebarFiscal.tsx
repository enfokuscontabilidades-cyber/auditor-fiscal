'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/ThemeProvider'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import {
  LayoutDashboard,
  Building2,
  FileSearch,
  TriangleAlert,
  Calculator,
  ClipboardList,
  LogOut,
  FileText,
  Moon,
  Sun,
  ChevronDown,
  Search,
  Star,
  Receipt,
  FilePen,
} from 'lucide-react'

type EmpresaItem = { id: string; razao_social: string; cnpj: string | null; cnae_principal?: string | null }

const LINKS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/empresas', label: 'Empresas', icon: Building2 },
  { href: '/auditor_fiscal', label: 'Auditor SPED', icon: FileSearch },
  { href: '/validador_entradas', label: 'Validador NF-e', icon: FileText },
  { href: '/inconsistencias', label: 'Inconsistências', icon: TriangleAlert },
  { href: '/simples_nacional', label: 'Simples Nacional', icon: Receipt },
  { href: '/editor_sped', label: 'Editor SPED', icon: FilePen },
  { href: '/planejamento', label: 'Planejamento', icon: Calculator },
  { href: '/obrigacoes', label: 'Obrigações', icon: ClipboardList },
]

export default function SidebarFiscal() {
  const pathname = usePathname()
  const supabase = createClient()
  const { tema, alternarTema } = useTheme()
  const { empresaAtiva, definirEmpresaAtiva } = useEmpresaAtiva()
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([])
  const [empresaMenuAberto, setEmpresaMenuAberto] = useState(false)
  const [buscaEmpresa, setBuscaEmpresa] = useState('')

  useEffect(() => {
    fetch('/api/empresas')
      .then(r => r.json())
      .then((d: unknown) => { if (Array.isArray(d)) setEmpresas(d as EmpresaItem[]) })
      .catch(() => setEmpresas([]))
  }, [])

  const empresasFiltradas = useMemo(() => {
    const termo = buscaEmpresa.trim().toLowerCase()
    const termoNumerico = termo.replace(/\D/g, '')

    if (!termo) return empresas.slice(0, 8)

    return empresas.filter(emp => {
      const nome = emp.razao_social.toLowerCase()
      const cnpj = (emp.cnpj ?? '').replace(/\D/g, '')
      return nome.includes(termo) || (!!termoNumerico && cnpj.includes(termoNumerico))
    }).slice(0, 12)
  }, [buscaEmpresa, empresas])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function selecionarEmpresaSidebar(emp: EmpresaItem) {
    definirEmpresaAtiva({
      id: emp.id,
      razao_social: emp.razao_social,
      cnpj: emp.cnpj ?? undefined,
      cnae_principal: emp.cnae_principal ?? undefined,
    })
    setEmpresaMenuAberto(false)
    setBuscaEmpresa('')
  }

  function navLinkStyle(active: boolean): React.CSSProperties {
    return {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      margin: '3px 12px',
      padding: '10px 12px',
      color: active ? '#ffffff' : 'rgba(226,232,240,0.78)',
      background: active ? 'linear-gradient(90deg, var(--af-primary), #0891b2)' : 'transparent',
      border: active ? '1px solid rgba(147,197,253,0.35)' : '1px solid transparent',
      borderRadius: 10,
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      textDecoration: 'none',
      transition: 'all 0.15s ease',
      boxShadow: active ? '0 10px 22px rgba(29,78,216,0.24)' : 'none',
    }
  }

  return (
    <nav className="af-sidebar">
      <div className="af-sidebar-header">
        <Link href="/" className="af-logo-box" title="Ir para o Dashboard">
          <img
            src="/logo-enfokus-sidebar.png"
            alt="Enfokus"
            className="af-logo-img"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </Link>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--af-surface-2)', letterSpacing: '-0.01em' }}>Auditor Fiscal</div>
          <div style={{ fontSize: 11, color: 'rgba(203,213,225,0.64)', marginTop: 2 }}>Análise fiscal e tributária</div>
        </div>
      </div>

      <div className="af-sidebar-active-company">
        <button
          type="button"
          className="af-sidebar-active-company-button"
          onClick={() => setEmpresaMenuAberto(v => !v)}
          title="Alterar empresa em análise"
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="af-sidebar-active-company-label">Empresa em análise</div>
            {empresaAtiva ? (
              <>
                <div className="af-sidebar-active-company-name">{empresaAtiva.razao_social}</div>
                {empresaAtiva.cnpj && <div className="af-sidebar-active-company-cnpj">{empresaAtiva.cnpj}</div>}
              </>
            ) : (
              <div className="af-sidebar-active-company-empty">Selecionar empresa</div>
            )}
          </div>
          <ChevronDown size={14} className={empresaMenuAberto ? 'af-sidebar-company-chevron open' : 'af-sidebar-company-chevron'} />
        </button>

        {empresaMenuAberto && (
          <div className="af-sidebar-company-popover">
            <div className="af-sidebar-company-search">
              <Search size={14} />
              <input
                value={buscaEmpresa}
                onChange={(e) => setBuscaEmpresa(e.target.value)}
                placeholder="Buscar nome ou CNPJ..."
                autoFocus
              />
            </div>

            <div className="af-sidebar-company-list">
              {empresasFiltradas.length === 0 ? (
                <div className="af-sidebar-company-empty-list">Nenhuma empresa encontrada.</div>
              ) : empresasFiltradas.map(emp => (
                <button
                  key={emp.id}
                  type="button"
                  className={empresaAtiva?.id === emp.id ? 'af-sidebar-company-option active' : 'af-sidebar-company-option'}
                  onClick={() => selecionarEmpresaSidebar(emp)}
                >
                  {empresaAtiva?.id === emp.id ? <Star size={13} fill="currentColor" /> : <Building2 size={13} />}
                  <span>
                    <strong>{emp.razao_social}</strong>
                    {emp.cnpj && <small>{emp.cnpj}</small>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: '12px 0 10px' }}>
        <div className="af-sidebar-section-title">Navegação</div>

        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={navLinkStyle(active)}>
              <Icon size={17} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          )
        })}
      </div>

      <div className="af-sidebar-footer">
        <button
          type="button"
          className="af-theme-toggle"
          onClick={alternarTema}
          title={tema === 'escuro' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {tema === 'escuro' ? <Sun size={16} /> : <Moon size={16} />}
            {tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}
          </span>
          <span className="af-theme-tag">Global</span>
        </button>

        <button className="af-logout-button" onClick={handleLogout}>
          <LogOut size={16} />
          Sair da conta
        </button>
      </div>
    </nav>
  )
}
