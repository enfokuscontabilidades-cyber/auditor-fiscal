import 'server-only'

import { normalizarNcm, type NcmOficial } from './ncm'
import { limparDescricaoNcm, montarHierarquiaNcm, type RegistroNcmHierarquia } from './ncmHierarquia'

const URL_NCM_OFICIAL = 'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json'

function textoCampo(registro: Record<string, unknown>, nomes: string[]): string | null {
  const chave = Object.keys(registro).find(item => nomes.includes(item.toLowerCase()))
  if (!chave) return null
  const valor = registro[chave]
  return typeof valor === 'string' || typeof valor === 'number' ? String(valor).trim() : null
}

function extrairRegistros(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  const objeto = payload as Record<string, unknown>
  for (const chave of ['nomenclaturas', 'nomenclatura', 'dados', 'data', 'items']) {
    const encontrada = Object.keys(objeto).find(item => item.toLowerCase() === chave)
    if (encontrada && Array.isArray(objeto[encontrada])) return objeto[encontrada] as unknown[]
  }
  return []
}

export async function consultarNcmOficial(codigoInformado: string): Promise<NcmOficial | null> {
  const codigo = normalizarNcm(codigoInformado)
  if (codigo.length !== 8) return null

  const response = await fetch(URL_NCM_OFICIAL, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`Sistema Classif respondeu com status ${response.status}`)

  const payload: unknown = await response.json()
  const registrosBrutos = extrairRegistros(payload)
  const registro = registrosBrutos.find(item => {
    if (!item || typeof item !== 'object') return false
    const linha = item as Record<string, unknown>
    return normalizarNcm(textoCampo(linha, ['codigo', 'código', 'code']) ?? '') === codigo
  })
  if (!registro || typeof registro !== 'object') return null

  const linha = registro as Record<string, unknown>
  const registrosHierarquia = registrosBrutos.flatMap<RegistroNcmHierarquia>(item => {
    if (!item || typeof item !== 'object') return []
    const registroHierarquia = item as Record<string, unknown>
    const codigoRegistro = textoCampo(registroHierarquia, ['codigo', 'código', 'code'])
    const descricaoRegistro = textoCampo(registroHierarquia, ['descricao', 'descrição', 'description'])
    return codigoRegistro && descricaoRegistro
      ? [{ codigo: codigoRegistro, descricao: descricaoRegistro }]
      : []
  })

  return {
    codigo,
    descricao: limparDescricaoNcm(textoCampo(linha, ['descricao', 'descrição', 'description']) ?? 'Descrição não informada'),
    data_inicio: textoCampo(linha, ['data_inicio', 'datainicio', 'data início']),
    data_fim: textoCampo(linha, ['data_fim', 'datafim', 'data fim']),
    ato_legal: textoCampo(linha, ['ato_legal', 'atolegal', 'ato', 'tipo_ato_ini']),
    hierarquia: montarHierarquiaNcm(registrosHierarquia, codigo),
  }
}

export const FONTE_NCM_OFICIAL = {
  titulo: 'Sistema Classif — Receita Federal',
  referencia: 'Tabela NCM vigente',
  url: 'https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/download-ncm-nomenclatura-comum-do-mercosul',
}
