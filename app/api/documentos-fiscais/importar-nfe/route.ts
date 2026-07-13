import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { getContextoAcesso, assinaturaEstaAtiva, getXmlUsageLimit, MENSAGENS_RT } from '@/lib/planos/acessoReformaTributaria'
import { registrarEventoRt } from '@/lib/planos/auditoria'
import { reservarQuotaXml, liberarQuotaXml, periodoInicioAtual, periodoFimDoInicio, chaveQuotaParaDocumento } from '@/lib/planos/quotaXml'
import { NextResponse } from 'next/server'
import type { DocumentoFiscalInput, DocumentoFiscalItemInput } from '@/lib/types'

interface ImportarNfeBody {
  empresa_id: string
  documentos: Omit<DocumentoFiscalInput, 'empresa_id'>[]
  itens: Record<string, Omit<DocumentoFiscalItemInput, 'empresa_id' | 'documento_id'>[]>
}

type DocRetornado = {
  id: string
  chave_acesso: string | null
  numero: string | null
}

const DOC_BATCH = 200
const ITEM_BATCH = 1000

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json() as ImportarNfeBody
  const { empresa_id, documentos, itens = {} } = body

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
  const docsSalvos: DocRetornado[] = []

  let periodoInicio = ''
  let admin: ReturnType<typeof createAdminClient> | null = null
  /** chave de quota (chave_acesso real ou sintética) reservada nesta chamada — usada para devolver quota se a gravação falhar. */
  let chavesReservadas = new Set<string>()
  /** doc -> chave de quota, na mesma ordem de documentosDedupados após os filtros abaixo. */
  const quotaKeyPorDoc = new Map<Omit<DocumentoFiscalInput, 'empresa_id'>, string>()

  if (restritoRt && ctx.assinatura) {
    admin = createAdminClient()

    // Validação server-side de posse do CNPJ: uma chamada direta à API não pode
    // contabilizar (nem gravar) documentos de outra empresa só porque o front
    // deixou de filtrar. O front já faz esse filtro, mas aqui é a barreira real.
    const { data: empresaRow } = await admin.from('empresas').select('cnpj').eq('id', empresa_id).single()
    const cnpjEmpresa = (empresaRow?.cnpj ?? '').replace(/\D/g, '')
    if (cnpjEmpresa) {
      const antes = documentosDedupados.length
      documentosDedupados = documentosDedupados.filter(doc => {
        const emit = (doc.emitente_cnpj ?? '').replace(/\D/g, '')
        const dest = (doc.destinatario_cnpj ?? '').replace(/\D/g, '')
        return emit === cnpjEmpresa || dest === cnpjEmpresa
      })
      const removidos = antes - documentosDedupados.length
      if (removidos > 0) {
        erros.push(`${removidos} documento(s) não pertencem à empresa selecionada e não foram processados.`)
      }
    }

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

  const chavesQuotaParaLiberar: string[] = []

  for (const lote of chunk(documentosDedupados, DOC_BATCH)) {
    const docsComTenant = lote.map(doc => ({ ...doc, org_id: orgId, empresa_id }))
    const { data, error } = await supabase
      .from('fa_documentos_fiscais')
      .upsert(docsComTenant, { onConflict: 'empresa_id,chave_acesso', ignoreDuplicates: false })
      .select('id, chave_acesso, numero')

    if (error) {
      erros.push(`Lote de documentos: ${error.message}`)
      for (const doc of lote) {
        const quotaKey = quotaKeyPorDoc.get(doc)
        if (quotaKey && chavesReservadas.has(quotaKey)) chavesQuotaParaLiberar.push(quotaKey)
      }
      continue
    }

    docsSalvos.push(...((data ?? []) as DocRetornado[]))
  }

  if (admin && ctx.assinatura && chavesQuotaParaLiberar.length > 0) {
    await liberarQuotaXml(admin, { assinaturaId: ctx.assinatura.id, periodoInicio, chaves: chavesQuotaParaLiberar })
  }

  if (docsSalvos.length === 0) {
    return NextResponse.json({ salvos: 0, duplicados: 0, erros }, { status: erros.length ? 500 : 201 })
  }

  const idsPorChave = new Map<string, string>()
  const idsPorNumero = new Map<string, string>()
  for (const doc of docsSalvos) {
    if (doc.chave_acesso) idsPorChave.set(doc.chave_acesso, doc.id)
    if (doc.numero) idsPorNumero.set(doc.numero, doc.id)
  }

  for (const ids of chunk(docsSalvos.map(doc => doc.id), 500)) {
    const { error } = await supabase
      .from('fa_documentos_itens')
      .delete()
      .in('documento_id', ids)

    if (error) erros.push(`Limpeza de itens: ${error.message}`)
  }

  const itensParaInserir: Array<Omit<DocumentoFiscalItemInput, 'empresa_id'> & {
    org_id: string
    empresa_id: string
    documento_id: string
  }> = []

  for (let idx = 0; idx < documentosDedupados.length; idx++) {
    const doc = documentosDedupados[idx]
    const chave = doc.chave_acesso ?? doc.numero ?? String(idx)
    const documentoId = (doc.chave_acesso ? idsPorChave.get(doc.chave_acesso) : undefined)
      ?? (doc.numero ? idsPorNumero.get(doc.numero) : undefined)
    if (!documentoId) continue

    const itensDeste = itens[chave] ?? []
    for (const item of itensDeste) {
      itensParaInserir.push({
        ...item,
        org_id: orgId,
        empresa_id,
        documento_id: documentoId,
      })
    }
  }

  let itensSalvos = 0
  for (const lote of chunk(itensParaInserir, ITEM_BATCH)) {
    const { data, error } = await supabase
      .from('fa_documentos_itens')
      .insert(lote)
      .select('id')

    if (error) {
      erros.push(`Lote de itens: ${error.message}`)
      continue
    }
    itensSalvos += data?.length ?? 0
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

  return NextResponse.json(
    {
      salvos: docsSalvos.length,
      documentos_salvos: docsSalvos.length,
      itens_salvos: itensSalvos,
      duplicados: 0,
      erros,
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

  const { error } = await supabase
    .from('fa_documentos_fiscais')
    .update({ status: 'cancelada', cancelada_em: cancelada_em ?? null })
    .eq('empresa_id', empresa_id)
    .eq('chave_acesso', chave_acesso)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
