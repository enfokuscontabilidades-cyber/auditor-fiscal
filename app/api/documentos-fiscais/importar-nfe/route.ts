import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'
import type { DocumentoFiscalInput, DocumentoFiscalItemInput } from '@/lib/types'

interface ImportarNfeBody {
  empresa_id: string
  documentos: Omit<DocumentoFiscalInput, 'empresa_id'>[]
  itens: Record<string, Omit<DocumentoFiscalItemInput, 'empresa_id' | 'documento_id'>[]>
  // itens indexado por chave_acesso ou índice do documento
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

  let salvos = 0
  const duplicados = 0  // mantido na resposta para compatibilidade; sempre 0 agora
  const erros: string[] = []

  for (let idx = 0; idx < documentos.length; idx++) {
    const doc = documentos[idx]

    try {
      // Verificar se é evento de cancelamento
      // (tratado pelo frontend antes de chamar esta API)

      // Upsert documento — atualiza se já existir (garante que reimports reflitam
      // eventuais correções no parser sem exigir "Limpar competência" manualmente)
      const { data: docData, error: docErr } = await supabase
        .from('fa_documentos_fiscais')
        .upsert(
          { ...doc, org_id: orgId, empresa_id },
          { onConflict: 'empresa_id,chave_acesso', ignoreDuplicates: false },
        )
        .select('id, chave_acesso')
        .maybeSingle()

      if (docErr) {
        erros.push(`Documento ${doc.numero ?? idx}: ${docErr.message}`)
        continue
      }

      if (!docData) {
        erros.push(`Documento ${doc.numero ?? idx}: upsert não retornou ID`)
        continue
      }

      salvos++

      // Reimportar itens: excluir os antigos e inserir os novos para garantir
      // que correções no parser (ex.: valor_desconto) sejam sempre aplicadas
      const chaveIdx = doc.chave_acesso ?? String(idx)
      const itensDeste = itens[chaveIdx] ?? []

      // Excluir itens existentes antes de inserir (idempotente)
      await supabase.from('fa_documentos_itens').delete().eq('documento_id', docData.id)

      if (itensDeste.length > 0) {
        const itensComIds = itensDeste.map(item => ({
          ...item,
          org_id: orgId,
          empresa_id,
          documento_id: docData.id,
        }))

        const { error: itensErr } = await supabase
          .from('fa_documentos_itens')
          .insert(itensComIds)

        if (itensErr) {
          erros.push(`Itens do documento ${doc.numero ?? idx}: ${itensErr.message}`)
        }
      }
    } catch (e) {
      erros.push(`Documento ${doc.numero ?? idx}: ${e instanceof Error ? e.message : 'Erro desconhecido'}`)
    }
  }

  return NextResponse.json({ salvos, duplicados, erros }, { status: 201 })
}

// Marcar documento como cancelado quando chega evento de cancelamento
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json() as { empresa_id: string; chave_acesso: string; cancelada_em?: string }
  const { empresa_id, chave_acesso, cancelada_em } = body

  if (!empresa_id || !chave_acesso) {
    return NextResponse.json({ error: 'empresa_id e chave_acesso são obrigatórios' }, { status: 400 })
  }

  const { error } = await supabase
    .from('fa_documentos_fiscais')
    .update({ status: 'cancelada', cancelada_em: cancelada_em ?? null })
    .eq('empresa_id', empresa_id)
    .eq('chave_acesso', chave_acesso)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
