import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId     = searchParams.get('empresa_id')
  const competencia   = searchParams.get('competencia')
  const tipoDocumento = searchParams.get('tipo_documento')
  const impactoReceita = searchParams.get('impacto_receita')
  const incluirItens  = searchParams.get('incluir_itens') === 'true'

  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id é obrigatório' }, { status: 400 })
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  function buildQuery() {
    let q = supabase
      .from('fa_documentos_fiscais')
      .select(incluirItens ? '*, fa_documentos_itens(*)' : '*')
      .eq('empresa_id', empresaId!)
      .order('data_emissao', { ascending: false })

    if (competencia)    q = q.eq('data_competencia', competencia)
    if (tipoDocumento)  q = q.eq('tipo_documento', tipoDocumento)
    if (impactoReceita) q = q.eq('impacto_receita', impactoReceita)
    return q
  }

  try {
    const data = await fetchAll((from, to) => buildQuery().range(from, to))
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
