import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { status, observacao_resolucao } = body

  const STATUS_VALIDOS = ['aberto', 'em_analise', 'resolvido', 'descartado']
  if (status && !STATUS_VALIDOS.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (status) update.status = status
  if (observacao_resolucao) update.observacao_resolucao = observacao_resolucao
  if (status === 'resolvido' || status === 'descartado') {
    update.resolvido_por = user.id
    update.resolvido_em = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('fa_alertas')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
