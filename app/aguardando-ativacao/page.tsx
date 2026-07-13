'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPlanoReformaTributaria, formatarPrecoCentavos, formatarLimite } from '@/lib/planos/reformaTributariaPlanos'

function AguardandoConteudo() {
  const searchParams = useSearchParams()
  const paymentSuccess = searchParams.get('payment') === 'success'
  const produto = searchParams.get('produto')
  const planoCodigo = searchParams.get('plano')
  const ehReformaTributaria = produto === 'reforma_tributaria'
  const planoRt = ehReformaTributaria ? getPlanoReformaTributaria(planoCodigo) : undefined
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!paymentSuccess) return
    let tentativas = 0
    const intervalo = setInterval(async () => {
      tentativas++
      if (ehReformaTributaria) {
        const res = await fetch('/api/rt/assinatura')
        const dados = await res.json()
        if (dados?.assinatura?.status === 'active' || dados?.assinatura?.status === 'manual') {
          clearInterval(intervalo)
          window.location.href = '/'
        }
      } else {
        const res = await fetch('/api/organizacoes')
        const org = await res.json()
        if (org?.plano && org.plano !== 'pendente') {
          clearInterval(intervalo)
          window.location.href = '/'
        }
      }
      if (tentativas >= 10) clearInterval(intervalo)
    }, 2000)
    return () => clearInterval(intervalo)
  }, [paymentSuccess, ehReformaTributaria])

  async function assinar() {
    setCarregando(true)
    setErro('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ehReformaTributaria ? JSON.stringify({ produto: 'reforma_tributaria', planoCodigo }) : undefined,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErro(d.error ?? 'Erro ao iniciar pagamento')
        setCarregando(false)
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } catch {
      setErro('Erro inesperado. Tente novamente.')
      setCarregando(false)
    }
  }

  async function handleLogout() {
    sessionStorage.removeItem('session_active')
    localStorage.removeItem('stay_logged_in')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (paymentSuccess) {
    return (
      <>
        <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
          Pagamento recebido!
        </h1>
        <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 14, lineHeight: 1.65, margin: '0 0 24px' }}>
          Estamos ativando seu acesso. Isso leva alguns segundos...
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(39,199,216,0.7)', fontSize: 13 }}>
          <span style={{
            width: 16, height: 16,
            border: '2px solid rgba(39,199,216,0.3)',
            borderTopColor: 'rgba(39,199,216,0.8)',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.8s linear infinite',
          }} />
          Verificando ativação...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </>
    )
  }

  return (
    <>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'linear-gradient(135deg, rgba(39,199,216,0.15), rgba(8,145,178,0.08))',
        border: '1px solid rgba(39,199,216,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 28px', fontSize: 28,
      }}>🔐</div>

      <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
        Ative seu acesso
      </h1>
      <p style={{ color: 'rgba(148,163,184,0.8)', fontSize: 14, lineHeight: 1.65, margin: '0 0 32px' }}>
        Seu escritório foi criado com sucesso.<br />
        Assine o plano para começar a usar o sistema.
      </p>

      <div style={{
        background: 'rgba(39,199,216,0.06)',
        border: '1px solid rgba(39,199,216,0.2)',
        borderRadius: 14, padding: '24px 28px',
        marginBottom: 28, textAlign: 'left',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
              {ehReformaTributaria ? `Reforma Tributária — ${planoRt?.nome ?? 'plano'}` : 'Founder Access'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', marginTop: 2 }}>
              {ehReformaTributaria ? 'Acesso exclusivo à Reforma Tributária' : 'Acesso completo à plataforma'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'rgba(39,199,216,0.9)' }}>
              {ehReformaTributaria && planoRt ? formatarPrecoCentavos(planoRt.precoCentavos) : 'R$ XXX'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)' }}>/mês</div>
          </div>
        </div>
        {(ehReformaTributaria && planoRt
          ? [
            formatarLimite(planoRt.limiteCnpj, 'CNPJ'),
            planoRt.limiteXmlPorCiclo === null ? 'XMLs sem limite mensal comercial' : `Até ${planoRt.limiteXmlPorCiclo} XMLs por mês`,
            'Análise de IBS e CBS',
            'Histórico de análises',
            'Relatório em PDF',
          ]
          : [
            'Auditoria SPED Fiscal ilimitada',
            'Validação de NF-e',
            'Simples Nacional (PGDAS-D)',
            'Planejamento tributário',
            'Múltiplos usuários por escritório',
          ]
        ).map(item => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ color: 'rgba(39,199,216,0.8)', fontSize: 14 }}>✓</span>
            <span style={{ fontSize: 13, color: 'rgba(203,213,225,0.7)' }}>{item}</span>
          </div>
        ))}
      </div>

      {erro && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 14px', color: '#fca5a5',
          fontSize: 13, marginBottom: 20, textAlign: 'left',
        }}>{erro}</div>
      )}

      <button
        onClick={assinar}
        disabled={carregando}
        style={{
          width: '100%', padding: '14px 0',
          background: carregando ? 'rgba(39,199,216,0.3)' : 'linear-gradient(90deg, rgba(39,199,216,0.9), rgba(8,145,178,0.9))',
          border: 'none', borderRadius: 10, color: '#fff',
          fontSize: 15, fontWeight: 700,
          cursor: carregando ? 'not-allowed' : 'pointer',
          boxShadow: carregando ? 'none' : '0 8px 24px rgba(39,199,216,0.25)',
          marginBottom: 16,
        }}
      >
        {carregando ? 'Redirecionando para pagamento...' : 'Assinar agora'}
      </button>

      <button
        onClick={handleLogout}
        style={{
          background: 'none', border: 'none',
          color: 'rgba(148,163,184,0.4)', fontSize: 12,
          cursor: 'pointer', textDecoration: 'underline',
        }}
      >
        Sair da conta
      </button>
    </>
  )
}

export default function AguardandoAtivacaoPage() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0a0f1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'rgba(15,23,42,0.95)',
        border: '1px solid rgba(39,199,216,0.15)',
        borderRadius: 20, padding: '56px 48px',
        width: '100%', maxWidth: 480, textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }}>
        <Suspense fallback={<div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 14 }}>Carregando...</div>}>
          <AguardandoConteudo />
        </Suspense>
      </div>
    </div>
  )
}
