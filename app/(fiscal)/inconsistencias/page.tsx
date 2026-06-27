'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AlertaFiscal } from '@/lib/types'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import { ChevronDown, ChevronUp, Building2, TriangleAlert, Package, Users, BarChart3, Hash, Download, Receipt } from 'lucide-react'
import * as XLSX from 'xlsx'
import PageHeader from '@/components/ui/PageHeader'
import GlassCard from '@/components/ui/GlassCard'
import EmptyState from '@/components/ui/EmptyState'
import PaginationControls, { getPageItems } from '@/components/ui/PaginationControls'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type AbaRelatorio = 'inconsistencias' | 'entradas_saidas' | 'documentos' | 'produtos' | 'participantes' | 'cfop' | 'ncm'

type DadoMensal = {
  competencia: string
  origem?: string
  total_entrada: number
  total_saida: number
  count_entrada: number
  count_saida: number
}

type TopProduto = { competencia?: string; tipo_movimento?: string; descricao: string; ncm: string; valor_total: number; quantidade: number; count: number }
type Participante = { cnpj: string; nome: string; valor_total: number; count: number; _cnpj_cache?: Record<string, unknown> }
type CfopItem = { cfop: string; tipo: string; valor_total: number; quantidade: number; count: number; participacao: number }
type NcmItem = { ncm: string; descricao_exemplo: string; valor_total: number; quantidade: number; participacao: number; count_produtos?: number }

type NivelFiscal = 'documento' | 'produto'
type OrdemFiscal = 'documento' | 'cfop' | 'participante' | 'estado' | 'dia' | 'aliquota' | 'produto' | 'ncm' | 'cst'

type RelatorioFiscalResumo = {
  competencia?: string | null
  grupo: string
  grupo_label: string
  tipo_movimento?: string
  quantidade: number
  documentos: number
  valor_contabil: number
  valor_produtos: number
  valor_desconto: number
  valor_frete: number
  base_icms: number
  valor_icms: number
  valor_st: number
  valor_ipi: number
  valor_pis: number
  valor_cofins: number
}

type RelatorioFiscalDocumento = {
  id: string
  tipo_movimento: string
  numero: string | null
  serie: string | null
  modelo: string | null
  data_emissao: string | null
  data_competencia: string | null
  emitente_cnpj: string | null
  emitente_nome: string | null
  destinatario_cnpj: string | null
  destinatario_nome: string | null
  valor_total: number | null
  valor_produtos: number | null
  valor_desconto: number | null
  valor_frete: number | null
  valor_icms: number | null
  valor_pis: number | null
  valor_cofins: number | null
  valor_st: number | null
  valor_ipi: number | null
  status: string
}

type RelatorioFiscalDocumentoJoin = Pick<
  RelatorioFiscalDocumento,
  'id' | 'tipo_movimento' | 'numero' | 'serie' | 'modelo' | 'data_emissao' | 'data_competencia' | 'emitente_cnpj' | 'emitente_nome' | 'destinatario_cnpj' | 'destinatario_nome' | 'status'
>

type RelatorioFiscalProduto = {
  id: string
  documento_id: string
  item_numero: number | null
  codigo_produto: string | null
  descricao: string | null
  ncm: string | null
  cfop: string | null
  unidade: string | null
  quantidade: number | null
  valor_unitario: number | null
  valor_total: number | null
  valor_desconto: number | null
  valor_frete: number | null
  cst_icms: string | null
  csosn: string | null
  valor_bc_icms: number | null
  aliquota_icms: number | null
  valor_icms: number | null
  valor_bc_st: number | null
  valor_st: number | null
  cst_pis: string | null
  valor_pis: number | null
  cst_cofins: string | null
  valor_cofins: number | null
  valor_ipi: number | null
  tipo_movimento: string | null
  fa_documentos_fiscais: RelatorioFiscalDocumentoJoin | RelatorioFiscalDocumentoJoin[] | null
}

type RelatorioFiscalLinha = RelatorioFiscalResumo | RelatorioFiscalDocumento | RelatorioFiscalProduto

type RelatorioFiscalResposta = {
  rows?: RelatorioFiscalLinha[]
  total?: number
  page?: number
  page_size?: number
  totalizadores?: {
    valor_contabil: number
    base_icms: number
    valor_icms: number
    valor_st: number
    valor_ipi: number
    valor_pis: number
    valor_cofins: number
  }
  error?: string
}

type DivergenciaSimplesCandidato = {
  documento_id: string
  numero: string
  data_emissao: string | null
  participante: string
  cfops: string
  movimento: string
  impacto_receita: string
  valor: number
  motivo: string
}

