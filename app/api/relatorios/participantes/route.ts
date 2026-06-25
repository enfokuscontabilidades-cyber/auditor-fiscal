import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { competenciaNoPeriodo, competenciasEntre } from '@/lib/fiscal/competencia'
import { carregarXmlLegacyDocumentos } from '@/lib/fiscal/xmlLegacy'

type ParticipanteResumo = {
  cnpj: string
  nome: string
  valor_total: number
  count: number
  uf?: string
  municipio?: string
  situacao_cadastral?: string
  porte?: string
  opcao_simples?: boolean
  opcao_mei?: boolean
  consultado_em?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function text(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'object') return undefined
  const result = String(value).trim()
  return result || undefined
}

function bool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'sim', 's', '1'].includes(normalized)) return true
    if (['false', 'nao', 'não', 'n', '0'].includes(normalized)) return false
  }
  return undefined
}

function extractDescricao(value: unknown): string | undefined {
  const record = asRecord(value)
  return text(record.descricao) ?? text(record.nome) ?? text(value)
}

function acumularParticipante(
  mapa: Map<string, ParticipanteResumo>,
  cnpj: string | null | undefined,
  nome: string | null | undefined,
  valor: number,
) {
  const cnpjLimpo = (cnpj ?? '').replace(/\D/g, '')
  if (!cnpjLimpo) return
  if (!mapa.has(cnpjLimpo)) {
    mapa.set(cnpjLimpo, { cnpj: cnpjLimpo, nome: nome || 'Não identificado', valor_total: 0, count: 0 })
  }
  const item = mapa.get(cnpjLimpo)!
  item.valor_total += valor
  item.count++
  if ((!item.nome || item.nome === 'Não identificado') && nome) item.nome = nome
}

