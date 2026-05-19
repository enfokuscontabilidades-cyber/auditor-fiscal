'use client'

import { useState } from 'react'
import { Search, Building2, CheckCircle2, RefreshCw, AlertCircle, Users, ChevronDown, ChevronUp, Phone, Mail, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ─── Tipos da API cnpj.ws ─── */

interface Socio {
  id: number
  nome: string
  tipo: string
  data_entrada?: string
  cpf_cnpj_socio?: string
  faixa_etaria?: string
  qualificacao_socio?: { id: number; descricao: string }
}

interface CnpjWsResponse {
  cnpj_raiz: string
  razao_social: string
  capital_social?: string
  socios?: Socio[]
  simples?: {
    simples: string          // "Sim" | "Não"
    mei: string              // "Sim" | "Não"
    data_opcao_simples?: string
    data_exclusao_simples?: string
    data_opcao_mei?: string
    data_exclusao_mei?: string
  }
  estabelecimento: {
    cnpj: string
    tipo: string
    nome_fantasia?: string
    situacao_cadastral: string
    atividade_principal?: { id: string; descricao: string }
    atividades_secundarias?: Array<{ id: string; descricao: string }>
    estado?: { sigla: string; nome: string }
    cidade?: { nome: string }
    inscricoes_estaduais?: Array<{ inscricao_estadual: string; ativo: boolean; estado?: { sigla: string } }>
    tipo_logradouro?: string
    logradouro?: string
    numero?: string
    complemento?: string
    bairro?: string
    cep?: string
    ddd1?: string
    telefone1?: string
    ddd2?: string
    telefone2?: string
    email?: string
  }
}

/* ─── Helpers ─── */

function detectarRegime(data: CnpjWsResponse): string {
  if (data.simples?.mei === 'Sim') return 'MEI'
  if (data.simples?.simples === 'Sim') return 'Simples Nacional'
  return 'Lucro Presumido'
}

function formatData(d?: string | null): string {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function formatCep(cep?: string): string {
  if (!cep) return ''
  return cep.replace(/(\d{5})(\d{3})/, '$1-$2')
}

function formatMoeda(valor?: string): string {
  if (!valor) return '—'
  const n = parseFloat(valor)
  if (isNaN(n)) return valor
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarCnpj(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function mapearDados(data: CnpjWsResponse) {
  const est = data.estabelecimento
  const ie = est.inscricoes_estaduais?.find(i => i.ativo)?.inscricao_estadual ?? ''
  const tipo = est.tipo === 'Filial' ? 'Filial' : est.tipo === 'Matriz' ? 'Matriz' : 'Autônoma'
  const telefone = est.ddd1 && est.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : ''
  const logradouro = [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' ')

  return {
    razao_social:       data.razao_social ?? '',
    nome_fantasia:      est.nome_fantasia ?? '',
    cnpj:               est.cnpj ?? '',
    uf:                 est.estado?.sigla ?? 'GO',
    cnae_principal:     est.atividade_principal?.id ?? '',
    inscricao_estadual: ie,
    tipo,
    regime:             detectarRegime(data),
    situacao_cadastral: est.situacao_cadastral ?? '',
    logradouro,
    numero:             est.numero ?? '',
    complemento:        est.complemento ?? '',
    bairro:             est.bairro ?? '',
    cep:                est.cep ?? '',
    municipio:          est.cidade?.nome ?? '',
    telefone,
    email:              est.email ?? '',
  }
}

/* ─── Estilos compartilhados ─── */

const COR_REGIME: Record<string, string> = {
  'Simples Nacional': 'var(--af-success)',
  'Lucro Presumido':  'var(--af-warning)',
  'Lucro Real':       'var(--af-warning)',
  MEI:                '#60a5fa',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--af-muted)',
  marginBottom: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const fieldLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--af-muted)',
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  marginBottom: 2,
}

const fieldValue: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--af-text-soft)',
  lineHeight: 1.4,
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--af-border)', margin: '12px 0' }} />
}

/* ─── Componente ─── */

