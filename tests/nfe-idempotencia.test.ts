/**
 * Testes automatizados — confiabilidade da importação de NF-e
 * (normalização de competência, classificação entrada/saída, CFOP como
 * faturamento com override por empresa, e soma de itens sem multiplicação
 * pelo total do documento).
 *
 * EXECUÇÃO: npm run test  (ou npx vitest run)
 */

import { normalizarCompetencia, competenciaKey } from '../lib/fiscal/competencia'
import { classificarCfop, cfopEhFaturamento } from '../lib/simples/cfopReceita'
import { resolverFaturamentoCfop } from '../lib/simples/cfopFaturamentoConfig'
import { apurarSimples } from '../lib/simples/calcularSimples'
import type { DocumentoFiscal, DocumentoFiscalItem } from '../lib/types'

describe('normalizarCompetencia', () => {
  test('mantém formato MM/YYYY inalterado', () => {
    expect(normalizarCompetencia('01/2026')).toBe('01/2026')
  })

  test('converte YYYY-MM para MM/YYYY', () => {
    expect(normalizarCompetencia('2026-01')).toBe('01/2026')
  })

  test('retorna null para valor nulo ou vazio', () => {
    expect(normalizarCompetencia(null)).toBeNull()
    expect(normalizarCompetencia('')).toBeNull()
  })

  test('competenciaKey ordena competências de formatos diferentes de forma equivalente', () => {
    expect(competenciaKey('01/2026')).toBe(competenciaKey('2026-01'))
    expect(competenciaKey('12/2025')).toBeLessThan(competenciaKey('01/2026'))
  })
})

describe('classificarCfop — entrada/saída via tpNF (não pelo emitente)', () => {
  const CNPJ_EMPRESA = '12345678000190'

  test('tpNF=1 (saída) com CFOP de venda gera soma_receita', () => {
    const r = classificarCfop('5102', '1', CNPJ_EMPRESA, CNPJ_EMPRESA)
    expect(r.tipo_movimento).toBe('saida')
    expect(r.impacto_receita).toBe('soma_receita')
  })

  test('CFOP 6102 permanece Anexo I mesmo quando a empresa possui CNAE industrial', () => {
    const r = classificarCfop('6102', '1', CNPJ_EMPRESA, CNPJ_EMPRESA, true)
    expect(r.anexo_sugerido).toBe('I')
    expect(r.regra_aplicada).toContain('mercadoria adquirida de terceiros')
  })

  test('CFOP 6101 permanece Anexo II mesmo sem CNAE industrial cadastrado', () => {
    const r = classificarCfop('6101', '1', CNPJ_EMPRESA, CNPJ_EMPRESA, false)
    expect(r.anexo_sugerido).toBe('II')
    expect(r.regra_aplicada).toContain('produção do estabelecimento')
  })

  test('tpNF=0 (entrada) emitida pela PRÓPRIA empresa não vira saída automaticamente', () => {
    // Nota de emissão própria com finalidade de entrada (ex: complementar, ajuste) —
    // não pode ser escriturada como saída só porque o emitente é a empresa analisada.
    const r = classificarCfop('5949', '0', CNPJ_EMPRESA, CNPJ_EMPRESA)
    expect(r.tipo_movimento).toBe('entrada')
    expect(r.impacto_receita).toBe('sem_impacto')
  })

  test('devolução de venda recebida de terceiro reduz receita', () => {
    const r = classificarCfop('1202', '0', '99999999000199', CNPJ_EMPRESA)
    expect(r.tipo_movimento).toBe('devolucao_venda')
    expect(r.impacto_receita).toBe('reduz_receita')
    expect(r.origem_devolucao).toBe('emitida_terceiro')
  })

  test('devolução de venda emitida pela própria empresa também reduz receita', () => {
    const r = classificarCfop('1202', '0', CNPJ_EMPRESA, CNPJ_EMPRESA)
    expect(r.tipo_movimento).toBe('devolucao_venda')
    expect(r.impacto_receita).toBe('reduz_receita')
    expect(r.origem_devolucao).toBe('emitida_propria')
  })
})

describe('resolverFaturamentoCfop — override por empresa', () => {
  test('sem override, usa a lista padrão do sistema', () => {
    expect(cfopEhFaturamento('5102')).toBe(true)
    expect(resolverFaturamentoCfop('5102', new Map())).toBe(true)
  })

  test('override da empresa desmarcando um CFOP padrão prevalece sobre o padrão', () => {
    const overrides = new Map([['5102', false]])
    expect(resolverFaturamentoCfop('5102', overrides)).toBe(false)
  })

  test('override da empresa incluindo um CFOP fora da lista padrão prevalece', () => {
    const overrides = new Map([['9999', true]])
    expect(resolverFaturamentoCfop('9999', overrides)).toBe(true)
  })
})

