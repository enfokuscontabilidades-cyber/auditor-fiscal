export type SituacaoTributo =
  | 'cabecalho'
  | 'itens'
  | 'zero'
  | 'nao_informado'
  | 'nao_aplicavel'
  | 'divergente'

export type ChaveTributo = 'icms' | 'st' | 'ipi' | 'pis' | 'cofins'

export type ResultadoTributo = {
  valor: number | null
  valor_cabecalho: number | null
  valor_itens: number | null
  situacao: SituacaoTributo
  fonte: 'cabecalho' | 'itens' | null
  diferenca: number | null
}

export type ItemParaConsolidacao = {
  documento_id: string
  valor_total?: number | null
  valor_bc_icms?: number | null
  valor_icms?: number | null
  valor_bc_st?: number | null
  valor_st?: number | null
  valor_ipi?: number | null
  valor_pis?: number | null
  valor_cofins?: number | null
  cst_icms?: string | null
  csosn?: string | null
  cst_ipi?: string | null
  cst_pis?: string | null
  cst_cofins?: string | null
}

export type DocumentoParaConsolidacao = {
  id: string
  tipo_documento?: string | null
  valor_produtos?: number | null
  valor_servicos?: number | null
  valor_icms?: number | null
  valor_st?: number | null
  valor_ipi?: number | null
  valor_pis?: number | null
  valor_cofins?: number | null
  parsed_data?: unknown
}

export type AuditoriaDocumentoFiscal = {
  itens: number
  soma_produtos_itens: number | null
  diferenca_produtos: number | null
  base_icms_itens: number | null
  base_st_itens: number | null
  tributos: Record<ChaveTributo, ResultadoTributo>
  divergencias: string[]
  tem_divergencia: boolean
  dados_incompletos: boolean
}

type PresencaCabecalho = Partial<Record<ChaveTributo, boolean>>

function numeroOuNull(valor: number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : null
}

