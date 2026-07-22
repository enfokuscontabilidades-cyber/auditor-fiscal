'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Loader2, MessageCircle, Send } from 'lucide-react'
import { emailValido, formatarTelefoneBr, somenteDigitos, telefoneValido } from '@/lib/validacao/documentos'
import { linkWhatsapp } from '@/lib/institucional/enfokusContabilidade'
import { rastrearEvento } from '@/lib/analytics/track'
import type { FinalidadeAcessoAntecipado, PerfilProfissionalAcesso } from '@/lib/types'

const PERFIS: Array<{ value: PerfilProfissionalAcesso; label: string }> = [
  { value: 'contador', label: 'Contador(a)' },
  { value: 'gestor_escritorio', label: 'Sócio(a) ou gestor(a) de escritório contábil' },
  { value: 'profissional_fiscal_tributario', label: 'Profissional fiscal ou tributário' },
  { value: 'auditor_independente', label: 'Auditor(a) independente' },
  { value: 'consultor_tributario', label: 'Consultor(a) tributário(a)' },
  { value: 'outro', label: 'Outro perfil profissional' },
]

const FINALIDADES: Array<{ value: FinalidadeAcessoAntecipado; label: string; descricao: string }> = [
  { value: 'controle_entregas_escritorio', label: 'Controle das entregas do escritório', descricao: 'Prazos, obrigações e acompanhamento da carteira.' },
  { value: 'analises_fiscais_tributarias', label: 'Análises fiscais e tributárias', descricao: 'Cruzamentos, divergências e revisão de operações.' },
  { value: 'auditorias_independentes', label: 'Auditorias independentes', descricao: 'Revisões técnicas e trabalhos para clientes.' },
  { value: 'validacao_sped_xml', label: 'Validação de SPED e XML', descricao: 'Conferência de arquivos e documentos fiscais.' },
  { value: 'simples_nacional', label: 'Simples Nacional', descricao: 'Apuração, confronto de receitas e PGDAS-D.' },
  { value: 'planejamento_tributario', label: 'Planejamento tributário', descricao: 'Comparação de cenários e regimes tributários.' },
  { value: 'gestao_carteira_clientes', label: 'Gestão da carteira de clientes', descricao: 'Visão centralizada das empresas atendidas.' },
  { value: 'outro', label: 'Outra finalidade', descricao: 'Uma necessidade diferente das opções acima.' },
]

type Campos = {
  nome: string
  telefone: string
  email: string
  empresa: string
  cargo: string
  perfil: PerfilProfissionalAcesso | ''
  faixaEmpresas: string
  principalDesafio: string
}

const CAMPOS_INICIAIS: Campos = {
  nome: '', telefone: '', email: '', empresa: '', cargo: '', perfil: '', faixaEmpresas: '', principalDesafio: '',
}

type Erros = Partial<Record<keyof Campos | 'finalidades' | 'consentimento', string>>

