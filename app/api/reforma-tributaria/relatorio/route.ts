import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { getContextoAcesso, canGenerateReport, MENSAGENS_RT } from '@/lib/planos/acessoReformaTributaria'
import {
  analisarDocumentosReforma,
  type ItemBrutoReforma,
  type DocumentoParaAnaliseReforma,
  type GrupoDivergenciaReforma,
  type ResumoAnaliseReforma,
} from '@/lib/fiscal/resumoReformaTributaria'
import {
  montarLinhasReforma,
  filtrarLinhasReforma,
  type DocumentoFiscalReforma,
  type ArquivoXmlFiscalReforma,
  type LinhaReforma,
} from '@/lib/fiscal/linhasReformaTributaria'
import { PARAMETROS_REFORMA_2026, type ParametrosReferenciaReforma } from '@/lib/fiscal/parametrosReforma2026'
import {
  validarParametrosEspecificos,
  parametrosEspecificosParaReferencia,
  parametrosClienteParaReferencia,
  salvarNovaVersaoParametrosCliente,
  type ParametrosEspecificosInput,
} from '@/lib/fiscal/parametrosClienteReforma'
import { gerarRelatorioReformaAutenticadoPdf } from '@/lib/pdf/gerarRelatorioReformaAutenticado'
import type { AnexoDocumentoReforma } from '@/lib/pdf/RelatorioReformaAutenticadoPdf'
import { gerarRelatorioReformaContadorClientePdf } from '@/lib/pdf/gerarRelatorioReformaContadorCliente'
import type { DocumentoSemDestaqueReforma } from '@/lib/pdf/RelatorioReformaContadorClientePdf'
import { formatarCnpj } from '@/lib/validacao/documentos'
import { NextResponse } from 'next/server'
import type { ModoParametrosReforma, ReportAudience, RtParametrosCliente } from '@/lib/types'

export const runtime = 'nodejs'

const LABEL_TIPO_DOCUMENTO: Record<string, string> = {
  nfe: 'NF-e', nfce: 'NFC-e', nfse: 'NFS-e', cte: 'CT-e', pgdas: 'PGDAS', sped: 'SPED', outro: 'Documento',
}

const LIMITE_NUMERO_RELATORIO = 1_000_000_000_000

interface RelatorioBody {
  empresa_id?: string
  competencia?: string
  reportAudience?: ReportAudience
  modoParametros?: ModoParametrosReforma
  parametrosEspecificos?: Partial<ParametrosEspecificosInput>
  usarParametrosSalvos?: boolean
  salvarComoReferenciaCliente?: boolean
}

function numeroSeguroRelatorio(valor: number | null | undefined): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 0
  if (Math.abs(valor) > LIMITE_NUMERO_RELATORIO) return 0
  return valor
}

function inteiroSeguroRelatorio(valor: number): number {
  const seguro = numeroSeguroRelatorio(valor)
  return Math.max(0, Math.floor(seguro))
}

function corHexSegura(valor: string | null | undefined): string | null {
  const cor = valor?.trim()
  return cor && /^#[0-9a-f]{6}$/i.test(cor) ? cor : null
}

function sanitizarResumoRelatorio(resumo: ResumoAnaliseReforma): ResumoAnaliseReforma {
  return {
    totalDocumentos: inteiroSeguroRelatorio(resumo.totalDocumentos),
    totalItens: inteiroSeguroRelatorio(resumo.totalItens),
    documentosAdequados: inteiroSeguroRelatorio(resumo.documentosAdequados),
    documentosAtencao: inteiroSeguroRelatorio(resumo.documentosAtencao),
    documentosCriticos: inteiroSeguroRelatorio(resumo.documentosCriticos),
    documentosAfetados: inteiroSeguroRelatorio(resumo.documentosAfetados),
    itensAdequados: inteiroSeguroRelatorio(resumo.itensAdequados),
    itensAtencao: inteiroSeguroRelatorio(resumo.itensAtencao),
    itensCriticos: inteiroSeguroRelatorio(resumo.itensCriticos),
    itensAfetados: inteiroSeguroRelatorio(resumo.itensAfetados),
    tiposDivergencia: inteiroSeguroRelatorio(resumo.tiposDivergencia),
    ocorrenciasDivergencia: inteiroSeguroRelatorio(resumo.ocorrenciasDivergencia),
    totalIbs: numeroSeguroRelatorio(resumo.totalIbs),
    totalCbs: numeroSeguroRelatorio(resumo.totalCbs),
  }
}

