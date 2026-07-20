/**
 * Testes automatizados — auditoria da importação de XML de NF-e
 * (Validador de Entradas / fa_documentos_itens / fa_importar_lote_nfe)
 *
 * Cobre a causa-raiz do erro:
 *   "new row for relation fa_documentos_itens violates check constraint
 *    fa_documentos_itens_classificacao_check"
 * — o seletor manual de classificação aceitava "combustivel", "desconhece"
 * e "nao_recebido", mas só "combustivel" é uma classificação fiscal real;
 * "desconhece"/"nao_recebido" são respostas operacionais do usuário e nunca
 * podem ir para a coluna `classificacao` (ver lib/types.ts e
 * supabase_migration_classificacao_itens_fix.sql).
 *
 * Também cobre o parser de NF-e usado pela persistência central
 * (lib/nfe/parseNfe.ts): cabeçalho, itens, grupos tributários opcionais,
 * arredondamento decimal, direção entrada/saída e reimportação idempotente.
 *
 * EXECUÇÃO: npx vitest run tests/nfe-classificacao-importacao.test.ts
 */

import {
  CLASSIFICACAO_ITEM_VALORES,
  SITUACAO_CLASSIFICACAO_VALORES,
  separarClassificacaoManual,
  combinarClassificacaoManual,
  normalizarClassificacaoPersistivel,
} from '../lib/types'
import { parseNfeParaDocumento, extrairMetadataNfe, extrairChaveNFe } from '../lib/nfe/parseNfe'

// ──────────────────────────────────────────────────────────────────────────
// Classificação fiscal vs. situação operacional
// ──────────────────────────────────────────────────────────────────────────

describe('CLASSIFICACAO_ITEM_VALORES / SITUACAO_CLASSIFICACAO_VALORES — fonte única de verdade', () => {
  test('combustível é uma classificação fiscal aceita (mesmo conceito do SPED)', () => {
    expect(CLASSIFICACAO_ITEM_VALORES).toContain('combustivel')
  })

  test('desconhece/nao_recebido NUNCA aparecem entre as classificações fiscais', () => {
    expect(CLASSIFICACAO_ITEM_VALORES).not.toContain('desconhece')
    expect(CLASSIFICACAO_ITEM_VALORES).not.toContain('nao_recebido')
  })

  test('situações operacionais são só desconhece e nao_recebido', () => {
    expect([...SITUACAO_CLASSIFICACAO_VALORES].sort()).toEqual(['desconhece', 'nao_recebido'])
  })
})

describe('separarClassificacaoManual — nunca grava estado operacional na coluna fiscal', () => {
  test('combustivel vai para a coluna classificacao', () => {
    expect(separarClassificacaoManual('combustivel')).toEqual({ classificacao: 'combustivel', situacao_classificacao: null })
  })

  test('desconhece vai para situacao_classificacao, classificacao fica null', () => {
    expect(separarClassificacaoManual('desconhece')).toEqual({ classificacao: null, situacao_classificacao: 'desconhece' })
  })

  test('nao_recebido vai para situacao_classificacao, classificacao fica null', () => {
    expect(separarClassificacaoManual('nao_recebido')).toEqual({ classificacao: null, situacao_classificacao: 'nao_recebido' })
  })

  test.each(['revenda', 'insumo', 'uso_consumo', 'imobilizado', 'servico'] as const)(
    '%s é uma classificação fiscal real e é preservada tal qual',
    (valor) => {
      expect(separarClassificacaoManual(valor)).toEqual({ classificacao: valor, situacao_classificacao: null })
    },
  )

  test('null (não classificado) permanece null nos dois campos', () => {
    expect(separarClassificacaoManual(null)).toEqual({ classificacao: null, situacao_classificacao: null })
  })
})

