import { describe, expect, test } from 'vitest'
import {
  analisarCnae,
  formatarCnae,
  normalizarCnae,
  type CnaeIbge,
} from '@/lib/tributario/cnae'

function cnae(params: {
  id: string
  descricao: string
  secao: string
  divisao: string
  grupo?: string
  atividades?: string[]
}): CnaeIbge {
  return {
    id: params.id,
    descricao: params.descricao,
    hierarquia: {
      secao: { id: params.secao, descricao: 'Seção de teste' },
      divisao: { id: params.divisao, descricao: 'Divisão de teste' },
      grupo: { id: params.grupo ?? `${params.divisao}1`, descricao: 'Grupo de teste' },
      classe: { id: `${params.id.slice(0, 5)}`, descricao: 'Classe de teste' },
    },
    atividades: params.atividades ?? [],
    observacoes: [],
  }
}

describe('consulta tributária por CNAE', () => {
  test('normaliza e formata o código oficial', () => {
    expect(normalizarCnae('62.01-5/01')).toBe('6201501')
    expect(formatarCnae('6201501')).toBe('6201-5/01')
  })

  test('indica Anexo I para comércio atacadista ou varejista', () => {
    const resultado = analisarCnae(cnae({
      id: '4711302', descricao: 'COMÉRCIO VAREJISTA DE MERCADORIAS', secao: 'G', divisao: '47',
    }))
    expect(resultado).toMatchObject({ natureza: 'comercio', tratamento: 'anexo_i', anexo_indicativo: 'I', conclusivo: true })
    expect(resultado.condicoes.join(' ')).toContain('revenda')
  })

  test('classifica bares, restaurantes e lanchonetes no Anexo I como regra principal', () => {
    const restaurante = analisarCnae(cnae({
      id: '5611201', descricao: 'RESTAURANTES E SIMILARES', secao: 'I', divisao: '56', grupo: '561',
    }))
    const bar = analisarCnae(cnae({
      id: '5611204', descricao: 'BARES E OUTROS ESTABELECIMENTOS ESPECIALIZADOS EM SERVIR BEBIDAS, SEM ENTRETENIMENTO', secao: 'I', divisao: '56', grupo: '561',
    }))
    const lanchonete = analisarCnae(cnae({
      id: '5611203', descricao: 'LANCHONETES, CASAS DE CHA, DE SUCOS E SIMILARES', secao: 'I', divisao: '56', grupo: '561',
    }))

    for (const resultado of [restaurante, bar, lanchonete]) {
      expect(resultado).toMatchObject({ natureza: 'comercio', tratamento: 'anexo_i', anexo_indicativo: 'I', confianca: 'alta', conclusivo: true })
      expect(resultado.excecoes).toEqual(expect.arrayContaining([
        expect.objectContaining({ tratamento: 'anexo_ii', anexo: 'II' }),
        expect.objectContaining({ tratamento: 'anexo_iii', anexo: 'III' }),
      ]))
    }
  })

  test('aplica a mesma regra principal do Anexo I aos demais fornecimentos de alimentacao da divisao 56', () => {
    const resultado = analisarCnae(cnae({
      id: '5620104', descricao: 'FORNECIMENTO DE ALIMENTOS PREPARADOS PARA CONSUMO DOMICILIAR', secao: 'I', divisao: '56', grupo: '562',
    }))

    expect(resultado).toMatchObject({ tratamento: 'anexo_i', anexo_indicativo: 'I', conclusivo: true })
    expect(resultado.alertas.join(' ')).toContain('embalagem')
  })

  test('classifica hospedagem no Anexo III e separa venda autonoma de alimentacao no Anexo I', () => {
    const resultado = analisarCnae(cnae({
      id: '5510801', descricao: 'HOTEIS', secao: 'I', divisao: '55', grupo: '551',
    }))

    expect(resultado).toMatchObject({ tratamento: 'anexo_iii', anexo_indicativo: 'III', conclusivo: true })
    expect(resultado.excecoes[0]).toMatchObject({ tratamento: 'anexo_i', anexo: 'I' })
  })

  test('classifica a corretagem no aluguel de imoveis diretamente no Anexo III', () => {
    const resultado = analisarCnae(cnae({
      id: '6821802', descricao: 'CORRETAGEM NO ALUGUEL DE IMOVEIS', secao: 'L', divisao: '68', grupo: '682',
    }))

    expect(resultado).toMatchObject({
      natureza: 'servico',
      tratamento: 'anexo_iii',
      anexo_indicativo: 'III',
      confianca: 'alta',
      conclusivo: true,
    })
  })

  test('separa corretagem na compra e venda de avaliacao de imoveis no CNAE misto', () => {
    const resultado = analisarCnae(cnae({
      id: '6821801', descricao: 'CORRETAGEM NA COMPRA E VENDA E AVALIACAO DE IMOVEIS', secao: 'L', divisao: '68', grupo: '682',
    }))

    expect(resultado).toMatchObject({
      tratamento: 'anexo_iii',
      anexo_indicativo: 'III',
      confianca: 'alta',
      conclusivo: false,
    })
    expect(resultado.condicoes.join(' ')).toContain('Fator R')
    expect(resultado.condicoes.join(' ')).toContain('Segregar')
  })

  test('mantem gestao e administracao de imoveis de terceiros sujeita ao Fator R', () => {
    const resultado = analisarCnae(cnae({
      id: '6822600', descricao: 'GESTAO E ADMINISTRACAO DA PROPRIEDADE IMOBILIARIA', secao: 'L', divisao: '68', grupo: '682',
    }))

    expect(resultado).toMatchObject({
      tratamento: 'fator_r',
      anexo_indicativo: null,
      confianca: 'alta',
      conclusivo: true,
    })
  })

  test('distingue comercio, reparacao e representacao no setor automotivo', () => {
    const comercio = analisarCnae(cnae({
      id: '4530703', descricao: 'COMERCIO A VAREJO DE PECAS E ACESSORIOS NOVOS PARA VEICULOS AUTOMOTORES', secao: 'G', divisao: '45', grupo: '453',
    }))
    const reparacao = analisarCnae(cnae({
      id: '4520001', descricao: 'SERVICOS DE MANUTENCAO E REPARACAO MECANICA DE VEICULOS AUTOMOTORES', secao: 'G', divisao: '45', grupo: '452',
    }))
    const representacao = analisarCnae(cnae({
      id: '4530706', descricao: 'REPRESENTANTES COMERCIAIS E AGENTES DO COMERCIO DE PECAS PARA VEICULOS', secao: 'G', divisao: '45', grupo: '453',
    }))

    expect(comercio).toMatchObject({ tratamento: 'anexo_i', anexo_indicativo: 'I', conclusivo: true })
    expect(reparacao).toMatchObject({ tratamento: 'anexo_iii', anexo_indicativo: 'III', conclusivo: true })
    expect(representacao).toMatchObject({ tratamento: 'fator_r', anexo_indicativo: null, conclusivo: true })
  })

  test('mantem consignacao automotiva inconclusiva ate identificar o contrato', () => {
    const resultado = analisarCnae(cnae({
      id: '4512902', descricao: 'COMERCIO SOB CONSIGNACAO DE VEICULOS AUTOMOTORES', secao: 'G', divisao: '45', grupo: '451',
    }))

    expect(resultado).toMatchObject({ tratamento: 'inconclusivo', anexo_indicativo: null, confianca: 'alta', conclusivo: false })
    expect(resultado.condicoes.join(' ')).toContain('Anexo I')
    expect(resultado.condicoes.join(' ')).toContain('Anexo III')
  })

  test('indica Anexo II para venda de produção própria industrial', () => {
    const resultado = analisarCnae(cnae({
      id: '2222600', descricao: 'FABRICAÇÃO DE EMBALAGENS DE MATERIAL PLÁSTICO', secao: 'C', divisao: '22',
    }))
    expect(resultado).toMatchObject({ natureza: 'industria', tratamento: 'anexo_ii', anexo_indicativo: 'II', conclusivo: true })
    expect(resultado.condicoes.join(' ')).toContain('produção própria')
    expect(resultado.condicoes.join(' ')).toContain('Anexo I')
  })

  test('classifica serviços advocatícios no Anexo IV', () => {
    const resultado = analisarCnae(cnae({
      id: '6911701', descricao: 'SERVIÇOS ADVOCATÍCIOS', secao: 'M', divisao: '69', grupo: '691',
    }))
    expect(resultado).toMatchObject({ tratamento: 'anexo_iv', anexo_indicativo: 'IV', confianca: 'alta', conclusivo: true })
  })

  test('classifica contabilidade no Anexo III e exige as condições profissionais da SC Cosit 65/2025', () => {
    const resultado = analisarCnae(cnae({
      id: '6920601', descricao: 'ATIVIDADES DE CONTABILIDADE', secao: 'M', divisao: '69', grupo: '692',
    }))
    expect(resultado).toMatchObject({ tratamento: 'anexo_iii', anexo_indicativo: 'III', confianca: 'alta', conclusivo: false })
    expect(resultado.condicoes.join(' ')).toContain('Conselho Regional de Contabilidade')
    expect(resultado.entendimentos[0]).toMatchObject({ identificacao: 'SC Cosit nº 65/2025', efeito: 'condiciona_enquadramento' })
  })

  test('aplica a regra contábil especializada também ao CNAE 6920-6/02 sem generalizar outras consultorias', () => {
    const resultado = analisarCnae(cnae({
      id: '6920602', descricao: 'ATIVIDADES DE CONSULTORIA E AUDITORIA CONTÁBIL E TRIBUTÁRIA', secao: 'M', divisao: '69', grupo: '692',
    }))
    expect(resultado).toMatchObject({ tratamento: 'anexo_iii', anexo_indicativo: 'III', conclusivo: false })
    expect(resultado.alertas.join(' ')).toContain('não sejam contábeis')
  })

  test('submete software e escolas de esportes ao Fator R', () => {
    const software = analisarCnae(cnae({
      id: '6201501', descricao: 'DESENVOLVIMENTO DE SOFTWARE SOB ENCOMENDA', secao: 'J', divisao: '62', grupo: '620',
    }))
    const esportes = analisarCnae(cnae({
      id: '8591100', descricao: 'ENSINO DE ESPORTES', secao: 'P', divisao: '85', grupo: '859',
    }))
    expect(software.tratamento).toBe('fator_r')
    expect(esportes).toMatchObject({ tratamento: 'fator_r', confianca: 'alta', conclusivo: true })
    expect(esportes.condicoes.join(' ')).toContain('28%')
  })

  test('distingue projeto de design de interiores da execução de decoração', () => {
    const resultado = analisarCnae(cnae({
      id: '7410202', descricao: 'DESIGN DE INTERIORES', secao: 'M', divisao: '74', grupo: '741',
    }))

    expect(resultado).toMatchObject({
      tratamento: 'fator_r',
      anexo_indicativo: null,
      confianca: 'alta',
      conclusivo: false,
    })
    expect(resultado.entendimentos[0]).toMatchObject({
      identificacao: 'SC Cosit nº 243/2025',
      efeito: 'distingue_receitas',
    })
    expect(resultado.excecoes[0]).toMatchObject({
      tratamento: 'anexo_iv',
      anexo: 'IV',
    })
    expect(resultado.excecoes[0].quando).toContain('execução efetiva')
  })

  test('classifica design de produto pelo Fator R sem atribuir indevidamente a SD Cosit 33/2013', () => {
    const resultado = analisarCnae(cnae({
      id: '7410203', descricao: 'DESIGN DE PRODUTO', secao: 'M', divisao: '74', grupo: '741',
    }))

    expect(resultado).toMatchObject({
      tratamento: 'fator_r',
      anexo_indicativo: null,
      confianca: 'alta',
      conclusivo: true,
    })
    expect(resultado.fontes.some(fonte => fonte.referencia.includes('33/2013'))).toBe(false)
    expect(resultado.entendimentos.some(item => item.identificacao.includes('33/2013'))).toBe(false)
  })

  test('vincula a SD Cosit 33/2013 à pintura predial e diferencia os Anexos III e IV', () => {
    const resultado = analisarCnae(cnae({
      id: '4330404', descricao: 'SERVIÇOS DE PINTURA DE EDIFÍCIOS EM GERAL', secao: 'F', divisao: '43', grupo: '433',
    }))

    expect(resultado).toMatchObject({ tratamento: 'anexo_iii', anexo_indicativo: 'III', conclusivo: true })
    expect(resultado.entendimentos[0]).toMatchObject({
      identificacao: 'SD Cosit nº 33/2013',
      tipo: 'solucao_divergencia',
      efeito: 'distingue_receitas',
    })
    expect(resultado.entendimentos[1]).toMatchObject({ efeito: 'risco_exclusao' })
    expect(resultado.excecoes[0]).toMatchObject({ tratamento: 'anexo_iv', anexo: 'IV' })
    expect(resultado.alertas.join(' ')).toContain('exclusão')
  })

  test('classifica climatização no Anexo III, separa a obra no IV e alerta sobre exclusão', () => {
    const resultado = analisarCnae(cnae({
      id: '4322302', descricao: 'INSTALAÇÃO E MANUTENÇÃO DE SISTEMAS CENTRAIS DE AR CONDICIONADO', secao: 'F', divisao: '43', grupo: '432',
    }))

    expect(resultado).toMatchObject({ tratamento: 'anexo_iii', anexo_indicativo: 'III', confianca: 'alta', conclusivo: true })
    expect(resultado.excecoes[0]).toMatchObject({ tratamento: 'anexo_iv', anexo: 'IV' })
    expect(resultado.entendimentos).toEqual(expect.arrayContaining([
      expect.objectContaining({ identificacao: 'SC Cosit nº 167/2014', efeito: 'distingue_receitas' }),
      expect.objectContaining({ efeito: 'risco_exclusao' }),
    ]))
  })

  test('mantém coleta de resíduos não perigosos no Anexo III e não a confunde com limpeza', () => {
    const resultado = analisarCnae(cnae({
      id: '3811400', descricao: 'COLETA DE RESÍDUOS NÃO-PERIGOSOS', secao: 'E', divisao: '38', grupo: '381',
    }))

    expect(resultado).toMatchObject({ tratamento: 'anexo_iii', anexo_indicativo: 'III', confianca: 'alta', conclusivo: true })
    expect(resultado.excecoes).toHaveLength(0)
    expect(resultado.entendimentos).toEqual(expect.arrayContaining([
      expect.objectContaining({ identificacao: 'SC Cosit nº 18/2014', efeito: 'confirma_regra' }),
      expect.objectContaining({ identificacao: 'SC Cosit nº 18/2014', efeito: 'risco_exclusao' }),
    ]))
  })

  test.each([
    ['4321500', 'INSTALAÇÃO E MANUTENÇÃO ELÉTRICA'],
    ['4322301', 'INSTALAÇÕES HIDRÁULICAS, SANITÁRIAS E DE GÁS'],
    ['4322303', 'INSTALAÇÕES DE SISTEMA DE PREVENÇÃO CONTRA INCÊNDIO'],
  ])('estrutura a regra de instalações prediais para o CNAE %s', (id, descricao) => {
    const resultado = analisarCnae(cnae({ id, descricao, secao: 'F', divisao: '43', grupo: '432' }))

    expect(resultado).toMatchObject({ tratamento: 'anexo_iii', anexo_indicativo: 'III', confianca: 'alta', conclusivo: true })
    expect(resultado.excecoes[0]).toMatchObject({ tratamento: 'anexo_iv', anexo: 'IV' })
    expect(resultado.entendimentos).toEqual(expect.arrayContaining([
      expect.objectContaining({ identificacao: expect.stringContaining('ADI RFB nº 8/2013'), efeito: 'distingue_receitas' }),
      expect.objectContaining({ identificacao: 'SC Cosit nº 25/2026', efeito: 'risco_exclusao' }),
    ]))
  })

  test('classifica acabamento em gesso no Anexo III e obra assumida no Anexo IV', () => {
    const resultado = analisarCnae(cnae({
      id: '4330403', descricao: 'OBRAS DE ACABAMENTO EM GESSO E ESTUQUE', secao: 'F', divisao: '43', grupo: '433',
    }))

    expect(resultado).toMatchObject({ tratamento: 'anexo_iii', anexo_indicativo: 'III', confianca: 'alta', conclusivo: true })
    expect(resultado.entendimentos[0]).toMatchObject({ identificacao: 'SC Cosit nº 201/2015', efeito: 'distingue_receitas' })
    expect(resultado.excecoes[0]).toMatchObject({ tratamento: 'anexo_iv', anexo: 'IV' })
  })

  test('aplica a SC Cosit 67/2026 à divisão CNAE 33 e separa empreitada de cessão', () => {
    const resultado = analisarCnae(cnae({
      id: '3314707', descricao: 'MANUTENÇÃO E REPARAÇÃO DE MÁQUINAS E APARELHOS DE REFRIGERAÇÃO', secao: 'C', divisao: '33', grupo: '331',
    }))

    expect(resultado).toMatchObject({ natureza: 'servico', tratamento: 'anexo_iii', anexo_indicativo: 'III', confianca: 'alta', conclusivo: true })
    expect(resultado.excecoes).toHaveLength(0)
    expect(resultado.entendimentos).toEqual(expect.arrayContaining([
      expect.objectContaining({ identificacao: 'SC Cosit nº 67/2026', efeito: 'condiciona_enquadramento' }),
      expect.objectContaining({ identificacao: 'SC Cosit nº 67/2026', efeito: 'risco_exclusao' }),
    ]))
  })

  test('traz Anexo III como regra geral para instalação elétrica e Anexo IV como exceção contratual', () => {
    const resultado = analisarCnae(cnae({
      id: '4321500', descricao: 'INSTALAÇÃO E MANUTENÇÃO ELÉTRICA', secao: 'F', divisao: '43', grupo: '432',
    }))
    expect(resultado).toMatchObject({ natureza: 'construcao', tratamento: 'anexo_iii', anexo_indicativo: 'III', conclusivo: true })
    expect(resultado.condicoes.join(' ')).toContain('contrato')
    expect(resultado.excecoes[0]).toMatchObject({ tratamento: 'anexo_iv', anexo: 'IV' })
  })

  test('classifica 4330-4/05 no Anexo III e destaca a exceção de contrato de obra', () => {
    const resultado = analisarCnae(cnae({
      id: '4330405', descricao: 'APLICAÇÃO DE REVESTIMENTOS E DE RESINAS', secao: 'F', divisao: '43', grupo: '433',
    }))
    expect(resultado).toMatchObject({
      tratamento: 'anexo_iii',
      anexo_indicativo: 'III',
      confianca: 'alta',
      conclusivo: true,
    })
    expect(resultado.fontes.some(fonte => fonte.referencia.includes('513/2017'))).toBe(true)
    expect(resultado.excecoes[0].quando).toContain('construir imóvel')
    expect(resultado.entendimentos).toEqual(expect.arrayContaining([
      expect.objectContaining({ identificacao: 'SC Cosit nº 513/2017', efeito: 'confirma_regra' }),
      expect.objectContaining({ identificacao: 'SC Disit/SRRF10 nº 10.014/2024', efeito: 'distingue_receitas' }),
      expect.objectContaining({ identificacao: 'SC Disit/SRRF10 nº 10.014/2024', efeito: 'risco_exclusao' }),
    ]))
  })

  test('traz Anexo III para elevadores e separa obra integrada e cessão de mão de obra', () => {
    const resultado = analisarCnae(cnae({
      id: '4329103', descricao: 'INSTALAÇÃO, MANUTENÇÃO E REPARAÇÃO DE ELEVADORES, ESCADAS E ESTEIRAS ROLANTES', secao: 'F', divisao: '43', grupo: '432',
    }))
    expect(resultado).toMatchObject({ tratamento: 'anexo_iii', anexo_indicativo: 'III', confianca: 'alta', conclusivo: true })
    expect(resultado.excecoes[0]).toMatchObject({ tratamento: 'anexo_iv', anexo: 'IV' })
    expect(resultado.entendimentos).toEqual(expect.arrayContaining([
      expect.objectContaining({ identificacao: 'SD Cosit nº 2/2014 e ADI RFB nº 8/2013', efeito: 'distingue_receitas' }),
      expect.objectContaining({ identificacao: 'SD Cosit nº 2/2014', efeito: 'risco_exclusao' }),
    ]))
  })

  test('condiciona administração de banco de dados ao Fator R sem estender a todo o CNAE 6209-1/00', () => {
    const resultado = analisarCnae(cnae({
      id: '6209100', descricao: 'SUPORTE TÉCNICO, MANUTENÇÃO E OUTROS SERVIÇOS EM TECNOLOGIA DA INFORMAÇÃO', secao: 'J', divisao: '62', grupo: '620',
      atividades: ['administração de banco de dados'],
    }))
    expect(resultado).toMatchObject({ tratamento: 'fator_r', anexo_indicativo: null, confianca: 'alta', conclusivo: false })
    expect(resultado.entendimentos[0]).toMatchObject({ identificacao: 'SC Cosit nº 24/2025', efeito: 'condiciona_enquadramento' })
    expect(resultado.alertas.join(' ')).toContain('não deve ser aplicada automaticamente')
  })

  test('não atribui um anexo único ao CNAE amplo de apoio a edifícios e separa portaria remota de cessão presencial', () => {
    const resultado = analisarCnae(cnae({
      id: '8111700', descricao: 'SERVIÇOS COMBINADOS PARA APOIO A EDIFÍCIOS, EXCETO CONDOMÍNIOS PREDIAIS', secao: 'N', divisao: '81', grupo: '811',
      atividades: ['portaria', 'recepção', 'zeladoria', 'limpeza'],
    }))
    expect(resultado).toMatchObject({ tratamento: 'inconclusivo', anexo_indicativo: null, confianca: 'alta', conclusivo: false })
    expect(resultado.excecoes[0]).toMatchObject({ tratamento: 'anexo_iii', anexo: 'III' })
    expect(resultado.entendimentos).toEqual(expect.arrayContaining([
      expect.objectContaining({ identificacao: 'SC Cosit nº 315/2019, vinculada à SC Cosit nº 551/2017', efeito: 'distingue_receitas' }),
      expect.objectContaining({ identificacao: 'SC Cosit nº 57/2015 e ADI RFB nº 7/2015', efeito: 'risco_exclusao' }),
    ]))
    expect(resultado.explicacao).toContain('pode vedar o Simples')
  })

  test('classifica monitoramento eletrônico de segurança no Anexo IV sem confundir com portaria remota', () => {
    const resultado = analisarCnae(cnae({
      id: '8020001', descricao: 'ATIVIDADES DE MONITORAMENTO DE SISTEMAS DE SEGURANÇA ELETRÔNICO', secao: 'N', divisao: '80', grupo: '802',
    }))
    expect(resultado).toMatchObject({ tratamento: 'anexo_iv', anexo_indicativo: 'IV', confianca: 'alta', conclusivo: true })
    expect(resultado.entendimentos[0]).toMatchObject({ identificacao: 'SC Cosit nº 73/2014', efeito: 'confirma_regra' })
    expect(resultado.alertas.join(' ')).toContain('Portaria virtual')
  })

  test('não estende a regra de portaria virtual a toda atividade de teleatendimento', () => {
    const resultado = analisarCnae(cnae({
      id: '8220200', descricao: 'ATIVIDADES DE TELEATENDIMENTO', secao: 'N', divisao: '82', grupo: '822',
    }))
    expect(resultado).toMatchObject({ tratamento: 'inconclusivo', anexo_indicativo: null, conclusivo: false })
    expect(resultado.entendimentos).toHaveLength(0)
  })

  test('mantém Anexo IV como regra principal para construção de edifícios', () => {
    const resultado = analisarCnae(cnae({
      id: '4120400', descricao: 'CONSTRUÇÃO DE EDIFÍCIOS', secao: 'F', divisao: '41', grupo: '412',
    }))
    expect(resultado).toMatchObject({ tratamento: 'anexo_iv', anexo_indicativo: 'IV', conclusivo: false })
    expect(resultado.excecoes[0]).toMatchObject({ tratamento: 'anexo_iii', anexo: 'III' })
  })

  test('mantém inconclusivo o serviço sem regra segura', () => {
    const resultado = analisarCnae(cnae({
      id: '9609208', descricao: 'HIGIENE E EMBELEZAMENTO DE ANIMAIS DOMÉSTICOS', secao: 'S', divisao: '96', grupo: '960',
    }))
    expect(resultado).toMatchObject({ natureza: 'servico', tratamento: 'inconclusivo', anexo_indicativo: null, conclusivo: false })
  })

  test('não força Anexo III para operador turístico sem validar a receita efetiva', () => {
    const resultado = analisarCnae(cnae({
      id: '7912100', descricao: 'OPERADORES TURÍSTICOS', secao: 'N', divisao: '79', grupo: '791',
    }))
    expect(resultado).toMatchObject({ tratamento: 'inconclusivo', anexo_indicativo: null, conclusivo: false })
  })

  test('não trunca um código informado com mais de sete dígitos', () => {
    expect(normalizarCnae('62015010')).toBe('62015010')
  })
})
