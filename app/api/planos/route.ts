import { NextResponse } from 'next/server'
import { PLANOS_REFORMA_TRIBUTARIA } from '@/lib/planos/reformaTributariaPlanos'

export async function GET() {
  return NextResponse.json(PLANOS_REFORMA_TRIBUTARIA)
}
