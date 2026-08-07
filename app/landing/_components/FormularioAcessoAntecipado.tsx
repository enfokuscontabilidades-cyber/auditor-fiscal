'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react'
import { emailValido, formatarTelefoneBr, somenteDigitos, telefoneValido } from '@/lib/validacao/documentos'
import { rastrearEvento } from '@/lib/analytics/track'
import type { FinalidadeAcessoAntecipado, PerfilProfissionalAcesso } from '@/lib/types'

const PERFIS: Array<{ value: PerfilProfissionalAcesso; label: string }> = [
  { value: 'contador', label: 'Contador(a)' },
  { value: 'consultor_tributario', label: 'Consultor(a) tributário(a)' },
  { value: 'auditor_independente', label: 'Auditor(a)' },
  { value: 'profissional_fiscal_tributario', label: 'Analista fiscal' },
  { value: 'gestor_escritorio', label: 'Proprietário(a)/sócio(a) de escritório contábil' },
  { value: 'outro', label: 'Outro' },
]

const TRABALHOS: Array<{ value: FinalidadeAcessoAntecipado; label: string }> = [
  { value: 'conferencia_fechamento_fiscal', label: 'Conferência de fechamento fiscal' },
  { value: 'auditorias_independentes', label: 'Auditoria fiscal' },
  { value: 'consultoria_tributaria', label: 'Consultoria tributária' },
  { value: 'planejamento_tributario', label: 'Planejamento tributário' },
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'recuperacao_tributaria', label: 'Recuperação tributária' },
  { value: 'validacao_sped_xml', label: 'Revisão de SPED/XML' },
  { value: 'gestao_revisao_equipe', label: 'Gestão/revisão do trabalho da equipe' },
  { value: 'outro', label: 'Outro' },
]

type Campos = {
  nome: string
  telefone: string
  email: string
  perfil: PerfilProfissionalAcesso | ''
  principalDesafio: string
  casoReal: '' | 'sim' | 'ainda_nao' | 'preciso_ajuda'
  tamanhoEquipe: string
}

