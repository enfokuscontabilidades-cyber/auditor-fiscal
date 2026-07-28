'use client'

import { FormEvent, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Factory,
  Info,
  LibraryBig,
  Search,
  ShoppingCart,
  PackageSearch,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import GlassCard from '@/components/ui/GlassCard'
import ConsultaNcm from '@/components/consulta-tributaria/ConsultaNcm'
import {
  formatarCnae,
  type EnquadramentoCnae,
  type ResultadoConsultaCnae,
} from '@/lib/tributario/cnae'

interface BuscaResponse {
  fonte: string
  total: number
  resultados: ResultadoConsultaCnae[]
  error?: string
}

interface DetalheResponse {
  fonte: string
  resultado: ResultadoConsultaCnae
  error?: string
}

const CORES_TRATAMENTO: Record<EnquadramentoCnae['tratamento'], { fundo: string; texto: string }> = {
  anexo_i: { fundo: 'rgba(14,165,233,0.12)', texto: '#0284c7' },
  anexo_ii: { fundo: 'rgba(168,85,247,0.12)', texto: '#9333ea' },
  anexo_iii: { fundo: 'rgba(34,197,94,0.12)', texto: '#16a34a' },
  anexo_iv: { fundo: 'rgba(245,158,11,0.14)', texto: '#d97706' },
  fator_r: { fundo: 'rgba(6,182,212,0.13)', texto: '#0891b2' },
  inconclusivo: { fundo: 'rgba(100,116,139,0.13)', texto: '#64748b' },
}

function rotuloTratamento(enquadramento: EnquadramentoCnae): string {
  if (enquadramento.tratamento === 'fator_r') return 'Fator R — Anexo III ou V'
  if (enquadramento.anexo_indicativo) return `Anexo ${enquadramento.anexo_indicativo}`
  return 'Análise complementar'
}

function IconeNatureza({ natureza }: { natureza: EnquadramentoCnae['natureza'] }) {
  if (natureza === 'comercio') return <ShoppingCart size={18} />
  if (natureza === 'industria') return <Factory size={18} />
  if (natureza === 'servico' || natureza === 'construcao') return <Building2 size={18} />
  return <LibraryBig size={18} />
}

function BadgeTratamento({ enquadramento }: { enquadramento: EnquadramentoCnae }) {
  const cor = CORES_TRATAMENTO[enquadramento.tratamento]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999,
      background: cor.fundo, color: cor.texto, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
    }}>
      {enquadramento.conclusivo ? <CheckCircle2 size={12} /> : <Info size={12} />}
      {rotuloTratamento(enquadramento)}
    </span>
  )
}

