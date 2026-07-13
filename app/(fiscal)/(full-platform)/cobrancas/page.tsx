'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, Plus, Trash2, X } from 'lucide-react'
import PaginationControls, { getPageItems } from '@/components/ui/PaginationControls'
import type { Cobranca } from '@/lib/types'

type EmpresaItem = { id: string; razao_social: string }

const FILTROS = [
  { label: 'Todas', value: '' },
  { label: 'Pendentes', value: 'pendente' },
  { label: 'Pagas', value: 'pago' },
  { label: 'Atrasadas', value: 'atrasado' },
]

const FORM_VAZIO = {
  empresa_id: '',
  descricao: '',
  valor: '',
  vencimento: '',
  observacao: '',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--af-surface-2)',
  border: '1px solid var(--af-border)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--af-text)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

export default function CobrancasPage() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([])
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')
  const [loading, setLoading] = useState(true)
  const [pagina, setPagina] = useState(1)
  const [linhasPorPagina, setLinhasPorPagina] = useState(50)

  async function carregar(status = filtro) {
    setLoading(true)
    const url = status ? `/api/cobrancas?status=${status}` : '/api/cobrancas'
    const res = await fetch(url)
    const data = await res.json()
    if (Array.isArray(data)) setCobrancas(data)
    setLoading(false)
  }

  useEffect(() => {
    queueMicrotask(() => { void carregar(filtro) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  useEffect(() => {
    fetch('/api/empresas')
      .then(r => r.json())
      .then((d: unknown) => { if (Array.isArray(d)) setEmpresas(d as EmpresaItem[]) })
      .catch(() => null)
  }, [])

  const hoje = new Date().toISOString().split('T')[0]
  const cobrancasExibidas = cobrancas.map(c => ({
    ...c,
    status: c.status === 'pendente' && c.vencimento < hoje ? 'atrasado' as const : c.status,
  }))
  const cobrancasPagina = getPageItems(cobrancasExibidas, pagina, linhasPorPagina)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErroForm('')
    setSalvando(true)
    const res = await fetch('/api/cobrancas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        valor: form.valor ? parseFloat(form.valor) : null,
        empresa_id: form.empresa_id || null,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({} as { error?: string }))
      setErroForm(d.error ?? 'Erro ao salvar')
      setSalvando(false)
      return
    }
    setModal(false)
    setForm(FORM_VAZIO)
    await carregar()
    setSalvando(false)
  }

  async function marcarPago(c: Cobranca) {
    await fetch(`/api/cobrancas?id=${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pago', pago_em: hoje }),
    })
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta cobrança?')) return
    await fetch(`/api/cobrancas?id=${id}`, { method: 'DELETE' })
    await carregar()
  }

  const totais = {
    pendente: cobrancasExibidas.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.valor ?? 0), 0),
    atrasado: cobrancasExibidas.filter(c => c.status === 'atrasado').reduce((s, c) => s + (c.valor ?? 0), 0),
    pago: cobrancasExibidas.filter(c => c.status === 'pago').reduce((s, c) => s + (c.valor ?? 0), 0),
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtData = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

  const statusIcon = (s: string) => {
    if (s === 'pago') return <CheckCircle size={14} style={{ color: '#16a34a' }} />
    if (s === 'atrasado') return <AlertTriangle size={14} style={{ color: '#dc2626' }} />
    return <Clock size={14} style={{ color: '#b45309' }} />
  }

  const statusColor: Record<string, React.CSSProperties> = {
    pago: { background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.28)', color: '#15803d' },
    atrasado: { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)', color: '#b91c1c' },
    pendente: { background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.32)', color: '#92400e' },
  }

  return (
    <div style={{ padding: '32px 40px', color: 'var(--af-text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--af-text)', margin: '0 0 4px' }}>Cobranças</h1>
          <p style={{ fontSize: 13, color: 'var(--af-muted)', margin: 0 }}>Honorários e pagamentos dos clientes</p>
        </div>
        <button
          onClick={() => setModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'linear-gradient(90deg, rgba(39,199,216,0.9), rgba(8,145,178,0.9))',
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={15} /> Nova cobrança
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'A receber', valor: totais.pendente, cor: '#b45309' },
          { label: 'Em atraso', valor: totais.atrasado, cor: '#b91c1c' },
          { label: 'Recebido', valor: totais.pago, cor: '#15803d' },
        ].map(({ label, valor, cor }) => (
          <div key={label} style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, color: 'var(--af-muted)', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{fmt(valor)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {FILTROS.map(f => (
          <button
            key={f.value}
            onClick={() => { setFiltro(f.value); setPagina(1) }}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              background: filtro === f.value ? 'rgba(39,199,216,0.15)' : 'var(--af-surface-2)',
              border: filtro === f.value ? '1px solid rgba(39,199,216,0.4)' : '1px solid var(--af-border)',
              color: filtro === f.value ? 'var(--af-primary)' : 'var(--af-muted)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
        ) : cobrancasExibidas.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--af-muted)', fontSize: 13 }}>Nenhuma cobrança encontrada.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--af-border)', background: 'var(--af-surface-2)' }}>
                {['Cliente', 'Descrição', 'Vencimento', 'Valor', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--af-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cobrancasPagina.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--af-border)' }}>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--af-text)' }}>
                    {c.empresa?.razao_social ?? <span style={{ color: 'var(--af-muted)' }}>-</span>}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--af-text-soft)' }}>{c.descricao}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--af-muted)' }}>{fmtData(c.vencimento)}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: 'var(--af-text)' }}>
                    {c.valor != null ? fmt(c.valor) : <span style={{ color: 'var(--af-muted)' }}>-</span>}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, ...statusColor[c.status] }}>
                      {statusIcon(c.status)}
                      {c.status === 'pago' ? 'Pago' : c.status === 'atrasado' ? 'Atrasado' : 'Pendente'}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {c.status !== 'pago' && (
                        <button
                          onClick={() => { void marcarPago(c) }}
                          title="Marcar como pago"
                          style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, padding: '5px 10px', color: '#15803d', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                        >
                          Recebido
                        </button>
                      )}
                      <button
                        onClick={() => { void excluir(c.id) }}
                        title="Excluir"
                        style={{ background: 'none', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 6, padding: '5px 7px', color: '#b91c1c', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && cobrancasExibidas.length > 0 && (
          <PaginationControls
            total={cobrancasExibidas.length}
            page={pagina}
            pageSize={linhasPorPagina}
            onPageChange={setPagina}
            onPageSizeChange={tamanho => { setLinhasPorPagina(tamanho); setPagina(1) }}
          />
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div style={{ background: 'var(--af-surface)', border: '1px solid var(--af-border)', borderRadius: 16, padding: '32px 36px', width: '100%', maxWidth: 460, boxShadow: '0 24px 70px rgba(15,23,42,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--af-text)', margin: 0 }}>Nova cobrança</h2>
              <button onClick={() => { setModal(false); setForm(FORM_VAZIO); setErroForm('') }} style={{ background: 'none', border: 'none', color: 'var(--af-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={salvar} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--af-muted)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Cliente (opcional)</label>
                <select value={form.empresa_id} onChange={e => setForm(f => ({ ...f, empresa_id: e.target.value }))} style={inputStyle}>
                  <option value="">Sem cliente específico</option>
                  {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.razao_social}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--af-muted)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Descrição *</label>
                <input required value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Honorários competência 05/2026" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--af-muted)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Valor (R$)</label>
                  <input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--af-muted)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Vencimento *</label>
                  <input required type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--af-muted)', fontWeight: 500, display: 'block', marginBottom: 6 }}>Observação</label>
                <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" style={inputStyle} />
              </div>

              {erroForm && (
                <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '9px 12px', color: '#b91c1c', fontSize: 13 }}>{erroForm}</div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setModal(false); setForm(FORM_VAZIO); setErroForm('') }} style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--af-border)', borderRadius: 8, color: 'var(--af-muted)', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} style={{ padding: '10px 24px', background: 'linear-gradient(90deg, rgba(39,199,216,0.9), rgba(8,145,178,0.9))', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer' }}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
