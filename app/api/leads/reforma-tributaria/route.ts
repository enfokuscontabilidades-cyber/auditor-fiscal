import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PORTES = ['MEI', 'ME', 'EPP', 'Média empresa', 'Grande empresa', 'Não sei'] as const
const REGIMES = ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Não sei'] as const
const FUNCIONARIOS = ['0', '1 a 5', '6 a 10', '11 a 20', '21 a 50', '51 a 100', 'Acima de 100'] as const
const FATURAMENTOS = [
  'Até R$ 100 mil',
  'R$ 100 mil a R$ 200 mil',
  'R$ 200 mil a R$ 500 mil',
  'R$ 500 mil a R$ 1 milhão',
  'R$ 1 milhão a R$ 3 milhões',
  'Acima de R$ 3 milhões',
] as const
const SEGMENTOS = ['Serviço', 'Comércio atacadista', 'Comércio varejista', 'Indústria'] as const

type LeadPayload = {
  nome?: unknown
  telefone?: unknown
  email?: unknown
  empresa?: unknown
  porte_empresa?: unknown
  regime_tributario?: unknown
  funcionarios_faixa?: unknown
  faturamento_faixa?: unknown
  segmentos?: unknown
  origem?: unknown
  campanha?: unknown
}

function texto(v: unknown) {
  return typeof v === 'string' ? v.trim() : ''
}

function isOneOf<T extends readonly string[]>(valor: string, lista: T): valor is T[number] {
  return (lista as readonly string[]).includes(valor)
}

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  let body: LeadPayload

  try {
    body = await request.json() as LeadPayload
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const nome = texto(body.nome)
  const telefone = texto(body.telefone)
  const email = texto(body.email).toLowerCase()
  const empresa = texto(body.empresa)
  const porteEmpresa = texto(body.porte_empresa)
  const regimeTributario = texto(body.regime_tributario)
  const funcionariosFaixa = texto(body.funcionarios_faixa)
  const faturamentoFaixa = texto(body.faturamento_faixa)
  const segmentos = Array.isArray(body.segmentos)
    ? body.segmentos.map(texto).filter((s): s is typeof SEGMENTOS[number] => isOneOf(s, SEGMENTOS))
    : []
  const origem = texto(body.origem) || 'diagnostico-reforma-tributaria'
  const campanha = texto(body.campanha) || null

  if (!nome || !telefone || !email || !empresa) {
    return NextResponse.json({ error: 'Preencha nome, telefone, e-mail e empresa.' }, { status: 400 })
  }

  if (!emailValido(email)) {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  }

  if (!isOneOf(porteEmpresa, PORTES)) {
    return NextResponse.json({ error: 'Selecione o porte da empresa.' }, { status: 400 })
  }

  if (!isOneOf(regimeTributario, REGIMES)) {
    return NextResponse.json({ error: 'Selecione o regime tributário.' }, { status: 400 })
  }

  if (!isOneOf(funcionariosFaixa, FUNCIONARIOS)) {
    return NextResponse.json({ error: 'Selecione a faixa de funcionários.' }, { status: 400 })
  }

  if (!isOneOf(faturamentoFaixa, FATURAMENTOS)) {
    return NextResponse.json({ error: 'Selecione a faixa de faturamento.' }, { status: 400 })
  }

  if (!segmentos.length) {
    return NextResponse.json({ error: 'Selecione pelo menos um segmento de atividade.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('leads_reforma_tributaria')
    .insert({
      nome,
      telefone,
      email,
      empresa,
      porte_empresa: porteEmpresa,
      regime_tributario: regimeTributario,
      funcionarios_faixa: funcionariosFaixa,
      faturamento_faixa: faturamentoFaixa,
      segmentos,
      origem,
      campanha,
      user_agent: request.headers.get('user-agent'),
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Não foi possível liberar o diagnóstico agora.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, leadId: data.id })
}
