import { Mail, MessageCircle, LifeBuoy, Clock, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { linkWhatsapp } from '@/lib/institucional/enfokusContabilidade'

const EMAIL_SUPORTE = 'suporte@enfokus.com.br'

function montarMailto(emailUsuario: string | null, nomeOrg: string | null) {
  const assunto = 'Suporte Enfokus'
  const corpo = [
    'Olá, equipe Enfokus.',
    '',
    'Preciso de suporte no sistema.',
    '',
    `Organização: ${nomeOrg || '-'}`,
    `E-mail do usuário: ${emailUsuario || '-'}`,
    '',
    'Descrição do problema:',
  ].join('\n')

  return `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`
}

function montarWhatsapp(emailUsuario: string | null, nomeOrg: string | null) {
  return linkWhatsapp([
    'Olá! Preciso de suporte no sistema Enfokus.',
    `Organização: ${nomeOrg || '-'}`,
    `E-mail do usuário: ${emailUsuario || '-'}`,
  ].join('\n'))
}

export default async function SuportePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user ? await getOrgId(supabase, user.id) : null

  let nomeOrg: string | null = null
  if (orgId) {
    const { data: org } = await supabase
      .from('organizacoes')
      .select('nome')
      .eq('id', orgId)
      .maybeSingle()
    nomeOrg = org?.nome ?? null
  }

  const emailUsuario = user?.email ?? null
  const mailto = montarMailto(emailUsuario, nomeOrg)
  const whatsapp = montarWhatsapp(emailUsuario, nomeOrg)

  const card = {
    background: 'rgba(255,255,255,0.94)',
    border: '1px solid #d7e2ee',
    borderRadius: 14,
    boxShadow: '0 14px 32px rgba(15,23,42,0.08)',
  }

  return (
    <main style={{ color: '#0f172a' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 760, letterSpacing: '-0.01em' }}>Suporte</h1>
        <p style={{ margin: '6px 0 0', color: '#52637a', fontSize: 14 }}>
          Fale com a Enfokus para ajuda no uso da plataforma, assinatura ou análises da Reforma Tributária.
        </p>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#e8f7fb', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
            <MessageCircle size={21} color="#0e7490" />
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 760 }}>WhatsApp</h2>
          <p style={{ margin: '8px 0 18px', color: '#52637a', fontSize: 13.5, lineHeight: 1.55 }}>
            Melhor canal para dúvidas rápidas, liberação de acesso e orientação sobre uso do sistema.
          </p>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, borderRadius: 10, padding: '10px 14px', background: 'linear-gradient(90deg, #0ea5e9, #06b6d4)', color: '#fff', fontWeight: 800, textDecoration: 'none', fontSize: 13 }}
          >
            <MessageCircle size={15} /> Chamar no WhatsApp
          </a>
        </div>

        <div style={{ ...card, padding: 22 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#eef4fb', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
            <Mail size={21} color="#2563eb" />
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 760 }}>E-mail</h2>
          <p style={{ margin: '8px 0 18px', color: '#52637a', fontSize: 13.5, lineHeight: 1.55 }}>
            Use para enviar prints, detalhes técnicos ou solicitações que precisam de acompanhamento.
          </p>
          <a
            href={mailto}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #bfd0e2', borderRadius: 10, padding: '10px 14px', color: '#0f172a', fontWeight: 800, textDecoration: 'none', fontSize: 13 }}
          >
            <Mail size={15} /> Enviar e-mail
          </a>
        </div>
      </section>

      <section style={{ ...card, marginTop: 16, padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <LifeBuoy size={18} color="#0e7490" />
          <div>
            <strong style={{ fontSize: 13.5 }}>Inclua contexto</strong>
            <p style={{ margin: '4px 0 0', color: '#52637a', fontSize: 12.5, lineHeight: 1.45 }}>
              Informe empresa, tela acessada e o que estava tentando fazer.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Building2 size={18} color="#0e7490" />
          <div>
            <strong style={{ fontSize: 13.5 }}>Dados enviados</strong>
            <p style={{ margin: '4px 0 0', color: '#52637a', fontSize: 12.5, lineHeight: 1.45 }}>
              A mensagem já inclui sua organização e e-mail para agilizar o atendimento.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Clock size={18} color="#0e7490" />
          <div>
            <strong style={{ fontSize: 13.5 }}>Atendimento</strong>
            <p style={{ margin: '4px 0 0', color: '#52637a', fontSize: 12.5, lineHeight: 1.45 }}>
              O retorno será feito pelos canais oficiais da Enfokus.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
