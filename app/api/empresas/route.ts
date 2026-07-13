import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { getContextoAcesso, canCreateCompany, assinaturaEstaAtiva, MENSAGENS_RT } from '@/lib/planos/acessoReformaTributaria'
import { registrarEventoRt } from '@/lib/planos/auditoria'
import { validarCnpj, somenteDigitos } from '@/lib/validacao/documentos'
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
  const { razao_social, cnpj, regime, cnae_principal, inscricao_estadual, uf, confirmacaoVagaPermanente } = body

  if (!razao_social?.trim()) {
    return NextResponse.json({ error: 'Razão social é obrigatória' }, { status: 400 })
  }

  const cnpjLimpo = cnpj ? somenteDigitos(cnpj) : null
  if (!cnpjLimpo || cnpjLimpo.length !== 14) {
    return NextResponse.json({ error: 'CNPJ invalido: informe exatamente 14 digitos numericos' }, { status: 400 })
  }

  const ctx = await getContextoAcesso(supabase, orgId)

  if (ctx.produtoEscopo === 'tax_reform_only') {
    if (!assinaturaEstaAtiva(ctx)) {
      return NextResponse.json({ error: MENSAGENS_RT.assinaturaInativa, codigo: 'ASSINATURA_INATIVA' }, { status: 403 })
    }
    if (!validarCnpj(cnpjLimpo)) {
      return NextResponse.json({ error: 'CNPJ inválido: os dígitos verificadores não conferem' }, { status: 400 })
    }
    if (!confirmacaoVagaPermanente) {
      return NextResponse.json(
        { error: 'É necessário confirmar que o CNPJ está correto e que ele ocupará permanentemente uma vaga do plano.' },
        { status: 400 },
      )
    }
    if (!canCreateCompany(ctx)) {
      return NextResponse.json({ error: MENSAGENS_RT.limiteCnpjAtingido, codigo: 'LIMITE_CNPJ_ATINGIDO' }, { status: 403 })
    }

    const admin = createAdminClient()

    const { data: empresa, error: errEmpresa } = await admin
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

    if (errEmpresa || !empresa) {
      return NextResponse.json({ error: errEmpresa?.message ?? 'Falha ao cadastrar empresa' }, { status: 500 })
    }

    const { error: errSlot } = await admin.from('rt_cnpj_slots').insert({
      assinatura_id: ctx.assinatura!.id,
      org_id: orgId,
      empresa_id: empresa.id,
      cnpj_normalizado: cnpjLimpo,
      vinculado_por: user.id,
    })

    if (errSlot) {
      await admin.from('empresas').delete().eq('id', empresa.id)
      const duplicado = errSlot.message.includes('duplicate') || errSlot.message.includes('unique')
      return NextResponse.json(
        { error: duplicado ? 'Este CNPJ já está cadastrado neste escritório.' : errSlot.message },
        { status: duplicado ? 409 : 500 },
      )
    }

    await registrarEventoRt(admin, {
      orgId,
      assinaturaId: ctx.assinatura!.id,
      tipo: 'cnpj_vinculado',
      detalhes: { empresa_id: empresa.id },
      atorUserId: user.id,
    })

    return NextResponse.json(empresa, { status: 201 })
  }

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