const CAMPOS_INICIAIS: Campos = {
  nome: '', telefone: '', email: '', perfil: '', principalDesafio: '', casoReal: '', tamanhoEquipe: '',
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
    utm.current = { source: params.get('utm_source') || '', medium: params.get('utm_medium') || '', campaign: params.get('utm_campaign') || '' }
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
    setFinalidades(atuais => atuais.includes(finalidade) ? atuais.filter(item => item !== finalidade) : [...atuais, finalidade])
    setErros(anterior => ({ ...anterior, finalidades: undefined }))
  }

  function validar() {
    const novosErros: Erros = {}
    if (!campos.nome.trim()) novosErros.nome = 'Informe seu nome.'
    if (!telefoneValido(campos.telefone)) novosErros.telefone = 'Informe um WhatsApp válido, com DDD.'
    if (!emailValido(campos.email)) novosErros.email = 'Informe um e-mail válido.'
    if (!campos.perfil) novosErros.perfil = 'Selecione seu perfil profissional.'
    if (finalidades.length === 0) novosErros.finalidades = 'Selecione ao menos um tipo de trabalho.'
    if (!campos.principalDesafio.trim()) novosErros.principalDesafio = 'Conte qual etapa mais consome seu tempo.'
    if (!campos.casoReal) novosErros.casoReal = 'Selecione uma opção.'
    if (!consentimentoDados) novosErros.consentimento = 'Autorize o tratamento dos dados para enviar a solicitação.'
    return novosErros
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando) return
    const novosErros = validar()
    setErros(novosErros)
    setErroEnvio('')
    if (Object.keys(novosErros).length) { rastrearEvento('landing_acesso_formulario_erro'); return }
    setEnviando(true)
    try {
      const resposta = await fetch('/api/leads/acesso-antecipado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: campos.nome.trim(), telefone: somenteDigitos(campos.telefone), email: campos.email.trim(),
          perfil_profissional: campos.perfil, finalidades, principal_desafio: campos.principalDesafio.trim(),
          caso_real_teste: campos.casoReal, tamanho_equipe: campos.tamanhoEquipe || undefined,
          consentimento_dados: consentimentoDados, consentimento_contato: consentimentoContato,
          origem: 'landing-acesso-antecipado', utm_source: utm.current.source || undefined,
          utm_medium: utm.current.medium || undefined, utm_campaign: utm.current.campaign || undefined,
          pagina_origem: paginaOrigem.current || undefined, website: armadilha, formulario_iniciado_em: iniciadoEm,
        }),
      })
      const dados = await resposta.json().catch(() => ({})) as { error?: string; codigoSolicitacao?: string }
      if (!resposta.ok) { setErroEnvio(dados.error || 'Não foi possível registrar sua solicitação agora. Tente novamente.'); rastrearEvento('landing_acesso_formulario_erro'); return }
      setCodigoSolicitacao(dados.codigoSolicitacao || 'Solicitação registrada')
      rastrearEvento('landing_acesso_formulario_concluido')
    } catch {
      setErroEnvio('Falha de conexão. Verifique sua internet e tente novamente.')
      rastrearEvento('landing_acesso_formulario_erro')
    } finally { setEnviando(false) }
  }

  return (
    <section id="solicitar-acesso" style={S.section}>
      <div style={S.wrap}>
        <div style={S.heading}>
          <span style={S.eyebrow}>Teste acompanhado por 7 dias</span>
          <h2 style={S.title}>Conte um pouco sobre a sua rotina.</h2>
          <p style={S.lead}>Suas respostas nos ajudam a entender seu trabalho e definir um caso real para você testar no Enfokus.</p>
        </div>
        {codigoSolicitacao ? (
          <div className="la-success" style={S.success} role="status" aria-live="polite">
            <CheckCircle2 size={36} color="#42e28d" />
            <div>
              <h3 style={{ margin: 0, fontSize: 21 }}>Solicitação recebida!</h3>
              <p style={{ margin: '7px 0 0', color: '#a9bdd5' }}>Nossa equipe vai analisar suas respostas e entrar em contato pelo WhatsApp para entender rapidamente sua rotina e definir o melhor caso para você testar no Enfokus.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate style={S.form}>
            <div style={S.honeypot} aria-hidden="true"><label htmlFor="acesso-website">Não preencha</label><input id="acesso-website" tabIndex={-1} autoComplete="off" value={armadilha} onChange={e => setArmadilha(e.target.value)} /></div>
            <div className="la-grid-2" style={S.grid2}>
              <Campo id="acesso-nome" label="Nome completo *" erro={erros.nome}><input id="acesso-nome" value={campos.nome} onChange={e => atualizar('nome', e.target.value)} autoComplete="name" style={inputStyle(!!erros.nome)} /></Campo>
              <Campo id="acesso-email" label="E-mail *" erro={erros.email}><input id="acesso-email" type="email" value={campos.email} onChange={e => atualizar('email', e.target.value)} autoComplete="email" style={inputStyle(!!erros.email)} /></Campo>
              <Campo id="acesso-telefone" label="WhatsApp *" erro={erros.telefone}><input id="acesso-telefone" value={campos.telefone} onChange={e => atualizar('telefone', formatarTelefoneBr(e.target.value))} inputMode="numeric" maxLength={15} placeholder="(00) 00000-0000" autoComplete="tel" style={inputStyle(!!erros.telefone)} /></Campo>
              <Campo id="acesso-perfil" label="Perfil profissional *" erro={erros.perfil}><select id="acesso-perfil" value={campos.perfil} onChange={e => atualizar('perfil', e.target.value as PerfilProfissionalAcesso)} style={inputStyle(!!erros.perfil)}><option value="">Selecione</option>{PERFIS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Campo>
            </div>
            <fieldset style={S.fieldset}>
              <legend style={S.legend}>Hoje, qual tipo de trabalho você mais realiza na área fiscal ou tributária? *</legend>
              <p style={S.help}>Você pode selecionar mais de uma opção.</p>
              <div className="la-purpose-grid" style={S.purposeGrid}>{TRABALHOS.map(item => { const ativa = finalidades.includes(item.value); return <label key={item.value} style={{ ...S.purpose, ...(ativa ? S.purposeActive : {}) }}><input type="checkbox" checked={ativa} onChange={() => alternarFinalidade(item.value)} /><strong>{item.label}</strong></label> })}</div>
              {erros.finalidades && <Erro>{erros.finalidades}</Erro>}
            </fieldset>
            <div style={{ marginTop: 22 }}><Campo id="acesso-desafio" label="Qual parte desse trabalho mais consome seu tempo atualmente? *" erro={erros.principalDesafio}><textarea id="acesso-desafio" value={campos.principalDesafio} onChange={e => atualizar('principalDesafio', e.target.value)} rows={4} maxLength={2000} placeholder="Ex.: cruzar SPED, planilhar XML, conferir PGDAS, revisar CFOP, consolidar informações..." style={{ ...inputStyle(!!erros.principalDesafio), height: 'auto', minHeight: 96, resize: 'vertical' }} /></Campo></div>
            <div className="la-grid-2" style={{ ...S.grid2, marginTop: 18 }}>
              <Campo id="acesso-caso" label="Possui um cliente ou caso real para utilizar nos 7 dias? *" erro={erros.casoReal}><select id="acesso-caso" value={campos.casoReal} onChange={e => atualizar('casoReal', e.target.value as Campos['casoReal'])} style={inputStyle(!!erros.casoReal)}><option value="">Selecione</option><option value="sim">Sim</option><option value="ainda_nao">Ainda não</option><option value="preciso_ajuda">Preciso de ajuda para escolher</option></select></Campo>
              <Campo id="acesso-equipe" label="Você realiza essas análises sozinho ou com uma equipe? (opcional)"><select id="acesso-equipe" value={campos.tamanhoEquipe} onChange={e => atualizar('tamanhoEquipe', e.target.value)} style={inputStyle(false)}><option value="">Selecione</option><option value="sozinho">Sozinho</option><option value="2_5">Equipe de 2 a 5 pessoas</option><option value="6_10">Equipe de 6 a 10 pessoas</option><option value="mais_10">Mais de 10 pessoas</option></select></Campo>
            </div>
            <div style={S.consents}>
              <label style={S.consentLabel}><input type="checkbox" checked={consentimentoDados} onChange={e => { registrarInicio(); setConsentimentoDados(e.target.checked); setErros(a => ({ ...a, consentimento: undefined })) }} /><span>Li a <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={S.link}>Política de Privacidade</a> e autorizo o tratamento dos dados para análise e retorno sobre minha solicitação. *</span></label>
              {erros.consentimento && <Erro>{erros.consentimento}</Erro>}
              <label style={S.consentLabel}><input type="checkbox" checked={consentimentoContato} onChange={e => { registrarInicio(); setConsentimentoContato(e.target.checked) }} /><span>Também autorizo o envio de novidades e informações comerciais da plataforma.</span></label>
            </div>
            {erroEnvio && <Erro>{erroEnvio}</Erro>}
            <button type="submit" disabled={enviando} aria-busy={enviando} style={{ ...S.submit, opacity: enviando ? .72 : 1 }}>{enviando ? <><Loader2 size={17} className="la-spin" /> Enviando solicitação...</> : <><Send size={17} /> Solicitar meus 7 dias de teste</>}</button>
          </form>
        )}
      </div>
      <style>{`@keyframes la-spin{to{transform:rotate(360deg)}}.la-spin{animation:la-spin .85s linear infinite}@media(max-width:760px){.la-grid-2,.la-purpose-grid{grid-template-columns:1fr!important}.la-success{grid-template-columns:1fr!important}}`}</style>
    </section>
  )
}

