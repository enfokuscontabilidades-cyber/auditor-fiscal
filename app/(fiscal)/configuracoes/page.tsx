'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Bell, BellRing, Users, UserPlus, Trash2, Crown, Building2, Volume2, VolumeX, FileBadge, Upload, ImageOff, Loader2 } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { useNotifications } from '@/components/notifications/NotificationProvider'
import { redimensionarLogoParaPng } from '@/lib/imagem/redimensionarLogoCliente'
import type { EscritorioContabilPerfil } from '@/lib/types'

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
  papel?: 'admin' | 'membro'
}

type EscritorioForm = {
  nome: string
  razaoSocial: string
  cnpj: string
  telefone: string
  whatsapp: string
  email: string
  site: string
  cidade: string
  estado: string
  contadorResponsavel: string
  crc: string
  corPrincipal: string
}

const ESCRITORIO_FORM_VAZIO: EscritorioForm = {
  nome: '', razaoSocial: '', cnpj: '', telefone: '', whatsapp: '', email: '', site: '',
  cidade: '', estado: '', contadorResponsavel: '', crc: '', corPrincipal: '',
}

function perfilParaForm(p: EscritorioContabilPerfil | null): EscritorioForm {
  if (!p) return ESCRITORIO_FORM_VAZIO
  return {
    nome: p.nome ?? '', razaoSocial: p.razao_social ?? '', cnpj: p.cnpj ?? '', telefone: p.telefone ?? '',
    whatsapp: p.whatsapp ?? '', email: p.email ?? '', site: p.site ?? '', cidade: p.cidade ?? '',
    estado: p.estado ?? '', contadorResponsavel: p.contador_responsavel ?? '', crc: p.crc ?? '',
    corPrincipal: p.cor_principal ?? '',
  }
}