function sanitizarGruposRelatorio(grupos: GrupoDivergenciaReforma[]): GrupoDivergenciaReforma[] {
  return grupos.map(grupo => ({
    ...grupo,
    totalDocumentos: inteiroSeguroRelatorio(grupo.totalDocumentos),
    totalItens: inteiroSeguroRelatorio(grupo.totalItens),
  }))
}

function linhasParaDocumentosAnalise(linhas: LinhaReforma[]): DocumentoParaAnaliseReforma[] {
  const porDocumento = new Map<string, DocumentoParaAnaliseReforma>()

  for (const linha of linhas) {
    const chaveDocumento = linha.documentoId || `${linha.nota}-${linha.data}`
    let doc = porDocumento.get(chaveDocumento)
    if (!doc) {
      doc = {
        id: chaveDocumento,
        numero: linha.nota,
        serie: '-',
        tipoDocumento: 'nfe',
        dataEmissao: linha.data || null,
        destinatarioNome: linha.participante,
        destinatarioCnpj: null,
        itens: [],
      }
      porDocumento.set(chaveDocumento, doc)
    }

    doc.itens.push({
      cst_ibs_cbs: linha.cst === '-' ? null : linha.cst,
      cclass_trib: linha.cclass === '-' ? null : linha.cclass,
      valor_bc_ibs_cbs: numeroSeguroRelatorio(linha.base),
      valor_total: numeroSeguroRelatorio(linha.valorItem),
      aliquota_ibs_uf: numeroSeguroRelatorio(linha.aliquotaIbsUf),
      valor_ibs_uf: numeroSeguroRelatorio(linha.valorIbsUf),
      aliquota_ibs_mun: numeroSeguroRelatorio(linha.aliquotaIbsMun),
      valor_ibs_mun: numeroSeguroRelatorio(linha.valorIbsMun),
      valor_ibs: numeroSeguroRelatorio(linha.valorIbs),
      aliquota_cbs: numeroSeguroRelatorio(linha.aliquotaCbs),
      valor_cbs: numeroSeguroRelatorio(linha.valorCbs),
      data_emissao: linha.data || null,
    } satisfies ItemBrutoReforma)
  }

  return Array.from(porDocumento.values())
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json() as RelatorioBody
  const { empresa_id: empresaId, competencia } = body
  const reportAudience: ReportAudience = body.reportAudience === 'accountant_client' ? 'accountant_client' : 'company'
  if (!empresaId) return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const ctx = await getContextoAcesso(supabase, orgId)
  if (!canGenerateReport(ctx)) {
    return NextResponse.json({ error: MENSAGENS_RT.assinaturaInativa, codigo: 'ASSINATURA_INATIVA' }, { status: 403 })
  }

  const { data: empresa } = await supabase.from('empresas').select('razao_social, cnpj').eq('id', empresaId).single()
  if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

  const admin = createAdminClient()

  // ── Resolve os parâmetros e o modo de análise ────────────────────────────
  // Versão empresarial: comportamento IDÊNTICO ao já aprovado — nunca passa
  // `opcoes`, então o motor resolve os parâmetros automaticamente por data
  // de emissão (getParametrosReformaPorData), exatamente como antes desta
  // funcionalidade existir.
  let modoParametros: ModoParametrosReforma = 'padrao_2026'
  let parametrosResolvidos: ParametrosReferenciaReforma = PARAMETROS_REFORMA_2026
  let modoEstrutural = false
  let observacaoParametros: string | undefined
  let opcoesAnalise: { parametros?: ParametrosReferenciaReforma; modoEstrutural?: boolean } | undefined

  if (reportAudience === 'accountant_client') {
    if (!body.modoParametros) {
      return NextResponse.json({ error: 'Selecione qual referência tributária deve ser utilizada nesta análise.' }, { status: 400 })
    }
    modoParametros = body.modoParametros

    if (modoParametros === 'padrao_2026') {
      parametrosResolvidos = PARAMETROS_REFORMA_2026
    } else if (modoParametros === 'estrutural') {
      modoEstrutural = true
      parametrosResolvidos = { ...PARAMETROS_REFORMA_2026, versao: 'estrutural' }
    } else {
      // específico — carrega o salvo (se pedido) ou valida o recém-digitado
      if (body.usarParametrosSalvos) {
        const { data: vigente } = await supabase
          .from('rt_parametros_cliente')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .maybeSingle()
        if (!vigente) {
          return NextResponse.json({ error: 'Nenhum parâmetro específico salvo para esta empresa ainda.' }, { status: 400 })
        }
        parametrosResolvidos = parametrosClienteParaReferencia(vigente as RtParametrosCliente)
        observacaoParametros = (vigente as RtParametrosCliente).observacao ?? undefined
      } else {
        const input: ParametrosEspecificosInput = {
          aliquotaCbs: Number(body.parametrosEspecificos?.aliquotaCbs),
          aliquotaIbsTotal: body.parametrosEspecificos?.aliquotaIbsTotal != null ? Number(body.parametrosEspecificos.aliquotaIbsTotal) : undefined,
          aliquotaIbsUf: body.parametrosEspecificos?.aliquotaIbsUf != null ? Number(body.parametrosEspecificos.aliquotaIbsUf) : undefined,
          aliquotaIbsMun: body.parametrosEspecificos?.aliquotaIbsMun != null ? Number(body.parametrosEspecificos.aliquotaIbsMun) : undefined,
          cst: String(body.parametrosEspecificos?.cst ?? ''),
          cclassTrib: String(body.parametrosEspecificos?.cclassTrib ?? ''),
          observacao: body.parametrosEspecificos?.observacao?.trim() || undefined,
          vigenciaInicio: String(body.parametrosEspecificos?.vigenciaInicio ?? ''),
          vigenciaFim: body.parametrosEspecificos?.vigenciaFim?.trim() || undefined,
        }
        const erros = validarParametrosEspecificos(input)
        if (erros.length > 0) {
          return NextResponse.json({ error: 'Parâmetros específicos inválidos', detalhes: erros }, { status: 400 })
        }

        let versaoLabel = 'especifico'
        if (body.salvarComoReferenciaCliente) {
          const resultado = await salvarNovaVersaoParametrosCliente(admin, {
            orgId, empresaId, input, userId: user.id, userEmail: user.email ?? null,
          })
          if ('erro' in resultado) return NextResponse.json({ error: resultado.erro }, { status: 500 })
          versaoLabel = `cliente-v${resultado.versao}`
        }

        parametrosResolvidos = parametrosEspecificosParaReferencia(input, versaoLabel)
        observacaoParametros = input.observacao
      }
    }

    opcoesAnalise = { parametros: parametrosResolvidos, modoEstrutural }
  }

  // ── Escritório emitente (só necessário na versão do contador) ────────────
  let escritorio: {
    nome: string; razaoSocial: string | null; cnpjFormatado: string | null; telefone: string | null
    whatsapp: string | null; email: string | null; site: string | null; cidade: string | null; estado: string | null
    contadorResponsavel: string | null; crc: string | null; corPrincipal: string | null
  } | null = null
  let logoPathEscritorio: string | null = null

  if (reportAudience === 'accountant_client') {
    const { data: perfil } = await supabase.from('rt_escritorio_perfil').select('*').eq('org_id', orgId).maybeSingle()
    if (!perfil?.nome) {
      return NextResponse.json({ error: 'Cadastre o nome do escritório em Configurações antes de gerar a versão para o cliente.' }, { status: 400 })
    }
    escritorio = {
      nome: perfil.nome,
      razaoSocial: perfil.razao_social,
      cnpjFormatado: perfil.cnpj ? formatarCnpj(perfil.cnpj) : null,
      telefone: perfil.telefone,
      whatsapp: perfil.whatsapp,
      email: perfil.email,
      site: perfil.site,
      cidade: perfil.cidade,
      estado: perfil.estado,
      contadorResponsavel: perfil.contador_responsavel,
      crc: perfil.crc,
      corPrincipal: corHexSegura(perfil.cor_principal),
    }
    logoPathEscritorio = perfil.logo_path
  }

  // ── Coleta e classifica os documentos (mesmo motor para as duas versões) ─
  const [docsResult, xmlsResult] = await Promise.all([
    fetchAll((from, to) => supabase
      .from('fa_documentos_fiscais')
      .select('id, numero, data_emissao, data_competencia, destinatario_nome, destinatario_cnpj, tipo_movimento, ' +
        'fa_documentos_itens(id, codigo_produto, descricao, ncm, cfop, valor_total, cst_ibs_cbs, cclass_trib, valor_bc_ibs_cbs, ' +
        'aliquota_ibs_uf, valor_ibs_uf, aliquota_ibs_mun, valor_ibs_mun, valor_ibs, aliquota_cbs, valor_cbs)')
      .eq('empresa_id', empresaId)
      .order('data_emissao', { ascending: false })
      .range(from, to)),
    fetchAll((from, to) => supabase
      .from('fa_arquivos_xml')
      .select('id, numero_nf, data_emissao, competencia, tipo_operacao, destinatario_nome, destinatario_cnpj, parsed_data')
      .eq('empresa_id', empresaId)
      .eq('tipo_operacao', 'saida')
      .order('data_emissao', { ascending: false })
      .range(from, to)),
  ])

  const linhas = montarLinhasReforma(
    docsResult as unknown as DocumentoFiscalReforma[],
    xmlsResult as unknown as ArquivoXmlFiscalReforma[],
  )
  const linhasRelatorio = filtrarLinhasReforma(linhas, { competencia })
  const documentosParaAnalise = linhasParaDocumentosAnalise(linhasRelatorio)

  const { resumo, grupos, documentos: documentosAnalisados } = analisarDocumentosReforma(documentosParaAnalise, opcoesAnalise)
  const resumoRelatorio = sanitizarResumoRelatorio(resumo)
  const gruposRelatorio = sanitizarGruposRelatorio(grupos)

  const anexoDocumentos: AnexoDocumentoReforma[] = documentosAnalisados.map(d => ({
    nota: d.numero,
    data: d.data,
    participante: d.participante,
    situacao: d.situacao,
    valorIbs: numeroSeguroRelatorio(d.valorIbs),
    valorCbs: numeroSeguroRelatorio(d.valorCbs),
  }))

  const documentosSemDestaque: DocumentoSemDestaqueReforma[] = documentosAnalisados
    .filter(d => d.situacao !== 'ok')
    .map(d => ({
      tipoDocumento: LABEL_TIPO_DOCUMENTO[d.tipoDocumento] ?? 'Documento',
      numero: d.numero, serie: d.serie, data: d.data,
      itensAfetados: inteiroSeguroRelatorio(d.itensAfetados), principalDivergencia: d.principalDivergencia, status: d.situacao,
    }))

  const codigoRelatorio = crypto.randomUUID().slice(0, 8).toUpperCase()
  const empresaCnpjFormatado = empresa.cnpj ? formatarCnpj(empresa.cnpj) : '-'

  let buffer: Buffer
  try {
    buffer = reportAudience === 'accountant_client' && escritorio
      ? await gerarRelatorioReformaContadorClientePdf({
          codigoRelatorio,
          empresaNome: empresa.razao_social,
          empresaCnpjFormatado,
          competencia: competencia || undefined,
          dataEmissao: new Date(),
          parametros: parametrosResolvidos,
          modoParametros,
          observacaoParametros,
          resumo: resumoRelatorio,
          grupos: gruposRelatorio,
          documentosSemDestaque,
          escritorio,
        }, logoPathEscritorio)
      : await gerarRelatorioReformaAutenticadoPdf({
          empresaNome: empresa.razao_social,
          empresaCnpjFormatado,
          competencia: competencia || undefined,
          dataEmissao: new Date(),
          parametros: PARAMETROS_REFORMA_2026,
          resumo: resumoRelatorio,
          grupos: gruposRelatorio,
          anexoDocumentos,
        })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erro ao renderizar o PDF.',
      codigo: 'PDF_RENDER_ERROR',
    }, { status: 500 })
  }

  const hashArquivo = createHash('sha256').update(buffer).digest('hex')

  await admin.from('rt_relatorios_gerados').insert({
    org_id: orgId,
    empresa_id: empresaId,
    tipo_relatorio: reportAudience,
    gerado_por: user.id,
    escritorio_nome_snapshot: escritorio?.nome ?? null,
    escritorio_logo_path_snapshot: logoPathEscritorio,
    escritorio_cor_snapshot: escritorio?.corPrincipal ?? null,
    modo_parametros: modoParametros,
    parametros_utilizados: parametrosResolvidos,
    observacao: observacaoParametros ?? null,
    versao_parametros: parametrosResolvidos.versao,
    total_documentos: resumoRelatorio.totalDocumentos,
    total_itens: resumoRelatorio.totalItens,
    hash_arquivo: hashArquivo,
    competencia: competencia || null,
  })

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  const nomeArquivo = reportAudience === 'accountant_client' && escritorio
    ? `relatorio-ibs-cbs-${slug(empresa.razao_social)}-${slug(escritorio.nome)}-${new Date().toISOString().slice(0, 10)}-${codigoRelatorio.toLowerCase()}.pdf`
    : `relatorio-ibs-cbs-${slug(empresa.razao_social)}-${new Date().toISOString().slice(0, 10)}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
    },
  })
}
