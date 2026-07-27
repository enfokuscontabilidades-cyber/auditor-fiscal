'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, BookOpen, CheckCircle2, Info, PackageSearch, Search } from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'
import type { TributarioNcmOperacao, TributarioNcmPerfil, TributarioNcmPosicaoIcms, TributarioNcmTratamento } from '@/lib/types'
import type { ConsultaNcmResultado } from '@/lib/tributario/ncm'

interface ConsultaNcmResponse {
  fonte: { titulo: string; referencia: string; url: string }
  data_referencia: string
  resultado: ConsultaNcmResultado
  error?: string
}

const ROTULOS_TRATAMENTO: Record<TributarioNcmTratamento, string> = {
  tributacao_concentrada: 'Tributação concentrada',
  aliquota_zero: 'Alíquota zero na etapa',
  substituicao_tributaria: 'Substituição tributária',
  suspensao: 'Suspensão',
  isencao: 'Isenção',
  tributacao_normal: 'Tributação normal',
  inconclusivo: 'Análise complementar',
}

const CORES_TRATAMENTO: Record<TributarioNcmTratamento, { fundo: string; borda: string; texto: string }> = {
  tributacao_concentrada: { fundo: 'rgba(14,165,233,0.05)', borda: 'rgba(14,165,233,0.24)', texto: '#0284c7' },
  aliquota_zero: { fundo: 'rgba(34,197,94,0.05)', borda: 'rgba(34,197,94,0.24)', texto: '#16a34a' },
  substituicao_tributaria: { fundo: 'rgba(168,85,247,0.05)', borda: 'rgba(168,85,247,0.24)', texto: '#9333ea' },
  suspensao: { fundo: 'rgba(245,158,11,0.05)', borda: 'rgba(245,158,11,0.24)', texto: '#d97706' },
  isencao: { fundo: 'rgba(34,197,94,0.05)', borda: 'rgba(34,197,94,0.24)', texto: '#16a34a' },
  tributacao_normal: { fundo: 'var(--af-surface-2)', borda: 'var(--af-border)', texto: 'var(--af-text)' },
  inconclusivo: { fundo: 'var(--af-surface-2)', borda: 'var(--af-border)', texto: 'var(--af-muted)' },
}

function tributosLabel(tributos: string[]): string {
  return tributos.map(tributo => tributo === 'cofins' ? 'Cofins' : tributo.toUpperCase()).join(' e ')
}

