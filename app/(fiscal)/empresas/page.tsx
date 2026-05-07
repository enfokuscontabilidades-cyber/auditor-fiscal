'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Empresa } from '@/lib/types'
import { Plus, Building2, Pencil, Star, Search } from 'lucide-react'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'

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
}

const FORM_VAZIO: FormState = {
  razao_social: '', nome_fantasia: '', cnpj: '',
  regime: 'Simples Nacional', cnae_principal: '', inscricao_estadual: '', uf: 'GO',
  tipo: 'Autônoma', matriz_id: '',
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
  const { empresaAtiva, definirEmpresaAtiva } = useEmpresaAtiva()

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
    setModal(true)
  }

  function abrirEditar(emp: Empresa) {
    setEditandoId(emp.id)
    setForm({
      razao_social:      emp.razao_social ?? '',
      nome_fantasia:     emp.nome_fantasia ?? '',
      cnpj:              emp.cnpj ?? '',
      regime:            emp.regime ?? 'Simples Nacional',
      cnae_principal:    emp.cnae_principal ?? '',
      inscricao_estadual:emp.inscricao_estadual ?? '',
      uf:                emp.uf ?? 'GO',
      tipo:              emp.tipo ?? 'Autônoma',
      matriz_id:         emp.matriz_id ?? '',
    })
    setModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)

    if (editandoId) {
      await fetch(`/api/empresas/${editandoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (empresaAtiva?.id === editandoId) {
        definirEmpresaAtiva({
          id: editandoId,
          razao_social: form.razao_social,
          cnpj: form.cnpj,
          cnae_principal: form.cnae_principal,
        })
      }
    } else {
      await supabase.from('empresas').insert({
        razao_social:      form.razao_social.trim(),
        nome_fantasia:     form.nome_fantasia || null,
        cnpj:              form.cnpj ? form.cnpj.replace(/\D/g, '') : null,
        regime:            form.regime || null,
        cnae_principal:    form.cnae_principal || null,
        inscricao_estadual:form.inscricao_estadual || null,
        uf:                form.uf || 'GO',
        status:            'Ativo',
      })
    }

    setModal(false)
    setForm(FORM_VAZIO)
    setEditandoId(null)
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

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Empresas</h1>
            {!loading && (
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--af-muted)',
                background: 'var(--af-primary-soft)',
                border: '1px solid var(--af-border)',
                borderRadius: 10,
                padding: '1px 8px',
              }}>
                {empresas.length}
              </span>
            )}
          </div>
          {empresaAtiva && (
            <div style={{ fontSize: 12, color: 'rgba(250,204,21,0.7)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Star size={10} fill="currentColor" />
              Em análise: <strong style={{ color: 'var(--af-warning)' }}>{empresaAtiva.razao_social}</strong>
            </div>
          )}
        </div>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--af-primary)',
            border: 'none',
            borderRadius: 8,
            color: '#050d17',
            fontSize: 13,
            fontWeight: 700,
            padding: '9px 16px',
            cursor: 'pointer',
          }}
          onClick={abrirNovo}
        >
          <Plus size={15} />
          Nova empresa
        </button>
      </div>

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
              maxWidth: 480,
              maxHeight: '90vh',
              overflowY: 'auto' as const,
              boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 22px', color: 'var(--af-text)' }}>
              {editandoId ? 'Editar empresa' : 'Nova empresa'}
            </h2>
            <form onSubmit={salvar}>
              <label style={labelStyle}>Razão social *</label>
              <input style={inputStyle} required value={form.razao_social}
                onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} />

              <label style={labelStyle}>Nome fantasia</label>
              <input style={inputStyle} value={form.nome_fantasia}
                onChange={e => setForm(f => ({ ...f, nome_fantasia: e.target.value }))} />

              <label style={labelStyle}>CNPJ</label>
              <input style={inputStyle} value={form.cnpj}
                onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Regime tributário</label>
                  <select style={{ ...inputStyle }}
                    value={form.regime}
                    onChange={e => setForm(f => ({ ...f, regime: e.target.value }))}>
                    {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select style={{ ...inputStyle }}
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value, matriz_id: e.target.value !== 'Filial' ? '' : f.matriz_id }))}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {form.tipo === 'Filial' && matrizes.length > 0 && (
                <>
                  <label style={labelStyle}>Empresa matriz</label>
                  <select style={{ ...inputStyle }}
                    value={form.matriz_id}
                    onChange={e => setForm(f => ({ ...f, matriz_id: e.target.value }))}>
                    <option value="">— Selecionar matriz —</option>
                    {matrizes.filter(m => m.id !== editandoId).map(m => (
                      <option key={m.id} value={m.id}>{m.razao_social}</option>
                    ))}
                  </select>
                </>
              )}

              <label style={labelStyle}>CNAE principal</label>
              <input style={inputStyle} placeholder="Ex: 4711-3/02" value={form.cnae_principal}
                onChange={e => setForm(f => ({ ...f, cnae_principal: e.target.value }))} />

              <label style={labelStyle}>Inscrição estadual</label>
              <input style={inputStyle} value={form.inscricao_estadual}
                onChange={e => setForm(f => ({ ...f, inscricao_estadual: e.target.value }))} />

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid rgba(200,220,240,0.18)',
                    borderRadius: 8,
                    color: 'var(--af-muted)',
                    fontSize: 13,
                    padding: '10px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    background: 'var(--af-primary)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#050d17',
                    fontSize: 13,
                    fontWeight: 700,
                    padding: '10px',
                    cursor: salvando ? 'not-allowed' : 'pointer',
                    opacity: salvando ? 0.7 : 1,
                  }}
                  disabled={salvando}
                >
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
