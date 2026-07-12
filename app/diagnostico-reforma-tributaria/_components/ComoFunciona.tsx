'use client'

import { ClipboardEdit, UploadCloud, FileSearch2 } from 'lucide-react'
import { cor, cardBase, raio } from './tokens'

const PASSOS = [
  { icone: ClipboardEdit, titulo: 'Preencha seus dados', texto: 'Nome, empresa e CNPJ, para liberarmos o diagnóstico gratuito.' },
  { icone: UploadCloud, titulo: 'Envie o XML', texto: 'Até 10 notas por vez. O processamento acontece no servidor, com proteção contra arquivos maliciosos.' },
  { icone: FileSearch2, titulo: 'Receba o diagnóstico', texto: 'Veja o que foi encontrado em cada nota e fale com um especialista se precisar de ajuda.' },
]

export default function ComoFunciona() {
  return (
    <section id="como-funciona" style={{ padding: '48px 0 12px' }}>
      <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: cor.acento }}>
        Como funciona
      </p>
      <h2 style={{ margin: '0 0 30px', fontSize: 26, fontWeight: 800, color: cor.texto, letterSpacing: '-0.01em' }}>
        Três passos até o resultado
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 18 }} className="grid-3-responsivo">
        {PASSOS.map((passo, i) => (
          <div key={passo.titulo} style={{ ...cardBase, padding: 22 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: raio.sm,
                background: cor.acentoSuave,
                border: `1px solid ${cor.acentoBorda}`,
                display: 'grid',
                placeItems: 'center',
                marginBottom: 16,
                color: cor.acento,
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {i + 1}
            </div>
            <passo.icone size={20} color={cor.acento} style={{ marginBottom: 10 }} />
            <h3 style={{ margin: '0 0 6px', fontSize: 15.5, fontWeight: 700, color: cor.texto }}>{passo.titulo}</h3>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: cor.textoSuave }}>{passo.texto}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
