'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import GlassCard from '@/components/ui/GlassCard'
import { PLANOS_REFORMA_TRIBUTARIA, formatarPrecoCentavos, formatarLimite } from '@/lib/planos/reformaTributariaPlanos'
import type { AssinaturaRt, PlanoReformaTributariaCodigo } from '@/lib/types'

type AssinaturaResumo = {
  produtoEscopo: 'full_platform' | 'tax_reform_only'
  assinatura: AssinaturaRt | null
  plano: { codigo: PlanoReformaTributariaCodigo; nome: string; precoCentavos: number } | null
  cnpjSlotsUsados: number
  limiteCnpj: number | null
  xmlsUsadosNoCiclo: number
  limiteXmlPorCiclo: number | null
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativa',
  manual: 'Ativa',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
  expired: 'Expirada',
  suspended: 'Suspensa',
  pending: 'Aguardando ativacao',
}

function formatarData(iso: string | null | undefined) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function estadoUsoXml(pct: number): { label: string; cor: string } {
  if (pct >= 100) return { label: pct > 100 ? 'Limite ultrapassado' : 'Limite atingido', cor: 'var(--af-danger)' }
  if (pct >= 70) return { label: 'Atencao ao limite', cor: 'var(--af-warning)' }
  return { label: 'Uso normal', cor: 'var(--af-success)' }
}

