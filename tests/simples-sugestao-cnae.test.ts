import { describe, expect, test } from 'vitest'
import { avaliarSugestaoCnae } from '@/lib/simples/sugestaoCnae'
import { analisarCnae, type CnaeIbge } from '@/lib/tributario/cnae'

function cnae(id: string, descricao: string, secao: string, divisao: string, grupo: string): CnaeIbge {
  return {
    id,
    descricao,
    hierarquia: {
      secao: { id: secao, descricao: '' },
      divisao: { id: divisao, descricao: '' },
      grupo: { id: grupo, descricao: '' },
      classe: { id: id.slice(0, 5), descricao: '' },
    },
    atividades: [],
    observacoes: [],
  }
}

describe('conferência consultiva CNAE x seleção manual do Simples', () => {
  test('considera compatível o mesmo anexo, preservando a necessidade de validar condições', () => {
    const enquadramento = analisarCnae(cnae('6920601', 'ATIVIDADES DE CONTABILIDADE', 'M', '69', '692'))
    expect(avaliarSugestaoCnae({ modo_tributacao: 'anexo_fixo', anexo_fixo: 'III' }, enquadramento)).toEqual({
      rotulo: 'Anexo III',
      divergente: false,
      exigeAnalise: true,
    })
  })

  test('avisa quando a seleção manual diverge do anexo principal sugerido', () => {
    const enquadramento = analisarCnae(cnae('6911701', 'SERVIÇOS ADVOCATÍCIOS', 'M', '69', '691'))
    expect(avaliarSugestaoCnae({ modo_tributacao: 'anexo_fixo', anexo_fixo: 'III' }, enquadramento).divergente).toBe(true)
  })

  test('avisa quando atividade sujeita ao Fator R foi configurada como anexo fixo', () => {
    const enquadramento = analisarCnae(cnae('7410203', 'DESIGN DE PRODUTO', 'M', '74', '741'))
    expect(avaliarSugestaoCnae({ modo_tributacao: 'anexo_fixo', anexo_fixo: 'III' }, enquadramento)).toMatchObject({
      rotulo: 'Fator R (III/V)',
      divergente: true,
    })
  })

  test('não inventa divergência quando a regra exige análise complementar', () => {
    const enquadramento = analisarCnae(cnae('8111700', 'SERVIÇOS COMBINADOS PARA APOIO A EDIFÍCIOS', 'N', '81', '811'))
    expect(avaliarSugestaoCnae({ modo_tributacao: 'fator_r', anexo_fixo: 'III' }, enquadramento)).toEqual({
      rotulo: 'Análise necessária',
      divergente: false,
      exigeAnalise: true,
    })
  })

  test('sinaliza CNAE de comércio ou indústria vinculado indevidamente a serviço', () => {
    const enquadramento = analisarCnae(cnae('4711302', 'COMÉRCIO VAREJISTA', 'G', '47', '471'))
    expect(avaliarSugestaoCnae({ modo_tributacao: 'anexo_fixo', anexo_fixo: 'III' }, enquadramento)).toMatchObject({
      rotulo: 'Anexo I',
      divergente: true,
    })
  })
})
