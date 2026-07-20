/**
 * Testes planejados para apuracao de servicos no Simples Nacional.
 */

import { apurarSimples, calcularDas } from '../lib/simples/calcularSimples'
import type { DocumentoFiscal, DocumentoFiscalItem } from '../lib/types'

function docServico(): DocumentoFiscal {
  return {
    id: 'doc-nfse-1',
    org_id: 'org',
    empresa_id: 'emp',
    tipo_documento: 'nfse',
    origem: 'xml_nfse',
    chave_acesso: 'NFSE:123:5208707:1:ABC',
    numero: '1',
    modelo: 'NFS-e',
    data_emissao: '2026-05-10',
    data_competencia: '05/2026',
    emitente_cnpj: '12345678000190',
    emitente_nome: 'Prestadora',
    destinatario_cnpj: '99887766000155',
    destinatario_nome: 'Tomador',
    valor_total: 10000,
    valor_produtos: 0,
    valor_servicos: 10000,
    valor_desconto: 0,
    valor_frete: 0,
    valor_icms: 0,
    valor_pis: 0,
    valor_cofins: 0,
    valor_st: 0,
    valor_ipi: 0,
    tipo_movimento: 'saida',
    impacto_receita: 'soma_receita',
    origem_devolucao: 'nao_aplicavel',
    status: 'ok',
    created_at: '',
    updated_at: '',
  }
}

function itemServico(anexo: 'III' | 'IV' | 'V' = 'III'): DocumentoFiscalItem {
  return {
    id: 'item-1',
    org_id: 'org',
    empresa_id: 'emp',
    documento_id: 'doc-nfse-1',
    item_numero: 1,
    descricao: 'Servico prestado',
    quantidade: 1,
    valor_unitario: 10000,
    valor_total: 10000,
    valor_desconto: 0,
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
    anexo_sugerido: anexo,
    classificacao_manual: false,
    created_at: '',
  }
}

function apurar(anexoServico?: 'III' | 'IV' | 'V', fatorR?: Parameters<typeof apurarSimples>[0]['fatorR']) {
  return apurarSimples({
    documentos: [docServico()],
    itens: [itemServico()],
    rbt12: 240000,
    origem_rbt12: 'manual',
    cnpjEmpresa: '12345678000190',
    competencia: '05/2026',
    anexoServico,
    fatorR,
  })
}

