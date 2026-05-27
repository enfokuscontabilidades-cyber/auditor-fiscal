import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CnpjDados } from '@/components/ModalCnpj'

// ─── Normalizador ──────────────────────────────────────────────────────────────
//
// A publica.cnpj.ws retorna dados NO FORMATO B (nested):
//
//   Raiz:
//     razao_social, capital_social (STRING "XXXX.XX"), porte, natureza_juridica
//     socios[] → { nome, qualificacao_socio.descricao, data_entrada,
//                  faixa_etaria (STRING), pais.nome }
//
//   estabelecimento:
//     cnpj, tipo, nome_fantasia, situacao_cadastral, data_inicio_atividade
//     tipo_logradouro, logradouro, numero, complemento, bairro, cep
//     cidade.nome, estado.sigla, pais.nome
//     ddd1 + telefone1 (strings), email (string)
//     atividade_principal.{ id, descricao }
//     atividades_secundarias[].{ id, descricao }
//
// O Formato A (flat legado, dados antigos em cache) também é suportado como
// fallback: raw.cnae_fiscal, raw.cnaes_secundarios, raw.qsa, raw.endereco, etc.

function normalizar(
  raw: Record<string, unknown>,
  fonte: 'api' | 'cache',
  consultado_em: string,
): CnpjDados {
  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Converte para string, retorna undefined para null/undefined/objeto/''. */
  function s(v: unknown): string | undefined {
    if (v === null || v === undefined || v === '') return undefined
    if (typeof v === 'object') return undefined
    const r = String(v).trim()
    return r === '' ? undefined : r
  }

  /** Extrai .descricao ou .nome de um objeto, com fallback escalar. */
  function d(obj: unknown, fallback?: unknown): string | undefined {
    const o = (obj && typeof obj === 'object') ? (obj as Record<string, unknown>) : {}
    if (o.descricao && typeof o.descricao !== 'object') return String(o.descricao).trim()
    if (o.nome      && typeof o.nome      !== 'object') return String(o.nome).trim()
    if (fallback !== null && fallback !== undefined && typeof fallback !== 'object')
      return String(fallback).trim() || undefined
    return undefined
  }

  // ── Detectar formato ─────────────────────────────────────────────────────────
  const estab   = (raw.estabelecimento && typeof raw.estabelecimento === 'object'
    ? raw.estabelecimento as Record<string, unknown>
    : {}) as Record<string, unknown>
  const temEstab = !!raw.estabelecimento

  // ── Campos comuns (raiz em ambos os formatos) ────────────────────────────────
  const nj  = (raw.natureza_juridica  ?? {}) as Record<string, unknown>
  const pt  = (raw.porte              ?? {}) as Record<string, unknown>

  // capital_social: STRING no Formato B, number no Formato A
  const capRaw = raw.capital_social ?? estab.capital_social
  const capitalSocial = (capRaw !== null && capRaw !== undefined && capRaw !== '')
    ? (isNaN(Number(capRaw)) ? undefined : Number(capRaw))
    : undefined

  // ── CNPJ ─────────────────────────────────────────────────────────────────────
  const cnpj = String(estab.cnpj ?? raw.cnpj ?? '').replace(/\D/g, '')

  // ── Campos de estabelecimento vs raiz ────────────────────────────────────────
  const nomeFantasia      = s(estab.nome_fantasia ?? raw.nome_fantasia)
  const sitCad            = estab.situacao_cadastral ?? raw.situacao_cadastral
  const situacaoCadastral = sitCad ? String(sitCad).toUpperCase().trim() : undefined
  const tipo              = (estab.tipo ?? raw.tipo) ? String(estab.tipo ?? raw.tipo).toUpperCase().trim() : undefined

  // Data: data_inicio_atividade (B) → data_abertura (A)
  const dataAbertura = s(estab.data_inicio_atividade ?? raw.data_abertura ?? raw.data_inicio_atividade)

  // Campos extras de situação (Formato B)
  const dataSitCad  = s(estab.data_situacao_cadastral  ?? raw.data_situacao_cadastral)
  const motivoSit   = d(estab.motivo_situacao_cadastral ?? raw.motivo_situacao_cadastral) ?? s(estab.motivo_situacao_cadastral ?? raw.motivo_situacao_cadastral)
  const sitEspecial = s(estab.situacao_especial         ?? raw.situacao_especial)
  const dataSitEsp  = s(estab.data_situacao_especial    ?? raw.data_situacao_especial)

  // ── Endereço ─────────────────────────────────────────────────────────────────
  // Formato B: campos diretos em estab (+ cidade/estado/pais objetos)
  // Formato A: objeto raw.endereco com campos aninhados
  const endObj  = (raw.endereco && typeof raw.endereco === 'object'
    ? raw.endereco as Record<string, unknown>
    : {}) as Record<string, unknown>

  // Logradouro — pode ter tipo prefixado (B) ou não (A)
  const tipoLog  = s(estab.tipo_logradouro)
  const logBase  = s(estab.logradouro ?? endObj.logradouro)
  const logradouro = logBase
    ? (tipoLog && !logBase.toUpperCase().startsWith(tipoLog.toUpperCase())
        ? `${tipoLog} ${logBase}`
        : logBase)
    : undefined

  const complemento = (() => {
    const v = s(estab.complemento ?? endObj.complemento)
    if (!v || v === '0') return undefined
    return v
  })()

  // Cidade/Município
  const cidObj = ((estab.cidade     ?? endObj.municipio ?? {}) as Record<string, unknown>)
  const municipio = cidObj.nome
    ? String(cidObj.nome).trim()
    : d(cidObj) ?? s(estab.municipio ?? (typeof endObj.municipio === 'string' ? endObj.municipio : undefined))

  // Estado/UF
  const estObj = ((estab.estado ?? endObj.estado ?? {}) as Record<string, unknown>)
  const uf = estObj.sigla
    ? String(estObj.sigla).trim()
    : d(estObj) ?? s(typeof endObj.uf === 'string' ? endObj.uf : undefined)

  // CEP
  const cep = (estab.cep ?? endObj.cep)
    ? String(estab.cep ?? endObj.cep).replace(/\D/g, '')
    : undefined

  // País — em Format B usa .nome (não .descricao)
  const paisEstab = ((estab.pais ?? {}) as Record<string, unknown>)
  const paisEnd   = ((endObj.pais ?? {}) as Record<string, unknown>)
  const pais = paisEstab.nome     ? String(paisEstab.nome)     :
               paisEstab.descricao? String(paisEstab.descricao):
               paisEnd.descricao  ? String(paisEnd.descricao)  : undefined

  // ── Contato ──────────────────────────────────────────────────────────────────
  // Formato B: estab.ddd1 + estab.telefone1 (strings), estab.email (string)
  // Formato A: raw.telefones[{ ddd, numero }], raw.emails[{ dominio, usuario }]
  const tels  = ((raw.telefones ?? []) as { ddd: string; numero: string }[])
  const mails = ((raw.emails   ?? []) as { dominio: string; usuario: string }[])

  const telefone = (function () {
    if (temEstab && estab.ddd1 && estab.telefone1)
      return `(${estab.ddd1}) ${estab.telefone1}`
    if (tels.length > 0 && tels[0].ddd)
      return `(${tels[0].ddd}) ${tels[0].numero}`
    return undefined
  })()

  const email = (function () {
    // Formato B: campo email direto na string
    const eStr = s(estab.email)
    if (eStr && eStr.includes('@')) return eStr
    // Formato A: array de { dominio, usuario }
    if (mails.length > 0 && mails[0].usuario)
      return `${mails[0].usuario}@${mails[0].dominio}`
    return undefined
  })()

  // ── Atividade principal ───────────────────────────────────────────────────────
  // Formato B: estab.atividade_principal.{ id, descricao }
  // Formato A: raw.cnae_fiscal.{ codigo, descricao }
  const atPObj  = ((estab.atividade_principal ?? raw.cnae_fiscal ?? raw.cnae_fiscal_principal ?? {}) as Record<string, unknown>)
  const atPCod  = s(atPObj.id ?? atPObj.codigo)
  const atPDesc = s(atPObj.descricao)

  // ── Atividades secundárias ───────────────────────────────────────────────────
  // Formato B: estab.atividades_secundarias[].{ id, descricao }
  // Formato A: raw.cnaes_secundarios[].{ codigo, descricao }
  const atSecs = ((estab.atividades_secundarias ?? raw.cnaes_secundarios ?? raw.cnae_fiscal_secundaria ?? []) as Record<string, unknown>[])

  // ── Sócios / QSA ──────────────────────────────────────────────────────────────
  // Formato B (raiz): raw.socios[].{ nome, qualificacao_socio.descricao, data_entrada,
  //                                  faixa_etaria (STRING), pais.nome }
  // Formato A (raiz): raw.qsa[].{ nome_socio, qualificacao_socio.descricao,
  //                               data_entrada_sociedade, faixa_etaria.descricao,
  //                               pais_origem.descricao }
  const socRaw = ((raw.socios ?? raw.qsa ?? []) as Record<string, unknown>[])

  const socios = socRaw.map(sc => {
    const qualifObj = ((sc.qualificacao_socio ?? sc.qualificacao ?? {}) as Record<string, unknown>)
    const paisSObj  = ((sc.pais ?? sc.pais_origem ?? {}) as Record<string, unknown>)

    // faixa_etaria pode ser STRING (Formato B) ou objeto { descricao } (Formato A)
    const faixaEtaria = typeof sc.faixa_etaria === 'string' && sc.faixa_etaria
      ? sc.faixa_etaria
      : d(sc.faixa_etaria)

    // pais: Formato B usa .nome, Formato A usa .descricao
    const paisOrigem = paisSObj.nome
      ? String(paisSObj.nome)
      : (paisSObj.descricao ? String(paisSObj.descricao) : undefined)

    return {
      nome:        s(sc.nome ?? sc.nome_socio),
      qualificacao:qualifObj.descricao ? String(qualifObj.descricao).trim() : s(sc.qualificacao),
      data_entrada:s(sc.data_entrada ?? sc.data_entrada_sociedade),
      faixa_etaria:faixaEtaria ?? undefined,
      pais_origem: paisOrigem,
    }
  })

  // ── Resultado normalizado ─────────────────────────────────────────────────────
  return {
    cnpj,
    razao_social:            String(raw.razao_social ?? estab.razao_social ?? ''),
    nome_fantasia:           nomeFantasia,
    situacao_cadastral:      situacaoCadastral,
    data_situacao_cadastral: dataSitCad,
    motivo_situacao_cadastral:motivoSit,
    situacao_especial:       sitEspecial,
    data_situacao_especial:  dataSitEsp,
    data_abertura:           dataAbertura,
    natureza_juridica:       d(nj, typeof raw.natureza_juridica === 'string' ? raw.natureza_juridica : undefined),
    porte:                   d(pt, typeof raw.porte === 'string' ? raw.porte : undefined),
    tipo,
    capital_social:          capitalSocial,

    endereco: {
      logradouro,
      numero:      s(estab.numero      ?? endObj.numero),
      complemento,
      bairro:      s(estab.bairro      ?? endObj.bairro),
      municipio,
      uf,
      cep,
      pais,
    },

    contato: { telefone, email },

    atividade_principal: atPCod ? { codigo: atPCod, descricao: atPDesc ?? '' } : undefined,

    atividades_secundarias: atSecs.map(c => ({
      codigo:    String(c.id ?? c.codigo    ?? ''),
      descricao: String(c.descricao ?? ''),
    })),

    socios,

    fonte_consulta: fonte,
    consultado_em,
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url  = new URL(req.url)
  const cnpj = (url.searchParams.get('cnpj') ?? '').replace(/\D/g, '')

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: 'CNPJ deve ter 14 dígitos' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── 1. Sempre consulta a API externa primeiro ───────────────────────────────
  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (res.status === 404) {
      return NextResponse.json(
        { error: 'CNPJ não encontrado na Receita Federal' },
        { status: 404 },
      )
    }

    if (!res.ok) throw new Error(`API retornou ${res.status}`)

    const raw   = (await res.json()) as Record<string, unknown>
    const agora = new Date().toISOString()

    // Salva dado bruto — a normalização acontece sempre na leitura
    await admin.from('cnpj_cache').upsert(
      { cnpj, dados: raw, status: 'ok', consultado_em: agora },
      { onConflict: 'cnpj' },
    )

    return NextResponse.json(normalizar(raw, 'api', agora))

  } catch {
    // ── 2. API falhou — usa cache local como fallback ───────────────────────
    const { data: cached } = await supabase
      .from('cnpj_cache')
      .select('dados, consultado_em, status')
      .eq('cnpj', cnpj)
      .eq('status', 'ok')
      .maybeSingle()

    if (cached?.dados) {
      const raw = cached.dados as Record<string, unknown>
      return NextResponse.json(
        normalizar(raw, 'cache', cached.consultado_em as string),
      )
    }

    return NextResponse.json(
      { error: 'Falha ao consultar a Receita Federal e sem cache disponível' },
      { status: 502 },
    )
  }
}
