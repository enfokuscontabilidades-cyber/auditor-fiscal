'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { rastrearEvento } from '@/lib/analytics/track'
import CabecalhoPublico from './CabecalhoPublico'
import HeroDiagnostico from './HeroDiagnostico'
import ComoFunciona from './ComoFunciona'
import OQueAnalisamos from './OQueAnalisamos'
import FormularioDiagnostico from './FormularioDiagnostico'
import AreaUpload from './AreaUpload'
import PainelProcessamento from './PainelProcessamento'
import PainelResultado, { type ResultadoArquivo, type ResumoAnalise } from './PainelResultado'
import ChamadaComercial from './ChamadaComercial'
import RodapePublico from './RodapePublico'
import { cor, cardBase, container } from './tokens'

type Etapa = 'formulario' | 'upload' | 'processando' | 'resultado'

export default function PaginaDiagnostico() {
  const [etapa, setEtapa] = useState<Etapa>('formulario')
  const [leadId, setLeadId] = useState('')
  const [codigoDiagnostico, setCodigoDiagnostico] = useState('')
  const [erroAnalise, setErroAnalise] = useState('')
  const [resultados, setResultados] = useState<ResultadoArquivo[]>([])
  const [resumo, setResumo] = useState<ResumoAnalise>({ totalAnalisado: 0, adequado: 0, atencao: 0, critico: 0 })
  const [relatorioToken, setRelatorioToken] = useState<string | null>(null)
  const scrollAlvo = useRef<Etapa | null>(null)

  useEffect(() => {
    if (!scrollAlvo.current) return
    const id = scrollAlvo.current === 'upload' ? 'upload' : scrollAlvo.current === 'resultado' ? 'resultado' : null
    scrollAlvo.current = null
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [etapa])

  function handleSucessoFormulario(idLead: string, codigo: string) {
    setLeadId(idLead)
    setCodigoDiagnostico(codigo)
    setEtapa('upload')
    scrollAlvo.current = 'upload'
  }

  async function handleAnalisar(arquivos: File[]) {
    setErroAnalise('')
    setEtapa('processando')
    rastrearEvento('reforma_upload_iniciado')

    try {
      const formData = new FormData()
      arquivos.forEach(arquivo => formData.append('arquivos', arquivo))
      if (leadId) formData.append('leadId', leadId)

      const resposta = await fetch('/api/diagnostico-reforma-tributaria/analisar', { method: 'POST', body: formData })
      const dados = await resposta.json().catch(() => ({}))

      if (!resposta.ok) {
        setErroAnalise(typeof dados.error === 'string' ? dados.error : 'Não foi possível analisar os arquivos agora.')
        rastrearEvento('reforma_upload_erro')
        setEtapa('upload')
        return
      }

      const novoResumo: ResumoAnalise = dados.resumo
      setResultados(dados.resultados || [])
      setResumo(novoResumo)
      setRelatorioToken(typeof dados.relatorioToken === 'string' ? dados.relatorioToken : null)
      rastrearEvento('reforma_xml_analisado', { total: novoResumo.totalAnalisado })
      if (novoResumo.critico > 0) rastrearEvento('reforma_resultado_critico')
      else if (novoResumo.atencao > 0) rastrearEvento('reforma_resultado_atencao')
      else rastrearEvento('reforma_resultado_positivo')

      if (leadId) {
        fetch('/api/leads/reforma-tributaria', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: leadId, quantidade_xmls: novoResumo.totalAnalisado, resumo: novoResumo }),
        }).catch(() => null)
      }

      setEtapa('resultado')
      scrollAlvo.current = 'resultado'
    } catch {
      setErroAnalise('Falha de conexão durante a análise. Tente novamente.')
      rastrearEvento('reforma_upload_erro')
      setEtapa('upload')
    }
  }

  function handleNovaAnalise() {
    rastrearEvento('reforma_nova_analise')
    setResultados([])
    setRelatorioToken(null)
    setErroAnalise('')
    setEtapa('upload')
    scrollAlvo.current = 'upload'
  }

  return (
    <main style={{ minHeight: '100vh', background: cor.fundoDegrade, color: cor.texto, fontFamily: 'inherit' }}>
      <CabecalhoPublico />

      <div style={container}>
        <HeroDiagnostico onComecar={() => document.getElementById('formulario')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        <ComoFunciona />
        <OQueAnalisamos />

        {etapa === 'formulario' ? (
          <FormularioDiagnostico onSucesso={handleSucessoFormulario} />
        ) : (
          <section style={{ padding: '30px 0 0' }}>
            <div style={{ ...cardBase, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={18} color={cor.sucesso} />
              <span style={{ fontSize: 13.5, color: cor.textoSuave }}>Dados confirmados. Código do diagnóstico: <strong style={{ color: cor.texto }}>{codigoDiagnostico}</strong></span>
            </div>
          </section>
        )}

        {etapa === 'upload' && <AreaUpload onAnalisar={handleAnalisar} enviando={false} erro={erroAnalise} />}
        {etapa === 'processando' && <PainelProcessamento />}
        {etapa === 'resultado' && (
          <>
            <PainelResultado resultados={resultados} resumo={resumo} codigoDiagnostico={codigoDiagnostico} relatorioToken={relatorioToken} onNovaAnalise={handleNovaAnalise} />
            <ChamadaComercial codigoDiagnostico={codigoDiagnostico} />
          </>
        )}
      </div>

      <RodapePublico />

      <style>{`
        @keyframes girar { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .girando { animation: girar 0.9s linear infinite; }

        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .grid-2-responsivo, .grid-3-responsivo, .grid-4-responsivo { grid-template-columns: 1fr !important; }
          .cab-link-oculta-mobile { display: none !important; }
        }
      `}</style>
    </main>
  )
}
