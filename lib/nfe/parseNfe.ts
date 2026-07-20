// Parser NF-e para uso nos módulos que necessitam de persistência
// Extrai dados estruturados do XML para salvar em fa_documentos_fiscais + fa_documentos_itens
// Baseado nas funções do validador_entradas; mantidas independentes para não criar acoplamento.

import type { DocumentoFiscalInput, DocumentoFiscalItemInput } from '@/lib/types'
import { classificarCfop } from '@/lib/simples/cfopReceita'

// ──────────────────────────────────────────────────────────────────────────
// Helpers DOM
// ──────────────────────────────────────────────────────────────────────────

function gtxt(node: Element | null | undefined, tag: string): string {
  if (!node) return ''
  const els = node.getElementsByTagName(tag)
  if (els.length > 0) return els[0].textContent?.trim() || ''
  const all = Array.from(node.getElementsByTagName('*'))
  const found = all.find(el => el.localName === tag)
  return found?.textContent?.trim() || ''
}

function nnum(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim().replace(/R\$/gi, '').replace(/\s/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function getIcmsNode(imposto: Element | null): Element | null {
  if (!imposto) return null
  const grp = imposto.getElementsByTagName('ICMS')[0]
  if (!grp) return null
  return grp.firstElementChild as Element | null
}

function getPisCofinsNode(imposto: Element | null, grupo: 'PIS' | 'COFINS'): Element | null {
  if (!imposto) return null
  const grp = imposto.getElementsByTagName(grupo)[0]
  if (!grp) return null
  return grp.firstElementChild as Element | null
}

// ──────────────────────────────────────────────────────────────────────────
// Tipos internos
// ──────────────────────────────────────────────────────────────────────────

export interface XmlMetadataNfe {
  chave_acesso: string | null
  numero: string
  serie: string
  modelo: string
  data_emissao: string | null     // ISO date YYYY-MM-DD
  data_competencia: string        // "MM/YYYY"
  emitente_cnpj: string
  emitente_nome: string
  destinatario_cnpj: string
  destinatario_nome: string
  natureza_operacao: string
  /** tpNF: "0" = entrada, "1" = saída */
  tpNF: string
  /** finNFe: 1=normal, 2=complementar, 3=ajuste, 4=devolução */
  finalidade: string
  valor_total: number
  valor_produtos: number
  valor_desconto: number
  valor_frete: number
  valor_seguro: number
  valor_outras_despesas: number
  valor_icms: number
  valor_pis: number
  valor_cofins: number
  valor_st: number
  valor_ipi: number
  /** chave da NF-e referenciada (devoluções, complementares) */
  ref_chave_acesso?: string
}

// ──────────────────────────────────────────────────────────────────────────
// Detectar cancelamento
// ──────────────────────────────────────────────────────────────────────────

/** Retorna a chave da NF-e cancelada se o XML for um evento de cancelamento; null caso contrário. */
export function detectarCancelamento(txt: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(txt, 'text/xml')
    if (doc.querySelector('parsererror')) return null

    const tpEvento = doc.getElementsByTagName('tpEvento')[0]?.textContent?.trim()
    if (tpEvento === '110111') {
      const ch = doc.getElementsByTagName('chNFe')[0]?.textContent?.trim()
        || doc.getElementsByTagName('chave')[0]?.textContent?.trim()
      return ch || null
    }

    const cancNFe = doc.getElementsByTagName('cancNFe')[0]
    if (cancNFe) return gtxt(cancNFe, 'chNFe') || gtxt(cancNFe, 'chave') || null

    const retCanc = doc.getElementsByTagName('retCancNFe')[0]
    if (retCanc) return gtxt(retCanc, 'chNFe') || null

    return null
  } catch { return null }
}

// ──────────────────────────────────────────────────────────────────────────
// Extrair chave
// ──────────────────────────────────────────────────────────────────────────

export function extrairChaveNFe(txt: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(txt, 'text/xml')
    if (doc.querySelector('parsererror')) return null
    const infNFe = doc.getElementsByTagName('infNFe')[0]
    if (infNFe) {
      const id = infNFe.getAttribute('Id') || ''
      if (id.startsWith('NFe')) return id.slice(3)
      if (id.length === 44) return id
    }
    const chNFe = doc.getElementsByTagName('chNFe')[0]?.textContent?.trim()
    if (chNFe?.length === 44) return chNFe
    return null
  } catch { return null }
}

