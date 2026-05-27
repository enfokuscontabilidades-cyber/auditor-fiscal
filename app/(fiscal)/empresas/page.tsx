'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Empresa } from '@/lib/types'
import { Plus, Building2, Pencil, Star, Search, RefreshCw, AlertCircle, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import PageHeader from '@/components/ui/PageHeader'

type Socio = {
  nome: string
  tipo: string
  data_entrada?: string
  faixa_etaria?: string
  cpf_cnpj_socio?: string
  qualificacao_socio?: { descricao: string }
}

type QsaData = { socios: Socio[]; capitalSocial: string }

function formatDataQsa(d?: string | null): string {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function formatMoedaQsa(valor?: string): string {
  if (!valor) return '—'
  const n = parseFloat(valor)
  if (isNaN(n)) return valor
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'CPF']
const TIPOS   = ['Autônoma', 'Matriz', 'Filial']

const COR_REGIME: Record<string, string> = {
  'Simples Nacional': 'var(--af-success)',
  'Lucro Presumido':  'var(--af-warning)',
  'Lucro Real':       'var(--af-warning)',
  'MEI':              '#60a5fa',
  'CPF':              '#c084fc',
}

type FormState = {
  razao_social: string; nome_fantasia: string; cnpj: string
  regime: string; cnae_principal: string; inscricao_estadual: string; uf: string
  tipo: string; matriz_id: string
  situacao_cadastral: string
  logradouro: string; numero: string; complemento: string
  bairro: string; cep: string; municipio: string
  telefone: string; email: string
}

const FORM_VAZIO: FormState = {
  razao_social: '', nome_fantasia: '', cnpj: '',
  regime: 'Simples Nacional', cnae_principal: '', inscricao_estadual: '', uf: 'GO',
  tipo: 'Autônoma', matriz_id: '',
  situacao_cadastral: '',
  logradouro: '', numero: '', complemento: '',
  bairro: '', cep: '', municipio: '',
  telefone: '', email: '',
}

export default function EmpresasPage() {
  const supabase = createClient()
  const [empresas, setEmpresas]     = useState<Empresa[]>([])
  const [loading, setLoading]       = useState(true)
  const [busca, setBusca]           = useState('')
  const [modal, setModal]           = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm]             = useState<FormState>(FORM_VAZIO)
  const [salvando, setSalvando]     = useState(false)
  const [consultandoCnpj, setConsultandoCnpj] = useState(false)
  const [erroCnpj, setErroCnpj]     = useState<string | null>(null)
  const [erroSalvar, setErroSalvar]  = useState<string | null>(null)
  const [qsaData, setQsaData]        = useState<QsaData | null>(null)
  const [mostrarQsa, setMostrarQsa]  = useState(false)
  const [carregandoQsa, setCarregandoQsa] = useState(false)
  const { empresaAtiva, definirEmpresaAtiva } = useEmpresaAtiva()

  async function fetchQsa(cnpj: string) {
    const cnpjLimpo = cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) return
    setCarregandoQsa(true)
    try {
      const res  = await fetch(`/api/cnpj/${cnpjLimpo}`)
      const json = await res.json()
      if (res.ok && ((json.socios?.length ?? 0) > 0 || json.capital_social)) {
        setQsaData({ socios: json.socios ?? [], capitalSocial: json.capital_social ?? '' })
      }
    } catch {
      // falha silenciosa — QSA simplesmente não aparece
    } finally {
      setCarregandoQsa(false)
    }
  }

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('empresas')
      .select('*')
      .eq('status', 'Ativo')
      .order('razao_social', { ascending: true })
    setEmpresas((data as Empresa[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setErroCnpj(null)
    setErroSalvar(null)
    setQsaData(null)
    setMostrarQsa(false)
    setModal(true)
  }

  function abrirEditar(emp: Empresa) {
    setErroCnpj(null)
    setErroSalvar(null)
    setQsaData(null)
    setMostrarQsa(false)
    setEditandoId(emp.id)
    setForm({
      razao_social:       emp.razao_social ?? '',
      nome_fantasia:      emp.nome_fantasia ?? '',
      cnpj:               emp.cnpj ?? '',
      regime:             emp.regime ?? 'Simples Nacional',
      cnae_principal:     emp.cnae_principal ?? '',
      inscricao_estadual: emp.inscricao_estadual ?? '',
      uf:                 emp.uf ?? 'GO',
      tipo:               emp.tipo ?? 'Autônoma',
      matriz_id:          emp.matriz_id ?? '',
      situacao_cadastral: emp.situacao_cadastral ?? '',
      logradouro:         emp.logradouro ?? '',
      numero:             emp.numero ?? '',
      complemento:        emp.complemento ?? '',
      bairro:             emp.bairro ?? '',
      cep:                emp.cep ?? '',
      municipio:          emp.municipio ?? '',
      telefone:           emp.telefone ?? '',
      email:              emp.email ?? '',
    })
    setModal(true)
    if (emp.cnpj) fetchQsa(emp.cnpj)
  }

  async function consultarCnpj() {
    const cnpjLimpo = form.cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) {
      setErroCnpj('Digite um CNPJ válido com 14 dígitos antes de consultar.')
      return
    }
    setConsultandoCnpj(true)
    setErroCnpj(null)
    setQsaData(null)
    setMostrarQsa(false)
    try {
      const res = await fetch(`/api/cnpj/${cnpjLimpo}`)
      const json = await res.json()
      if (!res.ok) {
        setErroCnpj(json.error ?? 'Erro ao consultar CNPJ.')
        return
      }
      if ((json.socios?.length ?? 0) > 0 || json.capital_social) {
        setQsaData({ socios: json.socios ?? [], capitalSocial: json.capital_social ?? '' })
      }
      const est = json.estabelecimento ?? {}
      const ie = (est.inscricoes_estaduais ?? []).find((i: { ativo: boolean }) => i.ativo)?.inscricao_estadual ?? ''
      const tipo = est.tipo === 'Filial' ? 'Filial' : est.tipo === 'Matriz' ? 'Matriz' : 'Autônoma'
      let regime = 'Lucro Presumido'
      if (json.simples?.mei === 'Sim') regime = 'MEI'
      else if (json.simples?.simples === 'Sim') regime = 'Simples Nacional'
      const telefone = est.ddd1 && est.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : ''
      const logradouro = [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' ')
      setForm(f => ({
        ...f,
        razao_social:       json.razao_social ?? f.razao_social,
        nome_fantasia:      est.nome_fantasia ?? f.nome_fantasia,
        cnpj:               est.cnpj ?? f.cnpj,
        regime,
        cnae_principal:     est.atividade_principal?.id ?? f.cnae_principal,
        inscricao_estadual: ie || f.inscricao_estadual,
        uf:                 est.estado?.sigla ?? f.uf,
        tipo,
        situacao_cadastral: est.situacao_cadastral ?? f.situacao_cadastral,
        logradouro:         logradouro || f.logradouro,
        numero:             est.numero ?? f.numero,
        complemento:        est.complemento ?? f.complemento,
        bairro:             est.bairro ?? f.bairro,
        cep:                est.cep ?? f.cep,
        municipio:          est.cidade?.nome ?? f.municipio,
        telefone:           telefone || f.telefone,
        email:              est.email ?? f.email,
      }))
    } catch {
      setErroCnpj('Falha na conexão com a Receita Federal.')
    } finally {
      setConsultandoCnpj(false)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErroSalvar(null)

    if (editandoId) {
      const res = await fetch(`/api/empresas/${editandoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setErroSalvar(json.error ?? `Erro ao salvar (${res.status}). Verifique se a migração do banco foi aplicada.`)
        setSalvando(false)
        return
      }
      if (empresaAtiva?.id === editandoId) {
        definirEmpresaAtiva({
          id: editandoId,
          razao_social: form.razao_social,
          cnpj: form.cnpj,
          cnae_principal: form.cnae_principal,
        })
      }
    } else {
      const res = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setErroSalvar(json.error ?? `Erro ao salvar (${res.status})`)
        setSalvando(false)
        return
      }
    }

    setModal(false)
    setForm(FORM_VAZIO)
    setEditandoId(null)
    setErroSalvar(null)
    carregar()
    setSalvando(false)
  }

  const filtradas = empresas.filter(e =>
    e.razao_social.toLowerCase().includes(busca.toLowerCase()) ||
    (e.cnpj ?? '').includes(busca)
  )

  const matrizes = empresas.filter(e => e.tipo === 'Matriz' || !e.tipo)

  /* ─── Estilos ─── */

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--af-surface)',
    border: '1px solid var(--af-border)',
    borderRadius: 7,
    color: 'var(--af-text)',
    fontSize: 13,
    padding: '8px 11px',
    outline: 'none',
    marginBottom: 12,
    boxSizing: 'border-box' as const,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: 'var(--af-muted)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  }

  function chipRegime(regime?: string): React.CSSProperties {
    const cor = COR_REGIME[regime ?? ''] ?? 'var(--af-muted)'
    return {
      display: 'inline-block',
      background: `${cor}1a`,
      color: cor,
      border: `1px solid ${cor}40`,
      borderRadius: 5,
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 7px',
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap' as const,
    }
  }

  function chipTipo(tipo?: string): React.CSSProperties {
    const isMatriz = tipo === 'Matriz'
    const isFilial = tipo === 'Filial'
    return {
      display: 'inline-block',
      background: isMatriz ? 'var(--af-primary-soft)' : isFilial ? 'rgba(251,191,36,0.1)' : 'rgba(148,163,184,0.1)',
      color: isMatriz ? 'var(--af-primary)' : isFilial ? 'var(--af-warning)' : 'var(--af-muted)',
      border: `1px solid ${isMatriz ? 'rgba(39,199,216,0.28)' : isFilial ? 'rgba(251,191,36,0.28)' : 'rgba(148,163,184,0.2)'}`,
      borderRadius: 5,
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 7px',
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap' as const,
    }
  }

  return (
    <div style={{
      padding: '36px 40px 64px',
      fontFamily: 'var(--font-geist-sans)',
      color: 'var(--af-text)',
      maxWidth: 1100,
    }}>

      <PageHeader
        title="Empresas"
        subtitle={empresaAtiva ? `Em análise: ${empresaAtiva.razao_social}` : 'Cadastro e gerenciamento das empresas clientes.'}
        actions={
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--af-primary)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, padding: '9px 16px', cursor: 'pointer' }}
            onClick={abrirNovo}
          >
            <Plus size={15} />
            Nova empresa
          </button>
        }
      />

      {/* Busca */}
      <div style={{
        position: 'relative' as const,
        maxWidth: 360,
        marginBottom: 22,
      }}>
        <Search
          size={14}
          color="var(--af-muted)"
          style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        />
        <input
          style={{
            width: '100%',
            background: 'var(--af-surface)',
            border: '1px solid var(--af-border)',
            borderRadius: 8,
            color: 'var(--af-text)',
            fontSize: 13,
            padding: '9px 12px 9px 32px',
            outline: 'none',
            boxSizing: 'border-box' as const,
          }}
          placeholder="Buscar por nome ou CNPJ..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Loading */}
      {loading && <div style={{ color: 'var(--af-muted)', fontSize: 13, padding: '12px 0' }}>Carregando...</div>}

      {/* Estado vazio */}
      {!loading && filtradas.length === 0 && (
        <div style={{
          background: 'var(--af-primary-soft)',
          border: '1px dashed rgba(39,199,216,0.16)',
          borderRadius: 10,
          padding: '40px 32px',
          textAlign: 'center',
          color: 'var(--af-muted)',
          fontSize: 13,
        }}>
          {busca ? 'Nenhuma empresa encontrada para a busca.' : 'Nenhuma empresa cadastrada ainda.'}
        </div>
      )}

      {/* Cards de empresas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {filtradas.map(emp => {
          const isAtiva = empresaAtiva?.id === emp.id
          return (
            <div
              key={emp.id}
              style={{
                background: isAtiva ? 'rgba(250,204,21,0.04)' : 'var(--af-surface)',
                border: isAtiva ? '1px solid rgba(250,204,21,0.32)' : '1px solid var(--af-primary-soft)',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              {/* Ícone */}
              <div style={{
                width: 38,
                height: 38,
                background: isAtiva ? 'rgba(250,204,21,0.1)' : 'var(--af-primary-soft)',
                border: isAtiva ? '1px solid rgba(250,204,21,0.25)' : '1px solid var(--af-border)',
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Building2 size={16} color={isAtiva ? 'var(--af-warning)' : 'var(--af-primary)'} />
              </div>

              {/* Info principal */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--af-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {emp.razao_social}
                  </span>
                  {emp.tipo && emp.tipo !== 'Autônoma' && (
                    <span style={chipTipo(emp.tipo)}>{emp.tipo}</span>
                  )}
                  {isAtiva && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--af-warning)',
                      background: 'rgba(250,204,21,0.12)',
                      border: '1px solid rgba(250,204,21,0.3)',
                      borderRadius: 20,
                      padding: '1px 7px',
                    }}>
                      <Star size={9} fill="currentColor" />
                      ativa
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                  {emp.nome_fantasia && (
                    <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>{emp.nome_fantasia}</span>
                  )}
                  {emp.cnpj && (
                    <span style={{ fontSize: 11, color: 'var(--af-muted)', fontFamily: 'var(--font-geist-mono)' }}>
                      {emp.cnpj}
                    </span>
                  )}
                  {emp.cnae_principal && (
                    <span style={{ fontSize: 11, color: 'var(--af-muted)' }}>CNAE {emp.cnae_principal}</span>
                  )}
                </div>
              </div>

              {/* Regime + Ações */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {emp.regime && (
                  <span style={chipRegime(emp.regime)}>{emp.regime}</span>
                )}
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isAtiva ? 'rgba(250,204,21,0.18)' : 'rgba(250,204,21,0.07)',
                    border: isAtiva ? '1px solid rgba(250,204,21,0.45)' : '1px solid rgba(250,204,21,0.2)',
                    borderRadius: 7,
                    padding: '6px 9px',
                    color: isAtiva ? 'var(--af-warning)' : 'rgba(250,204,21,0.6)',
                    cursor: 'pointer',
                  }}
                  onClick={() => definirEmpresaAtiva({ id: emp.id, razao_social: emp.razao_social, cnpj: emp.cnpj, cnae_principal: emp.cnae_principal })}
                  title={isAtiva ? 'Empresa em análise' : 'Definir como empresa em análise'}
                >
                  <Star size={13} fill={isAtiva ? 'currentColor' : 'none'} />
                </button>
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--af-primary-soft)',
                    border: '1px solid var(--af-border)',
                    borderRadius: 7,
                    padding: '6px 9px',
                    color: 'var(--af-muted)',
                    cursor: 'pointer',
                  }}
                  onClick={() => abrirEditar(emp)}
                  title="Editar empresa"
                >
                  <Pencil size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Modal */}
      {modal && (
        <div
          style={{
            position: 'fixed' as const,
            inset: 0,
            background: 'rgba(15,23,42,.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setModal(false)}
        >
          <div
            style={{
              background: 'var(--af-surface)',
              border: '1px solid var(--af-border)',
              borderRadius: 14,
              padding: '32px 28px',
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              overflowY: 'auto' as const,
              boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 20px', color: 'var(--af-text)' }}>
              {editandoId ? 'Editar empresa' : 'Nova empresa'}
            </h2>
            <form onSubmit={salvar}>

              {/* CNPJ + consulta */}
              <label style={labelStyle}>CNPJ</label>
              <div style={{ display: 'flex', gap: 7, marginBottom: 4 }}>
                <input
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                  value={form.cnpj}
                  onChange={e => { setForm(f => ({ ...f, cnpj: e.target.value })); setErroCnpj(null) }}
                  placeholder="00.000.000/0000-00"
                />
                <button
                  type="button"
                  onClick={consultarCnpj}
                  disabled={consultandoCnpj}
                  title={editandoId ? 'Atualizar dados da Receita Federal' : 'Consultar CNPJ'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'var(--af-primary-soft)', border: '1px solid rgba(39,199,216,0.35)',
                    borderRadius: 7, color: 'var(--af-primary)', fontSize: 12, fontWeight: 700,
                    padding: '0 12px', cursor: consultandoCnpj ? 'not-allowed' : 'pointer',
                    opacity: consultandoCnpj ? 0.7 : 1, whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {consultandoCnpj
                    ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : editandoId ? <RefreshCw size={13} /> : <Search size={13} />}
                  {consultandoCnpj ? 'Consultando...' : editandoId ? 'Atualizar dados' : 'Consultar CNPJ'}
                </button>
              </div>
              {erroCnpj && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                  padding: '7px 10px', background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.22)', borderRadius: 7,
                  color: 'var(--af-danger)', fontSize: 12,
                }}>
                  <AlertCircle size={12} />{erroCnpj}
                </div>
              )}

              {/* Situação cadastral badge (preenchida via API) */}
              {form.situacao_cadastral && (
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Situação:</span>
                  <span style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, letterSpacing: '0.06em',
                    background: form.situacao_cadastral === 'Ativa' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                    color: form.situacao_cadastral === 'Ativa' ? 'var(--af-success)' : 'var(--af-danger)',
                    border: `1px solid ${form.situacao_cadastral === 'Ativa' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
                  }}>
                    {form.situacao_cadastral}
                  </span>
                </div>
              )}

              {/* Identificação */}
              <label style={labelStyle}>Razão social *</label>
              <input style={inputStyle} required value={form.razao_social}
                onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} />

              <label style={labelStyle}>Nome fantasia</label>
              <input style={inputStyle} value={form.nome_fantasia}
                onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} />

              {/* Fiscal */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Regime tributário</label>
                  <select style={{ ...inputStyle }} value={form.regime}
                    onChange={e => setForm(f => ({ ...f, regime: e.target.value }))}>
                    {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select style={{ ...inputStyle }} value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value, matriz_id: e.target.value !== 'Filial' ? '' : f.matriz_id }))}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {form.tipo === 'Filial' && matrizes.length > 0 && (
                <>
                  <label style={labelStyle}>Empresa matriz</label>
                  <select style={{ ...inputStyle }} value={form.matriz_id}
                    onChange={e => setForm(f => ({ ...f, matriz_id: e.target.value }))}>
                    <option value="">— Selecionar matriz —</option>
                    {matrizes.filter(m => m.id !== editandoId).map(m => (
                      <option key={m.id} value={m.id}>{m.razao_social}</option>
                    ))}
                  </select>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 12 }}>
                <div>
                  <label style={labelStyle}>CNAE principal</label>
                  <input style={inputStyle} placeholder="Ex: 47.11-3/02" value={form.cnae_principal}
                    onChange={e => setForm(f => ({ ...f, cnae_principal: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>UF</label>
                  <input style={inputStyle} placeholder="GO" maxLength={2} value={form.uf}
                    onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} />
                </div>
              </div>

              <label style={labelStyle}>Inscrição estadual</label>
              <input style={inputStyle} value={form.inscricao_estadual}
                onChange={e => setForm(f => ({ ...f, inscricao_estadual: e.target.value }))} />

              {/* ── Endereço ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 12px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--af-border)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Endereço</span>
                <div style={{ flex: 1, height: 1, background: 'var(--af-border)' }} />
              </div>

              <label style={labelStyle}>Logradouro</label>
              <input style={inputStyle} placeholder="Ex: Rua das Flores" value={form.logradouro}
                onChange={e => setForm(f => ({ ...f, logradouro: e.target.value }))} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Número</label>
                  <input style={inputStyle} value={form.numero}
                    onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>CEP</label>
                  <input style={inputStyle} placeholder="00000-000" value={form.cep}
                    onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Município</label>
                  <input style={inputStyle} value={form.municipio}
                    onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Complemento</label>
                  <input style={inputStyle} placeholder="Sala, apto..." value={form.complemento}
                    onChange={e => setForm(f => ({ ...f, complemento: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Bairro</label>
                  <input style={inputStyle} value={form.bairro}
                    onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
                </div>
              </div>

              {/* ── Contato ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 12px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--af-border)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Contato</span>
                <div style={{ flex: 1, height: 1, background: 'var(--af-border)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Telefone</label>
                  <input style={inputStyle} placeholder="(62) 99999-0000" value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>E-mail</label>
                  <input style={inputStyle} type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>

              {/* ── QSA ── */}
              {carregandoQsa && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 0', color: 'var(--af-muted)', fontSize: 12 }}>
                  <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  Buscando quadro societário...
                </div>
              )}
              {qsaData && (
                <div style={{ marginTop: 4, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 10px' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--af-border)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--af-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Quadro Societário</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--af-border)' }} />
                  </div>

                  {/* Capital social */}
                  {qsaData.capitalSocial && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 11px', marginBottom: 8,
                      background: 'rgba(148,163,184,0.05)', border: '1px solid var(--af-border)', borderRadius: 8,
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--af-muted)', fontWeight: 600 }}>Capital Social</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--af-text)', fontFamily: 'var(--font-geist-mono)' }}>
                        {formatMoedaQsa(qsaData.capitalSocial)}
                      </span>
                    </div>
                  )}

                  {/* Toggle sócios */}
                  {qsaData.socios.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMostrarQsa(v => !v)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                          background: mostrarQsa ? 'var(--af-primary-soft)' : 'rgba(148,163,184,0.06)',
                          border: `1px solid ${mostrarQsa ? 'rgba(39,199,216,0.3)' : 'var(--af-border)'}`,
                          borderRadius: 8, padding: '8px 11px', cursor: 'pointer',
                          color: mostrarQsa ? 'var(--af-primary)' : 'var(--af-muted)',
                          fontSize: 12, fontWeight: 700, marginBottom: mostrarQsa ? 8 : 0,
                        }}
                      >
                        <Users size={13} />
                        Sócios
                        <span style={{
                          fontSize: 10, fontWeight: 800,
                          background: mostrarQsa ? 'rgba(39,199,216,0.2)' : 'rgba(148,163,184,0.15)',
                          padding: '1px 6px', borderRadius: 10,
                        }}>
                          {qsaData.socios.length}
                        </span>
                        <span style={{ marginLeft: 'auto' }}>
                          {mostrarQsa ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </span>
                      </button>

                      {mostrarQsa && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {qsaData.socios.map((s, i) => (
                            <div key={i} style={{
                              padding: '9px 11px',
                              background: 'rgba(148,163,184,0.04)',
                              border: '1px solid var(--af-border)',
                              borderRadius: 8,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--af-text)', marginBottom: 2 }}>
                                    {s.nome}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                                    {s.qualificacao_socio?.descricao ?? s.tipo}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  {s.data_entrada && (
                                    <div style={{ fontSize: 11, color: 'var(--af-muted)' }}>
                                      desde {formatDataQsa(s.data_entrada)}
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
                                  {s.cpf_cnpj_socio}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {erroSalvar && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 10,
                  padding: '9px 12px', background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
                  color: 'var(--af-danger)', fontSize: 12, lineHeight: 1.5,
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  {erroSalvar}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" style={{
                  flex: 1, background: 'transparent', border: '1px solid rgba(200,220,240,0.18)',
                  borderRadius: 8, color: 'var(--af-muted)', fontSize: 13, padding: '10px', cursor: 'pointer',
                }} onClick={() => setModal(false)}>
                  Cancelar
                </button>
                <button type="submit" style={{
                  flex: 2, background: 'var(--af-primary)', border: 'none', borderRadius: 8,
                  color: '#050d17', fontSize: 13, fontWeight: 700, padding: '10px',
                  cursor: salvando ? 'not-allowed' : 'pointer', opacity: salvando ? 0.7 : 1,
                }} disabled={salvando}>
                  {salvando ? 'Salvando...' : editandoId ? 'Atualizar empresa' : 'Salvar empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
