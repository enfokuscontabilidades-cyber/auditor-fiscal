'use client'

import Image from 'next/image'
import { FileSearch } from 'lucide-react'
import { cor, container, botaoPrimario } from './tokens'

function irPara(ancora: string) {
  document.getElementById(ancora)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function CabecalhoPublico() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(10,15,26,0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${cor.borda}`,
      }}
    >
      <div style={{ ...container, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
        <Image
          src="/logo-enfokus-contabilidade.png"
          alt="Enfokus Contabilidade"
          width={864}
          height={289}
          priority
          style={{ width: 152, height: 'auto' }}
        />

        <nav style={{ display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap', justifyContent: 'flex-end' }} aria-label="Navegação principal">
          <button type="button" onClick={() => irPara('como-funciona')} className="cab-link-oculta-mobile" style={navLink}>Como funciona</button>
          <button type="button" onClick={() => irPara('o-que-analisamos')} className="cab-link-oculta-mobile" style={navLink}>O que analisamos</button>
          <a href="https://www.enfokus.com.br" target="_blank" rel="noopener noreferrer" className="cab-link-oculta-mobile" style={navLink}>Quem somos</a>
          <a href="/privacidade" className="cab-link-oculta-mobile" style={navLink}>Privacidade</a>
          <button
            type="button"
            onClick={() => irPara('formulario')}
            style={{ ...botaoPrimario, padding: '10px 20px', fontSize: 13.5 }}
          >
            <FileSearch size={16} />
            Analisar XML
          </button>
        </nav>
      </div>
    </header>
  )
}

const navLink = {
  background: 'none',
  border: 'none',
  color: cor.textoSuave,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
} as const
