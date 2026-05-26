import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  const competencia = searchParams.get('competencia')
  const cfop = searchParams.get('cfop')
  const ncm = searchParams.get('ncm')
  const natureza = searchParams.get('natureza')
  const documentoId = searchParams.get('documento_id')

  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })
  }

  let query = supabase
    .from('fa_documentos_itens')
    .select('*, fa_documentos_fiscais!inner(data_competencia, status)')
    .eq('empresa_id', empresaId)

  if (documentoId) query = query.eq('documento_id', documentoId)
  if (cfop) query = query.eq('cfop', cfop)
  if (ncm) query = query.eq('ncm', ncm)
  if (natureza) query = query.eq('natureza_receita_simples', natureza)

  // Filtrar por competência via join
  if (competencia) {
    query = query.eq('fa_documentos_fiscais.data_competencia', competencia)
  }

  // Excluir itens de notas canceladas
  query = query.neq('fa_documentos_fiscais.status', 'cancelada')

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
