'use client'

import { Calculator, TrendingUp, Scale, BarChart3, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'

const FUNCIONALIDADES = [
  {
    icon: Scale,
    titulo: 'Simulador de regime tributário',
    desc: 'Compare Simples Nacional, Lucro Presumido e Lucro Real com base na receita e estrutura de custos da empresa.',
  },
  {
    icon: TrendingUp,
    titulo: 'Análise de desenquadramento',
    desc: 'Identifique quando uma empresa está próxima do limite de receita do Simples Nacional e simule o impacto da mudança.',
  },
  {
    icon: BarChart3,
    titulo: 'Comparação de carga tributária',
    desc: 'Exiba graficamente a carga estimada de impostos por regime, considerando IRPJ, CSLL, PIS, COFINS e ISS/ICMS.',
  },
  {
    icon: Calculator,
    titulo: 'Impacto da Reforma Tributária',
    desc: 'Simule o efeito da substituição de PIS/COFINS por CBS e ICMS por IBS na carga tributária atual da empresa.',
  },
]

export default function PlanejamentoPage() {
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
        title="Planejamento Tributário"
        subtitle="Simule e compare regimes tributários, analise carga efetiva e prepare-se para a Reforma Tributária."
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
