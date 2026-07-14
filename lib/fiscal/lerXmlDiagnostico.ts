export interface ItemXmlDiagnostico {
  itemNumero: string
  descricao: string
  ncm: string
  cfop: string
  valorItem: number
  cst: string
  cclass: string
  base: number
  aliquotaIbsUf: number
  valorIbsUf: number
  aliquotaIbsMun: number
  valorIbsMun: number
  valorIbs: number
  aliquotaCbs: number
  valorCbs: number
}

export interface DocumentoXmlDiagnostico {
  tipoDocumento: string
  numero: string
  serie: string
  dataEmissao: string
  emitenteCnpj: string
  emitenteNome: string
  chaveAcesso: string | null
  totalizadorIbs: number | null
  totalizadorCbs: number | null
  itens: ItemXmlDiagnostico[]
}

export type MotivoFalhaXmlDiagnostico =
  | 'arquivo_vazio'
  | 'arquivo_grande'
  | 'xml_invalido'
  | 'xml_perigoso'
  | 'documento_nao_suportado'
  | 'sem_itens'

export type LeituraXmlResultado =
  | { ok: true; documento: DocumentoXmlDiagnostico }
  | { ok: false; motivo: MotivoFalhaXmlDiagnostico }

type LeituraXmlFalha = Extract<LeituraXmlResultado, { ok: false }>

const TAMANHO_MAXIMO_XML = 5 * 1024 * 1024

function escaparRegex(valor: string) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function padraoTag(nome: string) {
  return `(?:[\\w.-]+:)?${escaparRegex(nome)}`
}

function textoEntre(xml: string, tag: string): string {
  const tagPattern = padraoTag(tag)
  const match = new RegExp(`<${tagPattern}\\b[^>]*>([\\s\\S]*?)<\\/${tagPattern}>`, 'i').exec(xml)
  return decodeEntidadesBasicas(match?.[1]?.trim() ?? '')
}

function existeTag(xml: string, tag: string): boolean {
  return new RegExp(`<${padraoTag(tag)}\\b`, 'i').test(xml)
}

function blocoEntre(xml: string, tag: string): string {
  const tagPattern = padraoTag(tag)
  const match = new RegExp(`<${tagPattern}\\b[^>]*>([\\s\\S]*?)<\\/${tagPattern}>`, 'i').exec(xml)
  return match?.[1] ?? ''
}

function todosBlocosEntre(xml: string, tag: string): string[] {
  const tagPattern = padraoTag(tag)
  const regex = new RegExp(`<${tagPattern}\\b[^>]*>([\\s\\S]*?)<\\/${tagPattern}>`, 'gi')
  const blocos: string[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(xml)) !== null) {
    blocos.push(match[1])
  }

  return blocos
}

function atributoDaTagAbertura(xml: string, tag: string, atributo: string): string {
  const tagPattern = padraoTag(tag)
  const abertura = new RegExp(`<${tagPattern}\\b([^>]*)>`, 'i').exec(xml)?.[1] ?? ''
  const attr = new RegExp(`${escaparRegex(atributo)}\\s*=\\s*["']([^"']+)["']`, 'i').exec(abertura)
  return attr?.[1] ?? ''
}

function extrairChaveDoAtributoId(id: string): string | null {
  const chave = id.replace(/^NFe/i, '').replace(/\D/g, '')
  return chave.length >= 40 ? chave : null
}

function decodeEntidadesBasicas(valor: string): string {
  return valor
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function numero(valor: string): number {
  const limpo = valor
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .trim()

  if (!limpo) return 0

  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo

  const n = Number(normalizado)
  return Number.isFinite(n) ? n : 0
}

function contemDeclaracaoPerigosa(xml: string): boolean {
  return /<!DOCTYPE|<!ENTITY/i.test(xml)
}

function textoPrimeiro(xml: string, tags: string[]): string {
  for (const tag of tags) {
    const valor = textoEntre(xml, tag)
    if (valor) return valor
  }

  return ''
}

function blocoPrimeiro(xml: string, tags: string[]): string {
  for (const tag of tags) {
    const bloco = blocoEntre(xml, tag)
    if (bloco) return bloco
  }

  return ''
}

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

function dataPrimeira(xml: string, tags: string[]): string {
  const valor = textoPrimeiro(xml, tags)
  if (!valor) return ''

  const iso = valor.match(/\d{4}-\d{2}-\d{2}/)?.[0]
  if (iso) return iso

  const compacta = valor.match(/^(\d{4})(\d{2})(\d{2})/)
  if (compacta) return `${compacta[1]}-${compacta[2]}-${compacta[3]}`

  const brasileira = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brasileira) return `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`

  return valor
}