// ──────────────────────────────────────────────────────────────────────────
// Extrair metadados do cabeçalho
// ──────────────────────────────────────────────────────────────────────────

export function extrairMetadataNfe(txt: string): XmlMetadataNfe | null {
  try {
    const doc = new DOMParser().parseFromString(txt, 'text/xml')
    if (doc.querySelector('parsererror')) return null

    const ide = doc.getElementsByTagName('ide')[0]
    const emit = doc.getElementsByTagName('emit')[0]
    const dest = doc.getElementsByTagName('dest')[0]
    if (!ide) return null

    const nNF = gtxt(ide, 'nNF') || ''
    const serie = gtxt(ide, 'serie') || ''
    const mod = gtxt(ide, 'mod') || '55'
    const dhEmi = gtxt(ide, 'dhEmi') || gtxt(ide, 'dEmi') || ''
    const tpNF = gtxt(ide, 'tpNF')
    const finalidade = gtxt(ide, 'finNFe') || '1'
    const natureza_operacao = gtxt(ide, 'natOp')

    let data_emissao: string | null = null
    let data_competencia = ''
    if (dhEmi.length >= 10) {
      const d = dhEmi.slice(0, 10).replace(/\//g, '-')
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        data_emissao = d
        const parts = d.split('-')
        data_competencia = `${parts[1]}/${parts[0]}`
      }
    }

    const tot = doc.getElementsByTagName('ICMSTot')[0] || null
    const valor_total = nnum(gtxt(tot, 'vNF'))
    const valor_produtos = nnum(gtxt(tot, 'vProd'))
    const valor_desconto = nnum(gtxt(tot, 'vDesc'))
    const valor_frete = nnum(gtxt(tot, 'vFrete'))
    const valor_seguro = nnum(gtxt(tot, 'vSeg'))
    const valor_outras_despesas = nnum(gtxt(tot, 'vOutro'))
    const valor_icms = nnum(gtxt(tot, 'vICMS'))
    const valor_pis = nnum(gtxt(tot, 'vPIS'))
    const valor_cofins = nnum(gtxt(tot, 'vCOFINS'))
    const valor_st = nnum(gtxt(tot, 'vST'))
    const valor_ipi = nnum(gtxt(tot, 'vIPI'))

    const emitenteCnpj = (gtxt(emit, 'CNPJ') || gtxt(emit, 'CPF') || '').replace(/\D/g, '')
    const emitNome = gtxt(emit, 'xNome') || ''
    const destCnpj = (gtxt(dest, 'CNPJ') || gtxt(dest, 'CPF') || '').replace(/\D/g, '')
    const destNome = gtxt(dest, 'xNome') || ''

    const chave = extrairChaveNFe(txt)

    const nfRefEl = ide.getElementsByTagName('NFref')[0] ?? null
    const ref_chave_acesso = nfRefEl ? (gtxt(nfRefEl as Element, 'refNFe') || undefined) : undefined

    return {
      chave_acesso: chave,
      numero: nNF,
      serie,
      modelo: mod,
      data_emissao,
      data_competencia,
      emitente_cnpj: emitenteCnpj,
      emitente_nome: emitNome,
      destinatario_cnpj: destCnpj,
      destinatario_nome: destNome,
      natureza_operacao,
      tpNF,
      finalidade,
      valor_total,
      valor_produtos,
      valor_desconto,
      valor_frete,
      valor_seguro,
      valor_outras_despesas,
      valor_icms,
      valor_pis,
      valor_cofins,
      valor_st,
      valor_ipi,
      ref_chave_acesso,
    }
  } catch { return null }
}

// ──────────────────────────────────────────────────────────────────────────
// Função principal: parsear NF-e para persistência
// ──────────────────────────────────────────────────────────────────────────

export interface NfeParseResult {
  documento: Omit<DocumentoFiscalInput, 'empresa_id'>  // empresa_id adicionado pelo chamador
  itens: Omit<DocumentoFiscalItemInput, 'empresa_id' | 'documento_id'>[]
  metadados: XmlMetadataNfe
}

