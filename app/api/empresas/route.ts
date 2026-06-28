import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('empresas')
    .select('id, razao_social, nome_fantasia, cnpj, regime, cnae_principal, inscricao_estadual')
    .eq('status', 'Ativo')
    .order('razao_social')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  const body = await request.json()
  const { razao_social, cnpj, regime, cnae_principal, inscricao_estadual, uf } = body

  if (!razao_social?.trim()) {
    return NextResponse.json({ error: 'Razão social é obrigatória' }, { status: 400 })
  }

  const cnpjLimpo = cnpj ? cnpj.replace(/\D/g, '') : null

  const { data, error } = await supabase
    .from('empresas')
    .insert({
      org_id: orgId,
      razao_social: razao_social.trim(),
      cnpj: cnpjLimpo,
      regime: regime || null,
      cnae_principal: cnae_principal?.trim() || null,
      inscricao_estadual: inscricao_estadual?.trim() || null,
      uf: uf || 'GO',
      status: 'Ativo',
    })
    .select('id, razao_social, nome_fantasia, cnpj, regime, cnae_principal, inscricao_estadual')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
