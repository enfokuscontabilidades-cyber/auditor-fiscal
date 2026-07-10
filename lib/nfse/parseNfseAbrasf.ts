import type { DocumentoFiscalInput, DocumentoFiscalItemInput } from '@/lib/types'

type XmlElement = Element | null | undefined

function elementsByLocalName(node: Document | Element, name: string): Element[] {
  return Array.from(node.getElementsByTagName('*')).filter(el => el.localName === name)
}

function elementsByLocalNames(node: Document | Element, names: string[]): Element[] {
  const normalized = names.map(name => name.toLowerCase())
  return Array.from(node.getElementsByTagName('*')).filter(el => normalized.includes(el.localName.toLowerCase()))
}

function firstByLocalName(node: Document | Element | null | undefined, name: string): Element | null {
  if (!node) return null
  const direct = node.getElementsByTagName(name)[0]
  if (direct) return direct
  return elementsByLocalName(node, name)[0] ?? null
}

function firstByLocalNames(node: Document | Element | null | undefined, names: string[]): Element | null {
  if (!node) return null
  for (const name of names) {
    const found = firstByLocalName(node, name)
    if (found) return found
  }
  return elementsByLocalNames(node, names)[0] ?? null
}

function text(node: XmlElement, name: string): string {
  return firstByLocalName(node, name)?.textContent?.trim() ?? ''
}

function textAny(node: XmlElement, names: string[]): string {
  const found = firstByLocalNames(node, names)
  return found?.textContent?.trim() ?? ''
}

function firstText(node: XmlElement, names: string[]): string {
  for (const name of names) {
    const value = textAny(node, [name])
    if (value) return value
  }
  return ''
}

function onlyDigits(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '')
}

