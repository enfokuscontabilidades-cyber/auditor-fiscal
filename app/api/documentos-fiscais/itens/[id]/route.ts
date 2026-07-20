import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CLASSIFICACAO_ITEM_VALORES, SITUACAO_CLASSIFICACAO_VALORES } from '@/lib/types'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  if ('classificacao' in body && body.classificacao !== null && !(CLASSIFICACAO_ITEM_VALORES as readonly string[]).includes(body.classificacao)) {
    return NextResponse.json({ error: `classificacao inválida: ${body.classificacao}` }, { status: 400 })
  }
  if ('situacao_classificacao' in body && body.situacao_classificacao !== null && !(SITUACAO_CLASSIFICACAO_VALORES as readonly string[]).includes(body.situacao_classificacao)) {
    return NextResponse.json({ error: `situacao_classificacao inválida: ${body.situacao_classificacao}` }, { status: 400 })
  }

  const campos_permitidos = [
    'classificacao',
    'situacao_classificacao',
    'natureza_receita_simples',
    'anexo_sugerido',
    'impacto_receita',
    'tipo_movimento',
  ] as const

  const update: Record<string, unknown> = { classificacao_manual: true }
  for (const campo of campos_permitidos) {
    if (campo in body) update[campo] = body[campo]
  }

  const { data, error } = await supabase
    .from('fa_documentos_itens')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
