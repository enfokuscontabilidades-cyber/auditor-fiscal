'use client'

import React, { useState } from 'react'
import {
  X, Building2, MapPin, Phone, Tag, Briefcase,
  Users, BookmarkPlus, CheckCircle2, AlertCircle, ExternalLink,
} from 'lucide-react'

// ─── Tipo normalizado ──────────────────────────────────────────────────────────
// Todos os campos são flat (sem sub-objetos { descricao }).
// A normalização acontece na API route antes de chegar aqui.

export type CnpjDados = {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  situacao_cadastral?: string
  data_situacao_cadastral?: string
  motivo_situacao_cadastral?: string
  situacao_especial?: string
  data_situacao_especial?: string
  data_abertura?: string
  natureza_juridica?: string
  porte?: string
  tipo?: string
  capital_social?: number

  endereco?: {
    logradouro?: string
    numero?: string
    complemento?: string
    bairro?: string
    municipio?: string
    uf?: string
    cep?: string
    pais?: string
  }

  contato?: {
    telefone?: string
    email?: string
  }

  atividade_principal?: {
    codigo: string
    descricao: string
  }

  atividades_secundarias?: {
    codigo: string
    descricao: string
  }[]

  socios?: {
    nome?: string
    qualificacao?: string
    data_entrada?: string
    faixa_etaria?: string
    pais_origem?: string
  }[]

  fonte_consulta: 'api' | 'cache'
  consultado_em: string
}

interface ModalCnpjProps {
  dados: CnpjDados
  onFechar: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fcnpj = (v = '') =>
  v.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

const fcep = (v = '') =>
  v.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')

const fmoe = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** "YYYY-MM-DD" → "DD/MM/YYYY" */
const fdata = (v = '') => {
  const p = v.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Secao({ icon, titulo, children }: {
  icon: React.ReactNode
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        borderBottom: '1px solid var(--af-border)', paddingBottom: 8,
      }}>
        <span style={{ color: 'var(--af-primary)', display: 'flex' }}>{icon}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--af-muted)',
        }}>{titulo}</span>
      </div>
      {children}
    </div>
  )
}

function Campo({ label, valor, mono }: {
  label: string
  valor?: string | null
  mono?: boolean
}) {
  if (!valor) return null
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--af-muted)', minWidth: 180, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 600, color: 'var(--af-text)',
        fontFamily: mono ? 'var(--font-geist-mono)' : undefined,
      }}>
        {valor}
      </span>
    </div>
  )
}

