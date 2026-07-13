import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanoReformaTributaria } from '@/lib/planos/reformaTributariaPlanos'
import { registrarEventoRt } from '@/lib/planos/auditoria'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('membros_organizacao')
    .select('papel, organizacao:organizacoes(id, nome, plano, produto_escopo, created_at, updated_at)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (error || !data) return NextResponse.json(null)

  return NextResponse.json({ ...data.organizacao, papel: data.papel })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { nome, produtoEscopo, planoCodigo } = await request.json()
  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Nome do escritório é obrigatório' }, { status: 400 })
  }

  const querTaxReformOnly = produtoEscopo === 'tax_reform_only'
  const plano = querTaxReformOnly ? getPlanoReformaTributaria(planoCodigo) : undefined
  if (querTaxReformOnly && !plano) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  // Impede criar segundo org
  const { data: existing } = await supabase
    .from('membros_organizacao')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Usuário já pertence a uma organização' }, { status: 409 })
  }

  // Criação com service role para contornar RLS (chicken-and-egg)
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Configuração de servidor incompleta' },
      { status: 500 }
    )
  }

  const { data: org, error: errOrg } = await admin
    .from('organizacoes')
    .insert({ nome: nome.trim(), ...(querTaxReformOnly ? { produto_escopo: 'tax_reform_only' } : {}) })
    .select()
    .single()

  if (errOrg || !org) {
    return NextResponse.json({ error: errOrg?.message ?? 'Falha ao criar organização' }, { status: 500 })
  }

  const { error: errMembro } = await admin
    .from('membros_organizacao')
    .insert({ org_id: org.id, user_id: user.id, papel: 'admin' })

  if (errMembro) {
    await admin.from('organizacoes').delete().eq('id', org.id)
    return NextResponse.json({ error: errMembro.message }, { status: 500 })
  }

  if (querTaxReformOnly && plano) {
    const { data: assinatura, error: errAssinatura } = await admin
      .from('rt_assinaturas')
      .insert({
        org_id: org.id,
        plano_codigo: plano.codigo,
        preco_contratado_centavos: plano.precoCentavos,
        status: 'pending',
      })
      .select()
      .single()

    if (errAssinatura) {
      await admin.from('organizacoes').delete().eq('id', org.id)
      return NextResponse.json({ error: errAssinatura.message }, { status: 500 })
    }

    await registrarEventoRt(admin, {
      orgId: org.id,
      assinaturaId: assinatura.id,
      tipo: 'assinatura_criada',
      detalhes: { plano_codigo: plano.codigo },
      atorUserId: user.id,
    })
  }

  return NextResponse.json(org, { status: 201 })
}
