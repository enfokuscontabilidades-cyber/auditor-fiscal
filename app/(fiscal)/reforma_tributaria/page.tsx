'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { AlertTriangle, CheckCircle2, Download, FileOutput, Search, SlidersHorizontal, FileSearch } from 'lucide-react'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import { money, numberFmt } from '@/lib/fiscal/analiseReformaTributariaPaga'
import { PARAMETROS_REFORMA_2026 } from '@/lib/fiscal/parametrosReforma2026'
import type { LinhaReforma, SituacaoFiltroReforma, TotaisLinhasReforma } from '@/lib/fiscal/linhasReformaTributaria'
import ImportadorXmlReforma from '@/components/reforma/ImportadorXmlReforma'
import ModalGerarRelatorio, { type OpcoesGeracaoRelatorio } from '@/components/reforma/ModalGerarRelatorio'
import PageHeader from '@/components/ui/PageHeader'
import GlassCard from '@/components/ui/GlassCard'
import PaginationControls from '@/components/ui/PaginationControls'

const SITUACAO_LABEL: Record<LinhaReforma['situacao'], string> = { ok: 'Adequado', alerta: 'Atencao', critico: 'Critico' }
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

const TOTAIS_VAZIOS: TotaisLinhasReforma = { notas: 0, itens: 0, semDestaque: 0, divergencias: 0, ibs: 0, cbs: 0 }

function badgeClass(situacao: LinhaReforma['situacao']) {
  if (situacao === 'ok') return 'af-badge af-badge-success'
  if (situacao === 'critico') return 'af-badge af-badge-danger'
  return 'af-badge af-badge-warning'
}