export default function ConfiguracoesPage() {
  const { preferences, updatePreferences, addNotification } = useNotifications()
  const [org, setOrg] = useState<Org | null>(null)
  const [membros, setMembros] = useState<Membro[]>([])
  const [novoEmail, setNovoEmail] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [carregando, setCarregando] = useState(false)

  const [escritorioForm, setEscritorioForm] = useState<EscritorioForm>(ESCRITORIO_FORM_VAZIO)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [salvandoEscritorio, setSalvandoEscritorio] = useState(false)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [mensagemEscritorio, setMensagemEscritorio] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  function carregarEscritorio() {
    fetch('/api/rt/escritorio').then(r => r.json()).then(d => {
      setEscritorioForm(perfilParaForm(d?.perfil ?? null))
      setLogoUrl(d?.logoUrl ?? null)
    }).catch(() => {})
  }

  const cardStyle: CSSProperties = {
    background: 'var(--af-surface)',
    border: '1px solid var(--af-border)',
    borderRadius: 12,
    padding: '24px 28px',
    marginBottom: 28,
  }

  const inputStyle: CSSProperties = {
    background: 'var(--af-surface-2)',
    border: '1px solid var(--af-border)',
    borderRadius: 8,
    padding: '9px 12px',
    color: 'var(--af-text)',
    fontSize: 13,
    outline: 'none',
  }

  useEffect(() => {
    fetch('/api/organizacoes').then(r => r.json()).then(d => setOrg(d))
    fetch('/api/membros').then(r => r.json()).then(d => { if (Array.isArray(d)) setMembros(d) })
    carregarEscritorio()
  }, [])

  async function salvarEscritorio(e: React.FormEvent) {
    e.preventDefault()
    setMensagemEscritorio(null)
    if (!escritorioForm.nome.trim()) {
      setMensagemEscritorio({ tipo: 'erro', texto: 'O nome do escritório é obrigatório.' })
      return
    }
    setSalvandoEscritorio(true)
    try {
      const res = await fetch('/api/rt/escritorio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(escritorioForm),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensagemEscritorio({ tipo: 'erro', texto: body.error ?? 'Erro ao salvar os dados do escritório.' })
        return
      }
      setMensagemEscritorio({ tipo: 'sucesso', texto: 'Dados do escritório salvos com sucesso.' })
      carregarEscritorio()
    } finally {
      setSalvandoEscritorio(false)
    }
  }

  async function enviarLogo(arquivo: File) {
    setMensagemEscritorio(null)
    setEnviandoLogo(true)
    try {
      const png = await redimensionarLogoParaPng(arquivo)
      const form = new FormData()
      form.append('logo', png, 'logo.png')
      const res = await fetch('/api/rt/escritorio/logo', { method: 'POST', body: form })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMensagemEscritorio({ tipo: 'erro', texto: body.error ?? 'Erro ao enviar a logo.' })
        return
      }
      setLogoUrl(body.logoUrl ?? null)
      setMensagemEscritorio({ tipo: 'sucesso', texto: 'Logo atualizada com sucesso.' })
    } catch (e) {
      setMensagemEscritorio({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao processar a imagem.' })
    } finally {
      setEnviandoLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  async function removerLogo() {
    if (!confirm('Remover a logo do escritório? O relatório do contador passará a exibir apenas o nome do escritório.')) return
    setEnviandoLogo(true)
    try {
      const res = await fetch('/api/rt/escritorio/logo', { method: 'DELETE' })
      if (res.ok) setLogoUrl(null)
    } finally {
      setEnviandoLogo(false)
    }
  }

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
    border: `1px solid ${ativo ? 'rgba(39,199,216,0.45)' : 'var(--af-border)'}`,
    background: ativo ? 'rgba(39,199,216,0.22)' : 'var(--af-surface-2)',
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
        borderTop: '1px solid var(--af-border)',
      }}>
        <div style={{ color: checked ? 'var(--af-primary)' : 'var(--af-muted)', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--af-text)' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--af-muted)', marginTop: 3, lineHeight: 1.4 }}>{description}</div>
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

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BellRing size={18} style={{ color: 'rgba(39,199,216,0.8)' }} />
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--af-text)' }}>Notificacoes</h2>
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
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Building2 size={18} style={{ color: 'rgba(39,199,216,0.8)' }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--af-text)' }}>Escritório</h2>
        </div>

        {org ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--af-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--af-text)', marginTop: 4 }}>{org.nome}</div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--af-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plano</span>
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
          <div style={{ color: 'var(--af-muted)', fontSize: 13 }}>Carregando...</div>
        )}
      </section>

      {/* Dados do escritório para relatórios (versão do contador) */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <FileBadge size={18} style={{ color: 'rgba(39,199,216,0.8)' }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--af-text)' }}>Dados do escritório para relatórios</h2>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--af-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Usados exclusivamente na versão do contador do relatório de IBS/CBS (não afeta a versão empresarial, que continua
          com os dados da Enfokus). Nada aqui é preenchido automaticamente — cadastre apenas os dados do seu escritório.
        </p>

        {org && org.papel !== 'admin' && (
          <div style={{ marginBottom: 16, fontSize: 12.5, color: 'var(--af-muted)' }}>
            Somente administradores do escritório podem alterar esses dados. Você ainda pode gerar relatórios com a
            identidade já cadastrada.
          </div>
        )}

        {mensagemEscritorio && (
          <div style={{
            marginBottom: 16, padding: '9px 14px', borderRadius: 8, fontSize: 13,
            background: mensagemEscritorio.tipo === 'erro' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            border: `1px solid ${mensagemEscritorio.tipo === 'erro' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            color: mensagemEscritorio.tipo === 'erro' ? '#b91c1c' : '#15803d',
          }}>
            {mensagemEscritorio.texto}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 96, height: 56, borderRadius: 8, border: '1px dashed var(--af-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
            background: 'var(--af-surface-2)',
          }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo do escritório" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <ImageOff size={20} style={{ color: 'var(--af-muted)' }} />
            )}
          </div>
          {org?.papel === 'admin' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) enviarLogo(f) }}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={enviandoLogo}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px',
                  background: 'rgba(39,199,216,0.12)', border: '1px solid rgba(39,199,216,0.28)', borderRadius: 8,
                  color: 'rgba(39,199,216,0.95)', fontSize: 12, fontWeight: 600, cursor: enviandoLogo ? 'not-allowed' : 'pointer',
                }}
              >
                {enviandoLogo ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={13} />}
                {logoUrl ? 'Substituir logo' : 'Enviar logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={removerLogo}
                  disabled={enviandoLogo}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                    background: 'none', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8,
                    color: 'rgba(239,68,68,0.75)', fontSize: 12, fontWeight: 600, cursor: enviandoLogo ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Trash2 size={13} /> Remover
                </button>
              )}
            </div>
          )}
        </div>

        <form onSubmit={salvarEscritorio} style={{ display: 'grid', gap: 12, opacity: org?.papel === 'admin' ? 1 : 0.6, pointerEvents: org?.papel === 'admin' ? 'auto' : 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>Nome do escritório *</label>
              <input required value={escritorioForm.nome} onChange={e => setEscritorioForm({ ...escritorioForm, nome: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>Razão social</label>
              <input value={escritorioForm.razaoSocial} onChange={e => setEscritorioForm({ ...escritorioForm, razaoSocial: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>CNPJ</label>
              <input value={escritorioForm.cnpj} onChange={e => setEscritorioForm({ ...escritorioForm, cnpj: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>Contador responsável</label>
              <input value={escritorioForm.contadorResponsavel} onChange={e => setEscritorioForm({ ...escritorioForm, contadorResponsavel: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>CRC</label>
              <input value={escritorioForm.crc} onChange={e => setEscritorioForm({ ...escritorioForm, crc: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>Telefone</label>
              <input value={escritorioForm.telefone} onChange={e => setEscritorioForm({ ...escritorioForm, telefone: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>WhatsApp</label>
              <input value={escritorioForm.whatsapp} onChange={e => setEscritorioForm({ ...escritorioForm, whatsapp: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>E-mail</label>
              <input type="email" value={escritorioForm.email} onChange={e => setEscritorioForm({ ...escritorioForm, email: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>Site</label>
              <input value={escritorioForm.site} onChange={e => setEscritorioForm({ ...escritorioForm, site: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>Cidade</label>
              <input value={escritorioForm.cidade} onChange={e => setEscritorioForm({ ...escritorioForm, cidade: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>UF</label>
              <input maxLength={2} value={escritorioForm.estado} onChange={e => setEscritorioForm({ ...escritorioForm, estado: e.target.value.toUpperCase() })} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--af-muted)' }}>Cor principal</label>
              <input type="color" value={escritorioForm.corPrincipal || '#27c7d8'} onChange={e => setEscritorioForm({ ...escritorioForm, corPrincipal: e.target.value })} style={{ ...inputStyle, width: '100%', padding: 4, height: 36 }} />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={salvandoEscritorio}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
                background: 'rgba(39,199,216,0.15)', border: '1px solid rgba(39,199,216,0.3)', borderRadius: 8,
                color: 'rgba(39,199,216,0.9)', fontSize: 13, fontWeight: 600, cursor: salvandoEscritorio ? 'not-allowed' : 'pointer',
              }}
            >
              {salvandoEscritorio ? 'Salvando...' : 'Salvar dados do escritório'}
            </button>
          </div>
        </form>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </section>

      {/* Membros */}
      <section style={{ ...cardStyle, marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Users size={18} style={{ color: 'rgba(39,199,216,0.8)' }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--af-text)' }}>
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
              ...inputStyle,
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
            borderRadius: 8, padding: '9px 14px', color: '#b91c1c', fontSize: 13, marginBottom: 16,
          }}>{erro}</div>
        )}
        {sucesso && (
          <div style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 8, padding: '9px 14px', color: '#15803d', fontSize: 13, marginBottom: 16,
          }}>{sucesso}</div>
        )}

        {/* Lista de membros */}
        <div style={{ display: 'grid', gap: 8 }}>
          {membros.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--af-surface-2)',
              border: '1px solid var(--af-border)',
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
                <div style={{ fontSize: 13, color: 'var(--af-text)', fontWeight: 500 }}>{m.email ?? m.user_id}</div>
                <div style={{ fontSize: 11, color: 'var(--af-muted)', marginTop: 2 }}>
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
            <div style={{ color: 'var(--af-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Nenhum membro cadastrado.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
