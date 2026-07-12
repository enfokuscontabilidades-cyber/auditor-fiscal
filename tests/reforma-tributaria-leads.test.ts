/**
 * Testes automatizados — diagnóstico público de IBS/CBS (isca digital) e
 * validações do formulário de leads.
 *
 * EXECUÇÃO:
 *   npx vitest tests/reforma-tributaria-leads.test.ts
 *   (mesmo padrão de globals de tests/importador-xml.test.ts — requer vitest configurado)
 */

import { validarCnpj, formatarCnpj, mascararCnpjParcial, telefoneValido, emailValido, somenteDigitos } from '../lib/validacao/documentos'
import { montarLinha, analisarLinha, temReforma, ALIQUOTA_IBS_UF_2026, ALIQUOTA_CBS_2026 } from '../lib/fiscal/analiseReformaTributaria'

// CNPJs válidos conhecidos (dígitos verificadores corretos)
const CNPJ_VALIDO_1 = '11444777000161' // CNPJ de teste amplamente conhecido, DV correto
const CNPJ_VALIDO_2 = '11222333000181'

describe('validarCnpj', () => {
  it('aceita CNPJ válido com dígitos verificadores corretos', () => {
    expect(validarCnpj(CNPJ_VALIDO_1)).toBe(true)
    expect(validarCnpj(CNPJ_VALIDO_2)).toBe(true)
  })

  it('aceita CNPJ válido formatado com máscara', () => {
    expect(validarCnpj('11.444.777/0001-61')).toBe(true)
  })

  it('rejeita CNPJ com dígito verificador errado', () => {
    expect(validarCnpj('11444777000162')).toBe(false)
  })

  it('rejeita CNPJ com todos os dígitos iguais', () => {
    expect(validarCnpj('11111111111111')).toBe(false)
  })

  it('rejeita CNPJ com tamanho incorreto', () => {
    expect(validarCnpj('123')).toBe(false)
    expect(validarCnpj('')).toBe(false)
  })
})

describe('formatarCnpj / mascararCnpjParcial', () => {
  it('formata progressivamente enquanto digita', () => {
    expect(formatarCnpj('11444777000161')).toBe('11.444.777/0001-61')
    expect(formatarCnpj('114447')).toBe('11.444.7')
  })

  it('mascara mantendo raiz e dígitos finais', () => {
    expect(mascararCnpjParcial(CNPJ_VALIDO_1)).toBe('11.444.***/****-61')
  })
})

describe('telefoneValido / emailValido', () => {
  it('aceita telefone com 10 ou 11 dígitos', () => {
    expect(telefoneValido('(62) 99999-9999')).toBe(true)
    expect(telefoneValido('(62) 3333-3333')).toBe(true)
  })

  it('rejeita telefone incompleto', () => {
    expect(telefoneValido('123')).toBe(false)
  })

  it('valida formato básico de e-mail', () => {
    expect(emailValido('contato@empresa.com.br')).toBe(true)
    expect(emailValido('invalido')).toBe(false)
  })

  it('somenteDigitos remove tudo que não é número', () => {
    expect(somenteDigitos('(62) 99999-9999')).toBe('6299999999')
  })
})

describe('análise de IBS/CBS — mesma regra usada no módulo interno e na página pública', () => {
  it('classifica como crítico um item sem qualquer destaque de IBS/CBS', () => {
    const linha = montarLinha({
      cst: '-', cclass: '-', base: 0, valorItem: 100,
      aliquotaIbsUf: 0, valorIbsUf: 0, aliquotaIbsMun: 0, valorIbsMun: 0,
      valorIbs: 0, aliquotaCbs: 0, valorCbs: 0,
    })
    expect(linha.destacado).toBe(false)
    expect(linha.situacao).toBe('critico')
    expect(linha.alertas).toContain('Sem destaque de IBS/CBS')
  })

  it('classifica como ok um item destacado com CST, cClassTrib e valores esperados', () => {
    const base = 100
    const valorIbsUf = Math.round(base * (ALIQUOTA_IBS_UF_2026 / 100) * 100) / 100
    const valorCbs = Math.round(base * (ALIQUOTA_CBS_2026 / 100) * 100) / 100
    const linha = montarLinha({
      cst: '000', cclass: '000001', base, valorItem: base,
      aliquotaIbsUf: ALIQUOTA_IBS_UF_2026, valorIbsUf, aliquotaIbsMun: 0, valorIbsMun: 0,
      valorIbs: valorIbsUf, aliquotaCbs: ALIQUOTA_CBS_2026, valorCbs,
    })
    expect(linha.destacado).toBe(true)
    expect(linha.situacao).toBe('ok')
    expect(linha.alertas).toHaveLength(0)
  })

  it('classifica como alerta um item destacado com cClassTrib ausente', () => {
    const linha = montarLinha({
      cst: '000', cclass: '-', base: 100, valorItem: 100,
      aliquotaIbsUf: ALIQUOTA_IBS_UF_2026, valorIbsUf: 0.1, aliquotaIbsMun: 0, valorIbsMun: 0,
      valorIbs: 0.1, aliquotaCbs: 0, valorCbs: 0,
    })
    expect(linha.destacado).toBe(true)
    expect(linha.situacao).toBe('alerta')
    expect(linha.alertas).toContain('cClassTrib ausente')
  })

  it('temReforma reconhece grupo IBS/CBS mesmo com base zerada, se houver CST', () => {
    expect(temReforma({ cst: '000', cclass: '-', base: 0, valorIbs: 0, valorCbs: 0, valorIbsUf: 0, valorIbsMun: 0 })).toBe(true)
    expect(temReforma({ cst: '-', cclass: '-', base: 0, valorIbs: 0, valorCbs: 0, valorIbsUf: 0, valorIbsMun: 0 })).toBe(false)
  })

  it('analisarLinha sinaliza alíquota de CBS divergente do padrão vigente', () => {
    const { alertas } = analisarLinha({
      cst: '000', cclass: '000001', base: 100, valorItem: 100,
      aliquotaIbsUf: 0, valorIbsUf: 0, aliquotaIbsMun: 0, valorIbsMun: 0,
      valorIbs: 0, aliquotaCbs: 1.5, valorCbs: 1.5, destacado: true,
    })
    expect(alertas.some(a => a.includes('CBS'))).toBe(true)
  })
})
