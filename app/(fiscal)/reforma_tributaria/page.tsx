'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { Fragment, useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Download, FileOutput, Search, SlidersHorizontal, FileSearch } from 'lucide-react'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import { money, numberFmt } from '@/lib/fiscal/analiseReformaTributariaPaga'
import { PARAMETROS_REFORMA_2026 } from '@/lib/fiscal/parametrosReforma2026'
import type { LinhaReforma, NotaReforma, SituacaoFiltroReforma, TipoDocumentoReforma, TotaisLinhasReforma } from '@/lib/fiscal/linhasReformaTributaria'
import ImportadorXmlReforma from '@/components/reforma/ImportadorXmlReforma'
import ModalGerarRelatorio, { type OpcoesGeracaoRelatorio } from '@/components/reforma/ModalGerarRelatorio'
import PageHeader from '@/components/ui/PageHeader'
import GlassCard from '@/components/ui/GlassCard'
import PaginationControls from '@/components/ui/PaginationControls'

const SITUACAO_LABEL: Record<LinhaReforma['situacao'], string> = { ok: 'Adequado', alerta: 'Atenção', critico: 'Crítico' }
const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoReforma, string> = { nfe: 'NF-e', nfce: 'NFC-e', nfse: 'NFS-e', outro: 'Documento' }
const TAMANHOS_PAGINA = [25, 50, 100]
const DEBOUNCE_BUSCA_MS = 350

function dataBr(data?: string) {
  if (!data) return '-'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return data
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
}

function mesLabel(comp: string) {
  if (!/^\d{4}-\d{2}$/.test(comp)) return comp
  const [ano, mes] = comp.split('-')
  return `${mes}/${ano}`
}

function documentoBr(documento?: string) {
  const digitos = (documento || '').replace(/\D/g, '')
  if (digitos.length === 14) return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (digitos.length === 11) return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return documento || '-'
}

const TOTAIS_VAZIOS: TotaisLinhasReforma = { notas: 0, itens: 0, semDestaque: 0, divergencias: 0, ibs: 0, cbs: 0 }

function badgeClass(situacao: LinhaReforma['situacao']) {
  if (situacao === 'ok') return 'af-badge af-badge-success'
  if (situacao === 'critico') return 'af-badge af-badge-danger'
  return 'af-badge af-badge-warning'
}

function CampoItemReforma({ label, valor, destaque }: {
  label: string
  valor: string
  destaque?: 'success' | 'info'
}) {
  const cor = destaque === 'success'
    ? 'var(--af-success)'
    : destaque === 'info' ? 'var(--af-info)' : 'var(--af-text)'
  return (
    <div style={{ minWidth: 0, padding: '7px 9px', borderRadius: 7, background: 'var(--af-surface)' }}>
      <span className="af-muted" style={{ display: 'block', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</span>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: cor, overflowWrap: 'anywhere' }}>{valor || '-'}</span>
    </div>
  )
}

