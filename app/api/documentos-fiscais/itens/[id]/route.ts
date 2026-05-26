import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const campos_permitidos = [
    'classificacao',
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