export default function CnpjSearchCard() {
  const supabase = createClient()
  const [cnpjInput, setCnpjInput]           = useState('')
  const [resultado, setResultado]           = useState<CnpjWsResponse | null>(null)
  const [carregando, setCarregando]         = useState(false)
  const [erro, setErro]                     = useState<string | null>(null)
  const [jaCadastrado, setJaCadastrado]     = useState(false)
  const [cadastrando, setCadastrando]       = useState(false)
  const [cadastradoSucesso, setCadastradoSucesso] = useState(false)
  const [mostrarQsa, setMostrarQsa]         = useState(false)

  async function consultar() {
    const cnpjLimpo = cnpjInput.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) {
      setErro('Digite um CNPJ com 14 dígitos.')
      return
    }
    setCarregando(true)
    setErro(null)
    setResultado(null)
    setJaCadastrado(false)
    setCadastradoSucesso(false)
    setMostrarQsa(false)
    try {
      const res  = await fetch(`/api/cnpj/${cnpjLimpo}`)
      const json = await res.json()
      if (!res.ok) { setErro(json.error ?? 'Erro ao consultar CNPJ.'); return }
      setResultado(json)
      const { data } = await supabase.from('empresas').select('id').eq('cnpj', cnpjLimpo).maybeSingle()
      setJaCadastrado(!!data)
    } catch {
      setErro('Falha na conexão. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  async function cadastrar() {
    if (!resultado) return
    setCadastrando(true)
    const d = mapearDados(resultado)
    const { error } = await supabase.from('empresas').insert({
      razao_social:       d.razao_social,
      nome_fantasia:      d.nome_fantasia || null,
      cnpj:               d.cnpj,
      regime:             d.regime,
      cnae_principal:     d.cnae_principal || null,
      inscricao_estadual: d.inscricao_estadual || null,
      uf:                 d.uf,
      situacao_cadastral: d.situacao_cadastral || null,
      logradouro:         d.logradouro || null,
      numero:             d.numero || null,
      complemento:        d.complemento || null,
      bairro:             d.bairro || null,
      cep:                d.cep || null,
      municipio:          d.municipio || null,
      telefone:           d.telefone || null,
      email:              d.email || null,
      status:             'Ativo',
    })
    if (error) setErro('Erro ao cadastrar: ' + error.message)
    else { setJaCadastrado(true); setCadastradoSucesso(true) }
    setCadastrando(false)
  }

  const inp: React.CSSProperties = {
    flex: 1,
    background: 'var(--af-surface-2)',
    border: '1px solid var(--af-border)',
    borderRadius: 8,
    color: 'var(--af-text)',
    fontSize: 14,
    padding: '10px 13px',
    outline: 'none',
    fontFamily: 'var(--font-geist-mono)',
    letterSpacing: '0.03em',
  }

  const est     = resultado?.estabelecimento
  const simples = resultado?.simples
  const regime  = resultado ? detectarRegime(resultado) : ''
  const corReg  = COR_REGIME[regime] ?? 'var(--af-muted)'

  const iesAtivas = est?.inscricoes_estaduais?.filter(i => i.ativo) ?? []
  const enderecoLinha1 = est
    ? [[est.tipo_logradouro, est.logradouro].filter(Boolean).join(' '), est.numero, est.complemento]
        .filter(Boolean).join(', ')
    : ''
  const enderecoLinha2 = est
    ? [est.bairro, est.cidade?.nome && est.estado?.sigla ? `${est.cidade.nome}/${est.estado.sigla}` : est.cidade?.nome, formatCep(est.cep)]
        .filter(Boolean).join(' — ')
    : ''

  const tel1 = est?.ddd1 && est?.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : ''
  const tel2 = est?.ddd2 && est?.telefone2 ? `(${est.ddd2}) ${est.telefone2}` : ''

  return (
    <div>
      {/* Input + botão */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          style={inp}
          placeholder="00.000.000/0000-00"
          value={cnpjInput}
          onChange={e => { setCnpjInput(formatarCnpj(e.target.value)); setErro(null) }}
          onKeyDown={e => e.key === 'Enter' && consultar()}
          maxLength={18}
        />
        <button
          onClick={consultar}
          disabled={carregando}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--af-primary)', border: 'none', borderRadius: 8,
            color: '#050d17', fontSize: 13, fontWeight: 700, padding: '10px 16px',
            cursor: carregando ? 'not-allowed' : 'pointer', opacity: carregando ? 0.7 : 1, whiteSpace: 'nowrap',
          }}
        >
          {carregando
            ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <Search size={14} />}
          {carregando ? 'Consultando...' : 'Consultar'}
        </button>
      </div>

      {/* Erro */}
      {erro && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, marginTop: 10,
          padding: '9px 12px', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
          color: 'var(--af-danger)', fontSize: 13,
        }}>
          <AlertCircle size={14} />{erro}
        </div>
      )}

      {/* Card de resultado */}
      {resultado && est && (
        <div style={{
          marginTop: 14,
          background: 'var(--af-surface-2)',
          border: '1px solid var(--af-primary-soft)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>

          {/* ── Cabeçalho ── */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--af-border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 38, height: 38, flexShrink: 0,
                  background: 'var(--af-primary-soft)', border: '1px solid var(--af-border)',
                  borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={17} color="var(--af-primary)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--af-text)', lineHeight: 1.3 }}>
                    {resultado.razao_social}
                  </div>
                  {est.nome_fantasia && (
                    <div style={{ fontSize: 12, color: 'var(--af-muted)', marginTop: 1 }}>
                      {est.nome_fantasia}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--af-muted)', fontFamily: 'var(--font-geist-mono)', marginTop: 2 }}>
                    {est.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, letterSpacing: '0.07em',
                  background: est.situacao_cadastral === 'Ativa' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                  color: est.situacao_cadastral === 'Ativa' ? 'var(--af-success)' : 'var(--af-danger)',
                  border: `1px solid ${est.situacao_cadastral === 'Ativa' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
                }}>
                  {est.situacao_cadastral}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, letterSpacing: '0.06em',
                  background: `${corReg}1a`, color: corReg, border: `1px solid ${corReg}40`,
                }}>
                  {regime}
                </span>
                {est.tipo && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, letterSpacing: '0.06em',
                    background: 'var(--af-primary-soft)', color: 'var(--af-primary)', border: '1px solid var(--af-border)',
                  }}>
                    {est.tipo}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Dados principais ── */}
          <div style={{ padding: '12px 16px' }}>

            {/* CNAE */}
            {est.atividade_principal && (
              <>
                <div style={sectionLabel}>Atividade principal</div>
                <div style={{ fontSize: 12, color: 'var(--af-text-soft)', marginBottom: 12 }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--af-primary)', marginRight: 6 }}>
                    {est.atividade_principal.id}
                  </span>
                  {est.atividade_principal.descricao}
                </div>
              </>
            )}

            {/* Grid UF + Município */}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px 16px', marginBottom: 12 }}>
              <div>
                <div style={fieldLabel}>UF</div>
                <div style={fieldValue}>{est.estado?.sigla ?? '—'}</div>
              </div>
              <div>
                <div style={fieldLabel}>Município</div>
                <div style={fieldValue}>{est.cidade?.nome ?? '—'}</div>
              </div>
            </div>

            <Divider />

            {/* Endereço */}
            {(enderecoLinha1 || enderecoLinha2) && (
              <div style={{ marginBottom: 12 }}>
                <div style={sectionLabel}><MapPin size={11} />Endereço</div>
                {enderecoLinha1 && <div style={fieldValue}>{enderecoLinha1}</div>}
                {enderecoLinha2 && <div style={{ ...fieldValue, marginTop: 2 }}>{enderecoLinha2}</div>}
              </div>
            )}

            {/* Contato */}
            {(tel1 || tel2 || est.email) && (
              <>
                <div style={sectionLabel}><Phone size={11} />Contato</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginBottom: 12 }}>
                  {tel1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Phone size={11} color="var(--af-muted)" />
                      <span style={fieldValue}>{tel1}</span>
                    </div>
                  )}
                  {tel2 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Phone size={11} color="var(--af-muted)" />
                      <span style={fieldValue}>{tel2}</span>
                    </div>
                  )}
                  {est.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Mail size={11} color="var(--af-muted)" />
                      <span style={fieldValue}>{est.email}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <Divider />

            {/* Regime tributário detalhado */}
            <div style={{ marginBottom: 12 }}>
              <div style={sectionLabel}>Regime tributário</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Simples Nacional */}
                {(() => {
                  const optante = simples?.simples === 'Sim'
                  const excluido = !optante && !!simples?.data_exclusao_simples
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', borderRadius: 8,
                      background: optante ? 'rgba(34,197,94,0.07)' : 'rgba(148,163,184,0.05)',
                      border: `1px solid ${optante ? 'rgba(34,197,94,0.2)' : 'var(--af-border)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: optante ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.15)',
                          color: optante ? 'var(--af-success)' : 'var(--af-muted)',
                          fontSize: 10, fontWeight: 900,
                        }}>{optante ? '✓' : '✗'}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: optante ? 'var(--af-text)' : 'var(--af-muted)' }}>
                          Simples Nacional
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                        {optante
                          ? `Optante desde ${formatData(simples?.data_opcao_simples)}`
                          : excluido
                            ? `Excluído em ${formatData(simples?.data_exclusao_simples)}`
                            : 'Não optante'}
                      </span>
                    </div>
                  )
                })()}

                {/* MEI */}
                {(() => {
                  const optanteMei = simples?.mei === 'Sim'
                  const excluidoMei = !optanteMei && !!simples?.data_exclusao_mei
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', borderRadius: 8,
                      background: optanteMei ? 'rgba(96,165,250,0.07)' : 'rgba(148,163,184,0.05)',
                      border: `1px solid ${optanteMei ? 'rgba(96,165,250,0.2)' : 'var(--af-border)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: optanteMei ? 'rgba(96,165,250,0.2)' : 'rgba(148,163,184,0.15)',
                          color: optanteMei ? '#60a5fa' : 'var(--af-muted)',
                          fontSize: 10, fontWeight: 900,
                        }}>{optanteMei ? '✓' : '✗'}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: optanteMei ? 'var(--af-text)' : 'var(--af-muted)' }}>
                          MEI
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                        {optanteMei
                          ? `Optante desde ${formatData(simples?.data_opcao_mei)}`
                          : excluidoMei
                            ? `Excluído em ${formatData(simples?.data_exclusao_mei)}`
                            : 'Não enquadrado'}
                      </span>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* IEs */}
            {iesAtivas.length > 0 && (
              <>
                <Divider />
                <div style={{ marginBottom: 12 }}>
                  <div style={sectionLabel}>Inscrições estaduais</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {iesAtivas.map((ie, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...fieldValue, fontFamily: 'var(--font-geist-mono)' }}>{ie.inscricao_estadual}</span>
                        {ie.estado?.sigla && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--af-primary)', background: 'var(--af-primary-soft)', padding: '1px 6px', borderRadius: 4 }}>
                            {ie.estado.sigla}
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: 'var(--af-success)' }}>Ativa</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── QSA ── */}
            {(resultado.socios?.length || resultado.capital_social) && (
              <>
                <Divider />
                <button
                  type="button"
                  onClick={() => setMostrarQsa(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                    background: mostrarQsa ? 'var(--af-primary-soft)' : 'rgba(148,163,184,0.06)',
                    border: `1px solid ${mostrarQsa ? 'rgba(39,199,216,0.3)' : 'var(--af-border)'}`,
                    borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
                    color: mostrarQsa ? 'var(--af-primary)' : 'var(--af-muted)',
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                    marginBottom: mostrarQsa ? 10 : 0,
                  }}
                >
                  <Users size={13} />
                  QSA — Quadro Societário
                  {resultado.socios?.length ? (
                    <span style={{
                      marginLeft: 4, fontSize: 10, fontWeight: 800,
                      background: mostrarQsa ? 'rgba(39,199,216,0.2)' : 'rgba(148,163,184,0.15)',
                      padding: '1px 6px', borderRadius: 10,
                    }}>
                      {resultado.socios.length}
                    </span>
                  ) : null}
                  <span style={{ marginLeft: 'auto' }}>
                    {mostrarQsa ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>

                {mostrarQsa && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Capital social */}
                    {resultado.capital_social && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', background: 'rgba(148,163,184,0.05)',
                        border: '1px solid var(--af-border)', borderRadius: 8,
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--af-muted)', fontWeight: 600 }}>Capital Social</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--af-text)', fontFamily: 'var(--font-geist-mono)' }}>
                          {formatMoeda(resultado.capital_social)}
                        </span>
                      </div>
                    )}

                    {/* Sócios */}
                    {resultado.socios?.map((s, i) => (
                      <div key={i} style={{
                        padding: '9px 12px',
                        background: 'rgba(148,163,184,0.04)',
                        border: '1px solid var(--af-border)',
                        borderRadius: 8,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--af-text)', marginBottom: 3 }}>
                              {s.nome}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                              {s.qualificacao_socio?.descricao ?? s.tipo}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {s.data_entrada && (
                              <div style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                                desde {formatData(s.data_entrada)}
                              </div>
                            )}
                            {s.faixa_etaria && (
                              <div style={{ fontSize: 10, color: 'var(--af-muted)', marginTop: 2 }}>
                                {s.faixa_etaria}
                              </div>
                            )}
                          </div>
                        </div>
                        {s.cpf_cnpj_socio && (
                          <div style={{ fontSize: 10, color: 'var(--af-muted)', fontFamily: 'var(--font-geist-mono)', marginTop: 4 }}>
                            {s.tipo === 'Pessoa Jurídica'
                              ? s.cpf_cnpj_socio.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
                              : s.cpf_cnpj_socio}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Ações ── */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--af-border)' }}>
              {cadastradoSucesso ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--af-success)', fontSize: 13, fontWeight: 600 }}>
                  <CheckCircle2 size={15} />Empresa cadastrada com sucesso!
                </div>
              ) : jaCadastrado ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--af-muted)', fontSize: 12 }}>
                  <CheckCircle2 size={13} color="var(--af-success)" />
                  <span>Empresa já cadastrada no sistema</span>
                </div>
              ) : (
                <button
                  onClick={cadastrar}
                  disabled={cadastrando}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--af-primary)', border: 'none', borderRadius: 8,
                    color: '#050d17', fontSize: 13, fontWeight: 700, padding: '9px 16px',
                    cursor: cadastrando ? 'not-allowed' : 'pointer', opacity: cadastrando ? 0.7 : 1,
                  }}
                >
                  <Building2 size={14} />
                  {cadastrando ? 'Cadastrando...' : 'Cadastrar empresa'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
