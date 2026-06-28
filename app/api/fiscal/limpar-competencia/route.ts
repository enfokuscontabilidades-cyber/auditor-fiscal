import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { validarEmpresaDaOrg, respostaForbidden } from '@/lib/supabase/validation'
import { NextResponse } from 'next/server'

type TipoLimpeza = 'xml_entrada' | 'xml_saida' | 'sped_fiscal' | 'sped_contrib'

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const empresaId = searchParams.get('empresa_id')
  const competencia = searchParams.get('competencia')

  if (!empresaId || !competencia) {
    return NextResponse.json(
      { error: 'empresa_id e competencia sao obrigatorios' },
      { status: 400 },
    )
  }

  let tipos: TipoLimpeza[] = ['xml_entrada', 'xml_saida']
  try {
    const body = await request.json() as { tipos?: TipoLimpeza[] }
    if (Array.isArray(body.tipos) && body.tipos.length > 0) tipos = body.tipos
  } catch {
    // Compatibilidade com chamadas antigas sem body.
  }

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })

  if (!await validarEmpresaDaOrg(supabase, empresaId, orgId)) {
    return respostaForbidden('empresa_id')
  }

  const limparXmlEntrada = tipos.includes('xml_entrada')
  const limparXmlSaida = tipos.includes('xml_saida')
  const limparSpedFiscal = tipos.includes('sped_fiscal')
  const limparSpedContrib = tipos.includes('sped_contrib')

  let documentosRemovidos = 0
  let xmlsRemovidos = 0
  let spedsRemovidos = 0

  try {
    let query = supabase
      .from('fa_documentos_fiscais')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('data_competencia', competencia)

    if (limparXmlEntrada && !limparXmlSaida) {
      query = query.in('tipo_movimento', ['entrada', 'devolucao_compra'])
    } else if (!limparXmlEntrada && limparXmlSaida) {
      query = query.in('tipo_movimento', ['saida', 'devolucao_venda'])
    } else if (!limparXmlEntrada && !limparXmlSaida) {
      query = query.eq('id', '__nenhum__')
    }

    const { data, error } = await query.select('id')
    if (!error) documentosRemovidos = data?.length ?? 0
  } catch {
    // Tabela pode ainda nao existir em bases sem a migracao fase A.
  }

  let xmlQuery = supabase
    .from('fa_arquivos_xml')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('competencia', competencia)

  if (limparXmlEntrada && !limparXmlSaida) {
    xmlQuery = xmlQuery.eq('tipo_operacao', 'entrada')
  } else if (!limparXmlEntrada && limparXmlSaida) {
    xmlQuery = xmlQuery.eq('tipo_operacao', 'saida')
  } else if (!limparXmlEntrada && !limparXmlSaida) {
    xmlQuery = xmlQuery.eq('id', '__nenhum__')
  }

  const { error: errXmlComp } = await xmlQuery
  if (!errXmlComp?.message?.includes('competencia')) {
    xmlsRemovidos = limparXmlEntrada || limparXmlSaida ? -1 : 0
  } else if (limparXmlEntrada || limparXmlSaida) {
    const { data: sessoes } = await supabase
      .from('fa_sessoes_analise')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('competencia', competencia)

    if (sessoes && sessoes.length > 0) {
      let fallback = supabase
        .from('fa_arquivos_xml')
        .delete()
        .in('sessao_id', sessoes.map((s: { id: string }) => s.id))

      if (limparXmlEntrada && !limparXmlSaida) fallback = fallback.eq('tipo_operacao', 'entrada')
      if (!limparXmlEntrada && limparXmlSaida) fallback = fallback.eq('tipo_operacao', 'saida')

      const { data } = await fallback.select('id')
      xmlsRemovidos = data?.length ?? 0
    }
  }

  if (limparSpedFiscal || limparSpedContrib) {
    const tiposSped = [
      ...(limparSpedFiscal ? ['fiscal'] : []),
      ...(limparSpedContrib ? ['contrib'] : []),
    ]
    const { data } = await supabase
      .from('fa_arquivos_sped')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('competencia', competencia)
      .in('tipo', tiposSped)
      .select('id')
    spedsRemovidos = data?.length ?? 0
  }

  return NextResponse.json({
    ok: true,
    documentos_removidos: documentosRemovidos,
    xmls_removidos: xmlsRemovidos,
    speds_removidos: spedsRemovidos,
  })
}
