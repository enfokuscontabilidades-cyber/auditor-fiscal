import { describe, expect, test } from 'vitest'
import type { TributarioCnaeRegra } from '@/lib/types'
import type { CnaeIbge } from '@/lib/tributario/cnae'
import {
  analisarCnaeComCatalogo,
  encontrarRegraCnae,
} from '@/lib/tributario/cnaeCatalogo'

function criarCnae(id: string, secao = 'M', divisao = '69', grupo = '691'): CnaeIbge {
  return {
    id,
    descricao: 'ATIVIDADE DE TESTE',
    hierarquia: {
      secao: { id: secao, descricao: 'Seção de teste' },
      divisao: { id: divisao, descricao: 'Divisão de teste' },
      grupo: { id: grupo, descricao: 'Grupo de teste' },
      classe: { id: id.slice(0, 5), descricao: 'Classe de teste' },
    },
    atividades: [],
    observacoes: [],
  }
}

function criarRegra(
  alteracoes: Partial<TributarioCnaeRegra> = {},
): TributarioCnaeRegra {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    codigo_regra: 'SN_CNAE_TESTE',
    versao: 1,
    tipo_correspondencia: 'exato',
    padroes: ['6911701'],
    prioridade: 100,
    natureza: 'servico',
    tratamento_principal: 'anexo_iv',
    anexo_principal: 'IV',
    titulo: 'Regra do catálogo',
    explicacao: 'Explicação versionada.',
    confianca: 'alta',
    conclusivo: true,
    condicoes: ['Condição cadastrada.'],
    alertas: ['Alerta cadastrado.'],
    excecoes: [],
    entendimentos: [],
    fontes: [{
      titulo: 'Fonte oficial',
      referencia: 'Artigo de teste',
      url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm',
    }],
    vigencia_inicio: '2018-08-01',
    vigencia_fim: null,
    ativo: true,
    created_at: '2026-07-27T00:00:00.000Z',
    updated_at: '2026-07-27T00:00:00.000Z',
    ...alteracoes,
  }
}

describe('catálogo versionado de regras por CNAE', () => {
  test('aplica a regra vigente carregada do catálogo', () => {
    const resultado = analisarCnaeComCatalogo(
      criarCnae('6911701'),
      [criarRegra()],
    )

    expect(resultado).toMatchObject({
      tratamento: 'anexo_iv',
      anexo_indicativo: 'IV',
      titulo: 'Regra do catálogo',
      versao_regra: 'SN_CNAE_TESTE@1',
    })
    expect(resultado.fontes.some(fonte => fonte.titulo === 'Fonte oficial')).toBe(true)
  })

  test('respeita prioridade e, no empate, a versão mais recente', () => {
    const cnae = criarCnae('6911701')
    const baixa = criarRegra({ codigo_regra: 'REGRA_BAIXA', prioridade: 50 })
    const antiga = criarRegra({ codigo_regra: 'REGRA_PRIORITARIA', prioridade: 110, versao: 1 })
    const nova = criarRegra({ codigo_regra: 'REGRA_PRIORITARIA', prioridade: 110, versao: 2 })

    expect(encontrarRegraCnae(cnae, [baixa, antiga, nova])).toBe(nova)
  })

  test('ignora regra inativa', () => {
    const regra = criarRegra({ ativo: false })
    expect(encontrarRegraCnae(criarCnae('6911701'), [regra])).toBeNull()
  })

  test('aceita correspondência por prefixo e hierarquia', () => {
    const cnae = criarCnae('6201501', 'J', '62', '620')
    const prefixo = criarRegra({ tipo_correspondencia: 'prefixo', padroes: ['620'] })
    const grupo = criarRegra({ tipo_correspondencia: 'grupo', padroes: ['620'] })
    const secao = criarRegra({ tipo_correspondencia: 'secao', padroes: ['j'] })

    expect(encontrarRegraCnae(cnae, [prefixo])).toBe(prefixo)
    expect(encontrarRegraCnae(cnae, [grupo])).toBe(grupo)
    expect(encontrarRegraCnae(cnae, [secao])).toBe(secao)
  })

  test('mantém o motor local como fallback quando o catálogo está indisponível', () => {
    const resultado = analisarCnaeComCatalogo(
      criarCnae('4711302', 'G', '47', '471'),
      [],
    )

    expect(resultado).toMatchObject({
      natureza: 'comercio',
      tratamento: 'anexo_i',
      anexo_indicativo: 'I',
    })
  })
})