function enriquecerComCache(participante: ParticipanteResumo, cached: { dados: unknown; consultado_em?: string } | undefined) {
  if (!cached) return participante

  const raw = asRecord(cached.dados)
  const estabelecimento = asRecord(raw.estabelecimento)
  const endereco = asRecord(raw.endereco)
  const simples = asRecord(raw.simples)
  const cidade = asRecord(estabelecimento.cidade ?? endereco.municipio)
  const estado = asRecord(estabelecimento.estado ?? endereco.estado)

  return {
    ...participante,
    nome: text(raw.razao_social) ?? participante.nome,
    uf: text(estado.sigla) ?? extractDescricao(estado) ?? text(endereco.uf),
    municipio: text(cidade.nome) ?? extractDescricao(cidade) ?? text(estabelecimento.municipio),
    situacao_cadastral: text(estabelecimento.situacao_cadastral) ?? text(raw.situacao_cadastral),
    porte: extractDescricao(raw.porte),
    opcao_simples: bool(simples.simples ?? raw.opcao_simples),
    opcao_mei: bool(simples.mei ?? raw.opcao_mei),
    consultado_em: cached.consultado_em,
  }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresa_id')
  const tipo = url.searchParams.get('tipo') ?? 'entrada'
  const competenciaInicio = url.searchParams.get('competencia_inicio')
  const competenciaFim = url.searchParams.get('competencia_fim')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '5000', 10) || 5000, 5000)
  const competenciasFiltro = competenciasEntre(competenciaInicio, competenciaFim)

  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  if (competenciasFiltro.length === 0) {
    return NextResponse.json({ error: 'Informe uma competencia inicial ou final para carregar o relatorio.' }, { status: 400 })
  }

  const mapa = new Map<string, ParticipanteResumo>()

  let resumoQuery = supabase
    .from('rel_resumo_participantes_mensal')
    .select('cnpj, nome, valor_total, count')
    .eq('empresa_id', empresaId)
    .eq('tipo_movimento', tipo)
    .order('valor_total', { ascending: false })
    .limit(limit)

  if (competenciasFiltro.length > 0) resumoQuery = resumoQuery.in('competencia', competenciasFiltro)

  const { data: resumoData, error: resumoError } = await resumoQuery
  if (resumoError && competenciasFiltro.length > 0) {
    return NextResponse.json(
      { error: `Resumo mensal de participantes indisponivel. Detalhe: ${resumoError.message}` },
      { status: 500 },
    )
  }
  if (!resumoError && Array.isArray(resumoData) && resumoData.length > 0) {
    const participantesResumo = resumoData.map(item => ({
      cnpj: String(item.cnpj ?? ''),
      nome: String(item.nome ?? 'Não identificado'),
      valor_total: Number(item.valor_total ?? 0),
      count: Number(item.count ?? 0),
    })) as ParticipanteResumo[]

    const cnpjsResumo = participantesResumo.map(p => p.cnpj).filter(cnpj => cnpj.length === 14)
    if (cnpjsResumo.length === 0) return NextResponse.json(participantesResumo)

    const { data: cacheRowsResumo } = await supabase
      .from('cnpj_cache')
      .select('cnpj, dados, consultado_em')
      .in('cnpj', cnpjsResumo)
      .eq('status', 'ok')

    const cacheByCnpjResumo = new Map(
      (cacheRowsResumo ?? []).map(row => [
        String(row.cnpj),
        { dados: row.dados as unknown, consultado_em: row.consultado_em as string | undefined },
      ]),
    )

    return NextResponse.json(participantesResumo.map(p => enriquecerComCache(p, cacheByCnpjResumo.get(p.cnpj))))
  }
  if (!resumoError && competenciasFiltro.length > 0) {
    return NextResponse.json([])
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('relatorio_participantes_resumo', {
    p_empresa_id: empresaId,
    p_tipo_movimento: tipo,
    p_competencias: competenciasFiltro.length > 0 ? competenciasFiltro : null,
    p_limite: limit,
  })

  if (!rpcError && Array.isArray(rpcData)) {
    const participantesRpc = rpcData.map(item => ({
      ...item,
      valor_total: Number(item.valor_total ?? 0),
      count: Number(item.count ?? 0),
    })) as ParticipanteResumo[]

    const cnpjsRpc = participantesRpc.map(p => p.cnpj).filter(cnpj => cnpj.length === 14)
    if (cnpjsRpc.length === 0) return NextResponse.json(participantesRpc)

    const { data: cacheRowsRpc } = await supabase
      .from('cnpj_cache')
      .select('cnpj, dados, consultado_em')
      .in('cnpj', cnpjsRpc)
      .eq('status', 'ok')

    const cacheByCnpjRpc = new Map(
      (cacheRowsRpc ?? []).map(row => [
        String(row.cnpj),
        { dados: row.dados as unknown, consultado_em: row.consultado_em as string | undefined },
      ]),
    )

    return NextResponse.json(participantesRpc.map(p => enriquecerComCache(p, cacheByCnpjRpc.get(p.cnpj))))
  }

  if (rpcError) {
    return NextResponse.json(
      { error: `Falha na função relatorio_participantes_resumo: ${rpcError.message}` },
      { status: 500 },
    )
  }

  let query = supabase
    .from('fa_documentos_fiscais')
    .select('emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, valor_total, tipo_movimento, status, data_competencia')
    .eq('empresa_id', empresaId)
    .neq('status', 'cancelada')
    .eq('tipo_movimento', tipo)
    .limit(50000)

  if (competenciasFiltro.length > 0) query = query.in('data_competencia', competenciasFiltro)

  const { data, error } = await query

  if (!error) {
    for (const doc of (data ?? [])) {
      if (!competenciaNoPeriodo(doc.data_competencia, competenciaInicio, competenciaFim)) continue
      const cnpj = tipo === 'entrada' ? doc.emitente_cnpj : doc.destinatario_cnpj
      const nome = tipo === 'entrada' ? doc.emitente_nome : doc.destinatario_nome
      acumularParticipante(mapa, cnpj, nome, doc.valor_total ?? 0)
    }
  }

  if (mapa.size === 0) {
    try {
      const legacy = await carregarXmlLegacyDocumentos({
        supabase,
        empresaId,
        competenciaInicio,
        competenciaFim,
        tipoMovimento: tipo,
      })
      for (const item of legacy) {
        const cnpj = tipo === 'entrada' ? item.emitente_cnpj : item.destinatario_cnpj
        const nome = tipo === 'entrada' ? item.emitente_nome : item.destinatario_nome
        acumularParticipante(mapa, cnpj, nome, item.valor_total_nota)
      }
    } catch (err) {
      if (error) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : error.message },
          { status: 500 },
        )
      }
    }
  }

  const participantes = Array.from(mapa.values())
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, limit)

  const cnpjs = participantes.map(p => p.cnpj).filter(cnpj => cnpj.length === 14)
  if (cnpjs.length === 0) return NextResponse.json(participantes)

  const { data: cacheRows } = await supabase
    .from('cnpj_cache')
    .select('cnpj, dados, consultado_em')
    .in('cnpj', cnpjs)
    .eq('status', 'ok')

  const cacheByCnpj = new Map(
    (cacheRows ?? []).map(row => [
      String(row.cnpj),
      { dados: row.dados as unknown, consultado_em: row.consultado_em as string | undefined },
    ]),
  )

  return NextResponse.json(participantes.map(p => enriquecerComCache(p, cacheByCnpj.get(p.cnpj))))
}