function formatarAliquota(valor: number | null): string {
  if (valor == null) return '—'
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function formatarCest(valor: string): string {
  const codigo = valor.replace(/\D/g, '')
  return codigo.length === 7 ? `${codigo.slice(0, 2)}.${codigo.slice(2, 5)}.${codigo.slice(5)}` : valor
}

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

export default function ConsultaNcm() {
  const [ncm, setNcm] = useState('')
  const [descricao, setDescricao] = useState('')
  const [perfil, setPerfil] = useState<TributarioNcmPerfil>('varejista')
  const [operacao, setOperacao] = useState<TributarioNcmOperacao>('revenda')
  const [cest, setCest] = useState('')
  const [ufOrigem, setUfOrigem] = useState('GO')
  const [ufDestino, setUfDestino] = useState('GO')
  const [posicaoIcms, setPosicaoIcms] = useState<TributarioNcmPosicaoIcms>('substituido')
  const [resultado, setResultado] = useState<ConsultaNcmResponse | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 42, borderRadius: 9, border: '1px solid var(--af-border)',
    background: 'var(--af-surface-2)', color: 'var(--af-text)', padding: '0 12px',
    fontSize: 12.5, outline: 'none', boxSizing: 'border-box',
  }

  function alterarPerfil(novoPerfil: TributarioNcmPerfil) {
    setPerfil(novoPerfil)
    if (novoPerfil === 'fabricante') {
      setOperacao('venda_producao')
      setPosicaoIcms('substituto')
    } else if (novoPerfil === 'importador') {
      setOperacao('importacao')
      setPosicaoIcms('substituto')
    } else if (novoPerfil === 'varejista') {
      setOperacao('revenda')
      setPosicaoIcms('substituido')
    } else if (novoPerfil === 'consumidor_final') {
      setOperacao('venda_consumidor')
      setPosicaoIcms('nao_informada')
    } else {
      setOperacao('revenda')
      setPosicaoIcms('nao_informada')
    }
  }

  async function consultar(event: FormEvent) {
    event.preventDefault()
    const codigo = ncm.replace(/\D/g, '')
    if (codigo.length !== 8) {
      setErro('Informe um NCM completo com 8 dígitos.')
      return
    }

    setCarregando(true)
    setErro('')
    try {
      const params = new URLSearchParams({
        ncm: codigo,
        perfil,
        operacao,
        uf_origem: ufOrigem,
        uf_destino: ufDestino,
        posicao_icms: posicaoIcms,
      })
      if (descricao.trim()) params.set('descricao', descricao.trim())
      if (cest.trim()) params.set('cest', cest.trim())
      const response = await fetch(`/api/consulta-tributaria/ncm?${params.toString()}`)
      const data = await response.json() as ConsultaNcmResponse
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o NCM.')
      setResultado(data)
    } catch (error) {
      setResultado(null)
      setErro(error instanceof Error ? error.message : 'Falha ao consultar o NCM.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <GlassCard padding="16px 18px">
        <form onSubmit={consultar} style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.35fr) minmax(280px, 1fr)', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <PackageSearch size={18} style={{ position: 'absolute', left: 13, top: 12, color: 'var(--af-muted)' }} />
              <input
                value={ncm}
                onChange={event => setNcm(event.target.value)}
                placeholder="NCM: 4011.10.00"
                inputMode="numeric"
                style={{ ...inputStyle, paddingLeft: 40 }}
              />
            </div>
            <input
              value={descricao}
              onChange={event => setDescricao(event.target.value)}
              placeholder="Descrição comercial do produto (recomendado para validar exceções)"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) auto', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 5, color: 'var(--af-muted)', fontSize: 10.5, fontWeight: 700 }}>
              PAPEL DA EMPRESA NA OPERAÇÃO
              <select value={perfil} onChange={event => alterarPerfil(event.target.value as TributarioNcmPerfil)} style={inputStyle}>
                <option value="fabricante">Fabricante</option>
                <option value="importador">Importador</option>
                <option value="atacadista">Comerciante atacadista</option>
                <option value="varejista">Comerciante varejista</option>
                <option value="consumidor_final">Consumidor final</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5, color: 'var(--af-muted)', fontSize: 10.5, fontWeight: 700 }}>
              OPERAÇÃO ANALISADA
              <select value={operacao} onChange={event => setOperacao(event.target.value as TributarioNcmOperacao)} style={inputStyle}>
                <option value="venda_producao">Venda de produção própria</option>
                <option value="importacao">Importação</option>
                <option value="revenda">Revenda</option>
                <option value="venda_consumidor">Venda a consumidor final</option>
              </select>
            </label>
            <button type="submit" disabled={carregando} style={{ height: 42, border: 0, borderRadius: 9, padding: '0 20px', cursor: 'pointer', background: 'var(--af-primary)', color: '#fff', fontSize: 12.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: carregando ? 0.65 : 1 }}>
              <Search size={16} /> {carregando ? 'Consultando...' : 'Consultar NCM'}
            </button>
          </div>

          <div style={{ marginTop: 2, padding: '11px 12px', borderRadius: 10, border: '1px solid var(--af-border)', background: 'var(--af-surface-2)', display: 'grid', gap: 9 }}>
            <div style={{ color: 'var(--af-text)', fontSize: 10.5, fontWeight: 800 }}>Contexto para ICMS-ST</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(110px, 0.55fr) minmax(110px, 0.55fr) minmax(220px, 1.25fr)', gap: 9 }}>
              <label style={{ display: 'grid', gap: 5, color: 'var(--af-muted)', fontSize: 9.5, fontWeight: 700 }}>
                CEST DA MERCADORIA
                <input value={cest} onChange={event => setCest(event.target.value)} placeholder="Ex.: 16.001.00" inputMode="numeric" style={inputStyle} />
              </label>
              <label style={{ display: 'grid', gap: 5, color: 'var(--af-muted)', fontSize: 9.5, fontWeight: 700 }}>
                UF DE ORIGEM
                <select value={ufOrigem} onChange={event => setUfOrigem(event.target.value)} style={inputStyle}>
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5, color: 'var(--af-muted)', fontSize: 9.5, fontWeight: 700 }}>
                UF DE DESTINO
                <select value={ufDestino} onChange={event => setUfDestino(event.target.value)} style={inputStyle}>
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5, color: 'var(--af-muted)', fontSize: 9.5, fontWeight: 700 }}>
                POSIÇÃO NA OPERAÇÃO
                <select value={posicaoIcms} onChange={event => setPosicaoIcms(event.target.value as TributarioNcmPosicaoIcms)} style={inputStyle}>
                  <option value="nao_informada">Ainda não identificada</option>
                  <option value="substituto">Substituto — retém/recolhe o ICMS-ST</option>
                  <option value="substituido">Substituído — recebe com ICMS retido</option>
                </select>
              </label>
            </div>
            <div style={{ color: 'var(--af-muted)', fontSize: 10, lineHeight: 1.45 }}>
              A posição sugerida pelo perfil é apenas um ponto de partida. Contrato, fornecedor, protocolo aplicável e natureza da operação podem alterar a responsabilidade.
            </div>
          </div>
        </form>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 11, color: 'var(--af-muted)', fontSize: 11, lineHeight: 1.5 }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          O código identifica a mercadoria, mas não determina sozinho sua tributação. O resultado considera também a operação e o papel da empresa na cadeia.
        </div>
      </GlassCard>

      {erro && (
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '11px 13px', borderRadius: 10, background: 'rgba(239,68,68,0.09)', color: '#dc2626', fontSize: 12 }}>
          <AlertTriangle size={16} /> {erro}
        </div>
      )}

      {resultado && (
        <GlassCard padding={0}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--af-border)', display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: 'var(--af-primary)', fontFamily: 'monospace', fontSize: 12, fontWeight: 800 }}>{resultado.resultado.ncm_formatado}</div>
              <h2 style={{ margin: '5px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--af-text)', lineHeight: 1.4 }}>
                {resultado.resultado.classificacao_oficial?.descricao ?? (descricao || 'Descrição oficial indisponível')}
              </h2>
              {resultado.resultado.classificacao_oficial && descricao && (
                <div style={{ marginTop: 4, color: 'var(--af-muted)', fontSize: 10.5 }}>Produto informado: {descricao}</div>
              )}
              {(resultado.resultado.contexto_icms.cest || resultado.resultado.contexto_icms.uf_destino) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                  {resultado.resultado.contexto_icms.cest && <span style={{ padding: '3px 7px', borderRadius: 6, background: 'var(--af-surface-2)', color: 'var(--af-muted)', fontSize: 9.8 }}>CEST {formatarCest(resultado.resultado.contexto_icms.cest)}</span>}
                  {resultado.resultado.contexto_icms.uf_origem && <span style={{ padding: '3px 7px', borderRadius: 6, background: 'var(--af-surface-2)', color: 'var(--af-muted)', fontSize: 9.8 }}>{resultado.resultado.contexto_icms.uf_origem} → {resultado.resultado.contexto_icms.uf_destino}</span>}
                </div>
              )}
            </div>
            <a href={resultado.fonte.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', color: 'var(--af-primary)', textDecoration: 'none', fontSize: 10.5, fontWeight: 700 }}>
              <BookOpen size={13} /> Tabela oficial NCM
            </a>
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            {resultado.resultado.resultados.length > 0 ? resultado.resultado.resultados.map(item => {
              const cor = CORES_TRATAMENTO[item.tratamento]
              return (
                <section key={item.regra} style={{ border: `1px solid ${cor.borda}`, borderRadius: 12, background: cor.fundo, padding: '15px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: 'var(--af-muted)', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{tributosLabel(item.tributos)}</div>
                      <div style={{ marginTop: 5, color: 'var(--af-text)', fontSize: 14, fontWeight: 750 }}>{item.titulo}</div>
                      <p style={{ margin: '5px 0 0', color: 'var(--af-text-soft)', fontSize: 11, lineHeight: 1.5 }}>{item.explicacao}</p>
                    </div>
                    <span style={{ padding: '4px 8px', borderRadius: 999, background: 'var(--af-surface)', color: cor.texto, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {ROTULOS_TRATAMENTO[item.tratamento]}
                    </span>
                  </div>

                  {(item.aliquota_pis != null || item.aliquota_cofins != null) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
                      <div style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--af-surface)', fontSize: 10.5 }}><strong>PIS:</strong> {formatarAliquota(item.aliquota_pis)}</div>
                      <div style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--af-surface)', fontSize: 10.5 }}><strong>Cofins:</strong> {formatarAliquota(item.aliquota_cofins)}</div>
                      <div style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--af-surface)', color: 'var(--af-muted)', fontSize: 10.5 }}>Alíquotas nominais; conferir exceções e bases reduzidas.</div>
                    </div>
                  )}

                  {item.tributos.includes('icms') && (item.descricao_legal || item.cests.length > 0) && (
                    <div style={{ marginTop: 11, padding: '10px 11px', borderRadius: 9, border: '1px solid var(--af-border)', background: 'var(--af-surface)' }}>
                      <div style={{ color: 'var(--af-muted)', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enquadramento estadual validado</div>
                      {item.descricao_legal && <div style={{ marginTop: 4, color: 'var(--af-text-soft)', fontSize: 10.5, lineHeight: 1.45 }}>{item.descricao_legal}</div>}
                      {item.cests.length > 0 && <div style={{ marginTop: 5, color: 'var(--af-muted)', fontSize: 9.8 }}>CESTs alcançados em Goiás: {item.cests.map(formatarCest).join(', ')}</div>}
                    </div>
                  )}

                  <div style={{ marginTop: 11, padding: '10px 11px', borderRadius: 9, background: 'var(--af-surface)' }}>
                    <div style={{ color: 'var(--af-primary)', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Efeito no Simples Nacional</div>
                    <div style={{ marginTop: 4, color: 'var(--af-text-soft)', fontSize: 10.8, lineHeight: 1.5 }}>{item.orientacao_simples}</div>
                  </div>

                  {(item.condicoes.length > 0 || item.alertas.length > 0) && (
                    <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                      {item.condicoes.map(condicao => (
                        <div key={condicao} style={{ display: 'flex', gap: 7, color: 'var(--af-text-soft)', fontSize: 10.5, lineHeight: 1.45 }}><CheckCircle2 size={12} style={{ color: 'var(--af-primary)', flexShrink: 0, marginTop: 1 }} />{condicao}</div>
                      ))}
                      {item.alertas.map(alerta => (
                        <div key={alerta} style={{ display: 'flex', gap: 7, color: '#b45309', fontSize: 10.5, lineHeight: 1.45 }}><AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />{alerta}</div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 11 }}>
                    {item.fontes.map(fonte => (
                      <a key={fonte.url} href={fonte.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 7px', borderRadius: 6, border: '1px solid var(--af-border)', color: 'var(--af-primary)', background: 'var(--af-surface)', textDecoration: 'none', fontSize: 9.8 }}>
                        <BookOpen size={11} /> {fonte.referencia}
                      </a>
                    ))}
                  </div>
                </section>
              )
            }) : (
              <div style={{ padding: '18px', border: '1px solid var(--af-border)', borderRadius: 11, background: 'var(--af-surface-2)', textAlign: 'center' }}>
                <div style={{ color: 'var(--af-text)', fontSize: 12.5, fontWeight: 700 }}>Nenhuma regra conclusiva para a combinação informada</div>
                <div style={{ marginTop: 4, color: 'var(--af-muted)', fontSize: 10.8 }}>Isso não significa tributação normal. Pode faltar uma regra validada ou a operação não corresponder ao papel selecionado.</div>
              </div>
            )}

            {resultado.resultado.tributos_sem_regra.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
                {resultado.resultado.tributos_sem_regra.map(tributo => (
                  <div key={tributo} style={{ padding: '10px 12px', border: '1px solid var(--af-border)', borderRadius: 9, background: 'var(--af-surface-2)' }}>
                    <div style={{ color: 'var(--af-muted)', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase' }}>{tributo === 'cofins' ? 'Cofins' : tributo.toUpperCase()}</div>
                    <div style={{ marginTop: 3, color: 'var(--af-text-soft)', fontSize: 10.5 }}>Sem regra conclusiva nesta etapa do catálogo.</div>
                  </div>
                ))}
              </div>
            )}

            {resultado.resultado.avisos.length > 0 && (
              <div style={{ display: 'grid', gap: 6, padding: '11px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
                {resultado.resultado.avisos.map(aviso => (
                  <div key={aviso} style={{ display: 'flex', gap: 7, color: 'var(--af-text-soft)', fontSize: 10.5, lineHeight: 1.45 }}><Info size={12} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />{aviso}</div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