describe('combinarClassificacaoManual — reconstrói exatamente o que foi persistido (reload/restauração de sessão)', () => {
  test('situacao_classificacao tem prioridade e é restaurada corretamente', () => {
    expect(combinarClassificacaoManual(null, 'desconhece')).toBe('desconhece')
    expect(combinarClassificacaoManual(null, 'nao_recebido')).toBe('nao_recebido')
  })

  test('classificacao fiscal real é restaurada quando não há situação operacional', () => {
    expect(combinarClassificacaoManual('combustivel', null)).toBe('combustivel')
    expect(combinarClassificacaoManual('imobilizado', null)).toBe('imobilizado')
  })

  test('"outros" (default interno do banco) volta como null — não é opção selecionável', () => {
    expect(combinarClassificacaoManual('outros', null)).toBeNull()
  })

  test('ambos nulos → null', () => {
    expect(combinarClassificacaoManual(null, null)).toBeNull()
    expect(combinarClassificacaoManual(undefined, undefined)).toBeNull()
  })

  test('round-trip: separar → combinar reproduz o valor original para todas as opções do seletor', () => {
    const valores = ['revenda', 'insumo', 'uso_consumo', 'imobilizado', 'combustivel', 'servico', 'desconhece', 'nao_recebido', null] as const
    for (const original of valores) {
      const { classificacao, situacao_classificacao } = separarClassificacaoManual(original)
      expect(combinarClassificacaoManual(classificacao, situacao_classificacao)).toBe(original)
    }
  })
})

describe('normalizarClassificacaoPersistivel — última barreira no servidor antes da RPC', () => {
  test('valor fiscal válido passa direto, sem sinalizar invalidez', () => {
    expect(normalizarClassificacaoPersistivel('combustivel')).toEqual({ classificacao: 'combustivel', invalida: false })
    expect(normalizarClassificacaoPersistivel('revenda')).toEqual({ classificacao: 'revenda', invalida: false })
  })

  test('null/undefined não é invalidez — é "ainda não classificado"', () => {
    expect(normalizarClassificacaoPersistivel(null)).toEqual({ classificacao: 'outros', invalida: false })
    expect(normalizarClassificacaoPersistivel(undefined)).toEqual({ classificacao: 'outros', invalida: false })
  })

  test('"desconhece"/"nao_recebido" chegando na coluna fiscal são tratados como inválidos e viram "outros"', () => {
    expect(normalizarClassificacaoPersistivel('desconhece')).toEqual({ classificacao: 'outros', invalida: true })
    expect(normalizarClassificacaoPersistivel('nao_recebido')).toEqual({ classificacao: 'outros', invalida: true })
  })

  test('valor totalmente desconhecido vira "outros" e sinaliza invalidez (nunca derruba a importação)', () => {
    expect(normalizarClassificacaoPersistivel('lixo')).toEqual({ classificacao: 'outros', invalida: true })
  })
})

// ──────────────────────────────────────────────────────────────────────────
// Parser de NF-e (lib/nfe/parseNfe.ts) — usado por fa_documentos_fiscais/itens
// ──────────────────────────────────────────────────────────────────────────

const EMPRESA_CNPJ = '12345678000195'
const FORNECEDOR_CNPJ = '98765432000111'

