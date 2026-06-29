'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Bell, BellRing, Users, UserPlus, Trash2, Crown, Building2, Volume2, VolumeX } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { useNotifications } from '@/components/notifications/NotificationProvider'

type Membro = {
  id: string
  user_id: string
  papel: 'admin' | 'membro'
  email: string | null
  created_at: string
}

type Org = {
  id: string
  nome: string
  plano: string
}

export default function ConfiguracoesPage() {
  const { preferences, updatePreferences, addNotification } = useNotifications()
  const [org, setOrg] = useState<Org | null>(null)
  const [membros, setMembros] = useState<Membro[]>([])
  const [novoEmail, setNovoEmail] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    fetch('/api/organizacoes').then(r => r.json()).then(d => setOrg(d))
    fetch('/api/membros').then(r => r.json()).then(d => { if (Array.isArray(d)) setMembros(d) })
  }, [])

  async function adicionarMembro(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setCarregando(true)

    try {
      const res = await fetch('/api/membros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: novoEmail }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.error ?? 'Erro ao adicionar'); return }

      setMembros(prev => [...prev, d])
      setNovoEmail('')
      setSucesso(`${d.email} adicionado com sucesso!`)
      setTimeout(() => setSucesso(''), 4000)
    } catch {
      setErro('Erro inesperado.')
    } finally {
      setCarregando(false)
    }
  }

  async function removerMembro(id: string) {
    if (!confirm('Remover este membro da organização?')) return

    const res = await fetch(`/api/membros?id=${id}`, { method: 'DELETE' })
    if (res.ok) setMembros(prev => prev.filter(m => m.id !== id))
    else {
      const d = await res.json()
      setErro(d.error ?? 'Erro ao remover')
    }
  }

  const labelPlano: Record<string, string> = {
    founder_access: 'Founder Access',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }

  function testarNotificacao() {
    addNotification({
      title: 'Aviso de teste',
      message: 'As notificacoes estao funcionando com suas preferencias atuais.',
      status: 'success',
    })
  }

  const toggleStyle = (ativo: boolean): CSSProperties => ({
    width: 44,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${ativo ? 'rgba(39,199,216,0.45)' : 'rgba(71,85,105,0.7)'}`,
    background: ativo ? 'rgba(39,199,216,0.22)' : 'rgba(30,41,59,0.85)',
    padding: 2,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: ativo ? 'flex-end' : 'flex-start',
    alignItems: 'center',
  })

  const toggleKnob: CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#f8fafc',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  }

  function renderPreferenceRow({
    title,
    description,
    icon,
    checked,
    onChange,
  }: {
    title: string
    description: string
    icon: ReactNode
    checked: boolean
    onChange: () => void
  }) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 0',
        borderTop: '1px solid rgba(51,65,85,0.45)',
      }}>
        <div style={{ color: checked ? 'rgba(39,199,216,0.95)' : 'rgba(148,163,184,0.7)', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.72)', marginTop: 3, lineHeight: 1.4 }}>{description}</div>
        </div>
        <button type="button" onClick={onChange} style={toggleStyle(checked)} aria-pressed={checked}>
          <span style={toggleKnob} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 720, margin: '0 auto', color: 'var(--af-text)' }}>
      <PageHeader
        title="Configurações"
        subtitle="Gerencie o escritório, membros, plano e preferências do sistema."
      />
      <p style={{ fontSize: 13, color: 'var(--af-muted)', margin: '0 0 36px' }}>
        Gerencie o escritório e os usuários com acesso ao sistema.
      </p>

      <section style={{
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid rgba(51,65,85,0.6)',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BellRing size={18} style={{ color: 'rgba(39,199,216,0.8)' }} />
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#f1f5f9' }}>Notificacoes</h2>
          </div>
          <button
            type="button"
            onClick={testarNotificacao}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 13px',
              background: 'rgba(39,199,216,0.12)',
              border: '1px solid rgba(39,199,216,0.28)',
              borderRadius: 8,
              color: 'rgba(39,199,216,0.95)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Bell size={13} />
            Testar
          </button>
        </div>

        {renderPreferenceRow({
          title: "Mostrar aviso sobre a tela",
          description: "Exibe um card temporario quando uma tarefa inicia, termina ou falha.",
          icon: <BellRing size={17} />,
          checked: preferences.toastEnabled,
          onChange: () => updatePreferences({ toastEnabled: !preferences.toastEnabled }),
        })}
        {renderPreferenceRow({
          title: "Avisar quando a tarefa iniciar",
          description: "Mostra a mensagem de que voce pode navegar por outras paginas enquanto a tarefa roda.",
          icon: <Bell size={17} />,
          checked: preferences.runningToastEnabled,
          onChange: () => updatePreferences({ runningToastEnabled: !preferences.runningToastEnabled }),
        })}
        {renderPreferenceRow({
          title: "Som ao finalizar",
          description: "Toca um som curto quando uma tarefa termina com sucesso ou erro.",
          icon: preferences.soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />,
          checked: preferences.soundEnabled,
          onChange: () => updatePreferences({ soundEnabled: !preferences.soundEnabled }),
        })}
      </section>

      {/* Organização */}
      <section style={{
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid rgba(51,65,85,0.6)',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Building2 size={18} style={{ color: 'rgba(39,199,216,0.8)' }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#f1f5f9' }}>Escritório</h2>
        </div>

        {org ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginTop: 4 }}>{org.nome}</div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plano</span>
              <div style={{ marginTop: 4 }}>
                <span style={{
                  display: 'inline-block',
                  background: 'rgba(39,199,216,0.15)',
                  border: '1px solid rgba(39,199,216,0.3)',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'rgba(39,199,216,0.9)',
                }}>
                  {labelPlano[org.plano] ?? org.plano}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 13 }}>Carregando...</div>
        )}
      </section>

      {/* Membros */}
      <section style={{
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid rgba(51,65,85,0.6)',
        borderRadius: 12,
        padding: '24px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Users size={18} style={{ color: 'rgba(39,199,216,0.8)' }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#f1f5f9' }}>
            Usuários ({membros.length})
          </h2>
        </div>

        {/* Adicionar membro */}
        <form onSubmit={adicionarMembro} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input
            type="email"
            value={novoEmail}
            onChange={e => setNovoEmail(e.target.value)}
            placeholder="E-mail do novo usuário"
            required
            style={{
              flex: 1,
              background: 'rgba(30,41,59,0.8)',
              border: '1px solid rgba(71,85,105,0.6)',
              borderRadius: 8,
              padding: '9px 12px',
              color: '#f1f5f9',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={carregando}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px',
              background: 'rgba(39,199,216,0.15)',
              border: '1px solid rgba(39,199,216,0.3)',
              borderRadius: 8,
              color: 'rgba(39,199,216,0.9)',
              fontSize: 13,
              fontWeight: 600,
              cursor: carregando ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <UserPlus size={14} />
            {carregando ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>

        {erro && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '9px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16,
          }}>{erro}</div>
        )}
        {sucesso && (
          <div style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 8, padding: '9px 14px', color: '#86efac', fontSize: 13, marginBottom: 16,
          }}>{sucesso}</div>
        )}

        {/* Lista de membros */}
        <div style={{ display: 'grid', gap: 8 }}>
          {membros.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(30,41,59,0.5)',
              border: '1px solid rgba(51,65,85,0.4)',
              borderRadius: 8,
              padding: '11px 14px',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(39,199,216,0.12)',
                border: '1px solid rgba(39,199,216,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'rgba(39,199,216,0.8)',
                flexShrink: 0,
              }}>
                {(m.email ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 500 }}>{m.email ?? m.user_id}</div>
                <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', marginTop: 2 }}>
                  {new Date(m.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {m.papel === 'admin' && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)',
                    borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: '#fde68a',
                  }}>
                    <Crown size={10} />
                    Admin
                  </span>
                )}
                {m.papel !== 'admin' && (
                  <button
                    onClick={() => removerMembro(m.id)}
                    title="Remover membro"
                    style={{
                      background: 'none', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 6, padding: '5px 7px', cursor: 'pointer',
                      color: 'rgba(239,68,68,0.6)', display: 'flex', alignItems: 'center',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {membros.length === 0 && (
            <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Nenhum membro cadastrado.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
