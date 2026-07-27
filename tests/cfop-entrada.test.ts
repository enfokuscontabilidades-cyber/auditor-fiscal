import {
  identificadorNotaEntrada,
  resolverCfopEntradaEfetivo,
} from '../lib/fiscal/cfopEntrada'

describe('CFOP efetivo das entradas', () => {
  test('usa o CFOP de entrada vinculado como principal e preserva o original separadamente', () => {
    const item = { cfop: '6102', tipo_nfe: 'terceiro', fonte: 'xml' }
    const efetivo = resolverCfopEntradaEfetivo(
      item,
      [{ cfopSaida: '6102', cfopEntrada: '2556' }],
      '2102',
    )

    expect(efetivo).toBe('2556')
    expect(item.cfop).toBe('6102')
  })

  test('usa a sugestao calculada quando nao existe vinculo personalizado', () => {
    expect(resolverCfopEntradaEfetivo(
      { cfop: '5102', tipo_nfe: 'terceiro', fonte: 'xml' },
      [],
      '1102',
    )).toBe('1102')
  })

  test('nunca promove CFOP de saida para principal de uma entrada de terceiro', () => {
    expect(resolverCfopEntradaEfetivo(
      { cfop: '5102', tipo_nfe: 'terceiro', fonte: 'xml' },
      [{ cfopSaida: '5102', cfopEntrada: '6102' }],
      '5102',
    )).toBe('')
  })

  test('mantem o CFOP original de uma entrada proveniente do SPED', () => {
    expect(resolverCfopEntradaEfetivo(
      { cfop: '1102', fonte: 'sped' },
      [],
      '',
    )).toBe('1102')
  })
})

describe('identidade da nota de entrada', () => {
  test('usa a chave de acesso quando disponivel', () => {
    expect(identificadorNotaEntrada({
      chave_nfe: 'NFE-ABC',
      numero_nota: '10',
      fornecedor: 'Fornecedor',
      data: '2026-07-01',
    })).toBe('chave:NFE-ABC')
  })

  test('gera identidades diferentes para notas sem chave', () => {
    const primeira = identificadorNotaEntrada({ numero_nota: '10', fornecedor: 'Fornecedor A', data: '2026-07-01' })
    const segunda = identificadorNotaEntrada({ numero_nota: '11', fornecedor: 'Fornecedor A', data: '2026-07-01' })
    expect(primeira).not.toBe(segunda)
  })
})
