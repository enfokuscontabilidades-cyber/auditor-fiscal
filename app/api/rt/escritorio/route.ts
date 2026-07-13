import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { NextResponse } from 'next/server'
import type { EscritorioContabilPerfil } from '@/lib/types'

const LOGO_URL_EXPIRA_SEGUNDOS = 60 * 10

async function exigirOrgId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) } as const
  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return { erro: NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 }) } as const
  return { supabase, user, orgId } as const
}

/**
 * Perfil institucional do escritório contábil (workspace) — usado
 * exclusivamente na versão do relatório voltada ao contador. Nunca
 * preenchido automaticamente com dados da Enfokus.
 */
export async function GET() {
  const ctx = await exigirOrgId()
  if ('erro' in ctx) return ctx.erro
  const { supabase, orgId } = ctx

  const { data: perfil, error } = await supabase
    .from('rt_escritorio_perfil')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let logoUrl: string | null = null
  if (perfil?.logo_path) {
    const admin = createAdminClient()
    const { data: signed } = await admin.storage
      .from('escritorio-logos')
      .createSignedUrl(perfil.logo_path, LOGO_URL_EXPIRA_SEGUNDOS)
    logoUrl = signed?.signedUrl ?? null
  }

  return NextResponse.json({ perfil: (perfil as EscritorioContabilPerfil) ?? null, logoUrl })
}

export async function PUT(request: Request) {
  const ctx = await exigirOrgId()
  if ('erro' in ctx) return ctx.erro
  const { supabase, user, orgId } = ctx

  const { data: membro } = await supabase
    .from('membros_organizacao')
    .select('papel')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (membro?.papel !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores do escritório podem alterar esses dados.' }, { status: 403 })
  }

  const body = await request.json() as Partial<Record<
    'nome' | 'razaoSocial' | 'cnpj' | 'telefone' | 'whatsapp' | 'email' | 'site' | 'cidade' | 'estado' | 'contadorResponsavel' | 'crc' | 'corPrincipal',
    string
  >>

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'O nome do escritório é obrigatório.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const payload = {
    org_id: orgId,
    nome: body.nome.trim(),
    razao_social: body.razaoSocial?.trim() || null,
    cnpj: body.cnpj?.replace(/\D/g, '') || null,
    telefone: body.telefone?.trim() || null,
    whatsapp: body.whatsapp?.trim() || null,
    email: body.email?.trim() || null,
    site: body.site?.trim() || null,
    cidade: body.cidade?.trim() || null,
    estado: body.estado?.trim().toUpperCase().slice(0, 2) || null,
    contador_responsavel: body.contadorResponsavel?.trim() || null,
    crc: body.crc?.trim() || null,
    cor_principal: body.corPrincipal?.trim() || null,
    atualizado_em: new Date().toISOString(),
  }

  const { data: existente } = await admin.from('rt_escritorio_perfil').select('id').eq('org_id', orgId).maybeSingle()

  const { data, error } = existente
    ? await admin.from('rt_escritorio_perfil').update(payload).eq('id', existente.id).select().single()
    : await admin.from('rt_escritorio_perfil').insert(payload).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data as EscritorioContabilPerfil)
}
