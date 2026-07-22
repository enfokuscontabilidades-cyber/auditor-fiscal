import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailValido, somenteDigitos, telefoneValido } from '@/lib/validacao/documentos'
import { obterIpRequisicao, verificarRateLimit } from '@/lib/security/rateLimit'
import type { FinalidadeAcessoAntecipado, PerfilProfissionalAcesso } from '@/lib/types'

const CONSENTIMENTO_VERSAO_ATUAL = '2026-07-acesso-v1'

const PERFIS: readonly PerfilProfissionalAcesso[] = [
  'contador', 'gestor_escritorio', 'profissional_fiscal_tributario',
  'auditor_independente', 'consultor_tributario', 'outro',
]

const FINALIDADES: readonly FinalidadeAcessoAntecipado[] = [
  'controle_entregas_escritorio', 'analises_fiscais_tributarias', 'auditorias_independentes',
  'validacao_sped_xml', 'simples_nacional', 'planejamento_tributario',
  'gestao_carteira_clientes', 'outro',
]

const FAIXAS_EMPRESAS = ['atuacao_individual', '1_20', '21_50', '51_100', 'mais_100'] as const

type LeadPayload = {
  nome?: unknown
  telefone?: unknown
  email?: unknown
  empresa?: unknown
  cargo?: unknown
  perfil_profissional?: unknown
  finalidades?: unknown
  faixa_empresas?: unknown
  principal_desafio?: unknown
  consentimento_dados?: unknown
  consentimento_contato?: unknown
  origem?: unknown
  campanha?: unknown
  utm_source?: unknown
  utm_medium?: unknown
  utm_campaign?: unknown
  pagina_origem?: unknown
  website?: unknown
  formulario_iniciado_em?: unknown
}

function texto(valor: unknown, limite = 500): string {
  return typeof valor === 'string' ? valor.trim().slice(0, limite) : ''
}

function gerarCodigoSolicitacao() {
  const aleatorio = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
    .replace(/-/g, '')
    .toUpperCase()
  return `AA-${aleatorio.slice(0, 6)}`
}

export async function POST(request: NextRequest) {
  const ip = obterIpRequisicao(request.headers)
  const limite = verificarRateLimit(`lead-acesso-antecipado:${ip}`, { limite: 6, janelaMs: 15 * 60 * 1000 })
  if (!limite.permitido) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, { status: 429 })
  }

  let body: LeadPayload
  try {
    body = await request.json() as LeadPayload
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  if (texto(body.website)) {
    return NextResponse.json({ error: 'Não foi possível validar o envio. Tente novamente.' }, { status: 400 })
  }

  const iniciadoEm = Number(body.formulario_iniciado_em)
  if (Number.isFinite(iniciadoEm) && iniciadoEm > 0 && Date.now() - iniciadoEm < 1200) {
    return NextResponse.json({ error: 'Não foi possível validar o envio. Tente novamente.' }, { status: 400 })
  }

  const nome = texto(body.nome, 140)
  const telefone = somenteDigitos(texto(body.telefone, 24))
  const email = texto(body.email, 180).toLowerCase()
  const empresa = texto(body.empresa, 180) || null
  const cargo = texto(body.cargo, 140) || null
  const perfil = texto(body.perfil_profissional, 60) as PerfilProfissionalAcesso
  const faixaEmpresas = texto(body.faixa_empresas, 40) || null
  const principalDesafio = texto(body.principal_desafio, 2000) || null
  const finalidadesRecebidas = Array.isArray(body.finalidades)
    ? body.finalidades.filter((item): item is string => typeof item === 'string')
    : []
  const finalidades = [...new Set(finalidadesRecebidas)]
    .filter((item): item is FinalidadeAcessoAntecipado => FINALIDADES.includes(item as FinalidadeAcessoAntecipado))

  if (!nome || !telefone || !email || !perfil) {
    return NextResponse.json({ error: 'Preencha nome, WhatsApp, e-mail e perfil profissional.' }, { status: 400 })
  }
  if (!telefoneValido(telefone)) {
    return NextResponse.json({ error: 'Informe um WhatsApp válido, com DDD.' }, { status: 400 })
  }
  if (!emailValido(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }
  if (!PERFIS.includes(perfil)) {
    return NextResponse.json({ error: 'Selecione um perfil profissional válido.' }, { status: 400 })
  }
  if (finalidades.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos uma finalidade para os testes.' }, { status: 400 })
  }
  if (faixaEmpresas && !FAIXAS_EMPRESAS.includes(faixaEmpresas as typeof FAIXAS_EMPRESAS[number])) {
    return NextResponse.json({ error: 'Selecione uma faixa de empresas válida.' }, { status: 400 })
  }
  if (body.consentimento_dados !== true) {
    return NextResponse.json({ error: 'É necessário autorizar o tratamento dos dados para enviar a solicitação.' }, { status: 400 })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Configuração do Supabase pendente no servidor.' }, { status: 500 })
  }

  const agora = new Date().toISOString()
  const campos = {
    nome,
    telefone,
    email,
    empresa,
    cargo,
    perfil_profissional: perfil,
    finalidades,
    faixa_empresas: faixaEmpresas,
    principal_desafio: principalDesafio,
    origem: texto(body.origem, 100) || 'landing-acesso-antecipado',
    campanha: texto(body.campanha, 140) || null,
    consentimento_dados: true,
    consentimento_contato: body.consentimento_contato === true,
    consentimento_versao: CONSENTIMENTO_VERSAO_ATUAL,
    ip,
    user_agent: request.headers.get('user-agent'),
    utm_source: texto(body.utm_source, 160) || null,
    utm_medium: texto(body.utm_medium, 160) || null,
    utm_campaign: texto(body.utm_campaign, 160) || null,
    pagina_origem: texto(body.pagina_origem, 1000) || null,
    atualizado_em: agora,
  }

  const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: existente } = await admin
    .from('leads_acesso_antecipado')
    .select('id, codigo_solicitacao')
    .eq('email', email)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente) {
    const { data, error } = await admin
      .from('leads_acesso_antecipado')
      .update(campos)
      .eq('id', existente.id)
      .select('id, codigo_solicitacao')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Não foi possível registrar a solicitação agora.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, leadId: data.id, codigoSolicitacao: data.codigo_solicitacao })
  }

  const codigoSolicitacao = gerarCodigoSolicitacao()
  const { data, error } = await admin
    .from('leads_acesso_antecipado')
    .insert({ ...campos, status: 'novo', codigo_solicitacao: codigoSolicitacao })
    .select('id, codigo_solicitacao')
    .single()

  if (error) {
    if (error.code === 'PGRST205' || error.message.toLowerCase().includes('leads_acesso_antecipado')) {
      return NextResponse.json({
        error: 'Tabela de leads ainda não criada. Execute a migration supabase_migration_leads_acesso_antecipado.sql no Supabase.',
      }, { status: 500 })
    }
    return NextResponse.json({ error: 'Não foi possível registrar a solicitação agora.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, leadId: data.id, codigoSolicitacao: data.codigo_solicitacao })
}
