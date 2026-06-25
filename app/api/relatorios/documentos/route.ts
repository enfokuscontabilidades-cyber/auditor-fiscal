import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { competenciaKey, competenciaNoPeriodo, competenciasEntre, normalizarCompetencia } from '@/lib/fiscal/competencia'
import { carregarXmlLegacy, carregarXmlLegacyDocumentos, type XmlLegacyItem } from '@/lib/fiscal/xmlLegacy'
import { fetchAll } from '@/lib/supabase/fetchAll'

type Movimento = 'entrada' | 'saida'

type TotaisDocumento = {
  origem: string
  total_entrada: number
  total_saida: number
  count_entrada: number
  count_saida: number
}

function origemLabel(origem: string | null | undefined) {
  if (!origem) return 'Nao identificada'
  if (origem.startsWith('xml')) return 'XML'
  if (origem.startsWith('sped')) return 'SPED'
  if (origem === 'manual') return 'Manual'
  return origem
}

function movimentoPorCfop(cfop: string | null | undefined): Movimento | null {
  const primeiro = cfop?.trim().charAt(0)
  if (!primeiro) return null
  if (['1', '2', '3'].includes(primeiro)) return 'entrada'
  if (['5', '6', '7'].includes(primeiro)) return 'saida'
  return null
}

function normalizarMovimento(tipo: string | null | undefined): Movimento | null {
  return tipo === 'entrada' || tipo === 'saida' ? tipo : null
}

function movimentoItem(item: XmlLegacyItem): Movimento | null {
  return movimentoPorCfop(item.cfop) ?? normalizarMovimento(item.tipo_operacao)
}

function acumular(
  mapa: Map<string, TotaisDocumento>,
  competencia: string,
  origem: string | null | undefined,
  tipo: Movimento | null,
  valor: number,
) {
  if (!tipo) return
  const origemNome = origemLabel(origem)
  const chave = `${competencia}||${origemNome}`
  if (!mapa.has(chave)) {
    mapa.set(chave, { origem: origemNome, total_entrada: 0, total_saida: 0, count_entrada: 0, count_saida: 0 })
  }
  const item = mapa.get(chave)!
  if (tipo === 'entrada') {
    item.total_entrada += valor
    item.count_entrada++
  } else {
    item.total_saida += valor
    item.count_saida++
  }
}

function chaveDocumentoItem(item: XmlLegacyItem, tipo: Movimento) {
  return item.chave_nfe || `${item.numero_nf ?? ''}-${item.emitente_cnpj ?? ''}-${item.destinatario_cnpj ?? ''}-${item.data_emissao ?? ''}-${tipo}`
}

function resultado(mapa: Map<string, TotaisDocumento>, limiteMeses: number | null) {
  const linhas = Array.from(mapa.entries())
    .map(([chave, totais]) => {
      const [competencia] = chave.split('||')
      return { competencia, ...totais }
    })
    .sort((a, b) => competenciaKey(a.competencia) - competenciaKey(b.competencia) || a.origem.localeCompare(b.origem))

  return limiteMeses ? linhas.slice(-limiteMeses) : linhas
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const empresaId = url.searchParams.get('empresa_id')
  const competenciaInicio = url.searchParams.get('competencia_inicio')
  const competenciaFim = url.searchParams.get('competencia_fim')
  const tipoMovimento = normalizarMovimento(url.searchParams.get('tipo_movimento'))
  const competenciasFiltro = competenciasEntre(competenciaInicio, competenciaFim)
  const mesesParam = Number.parseInt(url.searchParams.get('meses') ?? '', 10)
  const limiteMeses = Number.isFinite(mesesParam) && mesesParam > 0 ? mesesParam : (competenciasFiltro.length === 0 ? 6 : null)

  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const mapa = new Map<string, TotaisDocumento>()

  try {
    const itens = await carregarXmlLegacy({ supabase, empresaId, competenciaInicio, competenciaFim })
    const docsPorMovimento = new Map<string, XmlLegacyItem>()

    for (const item of itens) {
      const tipo = movimentoItem(item)
      if (!tipo) continue
      if (tipoMovimento && tipo !== tipoMovimento) continue
      const chave = chaveDocumentoItem(item, tipo)
      if (!docsPorMovimento.has(chave)) docsPorMovimento.set(chave, item)
    }

    for (const item of docsPorMovimento.values()) {
      const tipo = movimentoItem(item)
      if (!tipo) continue
      const comp = item.competencia ?? 'sem-competencia'
      acumular(mapa, comp, 'XML', tipo, item.valor_total_nota)
    }

    if (mapa.size > 0) return NextResponse.json(resultado(mapa, limiteMeses))
  } catch {
    // Se os XMLs legados nao estiverem disponiveis, tenta a base estruturada.
  }

  try {
    const docs = await fetchAll<{
      data_competencia: string | null
      tipo_movimento: string | null
      valor_total: number | null
      origem: string | null
    }>((from, to) => {
      let query = supabase
        .from('fa_documentos_fiscais')
        .select('data_competencia, tipo_movimento, valor_total, origem')
        .eq('empresa_id', empresaId)
        .neq('status', 'cancelada')
        .order('data_competencia', { ascending: true })
        .range(from, to)

      if (competenciasFiltro.length > 0) query = query.in('data_competencia', competenciasFiltro)
      if (tipoMovimento) query = query.eq('tipo_movimento', tipoMovimento)
      return query
    })

    for (const doc of docs) {
      if (!competenciaNoPeriodo(doc.data_competencia, competenciaInicio, competenciaFim)) continue
      const tipo = normalizarMovimento(doc.tipo_movimento)
      if (tipoMovimento && tipo !== tipoMovimento) continue
      const comp = normalizarCompetencia(doc.data_competencia) ?? 'sem-competencia'
      acumular(mapa, comp, doc.origem, tipo, doc.valor_total ?? 0)
    }

    if (mapa.size > 0) return NextResponse.json(resultado(mapa, limiteMeses))
  } catch {
    // Continua para o XML por documento, sem usar resumo mensal salvo.
  }

  try {
    const legacy = await carregarXmlLegacyDocumentos({
      supabase,
      empresaId,
      competenciaInicio,
      competenciaFim,
      tipoMovimento,
    })
    const notasVistas = new Set<string>()

    for (const item of legacy) {
      const tipo = normalizarMovimento(item.tipo_operacao)
      if (!tipo) continue
      const comp = item.competencia ?? 'sem-competencia'
      const chave = item.chave_nfe || `${item.numero_nf ?? ''}-${item.tipo_operacao ?? ''}-${item.valor_total_nota}`
      if (notasVistas.has(chave)) continue
      notasVistas.add(chave)
      acumular(mapa, comp, 'XML', tipo, item.valor_total_nota)
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Falha ao carregar documentos XML.' },
      { status: 500 },
    )
  }

  return NextResponse.json(resultado(mapa, limiteMeses))
}
