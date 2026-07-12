import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailAutorizadoParaLeads } from '@/lib/security/adminLeads'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ permitido: false }, { status: 401 })

  return NextResponse.json({ permitido: emailAutorizadoParaLeads(user.email) })
}
