import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, validarSessaoDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { getContextoAcesso, assinaturaEstaAtiva, getXmlUsageLimit, MENSAGENS_RT } from '@/lib/planos/acessoReformaTributaria'
import { registrarEventoRt } from '@/lib/planos/auditoria'
import { reservarQuotaXml, liberarQuotaXml, periodoInicioAtual, periodoFimDoInicio, chaveQuotaParaDocumento } from '@/lib/planos/quotaXml'
import { NextResponse } from 'next/server'
import type { DocumentoFiscalInput, DocumentoFiscalItemInput } from '@/lib/types'
import { normalizarClassificacaoPersistivel, SITUACAO_CLASSIFICACAO_VALORES } from '@/lib/types'

interface LegadoInfo {
  tipo_operacao?: 'entrada' | 'saida' | null
  parsed_data?: unknown
}

interface ImportarNfeBody {
  empresa_id: string
  sessao_id?: string | null
  documentos: Omit<DocumentoFiscalInput, 'empresa_id'>[]
  itens: Record<string, Omit<DocumentoFiscalItemInput, 'empresa_id' | 'documento_id'>[]>
  /** Espelho opcional para fa_arquivos_xml (leitor legado), chaveado igual a `itens`. */
  legado?: Record<string, LegadoInfo>
  cancelamentos?: string[]
}

interface ResultadoRpcItem {
  documento_id: string | null
  chave_acesso: string | null
  numero: string | null
  status: 'importado' | 'atualizado' | 'erro'
  motivo?: string
  itens_salvos?: number
}

interface ResultadoRpc {
  salvos: number
  itens_salvos: number
  resultados: ResultadoRpcItem[]
}