export default function FormularioAcessoAntecipado() {
  const [campos, setCampos] = useState<Campos>(CAMPOS_INICIAIS)
  const [finalidades, setFinalidades] = useState<FinalidadeAcessoAntecipado[]>([])
  const [consentimentoDados, setConsentimentoDados] = useState(false)
  const [consentimentoContato, setConsentimentoContato] = useState(false)
  const [armadilha, setArmadilha] = useState('')
  const [erros, setErros] = useState<Erros>({})
  const [erroEnvio, setErroEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [codigoSolicitacao, setCodigoSolicitacao] = useState('')
  const [iniciadoEm] = useState(() => Date.now())
  const rastreouInicio = useRef(false)
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
    rastrearEvento('landing_acesso_pageview')
  }, [])

  function registrarInicio() {
    if (rastreouInicio.current) return
    rastreouInicio.current = true
    rastrearEvento('landing_acesso_formulario_iniciado')
  }

  function atualizar<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    registrarInicio()
    setCampos(anterior => ({ ...anterior, [campo]: valor }))
    setErros(anterior => ({ ...anterior, [campo]: undefined }))
  }

  function alternarFinalidade(finalidade: FinalidadeAcessoAntecipado) {
    registrarInicio()
    setFinalidades(atuais => atuais.includes(finalidade)
      ? atuais.filter(item => item !== finalidade)
      : [...atuais, finalidade])
    setErros(anterior => ({ ...anterior, finalidades: undefined }))
  }

  function validar() {
    const novosErros: Erros = {}
    if (!campos.nome.trim()) novosErros.nome = 'Informe seu nome.'
    if (!telefoneValido(campos.telefone)) novosErros.telefone = 'Informe um WhatsApp válido, com DDD.'
    if (!emailValido(campos.email)) novosErros.email = 'Informe um e-mail válido.'
    if (!campos.perfil) novosErros.perfil = 'Selecione seu perfil profissional.'
    if (finalidades.length === 0) novosErros.finalidades = 'Selecione ao menos uma finalidade.'
    if (!consentimentoDados) novosErros.consentimento = 'Autorize o tratamento dos dados para enviar a solicitação.'
    return novosErros
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando) return

    const novosErros = validar()
    setErros(novosErros)
    setErroEnvio('')
    if (Object.keys(novosErros).length > 0) {
      rastrearEvento('landing_acesso_formulario_erro')
      return
    }

    setEnviando(true)
    try {
      const resposta = await fetch('/api/leads/acesso-antecipado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: campos.nome.trim(),
          telefone: somenteDigitos(campos.telefone),
          email: campos.email.trim(),
          empresa: campos.empresa.trim() || undefined,
          cargo: campos.cargo.trim() || undefined,
          perfil_profissional: campos.perfil,
          finalidades,
          faixa_empresas: campos.faixaEmpresas || undefined,
          principal_desafio: campos.principalDesafio.trim() || undefined,
          consentimento_dados: consentimentoDados,
          consentimento_contato: consentimentoContato,
          origem: 'landing-acesso-antecipado',
          utm_source: utm.current.source || undefined,
          utm_medium: utm.current.medium || undefined,
          utm_campaign: utm.current.campaign || undefined,
          pagina_origem: paginaOrigem.current || undefined,
          website: armadilha,
          formulario_iniciado_em: iniciadoEm,
        }),
      })

      const dados = await resposta.json().catch(() => ({})) as { error?: string; codigoSolicitacao?: string }
      if (!resposta.ok) {
        setErroEnvio(dados.error || 'Não foi possível registrar sua solicitação agora. Tente novamente.')
        rastrearEvento('landing_acesso_formulario_erro')
        return
      }

      setCodigoSolicitacao(dados.codigoSolicitacao || 'Solicitação registrada')
      rastrearEvento('landing_acesso_formulario_concluido')
    } catch {
      setErroEnvio('Falha de conexão. Verifique sua internet e tente novamente.')
      rastrearEvento('landing_acesso_formulario_erro')
    } finally {
      setEnviando(false)
    }
  }

  const whatsapp = linkWhatsapp(`Olá! Enviei uma solicitação de acesso antecipado à plataforma Enfokus${codigoSolicitacao ? `, código ${codigoSolicitacao}` : ''}, e gostaria de tirar uma dúvida.`)

  return (
    <section id="solicitar-acesso" style={S.section}>
      <div style={S.wrap}>
        <div style={S.heading}>
          <span style={S.eyebrow}>Seleção para acesso antecipado</span>
          <h2 style={S.title}>Conte como você pretende testar a plataforma.</h2>
          <p style={S.lead}>
            Buscamos profissionais de contabilidade, auditoria e área tributária dispostos a aplicar a plataforma em
            situações reais e compartilhar feedbacks objetivos sobre o fluxo de trabalho.
          </p>
        </div>

        {codigoSolicitacao ? (
          <div className="la-success" style={S.success} role="status" aria-live="polite">
            <CheckCircle2 size={34} color="#42e28d" />
            <div>
              <h3 style={{ margin: 0, fontSize: 21 }}>Solicitação recebida!</h3>
              <p style={{ margin: '7px 0 0', color: '#a9bdd5' }}>
                Seu código é <strong style={{ color: '#8ee8ff' }}>{codigoSolicitacao}</strong>. Nossa equipe analisará o perfil e entrará em contato pelos dados informados.
              </p>
            </div>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => rastrearEvento('landing_acesso_clique_whatsapp')}
              style={S.whatsappButton}
            >
              <MessageCircle size={16} /> Falar pelo WhatsApp
            </a>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate style={S.form}>
            <div style={S.honeypot} aria-hidden="true">
              <label htmlFor="acesso-website">Não preencha este campo</label>
              <input id="acesso-website" tabIndex={-1} autoComplete="off" value={armadilha} onChange={e => setArmadilha(e.target.value)} />
            </div>

            <div className="la-grid-2" style={S.grid2}>
              <Campo id="acesso-nome" label="Nome completo *" erro={erros.nome}>
                <input id="acesso-nome" value={campos.nome} onChange={e => atualizar('nome', e.target.value)} autoComplete="name" style={inputStyle(!!erros.nome)} />
              </Campo>
              <Campo id="acesso-email" label="E-mail profissional *" erro={erros.email}>
                <input id="acesso-email" type="email" value={campos.email} onChange={e => atualizar('email', e.target.value)} autoComplete="email" style={inputStyle(!!erros.email)} />
              </Campo>
              <Campo id="acesso-telefone" label="WhatsApp *" erro={erros.telefone}>
                <input id="acesso-telefone" value={campos.telefone} onChange={e => atualizar('telefone', formatarTelefoneBr(e.target.value))} inputMode="numeric" maxLength={15} placeholder="(00) 00000-0000" autoComplete="tel" style={inputStyle(!!erros.telefone)} />
              </Campo>
              <Campo id="acesso-perfil" label="Perfil profissional *" erro={erros.perfil}>
                <select id="acesso-perfil" value={campos.perfil} onChange={e => atualizar('perfil', e.target.value as PerfilProfissionalAcesso)} style={inputStyle(!!erros.perfil)}>
                  <option value="">Selecione</option>
                  {PERFIS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Campo>
              <Campo id="acesso-empresa" label="Escritório ou empresa (opcional)">
                <input id="acesso-empresa" value={campos.empresa} onChange={e => atualizar('empresa', e.target.value)} autoComplete="organization" style={inputStyle(false)} />
              </Campo>
              <Campo id="acesso-cargo" label="Cargo ou especialidade (opcional)">
                <input id="acesso-cargo" value={campos.cargo} onChange={e => atualizar('cargo', e.target.value)} style={inputStyle(false)} />
              </Campo>
            </div>

            <fieldset style={S.fieldset}>
              <legend style={S.legend}>Para qual finalidade deseja testar a plataforma? *</legend>
              <p style={S.help}>Você pode selecionar mais de uma opção.</p>
              <div className="la-purpose-grid" style={S.purposeGrid}>
                {FINALIDADES.map(item => {
                  const selecionada = finalidades.includes(item.value)
                  return (
                    <label key={item.value} style={{ ...S.purpose, ...(selecionada ? S.purposeActive : {}) }}>
                      <input type="checkbox" checked={selecionada} onChange={() => alternarFinalidade(item.value)} />
                      <span>
                        <strong style={{ display: 'block', color: '#f7fbff', fontSize: 13.5 }}>{item.label}</strong>
                        <small style={{ display: 'block', marginTop: 3, color: '#90a9c5', lineHeight: 1.35 }}>{item.descricao}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
              {erros.finalidades && <Erro>{erros.finalidades}</Erro>}
            </fieldset>

            <div className="la-grid-2" style={{ ...S.grid2, marginTop: 20 }}>
              <Campo id="acesso-faixa" label="Quantas empresas ou clientes você acompanha? (opcional)">
                <select id="acesso-faixa" value={campos.faixaEmpresas} onChange={e => atualizar('faixaEmpresas', e.target.value)} style={inputStyle(false)}>
                  <option value="">Selecione</option>
                  <option value="atuacao_individual">Atuação individual ou projetos pontuais</option>
                  <option value="1_20">De 1 a 20 empresas</option>
                  <option value="21_50">De 21 a 50 empresas</option>
                  <option value="51_100">De 51 a 100 empresas</option>
                  <option value="mais_100">Mais de 100 empresas</option>
                </select>
              </Campo>
              <Campo id="acesso-desafio" label="Qual é hoje seu principal desafio? (opcional)">
                <textarea id="acesso-desafio" value={campos.principalDesafio} onChange={e => atualizar('principalDesafio', e.target.value)} rows={4} maxLength={2000} style={{ ...inputStyle(false), resize: 'vertical' }} />
              </Campo>
            </div>

            <div style={S.consents}>
              <label style={S.consentLabel}>
                <input type="checkbox" checked={consentimentoDados} onChange={e => { registrarInicio(); setConsentimentoDados(e.target.checked); setErros(atual => ({ ...atual, consentimento: undefined })) }} />
                <span>Li a <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={S.link}>Política de Privacidade</a> e autorizo o tratamento dos dados para análise e retorno sobre minha solicitação de acesso antecipado. *</span>
              </label>
              {erros.consentimento && <Erro>{erros.consentimento}</Erro>}
              <label style={S.consentLabel}>
                <input type="checkbox" checked={consentimentoContato} onChange={e => { registrarInicio(); setConsentimentoContato(e.target.checked) }} />
                <span>Também autorizo o envio de novidades, convites para testes e informações comerciais da plataforma.</span>
              </label>
            </div>

            {erroEnvio && <Erro>{erroEnvio}</Erro>}

            <button type="submit" disabled={enviando} aria-busy={enviando} style={{ ...S.submit, opacity: enviando ? .72 : 1 }}>
              {enviando ? <><Loader2 size={17} className="la-spin" /> Enviando solicitação...</> : <><Send size={17} /> Solicitar acesso antecipado</>}
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes la-spin { to { transform: rotate(360deg); } }
        .la-spin { animation: la-spin .85s linear infinite; }
        @media (max-width: 760px) {
          .la-grid-2, .la-purpose-grid { grid-template-columns: 1fr !important; }
          .la-success { grid-template-columns: 1fr !important; }
          .la-success a { width: 100%; }
        }
      `}</style>
    </section>
  )
}

function Campo({ id, label, erro, children }: { id: string; label: string; erro?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={S.label}>{label}</label>
      {children}
      {erro && <Erro>{erro}</Erro>}
    </div>
  )
}

function Erro({ children }: { children: React.ReactNode }) {
  return <p role="alert" style={S.error}><AlertCircle size={13} /> {children}</p>
}

function inputStyle(comErro: boolean): React.CSSProperties {
  return {
    width: '100%', minHeight: 44, padding: '11px 13px', borderRadius: 9,
    border: `1px solid ${comErro ? '#fb7185' : '#315779'}`,
    background: '#091a2d', color: '#f7fbff', fontSize: 14, outline: 'none', colorScheme: 'dark',
  }
}

const S: Record<string, React.CSSProperties> = {
  section: { padding: '78px 0', background: 'linear-gradient(180deg, rgba(18,39,65,.72), rgba(6,19,35,.94))', borderTop: '1px solid rgba(169,189,213,.12)', borderBottom: '1px solid rgba(169,189,213,.12)' },
  wrap: { width: 'min(980px, calc(100% - 40px))', margin: '0 auto' },
  heading: { maxWidth: 760, marginBottom: 28 },
  eyebrow: { display: 'inline-flex', color: '#8ee8ff', border: '1px solid rgba(45,199,239,.38)', background: 'rgba(45,199,239,.08)', padding: '7px 10px', borderRadius: 99, fontSize: 12, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' },
  title: { margin: '13px 0 10px', fontSize: 34, lineHeight: 1.12, letterSpacing: '-.03em', color: '#f7fbff' },
  lead: { margin: 0, color: '#a9bdd5', fontSize: 16, lineHeight: 1.65 },
  form: { position: 'relative', padding: 26, borderRadius: 18, border: '1px solid #294463', background: 'rgba(10,27,47,.92)', boxShadow: '0 26px 70px rgba(0,0,0,.24)' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 16 },
  label: { display: 'block', marginBottom: 6, color: '#d9e6f4', fontSize: 12.5, fontWeight: 700 },
  fieldset: { margin: '24px 0 0', padding: 0, border: 0 },
  legend: { color: '#f7fbff', fontSize: 15, fontWeight: 800 },
  help: { margin: '4px 0 12px', color: '#90a9c5', fontSize: 12.5 },
  purposeGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 },
  purpose: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: 13, borderRadius: 11, border: '1px solid #294463', background: 'rgba(255,255,255,.025)', cursor: 'pointer' },
  purposeActive: { borderColor: '#2dc7ef', background: 'rgba(45,199,239,.09)', boxShadow: '0 0 0 1px rgba(45,199,239,.14) inset' },
  consents: { display: 'grid', gap: 11, marginTop: 22 },
  consentLabel: { display: 'flex', alignItems: 'flex-start', gap: 10, color: '#a9bdd5', fontSize: 12.5, lineHeight: 1.55, cursor: 'pointer' },
  link: { color: '#8ee8ff', fontWeight: 700 },
  error: { display: 'flex', alignItems: 'center', gap: 5, margin: '7px 0 0', color: '#fb7185', fontSize: 12 },
  submit: { width: '100%', marginTop: 22, minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, borderRadius: 10, background: '#2dc7ef', color: '#02111f', fontSize: 14, fontWeight: 900, cursor: 'pointer' },
  success: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 16, padding: 24, borderRadius: 18, border: '1px solid rgba(66,226,141,.38)', background: 'rgba(15,50,49,.72)' },
  whatsappButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 15px', borderRadius: 9, background: '#22c55e', color: '#031b0c', fontSize: 13, fontWeight: 900, textDecoration: 'none' },
  honeypot: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' },
}