export default function ReformaTributariaPage() {
  const { empresaAtiva } = useEmpresaAtiva()

  const [itens, setItens] = useState<LinhaReforma[]>([])
  const [total, setTotal] = useState(0)
  const [competencias, setCompetencias] = useState<string[]>([])
  const [totais, setTotais] = useState<TotaisLinhasReforma>(TOTAIS_VAZIOS)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [buscaInput, setBuscaInput] = useState('')
  const [busca, setBusca] = useState('')
  const [competenciaFiltro, setCompetenciaFiltro] = useState('')
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

  useEffect(() => { setPagina(1) }, [busca, competenciaFiltro, situacaoFiltro, empresaAtiva?.id])

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!empresaAtiva?.id) {
      setItens([])
      setTotal(0)
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
    if (busca) params.set('busca', busca)

    fetch(`/api/reforma-tributaria/itens?${params}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(await r.text())
        return r.json()
      })
      .then(d => {
        setItens(Array.isArray(d.itens) ? d.itens : [])
        setTotal(d.total ?? 0)
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
  }, [empresaAtiva?.id, competenciaFiltro, situacaoFiltro, busca, pagina, tamanhoPagina, recarregarVersao])

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
      if (busca) params.set('busca', busca)

      const res = await fetch(`/api/reforma-tributaria/itens?${params}`)
      if (!res.ok) throw new Error(await res.text())
      const d = await res.json()
      const todasFiltradas: LinhaReforma[] = Array.isArray(d.itens) ? d.itens : []

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(todasFiltradas.map(l => ({
        Competencia: l.competencia,
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
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 36 }, { wch: 42 },
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
        body: JSON.stringify({ empresa_id: empresaAtiva.id, competencia: competenciaFiltro || undefined, ...opcoes }),
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

  return (
    <main className="af-page">
      <PageHeader
        title="Reforma Tributaria"
        subtitle={`Conferencia de IBS e CBS nas NF-e importadas. Referencia ${PARAMETROS_REFORMA_2026.versao}: CST ${PARAMETROS_REFORMA_2026.cst}, cClassTrib ${PARAMETROS_REFORMA_2026.cClassTrib}, CBS ${numberFmt.format(PARAMETROS_REFORMA_2026.aliquotaCbs)}% e IBS total ${numberFmt.format(PARAMETROS_REFORMA_2026.aliquotaIbsTotal)}%.`}
        actions={(
          <div className="af-actions">
            <button
              type="button"
              onClick={() => setModalRelatorioAberto(true)}
              disabled={!empresaAtiva || gerandoPdf || !total}
              className="af-btn af-btn-secondary"
            >
              <FileOutput size={16} /> {gerandoPdf ? 'Gerando PDF...' : 'Gerar relatorio PDF'}
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              disabled={!total || gerandoExcel}
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
            ['Notas com destaque', String(totais.notas)],
            ['Itens com destaque', String(totais.itens)],
            ['Itens sem destaque', String(totais.semDestaque)],
            ['Divergencias', String(totais.divergencias)],
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
              placeholder="Nota, participante, produto, NCM, CFOP, CST ou cClass..."
              className="af-input"
              style={{ flex: 1 }}
            />
          </div>
          <select value={competenciaFiltro} onChange={e => setCompetenciaFiltro(e.target.value)} className="af-select">
            <option value="">Todos os meses</option>
            {competencias.map(c => <option key={c} value={c}>{mesLabel(c)}</option>)}
          </select>
          <select value={situacaoFiltro} onChange={e => setSituacaoFiltro(e.target.value as SituacaoFiltroReforma)} className="af-select">
            <option value="todos">Todas as notas</option>
            <option value="destacadas">Com IBS/CBS</option>
            <option value="sem_destaque">Sem IBS/CBS</option>
            <option value="divergencias">Com alertas</option>
          </select>
        </div>
      </GlassCard>

      <GlassCard
        title="Conferencia de IBS/CBS por item"
        titleRight={carregando ? <span className="af-help">Carregando...</span> : <FileSearch size={16} style={{ color: 'var(--af-primary)' }} />}
        padding={0}
      >
        {erro ? (
          <div className="af-alert af-alert-danger" style={{ margin: 18 }}>{erro}</div>
        ) : !empresaAtiva ? (
          <div style={{ padding: 34, textAlign: 'center' }} className="af-muted">Selecione uma empresa ativa para conferir IBS e CBS.</div>
        ) : !itens.length ? (
          <div style={{ padding: 34, textAlign: 'center' }} className="af-muted">
            <SlidersHorizontal size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            {carregando ? 'Carregando...' : 'Nenhum item encontrado para os filtros selecionados.'}
          </div>
        ) : (
          <>
            <div className="af-table-wrap">
              <table className="af-table">
                <thead>
                  <tr>
                    {['Nota', 'Data', 'Participante', 'Produto', 'NCM', 'CFOP', 'Valor', 'Situacao', 'CST', 'cClass', 'Base', 'IBS UF', 'IBS Mun', 'IBS', 'CBS', 'Divergencias'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itens.map(l => (
                    <tr key={l.chave}>
                      <td className="af-cell-strong">{l.nota}</td>
                      <td className="af-cell-nowrap">{dataBr(l.data)}</td>
                      <td className="af-cell-wide">{l.participante}</td>
                      <td className="af-cell-wide">{l.produto}</td>
                      <td>{l.ncm}</td>
                      <td className="af-cell-strong" style={{ color: 'var(--af-primary)' }}>{l.cfop}</td>
                      <td className="af-cell-nowrap">{money.format(l.valorItem)}</td>
                      <td>
                        <span className={badgeClass(l.situacao)}>
                          {l.situacao === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          {SITUACAO_LABEL[l.situacao]}
                        </span>
                      </td>
                      <td>{l.cst}</td>
                      <td>{l.cclass}</td>
                      <td className="af-cell-nowrap">{money.format(l.base)}</td>
                      <td className="af-cell-nowrap">{money.format(l.valorIbsUf)} <span className="af-muted">({numberFmt.format(l.aliquotaIbsUf)}%)</span></td>
                      <td className="af-cell-nowrap">{money.format(l.valorIbsMun)} <span className="af-muted">({numberFmt.format(l.aliquotaIbsMun)}%)</span></td>
                      <td className="af-cell-strong af-cell-nowrap" style={{ color: 'var(--af-success)' }}>{money.format(l.valorIbs)}</td>
                      <td className="af-cell-strong af-cell-nowrap" style={{ color: 'var(--af-info)' }}>{money.format(l.valorCbs)}</td>
                      <td className="af-cell-wide">
                        {l.alertas.length ? l.alertas.map(a => (
                          <span key={a} className={badgeClass(l.situacao)} style={{ margin: '2px 4px 2px 0' }}>{a}</span>
                        )) : <span className="af-badge af-badge-success">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationControls
              total={total}
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
          totalItensNaTela={total}
          onConfirmar={gerarPdf}
        />
      )}
    </main>
  )
}
