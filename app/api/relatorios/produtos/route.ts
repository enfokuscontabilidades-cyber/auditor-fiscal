import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { competenciasEntre } from '@/lib/fiscal/competencia'

const SERVER_TIMEOUT_MS = 12_000

async function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} demorou mais de ${SERVER_TIMEOUT_MS / 1000}s`)), SERVER_TIMEOUT_MS)
  })

  try {
    return await Promise.race([promise, timer])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresa_id')
  const competenciaInicio = url.searchParams.get('competencia_inicio')
  const competenciaFim = url.searchParams.get('competencia_fim')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '5000', 10) || 5000, 5000)
  const tipoMovimento = url.searchParams.get('tipo_movimento')
  const competenciasFiltro = competenciasEntre(competenciaInicio, competenciaFim)

  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  if (competenciasFiltro.length === 0) {
    return NextResponse.json({ error: 'Informe uma competencia inicial ou final para carregar o relatorio.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: membro, error: membroError } = await withTimeout(
    admin
      .from('membros_organizacao')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle(),
    'Validacao da organizacao',
  )

  if (membroError) {
    return NextResponse.json({ error: `Falha ao validar organizacao: ${membroError.message}` }, { status: 500 })
  }

  const orgId = typeof membro?.org_id === 'string' ? membro.org_id : null
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })

  const { data: empresa, error: empresaError } = await withTimeout(
    admin
      .from('empresas')
      .select('id')
      .eq('id', empresaId)
      .eq('org_id', orgId)
      .limit(1)
      .maybeSingle(),
    'Validacao da empresa',
  )

  if (empresaError) {
    return NextResponse.json({ error: `Falha ao validar empresa: ${empresaError.message}` }, { status: 500 })
  }

  if (!empresa) {
    return NextResponse.json({ error: 'empresa_id invalido ou sem permissao' }, { status: 403 })
  }

  let query = admin
    .from('rel_resumo_produtos_mensal')
    .select('competencia, tipo_movimento, descricao, ncm, valor_total, quantidade, count')
    .eq('org_id', orgId)
    .eq('empresa_id', empresaId)
    .in('competencia', competenciasFiltro)

  if (tipoMovimento) query = query.eq('tipo_movimento', tipoMovimento)

  const { data, error } = await withTimeout(
    query
      .order('valor_total', { ascending: false })
      .limit(limit),
    'Consulta do resumo mensal de produtos',
  )

  if (error) {
    return NextResponse.json(
      { error: `Resumo mensal de produtos indisponivel. Detalhe: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json(Array.isArray(data) ? data : [])
}
