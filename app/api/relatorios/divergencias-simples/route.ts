import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { competenciaKey, competenciasEntre, normalizarCompetencia } from '@/lib/fiscal/competencia'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { carregarXmlLegacy, type XmlLegacyItem } from '@/lib/fiscal/xmlLegacy'
import { cfopEhDevolucaoVenda, cfopEhFaturamento } from '@/lib/simples/cfopReceita'
import type { DocumentoFiscal, DocumentoFiscalItem } from '@/lib/types'

type Declaracao = {
  competencia: string
  receita_bruta_mes: number | null
}

type DocumentoComItens = DocumentoFiscal & {
  fa_documentos_itens?: DocumentoFiscalItem[]
}

type Candidato = {
  documento_id: string
  numero: string
  data_emissao: string | null
  participante: string
  cfops: string
  movimento: string
  impacto_receita: string
  valor: number
  motivo: string
}

function valorItem(item: DocumentoFiscalItem) {
  return Math.max(0, Number(item.valor_total ?? 0) - Number(item.valor_desconto ?? 0))
}

function valorLegacyItem(item: XmlLegacyItem) {
  return Math.max(0, Number(item.valor_total ?? 0))
}

function participante(doc: DocumentoFiscal) {
  if (doc.tipo_movimento === 'entrada' || doc.tipo_movimento === 'devolucao_venda') {
    return doc.emitente_nome || doc.emitente_cnpj || 'Nao informado'
  }
  return doc.destinatario_nome || doc.destinatario_cnpj || 'Nao informado'
}

function pct(diff: number, base: number) {
  if (base <= 0) return diff === 0 ? 0 : 1
  return Math.abs(diff) / base
}

function statusDivergencia(diffPct: number) {
  if (diffPct <= 0.01) return 'ok'
  if (diffPct <= 0.05) return 'alerta'
  return 'critico'
}

function resolveImpactoDoc(
  impacto: string | null | undefined,
  tipoMovimento: string | null | undefined,
) {
  if (impacto && impacto !== 'pendente_revisao') return impacto
  if (tipoMovimento === 'saida') return 'soma_receita'
  if (tipoMovimento === 'devolucao_venda') return 'reduz_receita'
  if (tipoMovimento === 'entrada') return 'sem_impacto'
  return impacto ?? 'pendente_revisao'
}

function resolveImpactoItem(
  impacto: string | null | undefined,
  cfop: string | null | undefined,
  tipoMovimento: string | null | undefined,
) {
  if (impacto && impacto !== 'pendente_revisao') return impacto
  if (cfop) {
    if (cfopEhDevolucaoVenda(cfop)) return 'reduz_receita'
    if (cfopEhFaturamento(cfop)) return 'soma_receita'
  }
  if (tipoMovimento === 'saida') return 'soma_receita'
  if (tipoMovimento === 'devolucao_venda') return 'reduz_receita'
  if (tipoMovimento === 'entrada') return 'sem_impacto'
  return impacto ?? 'pendente_revisao'
}

