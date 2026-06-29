'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO — edite aqui para ativar o botão de contato
// ─────────────────────────────────────────────────────────────────────────────
// Insira a URL completa do WhatsApp (ex: https://wa.me/5511999999999?text=...)
// ou de um formulário externo. Enquanto estiver vazia, um modal informativo é exibido.
const WHATSAPP_URL = 'https://w.app/mt3qnk'
// ─────────────────────────────────────────────────────────────────────────────

const V: Record<string, React.CSSProperties> = {
  // base
  root: { margin: 0, padding: 0, boxSizing: 'border-box' },
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(1000px 600px at 80% -10%, #17395b 0%, transparent 60%), #061323',
    color: '#f7fbff',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    lineHeight: '1.5',
  },
  wrap: { width: 'min(1180px, calc(100% - 40px))', margin: '0 auto' },

  // header
  nav: {
    height: 72,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(169,189,213,0.14)',
  },
  navLinks: {
    display: 'flex',
    gap: 22,
    alignItems: 'center',
    color: '#a9bdd5',
    fontSize: 14,
  },

  // buttons
  btnPrimary: {
    border: '1px solid transparent',
    borderRadius: 10,
    padding: '13px 18px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    background: '#2dc7ef',
    color: '#02111f',
    textDecoration: 'none',
    transition: '0.2s',
  },
  btnSecondary: {
    border: '1px solid #315779',
    borderRadius: 10,
    padding: '13px 18px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    background: '#10233d',
    color: '#f7fbff',
    textDecoration: 'none',
    transition: '0.2s',
  },

  // hero
  hero: {
    padding: '28px 0 20px',
    display: 'grid',
    gridTemplateColumns: '1.03fr 0.97fr',
    gap: 28,
    alignItems: 'center',
  },
  eyebrow: {
    display: 'inline-flex',
    color: '#8ee8ff',
    border: '1px solid rgba(45,199,239,0.38)',
    background: 'rgba(45,199,239,0.08)',
    padding: '7px 10px',
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },
  h1: {
    fontSize: 'clamp(36px, 4.7vw, 60px)',
    lineHeight: 1.03,
    margin: '12px 0 13px',
    letterSpacing: '-0.045em',
  },
  heroText: { fontSize: 17, color: '#a9bdd5', maxWidth: 600, margin: '0 0 18px' },
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap' as const },
  proof: { fontSize: 13, color: '#90a9c5', marginTop: 12 },
  screen: {
    borderRadius: 20,
    border: '1px solid #2b4a6a',
    background: '#10223a',
    padding: 0,
    boxShadow: '0 28px 80px rgba(0,0,0,0.32)',
    overflow: 'hidden',
  },

  // metrics
  numbers: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 14,
    padding: '14px 0 52px',
  },
  metric: {
    border: '1px solid #294463',
    background: 'linear-gradient(145deg, rgba(20,42,70,0.9), rgba(10,25,44,0.9))',
    borderRadius: 16,
    padding: 19,
  },

  // sections
  section: { padding: '74px 0' },
  sectionAlt: {
    padding: '74px 0',
    background: 'linear-gradient(180deg, rgba(18,39,65,0.62), rgba(6,19,35,0.3))',
    borderTop: '1px solid rgba(169,189,213,0.12)',
    borderBottom: '1px solid rgba(169,189,213,0.12)',
  },
  heading: { maxWidth: 760, marginBottom: 32 },
  h2: { fontSize: 36, lineHeight: 1.12, margin: '0 0 12px', letterSpacing: '-0.03em' },
  lead: { color: '#a9bdd5', margin: 0, fontSize: 17 },

  // cards
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 },
  card: {
    background: 'rgba(15,32,54,0.92)',
    border: '1px solid #294463',
    borderRadius: 16,
    padding: 24,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: 'rgba(45,199,239,0.12)',
    border: '1px solid rgba(45,199,239,0.35)',
    color: '#2dc7ef',
    display: 'grid',
    placeItems: 'center' as const,
    fontWeight: 900,
    marginBottom: 17,
    fontSize: 14,
  },
  cardTitle: { margin: '0 0 8px', fontSize: 18 },
  cardDesc: { margin: 0, color: '#a9bdd5', fontSize: 15 },

  // feature blocks
  feature: {
    display: 'grid',
    gridTemplateColumns: '0.92fr 1.08fr',
    gap: 36,
    alignItems: 'center',
    marginBottom: 66,
  },
  featureEven: {
    display: 'grid',
    gridTemplateColumns: '1.08fr 0.92fr',
    gap: 36,
    alignItems: 'center',
    marginBottom: 66,
  },
  featureH3: { fontSize: 28, lineHeight: 1.15, margin: '10px 0 12px', letterSpacing: '-0.025em' },
  featureP: { color: '#a9bdd5', fontSize: 16 },
  bullets: { display: 'grid', gap: 10, marginTop: 20 },
  shot: {
    borderRadius: 17,
    padding: 6,
    background: '#11243e',
    border: '1px solid #294463',
    overflow: 'hidden',
  },

  // audit panel
  auditPanel: { display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 20 },
  auditCopy: {
    border: '1px solid #294463',
    borderRadius: 18,
    padding: 28,
    background: 'linear-gradient(145deg, rgba(18,43,70,0.9), rgba(10,25,44,0.9))',
  },
  auditH3: { fontSize: 28, lineHeight: 1.14, margin: '10px 0 12px', letterSpacing: '-0.025em' },
  ruleList: { display: 'grid', gap: 10, marginTop: 20 },
  rule: {
    padding: '12px 14px',
    border: '1px solid rgba(41,68,99,0.9)',
    background: 'rgba(6,19,35,0.45)',
    borderRadius: 12,
    fontSize: 14,
    color: '#dce8f4',
  },
  callout: {
    border: '1px solid rgba(66,226,141,0.42)',
    borderRadius: 18,
    background: 'rgba(66,226,141,0.06)',
    padding: 26,
  },
  calloutH3: { margin: '0 0 10px', fontSize: 22 },
  calloutP: { margin: 0, color: '#a9bdd5' },

  // capabilities list
  capGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 },
  capCard: {
    background: 'rgba(15,32,54,0.92)',
    border: '1px solid #294463',
    borderRadius: 16,
    padding: '22px 24px',
  },
  capTitle: { fontSize: 16, fontWeight: 800, color: '#8ee8ff', marginBottom: 12, marginTop: 0 },
  capItem: { fontSize: 14, color: '#d9e6f4', marginBottom: 7, paddingLeft: 20, position: 'relative' as const },

  // screenshots
  screenshotsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 32 },
  screenshotCard: {
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid #294463',
    background: '#0d1e34',
  },
  screenshotLabel: { padding: '10px 14px', fontSize: 13, color: '#a9bdd5', background: '#0d1e34' },

  // roadmap
  roadmapGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  road: {
    borderRadius: 16,
    padding: 24,
    border: '1px solid #294463',
    background: '#0d1e34',
  },
  statusReady: {
    display: 'inline-flex',
    borderRadius: 99,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    marginBottom: 14,
    background: 'rgba(66,226,141,0.12)',
    color: '#66eda3',
    border: '1px solid rgba(66,226,141,0.35)',
  },
  statusValidating: {
    display: 'inline-flex',
    borderRadius: 99,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    marginBottom: 14,
    background: 'rgba(45,199,239,0.11)',
    color: '#74def7',
    border: '1px solid rgba(45,199,239,0.35)',
  },
  statusBuilding: {
    display: 'inline-flex',
    borderRadius: 99,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    marginBottom: 14,
    background: 'rgba(214,178,92,0.11)',
    color: '#e4c877',
    border: '1px solid rgba(214,178,92,0.35)',
  },
  statusPlanned: {
    display: 'inline-flex',
    borderRadius: 99,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    marginBottom: 14,
    background: 'rgba(148,163,184,0.1)',
    color: '#94a3b8',
    border: '1px solid rgba(148,163,184,0.3)',
  },
  roadH3: { margin: '0 0 8px', fontSize: 18 },
  roadP: { color: '#a9bdd5', margin: 0, fontSize: 15 },

  // CTA beta
  betaSection: { padding: '74px 0' },
  betaBox: {
    border: '1px solid rgba(45,199,239,0.5)',
    borderRadius: 24,
    background: 'linear-gradient(130deg, #123558, #0d1f36 60%, #102843)',
    padding: 42,
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    gap: 32,
    boxShadow: '0 22px 70px rgba(0,0,0,0.25)',
  },
  betaH2: { fontSize: 34, lineHeight: 1.12, margin: '10px 0' },
  betaP: { color: '#c7d9eb', maxWidth: 700, margin: 0, fontSize: 16 },

  // founder
  founderSection: { padding: '0 0 74px' },
  founderBox: {
    border: '1px solid rgba(214,178,92,0.35)',
    borderRadius: 24,
    background: 'linear-gradient(130deg, rgba(25,20,8,0.9), rgba(13,19,35,0.9))',
    padding: 42,
  },
  founderEyebrow: {
    display: 'inline-flex',
    color: '#e4c877',
    border: '1px solid rgba(214,178,92,0.38)',
    background: 'rgba(214,178,92,0.08)',
    padding: '7px 10px',
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },
  founderH2: { fontSize: 28, lineHeight: 1.14, margin: '10px 0 12px', letterSpacing: '-0.025em' },
  founderP: { color: '#c7d9eb', margin: 0, fontSize: 16, maxWidth: 720 },

  // footer
  footer: {
    padding: '30px 0',
    borderTop: '1px solid rgba(169,189,213,0.14)',
    color: '#849bb7',
    fontSize: 13,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 18,
    flexWrap: 'wrap' as const,
  },

  // modal
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 24,
  },
  modalBox: {
    background: '#0f2036',
    border: '1px solid rgba(45,199,239,0.35)',
    borderRadius: 18,
    padding: '36px 40px',
    maxWidth: 460,
    width: '100%',
    textAlign: 'center' as const,
  },
  modalTitle: { fontSize: 20, fontWeight: 800, margin: '0 0 14px', color: '#f7fbff' },
  modalText: { fontSize: 15, color: '#a9bdd5', margin: '0 0 24px', lineHeight: 1.6 },
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={V.capItem}>
      <span style={{ position: 'absolute', left: 0, color: '#42e28d', fontWeight: 900 }}>✓</span>
      {children}
    </div>
  )
}

function FeatureBullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#d9e6f4', fontSize: 15 }}>
      <span style={{ color: '#42e28d', fontWeight: 900, marginRight: 10 }}>✓</span>
      {children}
    </div>
  )
}

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false)

  function handleCta(e: React.MouseEvent) {
    if (!WHATSAPP_URL) {
      e.preventDefault()
      setModalOpen(true)
    }
  }

  const ctaProps = WHATSAPP_URL
    ? { href: WHATSAPP_URL, target: '_blank' as const, rel: 'noopener noreferrer' }
    : { href: '#', onClick: handleCta }

  return (
    <>
      <div style={V.page}>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header>
          <div style={V.wrap}>
            <nav style={V.nav}>
              <a href="#top" style={{ textDecoration: 'none' }}>
                <img src="/logo-enfokus-white.png" alt="Enfokus" style={{ height: 34, width: 'auto', display: 'block' }} />
              </a>
              <div className="lp-navlinks" style={V.navLinks}>
                <a href="#recursos" style={{ textDecoration: 'none', color: 'inherit' }}>Recursos</a>
                <a href="#auditoria" style={{ textDecoration: 'none', color: 'inherit' }}>Auditoria SPED</a>
                <a href="#screenshots" style={{ textDecoration: 'none', color: 'inherit' }}>Telas</a>
                <a href="#roadmap" style={{ textDecoration: 'none', color: 'inherit' }}>Roadmap</a>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Link href="/login" style={{ ...V.btnSecondary, padding: '10px 16px', fontSize: 13 }}>Entrar</Link>
                <a {...ctaProps} style={V.btnPrimary}>Solicitar acesso</a>
              </div>
            </nav>
          </div>
        </header>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <main id="top">
          <div style={V.wrap}>
            <div className="lp-hero" style={V.hero}>
              <div>
                <span style={V.eyebrow}>Beta fechado — apenas 10 escritórios parceiros</span>
                <h1 style={V.h1}>
                  Auditoria fiscal que transforma arquivos em{' '}
                  <em style={{ color: '#2dc7ef', fontStyle: 'normal' }}>decisão e ação.</em>
                </h1>
                <p style={V.heroText}>
                  Centralize SPED Fiscal, SPED Contribuições, XMLs de NF-e e PGDAS-D. O Enfokus organiza a base,
                  cruza informações e destaca divergências para que seu time investigue o que realmente importa.
                </p>
                <div style={V.actions}>
                  <a {...ctaProps} style={V.btnPrimary}>Quero uma das 10 vagas</a>
                  <a href="#auditoria" style={V.btnSecondary}>Ver o que a plataforma analisa</a>
                </div>
                <p style={V.proof}>
                  <strong style={{ color: '#42e28d' }}>10 escritórios parceiros.</strong>{' '}
                  Acesso inicial sem custo em troca de testes e feedbacks reais.
                </p>
              </div>
              <div style={V.screen}>
                <img
                  src="/landing/hero-enfokus.png"
                  alt="Visão geral do painel fiscal da plataforma Enfokus"
                  style={{ width: '100%', borderRadius: 18, display: 'block' }}
                />
              </div>
            </div>
          </div>

          {/* ── MÉTRICAS RÁPIDAS ───────────────────────────────────────────── */}
          <div style={V.wrap}>
            <div className="lp-numbers" style={V.numbers}>
              <div style={V.metric}>
                <strong style={{ fontSize: 22, color: '#2dc7ef', display: 'block', lineHeight: 1.12 }}>Uma base fiscal</strong>
                <span style={{ fontSize: 14, color: '#a9bdd5', display: 'block', marginTop: 6 }}>
                  Importe uma vez e reutilize os dados em relatórios, conferências e apurações.
                </span>
              </div>
              <div style={V.metric}>
                <strong style={{ fontSize: 22, color: '#2dc7ef', display: 'block', lineHeight: 1.12 }}>SPED + XML + PGDAS-D</strong>
                <span style={{ fontSize: 14, color: '#a9bdd5', display: 'block', marginTop: 6 }}>
                  Fontes reunidas para enxergar documentos, tributos, receita e divergências no mesmo fluxo.
                </span>
              </div>
              <div style={V.metric}>
                <strong style={{ fontSize: 22, color: '#2dc7ef', display: 'block', lineHeight: 1.12 }}>Multiempresa</strong>
                <span style={{ fontSize: 14, color: '#a9bdd5', display: 'block', marginTop: 6 }}>
                  Estrutura pensada para escritórios que precisam acompanhar várias empresas com segurança.
                </span>
              </div>
            </div>
          </div>

          {/* ── SEÇÃO RECURSOS / BASE FISCAL ─────────────────────────────── */}
          <section style={V.sectionAlt} id="recursos">
            <div style={V.wrap}>
              <div style={V.heading}>
                <h2 style={V.h2}>O fiscal deixa de ser uma sequência de arquivos isolados.</h2>
                <p style={V.lead}>
                  Você não precisa abrir planilha após planilha para localizar uma inconsistência. A plataforma conecta
                  informações importadas em uma base operacional para conferência, análise e priorização.
                </p>
              </div>
              <div className="lp-grid3" style={V.grid3}>
                <article style={V.card}>
                  <div style={V.iconBox}>01</div>
                  <h3 style={V.cardTitle}>Importe com controle</h3>
                  <p style={V.cardDesc}>
                    Envie XMLs diretos ou em ZIP, além de SPED Fiscal e Contribuições. A importação valida a empresa
                    ativa para evitar mistura de dados entre clientes.
                  </p>
                </article>
                <article style={V.card}>
                  <div style={V.iconBox}>02</div>
                  <h3 style={V.cardTitle}>Cruze fontes fiscais</h3>
                  <p style={V.cardDesc}>
                    Compare documentos e apurações entre SPED Fiscal e Contribuições, confronte receita XML com
                    PGDAS-D e encontre diferenças antes que se tornem problema.
                  </p>
                </article>
                <article style={V.card}>
                  <div style={V.iconBox}>03</div>
                  <h3 style={V.cardTitle}>Priorize a atuação</h3>
                  <p style={V.cardDesc}>
                    Transforme regras técnicas em alertas, relatórios e exportações para orientar a revisão da equipe
                    e a conversa com o cliente.
                  </p>
                </article>
              </div>
            </div>
          </section>

          {/* ── AUDITOR SPED ─────────────────────────────────────────────── */}
          <section style={V.section} id="auditoria">
            <div style={V.wrap}>
              <div style={V.heading}>
                <h2 style={V.h2}>Auditor SPED: encontre conflitos que normalmente ficam espalhados entre arquivos.</h2>
                <p style={V.lead}>
                  O núcleo de auditoria cruza SPED Fiscal e SPED Contribuições, interpreta registros relevantes e reúne
                  pontos de revisão em uma mesma tela.
                </p>
              </div>
              <div className="lp-audit-panel" style={V.auditPanel}>
                <div style={V.auditCopy}>
                  <span style={V.eyebrow}>Já disponível no núcleo fiscal</span>
                  <h3 style={V.auditH3}>Do arquivo bruto à análise técnica em poucos passos.</h3>
                  <p style={{ color: '#a9bdd5', margin: 0 }}>
                    Importe múltiplos arquivos, execute a análise automática e exporte a documentação da revisão.
                    A plataforma trabalha com documentos, itens C170, CFOP, apurações de ICMS, PIS e COFINS.
                  </p>
                  <div style={V.ruleList}>
                    <div style={V.rule}>
                      <strong style={{ color: '#8ee8ff' }}>Notas ausentes entre os SPEDs</strong><br />
                      <small style={{ color: '#a9bdd5' }}>Identifique notas presentes no Fiscal que não aparecem no Contribuições e o caminho inverso.</small>
                    </div>
                    <div style={V.rule}>
                      <strong style={{ color: '#8ee8ff' }}>CFOP invertido (entrada em saída, saída em entrada)</strong><br />
                      <small style={{ color: '#a9bdd5' }}>Detecção automática de CFOPs classificados na natureza errada de operação.</small>
                    </div>
                    <div style={V.rule}>
                      <strong style={{ color: '#8ee8ff' }}>Divergências de base e classificação</strong><br />
                      <small style={{ color: '#a9bdd5' }}>Alertas para ICMS, PIS/COFINS, CST incompatível, alíquota efetiva atípica e ST sem tratamento.</small>
                    </div>
                    <div style={V.rule}>
                      <strong style={{ color: '#8ee8ff' }}>Possível crédito indevido em uso e consumo</strong><br />
                      <small style={{ color: '#a9bdd5' }}>Identificação de ICMS com crédito em itens classificados como uso e consumo ou imobilizado sem CIAP.</small>
                    </div>
                    <div style={V.rule}>
                      <strong style={{ color: '#8ee8ff' }}>Validação analítica de itens C170</strong><br />
                      <small style={{ color: '#a9bdd5' }}>Leitura por NCM, CFOP, CST, crédito, destinação e substituição tributária.</small>
                    </div>
                  </div>
                </div>
                <aside style={V.callout}>
                  <h3 style={V.calloutH3}>O que sua equipe ganha na prática</h3>
                  <p style={V.calloutP}>Mais contexto para decidir onde começar a revisão e menos dependência de conferências manuais desconectadas.</p>
                  <ul style={{ paddingLeft: 18, color: '#d9e6f4', margin: '16px 0 0' }}>
                    <li style={{ marginBottom: 9 }}>Exportação Excel com cruzamento, apuração, inconsistências e itens analisados.</li>
                    <li style={{ marginBottom: 9 }}>Alertas classificados por nível de risco para apoiar a priorização.</li>
                    <li style={{ marginBottom: 9 }}>Central de inconsistências com filtros por empresa e competência.</li>
                    <li style={{ marginBottom: 9 }}>Estrutura de regras que evolui com as dores dos escritórios parceiros.</li>
                  </ul>
                </aside>
              </div>
            </div>
          </section>

          {/* ── O QUE A PLATAFORMA JÁ FAZ ───────────────────────────────── */}
          <section style={V.sectionAlt}>
            <div style={V.wrap}>
              <div style={V.heading}>
                <h2 style={V.h2}>O que a plataforma já faz.</h2>
                <p style={V.lead}>
                  Funcionalidades disponíveis ou em validação ativa com os primeiros escritórios parceiros.
                </p>
              </div>
              <div className="lp-cap-grid" style={V.capGrid}>

                <div style={V.capCard}>
                  <p style={V.capTitle}>Auditoria e cruzamentos fiscais</p>
                  <BulletItem>Importação e análise de SPED Fiscal</BulletItem>
                  <BulletItem>Importação e análise de SPED Contribuições</BulletItem>
                  <BulletItem>Cruzamento entre SPED Fiscal e SPED Contribuições</BulletItem>
                  <BulletItem>Notas presentes em um arquivo e ausentes no outro</BulletItem>
                  <BulletItem>Detecção de CFOP invertido</BulletItem>
                  <BulletItem>Alertas de possíveis inconsistências entre ICMS, PIS e COFINS</BulletItem>
                  <BulletItem>Análise de apuração de ICMS</BulletItem>
                  <BulletItem>Análise de PIS e COFINS</BulletItem>
                  <BulletItem>Validação analítica de itens C170</BulletItem>
                </div>

                <div style={V.capCard}>
                  <p style={V.capTitle}>Regras e alertas tributários</p>
                  <BulletItem>Possível crédito indevido em uso e consumo</BulletItem>
                  <BulletItem>Imobilizado com crédito e possível ausência de CIAP</BulletItem>
                  <BulletItem>CFOP incompatível com a classificação sugerida</BulletItem>
                  <BulletItem>Possíveis inconsistências de ST</BulletItem>
                  <BulletItem>CST não tributável com valor de PIS/COFINS</BulletItem>
                  <BulletItem>CST tributável com alíquota zero</BulletItem>
                  <BulletItem>Alíquota efetiva de ICMS possivelmente incompatível</BulletItem>
                  <BulletItem>Central de inconsistências com níveis de risco</BulletItem>
                </div>

                <div style={V.capCard}>
                  <p style={V.capTitle}>XML e NF-e</p>
                  <BulletItem>Importação de XML de terceiros como entradas</BulletItem>
                  <BulletItem>Importação de XML próprios como saídas</BulletItem>
                  <BulletItem>Importação em lote e arquivos ZIP com XMLs</BulletItem>
                  <BulletItem>Validação de CNPJ antes da importação</BulletItem>
                  <BulletItem>Bloqueio de arquivos de empresas diferentes</BulletItem>
                  <BulletItem>Sugestão de CFOP de entrada</BulletItem>
                  <BulletItem>Classificação fiscal por item e manual por nota</BulletItem>
                  <BulletItem>Exportação dos dados para Excel</BulletItem>
                </div>

                <div style={V.capCard}>
                  <p style={V.capTitle}>Relatórios fiscais</p>
                  <BulletItem>Relatórios de entradas e saídas</BulletItem>
                  <BulletItem>Relatórios por documento, produto, participante</BulletItem>
                  <BulletItem>Relatórios por NCM e CFOP</BulletItem>
                  <BulletItem>Filtros por competência e movimentação</BulletItem>
                  <BulletItem>Exportação para Excel</BulletItem>
                </div>

                <div style={V.capCard}>
                  <p style={V.capTitle}>Simples Nacional</p>
                  <BulletItem>Apuração com base nos dados fiscais importados</BulletItem>
                  <BulletItem>Conferência entre XML e PGDAS-D</BulletItem>
                  <BulletItem>Comparação entre faturamento fiscal e receita declarada</BulletItem>
                  <BulletItem>Tratamento de devoluções de venda</BulletItem>
                  <BulletItem>Identificação de divergências de receita</BulletItem>
                  <BulletItem>Geração de PDF da apuração</BulletItem>
                </div>

                <div style={V.capCard}>
                  <p style={V.capTitle}>Editor SPED e estrutura SaaS</p>
                  <BulletItem>Mesclagem de arquivos SPED (base + Bloco K)</BulletItem>
                  <BulletItem>Validação, comparação e tratamento de conflitos</BulletItem>
                  <BulletItem>Multiempresa e multiusuário por escritório</BulletItem>
                  <BulletItem>Controle de acesso por organização</BulletItem>
                  <BulletItem>Separação de dados por org (isolamento completo)</BulletItem>
                  <BulletItem>Validação de empresa e CNPJ em importações</BulletItem>
                  <BulletItem>Dados centralizados para alimentar mais de um módulo</BulletItem>
                </div>

              </div>
            </div>
          </section>

          {/* ── SCREENSHOTS ──────────────────────────────────────────────── */}
          <section style={V.section} id="screenshots">
            <div style={V.wrap}>
              <div style={V.heading}>
                <h2 style={V.h2}>Telas reais da plataforma.</h2>
                <p style={V.lead}>
                  Imagens com dados demonstrativos anonimizados. Nenhuma informação real de cliente é exibida.
                </p>
              </div>

              {/* Feature blocks com screenshots */}
              <div className="lp-feature" style={V.feature}>
                <div className="lp-feature-copy">
                  <span style={V.eyebrow}>Relatórios fiscais</span>
                  <h3 style={V.featureH3}>Documentos, produtos, participantes, NCM e CFOP em uma visão operacional.</h3>
                  <p style={V.featureP}>
                    Filtre competências, analise entradas e saídas, confira quantidades e valores e exporte a base para
                    trabalhar com segurança nas rotinas do escritório.
                  </p>
                  <div style={V.bullets}>
                    <FeatureBullet>Relatórios detalhados e resumidos por movimento</FeatureBullet>
                    <FeatureBullet>Visões por documento, produto, participante, CFOP e NCM</FeatureBullet>
                    <FeatureBullet>Excel para análises maiores e entregas internas</FeatureBullet>
                  </div>
                </div>
                <div style={V.shot}>
                  <img src="/landing/tela_02_anonimizada.png" alt="Relatórios fiscais — dados demonstrativos" style={{ display: 'block', width: '100%', borderRadius: 12 }} />
                </div>
              </div>

              <div className="lp-feature lp-feature-even" style={V.featureEven}>
                <div style={V.shot}>
                  <img src="/landing/tela_03_anonimizada.png" alt="Simples Nacional — conferência XML vs PGDAS-D — dados demonstrativos" style={{ display: 'block', width: '100%', borderRadius: 12 }} />
                </div>
                <div className="lp-feature-copy">
                  <span style={V.eyebrow}>Simples Nacional</span>
                  <h3 style={V.featureH3}>Confronte a receita fiscal com o PGDAS-D antes de confiar no número declarado.</h3>
                  <p style={V.featureP}>
                    A apuração usa a mesma base fiscal dos relatórios. Isso evita leituras desencontradas e mostra,
                    por competência, faturamento XML, devoluções, receita considerada, PGDAS-D e diferença.
                  </p>
                  <div style={V.bullets}>
                    <FeatureBullet>Identificação de CFOPs e naturezas com impacto em receita</FeatureBullet>
                    <FeatureBullet>Devoluções de venda tratadas como redutoras da receita</FeatureBullet>
                    <FeatureBullet>Confronto visual, Excel e PDF da apuração</FeatureBullet>
                  </div>
                </div>
              </div>

              <div className="lp-feature" style={V.feature}>
                <div className="lp-feature-copy">
                  <span style={V.eyebrow}>Validador NF-e</span>
                  <h3 style={V.featureH3}>Importe XMLs em lote sem perder o controle de quem pertence a cada empresa.</h3>
                  <p style={V.featureP}>
                    Fluxos separados para notas de terceiros e notas próprias, validação de CNPJ, detecção por
                    competência, classificação de itens e organização da base que alimenta os outros módulos.
                  </p>
                  <div style={V.bullets}>
                    <FeatureBullet>XML direto ou ZIP, com múltiplas competências</FeatureBullet>
                    <FeatureBullet>Proteção contra importação de XML de outra empresa</FeatureBullet>
                    <FeatureBullet>Sugestão de CFOP de entrada e classificação por item</FeatureBullet>
                  </div>
                </div>
                <div style={V.shot}>
                  <img src="/landing/tela_04_anonimizada.png" alt="Validador NF-e — dados demonstrativos" style={{ display: 'block', width: '100%', borderRadius: 12 }} />
                </div>
              </div>

              <div className="lp-feature lp-feature-even" style={V.featureEven}>
                <div style={V.shot}>
                  <img src="/landing/tela_05_anonimizada.png" alt="Auditor SPED — dados demonstrativos" style={{ display: 'block', width: '100%', borderRadius: 12 }} />
                </div>
                <div className="lp-feature-copy">
                  <span style={V.eyebrow}>Auditor SPED</span>
                  <h3 style={V.featureH3}>Cruzamentos automáticos para achar o que ficaria escondido em planilhas.</h3>
                  <p style={V.featureP}>
                    Importe SPED Fiscal e Contribuições e acesse alertas, comparações e análises de apuração em uma
                    tela unificada por empresa e competência.
                  </p>
                  <div style={V.bullets}>
                    <FeatureBullet>Notas ausentes entre SPEDs identificadas automaticamente</FeatureBullet>
                    <FeatureBullet>Regras fiscais executadas sobre os dados importados</FeatureBullet>
                    <FeatureBullet>Exportação Excel da análise completa</FeatureBullet>
                  </div>
                </div>
              </div>

              <div className="lp-feature" style={{ ...V.feature, marginBottom: 0 }}>
                <div className="lp-feature-copy">
                  <span style={V.eyebrow}>Editor SPED</span>
                  <h3 style={V.featureH3}>Uma rotina assistida para mesclar bases e revisar o Bloco K.</h3>
                  <p style={V.featureP}>
                    Fluxo guiado para usar uma base fiscal correta, incorporar o Bloco K de outra fonte, identificar
                    conflitos e gerar um novo arquivo após a conferência.
                  </p>
                  <div style={V.bullets}>
                    <FeatureBullet>Importação de arquivo base e fonte do Bloco K</FeatureBullet>
                    <FeatureBullet>Conflitos apresentados para tratamento manual</FeatureBullet>
                    <FeatureBullet>Fluxo em sete etapas: importar, validar, comparar, editar, verificar e gerar</FeatureBullet>
                  </div>
                </div>
                <div style={V.shot}>
                  <img src="/landing/tela_06_anonimizada.png" alt="Editor SPED Fiscal — dados demonstrativos" style={{ display: 'block', width: '100%', borderRadius: 12 }} />
                </div>
              </div>
            </div>
          </section>

          {/* ── ROADMAP ──────────────────────────────────────────────────── */}
          <section style={V.sectionAlt} id="roadmap">
            <div style={V.wrap}>
              <div style={V.heading}>
                <h2 style={V.h2}>Entre agora para influenciar o que vem depois.</h2>
                <p style={V.lead}>
                  O núcleo fiscal já está em validação. Os próximos módulos serão construídos sobre a mesma base de dados,
                  com prioridade para os problemas reais dos escritórios parceiros.
                </p>
              </div>
              <div className="lp-roadmap-grid" style={V.roadmapGrid}>

                <article style={V.road}>
                  <span style={V.statusReady}>Disponível</span>
                  <h3 style={V.roadH3}>Fiscal inteligente</h3>
                  <p style={V.roadP}>SPED Fiscal e Contribuições, XML, relatórios, regras, alertas, Simples Nacional e exportações. Núcleo em validação com escritórios parceiros.</p>
                </article>

                <article style={V.road}>
                  <span style={V.statusReady}>Disponível</span>
                  <h3 style={V.roadH3}>Editor SPED</h3>
                  <p style={V.roadP}>Mesclagem de arquivos SPED, wizard de sete etapas, tratamento de conflitos e geração do arquivo final com Bloco K.</p>
                </article>

                <article style={V.road}>
                  <span style={V.statusValidating}>Em validação</span>
                  <h3 style={V.roadH3}>Planejamento Tributário</h3>
                  <p style={V.roadP}>Comparação de regimes (Simples, Presumido, Real), simulação de carga tributária, grupos econômicos e análise de risco de desenquadramento.</p>
                </article>

                <article style={V.road}>
                  <span style={V.statusBuilding}>Em desenvolvimento</span>
                  <h3 style={V.roadH3}>Obrigações Acessórias</h3>
                  <p style={V.roadP}>Calendário e controle de entregas. Alertas de prazo para REINF, DCTFWeb, eSocial, DCTF e ECF.</p>
                </article>

                <article style={V.road}>
                  <span style={V.statusPlanned}>Planejado</span>
                  <h3 style={V.roadH3}>Contábil</h3>
                  <p style={V.roadP}>Módulo contábil integrado à base fiscal, com evolução gradual após consolidação dos módulos tributários.</p>
                </article>

                <article style={V.road}>
                  <span style={V.statusPlanned}>Planejado</span>
                  <h3 style={V.roadH3}>DP e Financeiro</h3>
                  <p style={V.roadP}>Departamento Pessoal e módulo Financeiro integrados, planejados como próximos pilares da plataforma.</p>
                </article>

              </div>
            </div>
          </section>

          {/* ── CTA BETA ─────────────────────────────────────────────────── */}
          <section style={V.betaSection} id="founder">
            <div style={V.wrap}>
              <div className="lp-beta-box" style={V.betaBox}>
                <div>
                  <span style={V.eyebrow}>Acesso gratuito de validação</span>
                  <h2 style={V.betaH2}>10 escritórios terão acesso gratuito à fase beta.</h2>
                  <p style={V.betaP}>
                    Estamos selecionando escritórios parceiros para testar a plataforma em casos reais, contribuir com
                    melhorias e ajudar a definir as próximas funcionalidades. Serão apenas 10 vagas, aprovadas de forma
                    controlada.
                  </p>
                </div>
                <a {...ctaProps} style={{ ...V.btnPrimary, fontSize: 15, padding: '15px 22px' }}>
                  Solicitar acesso gratuito
                </a>
              </div>
            </div>
          </section>

          {/* ── FOUNDER ACCESS ───────────────────────────────────────────── */}
          <section style={V.founderSection}>
            <div style={V.wrap}>
              <div style={V.founderBox}>
                <span style={V.founderEyebrow}>Founder Access</span>
                <h2 style={V.founderH2}>Participe da construção da plataforma.</h2>
                <p style={V.founderP}>
                  Após a fase beta, escritórios fundadores terão condições especiais e participação próxima na evolução
                  dos módulos, prioridades e integrações da Enfokus. O Founder Access reunirá os parceiros que apoiam o
                  desenvolvimento e acompanham de perto as próximas entregas.
                </p>
              </div>
            </div>
          </section>

        </main>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <footer>
          <div style={{ ...V.wrap, ...V.footer }}>
            <span>© 2026 Enfokus. Auditoria fiscal para escritórios contábeis.</span>
            <span>Dados exibidos nas imagens são demonstrativos e não representam informações reais de clientes.</span>
          </div>
        </footer>

      </div>

      {/* ── MODAL ──────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div style={V.modalOverlay} onClick={() => setModalOpen(false)}>
          <div style={V.modalBox} onClick={(e) => e.stopPropagation()}>
            <h2 style={V.modalTitle}>Acesso em breve</h2>
            <p style={V.modalText}>
              Em breve você poderá solicitar acesso. Entre em contato com a Enfokus para participar da seleção beta.
            </p>
            <button
              onClick={() => setModalOpen(false)}
              style={{ ...V.btnPrimary, width: '100%', justifyContent: 'center', border: 'none' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── RESPONSIVE STYLES ────────────────────────────────────────────── */}
      <style>{`
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; }

        .lp-navlinks a { color: #a9bdd5; }
        .lp-navlinks a:hover { color: #f7fbff; }

        @media (max-width: 900px) {
          .lp-hero,
          .lp-feature,
          .lp-feature-even,
          .lp-audit-panel {
            grid-template-columns: 1fr !important;
          }
          .lp-grid3,
          .lp-roadmap-grid,
          .lp-numbers,
          .lp-cap-grid {
            grid-template-columns: 1fr !important;
          }
          .lp-beta-box {
            grid-template-columns: 1fr !important;
          }
          .lp-navlinks {
            display: none !important;
          }
        }

        @media (max-width: 640px) {
          .lp-feature,
          .lp-feature-even {
            gap: 20px !important;
            margin-bottom: 40px !important;
          }
        }
      `}</style>
    </>
  )
}