/**
 * Extrai dados estruturados de um XML de NF-e e classifica o impacto na receita.
 *
 * @param xmlTxt       Conteúdo do arquivo XML (string)
 * @param cnpjEmpresa  CNPJ da empresa analisada (apenas dígitos)
 * @param ehIndustrial true se a empresa é industrial (CNAE 10-33)
 * @param nomeArquivo  Nome do arquivo original (para rastreabilidade)
 */
export function parseNfeParaDocumento(
  xmlTxt: string,
  cnpjEmpresa: string,
  ehIndustrial = false,
  nomeArquivo?: string,
): NfeParseResult | null {
  const meta = extrairMetadataNfe(xmlTxt)
  if (!meta) return null

  // Classificação do documento como um todo (baseada no primeiro CFOP dos itens ou na direção da nota)
  // Será refinada item a item abaixo
  const direcao = resolverDirecaoNfe(meta, cnpjEmpresa)
  const docClass = classificarCfopDoDocumento(meta, cnpjEmpresa, ehIndustrial)
  const ehNfce = meta.modelo === '65'

  const doc: Omit<DocumentoFiscalInput, 'empresa_id'> = {
    sessao_id: undefined,
    tipo_documento: ehNfce ? 'nfce' : 'nfe',
    origem: ehNfce ? 'xml_nfce' : 'xml_nfe',
    chave_acesso: meta.chave_acesso ?? undefined,
    numero: meta.numero || undefined,
    serie: meta.serie || undefined,
    modelo: meta.modelo || undefined,
    data_emissao: meta.data_emissao ?? undefined,
    data_competencia: meta.data_competencia || undefined,
    emitente_cnpj: meta.emitente_cnpj || undefined,
    emitente_nome: meta.emitente_nome || undefined,
    destinatario_cnpj: meta.destinatario_cnpj || undefined,
    destinatario_nome: meta.destinatario_nome || undefined,
    natureza_operacao: meta.natureza_operacao || undefined,
    finalidade_nfe: meta.finalidade,
    valor_total: meta.valor_total,
    valor_produtos: meta.valor_produtos,
    valor_servicos: 0,
    valor_desconto: meta.valor_desconto,
    valor_frete: meta.valor_frete,
    valor_seguro: meta.valor_seguro,
    valor_outras_despesas: meta.valor_outras_despesas,
    valor_icms: meta.valor_icms,
    valor_pis: meta.valor_pis,
    valor_cofins: meta.valor_cofins,
    valor_st: meta.valor_st,
    valor_ipi: meta.valor_ipi,
    tipo_movimento: docClass.tipo_movimento,
    impacto_receita: docClass.impacto_receita,
    origem_devolucao: docClass.origem_devolucao,
    ref_chave_acesso: meta.ref_chave_acesso,
    status: 'ok',
    nome_arquivo: nomeArquivo,
  }

  // ── Itens ──────────────────────────────────────────────────────────────
  const itens: Omit<DocumentoFiscalItemInput, 'empresa_id' | 'documento_id'>[] = []

  try {
    const xmlDoc = new DOMParser().parseFromString(xmlTxt, 'text/xml')
    if (!xmlDoc.querySelector('parsererror')) {
      const detList = xmlDoc.getElementsByTagName('det')
      const valoresProdutos: number[] = []
      for (let i = 0; i < detList.length; i++) {
        const p = detList[i].getElementsByTagName('prod')[0]
        valoresProdutos.push(p ? nnum(gtxt(p, 'vProd')) : 0)
      }

      const totNode = xmlDoc.getElementsByTagName('ICMSTot')[0] || null
      const vFreteNota = nnum(gtxt(totNode, 'vFrete'))
      const vSeguroNota = nnum(gtxt(totNode, 'vSeg'))
      const vOutroNota = nnum(gtxt(totNode, 'vOutro'))
      const vDescNota = nnum(gtxt(totNode, 'vDesc'))

      // Alguns emissores informam frete/desconto/seguro/outras despesas apenas
      // no total da nota. Distribui somente o saldo que não veio detalhado e
      // joga eventual resíduo de centavos no último item, mantendo a soma exata.
      const distribuirTotal = (tag: 'vFrete' | 'vSeg' | 'vOutro' | 'vDesc', totalNota: number): number[] => {
        const valores = Array.from(detList, det => {
          const prod = det.getElementsByTagName('prod')[0]
          return prod ? nnum(gtxt(prod, tag)) : 0
        })
        const somaDetalhada = valores.reduce((soma, valor) => soma + valor, 0)
        const indicesSemValor = valores
          .map((valor, indice) => valor > 0 ? -1 : indice)
          .filter(indice => indice >= 0)
        const saldo = Math.max(0, Math.round((totalNota - somaDetalhada) * 100) / 100)
        const somaPesos = indicesSemValor.reduce((soma, indice) => soma + valoresProdutos[indice], 0)
        let distribuido = 0

        indicesSemValor.forEach((indice, posicao) => {
          if (saldo === 0 || somaPesos === 0) return
          const ehUltimo = posicao === indicesSemValor.length - 1
          const parcela = ehUltimo
            ? Math.round((saldo - distribuido) * 100) / 100
            : Math.round((saldo * valoresProdutos[indice] / somaPesos) * 100) / 100
          valores[indice] = parcela
          distribuido += parcela
        })
        return valores
      }

      const fretes = distribuirTotal('vFrete', vFreteNota)
      const seguros = distribuirTotal('vSeg', vSeguroNota)
      const outrasDespesasPorItem = distribuirTotal('vOutro', vOutroNota)
      const descontos = distribuirTotal('vDesc', vDescNota)

      for (let di = 0; di < detList.length; di++) {
        const det = detList[di]
        const numeroItemXml = Number(det.getAttribute('nItem'))
        const prod = det.getElementsByTagName('prod')[0]
        const imp = det.getElementsByTagName('imposto')[0]
        if (!prod) continue

        const cfop = gtxt(prod, 'CFOP').replace(/\D/g, '').slice(0, 4)
        const vProd = nnum(gtxt(prod, 'vProd'))
        const frete = fretes[di] ?? 0
        const seguro = seguros[di] ?? 0
        const outrasDespesas = outrasDespesasPorItem[di] ?? 0
        const desc = descontos[di] ?? 0

        const icmsNode = getIcmsNode(imp || null)
        const cst = gtxt(icmsNode, 'CST') || gtxt(icmsNode, 'CSOSN') || ''
        const csosn = gtxt(icmsNode, 'CSOSN') || ''

        const pisNode = getPisCofinsNode(imp || null, 'PIS')
        const cofNode = getPisCofinsNode(imp || null, 'COFINS')
        const ipiNode = det.getElementsByTagName('IPI')[0]?.firstElementChild as Element | null
        const ibsCbsGrp = imp?.getElementsByTagName('IBSCBS')[0] || null
        const gIbsCbs = ibsCbsGrp?.getElementsByTagName('gIBSCBS')[0] || null
        const gIbsUf = gIbsCbs?.getElementsByTagName('gIBSUF')[0] || null
        const gIbsMun = gIbsCbs?.getElementsByTagName('gIBSMun')[0] || null
        const gCbs = gIbsCbs?.getElementsByTagName('gCBS')[0] || null
        const valorIbsUf = nnum(gtxt(gIbsUf, 'vIBSUF'))
        const valorIbsMun = nnum(gtxt(gIbsMun, 'vIBSMun'))
        const valorIbs = nnum(gtxt(gIbsCbs, 'vIBS')) || valorIbsUf + valorIbsMun

        const itemClassBase = classificarCfop(
          cfop,
          direcao === 'entrada' ? '0' : direcao === 'saida' ? '1' : meta.tpNF,
          meta.emitente_cnpj,
          cnpjEmpresa,
          ehIndustrial,
        )
        const itemClass = docClass.tipo_movimento === 'devolucao_venda'
          ? {
              ...itemClassBase,
              tipo_movimento: 'devolucao_venda' as const,
              impacto_receita: 'reduz_receita' as const,
              natureza_receita_simples: 'devolucao' as const,
              origem_devolucao: docClass.origem_devolucao,
              anexo_sugerido: null,
              regra_aplicada: `Devolução de venda recebida pela empresa (CFOP ${cfop})`,
            }
          : docClass.tipo_movimento === 'devolucao_compra'
            ? {
                ...itemClassBase,
                tipo_movimento: 'devolucao_compra' as const,
                impacto_receita: 'sem_impacto' as const,
                natureza_receita_simples: 'nao_receita' as const,
                origem_devolucao: 'nao_aplicavel' as const,
                anexo_sugerido: null,
                regra_aplicada: `Devolução de compra emitida pela empresa (CFOP ${cfop})`,
              }
            : itemClassBase

        itens.push({
          item_numero: Number.isInteger(numeroItemXml) && numeroItemXml > 0 ? numeroItemXml : di + 1,
          codigo_produto: gtxt(prod, 'cProd') || undefined,
          ean: gtxt(prod, 'cEANTrib') || gtxt(prod, 'cEAN') || undefined,
          descricao: gtxt(prod, 'xProd') || undefined,
          ncm: gtxt(prod, 'NCM') || undefined,
          cest: gtxt(prod, 'CEST') || undefined,
          cfop,
          unidade: gtxt(prod, 'uCom') || undefined,
          quantidade: nnum(gtxt(prod, 'qCom')),
          valor_unitario: nnum(gtxt(prod, 'vUnCom')),
          valor_total: vProd,
          valor_desconto: desc,
          valor_frete: frete,
          valor_seguro: seguro,
          valor_outras_despesas: outrasDespesas,
          cst_icms: cst || undefined,
          csosn: csosn || undefined,
          origem_mercadoria: gtxt(icmsNode, 'orig') || undefined,
          cbenef: gtxt(icmsNode, 'cBenef') || gtxt(prod, 'cBenef') || undefined,
          valor_bc_icms: nnum(gtxt(icmsNode, 'vBC')),
          aliquota_icms: nnum(gtxt(icmsNode, 'pICMS')),
          valor_icms: nnum(gtxt(icmsNode, 'vICMS')),
          valor_bc_st: nnum(gtxt(icmsNode, 'vBCST')),
          valor_st: nnum(gtxt(icmsNode, 'vICMSST')),
          cst_pis: gtxt(pisNode, 'CST') || undefined,
          valor_bc_pis: nnum(gtxt(pisNode, 'vBC')),
          aliquota_pis: nnum(gtxt(pisNode, 'pPIS')),
          valor_pis: nnum(gtxt(pisNode, 'vPIS') || gtxt(pisNode, 'vPISAliq') || gtxt(pisNode, 'vPISQtde')),
          cst_cofins: gtxt(cofNode, 'CST') || undefined,
          valor_bc_cofins: nnum(gtxt(cofNode, 'vBC')),
          aliquota_cofins: nnum(gtxt(cofNode, 'pCOFINS')),
          valor_cofins: nnum(gtxt(cofNode, 'vCOFINS') || gtxt(cofNode, 'vCOFINSAliq') || gtxt(cofNode, 'vCOFINSQtde')),
          cst_ipi: gtxt(ipiNode, 'CST') || undefined,
          valor_bc_ipi: nnum(gtxt(ipiNode, 'vBC')),
          aliquota_ipi: nnum(gtxt(ipiNode, 'pIPI')),
          cst_ibs_cbs: gtxt(ibsCbsGrp, 'CST') || undefined,
          cclass_trib: gtxt(ibsCbsGrp, 'cClassTrib') || undefined,
          valor_bc_ibs_cbs: nnum(gtxt(gIbsCbs, 'vBC')),
          aliquota_ibs_uf: nnum(gtxt(gIbsUf, 'pIBSUF')),
          valor_ibs_uf: valorIbsUf,
          aliquota_ibs_mun: nnum(gtxt(gIbsMun, 'pIBSMun')),
          valor_ibs_mun: valorIbsMun,
          valor_ibs: valorIbs,
          aliquota_cbs: nnum(gtxt(gCbs, 'pCBS')),
          valor_cbs: nnum(gtxt(gCbs, 'vCBS')),
          valor_ipi: nnum(gtxt(ipiNode, 'vIPI')),
          classificacao: 'outros',
          natureza_receita_simples: itemClass.natureza_receita_simples,
          tipo_movimento: itemClass.tipo_movimento,
          impacto_receita: itemClass.impacto_receita,
          anexo_sugerido: itemClass.anexo_sugerido ?? undefined,
          regra_aplicada: itemClass.regra_aplicada,
          classificacao_manual: false,
        })
      }
    }
  } catch { /* itens ficam vazios, documento ainda é salvo */ }

  // Refinar classificação do documento baseando-se nos itens (se existirem)
  if (itens.length > 0) {
    const impactos = itens.map(i => i.impacto_receita)
    if (impactos.every(i => i === 'soma_receita')) {
      doc.impacto_receita = 'soma_receita'
    } else if (impactos.every(i => i === 'reduz_receita')) {
      doc.impacto_receita = 'reduz_receita'
      doc.tipo_movimento = 'devolucao_venda'
    } else if (impactos.every(i => i === 'sem_impacto')) {
      doc.impacto_receita = 'sem_impacto'
    } else {
      doc.impacto_receita = 'pendente_revisao'
    }
  }

  return { documento: doc, itens, metadados: meta }
}

