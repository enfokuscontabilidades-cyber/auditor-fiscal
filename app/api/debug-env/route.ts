import { NextResponse } from 'next/server'

// Rota temporária de diagnóstico — REMOVER APÓS RESOLVER O PROBLEMA
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: url ? `✅ ${url.slice(0, 30)}...` : '❌ VAZIA',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: key ? `✅ ${key.slice(0, 20)}...` : '❌ VAZIA',
    SUPABASE_SERVICE_ROLE_KEY: serviceKey ? `✅ presente (${serviceKey.length} chars)` : '❌ VAZIA',
    NEXT_PUBLIC_APP_URL: appUrl ? `✅ ${appUrl}` : '❌ VAZIA',
  })
}