function valorNumericoPrimeiro(xml: string, tags: string[]): number {
  for (const tag of tags) {
    const valor = textoEntre(xml, tag)
    if (valor) return numero(valor)
  }

  return 0
}

function cnpjOuCpfPrimeiro(xml: string, tags: string[]): string {
  for (const tag of tags) {
    const valor = apenasDigitos(textoEntre(xml, tag))
    if (valor) return valor
  }

  return ''
}

function totalizadorOpcional(xml: string, tag: string): number | null {
  return existeTag(xml, tag) ? numero(textoEntre(xml, tag)) : null
}

function leituraFalhou(resultado: LeituraXmlResultado): resultado is LeituraXmlFalha {
  return !resultado.ok
}

function primeiroNumero(...valores: Array<number | null | undefined>): number {
  for (const valor of valores) {
    if (typeof valor === 'number' && Number.isFinite(valor) && valor !== 0) return valor
  }

  return 0
}

function primeiroTexto(...valores: string[]): string {
  return valores.find(valor => valor.trim()) || ''
}

function lerNfeDiagnostico(xml: string): LeituraXmlResultado {
  const infNfe = blocoEntre(xml, 'infNFe')

  if (!infNfe) {
    return { ok: false, motivo: 'documento_nao_suportado' }
  }

  const ide = blocoEntre(infNfe, 'ide')
  const emit = blocoEntre(infNfe, 'emit')
  const mod = textoEntre(ide, 'mod')
  const idAttr = atributoDaTagAbertura(xml, 'infNFe', 'Id')
  const chaveAcesso = extrairChaveDoAtributoId(idAttr)

  const detBlocos = todosBlocosEntre(infNfe, 'det')

  if (detBlocos.length === 0) {
    return { ok: false, motivo: 'sem_itens' }
  }

  const itens = detBlocos.map((det, indice): ItemXmlDiagnostico => {
    const prod = blocoEntre(det, 'prod')
    const imposto = blocoEntre(det, 'imposto')
    const ibscbs = blocoEntre(imposto, 'IBSCBS')
    const gIbsCbs = blocoEntre(ibscbs, 'gIBSCBS')
    const gIbsUf = blocoEntre(gIbsCbs, 'gIBSUF')
    const gIbsMun = blocoEntre(gIbsCbs, 'gIBSMun')
    const gCbs = blocoEntre(ibscbs, 'gCBS')
    const valorIbsUf = numero(textoEntre(gIbsUf, 'vIBSUF'))
    const valorIbsMun = numero(textoEntre(gIbsMun, 'vIBSMun'))

    return {
      itemNumero: String(indice + 1),
      descricao: textoEntre(prod, 'xProd'),
      ncm: textoEntre(prod, 'NCM'),
      cfop: textoEntre(prod, 'CFOP'),
      valorItem: numero(textoEntre(prod, 'vProd')),
      cst: textoEntre(ibscbs, 'CST'),
      cclass: textoEntre(ibscbs, 'cClassTrib'),
      base: numero(textoEntre(gIbsCbs, 'vBC')),
      aliquotaIbsUf: numero(textoEntre(gIbsUf, 'pIBSUF')),
      valorIbsUf,
      aliquotaIbsMun: numero(textoEntre(gIbsMun, 'pIBSMun')),
      valorIbsMun,
      valorIbs: valorIbsUf + valorIbsMun,
      aliquotaCbs: numero(textoEntre(gCbs, 'pCBS')),
      valorCbs: numero(textoEntre(gCbs, 'vCBS')),
    }
  })

  const total = blocoEntre(infNfe, 'total')
  const ibscbsTotal = blocoEntre(total, 'IBSCBSTot')

  return {
    ok: true,
    documento: {
      tipoDocumento: mod === '65' ? 'NFC-e' : 'NF-e',
      numero: textoEntre(ide, 'nNF') || '-',
      serie: textoEntre(ide, 'serie') || '-',
      dataEmissao: (textoEntre(ide, 'dhEmi') || textoEntre(ide, 'dEmi')).slice(0, 10),
      emitenteCnpj: textoEntre(emit, 'CNPJ') || textoEntre(emit, 'CPF'),
      emitenteNome: textoEntre(emit, 'xNome'),
      chaveAcesso,
      totalizadorIbs: totalizadorOpcional(ibscbsTotal, 'vIBS'),
      totalizadorCbs: totalizadorOpcional(ibscbsTotal, 'vCBS'),
      itens,
    },
  }
}

