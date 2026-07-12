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
  const dataInicio = params.get('data_inicio')?.trim()
  const dataFim = params.get('data_fim')?.trim()

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

  return NextResponse.json(data ?? [])
}
