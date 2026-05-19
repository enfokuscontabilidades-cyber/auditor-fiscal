import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cnpj: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { cnpj } = await params
  const cnpjLimpo = cnpj.replace(/\D/g, '')

  if (cnpjLimpo.length !== 14) {
    return NextResponse.json({ error: 'CNPJ deve ter 14 dígitos' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    })

    if (res.status === 404) {
      return NextResponse.json({ error: 'CNPJ não encontrado na base da Receita Federal' }, { status: 404 })
    }

    if (!res.ok) {
      return NextResponse.json({ error: `Erro na consulta: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Falha ao conectar com a Receita Federal' }, { status: 502 })
  }
}
