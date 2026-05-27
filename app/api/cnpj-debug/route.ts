// ─── Endpoint de diagnóstico — retorna o JSON bruto da publica.cnpj.ws ────────
// Usar: GET /api/cnpj-debug?cnpj=XXXXXXXXXXXXXX
// Remover após confirmar o formato da API.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url  = new URL(req.url)
  const cnpj = (url.searchParams.get('cnpj') ?? '').replace(/\D/g, '')

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: 'CNPJ deve ter 14 dígitos' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ error: `API retornou ${res.status}`, status: res.status }, { status: res.status })
    }

    const raw = await res.json()

    // Retorna o dado bruto + lista de chaves para diagnóstico
    return NextResponse.json({
      _diagnostico: {
        chaves_raiz: Object.keys(raw as object),
        tem_estabelecimento: 'estabelecimento' in (raw as object),
        chaves_estabelecimento: 'estabelecimento' in (raw as object)
          ? Object.keys((raw as Record<string, unknown>).estabelecimento as object)
          : [],
      },
      _raw: raw,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
