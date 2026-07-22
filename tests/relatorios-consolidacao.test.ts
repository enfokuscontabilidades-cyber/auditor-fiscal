import { describe, expect, it } from 'vitest'
import { consolidarDocumentoFiscal } from '@/lib/relatorios/consolidacaoFiscal'

const documento = {
  id: 'doc-1',
  valor_produtos: 100,
  valor_icms: 0,
  valor_st: 0,
  valor_ipi: 0,
  valor_pis: 0,
  valor_cofins: 0,
}

describe('consolidacao fiscal dos relatorios', () => {
  it('recupera ICMS dos itens quando o cabecalho esta zerado', () => {
    const resultado = consolidarDocumentoFiscal(documento, [{
      documento_id: 'doc-1',
      valor_total: 100,
      cst_icms: '00',
      valor_bc_icms: 100,
      valor_icms: 18,
    }])

    expect(resultado.tributos.icms.valor).toBe(18)
    expect(resultado.tributos.icms.situacao).toBe('itens')
    expect(resultado.tributos.icms.fonte).toBe('itens')
  })

  it('diferencia zero informado de dado ausente', () => {
    const zero = consolidarDocumentoFiscal(documento, [{
      documento_id: 'doc-1',
      valor_total: 100,
      csosn: '102',
      valor_bc_icms: 0,
      valor_icms: 0,
    }])
    const ausente = consolidarDocumentoFiscal(documento, [])

    expect(zero.tributos.icms.situacao).toBe('zero')
    expect(zero.tributos.icms.valor).toBe(0)
    expect(ausente.tributos.icms.situacao).toBe('nao_informado')
    expect(ausente.tributos.icms.valor).toBeNull()
  })

  it('sinaliza divergencia sem substituir o total oficial do cabecalho', () => {
    const resultado = consolidarDocumentoFiscal({ ...documento, valor_icms: 17 }, [{
      documento_id: 'doc-1',
      valor_total: 100,
      cst_icms: '00',
      valor_bc_icms: 100,
      valor_icms: 18,
    }])

    expect(resultado.tributos.icms.valor).toBe(17)
    expect(resultado.tributos.icms.situacao).toBe('divergente')
    expect(resultado.tem_divergencia).toBe(true)
  })

  it('trata NFS-e como servico e nao exige grupo de ICMS', () => {
    const resultado = consolidarDocumentoFiscal({
      ...documento,
      tipo_documento: 'nfse',
      valor_produtos: 0,
      valor_servicos: 2800,
    }, [{
      documento_id: 'doc-1',
      valor_total: 2800,
      valor_bc_icms: 0,
      valor_icms: 0,
    }])

    expect(resultado.tributos.icms.situacao).toBe('nao_aplicavel')
    expect(resultado.diferenca_produtos).toBe(0)
    expect(resultado.tem_divergencia).toBe(false)
    expect(resultado.dados_incompletos).toBe(false)
  })
})