export default function AssinaturaPage() {
  const [dados, setDados] = useState<AssinaturaResumo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [processandoUpgrade, setProcessandoUpgrade] = useState<string | null>(null)
  const [processandoCancelamento, setProcessandoCancelamento] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  function carregar() {
    setCarregando(true)
    fetch('/api/rt/assinatura').then(r => r.json()).then(d => { setDados(d); setCarregando(false) }).catch(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  async function fazerUpgrade(planoCodigo: string) {
    setProcessandoUpgrade(planoCodigo)
    setMensagem(null)
    try {
      const res = await fetch('/api/rt/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planoCodigo }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensagem({ tipo: 'erro', texto: body.error ?? 'Erro ao processar upgrade.' })
        return
      }
      setMensagem({ tipo: 'sucesso', texto: 'Plano atualizado com sucesso.' })
      carregar()
    } finally {
      setProcessandoUpgrade(null)
    }
  }

  async function cancelar() {
    if (!confirm('Confirma o cancelamento? O acesso permanece disponivel ate o fim do periodo ja pago.')) return
    setProcessandoCancelamento(true)
    setMensagem(null)
    try {
      const res = await fetch('/api/rt/cancelar', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensagem({ tipo: 'erro', texto: body.error ?? 'Erro ao cancelar assinatura.' })
        return
      }
      setMensagem({ tipo: 'sucesso', texto: 'Cancelamento confirmado. Seu acesso continua ate o fim do periodo pago.' })
      carregar()
    } finally {
      setProcessandoCancelamento(false)
    }
  }

  if (carregando) {
    return <div className="af-page"><p className="af-muted">Carregando...</p></div>
  }

  if (dados?.produtoEscopo === 'full_platform') {
    return (
      <div className="af-page rt-page-flow">
        <PageHeader title="Assinatura" subtitle="Plano de acesso completo a plataforma Enfokus" style={{ marginBottom: 6 }} />
        <GlassCard title="Plano atual" padding="16px 18px">
          <p className="rt-value">Founder Access</p>
          <p className="rt-subtle">Para alteracoes no plano, entre em contato com o suporte da Enfokus.</p>
        </GlassCard>
      </div>
    )
  }

  const statusAtual = dados?.assinatura?.status
  const statusLabel = statusAtual ? (STATUS_LABEL[statusAtual] ?? statusAtual) : '-'
  const planosSuperiores = PLANOS_REFORMA_TRIBUTARIA.filter(p => dados?.plano ? p.precoCentavos > dados.plano.precoCentavos : false)
  const usado = dados?.xmlsUsadosNoCiclo ?? 0
  const limite = dados?.limiteXmlPorCiclo
  const pct = limite && limite > 0 ? (usado / limite) * 100 : 0
  const estado = estadoUsoXml(pct)
  const xmlTexto = limite === null ? `${usado} / ilimitado` : `${usado} / ${limite ?? '-'}`
  const renovacao = formatarData(dados?.assinatura?.proxima_renovacao)

  return (
    <div className="af-page rt-page-flow">
      <PageHeader title="Assinatura" subtitle="Plano, limites e cobranca da Reforma Tributaria." style={{ marginBottom: 6 }} />

      {mensagem && (
        <div className={mensagem.tipo === 'erro' ? 'af-alert af-alert-danger' : 'af-alert af-alert-success'}>
          {mensagem.texto}
        </div>
      )}

      <GlassCard padding={0}>
        <div className="rt-hero-panel">
          <div className="rt-hero-item">
            <p className="rt-kicker">Plano atual</p>
            <p className="rt-value">{dados?.plano?.nome ?? '-'}</p>
            <p className="rt-subtle">{dados?.plano ? `${formatarPrecoCentavos(dados.plano.precoCentavos)}/mes` : '-'}</p>
          </div>
          <div className="rt-hero-item">
            <p className="rt-kicker">Status</p>
            <p className="rt-value">{statusLabel}</p>
          </div>
          <div className="rt-hero-item">
            <p className="rt-kicker">CNPJs</p>
            <p className="rt-value">{dados ? `${dados.cnpjSlotsUsados} / ${dados.limiteCnpj ?? 'ilimitado'}` : '-'}</p>
          </div>
          <div className="rt-hero-item">
            <p className="rt-kicker">Renovacao</p>
            <p className="rt-value">{renovacao}</p>
          </div>
        </div>
      </GlassCard>

      {limite !== null && (
        <GlassCard title="Uso de XMLs no ciclo" padding="16px 18px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div>
              <p className="rt-value">{xmlTexto}</p>
              <p className="rt-subtle">Renova em {renovacao}</p>
            </div>
            <span className="rt-pill" style={{ color: estado.cor, background: 'var(--af-surface-2)' }}>{estado.label}</span>
          </div>
          <div className="rt-progress">
            <span style={{ width: `${Math.min(pct, 100)}%`, background: estado.cor }} />
          </div>
          {usado > (limite ?? 0) && (
            <p className="rt-subtle">Uso acima do limite contratado. Novas analises ficam disponiveis na renovacao ou apos upgrade.</p>
          )}
        </GlassCard>
      )}

      {dados?.assinatura?.cancelamento_solicitado && (
        <div className="af-alert af-alert-warning">
          Cancelamento agendado. O acesso permanece disponivel ate {formatarData(dados.assinatura.acesso_ate ?? dados.assinatura.ciclo_fim)}.
        </div>
      )}

      {planosSuperiores.length > 0 && (
        <GlassCard title="Upgrade de plano" padding="16px 18px">
          <div className="rt-section-grid">
            {planosSuperiores.map(p => (
              <div
                key={p.codigo}
                className="rt-mini-stat"
                style={{ borderColor: p.destaque ? 'var(--af-primary)' : 'var(--af-border-soft)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{p.nome}</span>
                  {p.destaque && <span className="rt-pill">Recomendado</span>}
                </div>
                <strong style={{ marginTop: 10 }}>{formatarPrecoCentavos(p.precoCentavos)}</strong>
                <span>{formatarLimite(p.limiteCnpj, 'CNPJ')} · {p.limiteXmlPorCiclo === null ? 'XMLs sem limite' : `${p.limiteXmlPorCiclo} XMLs/ciclo`}</span>
                <button
                  type="button"
                  className="af-btn af-btn-primary"
                  onClick={() => fazerUpgrade(p.codigo)}
                  disabled={processandoUpgrade !== null}
                  style={{ width: '100%', marginTop: 12 }}
                >
                  {processandoUpgrade === p.codigo ? 'Processando...' : `Ir para ${p.nome}`}
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard title="Cancelamento" padding="16px 18px">
        <p className="rt-subtle" style={{ marginTop: 0 }}>
          Ao cancelar, o acesso permanece disponivel ate o fim do periodo ja pago. Empresas, analises e relatorios sao preservados.
        </p>
        <button
          type="button"
          onClick={cancelar}
          disabled={processandoCancelamento || dados?.assinatura?.cancelamento_solicitado}
          className="af-btn af-btn-danger"
        >
          {dados?.assinatura?.cancelamento_solicitado ? 'Cancelamento ja solicitado' : 'Cancelar assinatura'}
        </button>
      </GlassCard>
    </div>
  )
}
