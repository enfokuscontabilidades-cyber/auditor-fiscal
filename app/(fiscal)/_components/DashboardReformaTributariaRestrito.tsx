'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, FileText, ScanSearch } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import GlassCard from '@/components/ui/GlassCard'
import { formatarPrecoCentavos } from '@/lib/planos/reformaTributariaPlanos'
import type { AssinaturaRt, PlanoReformaTributariaCodigo } from '@/lib/types'
import type { ResumoAnaliseReforma } from '@/lib/fiscal/resumoReformaTributaria'

type AssinaturaResumo = {
  produtoEscopo: string
  assinatura: AssinaturaRt | null
  plano: { codigo: PlanoReformaTributariaCodigo; nome: string; precoCentavos: number } | null
  cnpjSlotsUsados: number
  limiteCnpj: number | null
  xmlsUsadosNoCiclo: number
  limiteXmlPorCiclo: number | null
}

type UsoResumo = {
  ultimasEmpresas: { id: string; razao_social: string; cnpj: string | null }[]
  ultimosDocumentos: { id: string; numero: string | null; data_emissao: string | null }[]
  resumo: ResumoAnaliseReforma
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

function formatarData(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function limiteTexto(usado?: number, limite?: number | null) {
  if (usado === undefined) return '-'
  return limite === null ? `${usado} / ilimitado` : `${usado} / ${limite ?? '-'}`
}

export default function DashboardReformaTributariaRestrito() {
  const [assinatura, setAssinatura] = useState<AssinaturaResumo | null>(null)
  const [uso, setUso] = useState<UsoResumo | null>(null)

  useEffect(() => {
    fetch('/api/rt/assinatura').then(r => r.json()).then(setAssinatura).catch(() => null)
    fetch('/api/rt/uso').then(r => r.json()).then(setUso).catch(() => null)
  }, [])

  const statusAtual = assinatura?.assinatura?.status
  const statusLabel = statusAtual ? (STATUS_LABEL[statusAtual] ?? statusAtual) : '-'
  const totalDocumentos = uso?.resumo.totalDocumentos ?? 0
  const totalItens = uso?.resumo.totalItens ?? 0
  const renovacao = formatarData(assinatura?.assinatura?.proxima_renovacao ?? null)

  return (
    <div className="af-page rt-page-flow">
      <PageHeader
        title="Dashboard"
        subtitle="Acompanhe o uso da assinatura e o resultado das analises de IBS/CBS."
        actions={(
          <div className="af-actions">
            <Link href="/empresas" className="af-btn af-btn-secondary"><Building2 size={14} /> Empresa</Link>
            <Link href="/reforma_tributaria" className="af-btn af-btn-secondary"><ScanSearch size={14} /> Analisar XML</Link>
            <Link href="/reforma_tributaria" className="af-btn af-btn-primary"><FileText size={14} /> Relatorios</Link>
          </div>
        )}
        style={{ marginBottom: 6 }}
      />

      <GlassCard padding={0}>
        <div className="rt-hero-panel">
          <div className="rt-hero-item">
            <p className="rt-kicker">Plano atual</p>
            <p className="rt-value">{assinatura?.plano?.nome ?? '-'}</p>
            <p className="rt-subtle">
              {assinatura?.plano ? `${formatarPrecoCentavos(assinatura.plano.precoCentavos)}/mes` : 'Carregando plano'}
            </p>
          </div>
          <div className="rt-hero-item">
            <p className="rt-kicker">Status</p>
            <p className="rt-value">{statusLabel}</p>
          </div>
          <div className="rt-hero-item">
            <p className="rt-kicker">Renovacao</p>
            <p className="rt-value">{renovacao}</p>
          </div>
          <div className="rt-hero-item">
            <p className="rt-kicker">Uso contratado</p>
            <p className="rt-value">{limiteTexto(assinatura?.xmlsUsadosNoCiclo, assinatura?.limiteXmlPorCiclo)}</p>
            <p className="rt-subtle">XMLs no ciclo</p>
          </div>
        </div>
      </GlassCard>

      <div className="rt-section-grid">
        <GlassCard title="Diagnostico dos documentos" padding="16px 18px">
          <div className="rt-stat-row">
            <div className="rt-mini-stat">
              <strong>{uso?.resumo.documentosAdequados ?? 0}</strong>
              <span>Adequados</span>
            </div>
            <div className="rt-mini-stat">
              <strong>{uso?.resumo.documentosAtencao ?? 0}</strong>
              <span>Em atencao</span>
            </div>
            <div className="rt-mini-stat">
              <strong>{uso?.resumo.documentosCriticos ?? 0}</strong>
              <span>Criticos</span>
            </div>
          </div>
          <p className="rt-subtle">{totalDocumentos} documento(s) analisado(s)</p>
        </GlassCard>

        <GlassCard title="Diagnostico dos itens" padding="16px 18px">
          <div className="rt-stat-row">
            <div className="rt-mini-stat">
              <strong>{uso?.resumo.itensAdequados ?? 0}</strong>
              <span>Adequados</span>
            </div>
            <div className="rt-mini-stat">
              <strong>{uso?.resumo.itensAtencao ?? 0}</strong>
              <span>Em atencao</span>
            </div>
            <div className="rt-mini-stat">
              <strong>{uso?.resumo.itensCriticos ?? 0}</strong>
              <span>Criticos</span>
            </div>
          </div>
          <p className="rt-subtle">{totalItens} item(ns) analisado(s)</p>
        </GlassCard>
      </div>

      <div className="rt-section-grid">
        <GlassCard title="Empresas recentes" padding="14px 18px">
          {!uso?.ultimasEmpresas.length ? (
            <p className="rt-subtle">Nenhuma empresa cadastrada ainda.</p>
          ) : (
            <div className="rt-list">
              {uso.ultimasEmpresas.map(e => (
                <div key={e.id} className="rt-list-row">
                  <span>{e.razao_social}</span>
                  <span className="af-muted">{e.cnpj}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard title="Documentos recentes" padding="14px 18px">
          {!uso?.ultimosDocumentos.length ? (
            <p className="rt-subtle">Nenhum documento processado ainda.</p>
          ) : (
            <div className="rt-list">
              {uso.ultimosDocumentos.map(d => (
                <div key={d.id} className="rt-list-row">
                  <span>Nota {d.numero ?? '-'}</span>
                  <span className="af-muted">{formatarData(d.data_emissao)}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div>
        <Link href="/assinatura" className="af-btn af-btn-secondary">
          Gerenciar assinatura
        </Link>
      </div>
    </div>
  )
}
