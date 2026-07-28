'use client'

import { FormEvent, useState } from 'react'
import { AlertTriangle, BookOpen, CheckCircle2, Info, PackageSearch, Search } from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'
import type { TributarioNcmContextoOperacao, TributarioNcmOperacao, TributarioNcmPerfil, TributarioNcmTratamento } from '@/lib/types'
import type { ConsultaNcmResultado, NcmNivelHierarquia } from '@/lib/tributario/ncm'
import type { TipiSituacao } from '@/lib/tributario/tipi'

interface ConsultaNcmResponse {
  fonte: { titulo: string; referencia: string; url: string }
  fonte_tipi: { titulo: string; referencia: string; url: string }
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

const ROTULOS_HIERARQUIA: Record<NcmNivelHierarquia, string> = {
  secao: 'Seção',
  capitulo: 'Capítulo',
  posicao: 'Posição',
  subposicao: 'Subposição',
  item: 'Item',
}

const RECUOS_HIERARQUIA: Record<NcmNivelHierarquia, number> = {
  secao: 0,
  capitulo: 10,
  posicao: 20,
  subposicao: 30,
  item: 40,
}

const CORES_TIPI: Record<TipiSituacao, { fundo: string; borda: string; texto: string }> = {
  tributado: { fundo: 'rgba(168,85,247,0.06)', borda: 'rgba(168,85,247,0.24)', texto: '#9333ea' },
  aliquota_zero: { fundo: 'rgba(34,197,94,0.06)', borda: 'rgba(34,197,94,0.24)', texto: '#16a34a' },
  nao_tributado: { fundo: 'rgba(14,165,233,0.06)', borda: 'rgba(14,165,233,0.24)', texto: '#0284c7' },
  sem_informacao: { fundo: 'rgba(245,158,11,0.06)', borda: 'rgba(245,158,11,0.24)', texto: '#d97706' },
}

function tributosLabel(tributos: string[]): string {
  return tributos.map(tributo => tributo === 'cofins' ? 'Cofins' : tributo.toUpperCase()).join(' e ')
}

function formatarAliquota(valor: number | null): string {
  if (valor == null) return '—'
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

export default function ConsultaNcm() {
  const [ncm, setNcm] = useState('')
  const [descricao, setDescricao] = useState('')
  const [perfil, setPerfil] = useState<TributarioNcmPerfil>('varejista')
  const [operacao, setOperacao] = useState<TributarioNcmOperacao>('revenda')
  const [contextoOperacao, setContextoOperacao] = useState<TributarioNcmContextoOperacao>('nao_informado')
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
    } else if (novoPerfil === 'importador') {
      setOperacao('importacao')
    } else if (novoPerfil === 'varejista') {
      setOperacao('revenda')
    } else if (novoPerfil === 'distribuidor') {
      setOperacao('revenda')
    } else if (novoPerfil === 'consumidor_final') {
      setOperacao('venda_consumidor')
    } else {
      setOperacao('revenda')
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
        contexto_operacao: contextoOperacao,
      })
      if (descricao.trim()) params.set('descricao', descricao.trim())
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 5, color: 'var(--af-muted)', fontSize: 10.5, fontWeight: 700 }}>
              PAPEL DA EMPRESA NA OPERAÇÃO
              <select value={perfil} onChange={event => alterarPerfil(event.target.value as TributarioNcmPerfil)} style={inputStyle}>
                <option value="fabricante">Fabricante, produtor ou refinaria</option>
                <option value="importador">Importador</option>
                <option value="distribuidor">Distribuidor de combustíveis</option>
                <option value="atacadista">Comerciante atacadista</option>
                <option value="varejista">Comerciante varejista</option>
                <option value="consumidor_final">Consumidor final</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5, color: 'var(--af-muted)', fontSize: 10.5, fontWeight: 700 }}>
              OPERAÇÃO ANALISADA
              <select value={operacao} onChange={event => setOperacao(event.target.value as TributarioNcmOperacao)} style={inputStyle}>
                <option value="venda_producao">{perfil === 'importador' ? 'Venda de mercadoria importada' : 'Venda de produção própria'}</option>
                <option value="importacao">Importação</option>
                <option value="revenda">Revenda</option>
                <option value="venda_consumidor">Venda a consumidor final</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5, color: 'var(--af-muted)', fontSize: 10.5, fontWeight: 700 }}>
              DESTINATÁRIO / ENQUADRAMENTO AUTOMOTIVO
              <select value={contextoOperacao} onChange={event => setContextoOperacao(event.target.value as TributarioNcmContextoOperacao)} style={inputStyle}>
                <option value="nao_informado">Não informado</option>
                <option value="fabricante_veiculos">Fabricante de veículos ou máquinas</option>
                <option value="atacadista_varejista">Atacadista ou varejista</option>
                <option value="consumidor">Consumidor da autopeça</option>
                <option value="outro">Outra destinação</option>
              </select>
            </label>
            <button type="submit" disabled={carregando} style={{ height: 42, border: 0, borderRadius: 9, padding: '0 20px', cursor: 'pointer', background: 'var(--af-primary)', color: '#fff', fontSize: 12.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: carregando ? 0.65 : 1 }}>
              <Search size={16} /> {carregando ? 'Consultando...' : 'Consultar NCM'}
            </button>
          </div>

        </form>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 11, color: 'var(--af-muted)', fontSize: 11, lineHeight: 1.5 }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Esta consulta trata somente dos tributos federais PIS, Cofins e IPI. O resultado considera o produto, a operação e o papel da empresa na cadeia.
          Para autopeças, informe o comprador da venda; na importação, o enquadramento do próprio importador.
        </div>
      </GlassCard>

      {erro && (
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '11px 13px', borderRadius: 10, background: 'rgba(239,68,68,0.09)', color: '#dc2626', fontSize: 12 }}>
          <AlertTriangle size={16} /> {erro}
        </div>
      )}

      {resultado && (
        <GlassCard padding={0}>
          {(resultado.resultado.classificacao_oficial?.hierarquia?.length ?? 0) > 0 && (
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--af-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: 'var(--af-text)', fontSize: 11, fontWeight: 800 }}>Contexto da classificação oficial</div>
                  <div style={{ marginTop: 2, color: 'var(--af-muted)', fontSize: 9.8 }}>Hierarquia anterior ao NCM consultado</div>
                </div>
                <a href={resultado.fonte.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', color: 'var(--af-primary)', textDecoration: 'none', fontSize: 10.5, fontWeight: 700 }}>
                  <BookOpen size={13} /> Tabela oficial NCM
                </a>
              </div>

              <div style={{ marginTop: 10, overflow: 'hidden', border: '1px solid var(--af-border)', borderRadius: 10, background: 'var(--af-surface-2)' }}>
                {resultado.resultado.classificacao_oficial?.hierarquia.map((item, indice) => (
                  <div
                    key={`${item.nivel}-${item.codigo}`}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'baseline',
                      padding: `8px 12px 8px ${12 + RECUOS_HIERARQUIA[item.nivel]}px`,
                      borderTop: indice === 0 ? 0 : '1px solid var(--af-border)',
                      borderLeft: item.nivel === 'secao' ? '3px solid var(--af-primary)' : '3px solid transparent',
                      background: item.nivel === 'secao'
                        ? 'rgba(39,199,216,0.09)'
                        : item.nivel === 'capitulo' ? 'rgba(39,199,216,0.04)' : 'transparent',
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ flexShrink: 0, color: item.nivel === 'secao' ? 'var(--af-primary)' : 'var(--af-muted)', fontSize: 9.5, fontWeight: 800 }}>
                      {ROTULOS_HIERARQUIA[item.nivel]} {item.codigo}
                    </span>
                    <span style={{ color: 'var(--af-text-soft)', fontSize: 10.5 }}>{item.descricao}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--af-border)', display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: 'var(--af-primary)', fontFamily: 'monospace', fontSize: 12, fontWeight: 800 }}>{resultado.resultado.ncm_formatado}</div>
              <h2 style={{ margin: '5px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--af-text)', lineHeight: 1.4 }}>
                {resultado.resultado.classificacao_oficial?.descricao ?? (descricao || 'Descrição oficial indisponível')}
              </h2>
              {resultado.resultado.classificacao_oficial && descricao && (
                <div style={{ marginTop: 4, color: 'var(--af-muted)', fontSize: 10.5 }}>Produto informado: {descricao}</div>
              )}
            </div>
            {(resultado.resultado.classificacao_oficial?.hierarquia?.length ?? 0) === 0 && (
              <a href={resultado.fonte.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', color: 'var(--af-primary)', textDecoration: 'none', fontSize: 10.5, fontWeight: 700 }}>
                <BookOpen size={13} /> Tabela oficial NCM
              </a>
            )}
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            {resultado.resultado.tipi ? (() => {
              const tipi = resultado.resultado.tipi
              const corTipi = CORES_TIPI[tipi.situacao]
              return (
                <section style={{ border: `1px solid ${corTipi.borda}`, borderRadius: 12, background: corTipi.fundo, padding: '15px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--af-muted)', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>IPI — alíquota nominal da TIPI</div>
                      <div style={{ marginTop: 5, color: 'var(--af-text)', fontSize: 13.5, fontWeight: 750 }}>{tipi.descricao}</div>
                    </div>
                    <span style={{ padding: '5px 10px', borderRadius: 999, background: 'var(--af-surface)', color: corTipi.texto, fontSize: 11, fontWeight: 850, whiteSpace: 'nowrap' }}>
                      {tipi.aliquota_texto}
                    </span>
                  </div>

                  {tipi.excecoes.length > 0 && (
                    <div style={{ display: 'grid', gap: 6, marginTop: 11, padding: '10px 11px', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 9, background: 'rgba(245,158,11,0.05)' }}>
                      <div style={{ color: '#b45309', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exceções da TIPI — confirmar a descrição</div>
                      {tipi.excecoes.map(excecao => (
                        <div key={excecao.ex} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--af-text-soft)', fontSize: 10.5, lineHeight: 1.45 }}>
                          <span><strong>Ex {excecao.ex}:</strong> {excecao.descricao}</span>
                          <strong style={{ color: CORES_TIPI[excecao.situacao].texto, whiteSpace: 'nowrap' }}>{excecao.aliquota_texto}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 11, flexWrap: 'wrap' }}>
                    <div style={{ color: 'var(--af-muted)', fontSize: 9.8, lineHeight: 1.45 }}>A alíquota da TIPI não substitui a análise de suspensão, isenção, imunidade, regime especial ou enquadramento do estabelecimento.</div>
                    <a href={resultado.fonte_tipi.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--af-primary)', textDecoration: 'none', fontSize: 9.8, fontWeight: 700 }}>
                      <BookOpen size={11} /> {resultado.fonte_tipi.referencia}
                    </a>
                  </div>
                </section>
              )
            })() : (
              <section style={{ padding: '12px 13px', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 10, background: 'rgba(245,158,11,0.05)' }}>
                <div style={{ color: '#b45309', fontSize: 10.5, fontWeight: 800 }}>IPI — alíquota não localizada na TIPI oficial</div>
                <div style={{ marginTop: 3, color: 'var(--af-muted)', fontSize: 10.2 }}>Não considere alíquota zero. Confirme o código vigente e consulte a tabela oficial.</div>
              </section>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid var(--af-border)', borderRadius: 10, background: 'var(--af-surface-2)' }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 1, color: 'var(--af-primary)' }} />
              <div style={{ color: 'var(--af-muted)', fontSize: 10.2, lineHeight: 1.5 }}><strong style={{ color: 'var(--af-text-soft)' }}>CBS em preparação:</strong> a futura análise será mantida separada das conclusões atuais de PIS/Cofins e considerará classificação tributária, regime e operação, sem converter automaticamente regras monofásicas existentes.</div>
            </div>

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

                  {(item.cst_saida || item.codigo_natureza_receita) && (
                    <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      {item.cst_saida && (
                        <span style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid var(--af-border)', background: 'var(--af-surface)', color: 'var(--af-text-soft)', fontSize: 10, fontWeight: 750 }}>
                          CST de saída {item.cst_saida}
                        </span>
                      )}
                      {item.codigo_natureza_receita && (
                        <span style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid var(--af-border)', background: 'var(--af-surface)', color: 'var(--af-text-soft)', fontSize: 10, fontWeight: 750 }}>
                          Natureza da receita {item.codigo_natureza_receita}
                        </span>
                      )}
                      {item.tabela_efd && (
                        <span style={{ color: 'var(--af-muted)', fontSize: 9.8 }}>Referência: EFD-Contribuições {item.tabela_efd}</span>
                      )}
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
                <div style={{ marginTop: 4, color: 'var(--af-muted)', fontSize: 10.8 }}>Isso não significa tributação normal de PIS/Cofins. Pode faltar uma regra validada ou a operação não corresponder ao papel selecionado.</div>
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
