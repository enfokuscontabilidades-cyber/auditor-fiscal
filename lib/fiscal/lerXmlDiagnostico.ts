// Leitura server-side de XML de NF-e para o diagnóstico público de IBS/CBS.
// Extração por regex escopada em blocos (nunca por um parser XML genérico com
// suporte a DTD/entidades) — não existe, neste módulo, qualquer código capaz
// de interpretar <!DOCTYPE> ou <!ENTITY>, então XXE é estruturalmente
// impossível aqui, não apenas mitigado. Documentos com essas declarações são
// rejeitados antes de qualquer extração, como camada extra de defesa.
//
// Este módulo é independente de lib/nfe/parseNfe.ts (que depende de
// DOMParser de browser e serve à persistência interna em fa_documentos_fiscais).

export interface ItemXmlDiagnostico {
  itemNumero: number
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
  dataEmissao: string | null
  emitenteCnpj: string
  emitenteNome: string
  chaveAcesso: string | null
  /**
   * Totalizador de IBS/CBS da nota (grupo IBSCBSTot, irmão de ICMSTot dentro
   * de <total>), usado apenas para conferir consistência com a soma dos
   * itens. `null` quando o grupo não foi encontrado no XML — nesse caso a
   * verificação de consistência deve ser marcada como "não validada", nunca
   * como divergência.
   */
  totalizadorIbs: number | null
  totalizadorCbs: number | null
  itens: ItemXmlDiagnostico[]
}

export type LeituraXmlResultado =
  | { ok: true; documento: DocumentoXmlDiagnostico }
  | { ok: false; motivo: 'vazio' | 'estrutura_suspeita' | 'nao_xml' | 'documento_nao_suportado' | 'malformado' }

const TAMANHO_MAX_BYTES = 5 * 1024 * 1024

function textoEntre(bloco: string, tag: string): string {
  const m = bloco.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)<\\/${tag}>`, 'i'))
  return m ? decodeEntidadesBasicas(m[1].trim()) : ''
}

/** Diferencia tag ausente de tag presente com valor vazio/zero. */
function existeTag(bloco: string, tag: string): boolean {
  return new RegExp(`<${tag}(?:\\s[^>]*)?>[^<]*<\\/${tag}>`, 'i').test(bloco)
}

function blocoEntre(bloco: string, tag: string): string | null {
  const m = bloco.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? m[1] : null
}

function todosBlocosEntre(bloco: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const resultado: string[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(bloco)) !== null) resultado.push(m[1])
  return resultado
}

/**
 * Lê um atributo da TAG DE ABERTURA de um elemento (ex.: Id="NFe...") — ao
 * contrário de `blocoEntre`, que descarta a tag de abertura e retorna só o
 * conteúdo interno. Tolerante a prefixo de namespace (ex.: <nfe:infNFe>).
 */
function atributoDaTagAbertura(xml: string, tag: string, atributo: string): string | null {
  const aberturaMatch = xml.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>`, 'i'))
  if (!aberturaMatch) return null
  const valorMatch = aberturaMatch[0].match(new RegExp(`\\b${atributo}\\s*=\\s*"([^"]*)"`, 'i'))
  return valorMatch ? valorMatch[1] : null
}

/** Remove somente o prefixo "NFe" (quando presente) e valida os 44 dígitos restantes. */
function extrairChaveDoAtributoId(idAttr: string | null): string | null {
  if (!idAttr) return null
  const semPrefixo = /^nfe/i.test(idAttr) ? idAttr.slice(3) : idAttr
  return /^\d{44}$/.test(semPrefixo) ? semPrefixo : null
}

// Apenas as 5 entidades XML predefinidas — nunca entidades customizadas/externas.
function decodeEntidadesBasicas(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
}

