import { valorFiscalNfse } from '../lib/nfse/valorFiscalNfse'

describe('valor fiscal da NFS-e', () => {
  test('usa o valor bruto dos servicos sem diminuir ISS retido', () => {
    const nfse = {
      valorServicos: 1000,
      valorLiquido: 950,
      valorIssRetido: 50,
      status: 'ok',
    }

    expect(valorFiscalNfse(nfse)).toBe(1000)
  })

  test('zera o valor de nota cancelada', () => {
    expect(valorFiscalNfse({ valorServicos: 1000, status: 'cancelada' })).toBe(0)
  })
})
