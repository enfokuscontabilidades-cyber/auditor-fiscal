'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AlertaFiscal } from '@/lib/types'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import { ChevronDown, ChevronUp, Building2, TriangleAlert, Package, Users, BarChart3, Hash } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import GlassCard from '@/components/ui/GlassCard'
import EmptyState from '@/components/ui/EmptyState'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type AbaRelatorio = 'inconsistencias' | 'documentos' | 'produtos' | 'participantes' | 'cfop' | 'ncm'

type DadoMensal = {
  competencia: string
  total_entrada: number
  total_saida: number
  count_entrada: number
  count_saida: number
}

type TopProduto = { descricao: string; ncm: string; valor_total: number; quantidade: number; count: number }
type Participante = { cnpj: string; nome: string; valor_total: number; count: number; _cnpj_cache?: Record<string, unknown> }
type CfopItem = { cfop: string; tipo: string; valor_total: number; quantidade: number; count: number; participacao: number }
type NcmItem = { ncm: string; descricao_exemplo: string; valor_total: number; quantidade: number; participacao: number; count_produtos?: number }

// ─── Constantes alertas ────────────────────────────────────────────────────────

const NIVEIS  = ['', 'critico', 'alto', 'medio', 'baixo']
const STATUS  = ['', 'aberto', 'em_analise', 'resolvido', 'descartado']

const COR_NIVEL: Record<string, string> = {
  critico: 'var(--af-danger)',
  alto:    'var(--af-warning)',
  medio:   'var(--af-warning)',
  baixo:   'var(--af-success)',
}

const LABEL_NIVEL: Record<string, string> = {
  critico: 'Crítico', alto: 'Alto', medio: 'Médio', baixo: 'Baixo',
}

