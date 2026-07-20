import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, validarSessaoDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { normalizarCompetencia } from '@/lib/fiscal/competencia'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const { sessao_id, empresa_id, competencia, xmls, replace_sessao } = body

  if (!sessao_id || !empresa_id || !competencia || !Array.isArray(xmls)) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: sessao_id, empresa_id, competencia, xmls[]' },
      { status: 400 }
    )
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresa_id, orgId)) {
    return respostaForbidden('empresa_id')
  }

  if (!await validarSessaoDaOrg(supabase, sessao_id, orgId)) {
    return respostaForbidden('sessao_id')
  }

  // Quando replace_sessao=true, limpa XMLs de TODAS as sessões apuracao_simples
  // desta empresa+competência para evitar acúmulo de duplicatas entre reimportações.
  if (replace_sessao) {
    // Busca todas as sessões apuracao_simples desta empresa+competência
    const { data: sessoesSN } = await supabase
      .from('fa_sessoes_analise')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('competencia', competencia)
      .eq('observacoes', 'apuracao_simples')

    const ids = sessoesSN?.map((s: { id: string }) => s.id) ?? []

    // Sempre inclui a sessão atual (pode não estar em sessoesSN se recém-criada)
    const todosIds = [...new Set([...ids, sessao_id])]
    await supabase.from('fa_arquivos_xml').delete().in('sessao_id', todosIds)
  }

  const rows = xmls.map((x: {
    chave_nfe?: string
    numero_nf?: string
    data_emissao?: string | null
    emitente_cnpj?: string
    emitente_nome?: string
    destinatario_cnpj?: string
    destinatario_nome?: string
    tipo_operacao?: string
    valor_total?: number
    parsed_data?: unknown
  }) => ({
    org_id: orgId,
    sessao_id,
    empresa_id,
    competencia,
    chave_nfe: x.chave_nfe ?? null,
    numero_nf: x.numero_nf ?? null,
    data_emissao: x.data_emissao ?? null,
    emitente_cnpj: x.emitente_cnpj ?? null,
    emitente_nome: x.emitente_nome ?? null,
    destinatario_cnpj: x.destinatario_cnpj ?? null,
    destinatario_nome: x.destinatario_nome ?? null,
    tipo_operacao: x.tipo_operacao ?? null,
    valor_total: x.valor_total ?? null,
    parsed_data: x.parsed_data ?? null,
    status: 'ok',
  }))

  // Insere em lotes de 500 para evitar limitações de payload
  const BATCH = 500
  let totalSalvos = 0
  let lastError: string | null = null
  let usouFallback = false

  for (let i = 0; i < rows.length; i += BATCH) {
    const lote = rows.slice(i, i + BATCH)

    let { data, error } = await supabase
      .from('fa_arquivos_xml')
      .insert(lote)
      .select('id')

    // Coluna competencia não existe ainda (cache de schema desatualizado) — retry sem ela
    if (error?.message?.includes('competencia')) {
      usouFallback = true
      const loteSemComp = lote.map(({ competencia: _c, ...rest }) => rest)
      const res2 = await supabase.from('fa_arquivos_xml').insert(loteSemComp).select('id')
      data = res2.data
      error = res2.error
    }

    if (error) {
      lastError = error.message
      break
    }

    totalSalvos += data?.length ?? 0
  }

  if (lastError) return NextResponse.json({ error: lastError }, { status: 500 })

  return NextResponse.json({ salvos: totalSalvos, fallback_sem_competencia: usouFallback }, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessaoId    = searchParams.get('sessao_id')
  const empresaId   = searchParams.get('empresa_id')
  const tipoOperacao = searchParams.get('tipo_operacao')
  const competencia = normalizarCompetencia(searchParams.get('competencia'))

  if (!sessaoId && !empresaId) {
    return NextResponse.json({ error: 'sessao_id ou empresa_id é obrigatório' }, { status: 400 })
  }

  const incluirDados = searchParams.get('incluir_dados') === 'true'
  const selectFields = incluirDados
    ? 'id, empresa_id, sessao_id, chave_nfe, numero_nf, data_emissao, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, tipo_operacao, valor_total, status, created_at, parsed_data'
    : 'id, empresa_id, sessao_id, chave_nfe, numero_nf, data_emissao, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, tipo_operacao, valor_total, status, created_at'

  function buildQuery(incluirCompetencia: boolean) {
    let q = supabase
      .from('fa_arquivos_xml')
      .select(selectFields)
      .order('data_emissao', { ascending: true })

    if (sessaoId)     q = q.eq('sessao_id', sessaoId)
    if (empresaId)    q = q.eq('empresa_id', empresaId)
    if (tipoOperacao) q = q.eq('tipo_operacao', tipoOperacao)
    // Filtro server-side por competencia — disponível após rodar supabase_migration_fase_a.sql
    if (incluirCompetencia && competencia) q = q.eq('competencia', competencia)
    return q
  }

  let data: unknown[]

  try {
    data = await fetchAll((from, to) => buildQuery(true).range(from, to))
    // Zero resultados para a competência pedida é uma resposta válida (não há dados
    // naquele período) — não silenciar isso buscando todas as competências da empresa.
    // Registros com `competencia` NULL (pré-migração) são cobertos separadamente pelo
    // fallback do chamador, que recalcula a competência a partir de `data_emissao`.
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('competencia')) {
      // Coluna não existe (migração pendente) — retry sem filtro de competencia
      try {
        data = await fetchAll((from, to) => buildQuery(false).range(from, to))
      } catch (err2) {
        return NextResponse.json({ error: err2 instanceof Error ? err2.message : String(err2) }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  return NextResponse.json(data)
}
