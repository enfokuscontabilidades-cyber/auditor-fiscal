import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  TributarioNcmContextoOperacao,
  TributarioNcmContextoProduto,
  TributarioNcmOperacao,
  TributarioNcmPerfil,
  TributarioNcmRegimeApuracao,
} from '@/lib/types'
import { analisarNcmComCatalogo, normalizarNcm } from '@/lib/tributario/ncm'
import { carregarRegrasNcmVigentes } from '@/lib/tributario/ncmCatalogoServer'
import { consultarNcmOficial, FONTE_NCM_OFICIAL } from '@/lib/tributario/ncmOficial'
import { consultarTipiOficial, FONTE_TIPI_OFICIAL } from '@/lib/tributario/tipiOficial'

const PERFIS: TributarioNcmPerfil[] = ['fabricante', 'importador', 'distribuidor', 'atacadista', 'varejista', 'consumidor_final']
const OPERACOES: TributarioNcmOperacao[] = ['venda_producao', 'importacao', 'revenda', 'venda_consumidor', 'qualquer']
const REGIMES_APURACAO: TributarioNcmRegimeApuracao[] = ['nao_informado', 'percentual', 'especial_unidade']
const CONTEXTOS_PRODUTO: TributarioNcmContextoProduto[] = ['nao_informado', 'glp_domestico_ate_13kg', 'demais']
const CONTEXTOS_OPERACAO: TributarioNcmContextoOperacao[] = ['nao_informado', 'fabricante_veiculos', 'atacadista_varejista', 'consumidor', 'outro']

function perfilValido(valor: string): valor is TributarioNcmPerfil {
  return PERFIS.includes(valor as TributarioNcmPerfil)
}

function operacaoValida(valor: string): valor is TributarioNcmOperacao {
  return OPERACOES.includes(valor as TributarioNcmOperacao)
}

function regimeApuracaoValido(valor: string): valor is TributarioNcmRegimeApuracao {
  return REGIMES_APURACAO.includes(valor as TributarioNcmRegimeApuracao)
}

function contextoProdutoValido(valor: string): valor is TributarioNcmContextoProduto {
  return CONTEXTOS_PRODUTO.includes(valor as TributarioNcmContextoProduto)
}

function contextoOperacaoValido(valor: string): valor is TributarioNcmContextoOperacao {
  return CONTEXTOS_OPERACAO.includes(valor as TributarioNcmContextoOperacao)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ncm = normalizarNcm(searchParams.get('ncm') ?? '')
  const perfilInformado = searchParams.get('perfil') ?? 'varejista'
  const operacaoInformada = searchParams.get('operacao') ?? 'revenda'
  const regimeApuracaoInformado = searchParams.get('regime_apuracao') ?? 'nao_informado'
  const contextoProdutoInformado = searchParams.get('contexto_produto') ?? 'nao_informado'
  const contextoOperacaoInformado = searchParams.get('contexto_operacao') ?? 'nao_informado'
  const descricao = searchParams.get('descricao')?.trim() ?? ''
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
  if (!regimeApuracaoValido(regimeApuracaoInformado)) {
    return NextResponse.json({ error: 'Regime de apuração inválido.' }, { status: 400 })
  }
  if (!contextoProdutoValido(contextoProdutoInformado)) {
    return NextResponse.json({ error: 'Condição especial do produto inválida.' }, { status: 400 })
  }
  if (!contextoOperacaoValido(contextoOperacaoInformado)) {
    return NextResponse.json({ error: 'Contexto da operação inválido.' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataReferencia) || Number.isNaN(Date.parse(`${dataReferencia}T00:00:00Z`))) {
    return NextResponse.json({ error: 'Data de referência inválida.' }, { status: 400 })
  }

  const [regras, classificacao, tipi] = await Promise.all([
    carregarRegrasNcmVigentes(supabase, dataReferencia),
    consultarNcmOficial(ncm).catch(() => null),
    consultarTipiOficial(ncm).catch(() => null),
  ])

  const resultado = analisarNcmComCatalogo({
    ncm,
    perfil: perfilInformado,
    operacao: operacaoInformada,
    regimeApuracao: regimeApuracaoInformado,
    contextoProduto: contextoProdutoInformado,
    contextoOperacao: contextoOperacaoInformado,
    descricao,
    classificacaoOficial: classificacao,
    tipiOficial: tipi,
    escopoTributos: ['pis', 'cofins', 'ipi'],
    regras,
  })

  if (regras.length === 0) {
    resultado.avisos.unshift('O catálogo tributário de NCM ainda não está disponível no banco. Aplique a migração correspondente no Supabase.')
  }

  return NextResponse.json({
    fonte: FONTE_NCM_OFICIAL,
    fonte_tipi: FONTE_TIPI_OFICIAL,
    data_referencia: dataReferencia,
    resultado,
  })
}
