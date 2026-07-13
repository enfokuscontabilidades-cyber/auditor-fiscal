'use client'

import { useEffect, useState } from 'react'
import { Lock, RefreshCw, PlusCircle, PauseCircle, PlayCircle, Pencil, Calculator } from 'lucide-react'
import { PLANOS_REFORMA_TRIBUTARIA, formatarPrecoCentavos } from '@/lib/planos/reformaTributariaPlanos'
import type { AssinaturaRt, PlanoReformaTributariaCodigo } from '@/lib/types'

type AssinaturaAdmin = AssinaturaRt & {
  organizacao: { id: string; nome: string } | null
  cnpj_slots_usados: number
  xmls_usados_ciclo: number
  limite_xml_ciclo: number | null
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativa', manual: 'Ativa (manual)', past_due: 'Pagamento pendente',
  canceled: 'Cancelada', expired: 'Expirada', suspended: 'Suspensa', pending: 'Pendente',
}

export default function AdminReformaTributariaPage() {
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [assinaturas, setAssinaturas] = useState<AssinaturaAdmin[]>([])
  const [carregando, setCarregando] = useState(false)
  const [novoOrgId, setNovoOrgId] = useState('')
  const [novoPlano, setNovoPlano] = useState<PlanoReformaTributariaCodigo>('rt_essencial')
  const [novoPrazo, setNovoPrazo] = useState(1)
  const [correcao, setCorrecao] = useState<{ slotId: string; cnpjNovo: string; justificativa: string } | null>(null)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    fetch('/api/leads-reforma-tributaria/acesso')
      .then(r => r.json())
      .then((d: { permitido?: boolean }) => setPermitido(Boolean(d.permitido)))
      .catch(() => setPermitido(false))
  }, [])

  function carregar() {
    setCarregando(true)
    fetch('/api/admin/rt/assinaturas').then(r => r.json()).then(d => { setAssinaturas(Array.isArray(d) ? d : []); setCarregando(false) }).catch(() => setCarregando(false))
  }

  useEffect(() => { if (permitido) carregar() }, [permitido])

  async function ativarManual(e: React.FormEvent) {
    e.preventDefault()
    setMensagem('')
    const res = await fetch('/api/admin/rt/assinaturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: novoOrgId.trim(), planoCodigo: novoPlano, prazoMeses: novoPrazo }),
    })
    const body = await res.json().catch(() => ({}))
    setMensagem(res.ok ? 'Assinatura ativada.' : (body.error ?? 'Erro ao ativar.'))
    if (res.ok) { setNovoOrgId(''); carregar() }
  }

  async function alterarStatus(id: string, status: string) {
    await fetch(`/api/admin/rt/assinaturas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, justificativa: `Alteração manual para ${status}` }),
    })
    carregar()
  }

  async function reconciliarUso(assinatura: AssinaturaAdmin) {
    const atual = assinatura.xmls_usados_ciclo
    const justificativa = prompt(
      `Uso atual registrado: ${atual}${assinatura.limite_xml_ciclo !== null ? ` de ${assinatura.limite_xml_ciclo}` : ''}.\n\n` +
      'A reconciliação recalcula o uso real a partir dos documentos efetivamente contabilizados no ciclo. ' +
      'Informe a justificativa para este ajuste manual:',
    )
    if (!justificativa?.trim()) return

    const res = await fetch('/api/admin/rt/reconciliar-uso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assinaturaId: assinatura.id, justificativa: justificativa.trim() }),
    })
    const body = await res.json().catch(() => ({}))
    setMensagem(res.ok
      ? `Uso reconciliado: ${body.valorAnterior} → ${body.valorRecalculado}.`
      : (body.error ?? 'Erro ao reconciliar uso.'))
    if (res.ok) carregar()
  }

  async function corrigirCnpj(e: React.FormEvent) {
    e.preventDefault()
    if (!correcao) return
    const res = await fetch('/api/admin/rt/cnpj-correcao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(correcao),
    })
    const body = await res.json().catch(() => ({}))
    setMensagem(res.ok ? 'CNPJ corrigido.' : (body.error ?? 'Erro ao corrigir CNPJ.'))
    if (res.ok) setCorrecao(null)
  }

  if (permitido === null) return <main style={{ padding: 24 }}>Verificando acesso...</main>

  if (!permitido) {
    return (
      <main style={{ padding: 40, textAlign: 'center' }}>
        <Lock size={28} />
        <p style={{ marginTop: 12 }}>Acesso restrito à equipe Enfokus.</p>
      </main>
    )
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Assinaturas — Reforma Tributária</h1>
        <button onClick={carregar} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--af-border)', borderRadius: 8, padding: '8px 14px', background: 'transparent', cursor: 'pointer' }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {mensagem && <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--af-primary)' }}>{mensagem}</div>}

      <section style={{ border: '1px solid var(--af-border)', borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Ativar assinatura manual</h2>
        <form onSubmit={ativarManual} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Org ID</label>
            <input value={novoOrgId} onChange={e => setNovoOrgId(e.target.value)} required style={{ padding: '8px 10px', border: '1px solid var(--af-border)', borderRadius: 6, minWidth: 260 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Plano</label>
            <select value={novoPlano} onChange={e => setNovoPlano(e.target.value as PlanoReformaTributariaCodigo)} style={{ padding: '8px 10px', border: '1px solid var(--af-border)', borderRadius: 6 }}>
              {PLANOS_REFORMA_TRIBUTARIA.map(p => <option key={p.codigo} value={p.codigo}>{p.nome} — {formatarPrecoCentavos(p.precoCentavos)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Prazo (meses)</label>
            <input type="number" min={1} value={novoPrazo} onChange={e => setNovoPrazo(Number(e.target.value))} style={{ padding: '8px 10px', border: '1px solid var(--af-border)', borderRadius: 6, width: 90 }} />
          </div>
          <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--af-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, cursor: 'pointer' }}>
            <PlusCircle size={15} /> Ativar
          </button>
        </form>
      </section>

      {correcao && (
        <section style={{ border: '1px solid rgba(250,204,21,0.4)', borderRadius: 10, padding: 16, marginBottom: 24, background: 'rgba(250,204,21,0.05)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Corrigir CNPJ (slot {correcao.slotId.slice(0, 8)})</h2>
          <form onSubmit={corrigirCnpj} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>CNPJ correto</label>
              <input value={correcao.cnpjNovo} onChange={e => setCorrecao({ ...correcao, cnpjNovo: e.target.value })} required style={{ padding: '8px 10px', border: '1px solid var(--af-border)', borderRadius: 6 }} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Justificativa</label>
              <input value={correcao.justificativa} onChange={e => setCorrecao({ ...correcao, justificativa: e.target.value })} required style={{ padding: '8px 10px', border: '1px solid var(--af-border)', borderRadius: 6, width: '100%' }} />
            </div>
            <button type="submit" style={{ background: 'var(--af-warning, #f59e0b)', color: '#111', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, cursor: 'pointer' }}>Confirmar correção</button>
            <button type="button" onClick={() => setCorrecao(null)} style={{ background: 'transparent', border: '1px solid var(--af-border)', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>Cancelar</button>
          </form>
        </section>
      )}

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--af-border)' }}>
              {['Escritório', 'Plano', 'Status', 'CNPJs', 'XMLs no ciclo', 'Renovação', 'Ações'].map(h => (
                <th key={h} style={{ padding: '8px 10px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assinaturas.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--af-border)' }}>
                <td style={{ padding: '8px 10px' }}>{a.organizacao?.nome ?? a.org_id}</td>
                <td style={{ padding: '8px 10px' }}>{a.plano_codigo}</td>
                <td style={{ padding: '8px 10px' }}>{STATUS_LABEL[a.status] ?? a.status}</td>
                <td style={{ padding: '8px 10px' }}>{a.cnpj_slots_usados}</td>
                <td style={{ padding: '8px 10px', color: a.limite_xml_ciclo !== null && a.xmls_usados_ciclo > a.limite_xml_ciclo ? 'var(--af-danger, #ef4444)' : undefined }}>
                  {a.xmls_usados_ciclo}{a.limite_xml_ciclo !== null ? ` / ${a.limite_xml_ciclo}` : ' (ilimitado)'}
                </td>
                <td style={{ padding: '8px 10px' }}>{a.proxima_renovacao ? new Date(a.proxima_renovacao).toLocaleDateString('pt-BR') : '—'}</td>
                <td style={{ padding: '8px 10px', display: 'flex', gap: 6 }}>
                  {a.status !== 'suspended' ? (
                    <button title="Suspender" onClick={() => alterarStatus(a.id, 'suspended')} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><PauseCircle size={16} /></button>
                  ) : (
                    <button title="Reativar" onClick={() => alterarStatus(a.id, 'active')} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><PlayCircle size={16} /></button>
                  )}
                  <button title="Corrigir CNPJ de uma vaga (requer ID da vaga)" onClick={() => {
                    const slotId = prompt('ID da vaga (rt_cnpj_slots) a corrigir:')
                    if (slotId) setCorrecao({ slotId, cnpjNovo: '', justificativa: '' })
                  }} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><Pencil size={16} /></button>
                  <button title="Reconciliar uso de XMLs do ciclo" onClick={() => reconciliarUso(a)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><Calculator size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
