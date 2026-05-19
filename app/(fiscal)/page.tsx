import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { TriangleAlert, Building2, FileSearch, AlertOctagon, AlertTriangle, CheckCircle2, ArrowRight, ClipboardList, Calculator } from 'lucide-react'
import EmpresaAtivaBanner from '@/components/EmpresaAtivaBanner'
import CnpjSearchCard from '@/components/CnpjSearchCard'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [alertasRes, empresasRes, sessoesRes] = await Promise.all([
    supabase.from('fa_alertas').select('nivel_risco, status').eq('status', 'aberto'),
    supabase.from('empresas').select('id', { count: 'exact', head: true }),
    supabase
      .from('fa_sessoes_analise')
      .select('id, competencia, created_at, empresa:empresas(razao_social)')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const alertas = alertasRes.data ?? []
  const totalEmpresas = empresasRes.count ?? 0
  const sessoes = sessoesRes.data ?? []

  const por = (nivel: string) => alertas.filter(a => a.nivel_risco === nivel).length
  const totalAbertos = alertas.length

  const S: Record<string, React.CSSProperties> = {
    page: { padding: '30px 36px 56px', fontFamily: 'var(--font-geist-sans)', color: 'var(--af-text)', maxWidth: 1280 },
    hero: { background: 'linear-gradient(135deg,var(--af-surface) 0%,#f8fbff 54%,#eef6ff 100%)', border: '1px solid var(--af-border)', borderRadius: 22, padding: '26px 28px', boxShadow: 'var(--af-shadow-sm)', marginBottom: 18 },
    eyebrow: { fontSize: 11, fontWeight: 800, color: 'var(--af-primary)', letterSpacing: '0.13em', textTransform: 'uppercase' as const, marginBottom: 8 },
    title: { fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: 'var(--af-text)' },
    sub: { margin: '8px 0 0', fontSize: 14, color: 'var(--af-muted)', maxWidth: 720, lineHeight: 1.55 },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, margin: '18px 0 28px' },
    kpiCard: { background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 18, padding: '18px 18px 16px', boxShadow: 'var(--af-shadow-sm)' },
    kpiLabel: { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 },
    kpiValue: { fontSize: 34, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em' },
    kpiSub: { fontSize: 12, color: 'var(--af-muted)', marginTop: 7 },
    sectionCard: { background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 18, boxShadow: 'var(--af-shadow-sm)', overflow: 'hidden' },
    sectionTop: { padding: '17px 20px', borderBottom: '1px solid var(--af-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { margin: 0, fontSize: 15, color: 'var(--af-text)', fontWeight: 800 },
    quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, padding: 16 },
    quick: { display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: '1px solid var(--af-border)', borderRadius: 14, textDecoration: 'none', color: 'var(--af-text)', background: 'var(--af-surface-2)' },
    table: { width: '100%', borderCollapse: 'collapse' as const },
    th: { padding: '12px 18px', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--af-muted)', borderBottom: '1px solid var(--af-border)', textAlign: 'left' as const, background: 'var(--af-surface-2)' },
    td: { padding: '13px 18px', fontSize: 13, color: 'var(--af-text-soft)', borderBottom: '1px solid var(--af-border)' },
  }

  const quickLinks = [
    { href: '/auditor_fiscal', label: 'Auditor SPED', desc: 'Cruzar Fiscal e Contribuições', icon: FileSearch },
    { href: '/validador_entradas', label: 'Validador NF-e', desc: 'Conferir XML, CFOP e NCM', icon: FileSearch },
    { href: '/inconsistencias', label: 'Inconsistências', desc: `${totalAbertos} alerta(s) em aberto`, icon: TriangleAlert },
    { href: '/empresas', label: 'Empresas', desc: 'Cadastro e empresa ativa', icon: Building2 },
    { href: '/obrigacoes', label: 'Obrigações', desc: 'REINF, DCTFWeb e eSocial', icon: ClipboardList },
    { href: '/planejamento', label: 'Planejamento', desc: 'Regimes e reforma tributária', icon: Calculator },
  ]

  return (
    <div style={S.page}>
      <section style={S.hero}>
        <div style={S.eyebrow}>Plataforma Enfokus</div>
        <h1 style={S.title}>Painel de auditoria fiscal</h1>
        <p style={S.sub}>
          Acompanhe empresas, sessões de análise, inconsistências abertas e acessos rápidos para os módulos de SPED, NF-e, obrigações e planejamento tributário.
        </p>
      </section>

      <EmpresaAtivaBanner />

      <div style={S.kpiGrid}>
        <div style={{ ...S.kpiCard, borderTop: '4px solid var(--af-danger)' }}>
          <div style={{ ...S.kpiLabel, color: 'var(--af-danger)' }}><AlertOctagon size={13} /> Alto / Crítico</div>
          <div style={{ ...S.kpiValue, color: 'var(--af-danger)' }}>{por('alto') + por('critico')}</div>
          <div style={S.kpiSub}>alertas em aberto</div>
        </div>
        <div style={{ ...S.kpiCard, borderTop: '4px solid var(--af-warning)' }}>
          <div style={{ ...S.kpiLabel, color: 'var(--af-warning)' }}><AlertTriangle size={13} /> Médio</div>
          <div style={{ ...S.kpiValue, color: 'var(--af-warning)' }}>{por('medio')}</div>
          <div style={S.kpiSub}>alertas em aberto</div>
        </div>
        <div style={{ ...S.kpiCard, borderTop: '4px solid var(--af-success)' }}>
          <div style={{ ...S.kpiLabel, color: 'var(--af-success)' }}><CheckCircle2 size={13} /> Baixo</div>
          <div style={{ ...S.kpiValue, color: 'var(--af-success)' }}>{por('baixo')}</div>
          <div style={S.kpiSub}>alertas em aberto</div>
        </div>
        <div style={{ ...S.kpiCard, borderTop: '4px solid var(--af-primary)' }}>
          <div style={{ ...S.kpiLabel, color: 'var(--af-primary)' }}><Building2 size={13} /> Empresas</div>
          <div style={{ ...S.kpiValue, color: 'var(--af-primary)' }}>{totalEmpresas}</div>
          <div style={S.kpiSub}>cadastradas no sistema</div>
        </div>
      </div>

      <section style={{ ...S.sectionCard, marginBottom: 18 }}>
        <div style={S.sectionTop}>
          <h2 style={S.sectionTitle}>Consulta CNPJ</h2>
          <span style={{ fontSize: 12, color: 'var(--af-muted)' }}>Receita Federal</span>
        </div>
        <div style={{ padding: 16 }}>
          <CnpjSearchCard />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 18 }}>
        <section style={S.sectionCard}>
          <div style={S.sectionTop}>
            <h2 style={S.sectionTitle}>Acesso rápido</h2>
            <span style={{ fontSize: 12, color: 'var(--af-muted)' }}>Módulos principais</span>
          </div>
          <div style={S.quickGrid}>
            {quickLinks.map(({ href, label, desc, icon: Icon }) => (
              <Link key={href} href={href} style={S.quick}>
                <span className="af-icon-box"><Icon size={18} /></span>
                <span style={{ flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: 13 }}>{label}</strong>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--af-muted)', marginTop: 2 }}>{desc}</span>
                </span>
                <ArrowRight size={15} color="var(--af-muted)" />
              </Link>
            ))}
          </div>
        </section>

        <section style={S.sectionCard}>
          <div style={S.sectionTop}>
            <h2 style={S.sectionTitle}>Sessões recentes</h2>
          </div>
          {sessoes.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--af-muted)', fontSize: 13 }}>Nenhuma sessão de análise registrada.</div>
          ) : (
            <table style={S.table}>
              <thead><tr><th style={S.th}>Empresa</th><th style={S.th}>Competência</th></tr></thead>
              <tbody>
                {sessoes.map((s: any) => (
                  <tr key={s.id}>
                    <td style={S.td}>{s.empresa?.razao_social ?? '—'}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-text)' }}>{s.competencia ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
