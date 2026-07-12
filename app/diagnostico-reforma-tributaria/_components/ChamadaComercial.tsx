'use client'

import { MessageCircle } from 'lucide-react'
import { rastrearEvento } from '@/lib/analytics/track'
import { cor, cardBase, botaoPrimario } from './tokens'

const WHATSAPP_NUMERO = (process.env.NEXT_PUBLIC_WHATSAPP_ENFOKUS_CONTABILIDADE || '').replace(/\D/g, '')

export default function ChamadaComercial({ codigoDiagnostico }: { codigoDiagnostico: string }) {
  const mensagem = `Olá! Fiz o diagnóstico de IBS e CBS no site da Enfokus Contabilidade e gostaria de receber orientação. Meu código de análise é ${codigoDiagnostico || '-'}.`
  const link = WHATSAPP_NUMERO ? `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}` : ''

  return (
    <section style={{ padding: '10px 0 52px' }}>
      <div
        style={{
          ...cardBase,
          padding: 32,
          background: 'linear-gradient(135deg, rgba(39,199,216,0.10), rgba(39,199,216,0.02))',
          textAlign: 'center',
        }}
      >
        <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, color: cor.texto }}>
          Não deixe para descobrir o problema ao tentar emitir uma nota
        </h2>
        <p style={{ margin: '0 auto 22px', fontSize: 14.5, color: cor.textoSuave, maxWidth: 520, lineHeight: 1.6 }}>
          A Enfokus Contabilidade pode avaliar o resultado e orientar sua empresa na adaptação dos processos fiscais
          para o IBS e a CBS.
        </p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => rastrearEvento('reforma_clique_whatsapp')}
            style={{ ...botaoPrimario, textDecoration: 'none' }}
          >
            <MessageCircle size={17} />
            Falar com um especialista
          </a>
        ) : (
          <span style={{ color: cor.textoFraco, fontSize: 12.5 }}>Canal de WhatsApp em configuração.</span>
        )}
      </div>
    </section>
  )
}
