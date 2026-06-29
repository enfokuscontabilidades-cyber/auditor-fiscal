'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEmpresaAtiva } from '@/lib/hooks/useEmpresaAtiva'
import { useTheme } from '@/components/ThemeProvider'
import { useNotifications, type FiscalNotification } from '@/components/notifications/NotificationProvider'
import { AlertTriangle, Bell, Building2, CheckCircle2, ChevronDown, Clock3, Download, FileText, LogOut, Moon, Search, Settings, Star, Sun, Trash2, X } from 'lucide-react'

type EmpresaItem = { id: string; razao_social: string; cnpj: string | null; cnae_principal?: string | null; inscricao_estadual?: string | null }

function formatarCnpj(cnpj?: string | null) {
  const limpo = (cnpj ?? '').replace(/\D/g, '')
  if (limpo.length !== 14) return cnpj ?? ''
  return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12)}`
}

const iconBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid transparent',
  borderRadius: 10,
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--af-muted)',
  position: 'relative',
  flexShrink: 0,
}

export default function TopbarFiscal() {
  const router = useRouter()
  const supabase = createClient()
  const { empresaAtiva, definirEmpresaAtiva } = useEmpresaAtiva()
  const { tema, alternarTema } = useTheme()
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearRead,
    triggerAction,
  } = useNotifications()

  const [empresas, setEmpresas] = useState<EmpresaItem[]>([])
  const [menuAberto, setMenuAberto] = useState(false)
  const [userMenuAberto, setUserMenuAberto] = useState(false)
  const [notifAberto, setNotifAberto] = useState(false)
  const [detalheAberto, setDetalheAberto] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [userInitials, setUserInitials] = useState('--')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    fetch('/api/empresas')
      .then(r => r.json())
      .then((d: unknown) => { if (Array.isArray(d)) setEmpresas(d as EmpresaItem[]) })
      .catch(() => {})

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const nome: string = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? ''
      const parts = nome.split(/[\s@.]+/).filter(Boolean)
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : (parts[0]?.slice(0, 2) ?? '--').toUpperCase()
      setUserInitials(initials)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuAberto(false)
        setBusca('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifAberto(false)
        setDetalheAberto(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const termoNum = termo.replace(/\D/g, '')
    if (!termo) return empresas.slice(0, 8)
    return empresas.filter(emp => {
      const nome = emp.razao_social.toLowerCase()
      const cnpj = (emp.cnpj ?? '').replace(/\D/g, '')
      return nome.includes(termo) || (!!termoNum && cnpj.includes(termoNum))
    }).slice(0, 12)
  }, [busca, empresas])

  const empresaTopo = useMemo(() => {
    if (!empresaAtiva) return null
    const detalhada = empresas.find(emp => emp.id === empresaAtiva.id)
    return {
      ...empresaAtiva,
      cnpj: empresaAtiva.cnpj ?? detalhada?.cnpj ?? undefined,
      inscricao_estadual: empresaAtiva.inscricao_estadual ?? detalhada?.inscricao_estadual ?? undefined,
    }
  }, [empresaAtiva, empresas])

  async function handleLogout() {
    sessionStorage.removeItem('session_active')
    localStorage.removeItem('stay_logged_in')
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function handleConfiguracoes() {
    setUserMenuAberto(false)
    router.push('/configuracoes')
  }

  function handleAlternarTema() {
    alternarTema()
    setUserMenuAberto(false)
  }

  function selecionar(emp: EmpresaItem) {
    definirEmpresaAtiva({
      id: emp.id,
      razao_social: emp.razao_social,
      cnpj: emp.cnpj ?? undefined,
      cnae_principal: emp.cnae_principal ?? undefined,
      inscricao_estadual: emp.inscricao_estadual ?? undefined,
    })
    setMenuAberto(false)
    setBusca('')
  }

  function formatarHora(ts: number) {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function statusMeta(item: FiscalNotification) {
    if (item.status === 'running') return { label: 'Em andamento', color: '#f59e0b', icon: <Clock3 size={14} /> }
    if (item.status === 'error') return { label: 'Erro', color: '#ef4444', icon: <AlertTriangle size={14} /> }
    return { label: 'Concluido', color: '#22c55e', icon: <CheckCircle2 size={14} /> }
  }

  function abrirNotificacao(item: FiscalNotification) {
    markAsRead(item.id)
    if (item.status !== 'success') return
    if (item.action?.type === 'download') {
      triggerAction(item.id)
      return
    }
    if (item.action?.type === 'details') {
      setDetalheAberto(prev => prev === item.id ? null : item.id)
    }
  }

  return (
    <header style={{
      width: '100%',
      height: 68,
      background: 'var(--af-surface)',
      borderBottom: '1px solid var(--af-border)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 24px',
      flexShrink: 0,
      boxSizing: 'border-box',
    }}>

      {/* Dados da empresa ativa */}
      <div style={{ flex: '0 0 auto', maxWidth: 360, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          fontWeight: 700,
          color: empresaTopo?.cnpj ? 'var(--af-text)' : 'var(--af-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.2,
        }}>
          <Building2 size={15} style={{ color: 'var(--af-primary)', flexShrink: 0 }} />
          {empresaTopo?.cnpj ? `CNPJ ${formatarCnpj(empresaTopo.cnpj)}` : 'Nenhuma empresa em analise'}
        </div>
        {empresaTopo?.inscricao_estadual && (
          <div style={{
            fontSize: 11,
            color: 'var(--af-muted)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
            paddingLeft: 23,
          }}>
            IE {empresaTopo.inscricao_estadual}
          </div>
        )}
      </div>

      {/* Spacer esquerdo */}
      <div style={{ flex: 1 }} />

      {/* Seletor de empresa */}
      <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setMenuAberto(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
            background: 'var(--af-surface-2)',
            border: '1px solid var(--af-border)',
            borderRadius: 10,
            cursor: 'pointer',
            minWidth: 200,
            maxWidth: 320,
            color: 'var(--af-text)',
          }}
        >
          <Building2 size={15} style={{ color: 'var(--af-primary)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            {empresaAtiva ? (
              <>
                <div style={{ fontSize: 10, color: 'var(--af-muted)', lineHeight: 1, marginBottom: 2 }}>Empresa ativa</div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--af-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.2,
                }}>
                  {empresaAtiva.razao_social}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--af-muted)' }}>Selecionar empresa</div>
            )}
          </div>
          <ChevronDown
            size={14}
            style={{
              color: 'var(--af-muted)',
              flexShrink: 0,
              transition: 'transform .15s ease',
              transform: menuAberto ? 'rotate(180deg)' : 'none',
            }}
          />
        </button>

        {menuAberto && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 340,
            background: 'var(--af-elevated)',
            border: '1px solid var(--af-border)',
            borderRadius: 14,
            padding: 8,
            boxShadow: 'var(--af-shadow)',
            zIndex: 200,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'var(--af-surface-2)',
              border: '1px solid var(--af-border)',
              marginBottom: 8,
            }}>
              <Search size={14} style={{ color: 'var(--af-muted)', flexShrink: 0 }} />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar nome ou CNPJ..."
                autoFocus
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 0,
                  outline: 0,
                  boxShadow: 'none',
                  color: 'var(--af-text)',
                  fontSize: 12,
                }}
              />
            </div>

            <div style={{
              maxHeight: 240,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              {empresasFiltradas.length === 0 ? (
                <div style={{ padding: '10px 8px', color: 'var(--af-muted)', fontSize: 12 }}>
                  Nenhuma empresa encontrada.
                </div>
              ) : empresasFiltradas.map(emp => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => selecionar(emp)}
                  style={{
                    width: '100%',
                    border: 0,
                    borderRadius: 10,
                    padding: '9px 8px',
                    background: empresaAtiva?.id === emp.id ? 'var(--af-primary-soft)' : 'transparent',
                    color: 'var(--af-text)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {empresaAtiva?.id === emp.id
                    ? <Star size={13} fill="currentColor" style={{ color: 'var(--af-primary)', marginTop: 2, flexShrink: 0 }} />
                    : <Building2 size={13} style={{ color: 'var(--af-muted)', marginTop: 2, flexShrink: 0 }} />
                  }
                  <span style={{ minWidth: 0, overflow: 'hidden' }}>
                    <strong style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--af-text)',
                    }}>
                      {emp.razao_social}
                    </strong>
                    {emp.cnpj && (
                      <small style={{ display: 'block', fontSize: 11, color: 'var(--af-muted)', marginTop: 1 }}>
                        {formatarCnpj(emp.cnpj)}{emp.inscricao_estadual ? ` - IE ${emp.inscricao_estadual}` : ''}
                      </small>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Spacer direito */}
      <div style={{ flex: 1 }} />

      {/* Área direita — ações globais */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

        {/* Busca */}
        <button type="button" title="Busca global" style={iconBtn}>
          <Search size={18} />
        </button>

        <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            title="Notificacoes"
            onClick={() => setNotifAberto(v => !v)}
            style={{
              ...iconBtn,
              color: notifAberto ? 'var(--af-primary)' : iconBtn.color,
              background: notifAberto ? 'var(--af-primary-soft)' : 'transparent',
              border: notifAberto ? '1px solid var(--af-primary)' : '1px solid transparent',
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 3,
                right: 3,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                background: '#ef4444',
                borderRadius: 999,
                border: '2px solid var(--af-surface)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
                lineHeight: '12px',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifAberto && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 380, maxWidth: 'calc(100vw - 32px)', background: 'var(--af-elevated)', border: '1px solid var(--af-border)', borderRadius: 14, boxShadow: 'var(--af-shadow)', zIndex: 350, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 12px 10px', borderBottom: '1px solid var(--af-border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--af-text)' }}>Avisos</div>
                  <div style={{ fontSize: 11, color: 'var(--af-muted)', marginTop: 2 }}>{notifications.length === 0 ? 'Nenhuma tarefa recente' : `${notifications.length} aviso(s) nesta sessao`}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" title="Marcar tudo como lido" onClick={markAllAsRead} style={{ ...iconBtn, width: 30, height: 30, borderRadius: 8 }}><CheckCircle2 size={15} /></button>
                  <button type="button" title="Limpar avisos lidos" onClick={clearRead} style={{ ...iconBtn, width: 30, height: 30, borderRadius: 8 }}><Trash2 size={15} /></button>
                </div>
              </div>

              <div style={{ maxHeight: 420, overflowY: 'auto', padding: 8 }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '22px 14px', textAlign: 'center', color: 'var(--af-muted)', fontSize: 12 }}>Quando uma tarefa terminar, ela aparece aqui.</div>
                ) : notifications.map(item => {
                  const meta = statusMeta(item)
                  const isDownload = item.action?.type === 'download'
                  const isDetails = item.action?.type === 'details'
                  const expanded = detalheAberto === item.id && isDetails
                  return (
                    <div key={item.id} style={{ border: `1px solid ${item.read ? 'var(--af-border)' : 'rgba(39,199,216,0.38)'}`, borderRadius: 12, marginBottom: 8, background: item.read ? 'var(--af-surface)' : 'var(--af-primary-soft)', overflow: 'hidden', position: 'relative' }}>
                      <button type="button" onClick={() => abrirNotificacao(item)} style={{ width: '100%', border: 0, background: 'transparent', color: 'var(--af-text)', padding: '10px 34px 10px 10px', cursor: item.status === 'success' && item.action ? 'pointer' : 'default', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                        <span style={{ color: meta.color, flexShrink: 0, marginTop: 1 }}>{meta.icon}</span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                            <strong style={{ fontSize: 12, fontWeight: 800, color: 'var(--af-text)' }}>{item.title}</strong>
                            <small style={{ fontSize: 10, color: 'var(--af-muted)', whiteSpace: 'nowrap' }}>{formatarHora(item.completedAt ?? item.createdAt)}</small>
                          </span>
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--af-muted)', lineHeight: 1.35 }}>{item.message}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 7, color: meta.color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {meta.label}
                            {isDownload && <><Download size={12} /> Baixar</>}
                            {isDetails && <><FileText size={12} /> Detalhes</>}
                          </span>
                        </span>
                      </button>
                      {expanded && item.action?.type === 'details' && (
                        <pre style={{ margin: '0 10px 10px 33px', padding: 10, borderRadius: 10, background: 'var(--af-surface-2)', color: 'var(--af-text-soft)', border: '1px solid var(--af-border)', fontSize: 11, lineHeight: 1.45, whiteSpace: 'pre-wrap', maxHeight: 180, overflowY: 'auto', fontFamily: 'inherit' }}>{item.action.details}</pre>
                      )}
                      <button type="button" title="Remover aviso" onClick={() => removeNotification(item.id)} style={{ position: 'absolute', top: 7, right: 7, width: 22, height: 22, border: 0, borderRadius: 7, background: 'transparent', color: 'var(--af-muted)', cursor: 'pointer' }}><X size={13} /></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Avatar do usuário + menu dropdown */}
        <div ref={userMenuRef} style={{ position: 'relative', flexShrink: 0, marginLeft: 4 }}>
          <button
            type="button"
            onClick={() => setUserMenuAberto(v => !v)}
            title="Menu do usuário"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 8px 5px 5px',
              border: `1px solid ${userMenuAberto ? 'var(--af-primary)' : 'var(--af-border)'}`,
              borderRadius: 10,
              background: userMenuAberto ? 'var(--af-primary-soft)' : 'transparent',
              cursor: 'pointer',
              color: 'var(--af-text)',
              flexShrink: 0,
              transition: 'all .15s ease',
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--af-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: '#ffffff',
              flexShrink: 0,
              letterSpacing: '0.02em',
            }}>
              {userInitials}
            </div>
            <ChevronDown
              size={13}
              style={{
                color: 'var(--af-muted)',
                transition: 'transform .15s ease',
                transform: userMenuAberto ? 'rotate(180deg)' : 'none',
              }}
            />
          </button>

          {userMenuAberto && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: 210,
              background: 'var(--af-elevated)',
              border: '1px solid var(--af-border)',
              borderRadius: 14,
              padding: 6,
              boxShadow: 'var(--af-shadow)',
              zIndex: 300,
            }}>
              <button
                type="button"
                onClick={handleAlternarTema}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  border: 0,
                  borderRadius: 10,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--af-text)',
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--af-surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {tema === 'escuro'
                  ? <Sun size={15} style={{ color: 'var(--af-primary)', flexShrink: 0 }} />
                  : <Moon size={15} style={{ color: 'var(--af-primary)', flexShrink: 0 }} />
                }
                {tema === 'escuro' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
              </button>

              <button
                type="button"
                onClick={handleConfiguracoes}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  border: 0,
                  borderRadius: 10,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--af-text)',
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--af-surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Settings size={15} style={{ color: 'var(--af-primary)', flexShrink: 0 }} />
                Configurações
              </button>

              <div style={{
                height: 1,
                background: 'var(--af-border)',
                margin: '6px 8px',
              }} />

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  border: 0,
                  borderRadius: 10,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--af-danger)',
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--af-danger-soft)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut size={15} style={{ flexShrink: 0 }} />
                Sair da conta
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
