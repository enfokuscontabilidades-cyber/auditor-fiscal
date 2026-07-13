'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Convite = {
  id: string
  org_id: string
  papel: string
  organizacao: { nome: string } | null
}

export default function NovoEscritorioPage() {
  const router = useRouter()
  const [convite, setConvite] = useState<Convite | null | undefined>(undefined) // undefined = carregando
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [produto, setProduto] = useState<string | null>(null)
  const [plano, setPlano] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/convites')
      .then(r => r.json())
      .then((d: unknown) => setConvite((d as Convite) ?? null))
      .catch(() => setConvite(null))

    const params = new URLSearchParams(window.location.search)
    setProduto(params.get('produto'))
    setPlano(params.get('plano'))
  }, [])

  const destinoAposCriar = produto === 'reforma_tributaria'
    ? `/aguardando-ativacao?produto=reforma_tributaria&plano=${plano ?? ''}`
    : '/'

  async function aceitarConvite() {
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch('/api/convites', { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErro(d.error ?? 'Erro ao aceitar convite')
        return
      }
      router.push('/')
    } catch {
      setErro('Erro inesperado. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  async function criarEscritorio(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch('/api/organizacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          ...(produto === 'reforma_tributaria' ? { produtoEscopo: 'tax_reform_only', planoCodigo: plano } : {}),
        }),
      })
      if (!res.ok) {
        if (res.status === 409) { router.push('/'); return }
        let msg = 'Erro ao criar escritório'
        try { const d = await res.json(); msg = d.error ?? msg } catch {}
        setErro(msg)
        return
      }
      router.push(destinoAposCriar)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0a0f1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: 'system-ui, sans-serif',
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.95)',
    border: '1px solid rgba(39,199,216,0.2)',
    borderRadius: 16,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  }

  if (convite === undefined) {
    return (
      <div style={containerStyle}>
        <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 14 }}>Carregando...</div>
      </div>
    )
  }

  // Usuário tem convite pendente — mostrar tela de aceite
  if (convite) {
    const nomeOrg = convite.organizacao?.nome ?? 'escritório'
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(39,199,216,0.2), rgba(8,145,178,0.1))',
              border: '1px solid rgba(39,199,216,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 24,
            }}>✉️</div>
            <h1 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: '0 0 10px' }}>
              Você foi convidado
            </h1>
            <p style={{ color: 'rgba(148,163,184,0.75)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Você tem um convite para entrar no escritório
            </p>
          </div>

          <div style={{
            background: 'rgba(39,199,216,0.08)',
            border: '1px solid rgba(39,199,216,0.2)',
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 28,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{nomeOrg}</div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', marginTop: 4, textTransform: 'capitalize' }}>
              Perfil: {convite.papel}
            </div>
          </div>

          {erro && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16,
            }}>{erro}</div>
          )}

          <button
            onClick={aceitarConvite}
            disabled={carregando}
            style={{
              width: '100%', padding: '12px 0',
              background: carregando ? 'rgba(39,199,216,0.3)' : 'linear-gradient(90deg, rgba(39,199,216,0.9), rgba(8,145,178,0.9))',
              border: 'none', borderRadius: 8, color: '#fff',
              fontSize: 14, fontWeight: 600,
              cursor: carregando ? 'not-allowed' : 'pointer',
            }}
          >
            {carregando ? 'Entrando...' : `Entrar no ${nomeOrg}`}
          </button>
        </div>
      </div>
    )
  }

  // Sem convite — criar novo escritório
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(39,199,216,0.2), rgba(8,145,178,0.1))',
            border: '1px solid rgba(39,199,216,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 24,
          }}>🏢</div>
          <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0 }}>
            Bem-vindo ao sistema
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
            Para começar, crie o escritório contábil.<br />
            Outros usuários poderão ser adicionados depois.
          </p>
        </div>

        <form onSubmit={criarEscritorio}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: 'rgba(203,213,225,0.8)', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              Nome do escritório
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Enfokus Contabilidade"
              autoFocus
              required
              style={{
                width: '100%', background: 'rgba(30,41,59,0.8)',
                border: '1px solid rgba(71,85,105,0.6)', borderRadius: 8,
                padding: '11px 14px', color: '#f1f5f9', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {erro && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 20,
            }}>{erro}</div>
          )}

          <button
            type="submit"
            disabled={carregando || !nome.trim()}
            style={{
              width: '100%', padding: '12px 0',
              background: carregando || !nome.trim() ? 'rgba(39,199,216,0.3)' : 'linear-gradient(90deg, rgba(39,199,216,0.9), rgba(8,145,178,0.9))',
              border: 'none', borderRadius: 8, color: '#fff',
              fontSize: 14, fontWeight: 600,
              cursor: carregando || !nome.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {carregando ? 'Criando...' : 'Criar escritório e entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
