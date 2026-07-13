import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { getContextoAcesso } from '@/lib/planos/acessoReformaTributaria'
import { analisarDocumentosReforma, type DocumentoParaAnaliseReforma } from '@/lib/fiscal/resumoReformaTributaria'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organizacao' }, { status: 403 })

  const ctx = await getContextoAcesso(supabase, orgId)
  if (ctx.produtoEscopo !== 'tax_reform_only') {
    return NextResponse.json({ error: 'Disponivel apenas para organizacoes de Reforma Tributaria' }, { status: 400 })
  }

  const [empresasResp, documentosResp] = await Promise.all([
    supabase
      .from('empresas')
      .select('id, razao_social, cnpj, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('fa_documentos_fiscais')
      .select('id, numero, data_emissao, status, fa_documentos_itens(cst_ibs_cbs, cclass_trib, valor_bc_ibs_cbs, valor_total, aliquota_ibs_uf, valor_ibs_uf, aliquota_ibs_mun, valor_ibs_mun, valor_ibs, aliquota_cbs, valor_cbs)')
      .eq('status', 'ok')
      .order('created_at', { ascending: false }),
  ])

  const documentosParaAnalise: DocumentoParaAnaliseReforma[] = (documentosResp.data ?? []).map(d => ({
    id: d.id,
    numero: d.numero,
    dataEmissao: d.data_emissao,
    itens: d.fa_documentos_itens ?? [],
  }))

  const { resumo } = analisarDocumentosReforma(documentosParaAnalise)

  const ultimosDocumentos = (documentosResp.data ?? [])
    .slice(0, 8)
    .map(d => ({ id: d.id, numero: d.numero, data_emissao: d.data_emissao }))

  return NextResponse.json({
    ultimasEmpresas: empresasResp.data ?? [],
    ultimosDocumentos,
    resumo,
  })
}
