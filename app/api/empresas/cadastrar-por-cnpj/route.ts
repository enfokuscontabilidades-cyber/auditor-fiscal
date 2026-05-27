import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/supabase/org'
import type { CnpjDados } from '@/components/ModalCnpj'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 })

  const body = await request.json() as { dados?: CnpjDados }
  const d = body.dados

  if (!d?.cnpj || !d?.razao_social) {
    return NextResponse.json({ error: 'Dados inválidos: cnpj e razao_social são obrigatórios' }, { status: 400 })
  }

  const cnpjLimpo = d.cnpj.replace(/\D/g, '')
  if (cnpjLimpo.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 })
  }

  // ── Verificar duplicidade (dentro da mesma organização) ─────────────────────
  const { data: existente } = await supabase
    .from('empresas')
    .select('id, razao_social')
    .eq('cnpj', cnpjLimpo)
    .maybeSingle()

  if (existente) {
    return NextResponse.json({ exists: true, empresa: existente })
  }

  // ── Cadastrar empresa com todos os campos disponíveis ──────────────────────
  const { data, error } = await supabase
    .from('empresas')
    .insert({
      org_id:             orgId,
      razao_social:       d.razao_social.trim(),
      nome_fantasia:      d.nome_fantasia?.trim()         || null,
      cnpj:               cnpjLimpo,
      cnae_principal:     d.atividade_principal?.codigo   || null,
      uf:                 d.endereco?.uf                   || 'GO',
      situacao_cadastral: d.situacao_cadastral             || null,
      logradouro:         d.endereco?.logradouro           || null,
      numero:             d.endereco?.numero               || null,
      complemento:        d.endereco?.complemento          || null,
      bairro:             d.endereco?.bairro               || null,
      cep:                d.endereco?.cep?.replace(/\D/g, '') || null,
      municipio:          d.endereco?.municipio            || null,
      telefone:           d.contato?.telefone              || null,
      email:              d.contato?.email                 || null,
      status:             'Ativo',
    })
    .select('id, razao_social')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ created: true, empresa: data }, { status: 201 })
}