export default function ConsultaTributariaPage() {
  const [aba, setAba] = useState<'cnae' | 'ncm'>('cnae')
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ResultadoConsultaCnae[]>([])
  const [selecionado, setSelecionado] = useState<ResultadoConsultaCnae | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [erro, setErro] = useState('')
  const [pesquisaRealizada, setPesquisaRealizada] = useState(false)
  const [folha12, setFolha12] = useState('')
  const [rbt12, setRbt12] = useState('')

  const fatorR = useMemo(() => {
    const folha = Number(folha12.replace(/\./g, '').replace(',', '.'))
    const receita = Number(rbt12.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(folha) || !Number.isFinite(receita) || receita <= 0) return null
    return folha / receita
  }, [folha12, rbt12])

  const fontesResultado = useMemo(() => {
    if (!selecionado) return []
    const fontes = [
      ...selecionado.enquadramento.fontes,
      ...selecionado.enquadramento.excecoes.flatMap(excecao => excecao.fontes),
      ...selecionado.enquadramento.entendimentos.map(entendimento => entendimento.fonte),
    ]
    return Array.from(new Map(fontes.map(fonte => [fonte.url, fonte])).values())
  }, [selecionado])

  async function pesquisar(event: FormEvent) {
    event.preventDefault()
    const busca = termo.trim()
    if (busca.length < 2) {
      setErro('Informe um código CNAE ou ao menos 2 caracteres da atividade.')
      return
    }

    setCarregando(true)
    setErro('')
    setSelecionado(null)
    try {
      const apenasDigitos = busca.replace(/\D/g, '')
      if (apenasDigitos.length === 7) {
        const response = await fetch(`/api/consulta-tributaria/cnae?codigo=${encodeURIComponent(busca)}`)
        const data = await response.json() as DetalheResponse
        if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o CNAE.')
        setResultados([data.resultado])
        setSelecionado(data.resultado)
      } else {
        const response = await fetch(`/api/consulta-tributaria/cnae?q=${encodeURIComponent(busca)}`)
        const data = await response.json() as BuscaResponse
        if (!response.ok) throw new Error(data.error || 'Não foi possível pesquisar CNAEs.')
        setResultados(data.resultados)
      }
      setPesquisaRealizada(true)
    } catch (error) {
      setResultados([])
      setErro(error instanceof Error ? error.message : 'Falha ao consultar a base oficial.')
    } finally {
      setCarregando(false)
    }
  }

  async function abrirDetalhe(resultado: ResultadoConsultaCnae) {
    if (resultado.cnae.observacoes.length > 0 || resultado.cnae.atividades.length > 0) {
      setSelecionado(resultado)
      return
    }

    setCarregandoDetalhe(true)
    setErro('')
    try {
      const response = await fetch(`/api/consulta-tributaria/cnae?codigo=${resultado.cnae.id}`)
      const data = await response.json() as DetalheResponse
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os detalhes.')
      setSelecionado(data.resultado)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao carregar os detalhes do CNAE.')
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  const S: Record<string, React.CSSProperties> = {
    page: {
      display: 'grid', gap: 16, width: '100%', maxWidth: 1448, margin: '0 auto',
      padding: '24px 24px 40px', boxSizing: 'border-box',
    },
    searchRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
    inputWrap: { position: 'relative', flex: '1 1 420px' },
    input: {
      width: '100%', height: 44, borderRadius: 10, border: '1px solid var(--af-border)',
      background: 'var(--af-surface-2)', color: 'var(--af-text)', padding: '0 14px 0 42px',
      fontSize: 13, outline: 'none', boxSizing: 'border-box',
    },
    button: {
      height: 44, border: 0, borderRadius: 10, padding: '0 20px', cursor: 'pointer',
      background: 'var(--af-primary)', color: '#fff', fontSize: 13, fontWeight: 800,
      display: 'inline-flex', alignItems: 'center', gap: 8,
    },
    resultButton: {
      width: '100%', border: '1px solid var(--af-border)', background: 'var(--af-surface)',
      borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', color: 'var(--af-text)',
      display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto auto', alignItems: 'center', gap: 12,
    },
    label: { fontSize: 10, fontWeight: 800, color: 'var(--af-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
    value: { fontSize: 13, color: 'var(--af-text)', marginTop: 3, lineHeight: 1.45 },
  }

  return (
    <div style={S.page}>
      <PageHeader
        title="Consulta Tributária"
        subtitle={aba === 'cnae'
          ? 'Consulte a atividade oficial e veja primeiro a regra principal do Simples Nacional, seguida das condições que podem alterar o anexo.'
          : 'Consulte o NCM e analise separadamente PIS, Cofins e a alíquota nominal do IPI conforme o produto, o papel da empresa e a operação.'}
        badge={{ label: aba === 'cnae' ? 'Fonte oficial IBGE' : 'NCM oficial RFB', color: '#0891b2' }}
        style={{ marginBottom: 0 }}
      />

      <div style={{ display: 'inline-flex', width: 'fit-content', padding: 3, border: '1px solid var(--af-border)', borderRadius: 10, background: 'var(--af-surface)' }}>
        <button type="button" onClick={() => setAba('cnae')} style={{ height: 34, border: 0, borderRadius: 7, padding: '0 13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: aba === 'cnae' ? 'var(--af-primary-soft)' : 'transparent', color: aba === 'cnae' ? 'var(--af-primary)' : 'var(--af-muted)', fontSize: 11.5, fontWeight: 800 }}>
          <Building2 size={14} /> CNAE e anexos
        </button>
        <button type="button" onClick={() => setAba('ncm')} style={{ height: 34, border: 0, borderRadius: 7, padding: '0 13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: aba === 'ncm' ? 'var(--af-primary-soft)' : 'transparent', color: aba === 'ncm' ? 'var(--af-primary)' : 'var(--af-muted)', fontSize: 11.5, fontWeight: 800 }}>
          <PackageSearch size={14} /> NCM — PIS/Cofins e IPI
        </button>
      </div>

      {aba === 'ncm' && <ConsultaNcm />}

      <div style={{ display: aba === 'cnae' ? 'contents' : 'none' }}>

      <GlassCard padding="16px 18px">
        <form onSubmit={pesquisar} style={S.searchRow}>
          <div style={S.inputWrap}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--af-muted)' }} />
            <input
              value={termo}
              onChange={event => setTermo(event.target.value)}
              placeholder="Ex.: 6201-5/01, comércio varejista, contabilidade, fabricação..."
              style={S.input}
            />
          </div>
          <button type="submit" disabled={carregando} style={{ ...S.button, opacity: carregando ? 0.65 : 1 }}>
            <Search size={16} />
            {carregando ? 'Consultando IBGE...' : 'Pesquisar CNAE'}
          </button>
        </form>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, color: 'var(--af-muted)', fontSize: 11.5, lineHeight: 1.5 }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          O CNAE descreve a atividade cadastral. A conclusão tributária considera a LC nº 123/2006 e a Resolução CGSN nº 140/2018, mas pode exigir confirmação da operação, do serviço ou do contrato.
        </div>
      </GlassCard>

      {erro && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.09)', color: '#dc2626', fontSize: 12.5 }}>
          <AlertTriangle size={17} /> {erro}
        </div>
      )}

      {!selecionado && resultados.length > 0 && (
        <GlassCard title={`${resultados.length} atividade(s) encontrada(s)`}>
          <div style={{ display: 'grid', gap: 9 }}>
            {resultados.map(resultado => (
              <button key={resultado.cnae.id} type="button" onClick={() => abrirDetalhe(resultado)} style={S.resultButton}>
                <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--af-primary-soft)', color: 'var(--af-primary)' }}>
                  <IconeNatureza natureza={resultado.enquadramento.natureza} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 13 }}>{formatarCnae(resultado.cnae.id)}</strong>
                  <span style={{ display: 'block', color: 'var(--af-muted)', fontSize: 11.5, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {resultado.cnae.descricao}
                  </span>
                </span>
                <BadgeTratamento enquadramento={resultado.enquadramento} />
                <ChevronRight size={17} style={{ color: 'var(--af-muted)' }} />
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {pesquisaRealizada && !carregando && resultados.length === 0 && !erro && (
        <GlassCard>
          <div style={{ textAlign: 'center', color: 'var(--af-muted)', padding: '28px 10px', fontSize: 13 }}>
            Nenhum CNAE localizado para a pesquisa informada.
          </div>
        </GlassCard>
      )}

      {carregandoDetalhe && (
        <GlassCard><div style={{ color: 'var(--af-muted)', fontSize: 13 }}>Carregando detalhes oficiais do CNAE...</div></GlassCard>
      )}

      {selecionado && !carregandoDetalhe && (
        <>
          {resultados.length > 1 && (
            <button type="button" onClick={() => setSelecionado(null)} style={{ ...S.button, width: 'fit-content', height: 36, background: 'var(--af-surface-2)', color: 'var(--af-text)', border: '1px solid var(--af-border)' }}>
              Voltar aos resultados
            </button>
          )}

          <GlassCard padding={0}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--af-border)', display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--af-primary)', fontFamily: 'monospace', fontSize: 12, fontWeight: 800 }}>{formatarCnae(selecionado.cnae.id)}</span>
                  <span style={{ width: 3, height: 3, borderRadius: 999, background: 'var(--af-muted)' }} />
                  <span style={{ color: 'var(--af-muted)', fontSize: 10.5, fontWeight: 700 }}>CONCLA/IBGE</span>
                </div>
                <h2 style={{ margin: '5px 0 0', fontSize: 15.5, fontWeight: 700, color: 'var(--af-text)', lineHeight: 1.4 }}>{selecionado.cnae.descricao}</h2>
              </div>
              <BadgeTratamento enquadramento={selecionado.enquadramento} />
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, alignItems: 'stretch' }}>
                <section style={{ border: '1px solid rgba(39,199,216,0.24)', borderRadius: 12, background: 'rgba(39,199,216,0.045)', padding: '15px 16px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 999, background: 'rgba(39,199,216,0.11)', color: 'var(--af-primary)', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Regra principal</span>
                    <div style={{ marginTop: 9, fontSize: 22, lineHeight: 1.1, fontWeight: 750, color: 'var(--af-text)' }}>
                      {selecionado.enquadramento.tratamento === 'fator_r'
                        ? 'Fator R'
                        : selecionado.enquadramento.anexo_indicativo
                          ? `Anexo ${selecionado.enquadramento.anexo_indicativo}`
                          : 'Análise necessária'}
                    </div>
                    <div style={{ marginTop: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--af-text)' }}>{selecionado.enquadramento.titulo}</div>
                    <p style={{ margin: '6px auto 0', maxWidth: 500, fontSize: 11.5, color: 'var(--af-text-soft)', lineHeight: 1.55 }}>{selecionado.enquadramento.explicacao}</p>
                  </div>

                  {selecionado.enquadramento.condicoes.length > 0 && (
                    <div style={{ marginTop: 13, paddingTop: 11, borderTop: '1px solid rgba(39,199,216,0.16)' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--af-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Validar antes de aplicar</div>
                      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                        {selecionado.enquadramento.condicoes.map(condicao => (
                          <div key={condicao} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', color: 'var(--af-text-soft)', fontSize: 10.8, lineHeight: 1.45 }}>
                            <CheckCircle2 size={13} style={{ color: 'var(--af-primary)', flexShrink: 0, marginTop: 1 }} /> {condicao}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {(selecionado.enquadramento.excecoes.length > 0 || selecionado.enquadramento.alertas.length > 0) && (
                <section style={{ border: `1px solid ${selecionado.enquadramento.excecoes.length > 0 ? 'rgba(245,158,11,0.24)' : 'var(--af-border)'}`, borderRadius: 12, background: selecionado.enquadramento.excecoes.length > 0 ? 'rgba(245,158,11,0.04)' : 'var(--af-surface-2)', padding: '15px 16px', display: 'flex', flexDirection: 'column' }}>
                  {selecionado.enquadramento.excecoes.length > 0 ? selecionado.enquadramento.excecoes.map(excecao => (
                    <div key={`${excecao.anexo}-${excecao.titulo}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.11)', color: '#b45309', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Exceção</span>
                        <div style={{ marginTop: 9, fontSize: 20, lineHeight: 1.1, fontWeight: 750, color: 'var(--af-text)' }}>Anexo {excecao.anexo}</div>
                        <div style={{ marginTop: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--af-text)' }}>{excecao.titulo}</div>
                        <p style={{ margin: '6px auto 0', maxWidth: 500, fontSize: 11.5, color: 'var(--af-text-soft)', lineHeight: 1.55 }}>{excecao.quando}</p>
                      </div>
                      <div style={{ marginTop: 13, paddingTop: 11, borderTop: '1px solid rgba(245,158,11,0.15)', display: 'grid', gap: 6 }}>
                        <p style={{ margin: 0, color: 'var(--af-text-soft)', fontSize: 10.8, lineHeight: 1.45 }}>{excecao.explicacao}</p>
                        {excecao.alertas.map(alerta => (
                          <div key={alerta} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', color: '#92400e', fontSize: 10.5, lineHeight: 1.4 }}>
                            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {alerta}
                          </div>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 999, background: 'var(--af-surface)', color: 'var(--af-muted)', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Pontos de atenção</span>
                        <div style={{ marginTop: 9, fontSize: 16, fontWeight: 700, color: 'var(--af-text)' }}>Conferência da atividade</div>
                      </div>
                      <div style={{ display: 'grid', gap: 7, marginTop: 13 }}>
                        {selecionado.enquadramento.alertas.map(alerta => (
                          <div key={alerta} style={{ display: 'flex', gap: 7, color: 'var(--af-text-soft)', fontSize: 10.8, lineHeight: 1.45 }}>
                            <Info size={13} style={{ color: 'var(--af-primary)', flexShrink: 0, marginTop: 1 }} /> {alerta}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
                )}
              </div>

              {selecionado.enquadramento.entendimentos.length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  {selecionado.enquadramento.entendimentos.map(entendimento => {
                    const ehRiscoExclusao = entendimento.efeito === 'risco_exclusao'
                    const corEntendimento = ehRiscoExclusao ? '#dc2626' : '#0284c7'
                    return (
                    <section key={`${entendimento.identificacao}-${entendimento.data_publicacao}-${entendimento.efeito}`} style={{ padding: '12px 14px', border: `1px solid ${ehRiscoExclusao ? 'rgba(220,38,38,0.24)' : 'rgba(14,165,233,0.22)'}`, borderRadius: 10, background: ehRiscoExclusao ? 'rgba(220,38,38,0.045)' : 'rgba(14,165,233,0.045)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 7px', borderRadius: 999, background: ehRiscoExclusao ? 'rgba(220,38,38,0.10)' : 'rgba(14,165,233,0.11)', color: corEntendimento, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {ehRiscoExclusao ? <AlertTriangle size={11} /> : <BookOpen size={11} />}
                            {ehRiscoExclusao ? 'Risco de exclusão do Simples' : 'Entendimento específico da Receita'}
                          </span>
                          <div style={{ marginTop: 7, color: 'var(--af-text)', fontSize: 11.8, fontWeight: 750 }}>{entendimento.identificacao} — {entendimento.titulo}</div>
                          <p style={{ margin: '4px 0 0', color: 'var(--af-text-soft)', fontSize: 10.8, lineHeight: 1.5 }}>{entendimento.resumo}</p>
                        </div>
                        <a href={entendimento.fonte.url} target="_blank" rel="noreferrer" style={{ color: 'var(--af-primary)', fontSize: 10.2, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          Ver fonte oficial
                        </a>
                      </div>
                      <div style={{ display: 'grid', gap: 5, marginTop: 8 }}>
                        {entendimento.aplicacao.map(item => (
                          <div key={item} style={{ display: 'flex', gap: 7, color: 'var(--af-text-soft)', fontSize: 10.5, lineHeight: 1.4 }}>
                            <Info size={12} style={{ color: corEntendimento, flexShrink: 0, marginTop: 1 }} /> {item}
                          </div>
                        ))}
                      </div>
                    </section>
                    )
                  })}
                </div>
              )}

              {selecionado.enquadramento.tratamento === 'fator_r' && (
                <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--af-border)', borderRadius: 10, background: 'var(--af-surface-2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--af-text)', paddingRight: 5 }}>Simular Fator R</span>
                    <input value={folha12} onChange={event => setFolha12(event.target.value)} placeholder="Folha — 12 meses" style={{ ...S.input, height: 36, paddingLeft: 10, fontSize: 11 }} />
                    <input value={rbt12} onChange={event => setRbt12(event.target.value)} placeholder="Receita — 12 meses" style={{ ...S.input, height: 36, paddingLeft: 10, fontSize: 11 }} />
                    <div style={{ minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', borderRadius: 8, background: fatorR == null ? 'var(--af-surface)' : fatorR >= 0.28 ? 'rgba(34,197,94,0.10)' : 'rgba(245,158,11,0.10)', fontSize: 11, fontWeight: 800 }}>
                      {fatorR == null ? 'Informe os valores' : `${(fatorR * 100).toFixed(2).replace('.', ',')}% — Anexo ${fatorR >= 0.28 ? 'III' : 'V'}`}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--af-border)', background: 'var(--af-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ color: 'var(--af-muted)', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fundamentação</span>
                {fontesResultado.map(fonte => (
                  <a key={fonte.url} href={fonte.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 7px', borderRadius: 6, border: '1px solid var(--af-border)', color: 'var(--af-primary)', textDecoration: 'none', fontSize: 9.8 }}>
                    <BookOpen size={11} /> {fonte.referencia}
                  </a>
                ))}
              </div>
              <span style={{ color: 'var(--af-muted)', fontSize: 9.5 }}>Regra {selecionado.enquadramento.versao_regra} · confiança {selecionado.enquadramento.confianca}</span>
            </div>
          </GlassCard>

          <details style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 12, boxShadow: 'var(--af-shadow-sm)', overflow: 'hidden' }}>
            <summary style={{ cursor: 'pointer', padding: '11px 15px', color: 'var(--af-text-soft)', fontSize: 11.5, fontWeight: 700 }}>
              Ver classificação oficial do CNAE
            </summary>
            <div style={{ padding: '0 15px 14px', borderTop: '1px solid var(--af-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, paddingTop: 12 }}>
                {[
                  ['Seção', `${selecionado.cnae.hierarquia.secao.id} — ${selecionado.cnae.hierarquia.secao.descricao}`],
                  ['Divisão', `${selecionado.cnae.hierarquia.divisao.id} — ${selecionado.cnae.hierarquia.divisao.descricao}`],
                  ['Grupo', `${selecionado.cnae.hierarquia.grupo.id} — ${selecionado.cnae.hierarquia.grupo.descricao}`],
                  ['Classe', `${selecionado.cnae.hierarquia.classe.id} — ${selecionado.cnae.hierarquia.classe.descricao}`],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: 9, borderRadius: 8, background: 'var(--af-surface-2)' }}>
                    <div style={S.label}>{label}</div><div style={{ ...S.value, fontSize: 10.8 }}>{value}</div>
                  </div>
                ))}
              </div>
              {selecionado.cnae.observacoes.length > 0 && (
                <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
                  {selecionado.cnae.observacoes.map((observacao, index) => (
                    <div key={`${index}-${observacao.slice(0, 30)}`} style={{ whiteSpace: 'pre-line', padding: 9, background: 'var(--af-surface-2)', borderRadius: 8, color: 'var(--af-text-soft)', fontSize: 10.8, lineHeight: 1.5 }}>
                      {observacao.replace(/\r/g, '').replace(/#-/g, '• ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </>
      )}
      </div>
    </div>
  )
}
