import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { competenciaNoPeriodo, competenciasEntre, normalizarCompetencia } from '@/lib/fiscal/competencia'
import { carregarXmlLegacy } from '@/lib/fiscal/xmlLegacy'
import { fetchAll } from '@/lib/supabase/fetchAll'

type ProdutoResumo = {
  competencia?: string | null
  tipo_movimento: string
  descricao: string
  ncm: string
  valor_total: number
  quantidade: number
  count: number
}

type DocumentoRelacionado = {
  status?: string | null
  tipo_movimento?: string | null
  data_competencia?: string | null
}

type ProdutoDetalhado = {
  descricao: string | null
  ncm: string | null
  valor_total: number | null
  quantidade: number | null
  tipo_movimento: string | null
  fa_documentos_fiscais: DocumentoRelacionado | DocumentoRelacionado[] | null
}

function documentoRelacionado(value: ProdutoDetalhado['fa_documentos_fiscais']) {
  return Array.isArray(value) ? value[0] ?? null : value
}

function tipoPorCfop(cfop: string | null | undefined) {
  const primeiro = cfop?.trim().charAt(0)
  if (!primeiro) return null
  if (['1', '2', '3'].includes(primeiro)) return 'entrada'
  if (['5', '6', '7'].includes(primeiro)) return 'saida'
  return null
}

function acumular(
  mapa: Map<string, ProdutoResumo>,
  params: {
    competencia?: string | null
    tipoMovimento?: string | null
    descricao?: string | null
    ncm?: string | null
    valor: number
    quantidade: number
  },
) {
  const descricao = params.descricao?.trim() || 'Produto nao identificado'
  const ncm = params.ncm?.trim() || 'sem-ncm'
  const tipoMovimento = params.tipoMovimento === 'entrada' || params.tipoMovimento === 'saida'
    ? params.tipoMovimento
    : 'nao_identificado'
  const competencia = normalizarCompetencia(params.competencia)
  const chave = `${competencia ?? ''}||${tipoMovimento}||${ncm}||${descricao.toUpperCase()}`

  if (!mapa.has(chave)) {
    mapa.set(chave, {
      competencia,
      tipo_movimento: tipoMovimento,
      descricao,
      ncm,
      valor_total: 0,
      quantidade: 0,
      count: 0,
    })
  }

  const item = mapa.get(chave)!
  item.valor_total += params.valor
  item.quantidade += params.quantidade
  item.count++
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

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const mapa = new Map<string, ProdutoResumo>()

  try {
    const itens = await fetchAll<ProdutoDetalhado>((from, to) => {
      let query = supabase
        .from('fa_documentos_itens')
        .select('descricao, ncm, valor_total, quantidade, tipo_movimento, fa_documentos_fiscais!inner(status, tipo_movimento, data_competencia)')
        .eq('empresa_id', empresaId)
        .range(from, to)

      if (competenciasFiltro.length > 0) query = query.in('fa_documentos_fiscais.data_competencia', competenciasFiltro)
      if (tipoMovimento) query = query.eq('tipo_movimento', tipoMovimento)
      return query
    })

    for (const item of itens) {
      const doc = documentoRelacionado(item.fa_documentos_fiscais)
      if (doc?.status === 'cancelada') continue
      if (competenciasFiltro.length > 0 && !competenciaNoPeriodo(doc?.data_competencia, competenciaInicio, competenciaFim)) continue
      const movimento = item.tipo_movimento ?? doc?.tipo_movimento ?? null
      if (tipoMovimento && movimento !== tipoMovimento) continue
      acumular(mapa, {
        competencia: doc?.data_competencia,
        tipoMovimento: movimento,
        descricao: item.descricao,
        ncm: item.ncm,
        valor: item.valor_total ?? 0,
        quantidade: item.quantidade ?? 0,
      })
    }
  } catch {
    // Continua para o XML legado.
  }

  if (mapa.size === 0) {
    try {
      const legacy = await carregarXmlLegacy({
        supabase,
        empresaId,
        competenciaInicio,
        competenciaFim,
        tipoMovimento,
      })

      for (const item of legacy) {
        acumular(mapa, {
          competencia: item.competencia,
          tipoMovimento: item.tipo_operacao ?? tipoPorCfop(item.cfop),
          descricao: item.descricao,
          ncm: item.ncm,
          valor: item.valor_total,
          quantidade: item.quantidade,
        })
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Falha ao carregar produtos XML.' },
        { status: 500 },
      )
    }
  }

  const produtos = Array.from(mapa.values())
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, limit)

  return NextResponse.json(produtos)
}
