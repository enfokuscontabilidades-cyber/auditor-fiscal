import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { normalizarCompetencia } from '@/lib/fiscal/competencia'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { cfopEhDevolucaoVenda, cfopEhFaturamento } from '@/lib/simples/cfopReceita'
import type { DocumentoFiscal, DocumentoFiscalItem } from '@/lib/types'

type DocumentoComItens = DocumentoFiscal & {
  fa_documentos_itens?: DocumentoFiscalItem[]
}

function valorItem(item: DocumentoFiscalItem) {
  return Math.max(0, Number(item.valor_total ?? 0) - Number(item.valor_desconto ?? 0))
}

function legacyDocId(chave: string | null | undefined, numero: string | null | undefined, index: number) {
  return `legacy-${chave || numero || index}`
}

function impactoPorCfop(cfop: string | null | undefined) {
  if (cfop && cfopEhDevolucaoVenda(cfop)) return 'reduz_receita' as const
  if (cfop && cfopEhFaturamento(cfop)) return 'soma_receita' as const
  return 'sem_impacto' as const
}

type XmlFallbackItem = {
  descricao?: string | null
  ncm?: string | null
  cfop?: string | null
  cfop_entrada_sugerido?: string | null
  valor_contabil?: number | null
  valor_total?: number | null
  quantidade?: number | null
  cancelada?: boolean | null
}

type XmlFallbackRow = {
  id: string
  chave_nfe?: string | null
  numero_nf?: string | null
  data_emissao?: string | null
  emitente_cnpj?: string | null
  emitente_nome?: string | null
  destinatario_cnpj?: string | null
  destinatario_nome?: string | null
  tipo_operacao?: string | null
  valor_total?: number | null
  status?: string | null
  parsed_data?: {
    itens_entrada?: XmlFallbackItem[]
    itens_saida?: XmlFallbackItem[]
  } | null
  created_at?: string | null
}

function dataParaCompetencia(data: string | null | undefined) {
  if (!data) return null
  const ymd = data.split('T')[0].split('-')
  if (ymd.length < 2) return null
  return `${ymd[1]}/${ymd[0]}`
}

