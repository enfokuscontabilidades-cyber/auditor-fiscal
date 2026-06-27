'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Building2, FileSearch, TriangleAlert, ClipboardList, Calculator,
  ArrowRight, TrendingUp, TrendingDown, AlertOctagon, AlertTriangle,
  CheckCircle2, BarChart3, Package, Users, FileText, Receipt, Search,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import PageHeader from '@/components/ui/PageHeader'
import GlassCard from '@/components/ui/GlassCard'
import MetricCard from '@/components/ui/MetricCard'
import EmptyState from '@/components/ui/EmptyState'
import ModalCnpj, { type CnpjDados } from '@/components/ModalCnpj'

// ─── Tipos locais ──────────────────────────────────────────────────────────────

type DadoMensal = {
  competencia: string
  total_entrada: number
  total_saida: number
  count_entrada: number
  count_saida: number
}

type TopItem = {
  descricao?: string
  ncm?: string
  nome?: string
  cnpj?: string
  cfop?: string
  tipo?: string
  valor_total: number
  count?: number
  participacao?: number
}

type SessaoRecente = {
  id: string
  competencia: string | null
  created_at: string
  empresa?: { razao_social: string } | { razao_social: string }[] | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmoe(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmoe2(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function competenciaLabel(comp: string) {
  // "2025-01" → "Jan/25"
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const parts = comp.split('-')
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10) - 1
    return `${meses[m] ?? parts[1]}/${parts[0].slice(2)}`
  }
  return comp
}

// ─── Tooltip customizado ───────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--af-surface)',
      border: '1px solid var(--af-border)',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: 'var(--af-shadow-sm)',
      fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--af-text)', margin: '0 0 6px' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: '2px 0', color: p.fill }}>
          {p.name}: {fmoe2(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = createClient()
  const { empresaAtiva } = useEmpresaAtiva()

  const [dadosMensais, setDadosMensais]         = useState<DadoMensal[]>([])
  const [topProdutos, setTopProdutos]           = useState<TopItem[]>([])
  const [topFornecedores, setTopFornecedores]   = useState<TopItem[]>([])
  const [topCfops, setTopCfops]                 = useState<TopItem[]>([])
  const [alertas, setAlertas]                   = useState<{ nivel_risco: string }[]>([])
  const [sessoes, setSessoes]                   = useState<SessaoRecente[]>([])
  const [loading, setLoading]                   = useState(false)

  // ── Consulta CNPJ ────────────────────────────────────────────────────────────
  const [cnpjInput,   setCnpjInput]   = useState('')
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjDados,   setCnpjDados]   = useState<CnpjDados | null>(null)
  const [cnpjErro,    setCnpjErro]    = useState('')
  const [cnpjModal,   setCnpjModal]   = useState(false)

  const carregarDados = useCallback(async (empresaId: string) => {
    setLoading(true)
    try {
      const mensalRes = await fetch(`/api/relatorios/documentos?empresa_id=${empresaId}&meses=6`).then(r => r.json())
      const dadosMensaisCarregados = Array.isArray(mensalRes) ? mensalRes as DadoMensal[] : []
      const competencias = dadosMensaisCarregados
        .map(item => item.competencia)
        .filter((competencia): competencia is string => Boolean(competencia))

      const periodo = new URLSearchParams({ empresa_id: empresaId })
      if (competencias.length > 0) {
        periodo.set('competencia_inicio', competencias[0])
        periodo.set('competencia_fim', competencias[competencias.length - 1])
      }

      const [produtosRes, fornecedoresRes, cfopsRes, alertasRes, sessoesRes] = await Promise.all([
        competencias.length > 0 ? fetch(`/api/relatorios/produtos?${periodo.toString()}&limit=8`).then(r => r.json()) : Promise.resolve([]),
        competencias.length > 0 ? fetch(`/api/relatorios/participantes?${periodo.toString()}&tipo=entrada&limit=6`).then(r => r.json()) : Promise.resolve([]),
        competencias.length > 0 ? fetch(`/api/relatorios/cfop?${periodo.toString()}`).then(r => r.json()) : Promise.resolve([]),
        supabase.from('fa_alertas').select('nivel_risco').eq('empresa_id', empresaId).eq('status', 'aberto'),
        supabase
          .from('fa_sessoes_analise')
          .select('id, competencia, created_at, empresa:empresas(razao_social)')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      setDadosMensais(dadosMensaisCarregados)
      setTopProdutos(Array.isArray(produtosRes) ? produtosRes : [])
      setTopFornecedores(Array.isArray(fornecedoresRes) ? fornecedoresRes : [])
      setTopCfops(Array.isArray(cfopsRes) ? [...cfopsRes].sort((a, b) => Number(b.valor_total ?? 0) - Number(a.valor_total ?? 0)).slice(0, 8) : [])
      setAlertas(alertasRes.data ?? [])
      setSessoes((sessoesRes.data ?? []) as SessaoRecente[])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!empresaAtiva?.id) {
        setDadosMensais([]); setTopProdutos([]); setTopFornecedores([])
        setTopCfops([]); setAlertas([]); setSessoes([])
        return
      }
      void carregarDados(empresaAtiva.id)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [empresaAtiva?.id, carregarDados])

  // ── Handlers de consulta CNPJ ────────────────────────────────────────────────
  function handleCnpjChange(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 14)
    let masked = digits
    if (digits.length > 12)      masked = digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, '$1.$2.$3/$4-$5')
    else if (digits.length > 8)  masked = digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4}).*/, '$1.$2.$3/$4')
    else if (digits.length > 5)  masked = digits.replace(/^(\d{2})(\d{3})(\d{0,3}).*/, '$1.$2.$3')
    else if (digits.length > 2)  masked = digits.replace(/^(\d{2})(\d{0,3}).*/, '$1.$2')
    setCnpjInput(masked)
  }

  async function handleConsultarCnpj() {
    const digits = cnpjInput.replace(/\D/g, '')
    if (digits.length !== 14) { setCnpjErro('CNPJ deve ter 14 dígitos'); return }
    setCnpjErro('')
    setCnpjLoading(true)
    try {
      const r = await fetch(`/api/cnpj-cache?cnpj=${digits}`)
      if (!r.ok) { const e = await r.json(); setCnpjErro(e.error || `Erro ${r.status}`) }
      else { const dados = await r.json(); setCnpjDados(dados); setCnpjModal(true) }
    } catch { setCnpjErro('Falha ao conectar. Tente novamente.') }
    finally { setCnpjLoading(false) }
  }

  // ── KPIs do mês atual ────────────────────────────────────────────────────────
  const mesAtual = dadosMensais[dadosMensais.length - 1]
  const mesAtualLabel = mesAtual ? competenciaLabel(mesAtual.competencia) : null
  const totalEntradaAtual = mesAtual?.total_entrada ?? 0
  const totalSaidaAtual   = mesAtual?.total_saida   ?? 0
  const totalAlertasAbertos = alertas.length
  const porNivel = (n: string) => alertas.filter(a => a.nivel_risco === n).length

  const quickLinks = [
    { href: '/auditor_fiscal',    label: 'Auditor SPED',    desc: 'Cruzar Fiscal e Contribuições', icon: FileSearch },
    { href: '/validador_entradas',label: 'Validador NF-e',  desc: 'Conferir XML, CFOP e NCM',       icon: FileText },
    { href: '/inconsistencias',   label: 'Relatórios',      desc: 'Relatórios e inconsistências',    icon: BarChart3 },
    { href: '/empresas',          label: 'Empresas',        desc: 'Cadastro e empresa ativa',        icon: Building2 },
    { href: '/simples_nacional',  label: 'Simples Nacional',desc: 'Apuração e confronto PGDAS',      icon: Receipt },
    { href: '/obrigacoes',        label: 'Obrigações',      desc: 'REINF, DCTFWeb e eSocial',        icon: ClipboardList },
    { href: '/planejamento',      label: 'Planejamento',    desc: 'Regimes e reforma tributária',    icon: Calculator },
  ]

  const S: Record<string, React.CSSProperties> = {
    page:      { padding: '30px 36px 56px', color: 'var(--af-text)', width: '100%' },
    grid3:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 },
    grid2:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, marginBottom: 20 },
    rankItem:  { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--af-border-soft)' },
    rankIndex: { fontSize: 11, fontWeight: 800, color: 'var(--af-muted)', width: 20, textAlign: 'right' as const, flexShrink: 0 },
    rankName:  { flex: 1, minWidth: 0, fontSize: 13, color: 'var(--af-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    rankVal:   { fontSize: 13, fontWeight: 700, color: 'var(--af-primary)', flexShrink: 0 },
    cfopRow:   { display: 'grid', gridTemplateColumns: '80px 1fr 120px 60px', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--af-border-soft)', fontSize: 12 },
    table:     { width: '100%', borderCollapse: 'collapse' as const },
    th:        { padding: '11px 16px', fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--af-muted)', borderBottom: '1px solid var(--af-border)', textAlign: 'left' as const, background: 'var(--af-surface-2)' },
    td:        { padding: '11px 16px', fontSize: 13, color: 'var(--af-text-soft)', borderBottom: '1px solid var(--af-border)' },
    quick:     { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', border: '1px solid var(--af-border)', borderRadius: 12, textDecoration: 'none', color: 'var(--af-text)', background: 'var(--af-surface-2)', transition: 'all .15s' },
    quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 },
    sectionRow:{ display: 'flex', gap: 18, marginBottom: 20 },
  }

  // ── Sem empresa selecionada ──────────────────────────────────────────────────
  if (!empresaAtiva) {
    return (
      <div style={S.page}>
        <PageHeader
          title="Painel Fiscal"
          subtitle="Selecione uma empresa para visualizar o painel analítico."
        />

        {/* ── Card consulta CNPJ ─────────────────────────────────────────────── */}
        <GlassCard style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Search size={15} color="var(--af-primary)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--af-text)' }}>Consultar CNPJ</span>
            <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>Receita Federal · Dados cadastrais</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={cnpjInput}
              onChange={e => handleCnpjChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConsultarCnpj()}
              placeholder="Digite o CNPJ da empresa"
              maxLength={18}
              style={{
                background: 'var(--af-surface)', border: '1px solid var(--af-border)',
                borderRadius: 8, color: 'var(--af-text)', fontSize: 13,
                padding: '10px 14px', outline: 'none',
                fontFamily: 'var(--font-geist-mono)', flex: 1, minWidth: 180,
              }}
            />
            <button
              onClick={handleConsultarCnpj}
              disabled={cnpjLoading}
              style={{
                background: 'var(--af-primary)', border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 13, fontWeight: 700, padding: '10px 22px',
                cursor: cnpjLoading ? 'wait' : 'pointer', opacity: cnpjLoading ? 0.7 : 1,
              }}
            >
              {cnpjLoading ? 'Consultando…' : 'Consultar'}
            </button>
            <button
              onClick={() => { setCnpjInput(''); setCnpjErro('') }}
              style={{
                background: 'none', border: '1px solid var(--af-border)', borderRadius: 8,
                color: 'var(--af-muted)', fontSize: 13, padding: '10px 16px', cursor: 'pointer',
              }}
            >
              Limpar
            </button>
          </div>
          {cnpjErro && <div style={{ fontSize: 12, color: 'var(--af-danger)', marginTop: 8 }}>{cnpjErro}</div>}
        </GlassCard>

        <GlassCard>
          <EmptyState
            icon={<Building2 size={28} />}
            title="Nenhuma empresa selecionada"
            description="Use o seletor na barra lateral para escolher uma empresa e visualizar o painel com gráficos, indicadores e rankings fiscais."
          />
        </GlassCard>

        {/* Acesso rápido mesmo sem empresa */}
        <div style={{ marginTop: 24 }}>
          <GlassCard title="Acesso rápido">
            <div style={S.quickGrid}>
              {quickLinks.map(({ href, label, desc, icon: Icon }) => (
                <Link key={href} href={href} style={S.quick}>
                  <span className="af-icon-box"><Icon size={17} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 13 }}>{label}</strong>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--af-muted)', marginTop: 1 }}>{desc}</span>
                  </span>
                  <ArrowRight size={14} color="var(--af-muted)" />
                </Link>
              ))}
            </div>
          </GlassCard>
        </div>

        {cnpjModal && cnpjDados && (
          <ModalCnpj dados={cnpjDados} onFechar={() => setCnpjModal(false)} />
        )}
      </div>
    )
  }

  // ── Com empresa selecionada ──────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <PageHeader
        title="Painel Fiscal"
        subtitle={`${empresaAtiva.razao_social}${empresaAtiva.cnpj ? ` · ${empresaAtiva.cnpj}` : ''}`}
      />

      {/* ── Card consulta CNPJ ──────────────────────────────────────────────── */}
      <GlassCard style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Search size={15} color="var(--af-primary)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--af-text)' }}>Consultar CNPJ</span>
          <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>Receita Federal · Dados cadastrais</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={cnpjInput}
            onChange={e => handleCnpjChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConsultarCnpj()}
            placeholder="00.000.000/0000-00"
            maxLength={18}
            style={{
              background: 'var(--af-surface)', border: '1px solid var(--af-border)',
              borderRadius: 7, color: 'var(--af-text)', fontSize: 13,
              padding: '8px 12px', outline: 'none',
              fontFamily: 'var(--font-geist-mono)', flex: 1, minWidth: 180,
            }}
          />
          <button
            onClick={handleConsultarCnpj}
            disabled={cnpjLoading}
            style={{
              background: 'var(--af-primary)', border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 13, fontWeight: 700, padding: '8px 20px',
              cursor: cnpjLoading ? 'wait' : 'pointer', opacity: cnpjLoading ? 0.7 : 1,
            }}
          >
            {cnpjLoading ? 'Consultando…' : 'Consultar'}
          </button>
          <button
            onClick={() => { setCnpjInput(''); setCnpjErro('') }}
            style={{
              background: 'none', border: '1px solid var(--af-border)', borderRadius: 8,
              color: 'var(--af-muted)', fontSize: 13, padding: '8px 16px', cursor: 'pointer',
            }}
          >
            Limpar
          </button>
        </div>
        {cnpjErro && <div style={{ fontSize: 12, color: 'var(--af-danger)', marginTop: 8 }}>{cnpjErro}</div>}
      </GlassCard>

      {/* KPIs do mês atual */}
      <div style={S.grid3}>
        <MetricCard
          label="Entradas (mês atual)"
          value={loading ? '…' : fmoe(totalEntradaAtual)}
          sub={mesAtual ? `${mesAtualLabel} considerado como mes atual - ${mesAtual.count_entrada ?? 0} documentos` : 'sem dados'}
          color="var(--af-primary)"
          icon={<TrendingDown size={13} />}
          accentBorder
        />
        <MetricCard
          label="Saídas (mês atual)"
          value={loading ? '…' : fmoe(totalSaidaAtual)}
          sub={mesAtual ? `${mesAtualLabel} considerado como mes atual - ${mesAtual.count_saida ?? 0} documentos` : 'sem dados'}
          color="var(--af-accent)"
          icon={<TrendingUp size={13} />}
          accentBorder
        />
        <MetricCard
          label="Alertas abertos"
          value={loading ? '…' : String(totalAlertasAbertos)}
          sub={`${porNivel('critico') + porNivel('alto')} crítico/alto · ${porNivel('medio')} médio`}
          color={totalAlertasAbertos > 0 ? 'var(--af-danger)' : 'var(--af-success)'}
          icon={<AlertOctagon size={13} />}
          accentBorder
        />
      </div>

      {/* Gráfico: Entradas × Saídas últimos 6 meses */}
      <GlassCard title="Entradas × Saídas — últimos 6 meses" style={{ marginBottom: 20 }}>
        {loading ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
        ) : dadosMensais.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={24} />}
            title="Sem dados para exibir"
            description="Importe XMLs de NF-e ou SPEDs para visualizar o gráfico de movimentação mensal."
            style={{ padding: '32px 24px' }}
          />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dadosMensais.map(d => ({
              ...d,
              competencia: competenciaLabel(d.competencia),
            }))} barGap={4} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--af-border-soft)" vertical={false} />
              <XAxis dataKey="competencia" tick={{ fontSize: 11, fill: 'var(--af-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmoe(v as number)} tick={{ fontSize: 10, fill: 'var(--af-muted)' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="total_entrada" name="Entradas" fill="var(--af-primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total_saida"   name="Saídas"   fill="var(--af-accent)"   radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* Rankings: Produtos + Fornecedores */}
      <div style={S.grid2}>
        <GlassCard title="Top Produtos" titleRight={<span style={{ fontSize: 11, color: 'var(--af-muted)' }}>por valor</span>}>
          {loading ? (
            <div style={{ color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : topProdutos.length === 0 ? (
            <EmptyState icon={<Package size={20} />} title="Sem dados" style={{ padding: '20px 0' }} />
          ) : (
            topProdutos.map((p, i) => (
              <div key={i} style={S.rankItem}>
                <span style={S.rankIndex}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...S.rankName, fontWeight: 600 }}>{p.descricao || '—'}</p>
                  {p.ncm && <p style={{ fontSize: 11, color: 'var(--af-muted)', margin: '1px 0 0' }}>NCM {p.ncm}</p>}
                </div>
                <span style={S.rankVal}>{fmoe(p.valor_total)}</span>
              </div>
            ))
          )}
        </GlassCard>

        <GlassCard title="Top Fornecedores" titleRight={<span style={{ fontSize: 11, color: 'var(--af-muted)' }}>por valor de compra</span>}>
          {loading ? (
            <div style={{ color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : topFornecedores.length === 0 ? (
            <EmptyState icon={<Users size={20} />} title="Sem dados" style={{ padding: '20px 0' }} />
          ) : (
            topFornecedores.map((f, i) => (
              <div key={i} style={S.rankItem}>
                <span style={S.rankIndex}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...S.rankName, fontWeight: 600 }}>{f.nome || f.cnpj || '—'}</p>
                  {f.cnpj && f.nome && <p style={{ fontSize: 11, color: 'var(--af-muted)', margin: '1px 0 0' }}>CNPJ {f.cnpj}</p>}
                </div>
                <span style={S.rankVal}>{fmoe(f.valor_total)}</span>
              </div>
            ))
          )}
        </GlassCard>
      </div>

      {/* CFOPs mais utilizados + Alertas por nível */}
      <div style={S.grid2}>
        <GlassCard title="CFOPs mais utilizados" padding="0">
          {loading ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : topCfops.length === 0 ? (
            <EmptyState icon={<BarChart3 size={20} />} title="Sem dados" style={{ padding: '20px 0' }} />
          ) : (
            <>
              <div style={{ ...S.cfopRow, padding: '8px 20px', background: 'var(--af-surface-2)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--af-muted)' }}>
                <span>CFOP</span>
                <span>Tipo</span>
                <span style={{ textAlign: 'right' }}>Valor</span>
                <span style={{ textAlign: 'right' }}>Part. %</span>
              </div>
              {topCfops.map((c, i) => (
                <div key={i} style={{ ...S.cfopRow, padding: '8px 20px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--af-primary)', fontSize: 13 }}>{c.cfop}</span>
                  <span style={{ fontSize: 11, color: 'var(--af-muted)', textTransform: 'capitalize' }}>{c.tipo ?? '—'}</span>
                  <span style={{ textAlign: 'right' as const, fontWeight: 600 }}>{fmoe(c.valor_total)}</span>
                  <span style={{ textAlign: 'right' as const, color: 'var(--af-muted)', fontSize: 11 }}>{c.participacao?.toFixed(1) ?? '—'}%</span>
                </div>
              ))}
            </>
          )}
        </GlassCard>

        <GlassCard title="Alertas por nível">
          {[
            { label: 'Crítico', cor: 'var(--af-danger)', qt: porNivel('critico'), icon: <AlertOctagon size={15} /> },
            { label: 'Alto',    cor: 'var(--af-warning)',qt: porNivel('alto'),    icon: <AlertTriangle size={15} /> },
            { label: 'Médio',   cor: 'var(--af-warning)',qt: porNivel('medio'),   icon: <AlertTriangle size={15} /> },
            { label: 'Baixo',   cor: 'var(--af-success)', qt: porNivel('baixo'),  icon: <CheckCircle2 size={15} /> },
          ].map(({ label, cor, qt, icon }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--af-border-soft)' }}>
              <span style={{ color: cor }}>{icon}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: cor }}>{qt}</span>
              <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>alerta{qt !== 1 ? 's' : ''}</span>
            </div>
          ))}
          {totalAlertasAbertos > 0 && (
            <div style={{ marginTop: 12 }}>
              <Link href="/inconsistencias" style={{ fontSize: 13, color: 'var(--af-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                Ver todos os alertas <ArrowRight size={13} />
              </Link>
            </div>
          )}
          {totalAlertasAbertos === 0 && !loading && (
            <p style={{ fontSize: 13, color: 'var(--af-success)', marginTop: 8 }}>✓ Nenhum alerta aberto</p>
          )}
        </GlassCard>
      </div>

      {/* Sessões recentes + Acesso rápido */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)', gap: 18, marginBottom: 20 }}>
        <GlassCard title="Sessões recentes">
          {sessoes.length === 0 ? (
            <EmptyState title="Sem sessões" description="Nenhuma sessão registrada para esta empresa." style={{ padding: '20px 0' }} />
          ) : (
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Competência</th>
                <th style={S.th}>Data</th>
              </tr></thead>
              <tbody>
                {sessoes.map((s) => (
                  <tr key={s.id}>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-text)' }}>{s.competencia ?? '—'}</td>
                    <td style={S.td}>{new Date(s.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>

        <GlassCard title="Acesso rápido">
          <div style={S.quickGrid}>
            {quickLinks.map(({ href, label, desc, icon: Icon }) => (
              <Link key={href} href={href} style={S.quick}>
                <span className="af-icon-box"><Icon size={16} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 13 }}>{label}</strong>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--af-muted)', marginTop: 1 }}>{desc}</span>
                </span>
                <ArrowRight size={13} color="var(--af-muted)" />
              </Link>
            ))}
          </div>
        </GlassCard>
      </div>

      {cnpjModal && cnpjDados && (
        <ModalCnpj dados={cnpjDados} onFechar={() => setCnpjModal(false)} />
      )}
    </div>
  )
}
