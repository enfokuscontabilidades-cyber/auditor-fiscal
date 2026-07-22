import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailAutorizadoParaLeads } from '@/lib/security/adminLeads'

const STATUS_REFORMA = [
  'novo', 'diagnostico_iniciado', 'diagnostico_concluido', 'aguardando_contato',
  'contatado', 'reuniao_agendada', 'proposta_enviada', 'convertido', 'sem_interesse', 'invalido',
]

const STATUS_ACESSO = [
  'novo', 'aguardando_contato', 'contatado', 'reuniao_agendada', 'aprovado_beta',
  'lista_espera', 'convertido', 'sem_interesse', 'invalido',
]

type Payload = {
  status?: unknown
  observacoes?: unknown
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tipo = request.nextUrl.searchParams.get('tipo')
  const ehAcessoAntecipado = tipo === 'acesso_antecipado'
  const statusValidos = ehAcessoAntecipado ? STATUS_ACESSO : STATUS_REFORMA
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !emailAutorizadoParaLeads(user.email)) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })
  }

  let body: Payload
  try {
    body = await request.json() as Payload
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const atualizacao: Record<string, unknown> = { atualizado_em: new Date().toISOString() }

  if (typeof body.status === 'string') {
    if (!statusValidos.includes(body.status)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    }
    atualizacao.status = body.status
    if (body.status === 'contatado') atualizacao.contatado_em = new Date().toISOString()
  }

  if (typeof body.observacoes === 'string') {
    atualizacao.observacoes = body.observacoes.slice(0, 4000)
  }

  if (Object.keys(atualizacao).length === 1) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Configuração do Supabase pendente no servidor.' }, { status: 500 })
  }

  const { error } = await admin
    .from(ehAcessoAntecipado ? 'leads_acesso_antecipado' : 'leads_reforma_tributaria')
    .update(atualizacao)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Não foi possível atualizar o lead.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
