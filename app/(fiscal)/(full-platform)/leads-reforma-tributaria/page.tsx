'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import * as XLSX from 'xlsx'
import { Download, FileText, Lock, Mail, MessageCircle, Search, X } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { formatarCnpj, formatarTelefoneBr } from '@/lib/validacao/documentos'

type ResumoAnalise = {
  situacao_geral?: 'ok' | 'alerta' | 'critico'
  arquivos_ok?: number
  arquivos_alerta?: number
  arquivos_critico?: number
  arquivos_com_falha?: number
  total_ibs?: number
  total_cbs?: number
} | null

type Lead = {
  id: string
  nome: string
  empresa: string
  cnpj: string | null
  telefone: string
  email: string
  regime_tributario: string
  estado: string | null
  cidade: string | null
  sistema_emissor: string | null
  origem: string
  campanha: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  status: string
  codigo_diagnostico: string | null
  quantidade_xmls: number
  resumo_analise: ResumoAnalise
  observacoes: string | null
  consentimento_contato: boolean
  created_at: string
  diagnostico_relatorio: {
    token: string
    criado_em: string
    relatorio_gerado_em: string | null
    downloads_count: number
    status: string
  } | null
}

const STATUS_OPCOES = [
  ['novo', 'Novo'], ['diagnostico_iniciado', 'Diagnóstico iniciado'], ['diagnostico_concluido', 'Diagnóstico concluído'],
  ['aguardando_contato', 'Aguardando contato'], ['contatado', 'Contatado'], ['reuniao_agendada', 'Reunião agendada'],
  ['proposta_enviada', 'Proposta enviada'], ['convertido', 'Convertido'], ['sem_interesse', 'Sem interesse'], ['invalido', 'Inválido'],
] as const

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Outros', 'Não sei informar']

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function statusLabel(status: string) {
  return STATUS_OPCOES.find(([v]) => v === status)?.[1] || status
}

function dataHoraBr(iso: string) {
  try { return new Date(iso).toLocaleString('pt-BR') } catch { return iso }
}

function linkRelatorioPdf(token: string) {
  return `/api/diagnostico-reforma-tributaria/relatorio/${token}`
}

function linkWhatsappLead(lead: Lead) {
  const telefone = lead.telefone.replace(/\D/g, '')
  const numero = telefone.startsWith('55') ? telefone : `55${telefone}`
  const mensagem = `Olá, ${lead.nome}! Aqui é da Enfokus Contabilidade. Vi que você fez o diagnóstico de IBS/CBS da Reforma Tributária para a empresa ${lead.empresa}${lead.codigo_diagnostico ? ` (código ${lead.codigo_diagnostico})` : ''} e gostaria de conversar sobre o resultado.`
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}

function linkEmailLead(lead: Lead) {
  const assunto = `Diagnóstico IBS/CBS - ${lead.empresa}`
  const corpo = `Olá, ${lead.nome}.\n\nAqui é da Enfokus Contabilidade. Vi que você realizou o diagnóstico de IBS/CBS da Reforma Tributária para a empresa ${lead.empresa}${lead.codigo_diagnostico ? `, código ${lead.codigo_diagnostico}` : ''}.\n\nGostaria de conversar sobre o resultado e os próximos passos.\n\nAtenciosamente,\nEnfokus Contabilidade`
  return `mailto:${lead.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`
}