function numero(valor: string): number {
  const n = Number(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Verifica se o conteúdo declara DOCTYPE/ENTITY — se sim, o arquivo é rejeitado sem leitura adicional. */
function contemDeclaracaoPerigosa(texto: string): boolean {
  return /<!DOCTYPE/i.test(texto) || /<!ENTITY/i.test(texto)
}

export function lerXmlDiagnostico(conteudo: string): LeituraXmlResultado {
  if (!conteudo || !conteudo.trim()) return { ok: false, motivo: 'vazio' }
  if (Buffer.byteLength(conteudo, 'utf8') > TAMANHO_MAX_BYTES) return { ok: false, motivo: 'malformado' }

  const semBom = conteudo.replace(/^﻿/, '').trim()
  if (!semBom.startsWith('<')) return { ok: false, motivo: 'nao_xml' }
  if (contemDeclaracaoPerigosa(semBom)) return { ok: false, motivo: 'estrutura_suspeita' }

  const infNFe = blocoEntre(semBom, 'infNFe')
  if (!infNFe) return { ok: false, motivo: 'documento_nao_suportado' }

  const ide = blocoEntre(infNFe, 'ide')
  const emit = blocoEntre(infNFe, 'emit')
  if (!ide) return { ok: false, motivo: 'malformado' }

  // O atributo Id fica na TAG DE ABERTURA de infNFe (ex.: <infNFe Id="NFe5226...">),
  // não no conteúdo interno — por isso a leitura busca na tag de abertura do
  // XML completo, e não dentro da variável `infNFe` (que já é só o miolo).
  const idAttr = atributoDaTagAbertura(semBom, 'infNFe', 'Id')
  const chaveAcesso = extrairChaveDoAtributoId(idAttr)

  const numeroDoc = textoEntre(ide, 'nNF')
  const serie = textoEntre(ide, 'serie')
  const mod = textoEntre(ide, 'mod') || '55'
  const dhEmi = textoEntre(ide, 'dhEmi') || textoEntre(ide, 'dEmi')
  const dataEmissao = dhEmi.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(dhEmi) ? dhEmi.slice(0, 10) : null

  const emitenteCnpj = (textoEntre(emit || '', 'CNPJ') || textoEntre(emit || '', 'CPF')).replace(/\D/g, '')
  const emitenteNome = textoEntre(emit || '', 'xNome')

  const detBlocos = todosBlocosEntre(infNFe, 'det')
  const itens: ItemXmlDiagnostico[] = detBlocos.map((det, i) => {
    const prod = blocoEntre(det, 'prod') || ''
    const imposto = blocoEntre(det, 'imposto') || ''
    const ibscbsGrp = blocoEntre(imposto, 'IBSCBS')
    const gIbsCbs = ibscbsGrp ? blocoEntre(ibscbsGrp, 'gIBSCBS') : null
    const gIbsUf = gIbsCbs ? blocoEntre(gIbsCbs, 'gIBSUF') : null
    const gIbsMun = gIbsCbs ? blocoEntre(gIbsCbs, 'gIBSMun') : null
    const gCbs = gIbsCbs ? blocoEntre(gIbsCbs, 'gCBS') : null

    const valorIbsUf = numero(textoEntre(gIbsUf || '', 'vIBSUF'))
    const valorIbsMun = numero(textoEntre(gIbsMun || '', 'vIBSMun'))
    const valorIbsDireto = numero(textoEntre(gIbsCbs || '', 'vIBS'))

    return {
      itemNumero: i + 1,
      descricao: textoEntre(prod, 'xProd'),
      ncm: textoEntre(prod, 'NCM'),
      cfop: textoEntre(prod, 'CFOP'),
      valorItem: numero(textoEntre(prod, 'vProd')),
      cst: (ibscbsGrp ? textoEntre(ibscbsGrp, 'CST') : '') || '-',
      cclass: (ibscbsGrp ? textoEntre(ibscbsGrp, 'cClassTrib') : '') || '-',
      base: numero(textoEntre(gIbsCbs || '', 'vBC')),
      aliquotaIbsUf: numero(textoEntre(gIbsUf || '', 'pIBSUF')),
      valorIbsUf,
      aliquotaIbsMun: numero(textoEntre(gIbsMun || '', 'pIBSMun')),
      valorIbsMun,
      valorIbs: valorIbsDireto || valorIbsUf + valorIbsMun,
      aliquotaCbs: numero(textoEntre(gCbs || '', 'pCBS')),
      valorCbs: numero(textoEntre(gCbs || '', 'vCBS')),
    }
  })

  // Totalizador de IBS/CBS da nota (grupo IBSCBSTot, irmão de ICMSTot dentro
  // de <total>) — best effort: nem todo XML do período de transição traz
  // esse grupo. Ausência não é erro, apenas fica null (ver comentário no tipo).
  const totalBloco = blocoEntre(infNFe, 'total')
  const ibsCbsTot = totalBloco ? blocoEntre(totalBloco, 'IBSCBSTot') : null
  const totalizadorIbs = ibsCbsTot && existeTag(ibsCbsTot, 'vIBS') ? numero(textoEntre(ibsCbsTot, 'vIBS')) : null
  const totalizadorCbs = ibsCbsTot && existeTag(ibsCbsTot, 'vCBS') ? numero(textoEntre(ibsCbsTot, 'vCBS')) : null

  return {
    ok: true,
    documento: {
      tipoDocumento: mod === '65' ? 'NFC-e' : 'NF-e',
      numero: numeroDoc,
      serie,
      dataEmissao,
      emitenteCnpj,
      emitenteNome,
      chaveAcesso,
      totalizadorIbs,
      totalizadorCbs,
      itens,
    },
  }
}