function impactoLegacyItem(item: XmlLegacyItem) {
  return resolveImpactoItem(null, item.cfop, item.tipo_operacao)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  const inicio = normalizarCompetencia(searchParams.get('competencia_inicio'))
  const fim = normalizarCompetencia(searchParams.get('competencia_fim'))

  if (!empresaId) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  try {
  let declaracoesQuery = supabase
    .from('sn_declaracoes')
    .select('competencia, receita_bruta_mes')
    .eq('empresa_id', empresaId)

  const competenciasFiltro = competenciasEntre(inicio, fim)
  if (competenciasFiltro.length > 0) declaracoesQuery = declaracoesQuery.in('competencia', competenciasFiltro)

  const { data: declaracoesData, error: declaracoesError } = await declaracoesQuery
  if (declaracoesError) return NextResponse.json({ error: declaracoesError.message }, { status: 500 })

  const declaracoes = (declaracoesData ?? []) as Declaracao[]
  const compsDeclaradas = declaracoes.map(d => d.competencia).filter(Boolean)
  const competencias = (competenciasFiltro.length > 0
    ? competenciasFiltro
    : compsDeclaradas
  ).sort((a, b) => competenciaKey(a) - competenciaKey(b))

  if (competencias.length === 0) return NextResponse.json([])

  const documentos = await fetchAll<DocumentoComItens>((from, to) =>
    supabase
      .from('fa_documentos_fiscais')
      .select('*, fa_documentos_itens(*)')
      .eq('empresa_id', empresaId)
      .in('data_competencia', competencias)
      .order('data_emissao', { ascending: true })
      .range(from, to)
  )

  const declaracaoPorComp = new Map(declaracoes.map(d => [d.competencia, Number(d.receita_bruta_mes ?? 0)]))
  const docsPorComp = new Map<string, DocumentoComItens[]>()
  for (const doc of documentos) {
    if (doc.status === 'cancelada' || !doc.data_competencia) continue
    const lista = docsPorComp.get(doc.data_competencia) ?? []
    lista.push(doc)
    docsPorComp.set(doc.data_competencia, lista)
  }

  const competenciasSemDocs = competencias.filter(comp => !docsPorComp.has(comp))
  const legacyPorComp = new Map<string, XmlLegacyItem[]>()
  if (competenciasSemDocs.length > 0) {
    const legacy = await carregarXmlLegacy({
      supabase,
      empresaId,
      competenciaInicio: competenciasSemDocs[0],
      competenciaFim: competenciasSemDocs[competenciasSemDocs.length - 1],
    })

    for (const item of legacy) {
      if (!item.competencia || !competenciasSemDocs.includes(item.competencia)) continue
      const lista = legacyPorComp.get(item.competencia) ?? []
      lista.push(item)
      legacyPorComp.set(item.competencia, lista)
    }
  }

  const resultado = competencias.map(comp => {
    const docs = docsPorComp.get(comp) ?? []
    let faturamento = 0
    let devolucoes = 0

    const candidatosIncluidos: Candidato[] = []
    const candidatosFora: Candidato[] = []

    if (docs.length > 0) for (const doc of docs) {
      const itens = doc.fa_documentos_itens ?? []
      const cfops = Array.from(new Set(itens.map(item => item.cfop).filter(Boolean))).join(', ')
      const totalItensSoma = itens
        .filter(item => resolveImpactoItem(item.impacto_receita, item.cfop, item.tipo_movimento) === 'soma_receita')
        .reduce((sum, item) => sum + valorItem(item), 0)
      const totalItensReduz = itens
        .filter(item => resolveImpactoItem(item.impacto_receita, item.cfop, item.tipo_movimento) === 'reduz_receita')
        .reduce((sum, item) => sum + valorItem(item), 0)
      const totalDoc = Number(doc.valor_total ?? 0)
      const impactoDoc = resolveImpactoDoc(doc.impacto_receita, doc.tipo_movimento)
      const valorSoma = itens.length > 0 ? totalItensSoma : impactoDoc === 'soma_receita' ? totalDoc : 0
      const valorReduz = itens.length > 0 ? totalItensReduz : impactoDoc === 'reduz_receita' ? totalDoc : 0
      const valorSemImpacto = itens.length > 0
        ? itens.filter(item => resolveImpactoItem(item.impacto_receita, item.cfop, item.tipo_movimento) === 'sem_impacto').reduce((sum, item) => sum + valorItem(item), 0)
        : impactoDoc === 'sem_impacto' ? totalDoc : 0

      faturamento += valorSoma
      devolucoes += valorReduz

      if (valorSoma > 0) {
        candidatosIncluidos.push({
          documento_id: doc.id,
          numero: doc.numero || 'Sem numero',
          data_emissao: doc.data_emissao ?? null,
          participante: participante(doc),
          cfops,
          movimento: doc.tipo_movimento,
          impacto_receita: 'soma_receita',
          valor: valorSoma,
          motivo: 'Incluida no faturamento XML; verificar se deveria entrar no PGDAS.',
        })
      }

      if (valorSemImpacto > 0) {
        candidatosFora.push({
          documento_id: doc.id,
          numero: doc.numero || 'Sem numero',
          data_emissao: doc.data_emissao ?? null,
          participante: participante(doc),
          cfops,
          movimento: doc.tipo_movimento,
          impacto_receita: 'sem_impacto',
          valor: valorSemImpacto,
          motivo: 'Fora do faturamento do Simples; verificar se algum CFOP deveria compor receita.',
        })
      }
    }

    const legacyItens = docs.length === 0 ? legacyPorComp.get(comp) ?? [] : []
    if (legacyItens.length > 0) {
      const itensPorDoc = new Map<string, XmlLegacyItem[]>()
      for (const item of legacyItens) {
        const chave = item.chave_nfe || `${item.numero_nf ?? ''}-${item.tipo_operacao ?? ''}-${item.data_emissao ?? ''}`
        const lista = itensPorDoc.get(chave) ?? []
        lista.push(item)
        itensPorDoc.set(chave, lista)
      }

      for (const [chave, itens] of itensPorDoc.entries()) {
        const primeiro = itens[0]
        const cfops = Array.from(new Set(itens.map(item => item.cfop).filter(Boolean))).join(', ')
        const valorSoma = itens
          .filter(item => impactoLegacyItem(item) === 'soma_receita')
          .reduce((sum, item) => sum + valorLegacyItem(item), 0)
        const valorReduz = itens
          .filter(item => impactoLegacyItem(item) === 'reduz_receita')
          .reduce((sum, item) => sum + valorLegacyItem(item), 0)
        const valorSemImpacto = itens
          .filter(item => impactoLegacyItem(item) === 'sem_impacto')
          .reduce((sum, item) => sum + valorLegacyItem(item), 0)

        faturamento += valorSoma
        devolucoes += valorReduz

        if (valorSoma > 0) {
          candidatosIncluidos.push({
            documento_id: `legacy-${chave}`,
            numero: primeiro.numero_nf || 'Sem numero',
            data_emissao: primeiro.data_emissao ?? null,
            participante: primeiro.destinatario_nome || primeiro.destinatario_cnpj || 'Nao informado',
            cfops,
            movimento: 'saida',
            impacto_receita: 'soma_receita',
            valor: valorSoma,
            motivo: 'Incluida no faturamento XML; verificar se deveria entrar no PGDAS.',
          })
        }

        if (valorSemImpacto > 0) {
          candidatosFora.push({
            documento_id: `legacy-${chave}`,
            numero: primeiro.numero_nf || 'Sem numero',
            data_emissao: primeiro.data_emissao ?? null,
            participante: primeiro.emitente_nome || primeiro.emitente_cnpj || 'Nao informado',
            cfops,
            movimento: primeiro.tipo_operacao ?? 'nao_identificado',
            impacto_receita: 'sem_impacto',
            valor: valorSemImpacto,
            motivo: 'Fora do faturamento do Simples; verificar se algum CFOP deveria compor receita.',
          })
        }
      }
    }

    const receitaXml = faturamento - devolucoes
    const receitaPgdas = declaracaoPorComp.get(comp) ?? 0
    const diff = receitaXml - receitaPgdas
    const diffPct = pct(diff, receitaPgdas)
    const candidatos = (diff < 0 ? candidatosFora : candidatosIncluidos)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 50)

    return {
      competencia: comp,
      receita_pgdas: receitaPgdas,
      receita_xml: receitaXml,
      faturamento_xml: faturamento,
      devolucoes_xml: devolucoes,
      diferenca: diff,
      variacao: diffPct,
      status: receitaPgdas === 0 && receitaXml === 0 ? 'sem_dados' : statusDivergencia(diffPct),
      qtd_documentos: docs.length || new Set(legacyItens.map(item => item.chave_nfe || `${item.numero_nf ?? ''}-${item.tipo_operacao ?? ''}-${item.data_emissao ?? ''}`)).size,
      qtd_candidatos: candidatos.length,
      candidatos,
    }
  }).filter(row => row.status !== 'ok' && row.status !== 'sem_dados')

  return NextResponse.json(resultado)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
