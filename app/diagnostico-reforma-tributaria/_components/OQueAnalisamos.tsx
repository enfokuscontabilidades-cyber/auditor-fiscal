'use client'

import { cor, cardBase } from './tokens'

const CAMPOS = [
  'Tipo de documento, número e série',
  'Data de emissão e CNPJ do emitente',
  'Presença dos grupos de IBS e CBS',
  'CST e cClassTrib',
  'Bases de cálculo e alíquotas',
  'Valores de IBS e CBS destacados',
]

export default function OQueAnalisamos() {
  return (
    <section id="o-que-analisamos" style={{ padding: '44px 0' }}>
      <div style={{ ...cardBase, padding: 26 }}>
        <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: cor.acento }}>
          O que analisamos
        </p>
        <h2 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 800, color: cor.texto }}>
          Não basta o XML citar &quot;IBS&quot; ou &quot;CBS&quot; — verificamos a estrutura real do documento
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '10px 24px' }} className="grid-2-responsivo">
          {CAMPOS.map(campo => (
            <div key={campo} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: cor.acento, marginTop: 7, flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, color: cor.textoSuave, lineHeight: 1.5 }}>{campo}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