function numberXml(value: string | null | undefined): number {
  if (!value) return 0
  const clean = value.trim().replace(/R\$/gi, '').replace(/\s/g, '')
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function rawTag(xmlTxt: string, names: string[]): string {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}>`, 'i')
    const match = xmlTxt.match(pattern)
    if (match?.[1]) return decodeXmlEntities(match[1].trim())
  }
  return ''
}

function rawCnpj(xmlTxt: string, role: 'prestador' | 'tomador') {
  const roleTags = role === 'prestador'
    ? ['CNPJPrestador', 'CnpjPrestador', 'CpfCnpjPrestador', 'CPFCNPJPrestador']
    : ['CNPJTomador', 'CnpjTomador', 'CpfCnpjTomador', 'CPFCNPJTomador']
  const direto = rawTag(xmlTxt, roleTags)
  if (direto) return onlyDigits(direto)
  const bloco = rawTag(xmlTxt, role === 'prestador'
    ? ['PrestadorServico', 'Prestador', 'DadosPrestador', 'IdentificacaoPrestador', 'emit', 'prest']
    : ['TomadorServico', 'Tomador', 'DadosTomador', 'IdentificacaoTomador', 'toma'])
  return onlyDigits(rawTag(bloco, ['Cnpj', 'CNPJ', 'Cpf', 'CPF']))
}

function dateIso(value: string): string | undefined {
  if (!value) return undefined
  const compact = value.trim()
  const iso = compact.slice(0, 10).replace(/\//g, '-')
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const ymd = compact.match(/^(\d{4})(\d{2})(\d{2})/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  const br = compact.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/)
  if (br && br[3].length === 2) return `20${br[3]}-${br[2]}-${br[1]}`
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return undefined
}

function competenciaFrom(dataEmissao: string | undefined, competencia: string): string | undefined {
  const comp = competencia.trim()
  if (/^\d{2}\/\d{4}$/.test(comp)) return comp
  const compIso = dateIso(comp)
  const base = compIso ?? dataEmissao
  if (!base) return undefined
  return `${base.slice(5, 7)}/${base.slice(0, 4)}`
}

function findCnpj(node: XmlElement, role?: 'prestador' | 'tomador'): string {
  const roleNames = role === 'prestador'
    ? ['CnpjPrestador', 'CNPJPrestador', 'CpfCnpjPrestador', 'CPFCNPJPrestador']
    : role === 'tomador'
      ? ['CnpjTomador', 'CNPJTomador', 'CpfCnpjTomador', 'CPFCNPJTomador']
      : []
  const cpfCnpj = firstByLocalNames(node ?? null, ['CpfCnpj', 'CPFCNPJ'])
  return onlyDigits(
    textAny(node, roleNames) ||
    textAny(cpfCnpj, ['Cnpj', 'CNPJ', 'Cpf', 'CPF']) ||
    textAny(node, ['Cnpj', 'CNPJ', 'Cpf', 'CPF']),
  )
}

function findNome(node: XmlElement): string {
  return firstText(node, ['RazaoSocial', 'NomeRazaoSocial', 'NomePrestador', 'NomeTomador', 'Nome', 'NomeFantasia'])
}

function municipioCodigo(inf: Element): string {
  const orgao = firstByLocalName(inf, 'OrgaoGerador')
  return onlyDigits(
    firstText(inf, ['cLocIncid', 'cLocEmi', 'cLocalidadeIncid']) ||
    firstText(orgao, ['CodigoMunicipio', 'CodigoMunicipioPrestacao']) ||
    firstText(firstByLocalNames(inf, ['Servico', 'DadosServico', 'serv', 'locPrest']), ['CodigoMunicipio', 'CodigoMunicipioPrestacao', 'cLocPrestacao']) ||
    firstText(firstByLocalNames(inf, ['PrestadorServico', 'Prestador', 'DadosPrestador', 'emit', 'prest']), ['CodigoMunicipio', 'CodigoMunicipioPrestacao', 'cMun']),
  )
}

export interface NfseAbrasfMetadata {
  numero: string
  codigo_verificacao: string
  data_emissao?: string
  competencia?: string
  prestador_cnpj: string
  prestador_nome: string
  tomador_cnpj: string
  tomador_nome: string
  municipio_codigo: string
  discriminacao: string
  item_lista_servico: string
  codigo_tributacao_municipio: string
  valor_servicos: number
  valor_deducoes: number
  valor_iss: number
  iss_retido: boolean
  valor_liquido: number
  cancelada: boolean
}

export interface NfseParseResult {
  documento: Omit<DocumentoFiscalInput, 'empresa_id'>
  itens: Omit<DocumentoFiscalItemInput, 'empresa_id' | 'documento_id'>[]
  metadados: NfseAbrasfMetadata
}

export function chaveNfse(meta: Pick<NfseAbrasfMetadata, 'prestador_cnpj' | 'municipio_codigo' | 'numero' | 'codigo_verificacao'>): string {
  return `NFSE:${meta.prestador_cnpj}:${meta.municipio_codigo}:${meta.numero}:${meta.codigo_verificacao}`
}

function parseInfNfse(inf: Element, xmlTxt: string, nomeArquivo?: string): NfseParseResult | null {
  const servico = firstByLocalNames(inf, ['Servico', 'DadosServico', 'serv', 'cServ'])
  const valores = firstByLocalNames(inf, ['Valores', 'valores', 'vServPrest']) ?? inf
  const prestador = firstByLocalNames(inf, ['PrestadorServico', 'Prestador', 'DadosPrestador', 'IdentificacaoPrestador', 'emit', 'prest']) ?? inf
  const tomador = firstByLocalNames(inf, ['TomadorServico', 'Tomador', 'DadosTomador', 'IdentificacaoTomador', 'toma']) ?? inf
  const data_emissao = dateIso(firstText(inf, ['DataEmissao', 'DataEmissaoNfse', 'DataEmissaoNFSe', 'DtEmissao', 'dhProc', 'dhEmi', 'dCompet']))
  const cancelElementNames = [
    'Cancelamento', 'Confirmacao', 'NfseCancelamento', 'NfseCanc',
    'CancelNfse', 'InfCancelamento', 'ConfirmacaoCancelamento',
  ]
  const statusElementNames = [
    'Situacao', 'CodigoSituacaoNFSe', 'CodigoSituacaoNota',
    'SituacaoNfse', 'SituacaoNFSe', 'StatusNfse', 'TipoNota', 'IndCancelamento',
  ]
  const situacaoCancelada = (): boolean => {
    const doc = inf.ownerDocument
    return statusElementNames.some(name =>
      elementsByLocalName(doc, name).some(el => {
        const v = el.textContent?.trim() ?? ''
        return v === '4' || v === '2' || v === 'C' || v === 'S' || /^cancelad/i.test(v)
      })
    )
  }
  // NFS-e Nacional (SPED): cancelamento via evento <eNNNNNN> com xDesc contendo "cancelamento"
  const temEventoCancelamento = (): boolean => {
    const doc = inf.ownerDocument
    return Array.from(doc.getElementsByTagName('*')).some(el =>
      /^e\d{5,6}$/i.test(el.localName) && /cancelamento/i.test(el.textContent ?? '')
    )
  }
  const cancelada =
    cancelElementNames.some(name => elementsByLocalName(inf.ownerDocument, name).length > 0) ||
    situacaoCancelada() ||
    temEventoCancelamento()

  const metadados: NfseAbrasfMetadata = {
    numero: firstText(inf, ['Numero', 'NumeroNfse', 'NumeroNFSe', 'NumeroNota', 'NumeroNotaFiscal', 'nNFSe', 'nDFSe', 'nDPS']),
    codigo_verificacao: firstText(inf, ['CodigoVerificacao', 'CodVerificacao', 'ChaveAutenticacao']),
    data_emissao,
    competencia: competenciaFrom(data_emissao, firstText(inf, ['Competencia', 'DataCompetencia', 'dCompet'])),
    prestador_cnpj: findCnpj(prestador, 'prestador'),
    prestador_nome: findNome(prestador),
    tomador_cnpj: findCnpj(tomador, 'tomador'),
    tomador_nome: findNome(tomador),
    municipio_codigo: municipioCodigo(inf),
    discriminacao: firstText(servico ?? inf, ['Discriminacao', 'DescricaoServico', 'Descricao', 'xDescServ', 'xTribMun', 'xTribNac']),
    item_lista_servico: firstText(servico, ['ItemListaServico', 'CodigoItemListaServico', 'cTribNac']),
    codigo_tributacao_municipio: firstText(servico, ['CodigoTributacaoMunicipio', 'cTribMun']),
    valor_servicos: numberXml(firstText(valores, ['ValorServicos', 'ValorServico', 'ValorTotalServicos', 'vServ', 'vLiq', 'vBC'])),
    valor_deducoes: numberXml(firstText(valores, ['ValorDeducoes', 'ValorDeducao'])),
    valor_iss: numberXml(firstText(valores, ['ValorIss', 'ValorISS', 'vISSQN'])),
    iss_retido: firstText(valores, ['IssRetido', 'ISSRetido']) === '1' || /^true$/i.test(firstText(valores, ['IssRetido', 'ISSRetido'])),
    valor_liquido: numberXml(firstText(valores, ['ValorLiquidoNfse', 'ValorLiquidoNFSe', 'ValorLiquido', 'vLiq'])) || numberXml(firstText(valores, ['ValorServicos', 'ValorServico', 'ValorTotalServicos', 'vServ', 'vBC'])),
    cancelada,
  }

  if (!metadados.numero || !metadados.prestador_cnpj) return null

  const chave = chaveNfse(metadados)
  const valorTotal = metadados.valor_liquido || metadados.valor_servicos
  const documento: Omit<DocumentoFiscalInput, 'empresa_id'> = {
    tipo_documento: 'nfse',
    origem: 'xml_nfse',
    chave_acesso: chave,
    numero: metadados.numero,
    modelo: 'NFS-e',
    data_emissao: metadados.data_emissao,
    data_competencia: metadados.competencia,
    emitente_cnpj: metadados.prestador_cnpj,
    emitente_nome: metadados.prestador_nome,
    destinatario_cnpj: metadados.tomador_cnpj || undefined,
    destinatario_nome: metadados.tomador_nome || undefined,
    valor_total: metadados.cancelada ? 0 : valorTotal,
    valor_produtos: 0,
    valor_servicos: metadados.cancelada ? 0 : metadados.valor_servicos,
    valor_desconto: metadados.cancelada ? 0 : metadados.valor_deducoes,
    valor_frete: 0,
    valor_icms: 0,
    valor_pis: 0,
    valor_cofins: 0,
    valor_st: 0,
    valor_ipi: 0,
    tipo_movimento: 'saida',
    impacto_receita: metadados.cancelada ? 'sem_impacto' : 'soma_receita',
    origem_devolucao: 'nao_aplicavel',
    status: metadados.cancelada ? 'cancelada' : 'ok',
    nome_arquivo: nomeArquivo,
    parsed_data: { tipo: 'nfse_abrasf', metadados, xml: xmlTxt },
  }

  const itens: Omit<DocumentoFiscalItemInput, 'empresa_id' | 'documento_id'>[] = metadados.cancelada ? [] : [{
    item_numero: 1,
    codigo_produto: metadados.item_lista_servico || metadados.codigo_tributacao_municipio || undefined,
    descricao: metadados.discriminacao || 'Prestacao de servico',
    cfop: undefined,
    unidade: 'UN',
    quantidade: 1,
    valor_unitario: metadados.valor_servicos,
    valor_total: metadados.valor_servicos,
    valor_desconto: metadados.valor_deducoes,
    valor_frete: 0,
    valor_bc_icms: 0,
    aliquota_icms: 0,
    valor_icms: 0,
    valor_bc_st: 0,
    valor_st: 0,
    valor_bc_pis: 0,
    aliquota_pis: 0,
    valor_pis: 0,
    valor_bc_cofins: 0,
    aliquota_cofins: 0,
    valor_cofins: 0,
    valor_ipi: 0,
    classificacao: 'servico',
    natureza_receita_simples: 'tributada',
    tipo_movimento: 'saida',
    impacto_receita: 'soma_receita',
    anexo_sugerido: 'III',
    regra_aplicada: 'NFS-e ABRASF - anexo definido pela configuracao de servicos da empresa',
    classificacao_manual: false,
  }]

  return { documento, itens, metadados }
}

function parseRawNfse(xmlTxt: string, nomeArquivo?: string): NfseParseResult | null {
  const data_emissao = dateIso(rawTag(xmlTxt, ['DataEmissao', 'DataEmissaoNfse', 'DataEmissaoNFSe', 'DtEmissao', 'dhProc', 'dhEmi', 'dCompet']))
  const metadados: NfseAbrasfMetadata = {
    numero: rawTag(xmlTxt, ['NumeroNFSe', 'NumeroNfse', 'NumeroNotaFiscal', 'NumeroNota', 'Numero', 'nNFSe', 'nDFSe', 'nDPS']),
    codigo_verificacao: rawTag(xmlTxt, ['CodigoVerificacao', 'CodVerificacao', 'ChaveAutenticacao']),
    data_emissao,
    competencia: competenciaFrom(data_emissao, rawTag(xmlTxt, ['Competencia', 'DataCompetencia', 'dCompet'])),
    prestador_cnpj: rawCnpj(xmlTxt, 'prestador'),
    prestador_nome: rawTag(xmlTxt, ['NomePrestador', 'RazaoSocialPrestador', 'RazaoSocial', 'xNome']),
    tomador_cnpj: rawCnpj(xmlTxt, 'tomador'),
    tomador_nome: rawTag(xmlTxt, ['NomeTomador', 'RazaoSocialTomador', 'NomeRazaoSocialTomador', 'xNome']),
    municipio_codigo: onlyDigits(rawTag(xmlTxt, ['CodigoMunicipioPrestacao', 'CodigoMunicipio', 'cLocIncid', 'cLocEmi', 'cLocPrestacao'])),
    discriminacao: rawTag(xmlTxt, ['Discriminacao', 'DescricaoServico', 'Descricao', 'xDescServ', 'xTribMun', 'xTribNac']),
    item_lista_servico: rawTag(xmlTxt, ['ItemListaServico', 'CodigoItemListaServico', 'cTribNac']),
    codigo_tributacao_municipio: rawTag(xmlTxt, ['CodigoTributacaoMunicipio', 'cTribMun']),
    valor_servicos: numberXml(rawTag(xmlTxt, ['ValorServicos', 'ValorServico', 'ValorTotalServicos', 'vServ', 'vLiq', 'vBC'])),
    valor_deducoes: numberXml(rawTag(xmlTxt, ['ValorDeducoes', 'ValorDeducao'])),
    valor_iss: numberXml(rawTag(xmlTxt, ['ValorIss', 'ValorISS', 'vISSQN'])),
    iss_retido: rawTag(xmlTxt, ['IssRetido', 'ISSRetido']) === '1' || /^true$/i.test(rawTag(xmlTxt, ['IssRetido', 'ISSRetido'])),
    valor_liquido: numberXml(rawTag(xmlTxt, ['ValorLiquidoNfse', 'ValorLiquidoNFSe', 'ValorLiquido', 'vLiq'])) || numberXml(rawTag(xmlTxt, ['ValorServicos', 'ValorServico', 'ValorTotalServicos', 'vServ', 'vBC'])),
    cancelada: ((): boolean => {
      if (/<[^>]*(?:Cancelamento|Confirmacao|NfseCancelamento|NfseCanc|CancelNfse|InfCancelamento|ConfirmacaoCancelamento)[\s>/]/i.test(xmlTxt)) return true
      // NFS-e Nacional: qualquer <eNNNNNN> cujo conteúdo mencione cancelamento
      if (/<e\d{5,6}[\s>]/.test(xmlTxt) && /xDesc>[^<]*[Cc]ancelamento/i.test(xmlTxt)) return true
      const statusPattern = /<[\w:-]*(?:Situacao|CodigoSituacaoNFSe|CodigoSituacaoNota|SituacaoNfse|SituacaoNFSe|StatusNfse|TipoNota|IndCancelamento)[^>]*>\s*(4|2|C|S|1)\s*<\//i
      if (statusPattern.test(xmlTxt)) return true
      const cancelTextPattern = /<[\w:-]*(?:Situacao|SituacaoNfse|SituacaoNFSe|StatusNfse)[^>]*>\s*[Cc]ancelad/i
      if (cancelTextPattern.test(xmlTxt)) return true
      return false
    })(),
  }

  if (!metadados.numero || !metadados.prestador_cnpj) return null
  return parseInfNfseFromMetadata(metadados, xmlTxt, nomeArquivo)
}

function parseInfNfseFromMetadata(metadados: NfseAbrasfMetadata, xmlTxt: string, nomeArquivo?: string): NfseParseResult {
  const chave = chaveNfse(metadados)
  const valorTotal = metadados.valor_liquido || metadados.valor_servicos
  const documento: Omit<DocumentoFiscalInput, 'empresa_id'> = {
    tipo_documento: 'nfse',
    origem: 'xml_nfse',
    chave_acesso: chave,
    numero: metadados.numero,
    modelo: 'NFS-e',
    data_emissao: metadados.data_emissao,
    data_competencia: metadados.competencia,
    emitente_cnpj: metadados.prestador_cnpj,
    emitente_nome: metadados.prestador_nome,
    destinatario_cnpj: metadados.tomador_cnpj || undefined,
    destinatario_nome: metadados.tomador_nome || undefined,
    valor_total: metadados.cancelada ? 0 : valorTotal,
    valor_produtos: 0,
    valor_servicos: metadados.cancelada ? 0 : metadados.valor_servicos,
    valor_desconto: metadados.cancelada ? 0 : metadados.valor_deducoes,
    valor_frete: 0,
    valor_icms: 0,
    valor_pis: 0,
    valor_cofins: 0,
    valor_st: 0,
    valor_ipi: 0,
    tipo_movimento: 'saida',
    impacto_receita: metadados.cancelada ? 'sem_impacto' : 'soma_receita',
    origem_devolucao: 'nao_aplicavel',
    status: metadados.cancelada ? 'cancelada' : 'ok',
    nome_arquivo: nomeArquivo,
    parsed_data: { tipo: 'nfse_abrasf', metadados, xml: xmlTxt },
  }

  const itens: Omit<DocumentoFiscalItemInput, 'empresa_id' | 'documento_id'>[] = metadados.cancelada ? [] : [{
    item_numero: 1,
    codigo_produto: metadados.item_lista_servico || metadados.codigo_tributacao_municipio || undefined,
    descricao: metadados.discriminacao || 'Prestacao de servico',
    cfop: undefined,
    unidade: 'UN',
    quantidade: 1,
    valor_unitario: metadados.valor_servicos,
    valor_total: metadados.valor_servicos,
    valor_desconto: metadados.valor_deducoes,
    valor_frete: 0,
    valor_bc_icms: 0,
    aliquota_icms: 0,
    valor_icms: 0,
    valor_bc_st: 0,
    valor_st: 0,
    valor_bc_pis: 0,
    aliquota_pis: 0,
    valor_pis: 0,
    valor_bc_cofins: 0,
    aliquota_cofins: 0,
    valor_cofins: 0,
    valor_ipi: 0,
    classificacao: 'servico',
    natureza_receita_simples: 'tributada',
    tipo_movimento: 'saida',
    impacto_receita: 'soma_receita',
    anexo_sugerido: 'III',
    regra_aplicada: 'NFS-e ABRASF - anexo definido pela configuracao de servicos da empresa',
    classificacao_manual: false,
  }]

  return { documento, itens, metadados }
}

export function parseNfseAbrasf(xmlTxt: string, cnpjEmpresa: string, nomeArquivo?: string): NfseParseResult[] {
  const doc = new DOMParser().parseFromString(xmlTxt, 'text/xml')
  if (doc.querySelector('parsererror')) {
    const rawParsed = parseRawNfse(xmlTxt, nomeArquivo)
    const cnpj = onlyDigits(cnpjEmpresa)
    if (!rawParsed) return []
    if (!cnpj) return [rawParsed]
    if (cnpj.length !== 14) return []
    return rawParsed.metadados.prestador_cnpj === cnpj ? [rawParsed] : []
  }

  const infs = [
    ...elementsByLocalName(doc, 'InfNfse'),
    ...elementsByLocalName(doc, 'infNFSe'),
  ]
  const candidatos = infs.length > 0 ? infs : [
    ...elementsByLocalNames(doc, ['NotaFiscaldeServicoEletronicaNFSe', 'NotaFiscalServicoEletronica', 'NFSe', 'Nfse']),
    doc.documentElement,
  ].filter((el, idx, arr): el is Element => Boolean(el) && arr.indexOf(el) === idx)
  const parsedResults = candidatos
    .map(inf => parseInfNfse(inf, xmlTxt, nomeArquivo))
    .filter((item): item is NfseParseResult => item !== null)
  if (parsedResults.length === 0) {
    const rawParsed = parseRawNfse(xmlTxt, nomeArquivo)
    if (rawParsed) parsedResults.push(rawParsed)
  }
  if (parsedResults.length === 0 && /&lt;/.test(xmlTxt)) {
    const decodedParsed = parseRawNfse(decodeXmlEntities(xmlTxt), nomeArquivo)
    if (decodedParsed) parsedResults.push(decodedParsed)
  }

  const cnpj = onlyDigits(cnpjEmpresa)
  if (!cnpj) return parsedResults
  if (cnpj.length !== 14) return []
  return parsedResults.filter(item => item.metadados.prestador_cnpj === cnpj)
}

export function detectarXmlNfseAbrasf(xmlTxt: string): boolean {
  try {
    const doc = new DOMParser().parseFromString(xmlTxt, 'text/xml')
    if (doc.querySelector('parsererror')) return false
    return elementsByLocalName(doc, 'InfNfse').length > 0 ||
      elementsByLocalName(doc, 'CompNfse').length > 0 ||
      elementsByLocalNames(doc, ['NotaFiscaldeServicoEletronicaNFSe', 'NotaFiscalServicoEletronica', 'NFSe', 'Nfse']).length > 0
  } catch {
    return false
  }
}
