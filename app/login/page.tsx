'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setErro('E-mail ou senha incorretos.'); setLoading(false); return }
    window.location.href = '/'
  }

  const S: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: 'linear-gradient(135deg,#071527 0%,#071527 46%,#1e3a8a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-geist-sans)', padding: 24 },
    shell: { display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) minmax(340px, 520px)', maxWidth: 960, width: '100%', background: 'var(--af-surface)', borderRadius: 28, overflow: 'hidden', boxShadow: '0 32px 90px rgba(2,6,23,0.38)' },
    brand: { padding: 44, background: 'linear-gradient(160deg,#071527 0%,#071527 58%,#0b67c2 100%)', color: 'var(--af-surface)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 520 },
    card: { padding: '54px 48px', width: '100%' },
    logoBox: { width: 180, minHeight: 72, borderRadius: 18, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 },
    eyebrow: { color: '#93c5fd', fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: 10 },
    title: { color: 'var(--af-text)', fontSize: 28, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.03em' },
    subtitle: { color: 'var(--af-muted)', fontSize: 14, lineHeight: 1.55, margin: '0 0 30px' },
    label: { display: 'block', color: 'var(--af-text-soft)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 7 },
    input: { width: '100%', background: 'var(--af-surface-2)', border: '1px solid #dbe3ef', borderRadius: 12, color: 'var(--af-text)', fontSize: 15, padding: '12px 14px', outline: 'none', marginBottom: 18 },
    btn: { width: '100%', background: loading ? '#93c5fd' : 'linear-gradient(135deg,var(--af-primary),#0284c7)', border: 'none', borderRadius: 12, color: 'var(--af-surface)', fontSize: 15, fontWeight: 800, padding: '13px', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, boxShadow: '0 14px 26px rgba(29,78,216,0.24)' },
    erro: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#b91c1c', fontSize: 13, padding: '11px 14px', marginBottom: 18 },
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <aside style={S.brand}>
          <div>
            <div style={S.logoBox}>
              <img src="/logo-enfokus-white.png" alt="Enfokus" style={{ maxWidth: '100%', maxHeight: 48, objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: 30, lineHeight: 1.05, letterSpacing: '-0.04em', margin: '38px 0 12px' }}>Auditoria fiscal com visão executiva.</h1>
            <p style={{ color: 'rgba(226,232,240,0.75)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>Ambiente interno para análise de SPED, NF-e, inconsistências fiscais e planejamento tributário.</p>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>Enfokus Contabilidade</div>
        </aside>
        <main style={S.card}>
          <div style={S.eyebrow}>Acesso seguro</div>
          <h2 style={S.title}>Entrar no sistema</h2>
          <p style={S.subtitle}>Informe seus dados para acessar o painel de auditoria fiscal.</p>
          <form onSubmit={handleLogin}>
            {erro && <div style={S.erro}>{erro}</div>}
            <label style={S.label} htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" required style={S.input} value={email} onChange={e => setEmail(e.target.value)} />
            <label style={S.label} htmlFor="password">Senha</label>
            <input id="password" type="password" autoComplete="current-password" required style={S.input} value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit" style={S.btn} disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
          </form>
        </main>
      </div>
    </div>
  )
}
