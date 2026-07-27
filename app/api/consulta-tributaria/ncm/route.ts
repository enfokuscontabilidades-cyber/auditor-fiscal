import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TributarioNcmOperacao, TributarioNcmPerfil, TributarioNcmPosicaoIcms } from '@/lib/types'
import { analisarNcmComCatalogo, normalizarCest, normalizarNcm } from '@/lib/tributario/ncm'
import { carregarRegrasNcmVigentes } from '@/lib/tributario/ncmCatalogoServer'
import { consultarNcmOficial, FONTE_NCM_OFICIAL } from '@/lib/tributario/ncmOficial'

const PERFIS: TributarioNcmPerfil[] = ['fabricante', 'importador', 'atacadista', 'varejista', 'consumidor_final']
const OPERACOES: TributarioNcmOperacao[] = ['venda_producao', 'importacao', 'revenda', 'venda_consumidor', 'qualquer']
const POSICOES_ICMS: TributarioNcmPosicaoIcms[] = ['substituto', 'substituido', 'nao_informada']

function perfilValido(valor: string): valor is TributarioNcmPerfil {
  return PERFIS.includes(valor as TributarioNcmPerfil)
}

function operacaoValida(valor: string): valor is TributarioNcmOperacao {
  return OPERACOES.includes(valor as TributarioNcmOperacao)
}

function posicaoIcmsValida(valor: string): valor is TributarioNcmPosicaoIcms {
  return POSICOES_ICMS.includes(valor as TributarioNcmPosicaoIcms)
}

function ufValida(valor: string): boolean {
  return valor === '' || /^[A-Z]{2}$/.test(valor)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ncm = normalizarNcm(searchParams.get('ncm') ?? '')
  const perfilInformado = searchParams.get('perfil') ?? 'varejista'
  const operacaoInformada = searchParams.get('operacao') ?? 'revenda'
  const descricao = searchParams.get('descricao')?.trim() ?? ''
  const cestInformado = searchParams.get('cest')?.trim() ?? ''
  const cest = normalizarCest(cestInformado)
  const ufOrigem = (searchParams.get('uf_origem') ?? '').trim().toUpperCase()
  const ufDestino = (searchParams.get('uf_destino') ?? '').trim().toUpperCase()
  const posicaoIcms = searchParams.get('posicao_icms') ?? 'nao_informada'
  const dataReferencia = searchParams.get('data')?.trim() || new Date().toISOString().slice(0, 10)

  if (ncm.length !== 8) {
    return NextResponse.json({ error: 'Informe um NCM completo com 8 dígitos.' }, { status: 400 })
  }
  if (!perfilValido(perfilInformado)) {
    return NextResponse.json({ error: 'Perfil da empresa inválido.' }, { status: 400 })
  }
  if (!operacaoValida(operacaoInformada)) {
    return NextResponse.json({ error: 'Tipo de operação inválido.' }, { status: 400 })
  }
  if (cestInformado && cest.length !== 7) {
    return NextResponse.json({ error: 'Informe um CEST completo com 7 dígitos.' }, { status: 400 })
  }
  if (!ufValida(ufOrigem) || !ufValida(ufDestino)) {
    return NextResponse.json({ error: 'Informe UFs válidas com duas letras.' }, { status: 400 })
  }
  if (!posicaoIcmsValida(posicaoIcms)) {
    return NextResponse.json({ error: 'Posição da empresa no ICMS-ST inválida.' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataReferencia) || Number.isNaN(Date.parse(`${dataReferencia}T00:00:00Z`))) {
    return NextResponse.json({ error: 'Data de referência inválida.' }, { status: 400 })
  }

  const [regras, classificacao] = await Promise.all([
    carregarRegrasNcmVigentes(supabase, dataReferencia),
    consultarNcmOficial(ncm).catch(() => null),
  ])

  const resultado = analisarNcmComCatalogo({
    ncm,
    perfil: perfilInformado,
    operacao: operacaoInformada,
    descricao,
    cest,
    ufOrigem,
    ufDestino,
    posicaoIcms,
    classificacaoOficial: classificacao,
    regras,
  })

  if (regras.length === 0) {
    resultado.avisos.unshift('O catálogo tributário de NCM ainda não está disponível no banco. Aplique a migração correspondente no Supabase.')
  }

  return NextResponse.json({
    fonte: FONTE_NCM_OFICIAL,
    data_referencia: dataReferencia,
    resultado,
  })
}
