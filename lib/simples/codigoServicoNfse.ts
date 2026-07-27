export type OrigemCodigoServicoNfse = 'lista_nacional' | 'municipal' | 'legado'

export interface IdentidadeServicoNfse {
  chave: string
  codigo: string
  codigoNormalizado: string
  origem: OrigemCodigoServicoNfse
  municipioCodigo?: string
}

type ItemServicoMinimo = {
  codigo_produto?: string | null
}

type DocumentoServicoMinimo = {
  parsed_data?: unknown
}

function registro(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : null
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/**
 * Normaliza somente para formar a chave de relacionamento. O código original
 * continua preservado para exibição e auditoria.
 */
export function normalizarCodigoServicoNfse(
  codigo: string,
  origem: OrigemCodigoServicoNfse,
): string {
  const compacto = codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (origem === 'lista_nacional' && /^\d+$/.test(compacto) && compacto.length <= 4) {
    return compacto.padStart(4, '0')
  }
  return compacto
}

export function criarChaveServicoNfse(params: {
  codigo: string
  origem: OrigemCodigoServicoNfse
  municipioCodigo?: string | null
}): string {
  const codigo = normalizarCodigoServicoNfse(params.codigo, params.origem)
  if (!codigo) return ''

  if (params.origem === 'lista_nacional') return `lista_nacional:${codigo}`
  if (params.origem === 'municipal') {
    const municipio = (params.municipioCodigo ?? '').replace(/\D/g, '').slice(0, 7) || 'nao_informado'
    return `municipal:${municipio}:${codigo}`
  }
  return `legado:${codigo}`
}

/**
 * Prioridade deliberada:
 * 1. item/código nacional da Lista de Serviços;
 * 2. código de tributação municipal, identificado também pelo município;
 * 3. campo legado do item, apenas quando a origem não pode ser recuperada.
 */
export function resolverIdentidadeServicoNfse(
  item: ItemServicoMinimo,
  documento?: DocumentoServicoMinimo,
): IdentidadeServicoNfse | null {
  const parsedData = registro(documento?.parsed_data)
  const metadados = registro(parsedData?.metadados)
  const codigoNacional = texto(metadados?.item_lista_servico)
  const codigoMunicipal = texto(metadados?.codigo_tributacao_municipio)
  const municipioCodigo = texto(metadados?.municipio_codigo).replace(/\D/g, '').slice(0, 7) || undefined

  if (codigoNacional) {
    return montarIdentidade(codigoNacional, 'lista_nacional')
  }
  if (codigoMunicipal) {
    return montarIdentidade(codigoMunicipal, 'municipal', municipioCodigo)
  }

  const codigoLegado = (item.codigo_produto ?? '').trim()
  return codigoLegado ? montarIdentidade(codigoLegado, 'legado') : null
}

function montarIdentidade(
  codigo: string,
  origem: OrigemCodigoServicoNfse,
  municipioCodigo?: string,
): IdentidadeServicoNfse {
  return {
    chave: criarChaveServicoNfse({ codigo, origem, municipioCodigo }),
    codigo,
    codigoNormalizado: normalizarCodigoServicoNfse(codigo, origem),
    origem,
    municipioCodigo,
  }
}
