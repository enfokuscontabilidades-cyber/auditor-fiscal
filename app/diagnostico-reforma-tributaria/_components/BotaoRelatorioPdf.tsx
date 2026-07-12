'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, AlertCircle, RotateCcw, FileText } from 'lucide-react'
import { rastrearEvento } from '@/lib/analytics/track'
import { cor, cardBase, botaoPrimario, raio } from './tokens'

const MENSAGENS = [
  'Preparando seu relatório',
  'Organizando as divergências',
  'Calculando a pontuação',
  'Gerando o documento em PDF',
]

type Estado = 'idle' | 'carregando' | 'sucesso' | 'erro'

interface Props {
  relatorioToken: string | null
}

export default function BotaoRelatorioPdf({ relatorioToken }: Props) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [mensagemIndice, setMensagemIndice] = useState(0)
  const [erro, setErro] = useState('')
  const emAndamento = useRef(false)

  useEffect(() => {
    if (estado !== 'carregando') return
    const id = setInterval(() => setMensagemIndice(i => (i + 1) % MENSAGENS.length), 1100)
    return () => clearInterval(id)
  }, [estado])

  async function baixar() {
    if (emAndamento.current || !relatorioToken) return
    emAndamento.current = true
    setEstado('carregando')
    setMensagemIndice(0)
    setErro('')
    rastrearEvento('reforma_pdf_solicitado')

    try {
      const resposta = await fetch(`/api/diagnostico-reforma-tributaria/relatorio/${relatorioToken}`)
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}))
        throw new Error(typeof dados.error === 'string' ? dados.error : 'Não foi possível gerar o relatório agora.')
      }

      const blob = await resposta.blob()
      const disposicao = resposta.headers.get('Content-Disposition') || ''
      const nomeMatch = disposicao.match(/filename="([^"]+)"/)
      const nomeArquivo = nomeMatch ? nomeMatch[1] : 'diagnostico-ibs-cbs.pdf'

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nomeArquivo
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setEstado('sucesso')
      rastrearEvento('reforma_pdf_gerado')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar o relatório.')
      setEstado('erro')
      rastrearEvento('reforma_pdf_erro')
    } finally {
      emAndamento.current = false
    }
  }

  if (!relatorioToken) return null

  const carregando = estado === 'carregando'

  return (
    <div style={{ ...cardBase, padding: '20px 22px', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: raio.sm, background: 'rgba(39,199,216,0.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <FileText size={18} color={cor.acento} />
          </div>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 14.5, fontWeight: 800, color: cor.texto }}>Relatório técnico completo</p>
            <p style={{ margin: 0, fontSize: 12.5, color: cor.textoSuave, lineHeight: 1.5 }}>
              {carregando
                ? `${MENSAGENS[mensagemIndice]}...`
                : estado === 'sucesso'
                  ? 'Relatório gerado. Você pode baixá-lo novamente quando quiser.'
                  : 'Documento com pontuação, divergências, plano de ação e base legal, pronto para encaminhar ao contador.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={baixar}
          disabled={carregando}
          aria-busy={carregando}
          style={{ ...botaoPrimario, whiteSpace: 'nowrap', opacity: carregando ? 0.75 : 1, cursor: carregando ? 'not-allowed' : 'pointer' }}
        >
          {carregando ? (
            <><Loader2 size={16} className="girando" /> Gerando...</>
          ) : estado === 'sucesso' ? (
            <><RotateCcw size={16} /> Baixar novamente</>
          ) : (
            <><Download size={16} /> Baixar relatório completo em PDF</>
          )}
        </button>
      </div>

      {estado === 'erro' && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: 12.5, color: cor.critico }}>
          <AlertCircle size={13} />
          {erro}
          <button type="button" onClick={baixar} style={{ background: 'none', border: 'none', color: cor.acento, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 12.5 }}>
            Tentar novamente
          </button>
        </p>
      )}
    </div>
  )
}
