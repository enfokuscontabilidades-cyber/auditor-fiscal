import { describe, expect, test } from 'vitest'
import {
  agruparLinhasReforma,
  montarLinhasReforma,
  totalizarLinhasReforma,
  type ArquivoXmlFiscalReforma,
  type DocumentoFiscalReforma,
} from '../lib/fiscal/linhasReformaTributaria'

const CHAVE = '52260612345678000190550010000000631000000630'

function documentoAtual(): DocumentoFiscalReforma {
  return {
    id: 'doc-atual',
    tipo_documento: 'nfe',
    chave_acesso: CHAVE,
    numero: '63',
    serie: '1',
    modelo: '55',
    data_emissao: '2026-06-25',
    data_competencia: '2026-06',
    destinatario_nome: 'Cliente Teste',
    destinatario_cnpj: '01121175000110',
    tipo_movimento: 'saida',
    fa_documentos_itens: [
      { id: 'item-atual-1', item_numero: 1, codigo_produto: 'A', descricao: 'Produto repetido', ncm: '01012100', cfop: '5102', valor_total: 100 },
      { id: 'item-atual-2', item_numero: 2, codigo_produto: 'A', descricao: 'Produto repetido', ncm: '01012100', cfop: '5102', valor_total: 200 },
    ],
  }
}

function xmlLegado(): ArquivoXmlFiscalReforma {
  return {
    id: 'xml-legado',
    chave_nfe: CHAVE,
    numero_nf: '63',
    data_emissao: '2026-06-25',
    competencia: '2026-06',
    tipo_operacao: 'saida',
    destinatario_nome: 'Cliente Teste',
    destinatario_cnpj: '01121175000110',
    parsed_data: {
      itens_saida: [
        {
          id: 'item-legado-1', item_numero: 1, codigo_produto: 'A', descricao: 'Produto repetido',
          ncm: '01012100', cfop: '5102', valor_contabil: 100, cst_ibs_cbs: '000', cclass_trib: '000001',
          base_ibs_cbs: 100, aliquota_ibs_uf: 0.1, valor_ibs_uf: 0.1, valor_ibs: 0.1,
          aliquota_cbs: 0.9, valor_cbs: 0.9,
        },
        { id: 'item-legado-2', item_numero: 2, codigo_produto: 'A', descricao: 'Produto repetido', ncm: '01012100', cfop: '5102', valor_contabil: 200 },
      ],
    },
  }
}

describe('agrupamento da Reforma Tributária por NF-e', () => {
  test('deduplica fonte atual e legada pela chave e preserva itens de descrição repetida', () => {
    const linhas = montarLinhasReforma([documentoAtual()], [xmlLegado()])
    const notas = agruparLinhasReforma(linhas)

    expect(linhas).toHaveLength(2)
    expect(linhas.map(item => item.itemNumero)).toEqual([1, 2])
    expect(linhas[0].serie).toBe('1')
    expect(notas).toHaveLength(1)
    expect(notas[0]).toMatchObject({ nota: '63', serie: '1', totalItens: 2, participanteNome: 'Cliente Teste' })
    expect(totalizarLinhasReforma(linhas).notas).toBe(1)
  })

  test('não mistura notas de mesmo número quando as chaves são diferentes', () => {
    const primeira = documentoAtual()
    const segunda: DocumentoFiscalReforma = {
      ...documentoAtual(),
      id: 'doc-segundo',
      chave_acesso: '52260612345678000190550020000000631000000631',
      serie: '2',
      fa_documentos_itens: [{ ...documentoAtual().fa_documentos_itens![0], id: 'item-segundo' }],
    }

    const notas = agruparLinhasReforma(montarLinhasReforma([primeira, segunda], []))
    expect(notas).toHaveLength(2)
    expect(new Set(notas.map(nota => nota.serie))).toEqual(new Set(['1', '2']))
  })

  test('identifica NFS-e e NFC-e conforme tipo/modelo do documento central', () => {
    const nfse: DocumentoFiscalReforma = {
      ...documentoAtual(), id: 'doc-nfse', chave_acesso: 'NFSE:1', tipo_documento: 'nfse', modelo: 'NFS-e',
    }
    const nfce: DocumentoFiscalReforma = {
      ...documentoAtual(), id: 'doc-nfce', chave_acesso: 'NFE:65', tipo_documento: 'nfe', modelo: '65',
    }

    const notas = agruparLinhasReforma(montarLinhasReforma([nfse, nfce], []))
    expect(new Set(notas.map(nota => nota.tipoDocumento))).toEqual(new Set(['nfse', 'nfce']))
  })
})
