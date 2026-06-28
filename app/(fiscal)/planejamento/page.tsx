'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import {
  Calculator, TrendingUp, AlertTriangle, CheckCircle2, Info, Download,
  ChevronDown, ChevronRight, Settings, RefreshCw, Building2, BarChart3,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import type { Empresa } from '@/lib/types'
import type {
  PremissesCenario,
  ResultadoComparativo,
  TipoPredominante,
  ModoIcms,
} from '@/lib/planejamento/types'

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S = {
  page:   { padding: '28px 24px 64px', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif', color: 'var(--af-text)', minHeight: '100vh' } as React.CSSProperties,
  inner:  { maxWidth: 1320, margin: '0 auto' } as React.CSSProperties,
  card:   { background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16 } as React.CSSProperties,
  row:    { display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'center' },
  label:  { fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, display: 'block' },
  input:  { background: 'var(--af-surface-2)', border: '1px solid var(--af-border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--af-text)', width: '100%', boxSizing: 'border-box' as const },
  select: { background: 'var(--af-surface-2)', border: '1px solid var(--af-border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--af-text)', width: '100%', boxSizing: 'border-box' as const },
  btn:    { display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, fontWeight: 600, fontSize: 13, padding: '9px 16px', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  th:     { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', textAlign: 'left' as const, borderBottom: '1px solid var(--af-border)', background: 'var(--af-surface-2)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const },
  thR:    { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', textAlign: 'right' as const, borderBottom: '1px solid var(--af-border)', background: 'var(--af-surface-2)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const },
  td:     { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--af-border)', verticalAlign: 'middle' as const, color: 'var(--af-text-soft)' },
  tdR:    { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--af-border)', verticalAlign: 'middle' as const, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const, color: 'var(--af-text-soft)' },
  tag:    { display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' },
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v: number) => (v * 100).toFixed(2).replace('.', ',') + '%'
const LIMITE_SN = 4_800_000

// ─── Premissas padrão ─────────────────────────────────────────────────────────
function premissasPadrao(empresaIds: string[], periodoInicial: string, periodoFinal: string): PremissesCenario {
  return {
    nomeCenario: 'Grupo Econômico',
    tipoPredominante: 'comercio',
    periodoInicial,
    periodoFinal,
    empresaIds,
    lucroPresumido: {
      percentualIrpjComercio: 0.08,
      percentualIrpjServico: 0.32,
      percentualIrpjIndustria: 0.08,
      percentualCsllComercio: 0.12,
      percentualCsllServico: 0.32,
      percentualCsllIndustria: 0.12,
    },
    lucroReal: {
      margemLucroEstimada: 0.10,
      cmvSobreReceita: 0.60,
      despesasOperacionaisSobreReceita: 0.15,
      folhaSobreReceita: 0.10,
      outrasDeducoesSobreReceita: 0.05,
      creditosPisCofinsEstimados: 0,
    },
    icms: {
      aliquotaInternaDefault: 0.17,
      aliquotaInterestadualSul: 0.12,
      aliquotaInterestadualNorte: 0.07,
      aliquotaImportado: 0.04,
      ufEmpresa: 'GO',
      modo: 'simular_faltantes',
    },
  }
}

// ─── Helpers de UX ────────────────────────────────────────────────────────────
function TagConfianca({ nivel }: { nivel: 'alto' | 'medio' | 'baixo' }) {
  const cores = {
    alto:  { bg: '#16a34a22', color: '#16a34a', border: '#16a34a44' },
    medio: { bg: '#d9770622', color: '#d97706', border: '#d9770644' },
    baixo: { bg: '#dc262622', color: '#dc2626', border: '#dc262644' },
  }
  const c = cores[nivel]
  const label = nivel === 'alto' ? 'Confiança alta' : nivel === 'medio' ? 'Confiança média' : 'Confiança baixa'
  return (
    <span style={{ ...S.tag, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {label}
    </span>
  )
}

function TagRisco({ ultrapassa }: { ultrapassa: boolean }) {
  if (ultrapassa) return (
    <span style={{ ...S.tag, background: '#dc262622', color: '#dc2626', border: '1px solid #dc262644' }}>
      <AlertTriangle size={10} /> Risco de autuação
    </span>
  )
  return (
    <span style={{ ...S.tag, background: '#16a34a22', color: '#16a34a', border: '1px solid #16a34a44' }}>
      <CheckCircle2 size={10} /> Dentro do limite
    </span>
  )
}

function AlertaBox({ mensagens }: { mensagens: string[] }) {
  if (!mensagens.length) return null
  return (
    <div style={{ background: '#d9770608', border: '1px solid #d9770633', borderRadius: 10, padding: '12px 16px', marginTop: 12 }}>
      {mensagens.map((msg, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--af-muted)', marginBottom: i < mensagens.length - 1 ? 6 : 0 }}>
          <Info size={12} style={{ flexShrink: 0, marginTop: 1, color: '#d97706' }} />
          {msg}
        </div>
      ))}
    </div>
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={S.card}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', width: '100%', padding: 0, color: 'var(--af-text)' }}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span>
      </button>
      {open && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function PlanejamentoPage() {
  const supabase = createClient()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [periodoInicial, setPeriodoInicial] = useState(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [periodoFinal, setPeriodoFinal] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [premissas, setPremissas] = useState<PremissesCenario | null>(null)
  const [resultado, setResultado] = useState<ResultadoComparativo | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<'consolidacao' | 'regimes' | 'icms' | 'alertas'>('consolidacao')

  // Carregar empresas da organização
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('empresas')
        .select('id, razao_social, cnpj, regime, uf, status')
        .eq('status', 'Ativo')
        .order('razao_social')
      setEmpresas((data ?? []) as Empresa[])
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleEmpresa = useCallback((id: string) => {
    setSelecionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selecionarTodas = useCallback(() => {
    setSelecionadas(new Set(empresas.map(e => e.id)))
  }, [empresas])

  const limparSelecao = useCallback(() => setSelecionadas(new Set()), [])

  async function simular() {
    if (selecionadas.size === 0) { setErro('Selecione ao menos uma empresa.'); return }
    const p = premissas ?? premissasPadrao(Array.from(selecionadas), periodoInicial, periodoFinal)
    const premissasFinais: PremissesCenario = { ...p, empresaIds: Array.from(selecionadas), periodoInicial, periodoFinal }
    setPremissas(premissasFinais)
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/planejamento-tributario/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ premissas: premissasFinais }),
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? `Erro HTTP ${res.status}`)
      }
      const json = await res.json() as { resultado: ResultadoComparativo }
      setResultado(json.resultado)
      setAbaAtiva('consolidacao')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  function exportarExcel() {
    if (!resultado) return
    const wb = XLSX.utils.book_new()

    // Aba: Resumo Geral
    const resumo = [
      ['Cenário', resultado.premissas.nomeCenario],
      ['Período', `${resultado.premissas.periodoInicial} → ${resultado.premissas.periodoFinal}`],
      ['Empresas', resultado.consolidacao.empresas.map(e => e.razao_social).join(', ')],
      [],
      ['Regime', 'Total estimado (R$)', 'Alíquota efetiva (%)'],
      ['Simples Nacional (DAS pago)', resultado.simplesAtual, pct(resultado.simplesAtual / (resultado.consolidacao.receitaAnualTotal || 1))],
      ['Lucro Presumido', resultado.lucroPresumido.totalPeriodo, pct(resultado.lucroPresumido.aliquotaEfetiva)],
      ['Lucro Real', resultado.lucroReal.totalPeriodo, pct(resultado.lucroReal.aliquotaEfetiva)],
      [],
      ['Melhor regime estimado', resultado.melhorRegime],
      ['Economia estimada (SN vs melhor)', resultado.economiaEstimada],
      ['Confiança geral', resultado.confiancaGeral],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo Geral')

    // Aba: Receita por CNPJ/mês
    const cabRec = ['Competência', ...resultado.consolidacao.empresas.map(e => `${e.razao_social} (${e.cnpj ?? ''})`), 'Total Grupo', 'Limite Proporcional', 'Folga']
    const linhasRec = resultado.consolidacao.receitaPorMes.map(m => [
      m.competencia,
      ...resultado.consolidacao.empresas.map(e => m.porEmpresa[e.id] ?? 0),
      m.receitaTotal,
      LIMITE_SN / 12,
      m.folga,
    ])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cabRec, ...linhasRec]), 'Receita por CNPJ')

    // Aba: Simples Atual
    const linhasSN = [
      ['Competência', 'Receita Total (R$)', 'Limite SN Anual', 'RBT12 Consolidado'],
      ...resultado.consolidacao.receitaPorMes.map(m => [
        m.competencia, m.receitaTotal, LIMITE_SN, resultado.consolidacao.rbt12Consolidado,
      ]),
      ['TOTAL DAS pago', resultado.simplesAtual, '', ''],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhasSN), 'Simples Atual')

    // Aba: Lucro Presumido
    const cabLP = ['Competência', 'Receita (R$)', 'PIS', 'COFINS', 'IRPJ Base', 'CSLL Base', 'IRPJ', 'CSLL', 'Total']
    const linhasLP = resultado.lucroPresumido.porMes.map(m => [
      m.competencia, m.receitaTributavel, m.pis, m.cofins, m.irpjBase, m.csllBase, m.irpjMensal, m.csllMensal, m.totalMensal,
    ])
    linhasLP.push(['TOTAL', ...Array(7).fill(''), resultado.lucroPresumido.totalPeriodo])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cabLP, ...linhasLP]), 'Lucro Presumido')

    // Aba: Lucro Real
    const cabLR = ['Competência', 'Receita (R$)', 'CMV', 'Despesas Op.', 'Folha', 'Outras Ded.', 'Lucro Est.', 'PIS líq.', 'COFINS líq.', 'IRPJ', 'CSLL', 'Total']
    const linhasLR = resultado.lucroReal.porMes.map(m => [
      m.competencia, m.receitaBruta, m.cmv, m.despesasOperacionais, m.folha, m.outrasDeducoes,
      m.lucroEstimado, m.pisLiquido, m.cofinsLiquido, m.irpjMensal, m.csllMensal, m.totalMensal,
    ])
    linhasLR.push(['TOTAL', ...Array(10).fill(''), resultado.lucroReal.totalPeriodo])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cabLR, ...linhasLR]), 'Lucro Real')

    // Aba: ICMS Mensal
    const cabICMS = ['Competência', 'Débito Real', 'Débito Simulado', 'Crédito Aproveitável', 'Crédito Glosado', 'ICMS-ST', 'Estimado a Pagar', 'Confiança']
    const linhasICMS = resultado.icms.porMes.map(m => [
      m.competencia, m.debitoReal, m.debitoSimulado, m.creditoAproveitavel,
      m.creditoGlosado, m.icmsSt, m.icmsEstimadoPagar, m.nivelConfianca,
    ])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cabICMS, ...linhasICMS]), 'ICMS Mensal')

    // Aba: Alertas
    const alertasTodos = [
      ...resultado.alertasGerais,
      ...resultado.lucroPresumido.alertas,
      ...resultado.lucroReal.alertas,
      ...resultado.icms.alertas,
      ...resultado.icms.porMes.flatMap(m => m.alertas),
    ].filter(Boolean)
    const linhasAlertas = alertasTodos.map((a, i) => [i + 1, a])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['#', 'Alerta/Limitação'], ...linhasAlertas]), 'Alertas e Limitações')

    XLSX.writeFile(wb, `planejamento-tributario-${Date.now()}.xlsx`)
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const empresasSelecionadas = empresas.filter(e => selecionadas.has(e.id))

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <PageHeader
          title="Planejamento Tributário"
          subtitle="Simule grupos econômicos, compare regimes tributários e avalie risco de desenquadramento do Simples Nacional."
          badge={{ label: 'Estimativa', color: '#d97706' }}
          actions={
            resultado && (
              <button
                onClick={exportarExcel}
                style={{ ...S.btn, background: '#16a34a', color: '#fff' }}
              >
                <Download size={14} /> Exportar Excel
              </button>
            )
          }
        />

        {/* ── SELEÇÃO DE EMPRESAS ─────────────────────────────────────── */}
        <Section title="1. Selecionar empresas do grupo" defaultOpen>
          <div style={{ ...S.row, marginBottom: 12 }}>
            <button onClick={selecionarTodas} style={{ ...S.btn, background: 'var(--af-primary-soft)', color: 'var(--af-primary)' }}>
              Todas ({empresas.length})
            </button>
            <button onClick={limparSelecao} style={{ ...S.btn, background: 'var(--af-surface-2)', color: 'var(--af-muted)' }}>
              Limpar
            </button>
            {selecionadas.size > 0 && (
              <span style={{ fontSize: 12, color: 'var(--af-muted)' }}>{selecionadas.size} selecionada(s)</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {empresas.map(e => {
              const sel = selecionadas.has(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => toggleEmpresa(e.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    background: sel ? 'var(--af-primary-soft)' : 'var(--af-surface-2)',
                    border: `1px solid ${sel ? 'var(--af-primary)' : 'var(--af-border)'}`,
                    color: sel ? 'var(--af-primary)' : 'var(--af-text)',
                    transition: 'all 0.15s',
                  }}
                >
                  <Building2 size={14} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.razao_social}</div>
                    <div style={{ fontSize: 11, color: 'var(--af-muted)', marginTop: 1 }}>
                      {e.cnpj ?? 'Sem CNPJ'} · {e.regime ?? '—'} · {e.uf}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── PERÍODO ────────────────────────────────────────────────────── */}
        <Section title="2. Período de análise" defaultOpen>
          <div style={{ ...S.row, gap: 20, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={S.label}>De (AAAA-MM)</label>
              <input type="month" value={periodoInicial} onChange={e => setPeriodoInicial(e.target.value)} style={S.input} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={S.label}>Até (AAAA-MM)</label>
              <input type="month" value={periodoFinal} onChange={e => setPeriodoFinal(e.target.value)} style={S.input} />
            </div>
          </div>
        </Section>

        {/* ── PREMISSAS ──────────────────────────────────────────────────── */}
        <Section title="3. Premissas do cenário" defaultOpen={false}>
          {premissas && (
            <PainelPremissas premissas={premissas} onChange={setPremissas} />
          )}
          {!premissas && (
            <p style={{ fontSize: 13, color: 'var(--af-muted)', margin: 0 }}>
              Clique em <strong>Simular</strong> para usar os valores padrão, ou edite as premissas após a primeira simulação.
            </p>
          )}
        </Section>

        {/* ── BOTÃO SIMULAR ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <button
            onClick={simular}
            disabled={loading || selecionadas.size === 0}
            style={{
              ...S.btn,
              background: loading || selecionadas.size === 0 ? 'var(--af-border)' : 'var(--af-primary)',
              color: '#fff',
              fontSize: 14,
              padding: '11px 24px',
              opacity: loading || selecionadas.size === 0 ? 0.6 : 1,
            }}
          >
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Calculator size={14} />}
            {loading ? 'Calculando…' : 'Simular'}
          </button>
          {erro && <span style={{ fontSize: 13, color: '#dc2626' }}><AlertTriangle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />{erro}</span>}
        </div>

        {/* ── RESULTADO ──────────────────────────────────────────────────── */}
        {resultado && (
          <>
            {/* Cartões de resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <MetricaCard
                label="Receita anual total"
                valor={money.format(resultado.consolidacao.receitaAnualTotal)}
                sub="período selecionado"
                alerta={resultado.consolidacao.ultrapassaLimiteAnual}
              />
              <MetricaCard
                label="RBT12 consolidado"
                valor={money.format(resultado.consolidacao.rbt12Consolidado)}
                sub={`Limite: ${money.format(LIMITE_SN)}`}
                alerta={resultado.consolidacao.ultrapassaLimiteAnual}
              />
              <MetricaCard
                label="Simples atual (DAS)"
                valor={resultado.simplesAtual > 0 ? money.format(resultado.simplesAtual) : '—'}
                sub="base: PGDAS-D importados"
              />
              <MetricaCard
                label="Lucro Presumido est."
                valor={money.format(resultado.lucroPresumido.totalPeriodo)}
                sub={`Alíquota ef.: ${pct(resultado.lucroPresumido.aliquotaEfetiva)}`}
              />
              <MetricaCard
                label="Lucro Real est."
                valor={money.format(resultado.lucroReal.totalPeriodo)}
                sub={`Confiança: ${resultado.lucroReal.confianca}`}
              />
              <MetricaCard
                label="Melhor regime"
                valor={
                  resultado.melhorRegime === 'simples' ? 'Simples Nacional'
                  : resultado.melhorRegime === 'presumido' ? 'Lucro Presumido'
                  : resultado.melhorRegime === 'real' ? 'Lucro Real'
                  : 'Indeterminado'
                }
                sub={resultado.economiaEstimada !== 0 ? `Dif. vs SN: ${money.format(Math.abs(resultado.economiaEstimada))}` : ''}
                destaque
              />
            </div>

            {/* Status RBT12 */}
            <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <TagRisco ultrapassa={resultado.consolidacao.ultrapassaLimiteAnual} />
              {resultado.consolidacao.ultrapassaLimiteAnual && (
                <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                  RBT12 consolidado excede R$ 4.800.000 — grupo em risco de desenquadramento e autuação pelo fisco
                </span>
              )}
              {!resultado.consolidacao.ultrapassaLimiteAnual && (
                <span style={{ fontSize: 13, color: 'var(--af-muted)' }}>
                  RBT12 consolidado dentro do limite anual do Simples Nacional
                </span>
              )}
              <TagConfianca nivel={resultado.confiancaGeral} />
            </div>

            {/* Abas de detalhe */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--af-border)', paddingBottom: 0 }}>
              {(['consolidacao', 'regimes', 'icms', 'alertas'] as const).map(aba => (
                <button
                  key={aba}
                  onClick={() => setAbaAtiva(aba)}
                  style={{
                    ...S.btn,
                    borderRadius: '8px 8px 0 0',
                    background: abaAtiva === aba ? 'var(--af-surface)' : 'transparent',
                    color: abaAtiva === aba ? 'var(--af-primary)' : 'var(--af-muted)',
                    borderBottom: abaAtiva === aba ? '2px solid var(--af-primary)' : '2px solid transparent',
                    fontSize: 12,
                  }}
                >
                  {aba === 'consolidacao' && <><BarChart3 size={12} /> Consolidação</>}
                  {aba === 'regimes' && <><TrendingUp size={12} /> Regimes</>}
                  {aba === 'icms' && <><Calculator size={12} /> ICMS</>}
                  {aba === 'alertas' && <><AlertTriangle size={12} /> Alertas</>}
                </button>
              ))}
            </div>

            {/* Aba: Consolidação */}
            {abaAtiva === 'consolidacao' && (
              <div style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Receita mensal consolidada do grupo</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={S.th}>Competência</th>
                        {empresasSelecionadas.map(e => (
                          <th key={e.id} style={S.thR}>{e.razao_social.split(' ')[0]}</th>
                        ))}
                        <th style={S.thR}>Total Grupo</th>
                        <th style={S.thR}>Limite Mensal</th>
                        <th style={S.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.consolidacao.receitaPorMes.map(m => (
                        <tr key={m.competencia}>
                          <td style={S.td}>{m.competencia}</td>
                          {empresasSelecionadas.map(e => (
                            <td key={e.id} style={S.tdR}>{money.format(m.porEmpresa[e.id] ?? 0)}</td>
                          ))}
                          <td style={{ ...S.tdR, fontWeight: 700, color: m.ultrapassaLimite ? '#dc2626' : 'var(--af-text)' }}>
                            {money.format(m.receitaTotal)}
                          </td>
                          <td style={S.tdR}>{money.format(LIMITE_SN / 12)}</td>
                          <td style={S.td}>
                            {m.ultrapassaLimite
                              ? <span style={{ color: '#dc2626', fontSize: 12, fontWeight: 700 }}>⚠ Acima</span>
                              : <span style={{ color: '#16a34a', fontSize: 12 }}>✓ OK</span>
                            }
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--af-surface-2)' }}>
                        <td style={{ ...S.td, fontWeight: 700 }}>TOTAL</td>
                        {empresasSelecionadas.map(e => (
                          <td key={e.id} style={{ ...S.tdR, fontWeight: 700 }}>
                            {money.format(resultado.consolidacao.receitaPorMes.reduce((s, m) => s + (m.porEmpresa[e.id] ?? 0), 0))}
                          </td>
                        ))}
                        <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.consolidacao.receitaAnualTotal)}</td>
                        <td style={S.tdR}>{money.format(LIMITE_SN)}</td>
                        <td style={S.td}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Aba: Regimes */}
            {abaAtiva === 'regimes' && (
              <div>
                {/* Comparativo resumido */}
                <div style={S.card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Comparativo de regimes tributários — período completo</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={S.th}>Regime</th>
                        <th style={S.thR}>Total estimado</th>
                        <th style={S.thR}>Alíquota efetiva</th>
                        <th style={S.thR}>Dif. vs Simples</th>
                        <th style={S.th}>Confiança</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ ...S.td, fontWeight: 600 }}>Simples Nacional (DAS pago)</td>
                        <td style={{ ...S.tdR, fontWeight: 700 }}>{resultado.simplesAtual > 0 ? money.format(resultado.simplesAtual) : '—'}</td>
                        <td style={S.tdR}>
                          {resultado.simplesAtual > 0 && resultado.consolidacao.receitaAnualTotal > 0
                            ? pct(resultado.simplesAtual / resultado.consolidacao.receitaAnualTotal)
                            : '—'
                          }
                        </td>
                        <td style={S.tdR}>—</td>
                        <td style={S.td}><TagConfianca nivel="alto" /></td>
                      </tr>
                      <tr>
                        <td style={{ ...S.td, fontWeight: 600 }}>Lucro Presumido</td>
                        <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroPresumido.totalPeriodo)}</td>
                        <td style={S.tdR}>{pct(resultado.lucroPresumido.aliquotaEfetiva)}</td>
                        <td style={{ ...S.tdR, color: resultado.lucroPresumido.totalPeriodo < resultado.simplesAtual ? '#16a34a' : '#dc2626' }}>
                          {resultado.simplesAtual > 0
                            ? money.format(resultado.lucroPresumido.totalPeriodo - resultado.simplesAtual)
                            : '—'
                          }
                        </td>
                        <td style={S.td}><TagConfianca nivel={resultado.lucroPresumido.confianca} /></td>
                      </tr>
                      <tr>
                        <td style={{ ...S.td, fontWeight: 600 }}>Lucro Real</td>
                        <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroReal.totalPeriodo)}</td>
                        <td style={S.tdR}>{pct(resultado.lucroReal.aliquotaEfetiva)}</td>
                        <td style={{ ...S.tdR, color: resultado.lucroReal.totalPeriodo < resultado.simplesAtual ? '#16a34a' : '#dc2626' }}>
                          {resultado.simplesAtual > 0
                            ? money.format(resultado.lucroReal.totalPeriodo - resultado.simplesAtual)
                            : '—'
                          }
                        </td>
                        <td style={S.td}><TagConfianca nivel={resultado.lucroReal.confianca} /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Detalhamento mensal LP */}
                <div style={S.card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Lucro Presumido — detalhamento mensal</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={S.th}>Competência</th>
                          <th style={S.thR}>Receita</th>
                          <th style={S.thR}>PIS</th>
                          <th style={S.thR}>COFINS</th>
                          <th style={S.thR}>IRPJ</th>
                          <th style={S.thR}>CSLL</th>
                          <th style={S.thR}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.lucroPresumido.porMes.map(m => (
                          <tr key={m.competencia}>
                            <td style={S.td}>{m.competencia}</td>
                            <td style={S.tdR}>{money.format(m.receitaTributavel)}</td>
                            <td style={S.tdR}>{money.format(m.pis)}</td>
                            <td style={S.tdR}>{money.format(m.cofins)}</td>
                            <td style={S.tdR}>{money.format(m.irpjMensal)}</td>
                            <td style={S.tdR}>{money.format(m.csllMensal)}</td>
                            <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(m.totalMensal)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--af-surface-2)' }}>
                          <td style={{ ...S.td, fontWeight: 700 }}>TOTAL</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroPresumido.porMes.reduce((s, m) => s + m.receitaTributavel, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroPresumido.porMes.reduce((s, m) => s + m.pis, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroPresumido.porMes.reduce((s, m) => s + m.cofins, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroPresumido.porMes.reduce((s, m) => s + m.irpjMensal, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroPresumido.porMes.reduce((s, m) => s + m.csllMensal, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroPresumido.totalPeriodo)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <AlertaBox mensagens={resultado.lucroPresumido.alertas} />
                </div>

                {/* Detalhamento mensal LR */}
                <div style={S.card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                    Lucro Real — detalhamento mensal
                    <TagConfianca nivel={resultado.lucroReal.confianca} />
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={S.th}>Competência</th>
                          <th style={S.thR}>Receita</th>
                          <th style={S.thR}>Lucro Est.</th>
                          <th style={S.thR}>PIS líq.</th>
                          <th style={S.thR}>COFINS líq.</th>
                          <th style={S.thR}>IRPJ</th>
                          <th style={S.thR}>CSLL</th>
                          <th style={S.thR}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.lucroReal.porMes.map(m => (
                          <tr key={m.competencia}>
                            <td style={S.td}>{m.competencia}</td>
                            <td style={S.tdR}>{money.format(m.receitaBruta)}</td>
                            <td style={{ ...S.tdR, color: m.lucroEstimado < 0 ? '#dc2626' : 'var(--af-text-soft)' }}>{money.format(m.lucroEstimado)}</td>
                            <td style={S.tdR}>{money.format(m.pisLiquido)}</td>
                            <td style={S.tdR}>{money.format(m.cofinsLiquido)}</td>
                            <td style={S.tdR}>{money.format(m.irpjMensal)}</td>
                            <td style={S.tdR}>{money.format(m.csllMensal)}</td>
                            <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(m.totalMensal)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--af-surface-2)' }}>
                          <td style={{ ...S.td, fontWeight: 700 }}>TOTAL</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroReal.porMes.reduce((s, m) => s + m.receitaBruta, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroReal.porMes.reduce((s, m) => s + m.lucroEstimado, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroReal.porMes.reduce((s, m) => s + m.pisLiquido, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroReal.porMes.reduce((s, m) => s + m.cofinsLiquido, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroReal.porMes.reduce((s, m) => s + m.irpjMensal, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroReal.porMes.reduce((s, m) => s + m.csllMensal, 0))}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.lucroReal.totalPeriodo)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <AlertaBox mensagens={resultado.lucroReal.alertas} />
                </div>
              </div>
            )}

            {/* Aba: ICMS */}
            {abaAtiva === 'icms' && (
              <div>
                <div style={S.card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>ICMS — apuração hipotética em regime normal</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={S.th}>Competência</th>
                          <th style={S.thR}>Débito Real</th>
                          <th style={S.thR}>Débito Simul.</th>
                          <th style={S.thR}>Crédito</th>
                          <th style={S.thR}>Crédito Glosado</th>
                          <th style={S.thR}>ICMS-ST</th>
                          <th style={S.thR}>Est. a Pagar</th>
                          <th style={S.th}>Confiança</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.icms.porMes.map(m => (
                          <tr key={m.competencia}>
                            <td style={S.td}>{m.competencia}</td>
                            <td style={S.tdR}>{money.format(m.debitoReal)}</td>
                            <td style={{ ...S.tdR, color: 'var(--af-muted)' }}>{money.format(m.debitoSimulado)}</td>
                            <td style={{ ...S.tdR, color: '#16a34a' }}>{money.format(m.creditoAproveitavel)}</td>
                            <td style={{ ...S.tdR, color: '#dc2626' }}>{money.format(m.creditoGlosado)}</td>
                            <td style={S.tdR}>{money.format(m.icmsSt)}</td>
                            <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(m.icmsEstimadoPagar)}</td>
                            <td style={S.td}><TagConfianca nivel={m.nivelConfianca} /></td>
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--af-surface-2)' }}>
                          <td style={{ ...S.td, fontWeight: 700 }}>TOTAL</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.icms.totalDebitoReal)}</td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.icms.totalDebitoSimulado)}</td>
                          <td style={{ ...S.tdR, fontWeight: 700, color: '#16a34a' }}>{money.format(resultado.icms.totalCreditoAproveitavel)}</td>
                          <td style={S.tdR}></td>
                          <td style={S.tdR}></td>
                          <td style={{ ...S.tdR, fontWeight: 700 }}>{money.format(resultado.icms.totalEstimadoPagar)}</td>
                          <td style={S.td}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <AlertaBox mensagens={resultado.icms.alertas} />
                </div>
              </div>
            )}

            {/* Aba: Alertas */}
            {abaAtiva === 'alertas' && (
              <div style={S.card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Alertas e limitações do cálculo</div>
                {[
                  ...resultado.alertasGerais,
                  ...resultado.consolidacao.alertas,
                  ...resultado.lucroPresumido.alertas,
                  ...resultado.lucroReal.alertas,
                  ...resultado.icms.alertas,
                  ...resultado.icms.porMes.flatMap(m => m.alertas),
                ].filter(Boolean).map((msg, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--af-border)', fontSize: 13, color: 'var(--af-text-soft)' }}>
                    <Info size={14} style={{ flexShrink: 0, color: '#d97706', marginTop: 1 }} />
                    {msg}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function MetricaCard({ label, valor, sub, alerta, destaque }: {
  label: string; valor: string; sub?: string; alerta?: boolean; destaque?: boolean
}) {
  return (
    <div style={{
      background: destaque ? 'var(--af-primary-soft)' : 'var(--af-surface)',
      border: `1px solid ${alerta ? '#dc262666' : destaque ? 'var(--af-primary)' : 'var(--af-border)'}`,
      borderRadius: 14, padding: '16px 18px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: alerta ? '#dc2626' : destaque ? 'var(--af-primary)' : 'var(--af-text)', letterSpacing: '-0.02em' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--af-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function PainelPremissas({ premissas, onChange }: { premissas: PremissesCenario; onChange: (p: PremissesCenario) => void }) {
  const upd = useCallback((partial: Partial<PremissesCenario>) => {
    onChange({ ...premissas, ...partial })
  }, [premissas, onChange])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
      {/* Geral */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--af-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Geral</div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Nome do cenário</label>
          <input value={premissas.nomeCenario} onChange={e => upd({ nomeCenario: e.target.value })} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Tipo predominante</label>
          <select value={premissas.tipoPredominante} onChange={e => upd({ tipoPredominante: e.target.value as TipoPredominante })} style={S.select}>
            <option value="comercio">Comércio / Revenda</option>
            <option value="industria">Indústria / Fabricação</option>
            <option value="servico">Serviços</option>
            <option value="misto">Misto</option>
          </select>
        </div>
      </div>

      {/* Lucro Presumido */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--af-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lucro Presumido</div>
        {([
          ['% IRPJ Comércio/Indústria', 'percentualIrpjComercio'],
          ['% IRPJ Serviços', 'percentualIrpjServico'],
          ['% CSLL Comércio/Indústria', 'percentualCsllComercio'],
          ['% CSLL Serviços', 'percentualCsllServico'],
        ] as [string, keyof PremissesCenario['lucroPresumido']][]).map(([lbl, key]) => (
          <div key={key} style={{ marginBottom: 8 }}>
            <label style={S.label}>{lbl}</label>
            <input
              type="number" step="0.01" min="0" max="1"
              value={premissas.lucroPresumido[key]}
              onChange={e => upd({ lucroPresumido: { ...premissas.lucroPresumido, [key]: parseFloat(e.target.value) || 0 } })}
              style={S.input}
            />
          </div>
        ))}
      </div>

      {/* Lucro Real */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--af-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lucro Real — premissas de custo</div>
        {([
          ['CMV / Custo sobre Receita', 'cmvSobreReceita'],
          ['Despesas Operacionais sobre Receita', 'despesasOperacionaisSobreReceita'],
          ['Folha sobre Receita', 'folhaSobreReceita'],
          ['Outras Deduções sobre Receita', 'outrasDeducoesSobreReceita'],
        ] as [string, keyof PremissesCenario['lucroReal']][]).map(([lbl, key]) => (
          <div key={key} style={{ marginBottom: 8 }}>
            <label style={S.label}>{lbl}</label>
            <input
              type="number" step="0.01" min="0" max="1"
              value={premissas.lucroReal[key]}
              onChange={e => upd({ lucroReal: { ...premissas.lucroReal, [key]: parseFloat(e.target.value) || 0 } })}
              style={S.input}
            />
          </div>
        ))}
        <div style={{ marginBottom: 8 }}>
          <label style={S.label}>Créditos PIS/COFINS estimados (R$ total período)</label>
          <input
            type="number" step="1" min="0"
            value={premissas.lucroReal.creditosPisCofinsEstimados}
            onChange={e => upd({ lucroReal: { ...premissas.lucroReal, creditosPisCofinsEstimados: parseFloat(e.target.value) || 0 } })}
            style={S.input}
          />
        </div>
      </div>

      {/* ICMS */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--af-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ICMS</div>
        <div style={{ marginBottom: 8 }}>
          <label style={S.label}>Alíquota interna (ex: 0.17 para 17%)</label>
          <input type="number" step="0.01" min="0" max="1" value={premissas.icms.aliquotaInternaDefault}
            onChange={e => upd({ icms: { ...premissas.icms, aliquotaInternaDefault: parseFloat(e.target.value) || 0 } })} style={S.input} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={S.label}>Alíquota interestadual Sul/Sudeste (12%)</label>
          <input type="number" step="0.01" min="0" max="1" value={premissas.icms.aliquotaInterestadualSul}
            onChange={e => upd({ icms: { ...premissas.icms, aliquotaInterestadualSul: parseFloat(e.target.value) || 0 } })} style={S.input} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={S.label}>Alíquota interestadual N/NE/CO (7%)</label>
          <input type="number" step="0.01" min="0" max="1" value={premissas.icms.aliquotaInterestadualNorte}
            onChange={e => upd({ icms: { ...premissas.icms, aliquotaInterestadualNorte: parseFloat(e.target.value) || 0 } })} style={S.input} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={S.label}>UF da empresa</label>
          <input value={premissas.icms.ufEmpresa} maxLength={2}
            onChange={e => upd({ icms: { ...premissas.icms, ufEmpresa: e.target.value.toUpperCase() } })} style={S.input} />
        </div>
        <div>
          <label style={S.label}>Modo ICMS</label>
          <select value={premissas.icms.modo} onChange={e => upd({ icms: { ...premissas.icms, modo: e.target.value as ModoIcms } })} style={S.select}>
            <option value="apenas_real">Apenas dados reais destacados</option>
            <option value="simular_faltantes">Simular quando faltar dado real</option>
            <option value="conservador">Conservador (glosar créditos duvidosos)</option>
          </select>
        </div>
      </div>
    </div>
  )
}