type DivergenciaSimples = {
  competencia: string
  receita_pgdas: number
  receita_xml: number
  faturamento_xml: number
  devolucoes_xml: number
  diferenca: number
  variacao: number
  status: 'alerta' | 'critico' | 'sem_dados' | string
  qtd_documentos: number
  qtd_candidatos: number
  candidatos: DivergenciaSimplesCandidato[]
}

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
  const empresaId = empresa?.id

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
  const [divergenciasSimples, setDivergenciasSimples] = useState<DivergenciaSimples[]>([])
  const [loadingDivSimples, setLoadingDivSimples] = useState(false)
  const [erroDivSimples, setErroDivSimples] = useState<string | null>(null)
  const [divSimplesExpandida, setDivSimplesExpandida] = useState<string | null>(null)

  // Estado abas de relatórios
  const [dadosMensais,      setDadosMensais]      = useState<DadoMensal[]>([])
  const [topProdutos,       setTopProdutos]       = useState<TopProduto[]>([])
  const [participantes,     setParticipantes]     = useState<Participante[]>([])
  const [tipoParticipante,  setTipoParticipante]  = useState<'entrada' | 'saida'>('entrada')
  const [cfops,             setCfops]             = useState<CfopItem[]>([])
  const [ncms,              setNcms]              = useState<NcmItem[]>([])
  const [nivelFiscal,       setNivelFiscal]       = useState<NivelFiscal>('documento')
  const [ordemFiscal,       setOrdemFiscal]       = useState<OrdemFiscal>('documento')
  const [resumidoFiscal,    setResumidoFiscal]    = useState(false)
  const [linhasFiscal,      setLinhasFiscal]      = useState<RelatorioFiscalLinha[]>([])
  const [totalFiscal,       setTotalFiscal]       = useState(0)
  const [totalizadoresFiscal, setTotalizadoresFiscal] = useState<RelatorioFiscalResposta['totalizadores']>()
  const [loadingRel,        setLoadingRel]        = useState(false)
  const [exportandoExcel,   setExportandoExcel]   = useState(false)
  const [erroRel,           setErroRel]           = useState<string | null>(null)
  const [pageSizeRel, setPageSizeRel] = useState(50)
  const [paginasRel, setPaginasRel] = useState<Record<AbaRelatorio, number>>({
    inconsistencias: 1,
    entradas_saidas: 1,
    documentos: 1,
    produtos: 1,
    participantes: 1,
    cfop: 1,
    ncm: 1,
  })

  // CNPJ cache (para aba participantes)
  const [cnpjCache, setCnpjCache] = useState<Record<string, { status: 'carregando' | 'ok' | 'erro'; dados?: Record<string, unknown> }>>({})

  const paginaRel = paginasRel[abaAtiva] ?? 1
  const abaFiscal = abaAtiva === 'entradas_saidas' || abaAtiva === 'produtos' || abaAtiva === 'cfop'
  const setPaginaRel = (pagina: number) => setPaginasRel(prev => ({ ...prev, [abaAtiva]: pagina }))
  const trocarPageSizeRel = (tamanho: number) => {
    setPageSizeRel(tamanho)
    setPaginasRel({
      inconsistencias: 1,
      entradas_saidas: 1,
      documentos: 1,
      produtos: 1,
      participantes: 1,
      cfop: 1,
      ncm: 1,
    })
  }

  // ── Carregar alertas ────────────────────────────────────────────────────────

  const carregarAlertas = useCallback(async () => {
    setLoadingAlert(true)
    let query = supabase
      .from('fa_alertas')
      .select('*, empresa:empresas(razao_social)')
      .order('nivel_risco', { ascending: true })
      .order('created_at', { ascending: false })

    if (empresaId) query = query.eq('empresa_id', empresaId)
    if (filtroNivel)  query = query.eq('nivel_risco', filtroNivel)
    if (filtroStatus) query = query.eq('status', filtroStatus)

    const { data } = await query
    setAlertas((data as AlertaFiscal[]) ?? [])
    setLoadingAlert(false)
  }, [empresaId, filtroNivel, filtroStatus, supabase])

  useEffect(() => {
    if (abaAtiva !== 'inconsistencias') return
    const timer = window.setTimeout(() => { void carregarAlertas() }, 0)
    return () => window.clearTimeout(timer)
  }, [abaAtiva, carregarAlertas])

  const carregarDivergenciasSimples = useCallback(async () => {
    if (!empresaId) {
      setDivergenciasSimples([])
      return
    }

    setLoadingDivSimples(true)
    setErroDivSimples(null)
    const params = new URLSearchParams({ empresa_id: empresaId })
    if (compInicio) params.set('competencia_inicio', compInicio)
    if (compFim) params.set('competencia_fim', compFim)

    try {
      const res = await fetch(`/api/relatorios/divergencias-simples?${params}`)
      const body = await res.json().catch(() => null) as DivergenciaSimples[] | { error?: string } | null
      if (!res.ok) {
        const msg = body && !Array.isArray(body) && body.error ? body.error : `Erro HTTP ${res.status}`
        throw new Error(msg)
      }
      setDivergenciasSimples(Array.isArray(body) ? body : [])
    } catch (err) {
      setDivergenciasSimples([])
      setErroDivSimples(err instanceof Error ? err.message : 'Erro ao carregar divergencias do Simples')
    } finally {
      setLoadingDivSimples(false)
    }
  }, [empresaId, compInicio, compFim])

  useEffect(() => {
    if (abaAtiva !== 'inconsistencias') return
    const timer = window.setTimeout(() => { void carregarDivergenciasSimples() }, 0)
    return () => window.clearTimeout(timer)
  }, [abaAtiva, carregarDivergenciasSimples])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (abaAtiva === 'entradas_saidas') {
        setNivelFiscal('documento')
        setOrdemFiscal('documento')
        setResumidoFiscal(false)
        setPaginasRel(prev => ({ ...prev, entradas_saidas: 1 }))
      } else if (abaAtiva === 'produtos') {
        setNivelFiscal('produto')
        setOrdemFiscal('produto')
        setResumidoFiscal(false)
        setPaginasRel(prev => ({ ...prev, produtos: 1 }))
      } else if (abaAtiva === 'cfop') {
        setNivelFiscal('produto')
        setOrdemFiscal('cfop')
        setResumidoFiscal(true)
        setPaginasRel(prev => ({ ...prev, cfop: 1 }))
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [abaAtiva])

  // ── Carregar relatório ──────────────────────────────────────────────────────

  const carregarRelatorio = useCallback(async () => {
    if (!empresaId || abaAtiva === 'inconsistencias' || abaFiscal) return
    if (!compInicio && !compFim) {
      setDadosMensais([])
      setTopProdutos([])
      setParticipantes([])
      setCfops([])
      setNcms([])
      setLinhasFiscal([])
      setTotalFiscal(0)
      setTotalizadoresFiscal(undefined)
      setErroRel(null)
      return
    }
    setLoadingRel(true)
    setErroRel(null)
    setPaginasRel(prev => ({ ...prev, [abaAtiva]: 1 }))

    const params = new URLSearchParams({ empresa_id: empresaId })
    if (compInicio) params.set('competencia_inicio', compInicio)
    if (compFim)    params.set('competencia_fim', compFim)
    if (tipoMov)    params.set('tipo_movimento', tipoMov)

    try {
      const carregarJson = async (url: string) => {
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 45_000)
        try {
          const res = await fetch(url, { signal: controller.signal })
          const body = await res.json().catch(() => null) as { error?: string } | unknown
          if (!res.ok) {
            const erro = body && typeof body === 'object' && 'error' in body ? String(body.error) : `Erro HTTP ${res.status}`
            throw new Error(erro)
          }
          return body
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error(`A consulta demorou demais na aba ${abaAtiva}. URL: ${url}`)
          }
          throw err
        } finally {
          window.clearTimeout(timeout)
        }
      }

      if (abaAtiva === 'documentos') {
        const r = await carregarJson(`/api/relatorios/documentos?${params}&meses=24`)
        setDadosMensais(Array.isArray(r) ? r : [])
      } else if (abaAtiva === 'participantes') {
        const p = new URLSearchParams(params)
        p.set('tipo', tipoParticipante)
        p.set('limit', '5000')
        const r = await carregarJson(`/api/relatorios/participantes?${p}`)
        setParticipantes(Array.isArray(r) ? r : [])
      } else if (abaAtiva === 'ncm') {
        const p = new URLSearchParams(params)
        p.set('limit', '5000')
        const r = await carregarJson(`/api/relatorios/ncm?${p}`)
        setNcms(Array.isArray(r) ? r : [])
      }
    } catch (err) {
      setErroRel(err instanceof Error ? err.message : 'Erro ao carregar relatorio')
    } finally {
      setLoadingRel(false)
    }
  }, [empresaId, abaAtiva, abaFiscal, compInicio, compFim, tipoMov, tipoParticipante])

  useEffect(() => {
    const timer = window.setTimeout(() => { void carregarRelatorio() }, 0)
    return () => window.clearTimeout(timer)
  }, [carregarRelatorio])

  const carregarRelatorioFiscal = useCallback(async () => {
    if (!empresaId || !abaFiscal) return
    if (!compInicio && !compFim) {
      setLinhasFiscal([])
      setTotalFiscal(0)
      setTotalizadoresFiscal(undefined)
      setErroRel(null)
      return
    }

    setLoadingRel(true)
    setErroRel(null)

    const params = new URLSearchParams({
      empresa_id: empresaId,
      nivel: abaAtiva === 'entradas_saidas' ? 'documento' : 'produto',
      ordem: abaAtiva === 'cfop' ? 'cfop' : ordemFiscal,
      resumido: String(abaAtiva === 'cfop' ? true : resumidoFiscal),
      page: String(paginaRel),
      page_size: String(pageSizeRel),
    })
    if (compInicio) params.set('competencia_inicio', compInicio)
    if (compFim) params.set('competencia_fim', compFim)
    if (tipoMov) params.set('tipo_movimento', tipoMov)

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 45_000)
      try {
        const res = await fetch(`/api/relatorios/entradas-saidas?${params}`, { signal: controller.signal })
        const body = await res.json().catch(() => null) as RelatorioFiscalResposta | null
        if (!res.ok) throw new Error(body?.error ?? `Erro HTTP ${res.status}`)
        setLinhasFiscal(Array.isArray(body?.rows) ? body.rows : [])
        setTotalFiscal(Number(body?.total ?? 0))
        setTotalizadoresFiscal(body?.totalizadores)
      } finally {
        window.clearTimeout(timeout)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setErroRel('A consulta demorou demais. Tente gerar um periodo menor ou usar o modo resumido.')
      } else {
        setErroRel(err instanceof Error ? err.message : 'Erro ao carregar relatorio fiscal')
      }
    } finally {
      setLoadingRel(false)
    }
  }, [empresaId, abaAtiva, abaFiscal, compInicio, compFim, tipoMov, ordemFiscal, resumidoFiscal, paginaRel, pageSizeRel])

  useEffect(() => {
    const timer = window.setTimeout(() => { void carregarRelatorioFiscal() }, 0)
    return () => window.clearTimeout(timer)
  }, [carregarRelatorioFiscal])

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
    { key: 'entradas_saidas', label: 'Entradas/Saídas', icon: <BarChart3 size={13} /> },
    { key: 'documentos',      label: 'Qtd. Documentos', icon: <BarChart3 size={13} /> },
    { key: 'produtos',        label: 'Produtos',         icon: <Package size={13} /> },
    { key: 'participantes',   label: 'Participantes',    icon: <Users size={13} /> },
    { key: 'cfop',            label: 'CFOP',             icon: <Hash size={13} /> },
  ]

  const alertasPagina = getPageItems(alertas, paginaRel, pageSizeRel)
  const dadosMensaisPagina = getPageItems(dadosMensais, paginaRel, pageSizeRel)
  const topProdutosPagina = getPageItems(topProdutos, paginaRel, pageSizeRel)
  const participantesPagina = getPageItems(participantes, paginaRel, pageSizeRel)
  const cfopsPagina = getPageItems(cfops, paginaRel, pageSizeRel)
  const ncmsPagina = getPageItems(ncms, paginaRel, pageSizeRel)

  const isResumoFiscal = (linha: RelatorioFiscalLinha): linha is RelatorioFiscalResumo => 'grupo_label' in linha
  const isProdutoFiscal = (linha: RelatorioFiscalLinha): linha is RelatorioFiscalProduto => 'documento_id' in linha
  const isDocumentoFiscal = (linha: RelatorioFiscalLinha): linha is RelatorioFiscalDocumento => !isResumoFiscal(linha) && !isProdutoFiscal(linha)
  const docProduto = (linha: RelatorioFiscalProduto) => Array.isArray(linha.fa_documentos_fiscais)
    ? linha.fa_documentos_fiscais[0]
    : linha.fa_documentos_fiscais
  const participanteFiscal = (doc: RelatorioFiscalDocumento | RelatorioFiscalDocumentoJoin | null | undefined) => {
    if (!doc) return '—'
    return doc.tipo_movimento === 'entrada'
      ? (doc.emitente_nome || doc.emitente_cnpj || '—')
      : (doc.destinatario_nome || doc.destinatario_cnpj || '—')
  }
  const dataFiscal = (data?: string | null) => data ? new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR') : '—'
  const labelAgrupamentoFiscal: Record<OrdemFiscal, string> = {
    documento: 'Documento',
    cfop: 'CFOP',
    participante: 'Cliente/Fornecedor',
    estado: 'Estado',
    dia: 'Dia',
    aliquota: 'Alíquota',
    produto: 'Produto',
    ncm: 'NCM',
    cst: 'CST/CSOSN',
  }
  const tituloFiscal = resumidoFiscal
    ? `Resumo por ${labelAgrupamentoFiscal[ordemFiscal]}`
    : abaAtiva === 'produtos'
      ? 'Analítico de produtos'
      : 'Analítico de documentos'
  const tituloRelatorioFiscal = abaAtiva === 'cfop'
    ? 'Resumo por CFOP'
    : tituloFiscal

  const competenciaDaLinha = (linha: RelatorioFiscalLinha) => {
    if (isResumoFiscal(linha)) return linha.competencia ?? ''
    if (isProdutoFiscal(linha)) return docProduto(linha)?.data_competencia ?? ''
    return linha.data_competencia ?? ''
  }

  const nomeArquivoExcel = () => {
    const aba = ABAS.find(a => a.key === abaAtiva)?.label.replace(/[^\w.-]+/g, '_') ?? 'relatorio'
    const periodo = [compInicio || 'inicio', compFim || compInicio || 'fim'].join('_a_')
    return `Relatorio_${aba}_${periodo}.xlsx`
  }

  async function buscarFiscalParaExcel() {
    const todas: RelatorioFiscalLinha[] = []
    const tamanho = 1000
    let pagina = 1

    while (true) {
      const params = new URLSearchParams({
        empresa_id: empresaId ?? '',
        nivel: abaAtiva === 'entradas_saidas' ? 'documento' : 'produto',
        ordem: abaAtiva === 'cfop' ? 'cfop' : ordemFiscal,
        resumido: String(abaAtiva === 'cfop' ? true : resumidoFiscal),
        page: String(pagina),
        page_size: String(tamanho),
      })
      if (compInicio) params.set('competencia_inicio', compInicio)
      if (compFim) params.set('competencia_fim', compFim)
      if (tipoMov) params.set('tipo_movimento', tipoMov)

      const res = await fetch(`/api/relatorios/entradas-saidas?${params}`)
      const body = await res.json() as RelatorioFiscalResposta
      if (!res.ok && body.error?.toLowerCase().includes('requested range not satisfiable') && todas.length > 0) break
      if (!res.ok) throw new Error(body.error ?? 'Erro ao exportar relatório.')
      const rows = Array.isArray(body.rows) ? body.rows : []
      if (rows.length === 0) break
      todas.push(...rows)
      if (rows.length < tamanho) break
      pagina += 1
    }

    return todas
  }

  async function exportarExcel() {
    if (!empresaId || abaAtiva === 'inconsistencias') return
    setExportandoExcel(true)
    setErroRel(null)
    try {
      const rowsFonte = abaFiscal ? await buscarFiscalParaExcel() : []
      let rows: Record<string, string | number | null | undefined>[] = []

      if (abaFiscal) {
        if (abaAtiva === 'cfop' || resumidoFiscal) {
          rows = rowsFonte.filter(isResumoFiscal).map(r => ({
            Competencia: competenciaDaLinha(r),
            Grupo: r.grupo_label,
            Movimento: r.tipo_movimento ?? '',
            Quantidade: r.quantidade,
            Documentos: r.documentos,
            Valor_Contabil: r.valor_contabil,
            Base_ICMS: r.base_icms,
            ICMS: r.valor_icms,
            ST: r.valor_st,
            IPI: r.valor_ipi,
          }))
        } else if (abaAtiva === 'produtos') {
          rows = rowsFonte.filter(isProdutoFiscal).map(p => {
            const doc = docProduto(p)
            return {
              Competencia: competenciaDaLinha(p),
              Data: dataFiscal(doc?.data_emissao),
              Nota: doc?.numero ?? '',
              Movimento: doc?.tipo_movimento ?? p.tipo_movimento ?? '',
              Participante: participanteFiscal(doc),
              Produto: p.descricao ?? '',
              NCM: p.ncm ?? '',
              CFOP: p.cfop ?? '',
              CST_CSOSN: p.cst_icms || p.csosn || '',
              Quantidade: Number(p.quantidade ?? 0),
              Valor_Contabil: Number(p.valor_total ?? 0),
              Base_ICMS: Number(p.valor_bc_icms ?? 0),
              Aliquota_ICMS: Number(p.aliquota_icms ?? 0),
              ICMS: Number(p.valor_icms ?? 0),
              ST: Number(p.valor_st ?? 0),
              IPI: Number(p.valor_ipi ?? 0),
            }
          })
        } else {
          rows = rowsFonte.filter(isDocumentoFiscal).map(d => ({
            Competencia: competenciaDaLinha(d),
            Data: dataFiscal(d.data_emissao),
            Nota: d.numero ?? '',
            Serie: d.serie ?? '',
            Modelo: d.modelo ?? '',
            Movimento: d.tipo_movimento,
            Participante: participanteFiscal(d),
            Valor_Contabil: Number(d.valor_total ?? 0),
            Desconto: Number(d.valor_desconto ?? 0),
            Frete: Number(d.valor_frete ?? 0),
            ICMS: Number(d.valor_icms ?? 0),
            IPI: Number(d.valor_ipi ?? 0),
          }))
        }
      } else if (abaAtiva === 'documentos') {
        rows = dadosMensais.map(d => ({
          Competencia: d.competencia,
          Origem: d.origem ?? '',
          Entradas: d.total_entrada,
          Qtd_Entradas: d.count_entrada,
          Saidas: d.total_saida,
          Qtd_Saidas: d.count_saida,
          Total: d.total_entrada + d.total_saida,
        }))
      } else if (abaAtiva === 'participantes') {
        // Fetch dedicado para exportação: sem limit=5000, retorna todos os participantes
        const pExport = new URLSearchParams({ empresa_id: empresaId ?? '', tipo: tipoParticipante })
        if (compInicio) pExport.set('competencia_inicio', compInicio)
        if (compFim) pExport.set('competencia_fim', compFim)
        const resP = await fetch(`/api/relatorios/participantes?${pExport}`)
        if (!resP.ok) throw new Error('Erro ao exportar participantes.')
        const dataP = await resP.json() as Participante[]
        rows = dataP.map(p => ({
          CNPJ: p.cnpj,
          Razao_Social: p.nome,
          Documentos: p.count,
          Valor_Total: p.valor_total,
        }))
      } else if (abaAtiva === 'ncm') {
        // Fetch dedicado para exportação: sem limit=5000, retorna todos os NCMs
        const pNcm = new URLSearchParams({ empresa_id: empresaId ?? '' })
        if (compInicio) pNcm.set('competencia_inicio', compInicio)
        if (compFim) pNcm.set('competencia_fim', compFim)
        if (tipoMov) pNcm.set('tipo_movimento', tipoMov)
        const resN = await fetch(`/api/relatorios/ncm?${pNcm}`)
        if (!resN.ok) throw new Error('Erro ao exportar NCMs.')
        const dataN = await resN.json() as NcmItem[]
        rows = dataN.map(n => ({
          NCM: n.ncm,
          Produto_Exemplo: n.descricao_exemplo,
          Quantidade: n.quantidade,
          Valor_Total: n.valor_total,
          Participacao: n.participacao,
        }))
      }

      if (rows.length === 0) throw new Error('NÃ£o hÃ¡ dados para exportar.')
      const wb = XLSX.utils.book_new()
      const maxLinhasPorAba = 900000
      for (let i = 0; i < rows.length; i += maxLinhasPorAba) {
        const parte = rows.slice(i, i + maxLinhasPorAba)
        const ws = XLSX.utils.json_to_sheet(parte)
        const sufixo = rows.length > maxLinhasPorAba ? `_${Math.floor(i / maxLinhasPorAba) + 1}` : ''
        XLSX.utils.book_append_sheet(wb, ws, `Relatorio${sufixo}`)
      }
      XLSX.writeFile(wb, nomeArquivoExcel())
    } catch (err) {
      setErroRel(err instanceof Error ? err.message : 'Erro ao exportar Excel')
    } finally {
      setExportandoExcel(false)
    }
  }

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
            <input style={S.input} type="month" placeholder="Competencia inicial" value={compInicio} onChange={e => setCompInicio(e.target.value)} title="Competencia inicial" />
            <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>ate</span>
            <input style={S.input} type="month" placeholder="Competencia final" value={compFim} onChange={e => setCompFim(e.target.value)} title="Competencia final" />
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

          <GlassCard style={{ marginBottom: 16 }} padding="0">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--af-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={15} color="var(--af-primary)" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--af-text)' }}>Divergencias PGDAS x XML</div>
                  <div style={{ fontSize: 11, color: 'var(--af-muted)', marginTop: 2 }}>Competencias com diferenca no confronto do Simples e notas candidatas para revisao.</div>
                </div>
              </div>
              <button style={btnAcao('var(--af-primary)')} onClick={carregarDivergenciasSimples} disabled={loadingDivSimples}>
                {loadingDivSimples ? 'Consultando...' : 'Consultar'}
              </button>
            </div>

            {erroDivSimples && (
              <div style={{ padding: 14, color: 'var(--af-danger)', fontSize: 12, fontWeight: 700 }}>
                {erroDivSimples}
              </div>
            )}

            {!erroDivSimples && loadingDivSimples && (
              <div style={{ padding: 14, color: 'var(--af-muted)', fontSize: 12 }}>Carregando divergencias do Simples...</div>
            )}

            {!erroDivSimples && !loadingDivSimples && divergenciasSimples.length === 0 && (
              <div style={{ padding: 14, color: 'var(--af-muted)', fontSize: 12 }}>Nenhuma divergencia PGDAS x XML encontrada para os filtros.</div>
            )}

            {!erroDivSimples && !loadingDivSimples && divergenciasSimples.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ ...S.table, minWidth: 980 }}>
                  <thead>
                    <tr>
                      <th style={S.th}>Competencia</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>PGDAS</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>XML considerado</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Diferenca</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Variacao</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Docs</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Candidatas</th>
                      <th style={S.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divergenciasSimples.map(div => {
                      const aberta = divSimplesExpandida === div.competencia
                      const cor = div.status === 'critico' ? 'var(--af-danger)' : 'var(--af-warning)'
                      return (
                        <>
                          <tr key={div.competencia} style={{ cursor: 'pointer' }} onClick={() => setDivSimplesExpandida(aberta ? null : div.competencia)}>
                            <td style={{ ...S.td, fontWeight: 800, color: 'var(--af-text)' }}>{competenciaLabel(div.competencia)}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(div.receita_pgdas)}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(div.receita_xml)}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: cor, fontWeight: 800 }}>{fmoe(div.diferenca)}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: cor, fontWeight: 700 }}>{(div.variacao * 100).toFixed(2).replace('.', ',')}%</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{div.qtd_documentos}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{div.qtd_candidatos}</td>
                            <td style={S.td}>
                              <span style={chipNivel(div.status === 'critico' ? 'critico' : 'medio')}>{div.status === 'critico' ? 'Critico' : 'Divergencia'}</span>
                              <span style={{ marginLeft: 8, verticalAlign: 'middle' }}>{aberta ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
                            </td>
                          </tr>
                          {aberta && (
                            <tr>
                              <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid var(--af-border)' }}>
                                <div style={{ padding: 14, background: 'var(--af-surface-2)' }}>
                                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--af-text)', marginBottom: 8 }}>Notas candidatas</div>
                                  {div.candidatos.length === 0 ? (
                                    <div style={{ fontSize: 12, color: 'var(--af-muted)' }}>Nenhuma nota candidata encontrada automaticamente.</div>
                                  ) : (
                                    <table style={{ ...S.table, minWidth: 900 }}>
                                      <thead>
                                        <tr>
                                          <th style={S.th}>Nota</th>
                                          <th style={S.th}>Data</th>
                                          <th style={S.th}>Participante</th>
                                          <th style={S.th}>CFOPs</th>
                                          <th style={S.th}>Motivo</th>
                                          <th style={{ ...S.th, textAlign: 'right' }}>Valor</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {div.candidatos.map(c => (
                                          <tr key={`${div.competencia}-${c.documento_id}`}>
                                            <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-text)' }}>{c.numero}</td>
                                            <td style={S.td}>{dataFiscal(c.data_emissao)}</td>
                                            <td style={S.td}>{c.participante}</td>
                                            <td style={S.td}>{c.cfops || '-'}</td>
                                            <td style={S.td}>{c.motivo}</td>
                                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmoe(c.valor)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

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
            {alertasPagina.map(a => {
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
          <PaginationControls
            total={alertas.length}
            page={paginaRel}
            pageSize={pageSizeRel}
            onPageChange={setPaginaRel}
            onPageSizeChange={trocarPageSizeRel}
          />
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
            <button style={S.btnAplicar} onClick={abaFiscal ? carregarRelatorioFiscal : carregarRelatorio}>Consultar</button>
            <button
              style={{ ...S.btnAplicar, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--af-surface-2)', border: '1px solid var(--af-border)', color: 'var(--af-text)' }}
              onClick={exportarExcel}
              disabled={exportandoExcel || !empresa}
            >
              <Download size={13} /> {exportandoExcel ? 'Gerando...' : 'Excel'}
            </button>
          </div>

          {abaFiscal && (
            <div style={{ ...S.filterRow, marginTop: -8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Visualização</span>
              {abaAtiva === 'cfop' ? (
                <span style={{ fontSize: 12, color: 'var(--af-text-soft)' }}>Resumo por CFOP</span>
              ) : (
                <>
                  <select
                    style={S.select}
                    value={resumidoFiscal ? 'resumido' : 'detalhado'}
                    onChange={e => {
                      setResumidoFiscal(e.target.value === 'resumido')
                      setPaginaRel(1)
                    }}
                  >
                    <option value="detalhado">Detalhado</option>
                    <option value="resumido">Resumido</option>
                  </select>
                  {resumidoFiscal && (
                    <select
                      style={S.select}
                      value={ordemFiscal}
                      onChange={e => {
                        setOrdemFiscal(e.target.value as OrdemFiscal)
                        setPaginaRel(1)
                      }}
                    >
                      {abaAtiva === 'entradas_saidas' && <option value="documento">Agrupar por documento</option>}
                      {abaAtiva === 'entradas_saidas' && <option value="participante">Agrupar por cliente/fornecedor</option>}
                      <option value="dia">Agrupar por dia</option>
                      {abaAtiva === 'produtos' && <option value="produto">Agrupar por produto</option>}
                      {abaAtiva === 'produtos' && <option value="ncm">Agrupar por NCM</option>}
                      {abaAtiva === 'produtos' && <option value="aliquota">Agrupar por alíquota</option>}
                      {abaAtiva === 'produtos' && <option value="cst">Agrupar por CST/CSOSN</option>}
                    </select>
                  )}
                </>
              )}
              {totalizadoresFiscal && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--af-muted)' }}>
                  Total exibido: <strong style={{ color: 'var(--af-primary)' }}>{fmoe(totalizadoresFiscal.valor_contabil)}</strong>
                </span>
              )}
            </div>
          )}

          {!empresa && (
            <GlassCard>
              <EmptyState icon={<Building2 size={22} />} title="Nenhuma empresa selecionada" description="Selecione uma empresa na barra lateral para gerar relatórios." />
            </GlassCard>
          )}

          {erroRel && empresa && (
            <div style={{ marginBottom: 16, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.28)', borderRadius: 8, padding: '10px 12px', color: 'var(--af-danger)', fontSize: 13, fontWeight: 600 }}>
              Erro ao carregar relatório: {erroRel}
            </div>
          )}
        </>
      )}

      {abaFiscal && empresa && (
        <GlassCard
          title={tituloRelatorioFiscal}
          padding="0"
        >
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : linhasFiscal.length === 0 ? (
            <EmptyState title="Sem dados" description="Nenhuma movimentação encontrada com os filtros aplicados." />
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                {resumidoFiscal ? (
                  <table style={{ ...S.table, minWidth: 860 }}>
                    <thead><tr>
                      <th style={S.th}>CompetÃªncia</th>
                      <th style={S.th}>Grupo</th>
                      <th style={S.th}>Movimento</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Qtd.</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Docs</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Valor Contábil</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Base ICMS</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>ICMS</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>ST</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>IPI</th>
                    </tr></thead>
                    <tbody>
                      {linhasFiscal.filter(isResumoFiscal).map((r, i) => (
                        <tr key={`${r.grupo}-${i}`}>
                          <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-muted)' }}>{r.competencia ? competenciaLabel(r.competencia) : 'â€”'}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-text)' }}>{r.grupo_label}</td>
                          <td style={{ ...S.td, textTransform: 'capitalize' as const }}>{r.tipo_movimento || '—'}</td>
                          <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{r.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                          <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{r.documentos.toLocaleString('pt-BR')}</td>
                          <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: 'var(--af-primary)' }}>{fmoe(r.valor_contabil)}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.base_icms)}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.valor_icms)}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.valor_st)}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(r.valor_ipi)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : abaAtiva === 'produtos' ? (
                  <table style={{ ...S.table, minWidth: 1180 }}>
                    <thead><tr>
                      <th style={S.th}>CompetÃªncia</th>
                      <th style={S.th}>Data</th>
                      <th style={S.th}>Nota</th>
                      <th style={S.th}>Cliente/Fornecedor</th>
                      <th style={S.th}>Produto</th>
                      <th style={S.th}>NCM</th>
                      <th style={S.th}>CFOP</th>
                      <th style={S.th}>CST</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Qtd.</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Valor Contábil</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Base ICMS</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Alíq.</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>ICMS</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>ST</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>IPI</th>
                    </tr></thead>
                    <tbody>
                      {linhasFiscal.filter(isProdutoFiscal).map(p => {
                        const doc = docProduto(p)
                        return (
                          <tr key={p.id}>
                            <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-muted)' }}>{competenciaDaLinha(p) ? competenciaLabel(competenciaDaLinha(p)) : 'â€”'}</td>
                            <td style={S.td}>{dataFiscal(doc?.data_emissao)}</td>
                            <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{doc?.numero || '—'}</td>
                            <td style={{ ...S.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{participanteFiscal(doc)}</td>
                            <td style={{ ...S.td, minWidth: 260 }}>{p.descricao || '—'}</td>
                            <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{p.ncm || '—'}</td>
                            <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{p.cfop || '—'}</td>
                            <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{p.cst_icms || p.csosn || '—'}</td>
                            <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{Number(p.quantidade ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
                            <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: 'var(--af-primary)' }}>{fmoe(Number(p.valor_total ?? 0))}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(p.valor_bc_icms ?? 0))}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{Number(p.aliquota_icms ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(p.valor_icms ?? 0))}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(p.valor_st ?? 0))}</td>
                            <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(p.valor_ipi ?? 0))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table style={{ ...S.table, minWidth: 920 }}>
                    <thead><tr>
                      <th style={S.th}>CompetÃªncia</th>
                      <th style={S.th}>Data</th>
                      <th style={S.th}>Nota</th>
                      <th style={S.th}>Série</th>
                      <th style={S.th}>Modelo</th>
                      <th style={S.th}>Movimento</th>
                      <th style={S.th}>Cliente/Fornecedor</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Valor Contábil</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Desconto</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Frete</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>ICMS</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>IPI</th>
                    </tr></thead>
                    <tbody>
                      {linhasFiscal.filter(isDocumentoFiscal).map(d => (
                        <tr key={d.id}>
                          <td style={{ ...S.td, fontWeight: 700, color: 'var(--af-muted)' }}>{d.data_competencia ? competenciaLabel(d.data_competencia) : 'â€”'}</td>
                          <td style={S.td}>{dataFiscal(d.data_emissao)}</td>
                          <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{d.numero || '—'}</td>
                          <td style={S.td}>{d.serie || '—'}</td>
                          <td style={S.td}>{d.modelo || '—'}</td>
                          <td style={{ ...S.td, textTransform: 'capitalize' as const }}>{d.tipo_movimento}</td>
                          <td style={{ ...S.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{participanteFiscal(d)}</td>
                          <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: 'var(--af-primary)' }}>{fmoe(Number(d.valor_total ?? 0))}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(d.valor_desconto ?? 0))}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(d.valor_frete ?? 0))}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(d.valor_icms ?? 0))}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmoe(Number(d.valor_ipi ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <PaginationControls
                total={totalFiscal}
                page={paginaRel}
                pageSize={pageSizeRel}
                onPageChange={setPaginaRel}
                onPageSizeChange={trocarPageSizeRel}
                pageSizeOptions={[25, 50, 100, 250, 500]}
              />
            </>
          )}
        </GlassCard>
      )}

      {/* ── ABA: DOCUMENTOS ──────────────────────────────────────────────────── */}
      {abaAtiva === 'documentos' && empresa && (
        <GlassCard title="Quantidade de documentos por competência" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : dadosMensais.length === 0 ? (
            <EmptyState title="Sem dados" description="Nenhum documento encontrado com os filtros aplicados." />
          ) : (
            <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Competência</th>
                <th style={S.th}>Origem</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Entradas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd. Entradas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Saídas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd. Saídas</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Total</th>
              </tr></thead>
              <tbody>
                {dadosMensaisPagina.map((d, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{competenciaLabel(d.competencia)}</td>
                    <td style={S.td}>{d.origem || '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-primary)' }}>{fmoe(d.total_entrada)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{d.count_entrada}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-accent)' }}>{fmoe(d.total_saida)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{d.count_saida}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmoe(d.total_entrada + d.total_saida)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls total={dadosMensais.length} page={paginaRel} pageSize={pageSizeRel} onPageChange={setPaginaRel} onPageSizeChange={trocarPageSizeRel} />
            </>
          )}
        </GlassCard>
      )}

      {/* ── ABA: PRODUTOS ────────────────────────────────────────────────────── */}
      {false && abaAtiva === 'produtos' && empresa && (
        <GlassCard title="Produtos mais movimentados" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : topProdutos.length === 0 ? (
            <EmptyState icon={<Package size={22} />} title="Sem dados" description="Nenhum produto encontrado com os filtros aplicados." />
          ) : (
            <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Descrição</th>
                <th style={S.th}>Competência</th>
                <th style={S.th}>Movimento</th>
                <th style={S.th}>NCM</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Ocorrências</th>
              </tr></thead>
              <tbody>
                {topProdutosPagina.map((p, i) => (
                  <tr key={i}>
                    <td style={S.td}>{p.descricao || '—'}</td>
                    <td style={S.td}>{p.competencia ? competenciaLabel(p.competencia) : '—'}</td>
                    <td style={S.td}>{p.tipo_movimento === 'entrada' ? 'Entrada' : p.tipo_movimento === 'saida' ? 'Saída' : (p.tipo_movimento || '—')}</td>
                    <td style={{ ...S.td, fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{p.ncm || '—'}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{p.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: 'var(--af-primary)' }}>{fmoe(p.valor_total)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--af-muted)' }}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls total={topProdutos.length} page={paginaRel} pageSize={pageSizeRel} onPageChange={setPaginaRel} onPageSizeChange={trocarPageSizeRel} />
            </>
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
            <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>CNPJ</th>
                <th style={S.th}>Razão Social</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Docs</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={S.th}>Dados Receita</th>
              </tr></thead>
              <tbody>
                {participantesPagina.map((p, i) => {
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
            <PaginationControls total={participantes.length} page={paginaRel} pageSize={pageSizeRel} onPageChange={setPaginaRel} onPageSizeChange={trocarPageSizeRel} />
            </>
          )}
        </GlassCard>
      )}

      {/* ── ABA: CFOP ────────────────────────────────────────────────────────── */}
      {false && abaAtiva === 'cfop' && empresa && (
        <GlassCard title="CFOPs utilizados" padding="0">
          {loadingRel ? (
            <div style={{ padding: 20, color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
          ) : cfops.length === 0 ? (
            <EmptyState icon={<Hash size={22} />} title="Sem dados" description="Nenhum CFOP encontrado com os filtros aplicados." />
          ) : (
            <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>CFOP</th>
                <th style={S.th}>Tipo</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Itens</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Participação</th>
              </tr></thead>
              <tbody>
                {cfopsPagina.map((c, i) => (
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
            <PaginationControls total={cfops.length} page={paginaRel} pageSize={pageSizeRel} onPageChange={setPaginaRel} onPageSizeChange={trocarPageSizeRel} />
            </>
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
            <>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>NCM</th>
                <th style={S.th}>Exemplo de produto</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Qtd.</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Valor Total</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Participação</th>
              </tr></thead>
              <tbody>
                {ncmsPagina.map((n, i) => (
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
            <PaginationControls total={ncms.length} page={paginaRel} pageSize={pageSizeRel} onPageChange={setPaginaRel} onPageSizeChange={trocarPageSizeRel} />
            </>
          )}
        </GlassCard>
      )}
    </div>
  )
}
