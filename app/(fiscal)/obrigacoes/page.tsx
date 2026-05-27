'use client'

import { ClipboardList, Calendar, Bell, FileCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'

const FUNCIONALIDADES = [
  {
    icon: Calendar,
    titulo: 'Calendário de obrigações',
    desc: 'Visualize por empresa e período quais obrigações acessórias estão pendentes, entregues ou atrasadas.',
  },
  {
    icon: FileCheck,
    titulo: 'Controle de entregas',
    desc: 'Gerencie a entrega de SPED Fiscal, SPED Contribuições, REINF, DCTFWeb, eSocial, DCTF e ECF.',
  },
  {
    icon: Bell,
    titulo: 'Alertas de prazo',
    desc: 'Receba notificações antecipadas sobre vencimentos próximos para evitar multas por entrega em atraso.',
  },
  {
    icon: ClipboardList,
    titulo: 'Histórico por competência',
    desc: 'Consulte o histórico completo de entregas por empresa e competência para fins de auditoria.',
  },
]

export default function ObrigacoesPage() {
  const S: Record<string, React.CSSProperties> = {
    page: { padding: '36px 40px 64px', fontFamily: 'var(--font-geist-sans)', color: 'var(--af-text)', width: '100%' },
    badge: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--af-warning-soft)', border: '1px solid color-mix(in srgb, var(--af-warning) 30%, transparent)',
      color: 'var(--af-warning)', borderRadius: 20, padding: '4px 12px',
      fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
      marginBottom: 16,
    },
    title: { fontSize: 26, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.03em', color: 'var(--af-text)' },
    sub: { fontSize: 14, color: 'var(--af-muted)', margin: '0 0 36px', maxWidth: 640, lineHeight: 1.6 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 40 },
    card: {
      background: 'var(--af-surface)', border: '1px solid var(--af-border)',
      borderRadius: 16, padding: '22px 22px 20px', boxShadow: 'var(--af-shadow-sm)',
    },
    iconBox: {
      width: 40, height: 40, borderRadius: 12, marginBottom: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--af-primary-soft)', color: 'var(--af-primary)',
      border: '1px solid color-mix(in srgb, var(--af-primary) 20%, transparent)',
    },
    cardTitle: { fontSize: 14, fontWeight: 800, color: 'var(--af-text)', margin: '0 0 8px' },
    cardDesc: { fontSize: 13, color: 'var(--af-muted)', lineHeight: 1.55, margin: 0 },
    backLink: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      color: 'var(--af-primary)', fontSize: 13, fontWeight: 700, textDecoration: 'none',
    },
  }

  return (
    <div style={S.page}>
      <PageHeader
        title="Obrigações Acessórias"
        subtitle="Controle de obrigações, calendário de prazos, histórico de entregas e alertas automáticos."
        badge={{ label: 'Em breve', color: 'var(--af-warning)' }}
      />

      <div style={S.grid}>
        {FUNCIONALIDADES.map(({ icon: Icon, titulo, desc }) => (
          <div key={titulo} style={S.card}>
            <div style={S.iconBox}><Icon size={18} /></div>
            <p style={S.cardTitle}>{titulo}</p>
            <p style={S.cardDesc}>{desc}</p>
          </div>
        ))}
      </div>

      <Link href="/" style={S.backLink}>
        <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} />
        Voltar ao Dashboard
      </Link>
    </div>
  )
}
