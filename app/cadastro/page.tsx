'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getPlanoReformaTributaria } from '@/lib/planos/reformaTributariaPlanos'

export default function CadastroPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [produto, setProduto] = useState<string | null>(null)
  const [plano, setPlano] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setProduto(params.get('produto'))
    setPlano(params.get('plano'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const destinoOnboarding = produto === 'reforma_tributaria'
    ? `/configuracoes/novo-escritorio?produto=reforma_tributaria&plano=${plano ?? ''}`
    : '/configuracoes/novo-escritorio'

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (password.length < 8) {
      setErro('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setErro('As senhas não conferem.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(destinoOnboarding)}`,
        },
      })

      if (error) {
        setErro(error.message.includes('already registered')
          ? 'Este e-mail já possui uma conta. Faça login.'
          : error.message)
        setLoading(false)
        return
      }

      if (data.session) {
        sessionStorage.setItem('session_active', '1')
        window.location.href = destinoOnboarding
      } else {
        setSucesso(true)
      }
    } catch (err) {
      setErro(`Erro ao conectar: ${err instanceof Error ? err.message : 'tente novamente.'}`)
    }
    setLoading(false)
  }

  const S: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg,#071527 0%,#071527 46%,#1e3a8a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-geist-sans)', padding: 24 },
    shell: { display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) minmax(340px, 520px)', maxWidth: 960, width: '100%', background: 'var(--af-surface)', borderRadius: 28, overflow: 'hidden', boxShadow: '0 32px 90px rgba(2,6,23,0.38)' },
    brand: { padding: 44, background: 'linear-gradient(160deg,#071527 0%,#071527 58%,#0b67c2 100%)', color: 'var(--af-surface)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 520 },
    card: { padding: '48px 48px', width: '100%' },
    logoBox: { width: 180, minHeight: 72, borderRadius: 18, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 },
    eyebrow: { color: '#93c5fd', fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: 10 },
    title: { color: 'var(--af-text)', fontSize: 26, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.03em' },
    subtitle: { color: 'var(--af-muted)', fontSize: 14, lineHeight: 1.55, margin: '0 0 24px' },
    label: { display: 'block', color: 'var(--af-text-soft)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 7 },
    input: { width: '100%', background: 'var(--af-surface-2)', border: '1px solid #dbe3ef', borderRadius: 12, color: 'var(--af-text)', fontSize: 15, padding: '12px 14px', outline: 'none', marginBottom: 16, boxSizing: 'border-box' as const },
    btn: { width: '100%', background: loading ? '#93c5fd' : 'linear-gradient(135deg,var(--af-primary),#0284c7)', border: 'none', borderRadius: 12, color: 'var(--af-surface)', fontSize: 15, fontWeight: 800, padding: '13px', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, boxShadow: '0 14px 26px rgba(29,78,216,0.24)' },
    erro: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#b91c1c', fontSize: 13, padding: '11px 14px', marginBottom: 16 },
  }

  if (sucesso) {
    return (
      <div style={S.page}>
        <div style={{ ...S.shell, gridTemplateColumns: '1fr', maxWidth: 480 }}>
          <div style={{ ...S.card, textAlign: 'center', padding: '64px 48px' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📧</div>
            <h2 style={{ ...S.title, textAlign: 'center' }}>Verifique seu e-mail</h2>
            <p style={{ color: 'var(--af-muted)', fontSize: 14, lineHeight: 1.65, marginBottom: 28 }}>
              Enviamos um link de confirmação para <strong>{email}</strong>.<br />
              Clique no link para ativar sua conta e entrar no sistema.
            </p>
            <Link href="/login" style={{ color: 'var(--af-primary)', fontSize: 14, textDecoration: 'none', fontWeight: 600 }}>
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <aside style={S.brand}>
          <div>
            <div style={S.logoBox}>
              <img src="/logo-enfokus-white.png" alt="Enfokus" style={{ maxWidth: '100%', maxHeight: 48, objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.04em', margin: '38px 0 12px' }}>
              Plataforma contábil para escritórios modernos.
            </h1>
            <p style={{ color: 'rgba(226,232,240,0.75)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>
              Auditoria SPED, validação NF-e, Simples Nacional e planejamento tributário em um só lugar.
            </p>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>Enfokus Contabilidade</div>
        </aside>
        <main style={S.card}>
          <div style={S.eyebrow}>{produto === 'reforma_tributaria' ? 'Reforma Tributária' : 'Founder Access'}</div>
          <h2 style={S.title}>Criar conta</h2>
          <p style={S.subtitle}>
            {produto === 'reforma_tributaria'
              ? `Crie sua conta para assinar o plano ${getPlanoReformaTributaria(plano ?? undefined)?.nome ?? ''}.`
              : 'Crie sua conta gratuita. O acesso será liberado após análise.'}
          </p>
          <form onSubmit={handleCadastro}>
            {erro && <div style={S.erro}>{erro}</div>}
            <label style={S.label} htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" required style={S.input} value={email} onChange={e => setEmail(e.target.value)} />
            <label style={S.label} htmlFor="password">Senha</label>
            <input id="password" type="password" autoComplete="new-password" required style={S.input} value={password} onChange={e => setPassword(e.target.value)} />
            <label style={S.label} htmlFor="confirm">Confirmar senha</label>
            <input id="confirm" type="password" autoComplete="new-password" required style={S.input} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            <button type="submit" style={S.btn} disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--af-muted)' }}>
            Já tem uma conta?{' '}
            <Link href="/login" style={{ color: 'var(--af-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Entrar
            </Link>
          </p>
        </main>
      </div>
    </div>
  )
}
