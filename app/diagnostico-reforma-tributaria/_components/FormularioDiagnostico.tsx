'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, ArrowRight, AlertCircle } from 'lucide-react'
import {
  validarCnpj, formatarCnpj, formatarTelefoneBr, telefoneValido, emailValido, somenteDigitos,
} from '@/lib/validacao/documentos'
import { rastrearEvento } from '@/lib/analytics/track'
import { cor, cardBase, botaoPrimario, raio } from './tokens'

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Outros', 'Não sei informar']

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

type CamposForm = {
  nome: string
  empresa: string
  cnpj: string
  telefone: string
  email: string
  regime: string
  estado: string
  cidade: string
  sistemaEmissor: string
}

const FORM_INICIAL: CamposForm = {
  nome: '', empresa: '', cnpj: '', telefone: '', email: '', regime: '', estado: '', cidade: '', sistemaEmissor: '',
}

type ErrosForm = Partial<Record<keyof CamposForm, string>>

interface Props {
  onSucesso: (leadId: string, codigoDiagnostico: string) => void
}

export default function FormularioDiagnostico({ onSucesso }: Props) {
  const [campos, setCampos] = useState<CamposForm>(FORM_INICIAL)
  const [erros, setErros] = useState<ErrosForm>({})
  const [consentDados, setConsentDados] = useState(false)
  const [consentContato, setConsentContato] = useState(false)
  const [erroConsentimento, setErroConsentimento] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')
  const [armadilha, setArmadilha] = useState('')

  const [iniciadoEm] = useState(() => Date.now())
  const jaRastreouInicio = useRef(false)
  const utm = useRef({ source: '', medium: '', campaign: '' })
  const paginaOrigem = useRef('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    utm.current = {
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
    }
    paginaOrigem.current = window.location.href
    rastrearEvento('reforma_pageview')
  }, [])

  function atualizar<K extends keyof CamposForm>(campo: K, valor: string) {
    if (!jaRastreouInicio.current) {
      jaRastreouInicio.current = true
      rastrearEvento('reforma_formulario_iniciado')
    }
    setCampos(prev => ({ ...prev, [campo]: valor }))
    setErros(prev => ({ ...prev, [campo]: undefined }))
  }

  function validar(): ErrosForm {
    const novosErros: ErrosForm = {}
    if (!campos.nome.trim()) novosErros.nome = 'Informe seu nome.'
    if (!campos.empresa.trim()) novosErros.empresa = 'Informe o nome da empresa.'
    if (!validarCnpj(campos.cnpj)) novosErros.cnpj = 'CNPJ inválido.'
    if (!telefoneValido(campos.telefone)) novosErros.telefone = 'WhatsApp inválido, informe o DDD.'
    if (!emailValido(campos.email)) novosErros.email = 'E-mail inválido.'
    if (!campos.regime) novosErros.regime = 'Selecione o regime tributário.'
    if (!campos.estado) novosErros.estado = 'Selecione o estado.'
    if (!campos.cidade.trim()) novosErros.cidade = 'Informe a cidade.'
    return novosErros
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando) return

    const novosErros = validar()
    setErros(novosErros)
    setErroConsentimento(consentDados ? '' : 'É necessário autorizar o tratamento dos dados para liberar o diagnóstico.')
    setErroEnvio('')

    if (Object.keys(novosErros).length > 0 || !consentDados) {
      rastrearEvento('reforma_formulario_erro')
      return
    }

    setEnviando(true)
    try {
      const resposta = await fetch('/api/leads/reforma-tributaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: campos.nome.trim(),
          telefone: somenteDigitos(campos.telefone),
          email: campos.email.trim(),
          empresa: campos.empresa.trim(),
          cnpj: somenteDigitos(campos.cnpj),
          regime_tributario: campos.regime,
          estado: campos.estado,
          cidade: campos.cidade.trim(),
          sistema_emissor: campos.sistemaEmissor.trim() || undefined,
          consentimento_dados: consentDados,
          consentimento_contato: consentContato,
          origem: 'diagnostico-reforma-tributaria',
          utm_source: utm.current.source || undefined,
          utm_medium: utm.current.medium || undefined,
          utm_campaign: utm.current.campaign || undefined,
          pagina_origem: paginaOrigem.current || undefined,
          website: armadilha,
          formulario_iniciado_em: iniciadoEm,
        }),
      })

      const dados = await resposta.json().catch(() => ({}))

      if (!resposta.ok) {
        setErroEnvio(typeof dados.error === 'string' ? dados.error : 'Não foi possível liberar o diagnóstico agora. Tente novamente.')
        rastrearEvento('reforma_formulario_erro')
        return
      }

      rastrearEvento('reforma_formulario_concluido')
      rastrearEvento('reforma_lead_gravado')
      onSucesso(dados.leadId, dados.codigoDiagnostico)
    } catch {
      setErroEnvio('Falha de conexão. Verifique sua internet e tente novamente.')
      rastrearEvento('reforma_formulario_erro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section id="formulario" style={{ padding: '44px 0' }}>
      <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: cor.acento }}>
        Seus dados
      </p>
      <h2 style={{ margin: '0 0 22px', fontSize: 24, fontWeight: 800, color: cor.texto }}>
        Preencha para liberar o diagnóstico gratuito
      </h2>

      <form onSubmit={enviar} noValidate style={{ ...cardBase, padding: 26 }}>
        {/* Honeypot: invisível para humanos, apenas robôs preenchem */}
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }} aria-hidden="true">
          <label htmlFor="website">Não preencha este campo</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={armadilha} onChange={e => setArmadilha(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 16 }} className="grid-2-responsivo">
          <Campo id="nome" label="Nome *" erro={erros.nome}>
            <input id="nome" style={inputEstilo(!!erros.nome)} value={campos.nome} onChange={e => atualizar('nome', e.target.value)} autoComplete="name" />
          </Campo>
          <Campo id="empresa" label="Nome da empresa *" erro={erros.empresa}>
            <input id="empresa" style={inputEstilo(!!erros.empresa)} value={campos.empresa} onChange={e => atualizar('empresa', e.target.value)} autoComplete="organization" />
          </Campo>
          <Campo id="cnpj" label="CNPJ *" erro={erros.cnpj}>
            <input id="cnpj" style={inputEstilo(!!erros.cnpj)} value={campos.cnpj} onChange={e => atualizar('cnpj', formatarCnpj(e.target.value))} inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" />
          </Campo>
          <Campo id="telefone" label="WhatsApp *" erro={erros.telefone}>
            <input id="telefone" style={inputEstilo(!!erros.telefone)} value={campos.telefone} onChange={e => atualizar('telefone', formatarTelefoneBr(e.target.value))} inputMode="numeric" maxLength={15} placeholder="(00) 00000-0000" autoComplete="tel" />
          </Campo>
          <Campo id="email" label="E-mail *" erro={erros.email}>
            <input id="email" type="email" style={inputEstilo(!!erros.email)} value={campos.email} onChange={e => atualizar('email', e.target.value)} autoComplete="email" />
          </Campo>
          <Campo id="regime" label="Regime tributário *" erro={erros.regime}>
            <select id="regime" style={inputEstilo(!!erros.regime)} value={campos.regime} onChange={e => atualizar('regime', e.target.value)}>
              <option value="" style={optionEstilo}>Selecione</option>
              {REGIMES.map(r => <option key={r} value={r} style={optionEstilo}>{r}</option>)}
            </select>
          </Campo>
          <Campo id="estado" label="Estado *" erro={erros.estado}>
            <select id="estado" style={inputEstilo(!!erros.estado)} value={campos.estado} onChange={e => atualizar('estado', e.target.value)}>
              <option value="" style={optionEstilo}>Selecione</option>
              {UFS.map(uf => <option key={uf} value={uf} style={optionEstilo}>{uf}</option>)}
            </select>
          </Campo>
          <Campo id="cidade" label="Cidade *" erro={erros.cidade}>
            <input id="cidade" style={inputEstilo(!!erros.cidade)} value={campos.cidade} onChange={e => atualizar('cidade', e.target.value)} autoComplete="address-level2" />
          </Campo>
          <div style={{ gridColumn: '1 / -1' }}>
            <Campo id="sistemaEmissor" label="Sistema utilizado para emissão de notas (opcional)">
              <input id="sistemaEmissor" style={inputEstilo(false)} value={campos.sistemaEmissor} onChange={e => atualizar('sistemaEmissor', e.target.value)} placeholder="Ex.: Bling, Omie, Tiny, ERP próprio..." />
            </Campo>
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={consentLabel}>
            <input type="checkbox" checked={consentDados} onChange={e => { setConsentDados(e.target.checked); setErroConsentimento('') }} style={{ marginTop: 2 }} />
            <span>Declaro que li a <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: cor.acento }}>Política de Privacidade</a> e autorizo o tratamento dos dados informados para a realização do diagnóstico solicitado.</span>
          </label>
          {erroConsentimento && <p style={erroTexto}><AlertCircle size={13} />{erroConsentimento}</p>}

          <label style={consentLabel}>
            <input type="checkbox" checked={consentContato} onChange={e => setConsentContato(e.target.checked)} style={{ marginTop: 2 }} />
            <span>Autorizo a Enfokus Contabilidade a entrar em contato comigo por WhatsApp, telefone ou e-mail para apresentar orientações e serviços relacionados à adequação tributária.</span>
          </label>
        </div>

        {erroEnvio && <p style={{ ...erroTexto, marginTop: 16 }}><AlertCircle size={13} />{erroEnvio}</p>}

        <button type="submit" disabled={enviando} aria-busy={enviando} style={{ ...botaoPrimario, marginTop: 22, width: '100%', opacity: enviando ? 0.75 : 1, cursor: enviando ? 'not-allowed' : 'pointer' }}>
          {enviando ? <><Loader2 size={17} className="girando" /> Enviando...</> : <>Continuar para o upload<ArrowRight size={17} /></>}
        </button>
      </form>
    </section>
  )
}

function Campo({ id, label, erro, children }: { id: string; label: string; erro?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: cor.textoSuave, marginBottom: 6 }}>{label}</label>
      {children}
      {erro && <p id={`${id}-erro`} style={erroTexto} role="alert"><AlertCircle size={12} />{erro}</p>}
    </div>
  )
}

function inputEstilo(comErro: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '11px 13px',
    borderRadius: raio.sm,
    background: 'rgba(255,255,255,0.03)',
    border: `1px solid ${comErro ? cor.critico : cor.borda}`,
    color: cor.texto,
    fontSize: 14,
    outline: 'none',
  }
}

const consentLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: 12.5,
  lineHeight: 1.5,
  color: cor.textoSuave,
  cursor: 'pointer',
}

const optionEstilo: React.CSSProperties = {
  background: '#ffffff',
  color: '#0f172a',
}

const erroTexto: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: cor.critico,
  fontSize: 12,
  margin: '6px 0 0',
}
