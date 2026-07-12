import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validarCnpj, somenteDigitos, telefoneValido, emailValido } from '@/lib/validacao/documentos'
import { verificarRateLimit, obterIpRequisicao } from '@/lib/security/rateLimit'

const CONSENTIMENTO_VERSAO_ATUAL = '2026-07-v1'

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Outros', 'Não sei informar'] as const

type LeadPayload = {
  nome?: unknown
  telefone?: unknown
  email?: unknown
  empresa?: unknown
  cnpj?: unknown
  regime_tributario?: unknown
  estado?: unknown
  cidade?: unknown
  sistema_emissor?: unknown
  consentimento_dados?: unknown
  consentimento_contato?: unknown
  origem?: unknown
  campanha?: unknown
  utm_source?: unknown
  utm_medium?: unknown
  utm_campaign?: unknown
  pagina_origem?: unknown
  // anti-bot: campo honeypot que deve permanecer vazio + tempo mínimo de preenchimento
  website?: unknown
  formulario_iniciado_em?: unknown
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function isOneOf<T extends readonly string[]>(valor: string, lista: T): valor is T[number] {
  return (lista as readonly string[]).includes(valor)
}

function gerarCodigoDiagnostico(): string {
  const aleatorio = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
    .replace(/-/g, '')
    .toUpperCase()
  return `RT-${aleatorio.slice(0, 6)}`
}

export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers)

  const limite = verificarRateLimit(`lead-reforma:${ip}`, { limite: 8, janelaMs: 15 * 60 * 1000 })
  if (!limite.permitido) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, { status: 429 })
  }

  let body: LeadPayload
  try {
    body = await request.json() as LeadPayload
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  // Honeypot: campo invisível para humanos; se vier preenchido, é robô.
  if (texto(body.website)) {
    return NextResponse.json({ error: 'Não foi possível validar o envio. Tente novamente.' }, { status: 400 })
  }

  // Tempo mínimo entre a renderização do formulário e o envio.
  const iniciadoEm = Number(body.formulario_iniciado_em)
  if (Number.isFinite(iniciadoEm) && iniciadoEm > 0 && Date.now() - iniciadoEm < 1200) {
    return NextResponse.json({ error: 'Não foi possível validar o envio. Tente novamente.' }, { status: 400 })
  }

  const nome = texto(body.nome)
  const telefone = texto(body.telefone)
  const email = texto(body.email).toLowerCase()
  const empresa = texto(body.empresa)
  const cnpj = somenteDigitos(texto(body.cnpj))
  const regimeTributario = texto(body.regime_tributario)
  const estado = texto(body.estado).toUpperCase()
  const cidade = texto(body.cidade)
  const sistemaEmissor = texto(body.sistema_emissor) || null
  const consentimentoDados = body.consentimento_dados === true
  const consentimentoContato = body.consentimento_contato === true
  const origem = texto(body.origem) || 'diagnostico-reforma-tributaria'
  const campanha = texto(body.campanha) || null
  const utmSource = texto(body.utm_source) || null
  const utmMedium = texto(body.utm_medium) || null
  const utmCampaign = texto(body.utm_campaign) || null
  const paginaOrigem = texto(body.pagina_origem) || null

  if (!nome || !telefone || !email || !empresa || !cnpj || !estado || !cidade) {
    return NextResponse.json({ error: 'Preencha nome, empresa, CNPJ, WhatsApp, e-mail, estado e cidade.' }, { status: 400 })
  }
  if (!validarCnpj(cnpj)) {
    return NextResponse.json({ error: 'Informe um CNPJ válido.' }, { status: 400 })
  }
  if (!telefoneValido(telefone)) {
    return NextResponse.json({ error: 'Informe um WhatsApp válido, com DDD.' }, { status: 400 })
  }
  if (!emailValido(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }
  if (!isOneOf(regimeTributario, REGIMES)) {
    return NextResponse.json({ error: 'Selecione o regime tributário.' }, { status: 400 })
  }
  if (estado.length !== 2) {
    return NextResponse.json({ error: 'Selecione o estado (UF).' }, { status: 400 })
  }
  if (!consentimentoDados) {
    return NextResponse.json({ error: 'É necessário autorizar o tratamento dos dados para liberar o diagnóstico.' }, { status: 400 })
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Configuração do Supabase pendente no servidor.' }, { status: 500 })
  }

  const userAgent = request.headers.get('user-agent')

  // Prevenção de leads duplicados: reaproveita um lead recente (7 dias) com o
  // mesmo e-mail ou CNPJ em vez de criar um novo registro a cada tentativa.
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: existente } = await supabase
    .from('leads_reforma_tributaria')
    .select('id, codigo_diagnostico')
    .or(`email.eq.${email},cnpj.eq.${cnpj}`)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const camposComuns = {
    nome,
    telefone,
    email,
    empresa,
    cnpj,
    regime_tributario: regimeTributario,
    estado,
    cidade,
    sistema_emissor: sistemaEmissor,
    consentimento_dados: consentimentoDados,
    consentimento_contato: consentimentoContato,
    consentimento_versao: CONSENTIMENTO_VERSAO_ATUAL,
    ip,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    pagina_origem: paginaOrigem,
    origem,
    campanha,
    user_agent: userAgent,
    atualizado_em: new Date().toISOString(),
  }

  if (existente) {
    const { data, error } = await supabase
      .from('leads_reforma_tributaria')
      .update(camposComuns)
      .eq('id', existente.id)
      .select('id, codigo_diagnostico')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Não foi possível liberar o diagnóstico agora.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, leadId: data.id, codigoDiagnostico: data.codigo_diagnostico })
  }

  const codigoDiagnostico = gerarCodigoDiagnostico()
  const { data, error } = await supabase
    .from('leads_reforma_tributaria')
    .insert({ ...camposComuns, status: 'diagnostico_iniciado', codigo_diagnostico: codigoDiagnostico })
    .select('id, codigo_diagnostico')
    .single()

  if (error) {
    if (error.code === 'PGRST205' || error.message.toLowerCase().includes('leads_reforma_tributaria')) {
      return NextResponse.json({
        error: 'Tabela de leads ainda não criada. Execute as migrations supabase_migration_leads_reforma_tributaria.sql e _v2.sql no Supabase.',
      }, { status: 500 })
    }
    return NextResponse.json({ error: 'Não foi possível liberar o diagnóstico agora.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, leadId: data.id, codigoDiagnostico: data.codigo_diagnostico })
}

type ResultadoPayload = {
  lead_id?: unknown
  quantidade_xmls?: unknown
  resumo?: unknown
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers)
  const limite = verificarRateLimit(`lead-reforma-patch:${ip}`, { limite: 20, janelaMs: 15 * 60 * 1000 })
  if (!limite.permitido) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, { status: 429 })
  }

  let body: ResultadoPayload
  try {
    body = await request.json() as ResultadoPayload
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const leadId = texto(body.lead_id)
  if (!UUID_REGEX.test(leadId)) {
    return NextResponse.json({ error: 'Diagnóstico inválido.' }, { status: 400 })
  }

  const quantidadeXmls = Number(body.quantidade_xmls)
  const resumo = body.resumo && typeof body.resumo === 'object' ? body.resumo : null

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Configuração do Supabase pendente no servidor.' }, { status: 500 })
  }

  const { error } = await supabase
    .from('leads_reforma_tributaria')
    .update({
      quantidade_xmls: Number.isFinite(quantidadeXmls) ? quantidadeXmls : 0,
      resumo_analise: resumo,
      status: 'diagnostico_concluido',
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (error) {
    return NextResponse.json({ error: 'Não foi possível registrar o resultado do diagnóstico.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