function arredondar(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

function somar(itens: ItemParaConsolidacao[], campo: keyof ItemParaConsolidacao): number | null {
  if (itens.length === 0) return null
  return arredondar(itens.reduce((total, item) => total + (numeroOuNull(item[campo] as number | null | undefined) ?? 0), 0))
}

function registro(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function presencaCabecalho(parsedData: unknown): PresencaCabecalho {
  const raiz = registro(parsedData)
  const tributos = registro(raiz?.tributos_cabecalho_informados)
  if (!tributos) return {}
  return {
    icms: tributos.valor_icms === true,
    st: tributos.valor_st === true,
    ipi: tributos.valor_ipi === true,
    pis: tributos.valor_pis === true,
    cofins: tributos.valor_cofins === true,
  }
}

function consolidarTributo(params: {
  cabecalho: number | null
  itens: number | null
  cabecalhoInformado?: boolean
  itemInformado: boolean
  naoAplicavelSemGrupo: boolean
}): ResultadoTributo {
  const { cabecalho, itens, cabecalhoInformado, itemInformado, naoAplicavelSemGrupo } = params
  const valorCabecalho = numeroOuNull(cabecalho)
  const valorItens = numeroOuNull(itens)
  const cabecalhoPositivo = (valorCabecalho ?? 0) > 0
  const itensPositivo = (valorItens ?? 0) > 0

  if (cabecalhoPositivo && itensPositivo) {
    const diferenca = arredondar((valorCabecalho ?? 0) - (valorItens ?? 0))
    if (Math.abs(diferenca) > 0.01) {
      return {
        valor: valorCabecalho,
        valor_cabecalho: valorCabecalho,
        valor_itens: valorItens,
        situacao: 'divergente',
        fonte: 'cabecalho',
        diferenca,
      }
    }
    return {
      valor: valorCabecalho,
      valor_cabecalho: valorCabecalho,
      valor_itens: valorItens,
      situacao: 'cabecalho',
      fonte: 'cabecalho',
      diferenca: 0,
    }
  }

  if (cabecalhoPositivo) {
    return {
      valor: valorCabecalho,
      valor_cabecalho: valorCabecalho,
      valor_itens: valorItens,
      situacao: 'cabecalho',
      fonte: 'cabecalho',
      diferenca: valorItens === null ? null : arredondar((valorCabecalho ?? 0) - valorItens),
    }
  }

  if (itensPositivo) {
    return {
      valor: valorItens,
      valor_cabecalho: valorCabecalho,
      valor_itens: valorItens,
      situacao: 'itens',
      fonte: 'itens',
      diferenca: valorCabecalho === null ? null : arredondar(valorCabecalho - (valorItens ?? 0)),
    }
  }

  if (cabecalhoInformado || itemInformado) {
    return {
      valor: 0,
      valor_cabecalho: valorCabecalho,
      valor_itens: valorItens,
      situacao: 'zero',
      fonte: cabecalhoInformado ? 'cabecalho' : 'itens',
      diferenca: 0,
    }
  }

  return {
    valor: null,
    valor_cabecalho: valorCabecalho,
    valor_itens: valorItens,
    situacao: naoAplicavelSemGrupo ? 'nao_aplicavel' : 'nao_informado',
    fonte: null,
    diferenca: null,
  }
}

export function agruparItensPorDocumento<T extends ItemParaConsolidacao>(itens: T[]) {
  const mapa = new Map<string, T[]>()
  for (const item of itens) {
    const grupo = mapa.get(item.documento_id) ?? []
    grupo.push(item)
    mapa.set(item.documento_id, grupo)
  }
  return mapa
}

export function consolidarDocumentoFiscal(
  documento: DocumentoParaConsolidacao,
  itens: ItemParaConsolidacao[],
): AuditoriaDocumentoFiscal {
  const ehNfse = documento.tipo_documento === 'nfse'
  const presenca = presencaCabecalho(documento.parsed_data)
  const somaProdutos = somar(itens, 'valor_total')
  const baseIcms = somar(itens, 'valor_bc_icms')
  const baseSt = somar(itens, 'valor_bc_st')
  const temGrupoIcms = itens.some(item => Boolean(item.cst_icms || item.csosn) || (numeroOuNull(item.valor_bc_icms) ?? 0) > 0 || (numeroOuNull(item.valor_icms) ?? 0) > 0)
  const temGrupoSt = itens.some(item => (numeroOuNull(item.valor_bc_st) ?? 0) > 0 || (numeroOuNull(item.valor_st) ?? 0) > 0)
  const temGrupoIpi = itens.some(item => Boolean(item.cst_ipi) || (numeroOuNull(item.valor_ipi) ?? 0) > 0)
  const temGrupoPis = itens.some(item => Boolean(item.cst_pis) || (numeroOuNull(item.valor_pis) ?? 0) > 0)
  const temGrupoCofins = itens.some(item => Boolean(item.cst_cofins) || (numeroOuNull(item.valor_cofins) ?? 0) > 0)

  const tributos: Record<ChaveTributo, ResultadoTributo> = {
    icms: consolidarTributo({
      cabecalho: numeroOuNull(documento.valor_icms),
      itens: somar(itens, 'valor_icms'),
      cabecalhoInformado: presenca.icms,
      itemInformado: temGrupoIcms,
      naoAplicavelSemGrupo: ehNfse,
    }),
    st: consolidarTributo({
      cabecalho: numeroOuNull(documento.valor_st),
      itens: somar(itens, 'valor_st'),
      cabecalhoInformado: presenca.st,
      itemInformado: temGrupoSt,
      naoAplicavelSemGrupo: itens.length > 0,
    }),
    ipi: consolidarTributo({
      cabecalho: numeroOuNull(documento.valor_ipi),
      itens: somar(itens, 'valor_ipi'),
      cabecalhoInformado: presenca.ipi,
      itemInformado: temGrupoIpi,
      naoAplicavelSemGrupo: itens.length > 0,
    }),
    pis: consolidarTributo({
      cabecalho: numeroOuNull(documento.valor_pis),
      itens: somar(itens, 'valor_pis'),
      cabecalhoInformado: presenca.pis,
      itemInformado: temGrupoPis,
      naoAplicavelSemGrupo: itens.length > 0,
    }),
    cofins: consolidarTributo({
      cabecalho: numeroOuNull(documento.valor_cofins),
      itens: somar(itens, 'valor_cofins'),
      cabecalhoInformado: presenca.cofins,
      itemInformado: temGrupoCofins,
      naoAplicavelSemGrupo: itens.length > 0,
    }),
  }

  const valorItensCabecalho = numeroOuNull(ehNfse ? documento.valor_servicos : documento.valor_produtos)
  const diferencaProdutos = valorItensCabecalho === null || somaProdutos === null
    ? null
    : arredondar(valorItensCabecalho - somaProdutos)
  const divergencias: string[] = []

  if (itens.length === 0) divergencias.push('Documento sem itens estruturados.')
  if (diferencaProdutos !== null && Math.abs(diferencaProdutos) > 0.01) {
    const natureza = ehNfse ? 'servicos' : 'produtos'
    divergencias.push(`Valor dos ${natureza} difere da soma dos itens em R$ ${Math.abs(diferencaProdutos).toFixed(2)}.`)
  }
  for (const [chave, resultado] of Object.entries(tributos) as [ChaveTributo, ResultadoTributo][]) {
    if (resultado.situacao === 'divergente') {
      divergencias.push(`${chave.toUpperCase()} do cabecalho difere da soma dos itens em R$ ${Math.abs(resultado.diferenca ?? 0).toFixed(2)}.`)
    }
  }

  const dadosIncompletos = itens.length === 0 || (!ehNfse && tributos.icms.situacao === 'nao_informado')
  return {
    itens: itens.length,
    soma_produtos_itens: somaProdutos,
    diferenca_produtos: diferencaProdutos,
    base_icms_itens: baseIcms,
    base_st_itens: baseSt,
    tributos,
    divergencias,
    tem_divergencia: divergencias.length > 0,
    dados_incompletos: dadosIncompletos,
  }
}