describe('apurarSimples — soma por item, não multiplica pelo total do documento', () => {
  function doc(): DocumentoFiscal {
    return {
      id: 'doc-1', org_id: 'org', empresa_id: 'emp',
      tipo_documento: 'nfe', origem: 'xml_nfe',
      chave_acesso: '35260112345678000190550010000000011000000010',
      numero: '1', modelo: '55',
      data_emissao: '2026-01-10', data_competencia: '01/2026',
      emitente_cnpj: '12345678000190', emitente_nome: 'Empresa',
      destinatario_cnpj: '99887766000155', destinatario_nome: 'Cliente',
      valor_total: 300, valor_produtos: 300, valor_servicos: 0,
      valor_desconto: 0, valor_frete: 0, valor_icms: 0, valor_pis: 0,
      valor_cofins: 0, valor_st: 0, valor_ipi: 0,
      tipo_movimento: 'saida', impacto_receita: 'soma_receita',
      origem_devolucao: 'nao_aplicavel', status: 'ok',
      created_at: '', updated_at: '',
    }
  }

  function item(numero: number, valor: number): DocumentoFiscalItem {
    return {
      id: `item-${numero}`, org_id: 'org', empresa_id: 'emp', documento_id: 'doc-1',
      item_numero: numero, cfop: '5102',
      quantidade: 1, valor_unitario: valor, valor_total: valor, valor_desconto: 0, valor_frete: 0,
      valor_bc_icms: 0, aliquota_icms: 0, valor_icms: 0, valor_bc_st: 0, valor_st: 0,
      valor_bc_pis: 0, aliquota_pis: 0, valor_pis: 0, valor_bc_cofins: 0, aliquota_cofins: 0,
      valor_cofins: 0, valor_ipi: 0,
      classificacao: 'revenda', natureza_receita_simples: 'tributada',
      tipo_movimento: 'saida', impacto_receita: 'soma_receita', anexo_sugerido: 'I',
      classificacao_manual: false, created_at: '',
    }
  }

  test('nota com 3 itens de R$100 soma R$300 (não R$300 × 3 = R$900)', () => {
    const documento = doc() // valor_total do documento = 300
    const itens = [item(1, 100), item(2, 100), item(3, 100)]

    const resultado = apurarSimples({
      documentos: [documento],
      itens,
      rbt12: 100000,
      origem_rbt12: 'xml',
      cnpjEmpresa: '12345678000190',
      competencia: '01/2026',
    })

    expect(resultado.receita_vendas_bruta).toBe(300)
  })

  test('mesmo documento/item entregue duplicado na entrada não dobra nem quadruplica o total (defesa em profundidade)', () => {
    const documento = doc()
    const itens = [item(1, 100)]

    // Simula o que aconteceria SE a fonte de dados entregasse o mesmo documento e o
    // mesmo item duas vezes (bug de duplicação a montante, ex: reimportação sem
    // constraint de unicidade). apurarSimples deduplica por `id` como última barreira
    // — a deduplicação "de verdade" continua sendo a constraint de banco + upsert em
    // fa_documentos_fiscais/fa_documentos_itens.
    const resultadoUnico = apurarSimples({
      documentos: [documento], itens,
      rbt12: 100000, origem_rbt12: 'xml', cnpjEmpresa: '12345678000190', competencia: '01/2026',
    })
    const resultadoDuplicado = apurarSimples({
      documentos: [documento, documento], itens: [...itens, ...itens],
      rbt12: 100000, origem_rbt12: 'xml', cnpjEmpresa: '12345678000190', competencia: '01/2026',
    })

    expect(resultadoDuplicado.receita_vendas_bruta).toBe(resultadoUnico.receita_vendas_bruta)
    expect(resultadoDuplicado.receita_vendas_bruta).toBe(100)
  })

  test('apuração corrige sugestão antiga do Anexo II para CFOP 6102 e emite aviso de conferência', () => {
    const itemAntigo = { ...item(1, 300), cfop: '6102', anexo_sugerido: 'II' as const }
    const resultado = apurarSimples({
      documentos: [doc()],
      itens: [itemAntigo],
      rbt12: 100000,
      origem_rbt12: 'xml',
      cnpjEmpresa: '12345678000190',
      competencia: '01/2026',
      ehIndustrial: true,
    })

    expect(resultado.por_anexo.I.receita).toBe(300)
    expect(resultado.por_anexo.II).toBeUndefined()
    expect(resultado.alertas.some(alerta => alerta.includes('CFOP 6102') && alerta.includes('Anexo I'))).toBe(true)
  })

  test('produção própria indicada pelo CFOP 6101 usa Anexo II e alerta quando CNAE não é industrial', () => {
    const itemProducao = { ...item(1, 300), cfop: '6101', anexo_sugerido: 'I' as const }
    const resultado = apurarSimples({
      documentos: [doc()],
      itens: [itemProducao],
      rbt12: 100000,
      origem_rbt12: 'xml',
      cnpjEmpresa: '12345678000190',
      competencia: '01/2026',
      ehIndustrial: false,
    })

    expect(resultado.por_anexo.II.receita).toBe(300)
    expect(resultado.por_anexo.I).toBeUndefined()
    expect(resultado.alertas.some(alerta => alerta.includes('CFOP 6101') && alerta.includes('Anexo II'))).toBe(true)
  })
})
