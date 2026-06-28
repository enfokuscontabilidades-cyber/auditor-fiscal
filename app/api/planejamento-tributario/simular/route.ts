import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { consolidarGrupo } from '@/lib/planejamento/consolidarGrupo'
import { simularLucroPresumido } from '@/lib/planejamento/simularLucroPresumido'
import { simularLucroReal } from '@/lib/planejamento/simularLucroReal'
import { simularIcms } from '@/lib/planejamento/simularIcms'
import type {
  PayloadSimulacao,
  RespostaSimulacao,
  DadosBrutosEmpresa,
  ResultadoComparativo,
} from '@/lib/planejamento/types'
import type { Empresa, DocumentoFiscal, DocumentoFiscalItem } from '@/lib/types'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 403 })

  let payload: PayloadSimulacao
  try {
    payload = await req.json() as PayloadSimulacao
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const { premissas } = payload
  if (!premissas?.empresaIds?.length) {
    return NextResponse.json({ error: 'Nenhuma empresa selecionada' }, { status: 400 })
  }
  if (!premissas.periodoInicial || !premissas.periodoFinal) {
    return NextResponse.json({ error: 'Período inválido' }, { status: 400 })
  }

  // Validar que as empresas pertencem à organização (segurança multi-tenant)
  const { data: empresasData, error: errEmpresas } = await supabase
    .from('empresas')
    .select('*')
    .eq('org_id', orgId)
    .in('id', premissas.empresaIds)

  if (errEmpresas) return NextResponse.json({ error: errEmpresas.message }, { status: 500 })
  if (!empresasData?.length) {
    return NextResponse.json({ error: 'Nenhuma empresa válida encontrada' }, { status: 404 })
  }

  const empresasValidas = empresasData as Empresa[]
  const idsValidos = empresasValidas.map(e => e.id)

  // Converter período "YYYY-MM" para "MM/YYYY" para consultar declarações
  const [anoIni, mesIni] = premissas.periodoInicial.split('-')
  const [anoFim, mesFim] = premissas.periodoFinal.split('-')
  const compInicial = `${mesIni}/${anoIni}`
  const compFinal = `${mesFim}/${anoFim}`

  // Buscar declarações PGDAS-D do período
  const declaracoes = await fetchAll<{
    empresa_id: string
    competencia: string
    receita_bruta_mes: number | null
    receita_bruta_acumulada_12m: number | null
    valor_total_devido: number | null
  }>((from, to) =>
    supabase.from('sn_declaracoes')
      .select('empresa_id, competencia, receita_bruta_mes, receita_bruta_acumulada_12m, valor_total_devido')
      .eq('org_id', orgId)
      .in('empresa_id', idsValidos)
      .gte('competencia', compInicial)
      .lte('competencia', compFinal)
      .range(from, to)
  )

  // Buscar receitas mensais (histórico xml/manual)
  const receitasMensais = await fetchAll<{
    empresa_id: string
    competencia: string
    receita_bruta_mes: number
    origem: string
  }>((from, to) =>
    supabase.from('sn_receitas_mensais')
      .select('empresa_id, competencia, receita_bruta_mes, origem')
      .eq('org_id', orgId)
      .in('empresa_id', idsValidos)
      .gte('competencia', compInicial)
      .lte('competencia', compFinal)
      .range(from, to)
  )

  // Buscar documentos fiscais do período
  const dataInicial = `${premissas.periodoInicial}-01`
  const dataFinal = `${premissas.periodoFinal}-31`

  const documentos = await fetchAll<DocumentoFiscal>((from, to) =>
    supabase.from('fa_documentos_fiscais')
      .select('*')
      .eq('org_id', orgId)
      .in('empresa_id', idsValidos)
      .gte('data_competencia', dataInicial)
      .lte('data_competencia', dataFinal)
      .range(from, to)
  )

  // Buscar itens dos documentos
  const docIds = documentos.map(d => d.id)
  let itens: DocumentoFiscalItem[] = []

  if (docIds.length > 0) {
    // Buscar em lotes de 500 IDs para evitar URLs longas
    const lotes = []
    for (let i = 0; i < docIds.length; i += 500) {
      lotes.push(docIds.slice(i, i + 500))
    }
    for (const lote of lotes) {
      const loteItens = await fetchAll<DocumentoFiscalItem>((from, to) =>
        supabase.from('fa_documentos_itens')
          .select('*')
          .eq('org_id', orgId)
          .in('documento_id', lote)
          .range(from, to)
      )
      itens = [...itens, ...loteItens]
    }
  }

  // Montar DadosBrutosEmpresa por empresa
  const dadosPorEmpresa: DadosBrutosEmpresa[] = empresasValidas.map(empresa => ({
    empresa,
    declaracoes: declaracoes.filter(d => d.empresa_id === empresa.id).map(d => ({
      competencia: d.competencia,
      receita_bruta_mes: d.receita_bruta_mes ?? undefined,
      receita_bruta_acumulada_12m: d.receita_bruta_acumulada_12m ?? undefined,
      valor_total_devido: d.valor_total_devido ?? undefined,
    })),
    receitasMensais: receitasMensais.filter(r => r.empresa_id === empresa.id),
    documentos: documentos.filter(d => d.empresa_id === empresa.id),
    itens: itens.filter(i => i.empresa_id === empresa.id),
  }))

  // Executar simulações
  const consolidacao = consolidarGrupo(dadosPorEmpresa)
  const lucroPresumido = simularLucroPresumido(dadosPorEmpresa, premissas)
  const lucroReal = simularLucroReal(dadosPorEmpresa, premissas)
  const icms = simularIcms(dadosPorEmpresa, premissas)

  const simplesAtual = consolidacao.simplesAtualTotal
  const melhorValor = Math.min(lucroPresumido.totalPeriodo, lucroReal.totalPeriodo)
  const economiaEstimada = simplesAtual - melhorValor

  const melhorRegime: ResultadoComparativo['melhorRegime'] =
    simplesAtual === 0 && melhorValor === 0
      ? 'indeterminado'
      : simplesAtual < lucroPresumido.totalPeriodo && simplesAtual < lucroReal.totalPeriodo
        ? 'simples'
        : lucroPresumido.totalPeriodo <= lucroReal.totalPeriodo
          ? 'presumido'
          : 'real'

  const confiancaGeral: ResultadoComparativo['confiancaGeral'] =
    lucroReal.confianca === 'alto' && lucroPresumido.confianca === 'alto'
      ? 'alto'
      : lucroReal.confianca === 'baixo' || simplesAtual === 0
        ? 'baixo'
        : 'medio'

  const resultado: ResultadoComparativo = {
    consolidacao,
    simplesAtual,
    lucroPresumido,
    lucroReal,
    icms,
    melhorRegime,
    economiaEstimada,
    confiancaGeral,
    premissas,
    alertasGerais: [
      ...consolidacao.alertas,
      'Esta simulação é estimativa para fins de planejamento. Não substitui análise contábil/fiscal profissional.',
      'Consulte um contador antes de tomar decisões de mudança de regime tributário.',
    ],
  }

  const resposta: RespostaSimulacao = {
    resultado,
    geradoEm: new Date().toISOString(),
  }

  return NextResponse.json(resposta)
}