// Classificação de alto nível baseada nos metadados do documento
export function resolverDirecaoNfe(
  meta: Pick<XmlMetadataNfe, 'tpNF' | 'emitente_cnpj' | 'destinatario_cnpj'>,
  cnpjEmpresa: string,
): 'entrada' | 'saida' | 'outros' {
  const empresa = cnpjEmpresa.replace(/\D/g, '')
  const emitente = meta.emitente_cnpj.replace(/\D/g, '')
  const destinatario = meta.destinatario_cnpj.replace(/\D/g, '')

  if (empresa.length === 14) {
    const emitenteEhEmpresa = emitente === empresa
    const destinatarioEhEmpresa = destinatario === empresa

    // tpNF descreve a operação do ponto de vista do emitente. Quando a empresa
    // analisada é destinatária de um documento emitido por terceiro, a operação
    // é sempre uma entrada para ela, mesmo que o XML tenha tpNF=1.
    if (destinatarioEhEmpresa && !emitenteEhEmpresa) return 'entrada'
    if (emitenteEhEmpresa) return meta.tpNF === '0' ? 'entrada' : meta.tpNF === '1' ? 'saida' : 'outros'
  }

  return meta.tpNF === '0' ? 'entrada' : meta.tpNF === '1' ? 'saida' : 'outros'
}