function detItem(opts: {
  cProd?: string; xProd?: string; ncm?: string; cfop: string; vProd: string
  vDesc?: string; comIcmsSt?: boolean; comIpi?: boolean; comPisCofins?: boolean
}): string {
  const {
    cProd = '001', xProd = 'Produto Teste', ncm = '84714100', cfop, vProd,
    vDesc = '0.00', comIcmsSt = false, comIpi = false, comPisCofins = true,
  } = opts
  const icmsSt = comIcmsSt ? '<vBCST>50.00</vBCST><vICMSST>9.00</vICMSST>' : ''
  const ipiBlock = comIpi ? '<IPI><IPITrib><CST>50</CST><vBC>' + vProd + '</vBC><pIPI>5.00</pIPI><vIPI>' + (Number(vProd) * 0.05).toFixed(2) + '</vIPI></IPITrib></IPI>' : ''
  const pisCofins = comPisCofins
    ? `<PIS><PISAliq><CST>01</CST><vBC>${vProd}</vBC><pPIS>0.65</pPIS><vPIS>${(Number(vProd) * 0.0065).toFixed(2)}</vPIS></PISAliq></PIS>
       <COFINS><COFINSAliq><CST>01</CST><vBC>${vProd}</vBC><pCOFINS>3.00</pCOFINS><vCOFINS>${(Number(vProd) * 0.03).toFixed(2)}</vCOFINS></COFINSAliq></COFINS>`
    : ''
  return `<det>
    <prod><cProd>${cProd}</cProd><xProd>${xProd}</xProd><NCM>${ncm}</NCM><CFOP>${cfop}</CFOP>
      <uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>${vProd}</vUnCom><vProd>${vProd}</vProd><vDesc>${vDesc}</vDesc>
    </prod>
    <imposto>
      <ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>${vProd}</vBC><pICMS>18.00</pICMS><vICMS>${(Number(vProd) * 0.18).toFixed(2)}</vICMS>${icmsSt}</ICMS00></ICMS>
      ${ipiBlock}
      ${pisCofins}
    </imposto>
  </det>`
}

function buildNfe(opts: {
  chave?: string; tpNF?: string; emitCnpj?: string; destCnpj?: string
  numero?: string; dhEmi?: string; refNFe?: string; finNFe?: string; itensXml: string[]
  vNF?: string; modelo?: '55' | '65'
}): string {
  const {
    chave = '35260112345678000195550010000001231234567890',
    tpNF = '1', emitCnpj = EMPRESA_CNPJ, destCnpj = FORNECEDOR_CNPJ,
    numero = '123', dhEmi = '2026-06-10T10:00:00-03:00', refNFe, finNFe = '1', itensXml, vNF = '100.00', modelo = '55',
  } = opts
  const refBlock = refNFe ? `<NFref><refNFe>${refNFe}</refNFe></NFref>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
<NFe>
<infNFe Id="NFe${chave}" versao="4.00">
<ide>
  <mod>${modelo}</mod><tpNF>${tpNF}</tpNF><finNFe>${finNFe}</finNFe><nNF>${numero}</nNF><serie>1</serie><dhEmi>${dhEmi}</dhEmi>
  ${refBlock}
</ide>
<emit><CNPJ>${emitCnpj}</CNPJ><xNome>Emitente Teste</xNome></emit>
<dest><CNPJ>${destCnpj}</CNPJ><xNome>Destinatário Teste</xNome></dest>
${itensXml.join('\n')}
<total><ICMSTot><vBC>${vNF}</vBC><vICMS>0.00</vICMS><vNF>${vNF}</vNF><vProd>${vNF}</vProd><vDesc>0.00</vDesc><vFrete>0.00</vFrete><vOutro>0.00</vOutro><vIPI>0.00</vIPI><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vST>0.00</vST></ICMSTot></total>
</infNFe>
</NFe>
</nfeProc>`
}