function chipSituacao(sit?: string): React.CSSProperties {
  const s = (sit ?? '').toUpperCase()
  if (s === 'ATIVA')    return { background: 'rgba(34,197,94,0.12)',  color: 'var(--af-success)', border: '1px solid rgba(34,197,94,0.25)' }
  if (s === 'BAIXADA')  return { background: 'rgba(239,68,68,0.10)', color: 'var(--af-danger)',  border: '1px solid rgba(239,68,68,0.25)' }
  if (s === 'SUSPENSA') return { background: 'rgba(251,191,36,0.10)', color: 'var(--af-warning)', border: '1px solid rgba(251,191,36,0.25)' }
  return { background: 'var(--af-surface-2)', color: 'var(--af-muted)', border: '1px solid var(--af-border)' }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ModalCnpj({ dados: d, onFechar }: ModalCnpjProps) {
  const [cadastrando,    setCadastrando]    = useState(false)
  const [cadastroStatus, setCadastroStatus] = useState<'idle' | 'ok' | 'exists' | 'error'>('idle')
  const [cadastroMsg,    setCadastroMsg]    = useState('')
  const [empresaId,      setEmpresaId]      = useState<string | null>(null)

  async function handleCadastrar() {
    setCadastrando(true)
    setCadastroStatus('idle')
    try {
      const r   = await fetch('/api/empresas/cadastrar-por-cnpj', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dados: d }),
      })
      const res = await r.json()
      if (!r.ok) {
        setCadastroMsg(res.error || `Erro ${r.status}`)
        setCadastroStatus('error')
      } else if (res.exists) {
        setCadastroMsg(`Empresa já cadastrada: ${res.empresa.razao_social}`)
        setCadastroStatus('exists')
        setEmpresaId(res.empresa.id as string)
      } else {
        setCadastroMsg('Empresa cadastrada com sucesso!')
        setCadastroStatus('ok')
        setEmpresaId(res.empresa.id as string)
      }
    } catch {
      setCadastroMsg('Falha ao conectar. Tente novamente.')
      setCadastroStatus('error')
    } finally {
      setCadastrando(false)
    }
  }

  // Montagem de linhas de endereço
  const endLinha1 = [d.endereco?.logradouro, d.endereco?.numero, d.endereco?.complemento]
    .filter(Boolean).join(', ')
  const cidadeUf  = [d.endereco?.municipio, d.endereco?.uf].filter(Boolean).join(' — ')
  const temEndereco = endLinha1 || cidadeUf || d.endereco?.cep

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onFechar}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '5vh', left: '50%', transform: 'translateX(-50%)',
        zIndex: 910, width: '100%', maxWidth: 700,
        maxHeight: '88vh', overflow: 'auto',
        background: 'var(--af-surface)',
        border: '1px solid var(--af-border)',
        borderRadius: 20,
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        padding: '28px 32px 24px',
        color: 'var(--af-text)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', marginBottom: 24,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 2 }}>
              {d.razao_social || 'Empresa'}
            </div>
            {d.nome_fantasia && d.nome_fantasia !== d.razao_social && (
              <div style={{ fontSize: 13, color: 'var(--af-muted)', marginBottom: 4 }}>
                {d.nome_fantasia}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-geist-mono)', color: 'var(--af-muted)' }}>
                {fcnpj(d.cnpj)}
              </span>
              {d.situacao_cadastral && (
                <span style={{
                  ...chipSituacao(d.situacao_cadastral),
                  borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {d.situacao_cadastral}
                </span>
              )}
              {d.tipo && (
                <span style={{
                  background: 'var(--af-primary-soft)', color: 'var(--af-primary)',
                  border: '1px solid var(--af-glass-border)',
                  borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                }}>
                  {d.tipo}
                </span>
              )}
            </div>
            {/* Metadados da consulta */}
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                Fonte:{' '}
                <strong style={{ color: d.fonte_consulta === 'cache' ? 'var(--af-warning)' : 'var(--af-success)' }}>
                  {d.fonte_consulta === 'cache'
                    ? 'cache local (API indisponível)'
                    : 'Receita Federal (ao vivo)'}
                </strong>
              </span>
              {d.consultado_em && (
                <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                  Consultado em:{' '}
                  {new Date(d.consultado_em).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onFechar}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--af-muted)', padding: 6, borderRadius: 8,
              display: 'flex', flexShrink: 0, marginLeft: 12,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── 1: Dados principais ──────────────────────────────────────────── */}
        <Secao icon={<Building2 size={15} />} titulo="Dados principais">
          <Campo label="Razão social"            valor={d.razao_social} />
          <Campo label="Nome fantasia"           valor={d.nome_fantasia} />
          <Campo label="Natureza jurídica"       valor={d.natureza_juridica} />
          <Campo label="Porte"                   valor={d.porte} />
          <Campo label="Tipo"                    valor={d.tipo} />
          <Campo label="Data de abertura"        valor={d.data_abertura ? fdata(d.data_abertura) : undefined} />
          <Campo label="Capital social"          valor={typeof d.capital_social === 'number' ? fmoe(d.capital_social) : undefined} />
          <Campo label="Situação cadastral"      valor={d.situacao_cadastral} />
          <Campo label="Data da situação"        valor={d.data_situacao_cadastral ? fdata(d.data_situacao_cadastral) : undefined} />
          <Campo label="Motivo da situação"      valor={d.motivo_situacao_cadastral} />
          <Campo label="Situação especial"       valor={d.situacao_especial} />
          <Campo label="Data situação especial"  valor={d.data_situacao_especial ? fdata(d.data_situacao_especial) : undefined} />
        </Secao>

        {/* ── 2: Endereço ──────────────────────────────────────────────────── */}
        {temEndereco && (
          <Secao icon={<MapPin size={15} />} titulo="Endereço">
            {endLinha1 && <Campo label="Logradouro" valor={endLinha1} />}
            <Campo label="Bairro"    valor={d.endereco?.bairro} />
            {cidadeUf  && <Campo label="Município"  valor={cidadeUf} />}
            <Campo label="CEP"       valor={fcep(d.endereco?.cep ?? '')} mono />
            {d.endereco?.pais && d.endereco.pais.toLowerCase() !== 'brasil' && (
              <Campo label="País" valor={d.endereco.pais} />
            )}
          </Secao>
        )}

        {/* ── 3: Contato ───────────────────────────────────────────────────── */}
        {(d.contato?.telefone || d.contato?.email) && (
          <Secao icon={<Phone size={15} />} titulo="Contato">
            <Campo label="Telefone" valor={d.contato.telefone} mono />
            <Campo label="E-mail"   valor={d.contato.email}    mono />
          </Secao>
        )}

        {/* ── 4: Atividade principal ────────────────────────────────────────── */}
        {d.atividade_principal && (
          <Secao icon={<Tag size={15} />} titulo="Atividade principal">
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                fontFamily: 'var(--font-geist-mono)', fontWeight: 700, fontSize: 13,
                color: 'var(--af-primary)', flexShrink: 0,
              }}>
                {d.atividade_principal.codigo}
              </span>
              <span style={{ fontSize: 13, color: 'var(--af-text)' }}>
                {d.atividade_principal.descricao}
              </span>
            </div>
          </Secao>
        )}

        {/* ── 5: Atividades secundárias ─────────────────────────────────────── */}
        <Secao icon={<Briefcase size={15} />} titulo="Atividades secundárias">
          {!d.atividades_secundarias || d.atividades_secundarias.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--af-muted)', fontStyle: 'italic' }}>
              Nenhuma atividade secundária localizada na consulta.
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {d.atividades_secundarias.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    fontFamily: 'var(--font-geist-mono)', fontWeight: 700, fontSize: 12,
                    color: 'var(--af-muted)', flexShrink: 0,
                  }}>
                    {c.codigo}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--af-text-soft)' }}>
                    {c.descricao}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Secao>

        {/* ── 6: Quadro societário (QSA) ────────────────────────────────────── */}
        <Secao icon={<Users size={15} />} titulo="Quadro societário (QSA)">
          {!d.socios || d.socios.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--af-muted)', fontStyle: 'italic' }}>
              Informação não disponibilizada pela fonte de consulta.
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {d.socios.map((sc, i) => (
                <div key={i} style={{
                  background: 'var(--af-surface-2)', borderRadius: 10,
                  border: '1px solid var(--af-border)', padding: '10px 14px',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                    {sc.nome || '—'}
                  </div>
                  {sc.qualificacao && (
                    <div style={{ fontSize: 12, color: 'var(--af-muted)' }}>
                      {sc.qualificacao}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                    {sc.data_entrada && (
                      <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                        Entrada: {fdata(sc.data_entrada)}
                      </span>
                    )}
                    {sc.faixa_etaria && (
                      <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                        Faixa etária: {sc.faixa_etaria}
                      </span>
                    )}
                    {sc.pais_origem && sc.pais_origem.toLowerCase() !== 'brasil' && (
                      <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                        País: {sc.pais_origem}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Secao>

        {/* ── Rodapé: Cadastrar empresa ─────────────────────────────────────── */}
        <div style={{
          borderTop: '1px solid var(--af-border)', paddingTop: 16, marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          {cadastroStatus === 'idle' && (
            <button
              onClick={handleCadastrar}
              disabled={cadastrando}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--af-primary)', border: 'none', borderRadius: 10,
                color: '#fff', fontSize: 13, fontWeight: 700, padding: '10px 20px',
                cursor: cadastrando ? 'wait' : 'pointer',
                opacity: cadastrando ? 0.7 : 1, transition: 'opacity .15s',
              }}
            >
              <BookmarkPlus size={15} />
              {cadastrando ? 'Verificando…' : 'Cadastrar empresa'}
            </button>
          )}

          {(cadastroStatus === 'ok' || cadastroStatus === 'exists') && (
            <>
              <CheckCircle2
                size={16}
                color={cadastroStatus === 'ok' ? 'var(--af-success)' : 'var(--af-warning)'}
              />
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: cadastroStatus === 'ok' ? 'var(--af-success)' : 'var(--af-warning)',
              }}>
                {cadastroMsg}
              </span>
              {empresaId && (
                <a
                  href="/empresas"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, color: 'var(--af-primary)', textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={12} /> Ver cadastro
                </a>
              )}
            </>
          )}

          {cadastroStatus === 'error' && (
            <>
              <AlertCircle size={16} color="var(--af-danger)" />
              <span style={{ fontSize: 13, color: 'var(--af-danger)' }}>{cadastroMsg}</span>
              <button
                onClick={() => setCadastroStatus('idle')}
                style={{
                  background: 'none', border: 'none', fontSize: 12,
                  color: 'var(--af-muted)', cursor: 'pointer', padding: 0,
                }}
              >
                Tentar novamente
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
