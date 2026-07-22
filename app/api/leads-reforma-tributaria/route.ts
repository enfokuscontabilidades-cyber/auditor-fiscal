import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailAutorizadoParaLeads } from '@/lib/security/adminLeads'

async function exigirAcesso() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !emailAutorizadoParaLeads(user.email)) return null
  return user
}

type DiagnosticoLeadResumo = {
  lead_id: string | null
  token: string
  criado_em: string
  relatorio_gerado_em: string | null
  downloads_count: number
  status: string
}

export async function GET(request: NextRequest) {
  const user = await exigirAcesso()
  if (!user) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Configuração do Supabase pendente no servidor.' }, { status: 500 })
  }

  const params = request.nextUrl.searchParams
  const busca = params.get('busca')?.trim()
  const regime = params.get('regime')?.trim()
  const status = params.get('status')?.trim()
  const origem = params.get('origem')?.trim()
  const tipo = params.get('tipo')?.trim()
  const perfil = params.get('perfil')?.trim()
  const finalidade = params.get('finalidade')?.trim()
  const dataInicio = params.get('data_inicio')?.trim()
  const dataFim = params.get('data_fim')?.trim()

  if (tipo === 'acesso_antecipado') {
    let queryAcesso = admin
      .from('leads_acesso_antecipado')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (busca) {
      const termo = busca.replace(/[%,]/g, '')
      queryAcesso = queryAcesso.or(
        `nome.ilike.%${termo}%,empresa.ilike.%${termo}%,cargo.ilike.%${termo}%,telefone.ilike.%${termo}%,email.ilike.%${termo}%`,
      )
    }
    if (status) queryAcesso = queryAcesso.eq('status', status)
    if (perfil) queryAcesso = queryAcesso.eq('perfil_profissional', perfil)
    if (finalidade) queryAcesso = queryAcesso.contains('finalidades', [finalidade])
    if (dataInicio) queryAcesso = queryAcesso.gte('created_at', dataInicio)
    if (dataFim) queryAcesso = queryAcesso.lte('created_at', dataFim)

    const { data: acessos, error: erroAcesso } = await queryAcesso
    if (erroAcesso) {
      if (erroAcesso.code === 'PGRST205' || erroAcesso.message.toLowerCase().includes('leads_acesso_antecipado')) {
        return NextResponse.json([])
      }
      return NextResponse.json({ error: 'Não foi possível carregar os leads de acesso antecipado.' }, { status: 500 })
    }

    return NextResponse.json((acessos ?? []).map(lead => ({
      ...lead,
      tipo_lead: 'acesso_antecipado',
    })))
  }

  let query = admin
    .from('leads_reforma_tributaria')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (busca) {
    const termo = busca.replace(/[%,]/g, '')
    query = query.or(
      `nome.ilike.%${termo}%,empresa.ilike.%${termo}%,cnpj.ilike.%${termo}%,telefone.ilike.%${termo}%,email.ilike.%${termo}%`,
    )
  }
  if (regime) query = query.eq('regime_tributario', regime)
  if (status) query = query.eq('status', status)
  if (origem) query = query.eq('origem', origem)
  if (dataInicio) query = query.gte('created_at', dataInicio)
  if (dataFim) query = query.lte('created_at', dataFim)

  const { data, error } = await query
  if (error) {
    if (error.code === 'PGRST205') return NextResponse.json([])
    return NextResponse.json({ error: 'Não foi possível carregar os leads.' }, { status: 500 })
  }

  const leads = data ?? []
  const leadIds = leads
    .map(lead => typeof lead.id === 'string' ? lead.id : '')
    .filter(Boolean)

  if (leadIds.length === 0) return NextResponse.json(leads)

  const { data: diagnosticos } = await admin
    .from('diagnosticos_reforma_tributaria')
    .select('lead_id, token, criado_em, relatorio_gerado_em, downloads_count, status')
    .in('lead_id', leadIds)
    .order('criado_em', { ascending: false })

  const diagnosticoPorLead = new Map<string, DiagnosticoLeadResumo>()
  for (const diagnostico of (diagnosticos ?? []) as DiagnosticoLeadResumo[]) {
    if (diagnostico.lead_id && !diagnosticoPorLead.has(diagnostico.lead_id)) {
      diagnosticoPorLead.set(diagnostico.lead_id, diagnostico)
    }
  }

  return NextResponse.json(leads.map(lead => ({
    ...lead,
    tipo_lead: 'reforma_tributaria',
    diagnostico_relatorio: diagnosticoPorLead.get(lead.id) ?? null,
  })))
}