describe('parseNfeParaDocumento — entrada e saída comuns', () => {
  test('modelo 65 é persistido como NFC-e, não como NF-e', () => {
    const xml = buildNfe({ modelo: '65', itensXml: [detItem({ cfop: '5102', vProd: '100.00' })] })
    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    expect(r!.documento.tipo_documento).toBe('nfce')
    expect(r!.documento.origem).toBe('xml_nfce')
  })

  test('nota de saída própria (tpNF=1, emitente=empresa) → tipo_movimento=saida, soma_receita', () => {
    const xml = buildNfe({ tpNF: '1', emitCnpj: EMPRESA_CNPJ, destCnpj: FORNECEDOR_CNPJ, itensXml: [detItem({ cfop: '5102', vProd: '100.00' })] })
    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    expect(r).not.toBeNull()
    expect(r!.documento.tipo_movimento).toBe('saida')
    expect(r!.documento.impacto_receita).toBe('soma_receita')
    expect(r!.itens).toHaveLength(1)
  })

  test('venda normal do fornecedor (tpNF=1 para o emitente) é entrada para a empresa destinatária', () => {
    const xml = buildNfe({ tpNF: '1', emitCnpj: FORNECEDOR_CNPJ, destCnpj: EMPRESA_CNPJ, vNF: '200.00', itensXml: [detItem({ cfop: '5102', vProd: '200.00' })] })
    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    expect(r!.documento.tipo_movimento).toBe('entrada')
    expect(r!.documento.impacto_receita).toBe('sem_impacto')
    expect(r!.documento.valor_produtos).toBe(200)
    expect(r!.itens[0]).toMatchObject({
      quantidade: 1,
      valor_unitario: 200,
      valor_total: 200,
      unidade: 'UN',
      cst_pis: '01',
      cst_cofins: '01',
    })
  })

  test('rateia somente o saldo dos totais não detalhados e preserva a soma exata por item', () => {
    const itemComDetalhe = detItem({ cfop: '5102', vProd: '40.00' })
      .replace('<vDesc>0.00</vDesc>', '<vDesc>1.00</vDesc><vFrete>3.00</vFrete>')
    const itemSemDetalhe = detItem({ cfop: '5102', vProd: '60.00' })
    const xml = buildNfe({
      emitCnpj: FORNECEDOR_CNPJ,
      destCnpj: EMPRESA_CNPJ,
      vNF: '100.00',
      itensXml: [itemComDetalhe, itemSemDetalhe],
    }).replace(
      '<vDesc>0.00</vDesc><vFrete>0.00</vFrete><vOutro>0.00</vOutro>',
      '<vDesc>4.00</vDesc><vFrete>10.00</vFrete><vSeg>2.00</vSeg><vOutro>1.00</vOutro>',
    )

    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)!
    expect(r.itens.map(item => item.valor_frete)).toEqual([3, 7])
    expect(r.itens.map(item => item.valor_desconto)).toEqual([1, 3])
    expect(r.itens.reduce((soma, item) => soma + (item.valor_seguro ?? 0), 0)).toBe(2)
    expect(r.itens.reduce((soma, item) => soma + (item.valor_outras_despesas ?? 0), 0)).toBe(1)
  })

  test('devolução recebida de terceiro exige finNFe=4 e reduz receita', () => {
    const xml = buildNfe({
      tpNF: '1', emitCnpj: FORNECEDOR_CNPJ, destCnpj: EMPRESA_CNPJ, finNFe: '4',
      refNFe: '3526011111111111115501000000010' .padEnd(44, '0'),
      itensXml: [detItem({ cfop: '5202', vProd: '50.00' })],
    })
    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    expect(r!.documento.impacto_receita).toBe('reduz_receita')
    expect(r!.documento.origem_devolucao).toBe('emitida_terceiro')
  })

  test('simples referência a outra NF sem finNFe=4 não é tratada como devolução', () => {
    const xml = buildNfe({
      tpNF: '1', emitCnpj: FORNECEDOR_CNPJ, destCnpj: EMPRESA_CNPJ,
      refNFe: '3526011111111111115501000000010'.padEnd(44, '0'),
      itensXml: [detItem({ cfop: '5102', vProd: '50.00' })],
    })
    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    expect(r!.documento.tipo_movimento).toBe('entrada')
    expect(r!.documento.impacto_receita).toBe('sem_impacto')
  })
})

