import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgId } from '@/lib/supabase/org'
import { detectarTipoImagem, EXTENSAO_POR_TIPO, MIME_POR_TIPO, LOGO_TAMANHO_MAXIMO_BYTES } from '@/lib/validacao/imagem'
import { NextResponse } from 'next/server'

const BUCKET = 'escritorio-logos'

async function exigirAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) } as const

  const orgId = await getOrgId(supabase, user.id)
  if (!orgId) return { erro: NextResponse.json({ error: 'Usuário sem organização' }, { status: 403 }) } as const

  const { data: membro } = await supabase
    .from('membros_organizacao')
    .select('papel')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (membro?.papel !== 'admin') {
    return { erro: NextResponse.json({ error: 'Apenas administradores do escritório podem alterar a logo.' }, { status: 403 }) } as const
  }

  return { orgId } as const
}

/**
 * Upload da logo do escritório. O redimensionamento proporcional e a
 * conversão para PNG (preservando transparência) acontecem no navegador
 * antes do envio (canvas) — aqui só validamos o tipo real do arquivo
 * (magic bytes, nunca a extensão) e o tamanho, e gravamos num bucket
 * privado. O preview é sempre servido via signed URL (nunca URL pública).
 */
export async function POST(request: Request) {
  const ctx = await exigirAdmin()
  if ('erro' in ctx) return ctx.erro
  const { orgId } = ctx

  const admin = createAdminClient()

  const { data: perfil } = await admin.from('rt_escritorio_perfil').select('id, logo_path').eq('org_id', orgId).maybeSingle()
  if (!perfil) {
    return NextResponse.json({ error: 'Cadastre o nome do escritório antes de enviar a logo.' }, { status: 400 })
  }

  const form = await request.formData()
  const arquivo = form.get('logo')
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'Arquivo de logo não enviado.' }, { status: 400 })
  }

  if (arquivo.size === 0 || arquivo.size > LOGO_TAMANHO_MAXIMO_BYTES) {
    return NextResponse.json({ error: `A logo deve ter no máximo ${LOGO_TAMANHO_MAXIMO_BYTES / (1024 * 1024)}MB.` }, { status: 400 })
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const tipo = detectarTipoImagem(bytes)
  if (!tipo) {
    return NextResponse.json({ error: 'Formato de imagem não reconhecido. Envie PNG, JPG/JPEG ou WEBP.' }, { status: 400 })
  }

  const path = `${orgId}/${crypto.randomUUID()}.${EXTENSAO_POR_TIPO[tipo]}`

  const { error: erroUpload } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: MIME_POR_TIPO[tipo], upsert: false })

  if (erroUpload) return NextResponse.json({ error: erroUpload.message }, { status: 500 })

  const { error: erroUpdate } = await admin
    .from('rt_escritorio_perfil')
    .update({ logo_path: path, logo_atualizado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() })
    .eq('id', perfil.id)

  if (erroUpdate) return NextResponse.json({ error: erroUpdate.message }, { status: 500 })

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 600)

  return NextResponse.json({ logoPath: path, logoUrl: signed?.signedUrl ?? null })
}

/**
 * Remove a logo do perfil. O arquivo permanece no bucket (não é apagado)
 * para que relatórios já gerados, cujo registro de auditoria referencia
 * o caminho antigo, continuem íntegros — só o ponteiro do perfil muda.
 */
export async function DELETE() {
  const ctx = await exigirAdmin()
  if ('erro' in ctx) return ctx.erro
  const { orgId } = ctx

  const admin = createAdminClient()
  const { error } = await admin
    .from('rt_escritorio_perfil')
    .update({ logo_path: null, logo_atualizado_em: null, atualizado_em: new Date().toISOString() })
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
