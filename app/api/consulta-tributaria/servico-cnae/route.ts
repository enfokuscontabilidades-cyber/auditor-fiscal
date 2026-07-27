import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TributarioServicoCnaeVinculo } from '@/lib/types'
import type { ResultadoConsultaCnae } from '@/lib/tributario/cnae'
import { consultarCnaeIbge } from '@/lib/tributario/cnaeIbge'
import { analisarCnaeComCatalogo } from '@/lib/tributario/cnaeCatalogo'
import { carregarRegrasCnaeVigentes } from '@/lib/tributario/cnaeCatalogoServer'
import { selecionarVinculoServicoCnae } from '@/lib/simples/vinculoServicoCnae'
import type { OrigemCodigoServicoNfse } from '@/lib/simples/codigoServicoNfse'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const codigo = searchParams.get('codigo')?.trim() ?? ''
  const origem = searchParams.get('origem')?.trim() as OrigemCodigoServicoNfse | undefined
  const municipioCodigo = searchParams.get('municipio_codigo')?.trim() ?? ''
  const descricao = searchParams.get('descricao')?.trim() ?? ''

  if (!codigo || !origem || !['lista_nacional', 'municipal', 'legado'].includes(origem)) {
    return NextResponse.json({ error: 'Código e origem do serviço são obrigatórios.' }, { status: 400 })
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('tributario_servico_cnae_vinculos')
    .select('*')
    .eq('ativo', true)
    .lte('vigencia_inicio', hoje)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${hoje}`)
    .order('prioridade', { ascending: false })
    .order('versao', { ascending: false })

  if (error) {
    return NextResponse.json({
      encontrado: false,
      candidatos: [],
      aviso: 'O catálogo de vínculos ainda não está disponível. Execute a migração correspondente.',
    })
  }

  const vinculo = selecionarVinculoServicoCnae(
    { codigo, origem, municipioCodigo, descricao },
    (data ?? []) as unknown as TributarioServicoCnaeVinculo[],
  )
  if (!vinculo) {
    return NextResponse.json({
      encontrado: false,
      candidatos: [],
      aviso: origem === 'municipal'
        ? 'Código municipal sem correspondência homologada para este município.'
        : 'Serviço sem correspondência CNAE suficientemente segura no catálogo atual.',
    })
  }

  const regrasCnae = await carregarRegrasCnaeVigentes(supabase, hoje)
  const candidatos = (await Promise.all(vinculo.cnaes.map(async codigoCnae => {
    try {
      const cnae = await consultarCnaeIbge(codigoCnae)
      if (!cnae) return null
      return {
        cnae,
        enquadramento: analisarCnaeComCatalogo(cnae, regrasCnae),
      } satisfies ResultadoConsultaCnae
    } catch {
      return null
    }
  }))).filter((item): item is ResultadoConsultaCnae => item !== null)

  return NextResponse.json({
    encontrado: candidatos.length > 0,
    conclusivo: vinculo.conclusivo && candidatos.length === 1,
    confianca: vinculo.confianca,
    explicacao: vinculo.explicacao,
    regra: `${vinculo.codigo_regra}.v${vinculo.versao}`,
    fontes: vinculo.fontes,
    candidatos,
    aviso: vinculo.conclusivo && candidatos.length === 1
      ? 'Correspondência indicativa encontrada. Confirme antes de relacionar.'
      : 'O serviço pode corresponder a mais de um CNAE. Confirme pela descrição efetivamente prestada.',
  })
}