const LABEL_STATUS: Record<string, string> = {
  aberto: 'Aberto', em_analise: 'Em análise', resolvido: 'Resolvido', descartado: 'Descartado',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmoe(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function competenciaLabel(comp: string) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const parts = comp.split('-')
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10) - 1
    return `${meses[m] ?? parts[1]}/${parts[0].slice(2)}`
  }
  return comp
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const supabase = createClient()
  const { empresaAtiva: empresa } = useEmpresaAtiva()

  // Estado de navegação
  const [abaAtiva, setAbaAtiva] = useState<AbaRelatorio>('inconsistencias')

  // Filtros compartilhados
  const [compInicio, setCompInicio] = useState('')
  const [compFim,    setCompFim]    = useState('')
  const [tipoMov,    setTipoMov]    = useState('') // '' = ambos, 'entrada', 'saida'

  // Estado aba Inconsistências (mantido intacto)
  const [alertas,       setAlertas]      = useState<AlertaFiscal[]>([])
  const [loadingAlert,  setLoadingAlert] = useState(true)
  const [filtroNivel,   setFiltroNivel]  = useState('')
  const [filtroStatus,  setFiltroStatus] = useState('aberto')
  const [expandido,     setExpandido]    = useState<string | null>(null)

  // Estado abas de relatórios
  const [dadosMensais,      setDadosMensais]      = useState<DadoMensal[]>([])
  const [topProdutos,       setTopProdutos]       = useState<TopProduto[]>([])
  const [participantes,     setParticipantes]     = useState<Participante[]>([])
  const [tipoParticipante,  setTipoParticipante]  = useState<'entrada' | 'saida'>('entrada')
  const [cfops,             setCfops]             = useState<CfopItem[]>([])
  const [ncms,              setNcms]              = useState<NcmItem[]>([])
  const [loadingRel,        setLoadingRel]        = useState(false)

  // CNPJ cache (para aba participantes)
  const [cnpjCache, setCnpjCache] = useState<Record<string, { status: 'carregando' | 'ok' | 'erro'; dados?: Record<string, unknown> }>>({})

  // ── Carregar alertas ────────────────────────────────────────────────────────

  const carregarAlertas = useCallback(async () => {
    setLoadingAlert(true)
    let query = supabase
      .from('fa_alertas')
      .select('*, empresa:empresas(razao_social)')
      .order('nivel_risco', { ascending: true })
      .order('created_at', { ascending: false })

    if (empresa?.id) query = query.eq('empresa_id', empresa.id)
    if (filtroNivel)  query = query.eq('nivel_risco', filtroNivel)
    if (filtroStatus) query = query.eq('status', filtroStatus)

    const { data } = await query
    setAlertas((data as AlertaFiscal[]) ?? [])
    setLoadingAlert(false)
  }, [empresa?.id, filtroNivel, filtroStatus, supabase])

  useEffect(() => {
    if (abaAtiva === 'inconsistencias') carregarAlertas()
  }, [abaAtiva, carregarAlertas])

  // ── Carregar relatório ──────────────────────────────────────────────────────

  const carregarRelatorio = useCallback(async () => {
    if (!empresa?.id || abaAtiva === 'inconsistencias') return
    setLoadingRel(true)

    const params = new URLSearchParams({ empresa_id: empresa.id })
    if (compInicio) params.set('competencia_inicio', compInicio)
    if (compFim)    params.set('competencia_fim', compFim)
    if (tipoMov)    params.set('tipo_movimento', tipoMov)

    try {
      if (abaAtiva === 'documentos') {
        const r = await fetch(`/api/relatorios/documentos?${params}&meses=24`).then(r => r.json())
        setDadosMensais(Array.isArray(r) ? r : [])
      } else if (abaAtiva === 'produtos') {
        const p = new URLSearchParams(params)
        p.set('limit', '50')
        const r = await fetch(`/api/relatorios/produtos?${p}`).then(r => r.json())
        setTopProdutos(Array.isArray(r) ? r : [])
      } else if (abaAtiva === 'participantes') {
        const p = new URLSearchParams(params)
        p.set('tipo', tipoParticipante)
        p.set('limit', '50')
        const r = await fetch(`/api/relatorios/participantes?${p}`).then(r => r.json())
        setParticipantes(Array.isArray(r) ? r : [])
      } else if (abaAtiva === 'cfop') {
        const r = await fetch(`/api/relatorios/cfop?${params}`).then(r => r.json())
        setCfops(Array.isArray(r) ? r : [])
      } else if (abaAtiva === 'ncm') {
        const p = new URLSearchParams(params)
        p.set('limit', '30')
        const r = await fetch(`/api/relatorios/ncm?${p}`).then(r => r.json())
        setNcms(Array.isArray(r) ? r : [])
      }
    } finally {
      setLoadingRel(false)
    }
  }, [empresa?.id, abaAtiva, compInicio, compFim, tipoMov, tipoParticipante])

  useEffect(() => {
    carregarRelatorio()
  }, [carregarRelatorio])

  // ── Consultar CNPJ cache ────────────────────────────────────────────────────

  const consultarCnpj = useCallback(async (cnpj: string) => {
    if (cnpjCache[cnpj]) return
    setCnpjCache(prev => ({ ...prev, [cnpj]: { status: 'carregando' } }))
    try {
      const r = await fetch(`/api/cnpj-cache?cnpj=${cnpj.replace(/\D/g, '')}`)
      if (r.ok) {
        const dados = await r.json()
        setCnpjCache(prev => ({ ...prev, [cnpj]: { status: 'ok', dados } }))
      } else {
        setCnpjCache(prev => ({ ...prev, [cnpj]: { status: 'erro' } }))
      }
    } catch {
      setCnpjCache(prev => ({ ...prev, [cnpj]: { status: 'erro' } }))
    }
  }, [cnpjCache])

  // ── Atualizar status de alerta ──────────────────────────────────────────────

  async function atualizarStatus(id: string, status: string) {
    await supabase.from('fa_alertas').update({ status }).eq('id', id)
    carregarAlertas()
  }

  // ── Estilos ─────────────────────────────────────────────────────────────────

  const fcnpj = (v: string) =>
    v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

  const S: Record<string, React.CSSProperties> = {
    page:      { padding: '30px 36px 64px', color: 'var(--af-text)', width: '100%' },
    tabBar:    { display: 'flex', borderBottom: '2px solid var(--af-border)', marginBottom: 24, gap: 0, flexWrap: 'wrap' as const },
    filterRow: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' },
    input:     { background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 7, color: 'var(--af-text)', fontSize: 12, padding: '7px 10px', outline: 'none' },
    select:    { background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 7, color: 'var(--af-text)', fontSize: 12, padding: '7px 10px', outline: 'none', cursor: 'pointer' },
    table:     { width: '100%', borderCollapse: 'collapse' as const },
    th:        { padding: '11px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--af-muted)', borderBottom: '1px solid var(--af-border)', textAlign: 'left' as const, background: 'var(--af-surface-2)' },
    td:        { padding: '11px 14px', fontSize: 13, color: 'var(--af-text-soft)', borderBottom: '1px solid var(--af-border)' },
    btnAplicar:{ background: 'var(--af-primary)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 18px', cursor: 'pointer' },
  }

  function tabStyle(aba: AbaRelatorio): React.CSSProperties {
    const ativo = abaAtiva === aba
    return {
      background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: ativo ? 700 : 500,
      color: ativo ? 'var(--af-primary)' : 'var(--af-muted)',
      borderBottom: ativo ? '2px solid var(--af-primary)' : '2px solid transparent',
      padding: '10px 16px', marginBottom: -2, whiteSpace: 'nowrap' as const,
    }
  }

  function chipNivel(nivel: string): React.CSSProperties {
    const cor = COR_NIVEL[nivel] ?? 'var(--af-text)'
    return { background: `${cor}1a`, color: cor, border: `1px solid ${cor}44`, borderRadius: 5, fontSize: 10, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }
  }

  function btnAcao(cor: string): React.CSSProperties {
    return { background: `${cor}15`, border: `1px solid ${cor}40`, borderRadius: 6, color: cor, fontSize: 11, fontWeight: 600, padding: '5px 13px', cursor: 'pointer' }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const ABAS: { key: AbaRelatorio; label: string; icon: React.ReactNode }[] = [
    { key: 'inconsistencias', label: 'Inconsistências', icon: <TriangleAlert size={13} /> },
    { key: 'documentos',      label: 'Documentos',      icon: <BarChart3 size={13} /> },
    { key: 'produtos',        label: 'Produtos',         icon: <Package size={13} /> },
    { key: 'participantes',   label: 'Participantes',    icon: <Users size={13} /> },
    { key: 'cfop',            label: 'CFOP',             icon: <Hash size={13} /> },
    { key: 'ncm',             label: 'NCM',              icon: <Hash size={13} /> },
  ]

  return (
    <div style={S.page}>
      <PageHeader
        title="Relatórios"
        subtitle="Gere relatórios fiscais, cadastrais e gerenciais com base nos XMLs, SPEDs e apurações importadas."
      />

      {/* Barra de abas */}
      <div style={S.tabBar}>
        {ABAS.map(({ key, label, icon }) => (
          <button key={key} style={tabStyle(key)} onClick={() => setAbaAtiva(key)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {label}</span>
          </button>
        ))}
      </div>

      {/* ── ABA: INCONSISTÊNCIAS ──────────────────────────────────────────────── */}
      {abaAtiva === 'inconsistencias' && (
        <>
          {/* Filtros alertas */}
          <div style={S.filterRow}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Filtrar por</span>
            <select style={S.select} value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)}>
              <option value="">Todos os níveis</option>
              {NIVEIS.slice(1).map(n => <option key={n} value={n}>{LABEL_NIVEL[n] ?? n}</option>)}
            </select>
            <select style={S.select} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {STATUS.slice(1).map(s => <option key={s} value={s}>{LABEL_STATUS[s]}</option>)}
            </select>
            {!loadingAlert && (
              <span style={{ fontSize: 12, color: 'var(--af-muted)', marginLeft: 4 }}>
                {alertas.length} resultado{alertas.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {!empresa && (
            <GlassCard style={{ marginBottom: 16 }}>
              <EmptyState icon={<Building2 size={22} />} title="Nenhuma empresa selecionada" description="Selecione uma empresa na barra lateral para filtrar os alertas." />
            </GlassCard>
          )}

          {loadingAlert && <div style={{ color: 'var(--af-muted)', fontSize: 13 }}>Carregando alertas...</div>}

          {!loadingAlert && alertas.length === 0 && (
            <GlassCard>
              <EmptyState title="Nenhum alerta encontrado" description="Não há alertas com os filtros selecionados." />
            </GlassCard>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alertas.map(a => {
              const cor = COR_NIVEL[a.nivel_risco] ?? 'var(--af-text)'
              const aberto = expandido === a.id
              return (
                <div key={a.id} style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderLeft: `3px solid ${cor}`, borderRadius: '0 8px 8px 0', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', justifyContent: 'space-between' }} onClick={() => setExpandido(aberto ? null : a.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <span style={chipNivel(a.nivel_risco)}>{LABEL_NIVEL[a.nivel_risco] ?? a.nivel_risco}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--af-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{a.titulo}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--af-muted)', whiteSpace: 'nowrap' as const }}>
                        {(a.empresa as { razao_social?: string } | undefined)?.razao_social ?? ''}{a.competencia ? ` · ${a.competencia}` : ''}
                      </span>
                      {aberto ? <ChevronUp size={14} color="var(--af-muted)" /> : <ChevronDown size={14} color="var(--af-muted)" />}
                    </div>
                  </div>
                  {aberto && (
                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--af-border)' }} onClick={e => e.stopPropagation()}>
                      <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--af-muted)', lineHeight: 1.55 }}>{a.descricao}</p>
                      {a.valor_impacto !== undefined && a.valor_impacto !== null && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--af-warning)', fontWeight: 600 }}>
                          Impacto estimado: R$ {a.valor_impacto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                      {Object.keys(a.detalhe ?? {}).length > 0 && (
                        <div style={{ marginTop: 10, background: 'var(--af-surface-2)', borderRadius: 6, padding: '10px 12px' }}>
                          <pre style={{ margin: 0, fontFamily: 'var(--font-geist-mono)', fontSize: 11, color: 'var(--af-muted)' }}>{JSON.stringify(a.detalhe, null, 2)}</pre>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        {a.status !== 'em_analise'  && <button style={btnAcao('var(--af-warning)')} onClick={() => atualizarStatus(a.id, 'em_analise')}>Em análise</button>}
                        {a.status !== 'resolvido'   && <button style={btnAcao('var(--af-success)')} onClick={() => atualizarStatus(a.id, 'resolvido')}>Resolvido</button>}
                        {a.status !== 'descartado'  && <button style={btnAcao('var(--af-muted)')}   onClick={() => atualizarStatus(a.id, 'descartado')}>Descartar</button>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── FILTROS COMPARTILHADOS (abas de relatórios) ───────────────────────── */}
      {abaAtiva !== 'inconsistencias' && (
        <>
          <div style={S.filterRow}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Filtros</span>
            <input style={S.input} type="month" placeholder="Competência inicial" value={compInicio} onChange={e => setCompInicio(e.target.value)} title="Competência inicial" />
            <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>até</span>
            <input style={S.input} type="month" placeholder="Competência final" value={compFim} onChange={e => setCompFim(e.target.value)} title="Competência final" />
            <select style={S.select} value={tipoMov} onChange={e => setTipoMov(e.target.value)}>
              <option value="">Entradas e Saídas</option>
              <option value="entrada">Somente Entradas</option>
              <option value="saida">Somente Saídas</option>
            </select>
            <button style={S.btnAplicar} onClick={carregarRelatorio}>Aplicar filtros</button>
          </div>

          {!empresa && (
            <GlassCard>
              <EmptyState icon={<Building2 size={22} />} title="Nenhuma empresa selecionada" description="Selecione uma empresa na barra lateral para gerar relatórios." />
            </GlassCard>
          )}
        </>
      )}

      {/* ── ABA: DOCUMENTOS ──────────────────────────────────────────────────── */}
      {abaAtiva === 'documentos' && empresa && (
        <GlassCard title="Documentos por competência" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : dadosMensais.length === 0 ? (
            <EmptyState title="Sem dados" description="Nenhum documento encontrado com os filtros aplicados." />
          ) : (
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Competência</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Entradas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd. Entradas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Saídas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd. Saídas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Total</th>
              </tr></thead>
              <tbody>
                {dadosMensais.map((d, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{competenciaLabel(d.competencia)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-primary)' }}>{fmoe(d.total_entrada)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{d.count_entrada}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-accent)' }}>{fmoe(d.total_saida)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{d.count_saida}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmoe(d.total_entrada + d.total_saida)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}

      {/* ── ABA: PRODUTOS ────────────────────────────────────────────────────── */}
      {abaAtiva === 'produtos' && empresa && (
        <GlassCard title="Produtos mais movimentados" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : topProdutos.length === 0 ? (
            <EmptyState icon={<Package size={22} />} title="Sem dados" description="Nenhum produto encontrado com os filtros aplicados." />
          ) : (
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Descrição</th>
                <th style={S.th}>NCM</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Ocorrências</th>
              </tr></thead>
              <tbody>
                {topProdutos.map((p, i) => (
                  <tr key={i}>
                    <td style={S.td}>{p.descricao || '—'}</td>
                    <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{p.ncm || '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{p.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: 'var(--af-primary)' }}>{fmoe(p.valor_total)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}

      {/* ── ABA: PARTICIPANTES ───────────────────────────────────────────────── */}
      {abaAtiva === 'participantes' && empresa && (
        <GlassCard
          title={tipoParticipante === 'saida' ? 'Clientes por valor movimentado' : 'Fornecedores por valor movimentado'}
          titleRight={
            <div style={{ display: 'flex', gap: 4 }}>
              {(['entrada', 'saida'] as const).map(t => (
                <button key={t} onClick={() => setTipoParticipante(t)}
                  style={{ border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', cursor: 'pointer',
                    background: tipoParticipante === t ? 'var(--af-primary)' : 'var(--af-surface-2)',
                    color: tipoParticipante === t ? '#fff' : 'var(--af-muted)' }}>
                  {t === 'entrada' ? 'Fornecedores' : 'Clientes'}
                </button>
              ))}
            </div>
          }
          padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : participantes.length === 0 ? (
            <EmptyState icon={<Users size={22} />} title="Sem dados" description="Nenhum participante encontrado com os filtros aplicados." />
          ) : (
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>CNPJ</th>
                <th style={S.th}>Razão Social</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Docs</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={S.th}>Dados Receita</th>
              </tr></thead>
              <tbody>
                {participantes.map((p, i) => {
                  const cache = cnpjCache[p.cnpj]
                  const razaoSocial = (cache?.dados?.razao_social as string) || p.nome || '—'
                  return (
                    <tr key={i}>
                      <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{fcnpj(p.cnpj.replace(/\D/g,''))}</td>
                      <td style={S.td}>{razaoSocial}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{p.count}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: 'var(--af-primary)' }}>{fmoe(p.valor_total)}</td>
                      <td style={S.td}>
                        {!cache && (
                          <button
                            onClick={() => consultarCnpj(p.cnpj)}
                            style={{ background: 'var(--af-primary-soft)', border: '1px solid var(--af-glass-border)', borderRadius: 5, color: 'var(--af-primary)', fontSize: 11, fontWeight: 600, padding: '3px 10px', cursor: 'pointer' }}
                          >
                            Consultar
                          </button>
                        )}
                        {cache?.status === 'carregando' && <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>Consultando…</span>}
                        {cache?.status === 'ok' && (
                          <span style={{ fontSize: 11, color: 'var(--af-success)' }}>
                            {(cache.dados?.estabelecimento as { situacao_cadastral?: { descricao?: string } } | undefined)?.situacao_cadastral?.descricao ?? 'Consultado'}
                          </span>
                        )}
                        {cache?.status === 'erro' && <span style={{ fontSize: 11, color: 'var(--af-danger)' }}>Erro na consulta</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}

      {/* ── ABA: CFOP ────────────────────────────────────────────────────────── */}
      {abaAtiva === 'cfop' && empresa && (
        <GlassCard title="CFOPs utilizados" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : cfops.length === 0 ? (
            <EmptyState icon={<Hash size={22} />} title="Sem dados" description="Nenhum CFOP encontrado com os filtros aplicados." />
          ) : (
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>CFOP</th>
                <th style={S.th}>Tipo</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Itens</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Participação</th>
              </tr></thead>
              <tbody>
                {cfops.map((c, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-primary)', fontFamily: 'var(--font-geist-mono)' }}>{c.cfop}</td>
                    <td style={{ ...S.td, textTransform: 'capitalize' as const }}>{c.tipo}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{c.count.toLocaleString('pt-BR')}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmoe(c.valor_total)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{c.participacao?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}

      {/* ── ABA: NCM ─────────────────────────────────────────────────────────── */}
      {abaAtiva === 'ncm' && empresa && (
        <GlassCard title="NCMs mais movimentados" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : ncms.length === 0 ? (
            <EmptyState icon={<Hash size={22} />} title="Sem dados" description="Nenhum NCM encontrado com os filtros aplicados." />
          ) : (
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>NCM</th>
                <th style={S.th}>Exemplo de produto</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Participação</th>
              </tr></thead>
              <tbody>
                {ncms.map((n, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-primary)', fontFamily: 'var(--font-geist-mono)' }}>{n.ncm || '—'}</td>
                    <td style={{ ...S.td, color: 'var(--af-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{n.descricao_exemplo || '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{n.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmoe(n.valor_total)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{n.participacao?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}
    </div>
  )
}