export default function LeadsReformaTributariaPage() {
  const { tema } = useTheme()
  const escuro = tema === 'escuro'

  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [regimeFiltro, setRegimeFiltro] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const [selecionado, setSelecionado] = useState<Lead | null>(null)
  const [observacoesRascunho, setObservacoesRascunho] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    fetch('/api/leads-reforma-tributaria/acesso')
      .then(r => r.json())
      .then((d: { permitido?: boolean }) => setPermitido(Boolean(d.permitido)))
      .catch(() => setPermitido(false))
  }, [])

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const params = new URLSearchParams()
      if (busca.trim()) params.set('busca', busca.trim())
      if (statusFiltro) params.set('status', statusFiltro)
      if (regimeFiltro) params.set('regime', regimeFiltro)
      if (dataInicio) params.set('data_inicio', new Date(dataInicio).toISOString())
      if (dataFim) params.set('data_fim', new Date(`${dataFim}T23:59:59`).toISOString())

      const resp = await fetch(`/api/leads-reforma-tributaria?${params.toString()}`)
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || 'Não foi possível carregar os leads.')
      }
      setLeads(await resp.json())
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar os leads.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (!permitido) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permitido])

  function abrirDetalhes(lead: Lead) {
    setSelecionado(lead)
    setObservacoesRascunho(lead.observacoes || '')
  }

  async function atualizarStatus(lead: Lead, novoStatus: string) {
    setSalvando(true)
    try {
      await fetch(`/api/leads-reforma-tributaria/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      })
      setLeads(atual => atual.map(l => l.id === lead.id ? { ...l, status: novoStatus } : l))
      setSelecionado(atual => atual && atual.id === lead.id ? { ...atual, status: novoStatus } : atual)
    } finally {
      setSalvando(false)
    }
  }

  async function salvarObservacoes() {
    if (!selecionado) return
    setSalvando(true)
    try {
      await fetch(`/api/leads-reforma-tributaria/${selecionado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacoes: observacoesRascunho }),
      })
      setLeads(atual => atual.map(l => l.id === selecionado.id ? { ...l, observacoes: observacoesRascunho } : l))
      setSelecionado(atual => atual ? { ...atual, observacoes: observacoesRascunho } : atual)
    } finally {
      setSalvando(false)
    }
  }

  function exportarExcel() {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(leads.map(l => ({
      Data: dataHoraBr(l.created_at),
      Nome: l.nome,
      Empresa: l.empresa,
      CNPJ: l.cnpj ? formatarCnpj(l.cnpj) : '',
      Telefone: l.telefone,
      Email: l.email,
      Regime: l.regime_tributario,
      Estado: l.estado,
      Cidade: l.cidade,
      Sistema_Emissor: l.sistema_emissor,
      Origem: l.origem,
      Campanha: l.campanha,
      UTM_Source: l.utm_source,
      UTM_Medium: l.utm_medium,
      UTM_Campaign: l.utm_campaign,
      Status: statusLabel(l.status),
      Codigo_Diagnostico: l.codigo_diagnostico,
      Qtd_XMLs: l.quantidade_xmls,
      Situacao_Diagnostico: l.resumo_analise?.situacao_geral || '',
      Relatorio_PDF: l.diagnostico_relatorio ? 'Disponível' : 'Indisponível',
      Downloads_PDF: l.diagnostico_relatorio?.downloads_count ?? '',
      Autoriza_Contato: l.consentimento_contato ? 'Sim' : 'Não',
      Observacoes: l.observacoes,
    })))
    XLSX.utils.book_append_sheet(wb, ws, 'Leads_Reforma')
    XLSX.writeFile(wb, `leads_reforma_tributaria_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const cor = {
    texto: escuro ? '#e5eef8' : '#0f172a',
    textoSuave: escuro ? 'rgba(203,213,225,0.82)' : '#475569',
    textoFraco: escuro ? 'rgba(203,213,225,0.66)' : '#64748b',
    card: escuro ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.94)',
    borda: escuro ? 'rgba(148,163,184,0.18)' : '#d7e2ee',
    bordaForte: escuro ? 'rgba(148,163,184,0.26)' : '#b9c8d8',
    cabecalhoTabela: escuro ? 'rgba(2,6,23,0.36)' : '#eef6fb',
    input: escuro ? 'rgba(2,6,23,0.35)' : '#ffffff',
    inputTexto: escuro ? '#e5eef8' : '#0f172a',
    sombra: escuro ? '0 18px 38px rgba(2,6,23,0.18)' : '0 14px 32px rgba(15,23,42,0.08)',
    ciano: escuro ? '#67e8f9' : '#0e7490',
  }

  const card: CSSProperties = { background: cor.card, border: `1px solid ${cor.borda}`, borderRadius: 12, boxShadow: cor.sombra }
  const inputStyle: CSSProperties = { background: cor.input, border: `1px solid ${cor.bordaForte}`, color: cor.inputTexto, borderRadius: 9, padding: '10px 11px', outline: 'none', fontSize: 13, colorScheme: escuro ? 'dark' : 'light' }

  const totais = useMemo(() => ({
    total: leads.length,
    convertidos: leads.filter(l => l.status === 'convertido').length,
    aguardando: leads.filter(l => ['novo', 'diagnostico_iniciado', 'diagnostico_concluido', 'aguardando_contato'].includes(l.status)).length,
  }), [leads])

  if (permitido === null) {
    return <main style={{ padding: 24, color: cor.texto }}>Verificando acesso...</main>
  }

  if (!permitido) {
    return (
      <main style={{ padding: 24, color: cor.texto }}>
        <div style={{ ...card, padding: 40, textAlign: 'center', maxWidth: 480, margin: '60px auto' }}>
          <Lock size={28} color={cor.ciano} />
          <h1 style={{ fontSize: 18, marginTop: 14 }}>Acesso restrito</h1>
          <p style={{ color: cor.textoSuave, fontSize: 13.5, marginTop: 8 }}>
            Esta área mostra os leads comerciais da isca digital de Reforma Tributária e é restrita à equipe da
            Enfokus Contabilidade.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: 24, color: cor.texto }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 850 }}>Leads · Diagnóstico Reforma Tributária</h1>
        <p style={{ margin: '6px 0 0', color: cor.textoSuave, fontSize: 14 }}>
          Contatos captados pela página pública de diagnóstico de IBS e CBS.
        </p>
      </div>

      <section style={{ ...card, padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {[
          ['Total de leads', String(totais.total)],
          ['Em funil', String(totais.aguardando)],
          ['Convertidos', String(totais.convertidos)],
        ].map(([label, value]) => (
          <div key={label} style={{ border: `1px solid ${cor.borda}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: cor.textoFraco, fontWeight: 800 }}>{label}</div>
            <div style={{ marginTop: 8, fontSize: 22, fontWeight: 850 }}>{value}</div>
          </div>
        ))}
      </section>

      <section style={{ ...card, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.4fr) 170px 170px 140px 140px auto', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={15} color={cor.ciano} />
            <input value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => e.key === 'Enter' && carregar()} placeholder="Nome, empresa, CNPJ, telefone ou e-mail" style={{ ...inputStyle, flex: 1 }} />
          </div>
          <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)} style={inputStyle}>
            <option value="">Todos os status</option>
            {STATUS_OPCOES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <select value={regimeFiltro} onChange={e => setRegimeFiltro(e.target.value)} style={inputStyle}>
            <option value="">Todos os regimes</option>
            {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={carregar} style={{ border: 0, borderRadius: 9, padding: '10px 14px', background: 'linear-gradient(90deg, #0ea5e9, #06b6d4)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Filtrar</button>
            <button type="button" onClick={exportarExcel} disabled={!leads.length} style={{ border: `1px solid ${cor.bordaForte}`, borderRadius: 9, padding: '10px 12px', background: 'transparent', color: cor.texto, fontWeight: 800, cursor: leads.length ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> Excel
            </button>
          </div>
        </div>
      </section>

      <section style={{ ...card, overflow: 'hidden' }}>
        {erro ? (
          <div style={{ padding: 24, color: '#f87171' }}>{erro}</div>
        ) : !leads.length ? (
          <div style={{ padding: 34, textAlign: 'center', color: cor.textoFraco }}>
            {carregando ? 'Carregando...' : 'Nenhum lead encontrado para os filtros selecionados.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 1100, width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: cor.cabecalhoTabela }}>
                  {['Data', 'Nome', 'Empresa', 'CNPJ', 'Contato', 'Regime', 'Status', 'Diagnóstico', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 12px', color: cor.textoSuave, borderBottom: `1px solid ${cor.borda}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} style={{ borderTop: `1px solid ${cor.borda}` }}>
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>{dataHoraBr(lead.created_at)}</td>
                    <td style={{ padding: '11px 12px', fontWeight: 700 }}>{lead.nome}</td>
                    <td style={{ padding: '11px 12px', minWidth: 180 }}>{lead.empresa}</td>
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>{lead.cnpj ? formatarCnpj(lead.cnpj) : '-'}</td>
                    <td style={{ padding: '11px 12px', minWidth: 180 }}>
                      <div>{formatarTelefoneBr(lead.telefone)}</div>
                      <div style={{ color: cor.textoFraco, fontSize: 11.5 }}>{lead.email}</div>
                    </td>
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>{lead.regime_tributario}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <select
                        value={lead.status}
                        onChange={e => atualizarStatus(lead, e.target.value)}
                        disabled={salvando}
                        style={{ ...inputStyle, padding: '6px 8px', fontSize: 11.5 }}
                      >
                        {STATUS_OPCOES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                      <div>{lead.codigo_diagnostico || '-'}{lead.quantidade_xmls ? ` · ${lead.quantidade_xmls} XML(s)` : ''}</div>
                      {lead.diagnostico_relatorio && (
                        <a
                          href={linkRelatorioPdf(lead.diagnostico_relatorio.token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 5, color: cor.ciano, textDecoration: 'none', fontSize: 11.5, fontWeight: 800 }}
                        >
                          <FileText size={12} /> PDF
                        </a>
                      )}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <a href={linkWhatsappLead(lead)} target="_blank" rel="noopener noreferrer" title="Chamar no WhatsApp" style={{ border: `1px solid ${cor.bordaForte}`, color: cor.ciano, borderRadius: 8, padding: 6, display: 'inline-flex' }}>
                          <MessageCircle size={13} />
                        </a>
                        <button type="button" onClick={() => abrirDetalhes(lead)} style={{ border: `1px solid ${cor.bordaForte}`, background: 'transparent', color: cor.ciano, borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>
                          Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selecionado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.55)', display: 'flex', justifyContent: 'flex-end', zIndex: 60 }} onClick={() => setSelecionado(null)}>
          <div
            style={{ width: 'min(460px, 100%)', height: '100%', background: escuro ? '#0b1220' : '#fff', borderLeft: `1px solid ${cor.borda}`, padding: 22, overflowY: 'auto', color: cor.texto }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 19 }}>{selecionado.nome}</h2>
                <p style={{ margin: '4px 0 0', color: cor.textoSuave, fontSize: 13 }}>{selecionado.empresa}</p>
              </div>
              <button type="button" onClick={() => setSelecionado(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: cor.textoFraco }}><X size={18} /></button>
            </div>

            <div style={{ marginTop: 18, display: 'grid', gap: 8, fontSize: 13 }}>
              <div><strong>CNPJ:</strong> {selecionado.cnpj ? formatarCnpj(selecionado.cnpj) : '-'}</div>
              <div><strong>WhatsApp:</strong> {formatarTelefoneBr(selecionado.telefone)}</div>
              <div><strong>E-mail:</strong> {selecionado.email}</div>
              <div><strong>Regime:</strong> {selecionado.regime_tributario}</div>
              <div><strong>Local:</strong> {selecionado.cidade}/{selecionado.estado}</div>
              {selecionado.sistema_emissor && <div><strong>Sistema emissor:</strong> {selecionado.sistema_emissor}</div>}
              <div><strong>Origem:</strong> {selecionado.origem}{selecionado.campanha ? ` · ${selecionado.campanha}` : ''}</div>
              {(selecionado.utm_source || selecionado.utm_medium || selecionado.utm_campaign) && (
                <div><strong>UTM:</strong> {[selecionado.utm_source, selecionado.utm_medium, selecionado.utm_campaign].filter(Boolean).join(' / ')}</div>
              )}
              <div><strong>Autoriza contato comercial:</strong> {selecionado.consentimento_contato ? 'Sim' : 'Não'}</div>
              <div><strong>Código do diagnóstico:</strong> {selecionado.codigo_diagnostico || '-'}</div>
              <div><strong>XMLs analisados:</strong> {selecionado.quantidade_xmls}</div>
              {selecionado.resumo_analise && (
                <div>
                  <strong>Resultado:</strong> {selecionado.resumo_analise.situacao_geral || '-'}
                  {' · '}IBS {money.format(selecionado.resumo_analise.total_ibs || 0)}
                  {' · '}CBS {money.format(selecionado.resumo_analise.total_cbs || 0)}
                </div>
              )}
              {selecionado.diagnostico_relatorio && (
                <div>
                  <strong>Relatório PDF:</strong>{' '}
                  <a href={linkRelatorioPdf(selecionado.diagnostico_relatorio.token)} target="_blank" rel="noopener noreferrer" style={{ color: cor.ciano, fontWeight: 800, textDecoration: 'none' }}>
                    Baixar PDF gerado
                  </a>
                  {' · '}downloads: {selecionado.diagnostico_relatorio.downloads_count}
                </div>
              )}
              <div><strong>Cadastrado em:</strong> {dataHoraBr(selecionado.created_at)}</div>
            </div>

            <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={linkWhatsappLead(selecionado)} target="_blank" rel="noopener noreferrer" style={{ border: 0, borderRadius: 9, padding: '9px 12px', background: 'linear-gradient(90deg, #0ea5e9, #06b6d4)', color: '#fff', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                <MessageCircle size={14} /> WhatsApp
              </a>
              <a href={linkEmailLead(selecionado)} style={{ border: `1px solid ${cor.bordaForte}`, borderRadius: 9, padding: '9px 12px', color: cor.texto, fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                <Mail size={14} /> E-mail
              </a>
              {selecionado.diagnostico_relatorio && (
                <a href={linkRelatorioPdf(selecionado.diagnostico_relatorio.token)} target="_blank" rel="noopener noreferrer" style={{ border: `1px solid ${cor.bordaForte}`, borderRadius: 9, padding: '9px 12px', color: cor.ciano, fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                  <FileText size={14} /> PDF
                </a>
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <span style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, color: cor.textoSuave }}>Status</span>
              <select value={selecionado.status} onChange={e => atualizarStatus(selecionado, e.target.value)} disabled={salvando} style={{ ...inputStyle, width: '100%' }}>
                {STATUS_OPCOES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>

            <div style={{ marginTop: 18 }}>
              <span style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, color: cor.textoSuave }}>Observações</span>
              <textarea
                value={observacoesRascunho}
                onChange={e => setObservacoesRascunho(e.target.value)}
                rows={5}
                style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <button type="button" onClick={salvarObservacoes} disabled={salvando} style={{ marginTop: 8, border: 0, borderRadius: 9, padding: '9px 14px', background: 'linear-gradient(90deg, #0ea5e9, #06b6d4)', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: salvando ? .7 : 1 }}>
                Salvar observações
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
