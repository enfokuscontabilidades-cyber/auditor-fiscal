import { describe, expect, it } from 'vitest'
import { extrairTipiDasLinhas, interpretarAliquotaTipi } from '@/lib/tributario/tipi'

describe('leitura da TIPI oficial', () => {
  it('diferencia alíquota zero de produto não tributado', () => {
    expect(interpretarAliquotaTipi('0')).toEqual({
      aliquota: 0,
      aliquota_texto: '0%',
      situacao: 'aliquota_zero',
    })
    expect(interpretarAliquotaTipi('NT')).toEqual({
      aliquota: null,
      aliquota_texto: 'NT',
      situacao: 'nao_tributado',
    })
  })

  it('extrai a alíquota principal e os Ex TIPI do mesmo NCM', () => {
    const resultado = extrairTipiDasLinhas([
      ['NCM', 'EX', 'DESCRIÇÃO', 'ALÍQUOTA (%)'],
      ['0305.72.00', null, '-- Cabeças, caudas e bexigas-natatórias, de peixes', '3.25'],
      ['0305.72.00', '01', 'De peixes defumados', '0'],
      ['0305.72.00', '02', 'De peixes salgados', 'NT'],
    ], '03057200')

    expect(resultado?.aliquota).toBe(3.25)
    expect(resultado?.aliquota_texto).toBe('3,25%')
    expect(resultado?.descricao).toBe('Cabeças, caudas e bexigas-natatórias, de peixes')
    expect(resultado?.excecoes).toEqual([
      { ex: '01', descricao: 'De peixes defumados', aliquota: 0, aliquota_texto: '0%', situacao: 'aliquota_zero' },
      { ex: '02', descricao: 'De peixes salgados', aliquota: null, aliquota_texto: 'NT', situacao: 'nao_tributado' },
    ])
  })

  it('não usa linha hierárquica como alíquota do NCM completo', () => {
    expect(extrairTipiDasLinhas([
      ['68.10', null, 'Obras de cimento', ''],
    ], '68101900')).toBeNull()
  })
})