export default function ReformaTributariaPage() {
  const { empresaAtiva } = useEmpresaAtiva()

  const [notas, setNotas] = useState<NotaReforma[]>([])
  const [totalNotas, setTotalNotas] = useState(0)
  const [totalItens, setTotalItens] = useState(0)
  const [notasExpandidas, setNotasExpandidas] = useState<Set<string>>(new Set())
  const [competencias, setCompetencias] = useState<string[]>([])
  const [totais, setTotais] = useState<TotaisLinhasReforma>(TOTAIS_VAZIOS)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [buscaInput, setBuscaInput] = useState('')
  const [busca, setBusca] = useState('')
  const [competenciaFiltro, setCompetenciaFiltro] = useState('')
  const [tipoDocumentoFiltro, setTipoDocumentoFiltro] = useState<TipoDocumentoReforma | ''>('')
  const [situacaoFiltro, setSituacaoFiltro] = useState<SituacaoFiltroReforma>('todos')
  const [pagina, setPagina] = useState(1)
  const [tamanhoPagina, setTamanhoPagina] = useState(50)
  const [recarregarVersao, setRecarregarVersao] = useState(0)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [gerandoExcel, setGerandoExcel] = useState(false)
  const [modalRelatorioAberto, setModalRelatorioAberto] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaInput), DEBOUNCE_BUSCA_MS)
    return () => clearTimeout(t)
  }, [buscaInput])

  useEffect(() => {
    setPagina(1)
    setNotasExpandidas(new Set())
  }, [busca, competenciaFiltro, tipoDocumentoFiltro, situacaoFiltro, empresaAtiva?.id])

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!empresaAtiva?.id) {
      setNotas([])
      setTotalNotas(0)
      setTotalItens(0)
      setCompetencias([])
      setTotais(TOTAIS_VAZIOS)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setCarregando(true)
    setErro('')

    const params = new URLSearchParams({
      empresa_id: empresaAtiva.id,
      page: String(pagina),
      pageSize: String(tamanhoPagina),
      situacao: situacaoFiltro,
    })
    if (competenciaFiltro) params.set('competencia', competenciaFiltro)
    if (tipoDocumentoFiltro) params.set('tipoDocumento', tipoDocumentoFiltro)
    if (busca) params.set('busca', busca)

    fetch(`/api/reforma-tributaria/itens?${params}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(await r.text())
        return r.json()
      })
      .then(d => {
        setNotas(Array.isArray(d.notas) ? d.notas : [])
        setTotalNotas(d.total ?? 0)
        setTotalItens(d.totalItens ?? 0)
        setCompetencias(Array.isArray(d.competencias) ? d.competencias : [])
        setTotais(d.totais ?? TOTAIS_VAZIOS)
      })
      .catch(err => {
        if (err?.name === 'AbortError') return
        setErro('Nao foi possivel carregar os documentos fiscais importados.')
      })
      .finally(() => {
        if (abortRef.current === controller) setCarregando(false)
      })

    return () => controller.abort()
  }, [empresaAtiva?.id, competenciaFiltro, tipoDocumentoFiltro, situacaoFiltro, busca, pagina, tamanhoPagina, recarregarVersao])

  useEffect(() => {
    if (competenciaFiltro && competencias.length && !competencias.includes(competenciaFiltro)) {
      setCompetenciaFiltro('')
    }
  }, [competenciaFiltro, competencias])

  async function exportarExcel() {
    if (!empresaAtiva) return
    setGerandoExcel(true)
    try {
      const params = new URLSearchParams({ empresa_id: empresaAtiva.id, situacao: situacaoFiltro, export: 'true' })
      if (competenciaFiltro) params.set('competencia', competenciaFiltro)
      if (tipoDocumentoFiltro) params.set('tipoDocumento', tipoDocumentoFiltro)
      if (busca) params.set('busca', busca)

      const res = await fetch(`/api/reforma-tributaria/itens?${params}`)
      if (!res.ok) throw new Error(await res.text())
      const d = await res.json()
      const todasFiltradas: LinhaReforma[] = Array.isArray(d.itens) ? d.itens : []

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(todasFiltradas.map(l => ({
        Competencia: l.competencia,
        Tipo_Documento: TIPO_DOCUMENTO_LABEL[l.tipoDocumento],
        Nota: l.nota,
        Data: dataBr(l.data),
        Participante: l.participante,
        Produto: l.produto,
        NCM: l.ncm,
        CFOP: l.cfop,
        Valor_Item: l.valorItem,
        Destacado_IBS_CBS: l.destacado ? 'Sim' : 'Nao',
        CST_IBS_CBS: l.cst,
        cClassTrib: l.cclass,
        Base_IBS_CBS: l.base,
        Aliquota_IBS_UF: l.aliquotaIbsUf,
        Valor_IBS_UF: l.valorIbsUf,
        Aliquota_IBS_Municipio: l.aliquotaIbsMun,
        Valor_IBS_Municipio: l.valorIbsMun,
        Valor_IBS: l.valorIbs,
        Aliquota_CBS: l.aliquotaCbs,
        Valor_CBS: l.valorCbs,
        Alertas: l.alertas.join(' | '),
      })))
      ws['!cols'] = [
        { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 36 }, { wch: 42 },
        { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
        { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 46 },
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'IBS_CBS')
      const nome = `reforma_tributaria_${(empresaAtiva.razao_social ?? 'empresa').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, nome)
    } catch {
      setErro('Nao foi possivel gerar a exportacao em Excel.')
    } finally {
      setGerandoExcel(false)
    }
  }

  async function gerarPdf(opcoes: OpcoesGeracaoRelatorio) {
    if (!empresaAtiva) return
    setGerandoPdf(true)
    try {
      const res = await fetch('/api/reforma-tributaria/relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresaAtiva.id,
          competencia: competenciaFiltro || undefined,
          tipoDocumento: tipoDocumentoFiltro || undefined,
          ...opcoes,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erro ao gerar relatorio PDF.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio_ibs_cbs_${(empresaAtiva.razao_social ?? 'empresa').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGerandoPdf(false)
    }
  }

  function toggleNota(chave: string) {
    setNotasExpandidas(atuais => {
      const proximas = new Set(atuais)
      if (proximas.has(chave)) proximas.delete(chave)
      else proximas.add(chave)
      return proximas
    })
  }

  return (
    <main className="af-page">
      <PageHeader
        title="Reforma Tributária"
        subtitle={`Conferência de IBS e CBS nos documentos importados (NF-e, NFC-e e NFS-e). Referência ${PARAMETROS_REFORMA_2026.versao}: CST ${PARAMETROS_REFORMA_2026.cst}, cClassTrib ${PARAMETROS_REFORMA_2026.cClassTrib}, CBS ${numberFmt.format(PARAMETROS_REFORMA_2026.aliquotaCbs)}% e IBS total ${numberFmt.format(PARAMETROS_REFORMA_2026.aliquotaIbsTotal)}%.`}
        actions={(
          <div className="af-actions">
            <button
              type="button"
              onClick={() => setModalRelatorioAberto(true)}
              disabled={!empresaAtiva || gerandoPdf || !totalItens}
              className="af-btn af-btn-secondary"
            >
              <FileOutput size={16} /> {gerandoPdf ? 'Gerando PDF...' : 'Gerar relatório PDF'}
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              disabled={!totalItens || gerandoExcel}
              className="af-btn af-btn-primary"
            >
              <Download size={16} /> {gerandoExcel ? 'Exportando...' : 'Exportar Excel'}
            </button>
          </div>
        )}
      />

      {empresaAtiva && (
        <GlassCard padding={16} style={{ marginBottom: 16 }}>
          <ImportadorXmlReforma
            empresaId={empresaAtiva.id}
            cnpjEmpresa={empresaAtiva.cnpj ?? ''}
            cnaePrincipal={empresaAtiva.cnae_principal}
            onImportado={() => setRecarregarVersao(v => v + 1)}
          />
        </GlassCard>
      )}

      <GlassCard padding={16} style={{ marginBottom: 16 }}>
        <div className="af-metric-grid">
          {[
            ['Documentos com destaque', String(totais.notas)],
            ['Itens com destaque', String(totais.itens)],
            ['Itens sem destaque', String(totais.semDestaque)],
            ['Divergências', String(totais.divergencias)],
            ['Total IBS', money.format(totais.ibs)],
            ['Total CBS', money.format(totais.cbs)],
          ].map(([label, value]) => (
            <div key={label} className="af-metric">
              <div className="af-metric-label">{label}</div>
              <div className="af-metric-value">{value}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard padding={16} style={{ marginBottom: 16 }}>
        <div className="af-toolbar">
          <div className="af-search-field">
            <Search size={16} />
            <input
              value={buscaInput}
              onChange={e => setBuscaInput(e.target.value)}
              placeholder="Documento, participante, produto/serviço, NCM, CFOP, CST ou cClass..."
              className="af-input"
              style={{ flex: 1 }}
            />
          </div>
          <select value={competenciaFiltro} onChange={e => setCompetenciaFiltro(e.target.value)} className="af-select">
            <option value="">Todos os meses</option>
            {competencias.map(c => <option key={c} value={c}>{mesLabel(c)}</option>)}
          </select>
          <select value={tipoDocumentoFiltro} onChange={e => setTipoDocumentoFiltro(e.target.value as TipoDocumentoReforma | '')} className="af-select">
            <option value="">Todos os documentos</option>
            <option value="nfe">NF-e</option>
            <option value="nfce">NFC-e</option>
            <option value="nfse">NFS-e</option>
          </select>
          <select value={situacaoFiltro} onChange={e => setSituacaoFiltro(e.target.value as SituacaoFiltroReforma)} className="af-select">
            <option value="todos">Todas as situações</option>
            <option value="destacadas">Com IBS/CBS</option>
            <option value="sem_destaque">Sem IBS/CBS</option>
            <option value="divergencias">Com alertas</option>
          </select>
        </div>
      </GlassCard>

      <GlassCard
        title="Conferência de IBS/CBS por documento fiscal"
        titleRight={carregando
          ? <span className="af-help">Carregando...</span>
          : <span className="af-help" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileSearch size={16} style={{ color: 'var(--af-primary)' }} /> {totalNotas} documento(s) · {totalItens} item(ns)</span>}
        padding={0}
      >
        {erro ? (
          <div className="af-alert af-alert-danger" style={{ margin: 18 }}>{erro}</div>
        ) : !empresaAtiva ? (
          <div style={{ padding: 34, textAlign: 'center' }} className="af-muted">Selecione uma empresa ativa para conferir IBS e CBS.</div>
        ) : !notas.length ? (
          <div style={{ padding: 34, textAlign: 'center' }} className="af-muted">
            <SlidersHorizontal size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            {carregando ? 'Carregando...' : 'Nenhum documento encontrado para os filtros selecionados.'}
          </div>
        ) : (
          <>
            <div className="af-table-wrap" style={{ maxWidth: '100%', overflowX: 'auto' }}>
              <table className="af-table" style={{ minWidth: 920, width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }} aria-label="Expandir nota" />
                    <th style={{ width: 125 }}>Documento</th>
                    <th style={{ width: 96 }}>Data</th>
                    <th>Participante</th>
                    <th style={{ width: 125 }}>Itens</th>
                    <th style={{ width: 120 }}>Valor</th>
                    <th style={{ width: 145 }}>IBS / CBS</th>
                    <th style={{ width: 96 }}>Divergências</th>
                    <th style={{ width: 112 }}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {notas.map(nota => {
                    const expandida = notasExpandidas.has(nota.chave)
                    return (
                      <Fragment key={nota.chave}>
                        <tr
                          onClick={() => toggleNota(nota.chave)}
                          style={{ cursor: 'pointer', background: nota.situacao === 'critico' ? 'rgba(239,68,68,0.035)' : nota.situacao === 'alerta' ? 'rgba(251,191,36,0.035)' : 'transparent' }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              aria-label={expandida ? `Recolher nota ${nota.nota}` : `Expandir nota ${nota.nota}`}
                              aria-expanded={expandida}
                              onClick={evento => { evento.stopPropagation(); toggleNota(nota.chave) }}
                              style={{ display: 'inline-flex', padding: 3, border: 0, background: 'transparent', color: expandida ? 'var(--af-primary)' : 'var(--af-muted)', cursor: 'pointer' }}
                            >
                              {expandida ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>
                          <td className="af-cell-strong">
                            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 6, padding: '2px 7px', marginBottom: 4, background: 'rgba(39,199,216,0.10)', color: 'var(--af-primary)', fontSize: 10, fontWeight: 700 }}>
                              {TIPO_DOCUMENTO_LABEL[nota.tipoDocumento]}
                            </span>
                            <span style={{ display: 'block' }}>Nº {nota.nota}</span>
                            {nota.serie !== '-' && <span className="af-muted" style={{ display: 'block', fontSize: 10, fontWeight: 400 }}>Série {nota.serie}</span>}
                          </td>
                          <td className="af-cell-nowrap">{dataBr(nota.data)}</td>
                          <td style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {nota.participanteNome || (nota.tipoDocumento === 'nfce' ? 'Consumidor não identificado' : 'Nome não informado')}
                            </span>
                            <span className="af-muted" style={{ display: 'block', fontSize: 10, marginTop: 2 }}>{documentoBr(nota.participanteDocumento)}</span>
                          </td>
                          <td>
                            <span style={{ display: 'block', fontWeight: 700 }}>{nota.totalItens} item(ns)</span>
                            <span className="af-muted" style={{ display: 'block', fontSize: 10, marginTop: 2 }}>{nota.itensComDestaque} com destaque · {nota.itensSemDestaque} sem</span>
                          </td>
                          <td className="af-cell-strong af-cell-nowrap">{money.format(nota.valorItens)}</td>
                          <td>
                            <span style={{ display: 'block', color: nota.valorIbs > 0 ? 'var(--af-success)' : 'var(--af-muted)', fontWeight: 700 }}>IBS {money.format(nota.valorIbs)}</span>
                            <span style={{ display: 'block', color: nota.valorCbs > 0 ? 'var(--af-info)' : 'var(--af-muted)', fontSize: 11, marginTop: 2 }}>CBS {money.format(nota.valorCbs)}</span>
                          </td>
                          <td style={{ textAlign: 'center', color: nota.divergencias > 0 ? 'var(--af-danger)' : 'var(--af-success)', fontWeight: 700 }}>{nota.divergencias}</td>
                          <td>
                            <span className={badgeClass(nota.situacao)}>
                              {nota.situacao === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                              {SITUACAO_LABEL[nota.situacao]}
                            </span>
                          </td>
                        </tr>

                        {expandida && (
                          <tr style={{ background: 'var(--af-surface-2)' }}>
                            <td colSpan={9} style={{ padding: '0 12px 14px 44px' }}>
                              <div style={{ marginTop: 8, border: '1px solid var(--af-border)', borderRadius: 10, background: 'var(--af-surface)', overflow: 'hidden' }}>
                                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--af-border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <div>
                                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                                      {nota.tipoDocumento === 'nfse' ? 'Serviços' : 'Itens'} da {TIPO_DOCUMENTO_LABEL[nota.tipoDocumento]} {nota.nota}
                                    </span>
                                    <span className="af-muted" style={{ fontSize: 11, marginLeft: 8 }}>Detalhamento fiscal do documento</span>
                                  </div>
                                  <span className="af-muted" style={{ fontSize: 11 }}>{nota.totalItens} item(ns)</span>
                                </div>
                                <div style={{ padding: 12, display: 'grid', gap: 10 }}>
                                  {nota.itens.map(item => (
                                    <div key={item.chave} style={{ border: '1px solid var(--af-border)', borderRadius: 9, padding: 12, background: 'var(--af-surface-2)', minWidth: 0 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-primary)' }}>#{item.itemNumero}</span>
                                          <span style={{ fontSize: 12, fontWeight: 700 }}>Código {item.codigoProduto || '-'}</span>
                                        </div>
                                        <span className={badgeClass(item.situacao)}>
                                          {item.situacao === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                          {SITUACAO_LABEL[item.situacao]}
                                        </span>
                                      </div>

                                      <div style={{ marginBottom: 11 }}>
                                        <span className="af-muted" style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                                          {nota.tipoDocumento === 'nfse' ? 'Descrição do serviço' : 'Produto'}
                                        </span>
                                        <div style={{ fontSize: 12, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{item.produto}</div>
                                      </div>

                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 8 }}>
                                        {nota.tipoDocumento !== 'nfse' && <CampoItemReforma label="NCM" valor={item.ncm} />}
                                        {nota.tipoDocumento !== 'nfse' && <CampoItemReforma label="CFOP" valor={item.cfop} />}
                                        <CampoItemReforma label="Valor" valor={money.format(item.valorItem)} />
                                        <CampoItemReforma label="CST IBS/CBS" valor={item.cst} />
                                        <CampoItemReforma label="cClassTrib" valor={item.cclass} />
                                        <CampoItemReforma label="Base IBS/CBS" valor={money.format(item.base)} />
                                        <CampoItemReforma label="IBS UF" valor={`${money.format(item.valorIbsUf)} (${numberFmt.format(item.aliquotaIbsUf)}%)`} />
                                        <CampoItemReforma label="IBS Município" valor={`${money.format(item.valorIbsMun)} (${numberFmt.format(item.aliquotaIbsMun)}%)`} />
                                        <CampoItemReforma label="Total IBS" valor={money.format(item.valorIbs)} destaque="success" />
                                        <CampoItemReforma label="Total CBS" valor={money.format(item.valorCbs)} destaque="info" />
                                      </div>

                                      <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--af-border)', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                        {item.alertas.length ? item.alertas.map(alerta => (
                                          <span key={alerta} className={badgeClass(item.situacao)} style={{ whiteSpace: 'normal' }}>{alerta}</span>
                                        )) : <span className="af-badge af-badge-success">Sem divergências</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <PaginationControls
              total={totalNotas}
              page={pagina}
              pageSize={tamanhoPagina}
              pageSizeOptions={TAMANHOS_PAGINA}
              onPageChange={setPagina}
              onPageSizeChange={pageSize => { setTamanhoPagina(pageSize); setPagina(1) }}
            />
          </>
        )}
      </GlassCard>

      {empresaAtiva && (
        <ModalGerarRelatorio
          aberto={modalRelatorioAberto}
          onFechar={() => setModalRelatorioAberto(false)}
          empresaId={empresaAtiva.id}
          empresaNome={empresaAtiva.razao_social ?? 'Empresa'}
          competencia={competenciaFiltro || undefined}
          totalItensNaTela={totalItens}
          onConfirmar={gerarPdf}
        />
      )}
    </main>
  )
}
