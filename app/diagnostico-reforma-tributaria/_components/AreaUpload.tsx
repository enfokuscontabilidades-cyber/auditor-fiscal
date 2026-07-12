'use client'

import { useRef, useState, type DragEvent } from 'react'
import { UploadCloud, FileCode2, X, Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { cor, cardBase, botaoPrimario, raio } from './tokens'

export const MAX_ARQUIVOS = 10
export const MAX_TAMANHO_MB = 5
const MAX_TAMANHO_BYTES = MAX_TAMANHO_MB * 1024 * 1024

interface Props {
  onAnalisar: (arquivos: File[]) => void
  enviando: boolean
  erro?: string
}

export default function AreaUpload({ onAnalisar, enviando, erro }: Props) {
  const [arquivos, setArquivos] = useState<File[]>([])
  const [arrastando, setArrastando] = useState(false)
  const [erroLocal, setErroLocal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function adicionar(lista: FileList | null) {
    if (!lista) return
    setErroLocal('')
    const novos = Array.from(lista)
    const combinados = [...arquivos]

    for (const arquivo of novos) {
      if (combinados.length >= MAX_ARQUIVOS) {
        setErroLocal(`Você pode enviar no máximo ${MAX_ARQUIVOS} arquivos.`)
        break
      }
      if (!/\.xml$/i.test(arquivo.name)) {
        setErroLocal(`"${arquivo.name}" não é um arquivo .xml.`)
        continue
      }
      if (arquivo.size > MAX_TAMANHO_BYTES) {
        setErroLocal(`"${arquivo.name}" excede ${MAX_TAMANHO_MB} MB.`)
        continue
      }
      if (combinados.some(a => a.name === arquivo.name && a.size === arquivo.size)) {
        setErroLocal(`"${arquivo.name}" já foi adicionado.`)
        continue
      }
      combinados.push(arquivo)
    }

    setArquivos(combinados)
  }

  function remover(indice: number) {
    setArquivos(prev => prev.filter((_, i) => i !== indice))
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setArrastando(false)
    adicionar(event.dataTransfer.files)
  }

  return (
    <section id="upload" style={{ padding: '44px 0' }}>
      <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: cor.acento }}>
        Envio do XML
      </p>
      <h2 style={{ margin: '0 0 22px', fontSize: 24, fontWeight: 800, color: cor.texto }}>
        Agora envie os arquivos XML
      </h2>

      <div
        onDragOver={e => { e.preventDefault(); setArrastando(true) }}
        onDragLeave={() => setArrastando(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        role="button"
        tabIndex={0}
        aria-label="Selecionar ou arrastar arquivos XML"
        style={{
          ...cardBase,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          borderStyle: 'dashed',
          borderColor: arrastando ? cor.acento : cor.borda,
          background: arrastando ? cor.acentoSuave : cardBase.background,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          hidden
          onChange={e => { adicionar(e.target.files); e.target.value = '' }}
        />
        <UploadCloud size={30} color={cor.acento} style={{ marginBottom: 12 }} />
        <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: cor.texto }}>
          Arraste os arquivos XML aqui ou toque para selecionar
        </p>
        <p style={{ margin: 0, fontSize: 12.5, color: cor.textoFraco }}>
          Até {MAX_ARQUIVOS} arquivos, {MAX_TAMANHO_MB} MB cada
        </p>
      </div>

      {erroLocal && <p style={erroTexto}><AlertCircle size={13} />{erroLocal}</p>}
      {erro && <p style={erroTexto}><AlertCircle size={13} />{erro}</p>}

      {arquivos.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {arquivos.map((arquivo, i) => (
            <li
              key={`${arquivo.name}-${arquivo.size}-${i}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderRadius: raio.sm, background: 'rgba(255,255,255,0.03)', border: `1px solid ${cor.borda}`,
              }}
            >
              <FileCode2 size={16} color={cor.acento} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: cor.texto, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{arquivo.name}</span>
              <span style={{ fontSize: 11.5, color: cor.textoFraco, flexShrink: 0 }}>{(arquivo.size / 1024).toFixed(0)} KB</span>
              <button
                type="button"
                onClick={() => remover(i)}
                aria-label={`Remover ${arquivo.name}`}
                style={{ background: 'none', border: 'none', color: cor.textoFraco, cursor: 'pointer', padding: 4, display: 'flex' }}
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={arquivos.length === 0 || enviando}
        aria-busy={enviando}
        onClick={() => onAnalisar(arquivos)}
        style={{
          ...botaoPrimario,
          marginTop: 20,
          width: '100%',
          opacity: arquivos.length === 0 || enviando ? 0.55 : 1,
          cursor: arquivos.length === 0 || enviando ? 'not-allowed' : 'pointer',
        }}
      >
        {enviando ? <><Loader2 size={17} className="girando" /> Analisando...</> : <>Analisar {arquivos.length || ''} XML{arquivos.length === 1 ? '' : 's'}<ArrowRight size={17} /></>}
      </button>

      <p style={{ marginTop: 14, fontSize: 12, color: cor.textoFraco, textAlign: 'center' }}>
        O XML é utilizado somente para gerar o diagnóstico e não é armazenado permanentemente.
      </p>
    </section>
  )
}

const erroTexto: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: cor.critico,
  fontSize: 12.5,
  margin: '12px 0 0',
}
