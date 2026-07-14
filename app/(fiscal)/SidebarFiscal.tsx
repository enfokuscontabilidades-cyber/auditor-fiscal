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
  Scale,
  Users,
  CreditCard,
  HelpCircle,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import type { ModuloFiscal } from '@/lib/planos/acessoReformaTributaria'

type OrgInfo = { id: string; nome: string; plano: string }

const LINKS: { href: string; label: string; icon: typeof LayoutDashboard; modulo: ModuloFiscal }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, modulo: 'dashboard' },
  { href: '/empresas', label: 'Empresas', icon: Building2, modulo: 'empresas' },
  { href: '/auditor_fiscal', label: 'Auditor SPED', icon: FileSearch, modulo: 'auditor_fiscal' },
  { href: '/editor_sped', label: 'Editor SPED', icon: FilePen, modulo: 'editor_sped' },
  { href: '/validador_entradas', label: 'Validador NF-e', icon: FileText, modulo: 'validador_entradas' },
  { href: '/simples_nacional', label: 'Simples Nacional', icon: Receipt, modulo: 'simples_nacional' },
  { href: '/inconsistencias', label: 'Relatórios', icon: BarChart3, modulo: 'inconsistencias' },
  { href: '/reforma_tributaria', label: 'Reforma Tributária', icon: Scale, modulo: 'reforma_tributaria' },
  { href: '/planejamento', label: 'Planejamento Tributário', icon: Calculator, modulo: 'planejamento' },
  { href: '/obrigacoes', label: 'Obrigações', icon: ClipboardList, modulo: 'obrigacoes' },
  { href: '/assinatura', label: 'Assinatura', icon: CreditCard, modulo: 'assinatura' },
  { href: '/suporte', label: 'Suporte', icon: HelpCircle, modulo: 'suporte' },
]

const LINK_LEADS_ADMIN = { href: '/leads-reforma-tributaria', label: 'Leads Reforma', icon: Users, modulo: 'leads_reforma_tributaria' as ModuloFiscal }
const LINK_ADMIN_RT = { href: '/admin-reforma-tributaria', label: 'Assinaturas RT (admin)', icon: ShieldCheck, modulo: 'leads_reforma_tributaria' as ModuloFiscal }

const FERRAMENTAS_BLOQUEADAS = [
  { label: 'Auditor SPED Fiscal', icon: FileSearch },
  { label: 'Simples Nacional (PGDAS-D)', icon: Receipt },
  { label: 'Planejamento Tributário', icon: Calculator },
]

export default function SidebarFiscal({ allowedModules }: { allowedModules: ModuloFiscal[] | null }) {
  const pathname = usePathname()
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [acessoLeadsAdmin, setAcessoLeadsAdmin] = useState(false)
  const restrito = allowedModules !== null

  useEffect(() => {
    fetch('/api/organizacoes')
      .then(r => r.json())
      .then((d: unknown) => { if (d && typeof d === 'object') setOrg(d as OrgInfo) })
      .catch(() => null)

    if (restrito) return // módulo de leads nunca aparece para acesso restrito

    fetch('/api/leads-reforma-tributaria/acesso')
      .then(r => r.json())
      .then((d: { permitido?: boolean }) => setAcessoLeadsAdmin(Boolean(d.permitido)))
      .catch(() => null)
  }, [restrito])

  const todosLinks = acessoLeadsAdmin ? [...LINKS, LINK_LEADS_ADMIN, LINK_ADMIN_RT] : LINKS
  const links = allowedModules ? todosLinks.filter(l => allowedModules.includes(l.modulo)) : todosLinks

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
          <div style={{ fontSize: 11, color: 'rgba(203,213,225,0.64)', marginTop: 2 }}>
            {restrito ? 'Reforma Tributária' : 'Análise fiscal e tributária'}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 0 10px' }}>
        <div className="af-sidebar-section-title">Navegação</div>

        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={navLinkStyle(active)}>
              <Icon size={17} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          )
        })}

        {restrito && (
          <div style={{ margin: '18px 12px 0', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(203,213,225,0.45)', marginBottom: 8 }}>
              Conheça outras ferramentas
            </div>
            {FERRAMENTAS_BLOQUEADAS.map(({ label, icon: Icon }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 4,
                borderRadius: 8, fontSize: 12, color: 'rgba(203,213,225,0.45)',
              }}>
                <Icon size={14} strokeWidth={2} />
                <span style={{ flex: 1 }}>{label}</span>
                <Lock size={12} />
              </div>
            ))}
            <a
              href="/landing"
              style={{
                display: 'block', textAlign: 'center', marginTop: 8, padding: '8px 10px',
                borderRadius: 8, border: '1px solid rgba(39,199,216,0.3)', color: 'rgba(125,211,252,0.9)',
                fontSize: 11.5, fontWeight: 700, textDecoration: 'none',
              }}
            >
              Conhecer a plataforma completa
            </a>
          </div>
        )}
      </div>
    </nav>
  )
}
