import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizarCnae, type ResultadoConsultaCnae } from '@/lib/tributario/cnae'
import { analisarCnaeComCatalogo } from '@/lib/tributario/cnaeCatalogo'
import { carregarRegrasCnaeVigentes } from '@/lib/tributario/cnaeCatalogoServer'
import { buscarCnaesIbge, consultarCnaeIbge } from '@/lib/tributario/cnaeIbge'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const codigo = searchParams.get('codigo')?.trim() ?? ''
  const termo = searchParams.get('q')?.trim() ?? ''

  try {
    const regrasCatalogo = await carregarRegrasCnaeVigentes(supabase)

    if (codigo) {
      const codigoNormalizado = normalizarCnae(codigo)
      if (codigoNormalizado.length !== 7) {
        return NextResponse.json({ error: 'Informe um CNAE completo com 7 dígitos.' }, { status: 400 })
      }

      const cnae = await consultarCnaeIbge(codigoNormalizado)
      if (!cnae) return NextResponse.json({ error: 'CNAE não encontrado na base oficial do IBGE.' }, { status: 404 })

      const resultado: ResultadoConsultaCnae = { cnae, enquadramento: analisarCnaeComCatalogo(cnae, regrasCatalogo) }
      return NextResponse.json({ fonte: 'CONCLA/IBGE — CNAE-Subclasses', resultado })
    }

    if (termo.length < 2) {
      return NextResponse.json({ error: 'Informe ao menos 2 caracteres para pesquisar.' }, { status: 400 })
    }

    const cnaes = await buscarCnaesIbge(termo)
    const resultados: ResultadoConsultaCnae[] = cnaes.map(cnae => ({
      cnae,
      enquadramento: analisarCnaeComCatalogo(cnae, regrasCatalogo),
    }))

    return NextResponse.json({
      fonte: 'CONCLA/IBGE — CNAE-Subclasses',
      total: resultados.length,
      resultados,
    })
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : 'Falha desconhecida'
    return NextResponse.json(
      { error: `Não foi possível consultar a base oficial do IBGE. Detalhe: ${detalhe}` },
      { status: 502 },
    )
  }
}