const DOC_BATCH = 200

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export async function POST(request: Request) {
  const importId = crypto.randomUUID()
  const iniciadoEm = Date.now()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json() as ImportarNfeBody
  const { empresa_id, sessao_id, documentos, itens = {}, legado = {}, cancelamentos = [] } = body

  if (!empresa_id || !Array.isArray(documentos) || documentos.length === 0) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: empresa_id, documentos[]' },
      { status: 400 },
    )
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresa_id, orgId)) {
    return respostaForbidden('empresa_id')
  }

  if (sessao_id && !await validarSessaoDaOrg(supabase, sessao_id, orgId)) {
    return respostaForbidden('sessao_id')
  }

  const ctx = await getContextoAcesso(supabase, orgId)
  const restritoRt = ctx.produtoEscopo === 'tax_reform_only'

  if (restritoRt && !assinaturaEstaAtiva(ctx)) {
    return NextResponse.json({ error: MENSAGENS_RT.assinaturaInativa, codigo: 'ASSINATURA_INATIVA' }, { status: 403 })
  }

  // Deduplica por chave_acesso para evitar "ON CONFLICT DO UPDATE command cannot affect
  // row a second time" quando o batch contém a mesma nota mais de uma vez
  const docsPorChave = new Map<string, Omit<DocumentoFiscalInput, 'empresa_id'>>()
  for (let i = 0; i < documentos.length; i++) {
    const doc = documentos[i]
    const chave = doc.chave_acesso ?? doc.numero ?? `__idx_${i}`
    docsPorChave.set(chave, doc)
  }
  let documentosDedupados = Array.from(docsPorChave.values())

  const erros: string[] = []

  // Barreira real de posse de CNPJ: roda para QUALQUER org (não só tax_reform_only) —
  // um XML cujo emitente/destinatário não bate com o CNPJ da empresa selecionada nunca
  // pode ser persistido, independente do front ter filtrado corretamente ou não.
  //
  // A empresa selecionada representa um estabelecimento/CNPJ específico. Aceitar
  // apenas a raiz permitiria gravar uma nota da filial A na filial B.
  const { data: empresaRow } = await supabase.from('empresas').select('cnpj').eq('id', empresa_id).single()
  const cnpjEmpresa = (empresaRow?.cnpj ?? '').replace(/\D/g, '')
  if (cnpjEmpresa.length === 14) {
    const antes = documentosDedupados.length
    documentosDedupados = documentosDedupados.filter(doc => {
      const emit = (doc.emitente_cnpj ?? '').replace(/\D/g, '')
      const dest = (doc.destinatario_cnpj ?? '').replace(/\D/g, '')
      return emit === cnpjEmpresa || dest === cnpjEmpresa
    })
    const removidos = antes - documentosDedupados.length
    if (removidos > 0) {
      erros.push(`${removidos} documento(s) não pertencem à empresa selecionada (CNPJ divergente) e não foram processados.`)
    }
  }

  const antesSemChave = documentosDedupados.length
  documentosDedupados = documentosDedupados.filter(doc =>
    doc.tipo_documento !== 'nfe' || /^\d{44}$/.test((doc.chave_acesso ?? '').replace(/\D/g, ''))
  )
  const semChave = antesSemChave - documentosDedupados.length
  if (semChave > 0) {
    erros.push(`${semChave} NF-e sem chave de acesso válida foram rejeitadas para evitar duplicidade e documentos sem rastreabilidade.`)
  }

  let periodoInicio = ''
  let admin: ReturnType<typeof createAdminClient> | null = null
  /** chave de quota (chave_acesso real ou sintética) reservada nesta chamada — usada para devolver quota se a gravação falhar. */
  let chavesReservadas = new Set<string>()
  /** doc -> chave de quota, na mesma ordem de documentosDedupados após os filtros abaixo. */
  const quotaKeyPorDoc = new Map<Omit<DocumentoFiscalInput, 'empresa_id'>, string>()

  if (restritoRt && ctx.assinatura) {
    admin = createAdminClient()

    periodoInicio = periodoInicioAtual(ctx.assinatura.ciclo_inicio)
    const periodoFim = periodoFimDoInicio(periodoInicio)
    const limite = getXmlUsageLimit(ctx)

    documentosDedupados.forEach((doc, idx) => quotaKeyPorDoc.set(doc, chaveQuotaParaDocumento(doc.chave_acesso ?? null, idx)))

    const resultado = await reservarQuotaXml(admin, {
      assinaturaId: ctx.assinatura.id,
      orgId,
      empresaId: empresa_id,
      periodoInicio,
      periodoFim,
      limite,
      chaves: Array.from(quotaKeyPorDoc.values()),
    })

    if (resultado.rejeitadas.length > 0) {
      const dataRenovacao = ctx.assinatura.proxima_renovacao
        ? new Date(ctx.assinatura.proxima_renovacao).toLocaleDateString('pt-BR')
        : 'no próximo ciclo'
      erros.push(
        `Este lote contém ${resultado.elegiveis} XML(s) novo(s), mas seu plano possui apenas ${resultado.permitidas} análise(s) disponível(is) neste ciclo. ` +
        `Nenhum dos ${resultado.rejeitadas.length} documento(s) excedente(s) foi processado. ${MENSAGENS_RT.limiteXmlAtingido(dataRenovacao)}`,
      )
      await registrarEventoRt(admin, {
        orgId, assinaturaId: ctx.assinatura.id, tipo: 'limite_xml_atingido',
        detalhes: { elegiveis: resultado.elegiveis, permitidas: resultado.permitidas, rejeitados: resultado.rejeitadas.length },
        atorUserId: user.id,
      })
    }

    chavesReservadas = new Set(resultado.reservadas)
    const permitidasSet = new Set([...resultado.jaProcessadas, ...resultado.reservadas])
    documentosDedupados = documentosDedupados.filter(doc => permitidasSet.has(quotaKeyPorDoc.get(doc)!))
  }

  if (documentosDedupados.length === 0) {
    return NextResponse.json({ salvos: 0, duplicados: 0, erros }, { status: erros.length ? 207 : 201 })
  }

  // Barreira adicional no servidor, além da CHECK constraint do banco: sanitiza
  // `classificacao`/`situacao_classificacao` de cada item ANTES de chamar a RPC —
  // um valor não reconhecido (ex.: enviado por um cliente desatualizado ou
  // divergente do contrato) vira 'outros'/null em vez de derrubar a importação do
  // documento inteiro com um erro de constraint pouco compreensível.
  let itensComClassificacaoInvalida = 0
  for (const chave of Object.keys(itens)) {
    itens[chave] = itens[chave].map(item => {
      const { classificacao, invalida } = normalizarClassificacaoPersistivel(item.classificacao)
      if (invalida) itensComClassificacaoInvalida++
      const situacao_classificacao = typeof item.situacao_classificacao === 'string'
        && (SITUACAO_CLASSIFICACAO_VALORES as readonly string[]).includes(item.situacao_classificacao)
        ? item.situacao_classificacao
        : null
      return { ...item, classificacao, situacao_classificacao }
    })
  }
  if (itensComClassificacaoInvalida > 0) {
    erros.push(`${itensComClassificacaoInvalida} item(ns) com classificação não reconhecida foram salvos como "outros" — revise a classificação manual desses itens.`)
  }

  const chavesQuotaParaLiberar: string[] = []
  const resultadosPorDocumento: ResultadoRpcItem[] = []
  let documentosSalvos = 0
  let itensSalvos = 0

  for (const lote of chunk(documentosDedupados, DOC_BATCH)) {
    const payload = lote.map(doc => {
      const chave = doc.chave_acesso ?? doc.numero ?? ''
      const legadoDoc = legado[chave]
      return {
        ...doc,
        itens: itens[chave] ?? [],
        legado_tipo_operacao: legadoDoc?.tipo_operacao ?? null,
        legado_parsed_data: legadoDoc?.parsed_data ?? null,
      }
    })

    const { data, error } = await supabase.rpc('fa_importar_lote_nfe', {
      p_org_id: orgId,
      p_empresa_id: empresa_id,
      p_sessao_id: sessao_id ?? null,
      p_documentos: payload,
      p_cancelamentos: cancelamentos,
    })

    if (error) {
      erros.push(`Lote de documentos: ${error.message}`)
      for (const doc of lote) {
        const quotaKey = quotaKeyPorDoc.get(doc)
        if (quotaKey && chavesReservadas.has(quotaKey)) chavesQuotaParaLiberar.push(quotaKey)
      }
      continue
    }

    const resultado = data as ResultadoRpc
    documentosSalvos += resultado.salvos
    itensSalvos += resultado.itens_salvos
    resultadosPorDocumento.push(...(resultado.resultados ?? []))

    // Documentos rejeitados dentro da própria função (sem chave/número) também
    // liberam a quota reservada para eles.
    for (const r of resultado.resultados ?? []) {
      if (r.status !== 'erro') continue
      const docOriginal = lote.find(d => (d.chave_acesso ?? d.numero ?? '') === (r.chave_acesso ?? r.numero ?? ''))
      const quotaKey = docOriginal ? quotaKeyPorDoc.get(docOriginal) : undefined
      if (quotaKey && chavesReservadas.has(quotaKey)) chavesQuotaParaLiberar.push(quotaKey)
      if (r.motivo) erros.push(r.motivo)
    }
  }

  if (admin && ctx.assinatura && chavesQuotaParaLiberar.length > 0) {
    await liberarQuotaXml(admin, { assinaturaId: ctx.assinatura.id, periodoInicio, chaves: chavesQuotaParaLiberar })
  }

  const competencias = Array.from(
    new Set(documentosDedupados.map(doc => doc.data_competencia).filter(Boolean)),
  ) as string[]
  for (const competencia of competencias) {
    const { error } = await supabase.rpc('refresh_relatorios_mensais', {
      p_empresa_id: empresa_id,
      p_competencia: competencia,
    })
    if (error && !error.message.includes('Could not find the function')) {
      erros.push(`Resumo ${competencia}: ${error.message}`)
    }
  }

  const duracaoMs = Date.now() - iniciadoEm
  console.info(JSON.stringify({
    evento: 'importacao_nfe',
    import_id: importId,
    user_id: user.id,
    org_id: orgId,
    empresa_id,
    sessao_id: sessao_id ?? null,
    competencias,
    arquivos_recebidos: documentos.length,
    documentos_processados: documentosDedupados.length,
    documentos_salvos: documentosSalvos,
    itens_salvos: itensSalvos,
    erros_count: erros.length,
    duracao_ms: duracaoMs,
  }))

  if (documentosSalvos === 0) {
    return NextResponse.json(
      { salvos: 0, documentos_salvos: 0, itens_salvos: 0, duplicados: 0, erros, resultados: resultadosPorDocumento, import_id: importId },
      { status: erros.length ? 500 : 201 },
    )
  }

  return NextResponse.json(
    {
      salvos: documentosSalvos,
      documentos_salvos: documentosSalvos,
      itens_salvos: itensSalvos,
      duplicados: 0,
      erros,
      resultados: resultadosPorDocumento,
      import_id: importId,
    },
    { status: erros.length ? 207 : 201 },
  )
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json() as { empresa_id: string; chave_acesso: string; cancelada_em?: string }
  const { empresa_id, chave_acesso, cancelada_em } = body

  if (!empresa_id || !chave_acesso) {
    return NextResponse.json({ error: 'empresa_id e chave_acesso são obrigatórios' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresa_id, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const { data, error } = await supabase.rpc('fa_cancelar_nfe', {
    p_org_id: orgId,
    p_empresa_id: empresa_id,
    p_chaves: [chave_acesso],
    p_cancelada_em: cancelada_em ?? new Date().toISOString().slice(0, 10),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, resultado: data })
}
