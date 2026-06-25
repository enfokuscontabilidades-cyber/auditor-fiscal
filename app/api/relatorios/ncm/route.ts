import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { competenciaNoPeriodo, competenciasEntre } from '@/lib/fiscal/competencia'
import { carregarXmlLegacy } from '@/lib/fiscal/xmlLegacy'

type NcmResumo = {
  ncm: string
  descricao_exemplo: string
  valor_total: number
  quantidade: number
  count_produtos: number
}

function acumular(mapa: Map<string, NcmResumo>, ncmValue: string | null | undefined, descricao: string | null | undefined, valor: number, quantidade: number) {
  const ncm = ncmValue || 'sem-ncm'
  if (!mapa.has(ncm)) {
    mapa.set(ncm, { ncm, descricao_exemplo: descricao ?? '', valor_total: 0, quantidade: 0, count_produtos: 0 })
  }
  const item = mapa.get(ncm)!
  item.valor_total += valor
  item.quantidade += quantidade
  item.count_produtos++
  if (!item.descricao_exemplo && descricao) item.descricao_exemplo = descricao
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresa_id')
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

  const mapa = new Map<string, NcmResumo>()

  let resumoQuery = supabase
    .from('rel_resumo_ncm_mensal')
    .select('ncm, descricao_exemplo, valor_total, quantidade, count_produtos')
    .eq('empresa_id', empresaId)
    .order('valor_total', { ascending: false })
    .limit(limit)

  if (competenciasFiltro.length > 0) resumoQuery = resumoQuery.in('competencia', competenciasFiltro)

  const { data: resumoData, error: resumoError } = await resumoQuery
  if (resumoError && competenciasFiltro.length > 0) {
    return NextResponse.json(
      { error: `Resumo mensal de NCM indisponivel. Detalhe: ${resumoError.message}` },
      { status: 500 },
    )
  }
  if (!resumoError && Array.isArray(resumoData) && resumoData.length > 0) {
    const totalGeralResumo = resumoData.reduce((s, item) => s + Number(item.valor_total ?? 0), 0)
    return NextResponse.json(resumoData.map(item => ({
      ...item,
      participacao: totalGeralResumo > 0 ? (Number(item.valor_total ?? 0) / totalGeralResumo) * 100 : 0,
    })))
  }
  if (!resumoError && competenciasFiltro.length > 0) {
    return NextResponse.json([])
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('relatorio_ncm_resumo', {
    p_empresa_id: empresaId,
    p_competencias: competenciasFiltro.length > 0 ? competenciasFiltro : null,
    p_limite: limit,
  })

  if (!rpcError && Array.isArray(rpcData)) {
    return NextResponse.json(rpcData)
  }

  if (rpcError) {
    return NextResponse.json(
      { error: `Falha na função relatorio_ncm_resumo: ${rpcError.message}` },
      { status: 500 },
    )
  }

  let query = supabase
    .from('fa_documentos_itens')
    .select('ncm, descricao, valor_total, quantidade, fa_documentos_fiscais!inner(status, tipo_movimento, data_competencia)')
    .eq('empresa_id', empresaId)
    .limit(100000)

  if (competenciasFiltro.length > 0) query = query.in('fa_documentos_fiscais.data_competencia', competenciasFiltro)

  const { data, error } = await query

  if (!error) {
    for (const item of (data ?? [])) {
      const doc = item.fa_documentos_fiscais as unknown as { status: string; data_competencia?: string } | null
      if (doc?.status === 'cancelada') continue
      if (!competenciaNoPeriodo(doc?.data_competencia, competenciaInicio, competenciaFim)) continue
      acumular(mapa, item.ncm, item.descricao, item.valor_total ?? 0, item.quantidade ?? 0)
    }
  }

  if (mapa.size === 0) {
    try {
      const legacy = await carregarXmlLegacy({
        supabase,
        empresaId,
        competenciaInicio,
        competenciaFim,
      })
      for (const item of legacy) {
        acumular(mapa, item.ncm, item.descricao, item.valor_total, item.quantidade)
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

  const totalGeral = Array.from(mapa.values()).reduce((s, item) => s + item.valor_total, 0)
  const resultado = Array.from(mapa.values())
    .map(item => ({ ...item, participacao: totalGeral > 0 ? (item.valor_total / totalGeral) * 100 : 0 }))
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, limit)

  return NextResponse.json(resultado)
}
