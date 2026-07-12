'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { cor, cardBase, raio } from './tokens'

const ETAPAS = [
  'Recebendo o arquivo',
  'Validando a estrutura',
  'Localizando campos de IBS e CBS',
  'Preparando o diagnóstico',
]

export default function PainelProcessamento() {
  const [atual, setAtual] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setAtual(prev => (prev < ETAPAS.length - 1 ? prev + 1 : prev))
    }, 850)
    return () => clearInterval(id)
  }, [])

  return (
    <section style={{ padding: '70px 0', display: 'flex', justifyContent: 'center' }}>
      <div style={{ ...cardBase, padding: 32, width: 'min(420px, 100%)', textAlign: 'center' }}>
        <Loader2 size={26} color={cor.acento} className="girando" style={{ marginBottom: 18 }} />
        <p style={{ margin: '0 0 22px', fontSize: 15, fontWeight: 700, color: cor.texto }}>Analisando seu XML...</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
          {ETAPAS.map((etapa, i) => (
            <div key={etapa} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: raio.sm, background: i <= atual ? 'rgba(39,199,216,0.06)' : 'transparent' }}>
              {i < atual ? (
                <CheckCircle2 size={16} color={cor.acento} />
              ) : i === atual ? (
                <Loader2 size={16} color={cor.acento} className="girando" />
              ) : (
                <span style={{ width: 16, height: 16, borderRadius: 999, border: `1px solid ${cor.borda}`, display: 'inline-block' }} />
              )}
              <span style={{ fontSize: 13, color: i <= atual ? cor.texto : cor.textoFraco }}>{etapa}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