describe('Simples Nacional - servicos', () => {
  test('apura NFS-e em Anexo III fixo', () => {
    const result = apurar('III', { modo_servico: 'anexo_fixo', anexo_servico: 'III' })
    expect(result.por_anexo.III.receita).toBe(10000)
  })

  test('apura NFS-e em Anexo IV fixo', () => {
    const result = apurar('IV', { modo_servico: 'anexo_fixo', anexo_servico: 'IV' })
    expect(result.por_anexo.IV.receita).toBe(10000)
  })

  test('Fator R maior ou igual a 28% usa Anexo III', () => {
    const result = apurar('III', { modo_servico: 'fator_r', folha12: 70000, percentual: 0.2916, anexo_servico: 'III' })
    expect(result.por_anexo.III.receita).toBe(10000)
    expect(result.fator_r?.anexo_servico).toBe('III')
  })

  test('Fator R menor que 28% usa Anexo V', () => {
    const result = apurar('V', { modo_servico: 'fator_r', folha12: 50000, percentual: 0.2083, anexo_servico: 'V' })
    expect(result.por_anexo.V.receita).toBe(10000)
    expect(result.fator_r?.anexo_servico).toBe('V')
  })

  test('servico sem configuracao fica pendente e nao cai no Anexo I', () => {
    const result = apurar(undefined)
    expect(result.por_anexo.I).toBeUndefined()
    expect(result.alertas.some(a => a.includes('servi'))).toBe(true)
  })

  test('competencia mista separa comercio e servico por anexo', () => {
    const comercioDoc = { ...docServico(), id: 'doc-nfe-1', tipo_documento: 'nfe' as const, origem: 'xml_nfe' as const, valor_servicos: 0, valor_produtos: 5000, valor_total: 5000 }
    const comercioItem = { ...itemServico(), id: 'item-comercio', documento_id: 'doc-nfe-1', classificacao: 'revenda' as const, anexo_sugerido: 'I' as const, valor_total: 5000, valor_unitario: 5000 }
    const result = apurarSimples({
      documentos: [docServico(), comercioDoc],
      itens: [itemServico(), comercioItem],
      rbt12: 240000,
      origem_rbt12: 'manual',
      cnpjEmpresa: '12345678000190',
      competencia: '05/2026',
      anexoServico: 'III',
    })
    expect(result.por_anexo.I.receita).toBe(5000)
    expect(result.por_anexo.III.receita).toBe(10000)
  })

  test('reproduz a partilha do Anexo III da declaracao PGDAS de 06/2026', () => {
    const semRetencao = calcularDas(14208, 57481.02, 'III')!
    const comRetencao = calcularDas(760, 57481.02, 'III', { excluirIss: true })!

    expect(semRetencao.distribuicao).toMatchObject({
      IRPJ: 4,
      CSLL: 3.5,
      COFINS: 12.82,
      PIS: 2.78,
      CPP: 43.4,
      ISS: 33.5,
    })
    expect(semRetencao.breakdown).toMatchObject({
      IRPJ: 34.10,
      CSLL: 29.84,
      COFINS: 109.29,
      PIS: 23.70,
      CPP: 369.98,
      ISS: 285.58,
    })
    expect(semRetencao.valorDas).toBe(852.49)
    expect(comRetencao.breakdown).toMatchObject({
      IRPJ: 1.82,
      CSLL: 1.60,
      COFINS: 5.85,
      PIS: 1.27,
      CPP: 19.79,
      ISS: 0,
    })
    expect(comRetencao.valorDas).toBe(30.33)
  })

  test('segrega serviço com ISS retido e exclui somente a parcela de ISS do DAS', () => {
    const retida = {
      ...docServico(),
      parsed_data: { metadados: { iss_retido: true, valor_iss: 300 } },
    }
    const semRetencao = {
      ...docServico(),
      id: 'doc-nfse-2',
      chave_acesso: 'NFSE:123:5208707:2:DEF',
      numero: '2',
      parsed_data: { metadados: { iss_retido: false, valor_iss: 300 } },
    }
    const itemRetido = itemServico()
    const itemSemRetencao = {
      ...itemServico(),
      id: 'item-2',
      documento_id: semRetencao.id,
    }

    const result = apurarSimples({
      documentos: [retida, semRetencao],
      itens: [itemRetido, itemSemRetencao],
      rbt12: 240000,
      origem_rbt12: 'manual',
      cnpjEmpresa: '12345678000190',
      competencia: '05/2026',
      anexoServico: 'III',
    })
    const issEsperado = calcularDas(10000, 240000, 'III')!.breakdown.ISS

    expect(result.receita_servicos_com_iss_retido).toBe(10000)
    expect(result.receita_servicos_sem_iss_retido).toBe(10000)
    expect(result.total_iss_retido).toBe(300)
    expect(result.valor_iss_excluido_das).toBe(issEsperado)
    expect(result.valor_das_a_pagar).toBeCloseTo(result.valor_das_total - issEsperado, 2)
    expect(result.valor_das_a_pagar).not.toBeCloseTo(result.valor_das_total - 300, 2)
    expect(result.por_anexo.III.segregacaoIss).toMatchObject({
      receitaComRetencao: 10000,
      receitaSemRetencao: 10000,
      valorIssExcluido: issEsperado,
      semRetencao: {
        receita: 10000,
      },
      comRetencao: {
        receita: 10000,
        breakdown: { ISS: 0 },
      },
    })
  })
})
