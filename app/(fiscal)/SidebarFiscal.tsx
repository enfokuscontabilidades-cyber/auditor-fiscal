'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  FileSearch,
  BarChart3,
  Calculator,
  ClipboardList,
  FileText,
  Receipt,
  FilePen,
} from 'lucide-react'

type OrgInfo = { id: string; nome: string; plano: string }

const LINKS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/empresas', label: 'Empresas', icon: Building2 },
  { href: '/auditor_fiscal', label: 'Auditor SPED', icon: FileSearch },
  { href: '/validador_entradas', label: 'Validador NF-e', icon: FileText },
  { href: '/inconsistencias', label: 'Relatórios', icon: BarChart3 },
  { href: '/simples_nacional', label: 'Simples Nacional', icon: Receipt },
  { href: '/editor_sped', label: 'Editor SPED', icon: FilePen },
  { href: '/planejamento', label: 'Planejamento', icon: Calculator },
  { href: '/obrigacoes', label: 'Obrigações', icon: ClipboardList },
]

export default function SidebarFiscal() {
  const pathname = usePathname()
  const [org, setOrg] = useState<OrgInfo | null>(null)

  useEffect(() => {
    fetch('/api/organizacoes')
      .then(r => r.json())
      .then((d: unknown) => { if (d && typeof d === 'object') setOrg(d as OrgInfo) })
      .catch(() => null)
  }, [])

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
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--af-surface-2)', letterSpacing: '-0.01em' }}>
            {org?.nome ?? 'Auditor Fiscal'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(203,213,225,0.64)', marginTop: 2 }}>Análise fiscal e tributária</div>
        </div>
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

    </nav>
  )
}
