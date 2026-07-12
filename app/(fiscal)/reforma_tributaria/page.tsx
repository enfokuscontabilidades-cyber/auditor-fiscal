'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import * as XLSX from 'xlsx'
import { AlertTriangle, CheckCircle2, Download, FileSearch, Search, SlidersHorizontal } from 'lucide-react'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import { useTheme } from '@/components/ThemeProvider'

type ItemFiscal = {
  id: string
  item_numero?: number
  codigo_produto?: string
  descricao?: string
  ncm?: string
  cfop?: string
  valor_total?: number
  cst_ibs_cbs?: string
  cclass_trib?: string
  valor_bc_ibs_cbs?: number
  aliquota_ibs_uf?: number
  valor_ibs_uf?: number
  aliquota_ibs_mun?: number
  valor_ibs_mun?: number
  valor_ibs?: number
  aliquota_cbs?: number
  valor_cbs?: number
}

type DocumentoFiscal = {
  id: string
  numero?: string
  chave_acesso?: string
  data_emissao?: string
  data_competencia?: string
  emitente_nome?: string
  emitente_cnpj?: string
  destinatario_nome?: string
  destinatario_cnpj?: string
  tipo_movimento?: string
  status?: string
  fa_documentos_itens?: ItemFiscal[]
}

type ItemXmlSaida = {
  id?: string
  numero_nota?: string
  destinatario?: string
  data?: string
  codigo_produto?: string
  descricao?: string
  ncm?: string
  cfop?: string
  valor_contabil?: number
  valor_produto?: number
  cst_ibs_cbs?: string
  cclass_trib?: string
  base_ibs_cbs?: number
  aliquota_ibs_uf?: number
  valor_ibs_uf?: number
  aliquota_ibs_mun?: number
  valor_ibs_mun?: number
  valor_ibs?: number
  aliquota_cbs?: number
  valor_cbs?: number
  status?: string
  cancelada?: boolean
}

type ArquivoXmlFiscal = {
  id: string
  chave_nfe?: string
  numero_nf?: string
  data_emissao?: string
  competencia?: string
  tipo_operacao?: string
  destinatario_nome?: string
  destinatario_cnpj?: string
  parsed_data?: {
    itens_saida?: ItemXmlSaida[]
  } | null
}

type LinhaRelatorio = {
  chave: string
  documentoId: string
  itemId: string
  competencia: string
  nota: string
  data: string
  participante: string
  produto: string
  ncm: string
  cfop: string
  valorItem: number
  cst: string
  cclass: string
  base: number
  aliquotaIbsUf: number
  valorIbsUf: number
  aliquotaIbsMun: number
  valorIbsMun: number
  valorIbs: number
  aliquotaCbs: number
  valorCbs: number
  destacado: boolean
  alertas: string[]
  situacao: 'ok' | 'alerta' | 'critico'
}

type SituacaoFiltro = 'todos' | 'destacadas' | 'sem_destaque' | 'divergencias'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numberFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const ALIQUOTA_IBS_UF_2026 = 0.1
const ALIQUOTA_CBS_2026 = 0.9

function n(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function dataBr(data?: string) {
  if (!data) return '-'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return data
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
}

function competenciaDaData(data?: string) {
  if (!data) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [, mes, ano] = data.split('/')
    return `${ano}-${mes}`
  }
  const m = data.slice(0, 7)
  return /^\d{4}-\d{2}$/.test(m) ? m : ''
}

function temReforma(item: Partial<ItemFiscal> & Partial<ItemXmlSaida>) {
  return Boolean(
    item.cst_ibs_cbs ||
    item.cclass_trib ||
    n(item.valor_bc_ibs_cbs) > 0 ||
    n(item.base_ibs_cbs) > 0 ||
    n(item.valor_ibs) > 0 ||
    n(item.valor_cbs) > 0 ||
    n(item.valor_ibs_uf) > 0 ||
    n(item.valor_ibs_mun) > 0,
  )
}