function numero(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function quantidade(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  const competencia = normalizarCompetencia(searchParams.get('competencia'))

  if (!empresaId || !competencia) {
    return NextResponse.json({ error: 'empresa_id e competencia sao obrigatorios' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const documentos = await fetchAll<DocumentoComItens>((from, to) =>
    supabase
      .from('fa_documentos_fiscais')
      .select('*, fa_documentos_itens(*)')
      .eq('empresa_id', empresaId)
      .eq('data_competencia', competencia)
      .order('data_emissao', { ascending: true })
      .range(from, to)
  )

  function resolveImpactoDoc(
    impacto: string | null | undefined,
    tipoMov: string | null | undefined,
  ): string {
    if (impacto && impacto !== 'pendente_revisao') return impacto
    if (tipoMov === 'saida') return 'soma_receita'
    if (tipoMov === 'devolucao_venda') return 'reduz_receita'
    if (tipoMov === 'entrada') return 'sem_impacto'
    return impacto ?? 'pendente_revisao'
  }

  function resolveImpactoItem(
    impacto: string | null | undefined,
    cfop: string | null | undefined,
    tipoMov: string | null | undefined,
  ): string {
    if (impacto && impacto !== 'pendente_revisao') return impacto
    if (cfop) {
      if (cfopEhDevolucaoVenda(cfop)) return 'reduz_receita'
      if (cfopEhFaturamento(cfop)) return 'soma_receita'
    }
    if (tipoMov === 'saida') return 'soma_receita'
    if (tipoMov === 'devolucao_venda') return 'reduz_receita'
    if (tipoMov === 'entrada') return 'sem_impacto'
    return impacto ?? 'pendente_revisao'
  }

  let docsValidos: DocumentoComItens[] = documentos
    .filter(doc => doc.status !== 'cancelada')
    .map(doc => ({
      ...doc,
      impacto_receita: resolveImpactoDoc(doc.impacto_receita, doc.tipo_movimento) as DocumentoFiscal['impacto_receita'],
    }))
  let itens: DocumentoFiscalItem[] = docsValidos.flatMap(doc =>
    (doc.fa_documentos_itens ?? []).map(item => ({
      ...item,
      impacto_receita: resolveImpactoItem(item.impacto_receita, item.cfop, item.tipo_movimento) as DocumentoFiscalItem['impacto_receita'],
      natureza_receita_simples: (
        item.natureza_receita_simples && item.natureza_receita_simples !== 'pendente'
          ? item.natureza_receita_simples
          : resolveImpactoItem(item.impacto_receita, item.cfop, item.tipo_movimento) === 'soma_receita'
            ? 'tributada'
            : resolveImpactoItem(item.impacto_receita, item.cfop, item.tipo_movimento) === 'reduz_receita'
              ? 'devolucao'
              : 'nao_receita'
      ) as DocumentoFiscalItem['natureza_receita_simples'],
    }))
  )
  let fonte = 'fa_documentos_fiscais'

  if (docsValidos.length === 0) {
    const xmlRows = await fetchAll<XmlFallbackRow>((from, to) =>
      supabase
        .from('fa_arquivos_xml')
        .select('id, chave_nfe, numero_nf, data_emissao, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, tipo_operacao, valor_total, status, parsed_data, created_at')
        .eq('empresa_id', empresaId)
        .order('data_emissao', { ascending: true })
        .range(from, to)
    )

    const xmlDaCompetencia = xmlRows.filter(row =>
      row.status !== 'cancelada' && dataParaCompetencia(row.data_emissao) === competencia
    )

    const itensFallback: DocumentoFiscalItem[] = []
    docsValidos = xmlDaCompetencia.map((row, index) => {
      const docId = legacyDocId(row.chave_nfe, row.numero_nf, index)
      const itensRow = [
        ...(row.parsed_data?.itens_entrada ?? []).map(item => ({
          ...item,
          cfop: item.cfop_entrada_sugerido || item.cfop,
          tipo_operacao: 'entrada' as const,
        })),
        ...(row.parsed_data?.itens_saida ?? []).map(item => ({
          ...item,
          tipo_operacao: 'saida' as const,
        })),
      ].filter(item => !item.cancelada)

      const impactos = itensRow.map(item => impactoPorCfop(item.cfop))
      const impacto = impactos.includes('reduz_receita')
        ? 'reduz_receita'
        : impactos.includes('soma_receita') || row.tipo_operacao === 'saida'
          ? 'soma_receita'
          : 'sem_impacto'

      itensRow.forEach((item, itemIndex) => {
        const itemImpacto = impactoPorCfop(item.cfop)
        const valorTotal = numero(item.valor_contabil ?? item.valor_total)
        const qtd = quantidade(item.quantidade)
        itensFallback.push({
          id: `legacy-item-${docId}-${itemIndex}`,
          org_id: orgId,
          empresa_id: empresaId,
          documento_id: docId,
          item_numero: itemIndex + 1,
          descricao: item.descricao ?? undefined,
          ncm: item.ncm ?? undefined,
          cfop: item.cfop ?? undefined,
          quantidade: qtd,
          valor_unitario: qtd > 0 ? valorTotal / qtd : valorTotal,
          valor_total: valorTotal,
          valor_desconto: 0,
          valor_frete: 0,
          valor_bc_icms: 0,
          aliquota_icms: 0,
          valor_icms: 0,
          valor_bc_st: 0,
          valor_st: 0,
          valor_bc_pis: 0,
          aliquota_pis: 0,
          valor_pis: 0,
          valor_bc_cofins: 0,
          aliquota_cofins: 0,
          valor_cofins: 0,
          valor_ipi: 0,
          classificacao: 'outros',
          natureza_receita_simples: itemImpacto === 'reduz_receita' ? 'devolucao' : itemImpacto === 'soma_receita' ? 'tributada' : 'nao_receita',
          tipo_movimento: itemImpacto === 'reduz_receita' ? 'devolucao_venda' : item.tipo_operacao,
          impacto_receita: itemImpacto,
          classificacao_manual: false,
          created_at: row.created_at ?? '',
        } satisfies DocumentoFiscalItem)
      })

      return {
        id: docId,
        org_id: orgId,
        empresa_id: empresaId,
        tipo_documento: 'nfe',
        origem: 'xml_nfe',
        chave_acesso: row.chave_nfe ?? undefined,
        numero: row.numero_nf ?? undefined,
        modelo: '55',
        data_emissao: row.data_emissao ?? undefined,
        data_competencia: competencia,
        emitente_cnpj: row.emitente_cnpj ?? undefined,
        emitente_nome: row.emitente_nome ?? undefined,
        destinatario_cnpj: row.destinatario_cnpj ?? undefined,
        destinatario_nome: row.destinatario_nome ?? undefined,
        valor_total: numero(row.valor_total),
        valor_produtos: numero(row.valor_total),
        valor_servicos: 0,
        valor_desconto: 0,
        valor_frete: 0,
        valor_icms: 0,
        valor_pis: 0,
        valor_cofins: 0,
        valor_st: 0,
        valor_ipi: 0,
        tipo_movimento: impacto === 'reduz_receita' ? 'devolucao_venda' : row.tipo_operacao === 'saida' ? 'saida' : 'entrada',
        impacto_receita: impacto,
        origem_devolucao: impacto === 'reduz_receita' ? 'emitida_terceiro' : 'nao_aplicavel',
        status: 'ok',
        created_at: row.created_at ?? '',
        updated_at: row.created_at ?? '',
      } satisfies DocumentoComItens
    })

    itens = itensFallback
    fonte = docsValidos.length > 0 ? 'fa_arquivos_xml' : fonte
  }

  const itensReceita = itens.filter(item => item.impacto_receita === 'soma_receita')
  const itensDevolucao = itens.filter(item => item.impacto_receita === 'reduz_receita')
  const docsReceita = docsValidos.filter(doc => doc.impacto_receita === 'soma_receita')
  const docsDevolucao = docsValidos.filter(doc => doc.impacto_receita === 'reduz_receita')

  const totalFaturamento = itens.length > 0
    ? itensReceita.reduce((sum, item) => sum + valorItem(item), 0)
    : docsReceita.reduce((sum, doc) => sum + Number(doc.valor_total ?? 0), 0)

  const totalDevolucao = itens.length > 0
    ? itensDevolucao.reduce((sum, item) => sum + valorItem(item), 0)
    : docsDevolucao.reduce((sum, doc) => sum + Number(doc.valor_total ?? 0), 0)

  const docsReceitaIds = itens.length > 0
    ? new Set(itensReceita.map(item => item.documento_id)).size
    : docsReceita.length

  return NextResponse.json({
    competencia,
    fonte,
    status: docsValidos.length > 0 ? 'ok' : 'sem_documentos',
    resumo: {
      qtd_documentos: docsValidos.length,
      qtd_notas_receita: docsReceitaIds,
      qtd_itens: itens.length,
      faturamento: totalFaturamento,
      devolucoes: totalDevolucao,
      receita_liquida: totalFaturamento - totalDevolucao,
    },
    documentos: docsValidos,
    itens,
  })
}