function classificarCfopDoDocumento(
  meta: XmlMetadataNfe,
  cnpjEmpresa: string,
  _ehIndustrial: boolean,
) {
  const cnpjEmpresaNorm = cnpjEmpresa.replace(/\D/g, '')
  const emitenteCnpjNorm = meta.emitente_cnpj.replace(/\D/g, '')
  const direcao = resolverDirecaoNfe(meta, cnpjEmpresa)
  const ehDevolucao = meta.finalidade === '4'

  if (ehDevolucao && direcao === 'entrada') {
    return {
      tipo_movimento: 'devolucao_venda' as const,
      impacto_receita: 'reduz_receita' as const,
      origem_devolucao: emitenteCnpjNorm === cnpjEmpresaNorm ? 'emitida_propria' as const : 'emitida_terceiro' as const,
    }
  }

  if (ehDevolucao && direcao === 'saida') {
    return {
      tipo_movimento: 'devolucao_compra' as const,
      impacto_receita: 'sem_impacto' as const,
      origem_devolucao: 'nao_aplicavel' as const,
    }
  }

  if (direcao === 'saida') {
    // Nota de saída (emitida pelo emitente) — provavelmente venda
    // Classificamos como soma_receita mesmo quando o CNPJ da empresa não está cadastrado
    // ou não coincide, pois o usuário do Simples Nacional importa as próprias NF-e de saída.
    const emitenteEhEmpresa = cnpjEmpresaNorm === '' || emitenteCnpjNorm === cnpjEmpresaNorm
    if (emitenteEhEmpresa) {
      return {
        tipo_movimento: 'saida' as const,
        impacto_receita: 'soma_receita' as const,
        origem_devolucao: 'nao_aplicavel' as const,
      }
    }
    // tpNF='1' mas emitente ≠ empresa e CNPJ está preenchido → nota de terceiro
    return {
      tipo_movimento: 'saida' as const,
      impacto_receita: 'pendente_revisao' as const,
      origem_devolucao: 'nao_aplicavel' as const,
    }
  }

  if (direcao === 'entrada') {
    // Entrada normal. Referência por si só não prova devolução: notas
    // complementares e de ajuste também podem referenciar outro documento.
    return {
      tipo_movimento: 'entrada' as const,
      impacto_receita: 'sem_impacto' as const,
      origem_devolucao: 'nao_aplicavel' as const,
    }
  }

  return {
    tipo_movimento: 'outros' as const,
    impacto_receita: 'pendente_revisao' as const,
    origem_devolucao: 'nao_aplicavel' as const,
  }
}