function arred2(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

function analisarLinha(base: Omit<LinhaRelatorio, 'alertas' | 'situacao'>): Pick<LinhaRelatorio, 'alertas' | 'situacao'> {
  const alertas: string[] = []
  if (!base.destacado) {
    alertas.push('Sem destaque de IBS/CBS')
  } else {
    if (!base.cst || base.cst === '-') alertas.push('CST IBS/CBS ausente')
    if (!base.cclass || base.cclass === '-') alertas.push('cClassTrib ausente')
    if (base.aliquotaIbsUf > 0 && Math.abs(base.aliquotaIbsUf - ALIQUOTA_IBS_UF_2026) > 0.0001) {
      alertas.push(`Aliquota IBS UF diferente de ${numberFmt.format(ALIQUOTA_IBS_UF_2026)}%`)
    }
    if (base.aliquotaCbs > 0 && Math.abs(base.aliquotaCbs - ALIQUOTA_CBS_2026) > 0.0001) {
      alertas.push(`Aliquota CBS diferente de ${numberFmt.format(ALIQUOTA_CBS_2026)}%`)
    }
    const baseCalculo = base.base || base.valorItem
    if (baseCalculo > 0 && base.valorIbsUf > 0) {
      const esperado = arred2(baseCalculo * (ALIQUOTA_IBS_UF_2026 / 100))
      if (Math.abs(base.valorIbsUf - esperado) > 0.02) alertas.push(`IBS UF esperado: ${money.format(esperado)}`)
    }
    if (baseCalculo > 0 && base.valorCbs > 0) {
      const esperado = arred2(baseCalculo * (ALIQUOTA_CBS_2026 / 100))
      if (Math.abs(base.valorCbs - esperado) > 0.02) alertas.push(`CBS esperado: ${money.format(esperado)}`)
    }
  }
  return { alertas, situacao: alertas.length ? (base.destacado ? 'alerta' : 'critico') : 'ok' }
}

function montarLinha(base: Omit<LinhaRelatorio, 'alertas' | 'situacao' | 'destacado'> & { destacado?: boolean }): LinhaRelatorio {
  const destacado = base.destacado ?? temReforma({
    cst_ibs_cbs: base.cst === '-' ? undefined : base.cst,
    cclass_trib: base.cclass === '-' ? undefined : base.cclass,
    valor_bc_ibs_cbs: base.base,
    valor_ibs: base.valorIbs,
    valor_cbs: base.valorCbs,
    valor_ibs_uf: base.valorIbsUf,
    valor_ibs_mun: base.valorIbsMun,
  })
  const linhaBase = { ...base, destacado }
  return { ...linhaBase, ...analisarLinha(linhaBase) }
}

function mesLabel(comp: string) {
  if (!/^\d{4}-\d{2}$/.test(comp)) return comp
  const [ano, mes] = comp.split('-')
  return `${mes}/${ano}`
}

function normalizarChave(valor?: string) {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function chaveItemReforma(args: {
  nota?: string
  codigo?: string
  descricao?: string
  ncm?: string
  cfop?: string
}) {
  const identificador = normalizarChave(args.codigo) || normalizarChave(args.descricao)
  return [
    normalizarChave(args.nota),
    identificador,
    normalizarChave(args.ncm),
    normalizarChave(args.cfop),
  ].join('|')
}

function escolherLinhaPreferida(atual: LinhaRelatorio | undefined, proxima: LinhaRelatorio) {
  if (!atual) return proxima
  if (!atual.destacado && proxima.destacado) return proxima
  if (atual.destacado && !proxima.destacado) return atual
  const scoreAtual = atual.base + atual.valorIbs + atual.valorCbs + (atual.cst !== '-' ? 1 : 0) + (atual.cclass !== '-' ? 1 : 0)
  const scoreProxima = proxima.base + proxima.valorIbs + proxima.valorCbs + (proxima.cst !== '-' ? 1 : 0) + (proxima.cclass !== '-' ? 1 : 0)
  return scoreProxima > scoreAtual ? proxima : atual
}

export default function ReformaTributariaPage() {
  const { empresaAtiva } = useEmpresaAtiva()
  const { tema } = useTheme()
  const [docs, setDocs] = useState<DocumentoFiscal[]>([])
  const [xmls, setXmls] = useState<ArquivoXmlFiscal[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [competenciaFiltro, setCompetenciaFiltro] = useState('')
  const [situacaoFiltro, setSituacaoFiltro] = useState<SituacaoFiltro>('todos')

  useEffect(() => {
    let ativo = true
    if (!empresaAtiva?.id) {
      queueMicrotask(() => {
        if (!ativo) return
        setDocs([])
        setXmls([])
      })
      return
    }

    queueMicrotask(() => {
      if (!ativo) return
      setCarregando(true)
      setErro('')
    })

    Promise.allSettled([
      fetch(`/api/documentos-fiscais?empresa_id=${empresaAtiva.id}&incluir_itens=true`).then(async r => {
        if (!r.ok) throw new Error(await r.text())
        return r.json() as Promise<DocumentoFiscal[]>
      }),
      fetch(`/api/arquivos-xml?empresa_id=${empresaAtiva.id}&tipo_operacao=saida&incluir_dados=true`).then(async r => {
        if (!r.ok) throw new Error(await r.text())
        return r.json() as Promise<ArquivoXmlFiscal[]>
      }),
    ]).then(([docsResult, xmlsResult]) => {
      if (!ativo) return
      setDocs(docsResult.status === 'fulfilled' && Array.isArray(docsResult.value) ? docsResult.value : [])
      setXmls(xmlsResult.status === 'fulfilled' && Array.isArray(xmlsResult.value) ? xmlsResult.value : [])
      if (docsResult.status === 'rejected' && xmlsResult.status === 'rejected') {
        setErro('Nao foi possivel carregar os documentos fiscais importados.')
      }
    }).finally(() => {
      if (ativo) setCarregando(false)
    })

    return () => { ativo = false }
  }, [empresaAtiva?.id])

  const linhas = useMemo<LinhaRelatorio[]>(() => {
    const mapa = new Map<string, LinhaRelatorio>()

    for (const doc of docs) {
      if (doc.tipo_movimento && doc.tipo_movimento !== 'saida') continue
      const participante = doc.destinatario_nome || doc.destinatario_cnpj || '-'
      for (const item of doc.fa_documentos_itens ?? []) {
        const chave = chaveItemReforma({
          nota: doc.numero,
          codigo: item.codigo_produto,
          descricao: item.descricao,
          ncm: item.ncm,
          cfop: item.cfop,
        })
        const linha = montarLinha({
          chave,
          documentoId: doc.id,
          itemId: item.id,
          competencia: doc.data_competencia || competenciaDaData(doc.data_emissao),
          nota: doc.numero || '-',
          data: doc.data_emissao || '',
          participante,
          produto: item.descricao || item.codigo_produto || '-',
          ncm: item.ncm || '-',
          cfop: item.cfop || '-',
          valorItem: n(item.valor_total),
          cst: item.cst_ibs_cbs || '-',
          cclass: item.cclass_trib || '-',
          base: n(item.valor_bc_ibs_cbs),
          aliquotaIbsUf: n(item.aliquota_ibs_uf),
          valorIbsUf: n(item.valor_ibs_uf),
          aliquotaIbsMun: n(item.aliquota_ibs_mun),
          valorIbsMun: n(item.valor_ibs_mun),
          valorIbs: n(item.valor_ibs),
          aliquotaCbs: n(item.aliquota_cbs),
          valorCbs: n(item.valor_cbs),
        })
        mapa.set(chave, escolherLinhaPreferida(mapa.get(chave), linha))
      }
    }

    for (const xml of xmls) {
      if (xml.tipo_operacao && xml.tipo_operacao !== 'saida') continue
      for (const item of xml.parsed_data?.itens_saida ?? []) {
        const chave = chaveItemReforma({
          nota: item.numero_nota || xml.numero_nf,
          codigo: item.codigo_produto,
          descricao: item.descricao,
          ncm: item.ncm,
          cfop: item.cfop,
        })
        const linha = montarLinha({
          chave,
          documentoId: xml.id,
          itemId: item.id || chave,
          competencia: xml.competencia || competenciaDaData(xml.data_emissao || item.data),
          nota: item.numero_nota || xml.numero_nf || '-',
          data: xml.data_emissao || item.data || '',
          participante: item.destinatario || xml.destinatario_nome || xml.destinatario_cnpj || '-',
          produto: item.descricao || item.codigo_produto || '-',
          ncm: item.ncm || '-',
          cfop: item.cfop || '-',
          valorItem: n(item.valor_contabil) || n(item.valor_produto),
          cst: item.cst_ibs_cbs || '-',
          cclass: item.cclass_trib || '-',
          base: n(item.base_ibs_cbs),
          aliquotaIbsUf: n(item.aliquota_ibs_uf),
          valorIbsUf: n(item.valor_ibs_uf),
          aliquotaIbsMun: n(item.aliquota_ibs_mun),
          valorIbsMun: n(item.valor_ibs_mun),
          valorIbs: n(item.valor_ibs),
          aliquotaCbs: n(item.aliquota_cbs),
          valorCbs: n(item.valor_cbs),
        })
        mapa.set(chave, escolherLinhaPreferida(mapa.get(chave), linha))
      }
    }

    return Array.from(mapa.values()).sort((a, b) => `${b.data}${b.nota}`.localeCompare(`${a.data}${a.nota}`))
  }, [docs, xmls])

  const competencias = useMemo(() => Array.from(new Set(linhas.map(l => l.competencia).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [linhas])

  useEffect(() => {
    if (competenciaFiltro && !competencias.includes(competenciaFiltro)) {
      queueMicrotask(() => setCompetenciaFiltro(''))
    }
  }, [competenciaFiltro, competencias])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return linhas.filter(l => {
      if (competenciaFiltro && l.competencia !== competenciaFiltro) return false
      if (situacaoFiltro === 'destacadas' && !l.destacado) return false
      if (situacaoFiltro === 'sem_destaque' && l.destacado) return false
      if (situacaoFiltro === 'divergencias' && !l.alertas.length) return false
      if (!termo) return true
      return [l.nota, l.participante, l.produto, l.ncm, l.cfop, l.cst, l.cclass, l.competencia]
        .some(v => v.toLowerCase().includes(termo))
    })
  }, [busca, competenciaFiltro, linhas, situacaoFiltro])

  const totais = useMemo(() => ({
    notas: new Set(filtradas.filter(l => l.destacado).map(l => l.documentoId)).size,
    itens: filtradas.filter(l => l.destacado).length,
    semDestaque: filtradas.filter(l => !l.destacado).length,
    divergencias: filtradas.filter(l => l.alertas.length).length,
    ibs: filtradas.reduce((s, l) => s + l.valorIbs, 0),
    cbs: filtradas.reduce((s, l) => s + l.valorCbs, 0),
  }), [filtradas])

  function exportarExcel() {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(filtradas.map(l => ({
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
    const nome = `reforma_tributaria_${(empresaAtiva?.razao_social ?? 'empresa').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, nome)
  }

  const escuro = tema === 'escuro'
  const cor = {
    texto: escuro ? '#e5eef8' : '#0f172a',
    textoSuave: escuro ? 'rgba(203,213,225,0.82)' : '#475569',
    textoFraco: escuro ? 'rgba(203,213,225,0.66)' : '#64748b',
    card: escuro ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.94)',
    cardInterno: escuro ? 'rgba(2,6,23,0.24)' : '#f8fafc',
    borda: escuro ? 'rgba(148,163,184,0.18)' : '#d7e2ee',
    bordaForte: escuro ? 'rgba(148,163,184,0.26)' : '#b9c8d8',
    cabecalhoTabela: escuro ? 'rgba(2,6,23,0.36)' : '#eef6fb',
    input: escuro ? 'rgba(2,6,23,0.35)' : '#ffffff',
    inputTexto: escuro ? '#e5eef8' : '#0f172a',
    sombra: escuro ? '0 18px 38px rgba(2,6,23,0.18)' : '0 14px 32px rgba(15,23,42,0.08)',
    ciano: escuro ? '#67e8f9' : '#0e7490',
    ibs: escuro ? '#34d399' : '#047857',
    cbs: escuro ? '#60a5fa' : '#1d4ed8',
    erro: escuro ? '#fca5a5' : '#b91c1c',
    avisoBg: escuro ? 'rgba(251,191,36,0.10)' : '#fff7ed',
    avisoTexto: escuro ? '#fde68a' : '#92400e',
    criticoBg: escuro ? 'rgba(248,113,113,0.10)' : '#fef2f2',
    criticoTexto: escuro ? '#fca5a5' : '#b91c1c',
    okBg: escuro ? 'rgba(34,197,94,0.10)' : '#ecfdf5',
    okTexto: escuro ? '#86efac' : '#047857',
  }

  const card: CSSProperties = {
    background: cor.card,
    border: `1px solid ${cor.borda}`,
    borderRadius: 12,
    boxShadow: cor.sombra,
  }

  const inputStyle: CSSProperties = {
    background: cor.input,
    border: `1px solid ${cor.bordaForte}`,
    color: cor.inputTexto,
    borderRadius: 9,
    padding: '11px 12px',
    outline: 'none',
    colorScheme: escuro ? 'dark' : 'light',
  }

  return (
    <main style={{ padding: 24, color: cor.texto }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 850, letterSpacing: 0 }}>Reforma Tributaria</h1>
          <p style={{ margin: '6px 0 0', color: cor.textoSuave, fontSize: 14 }}>
            Conferencia de IBS e CBS nas NF-e importadas, incluindo notas sem destaque e divergencias.
          </p>
        </div>
        <button
          type="button"
          onClick={exportarExcel}
          disabled={!filtradas.length}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(39,199,216,0.45)',
            background: filtradas.length ? 'linear-gradient(90deg, #0ea5e9, #06b6d4)' : (escuro ? 'rgba(148,163,184,0.12)' : '#eef2f7'),
            color: filtradas.length ? '#fff' : cor.textoFraco, borderRadius: 10, padding: '11px 16px', fontWeight: 800,
            cursor: filtradas.length ? 'pointer' : 'not-allowed', opacity: filtradas.length ? 1 : 0.55,
          }}
        >
          <Download size={16} /> Exportar Excel
        </button>
      </div>

      <section style={{ ...card, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          ['Notas com destaque', String(totais.notas)],
          ['Itens com destaque', String(totais.itens)],
          ['Itens sem destaque', String(totais.semDestaque)],
          ['Divergencias', String(totais.divergencias)],
          ['Total IBS', money.format(totais.ibs)],
          ['Total CBS', money.format(totais.cbs)],
        ].map(([label, value]) => (
          <div key={label} style={{ border: `1px solid ${cor.borda}`, borderRadius: 10, padding: 14, background: cor.cardInterno }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.08, color: cor.textoFraco, fontWeight: 800 }}>{label}</div>
            <div style={{ marginTop: 8, fontSize: 22, fontWeight: 850 }}>{value}</div>
          </div>
        ))}
      </section>

      <section style={{ ...card, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 180px 210px', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Search size={16} color={cor.ciano} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Nota, participante, produto, NCM, CFOP, CST ou cClass..."
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <select value={competenciaFiltro} onChange={e => setCompetenciaFiltro(e.target.value)} style={inputStyle}>
            <option value="">Todos os meses</option>
            {competencias.map(c => <option key={c} value={c}>{mesLabel(c)}</option>)}
          </select>
          <select value={situacaoFiltro} onChange={e => setSituacaoFiltro(e.target.value as SituacaoFiltro)} style={inputStyle}>
            <option value="todos">Todas as notas</option>
            <option value="destacadas">Com IBS/CBS</option>
            <option value="sem_destaque">Sem IBS/CBS</option>
            <option value="divergencias">Com alertas</option>
          </select>
        </div>
      </section>

      <section style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${cor.borda}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileSearch size={16} color={cor.ciano} />
          <strong>Conferencia de IBS/CBS por item</strong>
          {carregando && <span style={{ marginLeft: 'auto', color: cor.textoFraco, fontSize: 12 }}>Carregando...</span>}
        </div>
        {erro ? (
          <div style={{ padding: 24, color: cor.erro }}>{erro}</div>
        ) : !empresaAtiva ? (
          <div style={{ padding: 34, textAlign: 'center', color: cor.textoFraco }}>Selecione uma empresa ativa para conferir IBS e CBS.</div>
        ) : !filtradas.length ? (
          <div style={{ padding: 34, textAlign: 'center', color: cor.textoSuave }}>
            <SlidersHorizontal size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Nenhum item encontrado para os filtros selecionados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 1380, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: cor.cabecalhoTabela }}>
                  {['Nota', 'Data', 'Participante', 'Produto', 'NCM', 'CFOP', 'Valor', 'IBS/CBS', 'CST', 'cClass', 'Base', 'IBS UF', 'IBS Mun', 'IBS', 'CBS', 'Alertas'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 12px', color: cor.textoSuave, borderBottom: `1px solid ${cor.borda}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(l => {
                  const statusBg = l.situacao === 'ok' ? cor.okBg : l.situacao === 'critico' ? cor.criticoBg : cor.avisoBg
                  const statusColor = l.situacao === 'ok' ? cor.okTexto : l.situacao === 'critico' ? cor.criticoTexto : cor.avisoTexto
                  return (
                    <tr key={l.chave} style={{ borderTop: `1px solid ${cor.borda}` }}>
                      <td style={{ padding: '11px 12px', fontWeight: 800 }}>{l.nota}</td>
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>{dataBr(l.data)}</td>
                      <td style={{ padding: '11px 12px', minWidth: 220 }}>{l.participante}</td>
                      <td style={{ padding: '11px 12px', minWidth: 260 }}>{l.produto}</td>
                      <td style={{ padding: '11px 12px' }}>{l.ncm}</td>
                      <td style={{ padding: '11px 12px', color: cor.ciano, fontWeight: 800 }}>{l.cfop}</td>
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>{money.format(l.valorItem)}</td>
                      <td style={{ padding: '11px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 9px', background: statusBg, color: statusColor, fontWeight: 800 }}>
                          {l.destacado ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          {l.destacado ? 'Sim' : 'Nao'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px' }}>{l.cst}</td>
                      <td style={{ padding: '11px 12px' }}>{l.cclass}</td>
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>{money.format(l.base)}</td>
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>{money.format(l.valorIbsUf)} <span style={{ color: cor.textoFraco }}>({numberFmt.format(l.aliquotaIbsUf)}%)</span></td>
                      <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>{money.format(l.valorIbsMun)} <span style={{ color: cor.textoFraco }}>({numberFmt.format(l.aliquotaIbsMun)}%)</span></td>
                      <td style={{ padding: '11px 12px', color: cor.ibs, fontWeight: 800, whiteSpace: 'nowrap' }}>{money.format(l.valorIbs)}</td>
                      <td style={{ padding: '11px 12px', color: cor.cbs, fontWeight: 800, whiteSpace: 'nowrap' }}>{money.format(l.valorCbs)}</td>
                      <td style={{ padding: '11px 12px', minWidth: 240 }}>
                        {l.alertas.length ? l.alertas.map(a => (
                          <span key={a} style={{ display: 'inline-flex', margin: '2px 4px 2px 0', borderRadius: 999, padding: '3px 8px', background: statusBg, color: statusColor, fontSize: 11, fontWeight: 700 }}>{a}</span>
                        )) : <span style={{ color: cor.okTexto, fontWeight: 700 }}>OK</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