function lerNfseDiagnostico(xml: string): LeituraXmlResultado {
  const infNfse =
    blocoPrimeiro(xml, ['infNFSe', 'InfNFSe', 'infNfse', 'InfNfse', 'infDPS', 'InfDPS', 'InfDeclaracaoPrestacaoServico']) ||
    (existeTag(xml, 'Nfse') || existeTag(xml, 'NFSe') ? xml : '')

  if (!infNfse) {
    return { ok: false, motivo: 'documento_nao_suportado' }
  }

  const declaracao = blocoPrimeiro(infNfse, ['infDPS', 'InfDPS', 'InfDeclaracaoPrestacaoServico']) || infNfse
  const servico = blocoPrimeiro(declaracao, ['serv', 'Servico', 'DadosServico', 'cServ']) || blocoPrimeiro(infNfse, ['serv', 'Servico', 'DadosServico', 'cServ']) || infNfse
  const valoresServico =
    blocoPrimeiro(servico, ['Valores', 'valores', 'vServPrest']) ||
    blocoPrimeiro(infNfse, ['ValoresNfse', 'valores', 'Valores']) ||
    servico
  const prestadorDados =
    blocoPrimeiro(infNfse, ['PrestadorServico', 'DadosPrestador', 'IdentificacaoPrestador', 'emit', 'prest']) ||
    blocoPrimeiro(declaracao, ['Prestador', 'PrestadorServico', 'DadosPrestador', 'IdentificacaoPrestador']) ||
    infNfse
  const prestadorIdentificacao =
    blocoPrimeiro(declaracao, ['Prestador', 'PrestadorServico', 'DadosPrestador', 'IdentificacaoPrestador']) ||
    prestadorDados

  const numeroDocumento = textoPrimeiro(infNfse, [
    'nNFSe',
    'nNFS-e',
    'NumeroNfse',
    'NumeroNFSe',
    'Numero',
    'NumeroNota',
    'NumeroNotaFiscal',
    'nDFSe',
    'nDPS',
  ])

  const emitenteCnpj = primeiroTexto(
    cnpjOuCpfPrimeiro(prestadorDados, [
      'CNPJPrestador',
      'CnpjPrestador',
      'CpfCnpjPrestador',
      'CPFCNPJPrestador',
      'CNPJ',
      'Cnpj',
      'CPF',
      'Cpf',
    ]),
    cnpjOuCpfPrimeiro(prestadorIdentificacao, [
    'CNPJPrestador',
    'CnpjPrestador',
    'CpfCnpjPrestador',
    'CPFCNPJPrestador',
    'CNPJ',
    'Cnpj',
    'CPF',
    'Cpf',
    ]),
  )

  if (!numeroDocumento && !emitenteCnpj) {
    return { ok: false, motivo: 'documento_nao_suportado' }
  }

  const ibscbsNota = blocoEntre(infNfse, 'IBSCBS')
  const ibscbsDeclaracao = blocoEntre(declaracao, 'IBSCBS')
  const ibscbs = ibscbsNota || ibscbsDeclaracao
  const valoresIbscbs = blocoPrimeiro(ibscbsNota || ibscbsDeclaracao, ['valores', 'Valores']) || ibscbs
  const tribIbscbs = blocoEntre(valoresIbscbs, 'trib') || valoresIbscbs
  const gIbsCbsDeclaracao = blocoEntre(ibscbsDeclaracao, 'gIBSCBS')
  const gIbsCbsValores = blocoEntre(tribIbscbs, 'gIBSCBS') || blocoEntre(valoresIbscbs, 'gIBSCBS') || tribIbscbs
  const totCibs = blocoEntre(ibscbsNota, 'totCIBS')
  const gIbsTotal = blocoEntre(totCibs, 'gIBS')
  const gIbsUf = blocoEntre(gIbsCbsValores, 'gIBSUF') || blocoEntre(valoresIbscbs, 'uf') || blocoEntre(gIbsTotal, 'gIBSUFTot')
  const gIbsMun = blocoEntre(gIbsCbsValores, 'gIBSMun') || blocoEntre(valoresIbscbs, 'mun') || blocoEntre(gIbsTotal, 'gIBSMunTot')
  const gCbsAliquota = blocoEntre(valoresIbscbs, 'fed') || blocoEntre(gIbsCbsValores, 'gCBS') || blocoEntre(ibscbs, 'gCBS')
  const gCbsValor = blocoEntre(totCibs, 'gCBS') || blocoEntre(ibscbs, 'gCBS') || gCbsAliquota
  const valorIbsUf = primeiroNumero(numero(textoEntre(gIbsUf, 'vIBSUF')), numero(textoEntre(gIbsTotal, 'vIBSUF')))
  const valorIbsMun = primeiroNumero(numero(textoEntre(gIbsMun, 'vIBSMun')), numero(textoEntre(gIbsTotal, 'vIBSMun')))
  const valorIbsTotal = primeiroNumero(numero(textoEntre(gIbsTotal, 'vIBSTot')), valorIbsUf + valorIbsMun)
  const valorCbs = numero(textoEntre(gCbsValor, 'vCBS'))
  const valorServico = valorNumericoPrimeiro(valoresServico, [
    'ValorServicos',
    'ValorServico',
    'ValorTotalServicos',
    'ValorLiquidoNfse',
    'BaseCalculo',
    'vServ',
    'vBC',
    'vReceb',
    'vLiq',
  ])
  const base = primeiroNumero(numero(textoEntre(valoresIbscbs, 'vBC')), numero(textoEntre(gIbsCbsValores, 'vBC')), numero(textoEntre(gCbsValor, 'vBC')), valorServico)
  const cst = textoEntre(gIbsCbsDeclaracao, 'CST') || textoEntre(gIbsCbsValores, 'CST') || textoEntre(ibscbs, 'CST')
  const cclass = textoEntre(gIbsCbsDeclaracao, 'cClassTrib') || textoEntre(gIbsCbsValores, 'cClassTrib') || textoEntre(ibscbs, 'cClassTrib')
  const descricao =
    textoPrimeiro(servico, ['Discriminacao', 'DescricaoServico', 'Descricao', 'xDescServ', 'xTribMun', 'xTribNac']) ||
    'Prestacao de servico'
  const chaveAcesso =
    textoPrimeiro(infNfse, ['chNFSe', 'ChaveNFe', 'ChaveAcesso', 'CodigoVerificacao', 'CodVerificacao']) ||
    atributoDaTagAbertura(xml, 'infNFSe', 'Id') ||
    atributoDaTagAbertura(xml, 'InfNFSe', 'Id') ||
    atributoDaTagAbertura(xml, 'InfNfse', 'Id') ||
    null

  return {
    ok: true,
    documento: {
      tipoDocumento: 'NFS-e',
      numero: numeroDocumento || '-',
      serie: textoPrimeiro(infNfse, ['serie', 'Serie', 'serieDPS', 'SerieDPS']) || '-',
      dataEmissao: dataPrimeira(infNfse, [
        'DataEmissao',
        'DataEmissaoNfse',
        'DataEmissaoNFSe',
        'dhEmi',
        'dEmi',
        'dhProc',
        'dCompet',
      ]),
      emitenteCnpj,
      emitenteNome: textoPrimeiro(prestadorDados, ['RazaoSocial', 'NomeFantasia', 'xNome', 'Nome']) || '-',
      chaveAcesso,
      totalizadorIbs: existeTag(gIbsTotal, 'vIBSTot') ? numero(textoEntre(gIbsTotal, 'vIBSTot')) : null,
      totalizadorCbs: existeTag(gCbsValor, 'vCBS') ? valorCbs : null,
      itens: [
        {
          itemNumero: '1',
          descricao,
          ncm: '',
          cfop: '',
          valorItem: valorServico,
          cst,
          cclass,
          base,
          aliquotaIbsUf: numero(textoEntre(gIbsUf, 'pIBSUF')),
          valorIbsUf,
          aliquotaIbsMun: numero(textoEntre(gIbsMun, 'pIBSMun')),
          valorIbsMun,
          valorIbs: valorIbsTotal,
          aliquotaCbs: numero(textoEntre(gCbsAliquota, 'pCBS')),
          valorCbs,
        },
      ],
    },
  }
}

export function lerXmlDiagnostico(conteudo: string): LeituraXmlResultado {
  if (!conteudo.trim()) {
    return { ok: false, motivo: 'arquivo_vazio' }
  }

  if (new Blob([conteudo]).size > TAMANHO_MAXIMO_XML) {
    return { ok: false, motivo: 'arquivo_grande' }
  }

  const xml = conteudo.replace(/^\uFEFF/, '').trim()

  if (!xml.startsWith('<')) {
    return { ok: false, motivo: 'xml_invalido' }
  }

  if (contemDeclaracaoPerigosa(xml)) {
    return { ok: false, motivo: 'xml_perigoso' }
  }

  const nfe = lerNfeDiagnostico(xml)
  if (nfe.ok) {
    return nfe
  }

  if (leituraFalhou(nfe) && nfe.motivo !== 'documento_nao_suportado') {
    return nfe
  }

  return lerNfseDiagnostico(xml)
}