describe('parseNfeParaDocumento — múltiplos itens e composição tributária', () => {
  test('múltiplos itens são todos extraídos com item_numero sequencial', () => {
    const xml = buildNfe({
      itensXml: [
        detItem({ cProd: '001', cfop: '5102', vProd: '100.00' }),
        detItem({ cProd: '002', cfop: '5102', vProd: '250.55' }),
        detItem({ cProd: '003', cfop: '5102', vProd: '10.00' }),
      ],
    })
    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    expect(r!.itens).toHaveLength(3)
    expect(r!.itens.map(i => i.item_numero)).toEqual([1, 2, 3])
    expect(r!.itens.map(i => i.codigo_produto)).toEqual(['001', '002', '003'])
  })

  test('ICMS-ST, PIS, COFINS e IPI são extraídos quando presentes no XML', () => {
    const xml = buildNfe({ itensXml: [detItem({ cfop: '5102', vProd: '100.00', comIcmsSt: true, comIpi: true, comPisCofins: true })] })
    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    const item = r!.itens[0]
    expect(item.valor_bc_st).toBeCloseTo(50.0, 2)
    expect(item.valor_st).toBeCloseTo(9.0, 2)
    expect(item.valor_ipi).toBeCloseTo(5.0, 2)
    expect(item.cst_ipi).toBe('50')
    expect(item.valor_bc_ipi).toBeCloseTo(100, 2)
    expect(item.aliquota_ipi).toBeCloseTo(5, 2)
    expect(item.cst_pis).toBe('01')
    expect(item.valor_pis).toBeCloseTo(0.65, 2)
    expect(item.cst_cofins).toBe('01')
    expect(item.valor_cofins).toBeCloseTo(3.0, 2)
  })

  test('grupos tributários opcionais ausentes (sem ICMS-ST, sem IPI, sem PIS/COFINS) não quebram o parser', () => {
    const xml = buildNfe({ itensXml: [detItem({ cfop: '5102', vProd: '100.00', comIcmsSt: false, comIpi: false, comPisCofins: false })] })
    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    expect(r).not.toBeNull()
    const item = r!.itens[0]
    expect(item.valor_st).toBe(0)
    expect(item.valor_ipi).toBe(0)
    expect(item.valor_pis).toBe(0)
    expect(item.valor_cofins).toBe(0)
  })

  test('valores decimais quebrados são preservados sem arredondamento indevido', () => {
    const xml = buildNfe({ itensXml: [detItem({ cfop: '5102', vProd: '250.55' })] })
    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    expect(r!.itens[0].valor_total).toBeCloseTo(250.55, 2)
  })

  test('item marcado como classificacao "outros" por padrão do parser (classificação manual acontece na UI, não no parser)', () => {
    const xml = buildNfe({ itensXml: [detItem({ cfop: '5102', vProd: '10.00' })] })
    const r = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    expect(r!.itens[0].classificacao).toBe('outros')
    expect(CLASSIFICACAO_ITEM_VALORES).toContain(r!.itens[0].classificacao)
  })
})

describe('parseNfeParaDocumento — reimportação idempotente e competências diferentes', () => {
  test('reimportar o mesmo XML produz exatamente o mesmo documento e itens (upsert por chave_acesso é seguro)', () => {
    const xml = buildNfe({ chave: '35260112345678000195550010000009991234567890', itensXml: [detItem({ cfop: '5102', vProd: '77.30' })] })
    const r1 = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    const r2 = parseNfeParaDocumento(xml, EMPRESA_CNPJ)
    expect(r2!.documento).toEqual(r1!.documento)
    expect(r2!.itens).toEqual(r1!.itens)
    expect(r1!.documento.chave_acesso).toBe(extrairChaveNFe(xml))
  })

  test('competências diferentes são extraídas corretamente a partir de dhEmi', () => {
    const xmlJan = buildNfe({ dhEmi: '2026-01-15T09:00:00-03:00', itensXml: [detItem({ cfop: '5102', vProd: '10.00' })] })
    const xmlJun = buildNfe({ dhEmi: '2026-06-20T09:00:00-03:00', itensXml: [detItem({ cfop: '5102', vProd: '10.00' })] })
    expect(extrairMetadataNfe(xmlJan)!.data_competencia).toBe('01/2026')
    expect(extrairMetadataNfe(xmlJun)!.data_competencia).toBe('06/2026')
  })
})
