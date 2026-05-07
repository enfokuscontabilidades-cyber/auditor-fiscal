'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AlertaFiscal } from '@/lib/types'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import { ChevronDown, ChevronUp } from 'lucide-react'

const NIVEIS = ['', 'critico', 'alto', 'medio', 'baixo']
const STATUS = ['', 'aberto', 'em_analise', 'resolvido', 'descartado']

const COR_NIVEL: Record<string, string> = {
  critico: 'var(--af-danger)',
  alto:    'var(--af-warning)',
  medio:   'var(--af-warning)',
  baixo:   'var(--af-success)',
}

const LABEL_NIVEL: Record<string, string> = {
  critico: 'Crítico',
  alto:    'Alto',
  medio:   'Médio',
  baixo:   'Baixo',
}

const LABEL_STATUS: Record<string, string> = {
  aberto:     'Aberto',
  em_analise: 'Em análise',
  resolvido:  'Resolvido',
  descartado: 'Descartado',
}

export default function InconsistenciasPage() {
  const supabase = createClient()
  const { empresaAtiva: empresa } = useEmpresaAtiva()
  const [alertas, setAlertas] = useState<AlertaFiscal[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroNivel, setFiltroNivel] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('aberto')
  const [expandido, setExpandido] = useState<string | null>(null)

  async function carregarAlertas() {
    setLoading(true)
    let query = supabase
      .from('fa_alertas')
      .select('*, empresa:empresas(razao_social)')
      .order('nivel_risco', { ascending: true })
      .order('created_at', { ascending: false })

    if (empresa?.id) query = query.eq('empresa_id', empresa.id)
    if (filtroNivel) query = query.eq('nivel_risco', filtroNivel)
    if (filtroStatus) query = query.eq('status', filtroStatus)

    const { data } = await query
    setAlertas((data as AlertaFiscal[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { carregarAlertas() }, [empresa?.id, filtroNivel, filtroStatus])

  async function atualizarStatus(id: string, status: string) {
    await supabase.from('fa_alertas').update({ status }).eq('id', id)
    carregarAlertas()
  }

  const selectStyle: React.CSSProperties = {
    background: 'var(--af-surface)',
    border: '1px solid var(--af-border)',
    borderRadius: 7,
    color: 'var(--af-text)',
    fontSize: 12,
    padding: '7px 10px',
    outline: 'none',
    cursor: 'pointer',
  }

  function chipNivel(nivel: string): React.CSSProperties {
    const cor = COR_NIVEL[nivel] ?? 'var(--af-text)'
    return {
      background: `${cor}1a`,
      color: cor,
      border: `1px solid ${cor}44`,
      borderRadius: 5,
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 8px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }
  }

  function btnAcao(cor: string): React.CSSProperties {
    return {
      background: `${cor}15`,
      border: `1px solid ${cor}40`,
      borderRadius: 6,
      color: cor,
      fontSize: 11,
      fontWeight: 600,
      padding: '5px 13px',
      cursor: 'pointer',
    }
  }

  return (
    <div style={{
      padding: '36px 40px 64px',
      fontFamily: 'var(--font-geist-sans)',
      color: 'var(--af-text)',
      maxWidth: 1100,
    }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            Inconsistências
          </h1>
          {!loading && (
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--af-muted)',
              background: 'var(--af-primary-soft)',
              border: '1px solid var(--af-border)',
              borderRadius: 10,
              padding: '1px 8px',
            }}>
              {alertas.length} resultado{alertas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--af-muted)' }}>
          Alertas gerados pelo motor de regras fiscais
        </p>
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 24,
        flexWrap: 'wrap' as const,
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          Filtrar por
        </span>
        <select style={selectStyle} value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)}>
          <option value="">Todos os níveis</option>
          {NIVEIS.slice(1).map(n => (
            <option key={n} value={n}>{LABEL_NIVEL[n] ?? n}</option>
          ))}
        </select>
        <select style={selectStyle} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS.slice(1).map(s => (
            <option key={s} value={s}>{LABEL_STATUS[s]}</option>
          ))}
        </select>
      </div>

      {/* Banner: nenhuma empresa selecionada */}
      {!empresa && (
        <div style={{
          background: 'rgba(39,199,216,0.06)',
          border: '1px solid rgba(39,199,216,0.2)',
          borderRadius: 8,
          padding: '10px 16px',
          fontSize: 13,
          color: 'var(--af-muted)',
          marginBottom: 16,
        }}>
          Selecione uma empresa no seletor acima para filtrar os alertas por empresa.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: 'var(--af-muted)', fontSize: 13, padding: '16px 0' }}>
          Carregando alertas...
        </div>
      )}

      {/* Estado vazio */}
      {!loading && alertas.length === 0 && (
        <div style={{
          background: 'var(--af-primary-soft)',
          border: '1px dashed rgba(39,199,216,0.16)',
          borderRadius: 10,
          padding: '40px 32px',
          textAlign: 'center',
          color: 'var(--af-muted)',
          fontSize: 13,
        }}>
          Nenhum alerta encontrado com os filtros selecionados.
        </div>
      )}

      {/* Lista de alertas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alertas.map(a => {
          const cor = COR_NIVEL[a.nivel_risco] ?? 'var(--af-text)'
          const aberto = expandido === a.id
          return (
            <div
              key={a.id}
              style={{
                background: 'var(--af-surface)',
                border: '1px solid var(--af-primary-soft)',
                borderLeft: `3px solid ${cor}`,
                borderRadius: '0 8px 8px 0',
                overflow: 'hidden',
              }}
            >
              {/* Linha principal */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 16px',
                  cursor: 'pointer',
                  justifyContent: 'space-between',
                }}
                onClick={() => setExpandido(aberto ? null : a.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={chipNivel(a.nivel_risco)}>{LABEL_NIVEL[a.nivel_risco] ?? a.nivel_risco}</span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--af-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const,
                  }}>
                    {a.titulo}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--af-muted)', whiteSpace: 'nowrap' as const }}>
                    {(a.empresa as { razao_social?: string } | undefined)?.razao_social ?? ''}{a.competencia ? ` · ${a.competencia}` : ''}
                  </span>
                  {aberto ? <ChevronUp size={14} color="var(--af-muted)" /> : <ChevronDown size={14} color="var(--af-muted)" />}
                </div>
              </div>

              {/* Detalhes expandidos */}
              {aberto && (
                <div
                  style={{ padding: '0 16px 14px', borderTop: '1px solid var(--af-primary-soft)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--af-muted)', lineHeight: 1.55 }}>
                    {a.descricao}
                  </p>

                  {a.valor_impacto !== undefined && a.valor_impacto !== null && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 10,
                      background: 'rgba(251,191,36,0.08)',
                      border: '1px solid rgba(251,191,36,0.2)',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 12,
                      color: 'var(--af-warning)',
                      fontWeight: 600,
                    }}>
                      Impacto estimado: R$ {a.valor_impacto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  )}

                  {Object.keys(a.detalhe ?? {}).length > 0 && (
                    <div style={{
                      marginTop: 10,
                      background: 'var(--af-surface-2)',
                      borderRadius: 6,
                      padding: '10px 12px',
                      fontSize: 11,
                      color: 'var(--af-muted)',
                    }}>
                      <pre style={{ margin: 0, fontFamily: 'var(--font-geist-mono)', fontSize: 11 }}>
                        {JSON.stringify(a.detalhe, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {a.status !== 'em_analise' && (
                      <button style={btnAcao('var(--af-warning)')} onClick={() => atualizarStatus(a.id, 'em_analise')}>
                        Em análise
                      </button>
                    )}
                    {a.status !== 'resolvido' && (
                      <button style={btnAcao('var(--af-success)')} onClick={() => atualizarStatus(a.id, 'resolvido')}>
                        Resolvido
                      </button>
                    )}
                    {a.status !== 'descartado' && (
                      <button style={btnAcao('var(--af-muted)')} onClick={() => atualizarStatus(a.id, 'descartado')}>
                        Descartar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