function Campo({ id, label, erro, children }: { id: string; label: string; erro?: string; children: React.ReactNode }) { return <div><label htmlFor={id} style={S.label}>{label}</label>{children}{erro && <Erro>{erro}</Erro>}</div> }
function Erro({ children }: { children: React.ReactNode }) { return <p role="alert" style={S.error}><AlertCircle size={13} /> {children}</p> }
function inputStyle(comErro: boolean): React.CSSProperties { return { width: '100%', height: 46, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: `1px solid ${comErro ? '#e0526b' : '#b9cbdc'}`, background: '#ffffff', color: '#10263d', fontSize: 14, outline: 'none', colorScheme: 'light' } }

const S: Record<string, React.CSSProperties> = {
  section: { padding: '56px 0', background: 'linear-gradient(180deg,#edf5fa,#f7fafc)', borderTop: '1px solid #dce7ef', borderBottom: '1px solid #dce7ef' }, wrap: { width: 'min(1180px, calc(100% - 40px))', margin: '0 auto' }, heading: { maxWidth: 800, marginBottom: 24 }, eyebrow: { display: 'inline-flex', color: '#087fa3', border: '1px solid rgba(16,169,209,.34)', background: 'rgba(16,169,209,.08)', padding: '6px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '.055em', textTransform: 'uppercase' }, title: { margin: '14px 0 10px', fontFamily: '"Segoe UI Variable Display", "Segoe UI", Arial, sans-serif', fontWeight: 500, fontSize: 32, lineHeight: 1.18, letterSpacing: '-.025em', color: '#10263d' }, lead: { margin: 0, color: '#526a82', fontSize: 16, lineHeight: 1.65 }, form: { position: 'relative', padding: 28, borderRadius: 18, border: '1px solid #d6e1ec', background: '#ffffff', boxShadow: '0 18px 50px rgba(25,59,91,.09)' }, grid2: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', columnGap: 20, rowGap: 16 }, label: { display: 'block', marginBottom: 6, color: '#334d66', fontSize: 12.5, fontWeight: 650 }, fieldset: { margin: '22px 0 0', padding: 0, border: 0 }, legend: { color: '#10263d', fontSize: 15, fontWeight: 650 }, help: { margin: '4px 0 12px', color: '#6b8095', fontSize: 12.5 }, purposeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }, purpose: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: '1px solid #d6e1ec', background: '#f9fbfd', cursor: 'pointer', color: '#10263d', fontSize: 13.5 }, purposeActive: { borderColor: '#10a9d1', background: 'rgba(16,169,209,.08)' }, consents: { display: 'grid', gap: 11, marginTop: 22 }, consentLabel: { display: 'flex', alignItems: 'flex-start', gap: 10, color: '#526a82', fontSize: 12.5, lineHeight: 1.55, cursor: 'pointer' }, link: { color: '#087fa3', fontWeight: 650 }, error: { display: 'flex', alignItems: 'center', gap: 5, margin: '7px 0 0', color: '#d73f59', fontSize: 12 }, submit: { width: '100%', marginTop: 22, minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, borderRadius: 10, background: '#10a9d1', color: '#052235', fontSize: 14, fontWeight: 650, cursor: 'pointer', boxShadow: '0 8px 20px rgba(16,169,209,.18)' }, success: { display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 16, padding: 24, borderRadius: 18, border: '1px solid rgba(22,138,85,.32)', background: '#edf9f3' }, honeypot: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' },
}
