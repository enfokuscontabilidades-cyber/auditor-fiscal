import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const {
    razao_social, nome_fantasia, cnpj, regime, cnae_principal,
    inscricao_estadual, uf, status,
    situacao_cadastral, logradouro, numero, complemento, bairro, cep, municipio,
    telefone, email,
  } = body

  if (!razao_social?.trim()) {
    return NextResponse.json({ error: 'Razão social é obrigatória' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('empresas')
    .update({
      razao_social:       razao_social.trim(),
      nome_fantasia:      nome_fantasia?.trim() || null,
      cnpj:               cnpj ? cnpj.replace(/\D/g, '') : null,
      regime:             regime || null,
      cnae_principal:     cnae_principal?.trim() || null,
      inscricao_estadual: inscricao_estadual?.trim() || null,
      uf:                 uf || 'GO',
      status:             status || 'Ativo',
      situacao_cadastral: situacao_cadastral?.trim() || null,
      logradouro:         logradouro?.trim() || null,
      numero:             numero?.trim() || null,
      complemento:        complemento?.trim() || null,
      bairro:             bairro?.trim() || null,
      cep:                cep?.replace(/\D/g, '') || null,
      municipio:          municipio?.trim() || null,
      telefone:           telefone?.trim() || null,
      email:              email?.trim() || null,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('empresas')
    .update({ status: 'Inativo', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
