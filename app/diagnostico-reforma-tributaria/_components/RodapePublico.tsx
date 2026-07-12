'use client'

import Image from 'next/image'
import { cor, container } from './tokens'

export default function RodapePublico() {
  return (
    <footer style={{ borderTop: `1px solid ${cor.borda}`, padding: '32px 0' }}>
      <div style={{ ...container, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <Image src="/logo-enfokus-contabilidade.png" alt="Enfokus Contabilidade" width={864} height={289} style={{ width: 130, height: 'auto', opacity: 0.9 }} />
          <nav style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <a href="/privacidade" style={linkRodape}>Política de Privacidade</a>
            <a href="/termos" style={linkRodape}>Termos de Uso</a>
          </nav>
        </div>

        <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.7, color: cor.textoFraco, maxWidth: 820 }}>
          O diagnóstico possui caráter informativo e analisa a estrutura técnica do XML enviado. A aplicação das
          regras de IBS e CBS pode variar conforme o regime, documento, operação e enquadramento da empresa. O
          resultado não substitui uma análise contábil, tributária ou jurídica completa.
        </p>

        <p style={{ margin: 0, fontSize: 11.5, color: cor.textoFraco }}>
          © {new Date().getFullYear()} Enfokus Contabilidade. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}

const linkRodape: React.CSSProperties = {
  fontSize: 12.5,
  color: cor.textoSuave,
  textDecoration: 'none',
}
