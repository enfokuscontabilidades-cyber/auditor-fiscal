export type NaturezaAtividadeCnae =
  | 'comercio'
  | 'industria'
  | 'servico'
  | 'construcao'
  | 'transporte'
  | 'agropecuaria'
  | 'extracao'
  | 'financeira'
  | 'administracao_publica'
  | 'outros'

export type TratamentoAnexoCnae =
  | 'anexo_i'
  | 'anexo_ii'
  | 'anexo_iii'
  | 'anexo_iv'
  | 'fator_r'
  | 'inconclusivo'

export type NivelConfiancaCnae = 'alta' | 'media' | 'baixa'

export interface CnaeHierarquia {
  secao: { id: string; descricao: string }
  divisao: { id: string; descricao: string }
  grupo: { id: string; descricao: string }
  classe: { id: string; descricao: string }
}

export interface CnaeIbge {
  id: string
  descricao: string
  hierarquia: CnaeHierarquia
  atividades: string[]
  observacoes: string[]
}

export interface FonteLegalCnae {
  titulo: string
  referencia: string
  url: string
}

export type EfeitoEntendimentoCnae =
  | 'confirma_regra'
  | 'condiciona_enquadramento'
  | 'distingue_receitas'
  | 'risco_exclusao'

export interface EntendimentoAdministrativoCnae {
  tipo: 'solucao_consulta_cosit' | 'solucao_consulta_disit' | 'solucao_divergencia' | 'ato_interpretativo'
  identificacao: string
  data_publicacao: string
  efeito: EfeitoEntendimentoCnae
  titulo: string
  resumo: string
  aplicacao: string[]
  fonte: FonteLegalCnae
}

export interface ExcecaoEnquadramentoCnae {
  tratamento: TratamentoAnexoCnae
  anexo: 'I' | 'II' | 'III' | 'IV' | 'V'
  titulo: string
  quando: string
  explicacao: string
  alertas: string[]
  fontes: FonteLegalCnae[]
}

export interface EnquadramentoCnae {
  natureza: NaturezaAtividadeCnae
  tratamento: TratamentoAnexoCnae
  anexo_indicativo: 'I' | 'II' | 'III' | 'IV' | null
  titulo: string
  explicacao: string
  confianca: NivelConfiancaCnae
  conclusivo: boolean
  condicoes: string[]
  alertas: string[]
  fontes: FonteLegalCnae[]
  excecoes: ExcecaoEnquadramentoCnae[]
  entendimentos: EntendimentoAdministrativoCnae[]
  versao_regra: string
}

export interface ResultadoConsultaCnae {
  cnae: CnaeIbge
  enquadramento: EnquadramentoCnae
}

export const FONTES_CNAE = {
  ibge: {
    titulo: 'CONCLA/IBGE — CNAE-Subclasses',
    referencia: 'CNAE-Subclasses 2.3',
    url: 'https://concla.ibge.gov.br/busca-online-cnae.html',
  },
  lc123: {
    titulo: 'Lei Complementar nº 123/2006',
    referencia: 'Art. 18 e Anexos I a V',
    url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm',
  },
  resolucao140: {
    titulo: 'Resolução CGSN nº 140/2018',
    referencia: 'Arts. 25 e 26 — segregação de receitas e Fator R',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278',
  },
  ripi: {
    titulo: 'Decreto nº 7.212/2010 — RIPI',
    referencia: 'Art. 5º, I e II — preparo de alimentos em restaurantes, bares e similares',
    url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7212.htm',
  },
  perguntao: {
    titulo: 'Perguntas e Respostas do Simples Nacional',
    referencia: 'Item 5.11 — Fator R',
    url: 'https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/PerguntaoSN.pdf',
  },
  cosit252: {
    titulo: 'Solução de Consulta Cosit nº 252/2017',
    referencia: 'SC Cosit 252/2017 — instalações vinculadas ou não à obra',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=44045',
  },
  cosit513: {
    titulo: 'Solução de Consulta Cosit nº 513/2017',
    referencia: 'SC Cosit 513/2017 — preparação de piso e revestimento',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=46072',
  },
  cosit243: {
    titulo: 'Solução de Consulta Cosit nº 243/2025',
    referencia: 'SC Cosit 243/2025 — projetos de design de interiores',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=DESIGN+DE+INTERIORES',
  },
  sd33: {
    titulo: 'Solução de Divergência Cosit nº 33/2013',
    referencia: 'SD Cosit 33/2013 — pintura predial nos Anexos III e IV',
    url: 'https://pesquisa.in.gov.br/imprensa/servlet/INPDFViewer?captchafield=firstAccess&data=23%2F12%2F2013&jornal=1&pagina=50',
  },
  cosit167: {
    titulo: 'Solução de Consulta Cosit nº 167/2014',
    referencia: 'SC Cosit 167/2014 — climatização nos Anexos III e IV',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=31670',
  },
  cosit169: {
    titulo: 'Solução de Consulta Cosit nº 169/2014',
    referencia: 'SC Cosit 169/2014 — climatização e cessão de mão de obra',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=31408',
  },
  cosit47: {
    titulo: 'Solução de Consulta Cosit nº 47/2018',
    referencia: 'SC Cosit 47/2018 — manutenção de refrigeração e cessão',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=47938',
  },
  cosit18: {
    titulo: 'Solução de Consulta Cosit nº 18/2014',
    referencia: 'SC Cosit 18/2014 — coleta de resíduos não perigosos',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=34491',
  },
  adi8: {
    titulo: 'Ato Declaratório Interpretativo RFB nº 8/2013',
    referencia: 'ADI RFB 8/2013 — instalações prediais nos Anexos III e IV',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ATO+DECLARATORIO+INTERPRETATIVO+RFB+N+8+30+DEZEMBRO+2013',
  },
  cosit25: {
    titulo: 'Solução de Consulta Cosit nº 25/2026',
    referencia: 'SC Cosit 25/2026 — instalações elétricas e contra incêndio',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=INSTALACAO+MANUTENCAO+REPARACAO+ELETRICA+SISTEMAS+CONTRA+INCENDIO',
  },
  cosit201: {
    titulo: 'Solução de Consulta Cosit nº 201/2015',
    referencia: 'SC Cosit 201/2015 — acabamento em gesso e estuque',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=37749',
  },
  cosit67: {
    titulo: 'Solução de Consulta Cosit nº 67/2026',
    referencia: 'SC Cosit 67/2026 — manutenção de equipamentos e cessão',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=SERVICOS+DE+MANUTENCAO+PREVENTIVA+E+CORRETIVA+DE+EQUIPAMENTOS',
  },
  disit10014: {
    titulo: 'Solução de Consulta Disit/SRRF10 nº 10.014/2024',
    referencia: 'SC Disit 10.014/2024 — revestimento epóxi, obra e cessão',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=construcao',
  },
  sd2: {
    titulo: 'Solução de Divergência Cosit nº 2/2014',
    referencia: 'SD Cosit 2/2014 — elevadores, escadas e esteiras rolantes',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=ELEVADORES+ESCADAS+ESTEIRAS+ROLANTES',
  },
  cosit65: {
    titulo: 'Solução de Consulta Cosit nº 65/2025',
    referencia: 'SC Cosit 65/2025 — perícia, auditoria e consultoria contábil',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=78489',
  },
  cosit24: {
    titulo: 'Solução de Consulta Cosit nº 24/2025',
    referencia: 'SC Cosit 24/2025 — administração de banco de dados e Fator R',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=78278',
  },
  cosit57: {
    titulo: 'Solução de Consulta Cosit nº 57/2015',
    referencia: 'SC Cosit 57/2015 — portaria, zeladoria e cessão de mão de obra',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=35392',
  },
  adi7portaria: {
    titulo: 'Ato Declaratório Interpretativo RFB nº 7/2015',
    referencia: 'ADI RFB 7/2015 — portaria mediante cessão de mão de obra',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/consulta.action?termoBusca=PORTARIA+CESSAO+MAO+DE+OBRA',
  },
  cosit315: {
    titulo: 'Solução de Consulta Cosit nº 315/2019',
    referencia: 'SC Cosit 315/2019 — portaria virtual ou remota no Anexo III',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=54986',
  },
  cosit73: {
    titulo: 'Solução de Consulta Cosit nº 73/2014',
    referencia: 'SC Cosit 73/2014 — monitoramento eletrônico de segurança no Anexo IV',
    url: 'https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=34468',
  },
} satisfies Record<string, FonteLegalCnae>

const VERSAO_REGRA = 'SN-CNAE-2026.08.1'

const CNAES_ANEXO_IV_EXATOS = new Set([
  '6911701', // serviços advocatícios
  '8011101', // vigilância e segurança privada
  '8011102', // adestramento de cães de guarda
  '8121400', // limpeza em prédios e domicílios
  '8122200', // imunização e controle de pragas urbanas
])

const CNAES_ANEXO_III_EXATOS = new Set([
  '6821802', // corretagem no aluguel de imóveis
  '7911200', // agências de viagens
])

const CNAES_FATOR_R_EXATOS = new Set([
  '8591100', // ensino de esportes
  '9313100', // atividades de condicionamento físico
  '6822600', // gestão e administração da propriedade imobiliária
  '7410203', // design de produto
  '4512901', // representantes e agentes do comércio de veículos
  '4530706', // representantes e agentes do comércio de autopeças
  '4542101', // representantes e agentes do comércio de motocicletas e peças
])

const CNAES_COMERCIO_AUTOMOTIVO = new Set([
  '4511101', '4511102', '4511103', '4511104', '4511105', '4511106',
  '4530701', '4530702', '4530703', '4530704', '4530705',
  '4541201', '4541202', '4541203', '4541204', '4541205', '4541206', '4541207',
])

const CNAES_CONSIGNACAO_AUTOMOTIVA = new Set(['4512902', '4542102'])

const CNAES_CONSTRUCAO_ANEXO_III_EXATOS = new Set([
  '4321500', // instalação e manutenção elétrica
  '4322301', // instalações hidráulicas, sanitárias e de gás
  '4322303', // instalações de sistema de prevenção contra incêndio
  '4330404', // serviços de pintura de edifícios em geral
])

const CNAES_INSTALACOES_PREDIAIS_ESPECIFICOS = new Set([
  '4321500', // instalação e manutenção elétrica
  '4322301', // instalações hidráulicas, sanitárias e de gás
  '4322303', // instalações de sistema de prevenção contra incêndio
])

const PREFIXOS_FATOR_R = [
  '461',    // representação comercial e intermediação de negócios
  '620',    // desenvolvimento/licenciamento de software
  '702',    // consultoria em gestão empresarial
  '711',    // arquitetura, engenharia e atividades técnicas relacionadas
  '721',    // pesquisa e desenvolvimento em ciências físicas e naturais
  '722',    // pesquisa e desenvolvimento em ciências sociais e humanas
  '731',    // publicidade
  '741',    // design
  '742',    // fotografia
  '749',    // outras atividades profissionais, científicas e técnicas
  '750',    // atividades veterinárias
  '861', '862', '863', '864', '865', '866', '869', // saúde humana
]

const SECOES_SERVICOS = new Set(['I', 'J', 'L', 'M', 'N', 'P', 'Q', 'R', 'S'])

function baseEnquadramento(
  natureza: NaturezaAtividadeCnae,
  tratamento: TratamentoAnexoCnae,
  anexo: EnquadramentoCnae['anexo_indicativo'],
  titulo: string,
  explicacao: string,
  confianca: NivelConfiancaCnae,
  conclusivo: boolean,
  condicoes: string[] = [],
  alertas: string[] = [],
): EnquadramentoCnae {
  return {
    natureza,
    tratamento,
    anexo_indicativo: anexo,
    titulo,
    explicacao,
    confianca,
    conclusivo,
    condicoes,
    alertas,
    fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140],
    excecoes: [],
    entendimentos: [],
    versao_regra: VERSAO_REGRA,
  }
}

function excecaoContratoDeObra(): ExcecaoEnquadramentoCnae {
  return {
    tratamento: 'anexo_iv',
    anexo: 'IV',
    titulo: 'Exceção: execução vinculada a contrato de obra',
    quando: 'Quando a própria empresa for contratada para construir imóvel ou executar obra de engenharia e o serviço fizer parte desse contrato.',
    explicacao: 'Nessa hipótese, a receita do serviço acompanha a execução da obra e é tributada pelo Anexo IV.',
    alertas: [
      'Ser contratada por uma construtora ou trabalhar no local de uma obra, isoladamente, não transforma o serviço em Anexo IV.',
      'Verifique o objeto e o escopo assumidos pela empresa no contrato, e não apenas o CNAE ou o local da prestação.',
      'No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS.',
    ],
    fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit252],
  }
}

function descricaoNormalizada(cnae: CnaeIbge): string {
  return `${cnae.descricao} ${cnae.atividades.join(' ')}`.toLocaleUpperCase('pt-BR')
}

/**
 * Classificação indicativa e conservadora. CNAE identifica a atividade cadastral;
 * o anexo definitivo depende da receita efetivamente auferida e, em alguns casos,
 * do contrato, do código do serviço e do Fator R.
 */
export function analisarCnae(cnae: CnaeIbge): EnquadramentoCnae {
  const codigo = normalizarCnae(cnae.id)
  const secao = cnae.hierarquia.secao.id.toUpperCase()
  const divisao = cnae.hierarquia.divisao.id
  const texto = descricaoNormalizada(cnae)

  if (codigo === '6821801') {
    return baseEnquadramento(
      'servico', 'anexo_iii', 'III', 'Regra principal: corretagem de imóveis no Anexo III',
      'A receita de intermediação na compra e venda de imóveis de terceiros é tributada pelo Anexo III. O mesmo CNAE também abrange avaliação de imóveis, cuja receita deve ser segregada e submetida ao Fator R.',
      'alta', false,
      [
        'Corretagem na compra e venda de imóveis de terceiros: Anexo III.',
        'Avaliação de imóveis: Anexo III quando o Fator R for igual ou superior a 28%, ou Anexo V quando for inferior.',
        'Segregar as receitas quando a empresa prestar as duas atividades.',
      ],
      ['A denominação deste CNAE reúne atividades com tratamentos distintos; confirme o serviço descrito na NFS-e.'],
    )
  }

  if (codigo === '7410202') {
    const entendimento: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 243/2025',
      data_publicacao: '2025-11-28',
      efeito: 'distingue_receitas',
      titulo: 'Projetos de design de interiores estão sujeitos ao Fator R',
      resumo: 'A Receita Federal enquadrou a receita de desenvolvimento de projetos de design de interiores no Anexo III ou V, conforme o Fator R.',
      aplicacao: [
        'Aplicar à receita decorrente do desenvolvimento de projeto de design de interiores.',
        'Não estender automaticamente o entendimento à execução material de decoração de interiores.',
      ],
      fonte: FONTES_CNAE.cosit243,
    }

    return {
      ...baseEnquadramento(
        'servico', 'fator_r', null, 'Regra principal: projetos sujeitos ao Fator R',
        'Para receitas de desenvolvimento de projetos de design de interiores, aplica-se o Anexo III quando o Fator R for igual ou superior a 28%, ou o Anexo V quando for inferior.',
        'alta', false,
        [
          'Confirmar que a receita corresponde ao desenvolvimento do projeto de design de interiores.',
          'Fator R igual ou superior a 28%: Anexo III.',
          'Fator R inferior a 28%: Anexo V.',
          'Separar eventual receita de execução material da decoração e de venda de mercadorias.',
        ],
        ['O CNAE possui descritores amplos; a descrição da NFS-e e o objeto do contrato devem identificar a receita efetivamente prestada.'],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit243],
      entendimentos: [entendimento],
      excecoes: [{
        tratamento: 'anexo_iv',
        anexo: 'IV',
        titulo: 'Tratamento distinto: execução de decoração de interiores',
        quando: 'Quando a receita não decorrer apenas do desenvolvimento do projeto, mas da execução efetiva da decoração de interiores.',
        explicacao: 'A execução de decoração de interiores está entre os serviços tributados pelo Anexo IV. É necessário distinguir o projeto intelectual da execução material contratada.',
        alertas: [
          'A denominação do CNAE, isoladamente, não resolve a segregação da receita.',
          'No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS.',
        ],
        fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit243],
      }],
    }
  }

  if (codigo === '4330405') {
    const confirmacao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 513/2017',
      data_publicacao: '2017-11-01',
      efeito: 'confirma_regra',
      titulo: 'Preparação de piso e aplicação de revestimento no Anexo III',
      resumo: 'A preparação de piso e a aplicação de revestimentos, quando contratadas como serviços específicos, são tributadas pelo Anexo III.',
      aplicacao: [
        'Aplicar à receita do serviço específico de preparação de piso ou aplicação de revestimento.',
        'Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia.',
      ],
      fonte: FONTES_CNAE.cosit513,
    }
    const distincaoAnexo: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_disit',
      identificacao: 'SC Disit/SRRF10 nº 10.014/2024',
      data_publicacao: '2024-12-18',
      efeito: 'distingue_receitas',
      titulo: 'Revestimento específico e revestimento integrante da obra têm anexos diferentes',
      resumo: 'A aplicação de revestimento epóxi em piso permanece no Anexo III como serviço específico; quando integra contrato assumido pela própria empresa para construir imóvel ou executar obra de engenharia, acompanha a obra no Anexo IV.',
      aplicacao: [
        'Aplicação de revestimento contratada como serviço específico: Anexo III.',
        'Aplicação que integra contrato da própria empresa para construir imóvel ou executar obra de engenharia: Anexo IV.',
      ],
      fonte: FONTES_CNAE.disit10014,
    }
    const riscoExclusao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_disit',
      identificacao: 'SC Disit/SRRF10 nº 10.014/2024',
      data_publicacao: '2024-12-18',
      efeito: 'risco_exclusao',
      titulo: 'Cessão ou locação de mão de obra pode excluir a empresa do Simples',
      resumo: 'A prestação do serviço do Anexo III mediante cessão ou locação de mão de obra constitui vedação ao Simples Nacional e pode causar a exclusão da empresa, em vez de simples mudança de anexo.',
      aplicacao: [
        'Verificar se trabalhadores são colocados à disposição do contratante para atender necessidade contínua.',
        'Não confundir a empreitada do serviço específico com cessão de mão de obra.',
      ],
      fonte: FONTES_CNAE.disit10014,
    }

    return {
      ...baseEnquadramento(
        'construcao', 'anexo_iii', 'III', 'Regra principal: revestimento no Anexo III',
        'A preparação de piso e a aplicação de revestimentos ou resinas, quando contratadas como serviço específico, são tributadas pelo Anexo III.',
        'alta', true,
        [
          'Confirmar que o objeto do contrato é a preparação do piso ou a aplicação do revestimento.',
          'Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia.',
        ],
        ['Se houver cessão ou locação de mão de obra, avaliar risco de exclusão do Simples Nacional; não se trata apenas de escolher outro anexo.'],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit513, FONTES_CNAE.disit10014],
      entendimentos: [confirmacao, distincaoAnexo, riscoExclusao],
      excecoes: [{
        ...excecaoContratoDeObra(),
        fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.disit10014],
      }],
    }
  }

  if (codigo === '4329103') {
    const distincaoAnexo: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_divergencia',
      identificacao: 'SD Cosit nº 2/2014 e ADI RFB nº 8/2013',
      data_publicacao: '2014-02-25',
      efeito: 'distingue_receitas',
      titulo: 'Elevadores contratados isoladamente e integrados à obra têm anexos diferentes',
      resumo: 'A instalação, manutenção e reparação de elevadores, escadas e esteiras rolantes são tributadas pelo Anexo III, inclusive por empreitada; se integrarem contrato assumido de construção ou obra de engenharia, acompanham a obra no Anexo IV.',
      aplicacao: [
        'Instalação, manutenção ou reparação contratada como serviço específico, inclusive por empreitada: Anexo III.',
        'Serviço que integra contrato da própria empresa para construir imóvel ou executar obra de engenharia: Anexo IV.',
      ],
      fonte: FONTES_CNAE.sd2,
    }
    const riscoExclusao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_divergencia',
      identificacao: 'SD Cosit nº 2/2014',
      data_publicacao: '2014-02-25',
      efeito: 'risco_exclusao',
      titulo: 'Cessão ou locação de mão de obra é vedada nessa prestação do Anexo III',
      resumo: 'Quando o serviço for prestado mediante cessão ou locação de mão de obra, a atividade é vedada ao Simples Nacional; a consequência não é a simples troca para o Anexo IV.',
      aplicacao: [
        'Verificar se a contratada entrega o resultado do serviço ou apenas disponibiliza trabalhadores.',
        'A execução por empreitada, por si só, não caracteriza cessão de mão de obra.',
      ],
      fonte: FONTES_CNAE.sd2,
    }

    return {
      ...baseEnquadramento(
        'construcao', 'anexo_iii', 'III', 'Regra principal: elevadores e equipamentos similares no Anexo III',
        'A instalação, manutenção e reparação de elevadores, escadas e esteiras rolantes, quando contratadas como serviço específico, são tributadas pelo Anexo III, inclusive por empreitada.',
        'alta', true,
        [
          'Confirmar que a empresa foi contratada para executar o serviço específico.',
          'Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia.',
        ],
        ['Se houver cessão ou locação de mão de obra, avaliar vedação ou exclusão do Simples Nacional.'],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.adi8, FONTES_CNAE.sd2],
      entendimentos: [distincaoAnexo, riscoExclusao],
      excecoes: [{
        ...excecaoContratoDeObra(),
        fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.adi8, FONTES_CNAE.sd2],
      }],
    }
  }

  if (codigo === '6920601' || codigo === '6920602') {
    const entendimento: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 65/2025',
      data_publicacao: '2025-03-31',
      efeito: 'condiciona_enquadramento',
      titulo: 'Perícia, auditoria e consultoria contábil permanecem no Anexo III quando forem atribuições profissionais',
      resumo: 'As receitas de perícia, auditoria e consultoria contábil auferidas por escritório contábil optante e registrado no Conselho de Contabilidade são tributadas pelo Anexo III quando estiverem no rol das atribuições dos profissionais da contabilidade.',
      aplicacao: [
        'Confirmar que o prestador é escritório contábil devidamente registrado no Conselho Regional de Contabilidade.',
        'Confirmar que o serviço está entre as atribuições legalmente reservadas ou reconhecidas aos profissionais da contabilidade.',
        'Não estender o tratamento a consultorias, perícias ou auditorias estranhas à profissão contábil.',
      ],
      fonte: FONTES_CNAE.cosit65,
    }

    return {
      ...baseEnquadramento(
        'servico', 'anexo_iii', 'III', 'Regra principal: serviços contábeis no Anexo III',
        'As receitas próprias de escritório contábil, inclusive perícia, auditoria e consultoria contábil compreendidas nas atribuições da profissão, são tributadas pelo Anexo III sem submissão ao Fator R.',
        'alta', false,
        [
          'Confirmar o registro regular do escritório no Conselho Regional de Contabilidade.',
          'Confirmar que a receita decorre de serviço incluído nas atribuições dos profissionais da contabilidade.',
        ],
        ['Serviços de consultoria, perícia ou auditoria que não sejam contábeis devem ser segregados e analisados por sua natureza própria, inclusive quanto ao Fator R.'],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit65],
      entendimentos: [entendimento],
    }
  }

  if (codigo === '6209100') {
    const entendimento: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 24/2025',
      data_publicacao: '2025-03-11',
      efeito: 'condiciona_enquadramento',
      titulo: 'Administração de banco de dados está sujeita ao Fator R',
      resumo: 'A Receita Federal qualificou a administração de banco de dados como atividade intelectual de natureza técnica, tributada pelo Anexo III quando o Fator R for igual ou superior a 28% e pelo Anexo V quando for inferior.',
      aplicacao: [
        'Aplicar apenas à receita efetiva de administração de banco de dados.',
        'Fator R igual ou superior a 28%: Anexo III.',
        'Fator R inferior a 28%: Anexo V.',
        'Segregar outras receitas abrangidas pelo CNAE amplo 6209-1/00 e analisá-las conforme o serviço efetivamente prestado.',
      ],
      fonte: FONTES_CNAE.cosit24,
    }

    return {
      ...baseEnquadramento(
        'servico', 'fator_r', null, 'Regra principal: administração de banco de dados sujeita ao Fator R',
        'A receita de administração de banco de dados é tributada pelo Anexo III quando o Fator R for igual ou superior a 28%, ou pelo Anexo V quando for inferior.',
        'alta', false,
        [
          'Confirmar que a receita consultada corresponde efetivamente à administração de banco de dados.',
          'Fator R igual ou superior a 28%: Anexo III.',
          'Fator R inferior a 28%: Anexo V.',
        ],
        ['O CNAE 6209-1/00 abrange outros serviços de tecnologia da informação; a SC Cosit nº 24/2025 não deve ser aplicada automaticamente a todas essas receitas.'],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit24],
      entendimentos: [entendimento],
    }
  }

  if (codigo === '8111700') {
    const portariaRemota: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 315/2019, vinculada à SC Cosit nº 551/2017',
      data_publicacao: '2019-12-20',
      efeito: 'distingue_receitas',
      titulo: 'Portaria virtual limitada ao controle de acesso pode ser tributada pelo Anexo III',
      resumo: 'A portaria virtual ou remota é permitida no Simples e tributada pelo Anexo III quando o porteiro trabalha nas dependências da prestadora, controlando apenas a entrada de moradores e visitantes por monitores e interfone, sem exercer vigilância.',
      aplicacao: [
        'O porteiro remoto deve trabalhar nas dependências da empresa prestadora.',
        'A atividade deve se limitar ao controle e à liberação de acesso de moradores, visitantes e prestadores.',
        'Não pode haver colocação de trabalhadores à disposição do cliente nem finalidade de vigilância ou prevenção de delitos.',
      ],
      fonte: FONTES_CNAE.cosit315,
    }
    const riscoExclusao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 57/2015 e ADI RFB nº 7/2015',
      data_publicacao: '2015-06-11',
      efeito: 'risco_exclusao',
      titulo: 'Portaria ou zeladoria presencial mediante cessão de mão de obra é vedada ao Simples',
      resumo: 'Portaria e zeladoria não se confundem com vigilância, limpeza ou conservação. Quando prestadas mediante cessão ou locação de mão de obra, não recebem o permissivo do Anexo IV e podem impedir a opção ou permanência no Simples Nacional.',
      aplicacao: [
        'Verificar se empregados permanecem nas dependências do contratante ou de terceiros por ele indicados.',
        'Verificar se os trabalhadores são colocados à disposição para serviços contínuos de portaria, recepção ou zeladoria.',
        'Não reclassificar a atividade para o Anexo IV apenas para tentar afastar a vedação.',
      ],
      fonte: FONTES_CNAE.cosit57,
    }

    return {
      ...baseEnquadramento(
        'servico', 'inconclusivo', null, 'Sem anexo único: identificar os serviços efetivamente combinados',
        'O CNAE 8111-7/00 é amplo e não define sozinho o tratamento. Portaria virtual limitada ao controle de acesso pode ser tributada pelo Anexo III; portaria ou zeladoria presencial mediante cessão de mão de obra pode vedar o Simples; limpeza, conservação e vigilância possuem tratamentos próprios.',
        'alta', false,
        [
          'Identificar separadamente cada serviço contratado e faturado: portaria, recepção, zeladoria, limpeza, conservação, manutenção ou vigilância.',
          'Confirmar onde os empregados trabalham, quem organiza as tarefas e se permanecem à disposição do contratante.',
          'Confirmar se eventual operação remota se limita ao controle de acesso ou também realiza monitoramento de segurança.',
        ],
        [
          'O CNAE ou o nome genérico de facilities não permite escolher um único anexo para todas as receitas.',
          'Monitoramento eletrônico de sistemas de segurança é serviço de vigilância no Anexo IV, e não portaria virtual do Anexo III.',
        ],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit57, FONTES_CNAE.adi7portaria, FONTES_CNAE.cosit315, FONTES_CNAE.cosit73],
      entendimentos: [portariaRemota, riscoExclusao],
      excecoes: [{
        tratamento: 'anexo_iii',
        anexo: 'III',
        titulo: 'Hipótese permitida: portaria virtual ou remota',
        quando: 'Quando o porteiro trabalha na sede da prestadora e se limita a controlar e liberar o acesso de moradores e visitantes por monitores e interfone.',
        explicacao: 'Atendidos esses fatos e sem atividade de vigilância ou cessão de mão de obra, a receita é permitida no Simples e tributada pelo Anexo III.',
        alertas: [
          'Se houver monitoramento de alarmes, ronda virtual, prevenção de delitos ou resposta de segurança, analisar o tratamento de vigilância no Anexo IV.',
          'A Receita Federal não define o CNAE correto no processo de consulta; a conclusão depende da atividade efetivamente prestada.',
        ],
        fontes: [FONTES_CNAE.lc123, FONTES_CNAE.cosit315],
      }],
    }
  }

  if (codigo === '8020001') {
    const entendimento: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 73/2014',
      data_publicacao: '2014-05-06',
      efeito: 'confirma_regra',
      titulo: 'Monitoramento eletrônico de sistemas de segurança é serviço de vigilância',
      resumo: 'Para o Simples Nacional, o monitoramento eletrônico de sistemas de segurança, inclusive alarmes, constitui serviço de vigilância e é tributado pelo Anexo IV.',
      aplicacao: [
        'Aplicar à receita efetiva de monitoramento de sistemas de segurança eletrônico.',
        'Separar venda, instalação ou manutenção de equipamentos quando forem contratadas de forma autônoma do monitoramento.',
        'Não confundir monitoramento de segurança com portaria remota limitada à recepção e ao controle de acesso.',
      ],
      fonte: FONTES_CNAE.cosit73,
    }

    return {
      ...baseEnquadramento(
        'servico', 'anexo_iv', 'IV', 'Regra principal: monitoramento de segurança no Anexo IV',
        'A receita de monitoramento eletrônico de sistemas de segurança é tratada como serviço de vigilância e tributada pelo Anexo IV.',
        'alta', true,
        [
          'Confirmar que a receita decorre do monitoramento de alarmes, imagens ou outros sistemas com finalidade de segurança.',
          'Segregar venda, instalação e manutenção de equipamentos contratadas separadamente do serviço de monitoramento.',
        ],
        [
          'No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS.',
          'Portaria virtual limitada ao controle de acesso, operada da sede da prestadora e sem finalidade de vigilância, possui tratamento distinto no Anexo III.',
        ],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit73, FONTES_CNAE.cosit315],
      entendimentos: [entendimento],
    }
  }

  if (CNAES_INSTALACOES_PREDIAIS_ESPECIFICOS.has(codigo)) {
    const atividade = codigo === '4321500'
      ? 'instalação, manutenção e reparação elétrica'
      : codigo === '4322301'
        ? 'instalação, manutenção e reparação hidráulica, sanitária e de gás'
        : 'instalação, manutenção e reparação de sistemas contra incêndio'
    const distincaoAnexo: EntendimentoAdministrativoCnae = {
      tipo: 'ato_interpretativo',
      identificacao: 'ADI RFB nº 8/2013 e SD Cosit nº 36/2013',
      data_publicacao: '2014-01-02',
      efeito: 'distingue_receitas',
      titulo: 'Serviço específico e serviço integrante da obra têm anexos diferentes',
      resumo: `Os serviços de ${atividade} são tributados pelo Anexo III quando contratados de forma específica, inclusive por empreitada; quando integram contrato da própria empresa para construir imóvel ou executar obra de engenharia, acompanham a obra no Anexo IV.`,
      aplicacao: [
        'Serviço específico de instalação, manutenção ou reparação, ainda que por empreitada: Anexo III.',
        'Serviço que integra contrato da própria empresa para construir imóvel ou executar obra de engenharia: Anexo IV.',
      ],
      fonte: FONTES_CNAE.adi8,
    }
    const riscoExclusao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 25/2026',
      data_publicacao: '2026-03-04',
      efeito: 'risco_exclusao',
      titulo: 'Cessão ou locação de mão de obra não equivale a empreitada',
      resumo: 'Na prestação enquadrada no Anexo III, a cessão ou locação de mão de obra pode sujeitar a empresa à exclusão do Simples Nacional. A empreitada do serviço específico, por si só, não provoca essa consequência.',
      aplicacao: [
        'Verificar se os trabalhadores permanecem à disposição do contratante para atender necessidade contínua.',
        'Não presumir cessão de mão de obra apenas porque o serviço é executado no estabelecimento do cliente ou por empreitada.',
      ],
      fonte: FONTES_CNAE.cosit25,
    }

    return {
      ...baseEnquadramento(
        'construcao', 'anexo_iii', 'III', 'Regra principal: serviço específico no Anexo III',
        `A ${atividade}, quando contratada como serviço específico, é tributada pelo Anexo III, ainda que executada mediante empreitada.`,
        'alta', true,
        [
          'Confirmar que o objeto do contrato é o serviço específico de instalação, manutenção ou reparação.',
          'Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia.',
        ],
        ['Se houver cessão ou locação de mão de obra, avaliar risco de exclusão do Simples Nacional; não se trata apenas de escolher outro anexo.'],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.adi8, FONTES_CNAE.cosit25],
      entendimentos: [distincaoAnexo, riscoExclusao],
      excecoes: [{
        ...excecaoContratoDeObra(),
        fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.adi8],
      }],
    }
  }

  if (codigo === '4330403') {
    const entendimento: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 201/2015',
      data_publicacao: '2015-09-30',
      efeito: 'distingue_receitas',
      titulo: 'Acabamento em gesso isolado e integrado à obra têm anexos diferentes',
      resumo: 'As atividades de acabamento em gesso e estuque são tributadas pelo Anexo III quando contratadas separadamente; se fizerem parte de contrato assumido de construção de imóvel ou obra de engenharia, acompanham a obra no Anexo IV.',
      aplicacao: [
        'Acabamento em gesso ou estuque contratado como serviço específico: Anexo III.',
        'Atividade incluída no contrato da própria empresa para construir imóvel ou executar obra de engenharia: Anexo IV.',
      ],
      fonte: FONTES_CNAE.cosit201,
    }

    return {
      ...baseEnquadramento(
        'construcao', 'anexo_iii', 'III', 'Regra principal: acabamento em gesso no Anexo III',
        'O acabamento em gesso e estuque contratado como serviço próprio e separado da execução integral da obra é tributado pelo Anexo III.',
        'alta', true,
        [
          'Confirmar que o contrato tem por objeto o acabamento em gesso ou estuque.',
          'Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia.',
        ],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit201],
      entendimentos: [entendimento],
      excecoes: [{
        ...excecaoContratoDeObra(),
        fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit201],
      }],
    }
  }

  if (codigo === '4330404') {
    const distincaoAnexo: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_divergencia',
      identificacao: 'SD Cosit nº 33/2013',
      data_publicacao: '2013-12-23',
      efeito: 'distingue_receitas',
      titulo: 'Pintura isolada e pintura integrada à obra possuem tratamentos diferentes',
      resumo: 'A Receita Federal consolidou o Anexo III para pintura predial contratada isoladamente e o Anexo IV quando a pintura integrar contrato assumido de construção, obra, paisagismo ou decoração de interiores.',
      aplicacao: [
        'Pintura predial contratada como serviço isolado, inclusive por empreitada: Anexo III.',
        'Pintura que integra contrato de construção, obra, paisagismo ou decoração de interiores: Anexo IV.',
      ],
      fonte: FONTES_CNAE.sd33,
    }
    const riscoExclusao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_divergencia',
      identificacao: 'SD Cosit nº 33/2013',
      data_publicacao: '2013-12-23',
      efeito: 'risco_exclusao',
      titulo: 'Cessão de mão de obra pode impedir a permanência no Simples',
      resumo: 'Se o serviço do Anexo III for executado mediante cessão ou locação de mão de obra, a consequência pode ser a vedação ou exclusão do Simples Nacional, e não a simples mudança para o Anexo IV.',
      aplicacao: [
        'Verificar se trabalhadores foram colocados à disposição do contratante para serviço contínuo.',
        'Não confundir empreitada do serviço de pintura, admitida no entendimento, com cessão de mão de obra.',
      ],
      fonte: FONTES_CNAE.sd33,
    }

    return {
      ...baseEnquadramento(
        'construcao', 'anexo_iii', 'III', 'Regra principal: pintura isolada no Anexo III',
        'A pintura predial contratada como serviço próprio e isolado é tributada pelo Anexo III, ainda que executada por empreitada.',
        'alta', true,
        [
          'Confirmar que o objeto contratado é especificamente o serviço de pintura.',
          'Confirmar que a empresa não assumiu a construção, a obra de engenharia, o paisagismo ou a decoração de interiores.',
        ],
        ['Se houver cessão ou locação de mão de obra, verificar possível vedação ou exclusão do Simples Nacional; não se trata apenas de trocar o anexo.'],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.sd33],
      entendimentos: [distincaoAnexo, riscoExclusao],
      excecoes: [{
        tratamento: 'anexo_iv',
        anexo: 'IV',
        titulo: 'Exceção: pintura integrada a contrato de obra ou projeto',
        quando: 'Quando a empresa for contratada para construir imóvel, executar obra de engenharia ou projeto de paisagismo ou decoração de interiores e a pintura fizer parte desse contrato.',
        explicacao: 'Nessa hipótese, a receita da pintura acompanha o contrato principal e é tributada pelo Anexo IV.',
        alertas: ['No Anexo IV, a contribuição patronal previdenciária não está incluída no DAS.'],
        fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.sd33],
      }],
    }
  }

  if (codigo === '4322302') {
    const distincaoAnexo: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 167/2014',
      data_publicacao: '2014-06-25',
      efeito: 'distingue_receitas',
      titulo: 'Climatização isolada e serviço integrante da obra têm anexos diferentes',
      resumo: 'A instalação e a manutenção de aparelhos e sistemas de climatização são tributadas pelo Anexo III quando contratadas como serviço próprio; se integrarem contrato assumido de construção ou obra de engenharia, acompanham a obra no Anexo IV.',
      aplicacao: [
        'Serviço específico de instalação ou manutenção de climatização: Anexo III.',
        'Serviço que integra contrato da própria empresa para construir imóvel ou executar obra de engenharia: Anexo IV.',
      ],
      fonte: FONTES_CNAE.cosit167,
    }
    const riscoExclusao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 169/2014 e nº 47/2018',
      data_publicacao: '2018-04-03',
      efeito: 'risco_exclusao',
      titulo: 'Cessão ou locação de mão de obra pode excluir a empresa do Simples',
      resumo: 'Nas receitas tratadas pelo Anexo III, a prestação mediante cessão ou locação de mão de obra pode vedar a opção ou causar a exclusão do Simples Nacional.',
      aplicacao: [
        'Examinar se há trabalhadores à disposição do contratante para atender necessidade contínua.',
        'Visitas para executar tarefas específicas, sob organização da contratada, não devem ser tratadas automaticamente como cessão de mão de obra.',
      ],
      fonte: FONTES_CNAE.cosit47,
    }

    return {
      ...baseEnquadramento(
        'construcao', 'anexo_iii', 'III', 'Regra principal: climatização no Anexo III',
        'A instalação, manutenção e reparação de sistemas centrais de ar-condicionado, ventilação e refrigeração, quando contratadas como serviço específico, são tributadas pelo Anexo III.',
        'alta', true,
        [
          'Confirmar que o objeto contratado é o serviço específico de instalação ou manutenção do sistema.',
          'Confirmar que a própria empresa não assumiu a construção do imóvel ou a execução da obra de engenharia.',
        ],
        ['Se houver cessão ou locação de mão de obra, avaliar risco de vedação ou exclusão do Simples Nacional; não se trata apenas de escolher outro anexo.'],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit167, FONTES_CNAE.cosit169, FONTES_CNAE.cosit47],
      entendimentos: [distincaoAnexo, riscoExclusao],
      excecoes: [{
        ...excecaoContratoDeObra(),
        fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit167],
      }],
    }
  }

  if (codigo === '3811400') {
    const confirmacao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 18/2014',
      data_publicacao: '2014-04-09',
      efeito: 'confirma_regra',
      titulo: 'Coleta de resíduos não perigosos não se confunde com limpeza',
      resumo: 'A mera coleta e o transporte de resíduos não perigosos são tributados pelo Anexo III, pois não se enquadram como serviço de limpeza do Anexo IV.',
      aplicacao: [
        'Aplicar à receita de coleta e transporte de resíduos não perigosos do CNAE 3811-4/00.',
        'Segregar serviços de limpeza efetivamente prestados, pois possuem tratamento próprio.',
      ],
      fonte: FONTES_CNAE.cosit18,
    }
    const riscoExclusao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 18/2014',
      data_publicacao: '2014-04-09',
      efeito: 'risco_exclusao',
      titulo: 'Coleta mediante cessão de mão de obra pode causar exclusão',
      resumo: 'Quando a coleta for prestada mediante cessão ou locação de mão de obra, a prestadora fica sujeita à exclusão do Simples Nacional; enquanto permanecer regularmente no regime e no Anexo III, a solução afasta a retenção previdenciária de 11%.',
      aplicacao: [
        'Verificar a forma real de execução do contrato, especialmente a colocação de trabalhadores à disposição.',
        'Não reclassificar automaticamente a coleta no Anexo IV apenas por ser chamada de limpeza urbana.',
      ],
      fonte: FONTES_CNAE.cosit18,
    }

    return {
      ...baseEnquadramento(
        'servico', 'anexo_iii', 'III', 'Regra principal: coleta de resíduos no Anexo III',
        'A coleta e o transporte de resíduos não perigosos não se confundem com serviço de limpeza e são tributados pelo Anexo III.',
        'alta', true,
        [
          'Confirmar que a receita corresponde à coleta ou ao transporte de resíduos não perigosos.',
          'Separar eventual serviço de limpeza, conservação, tratamento ou disposição final contratado com objeto distinto.',
        ],
        ['A execução mediante cessão ou locação de mão de obra pode causar exclusão do Simples Nacional.'],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit18],
      entendimentos: [confirmacao, riscoExclusao],
    }
  }

  if (divisao === '33') {
    const confirmacao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 67/2026',
      data_publicacao: '2026-04-24',
      efeito: 'condiciona_enquadramento',
      titulo: 'Manutenção de equipamentos com obrigação de resultado permanece no Anexo III',
      resumo: 'A manutenção e a reparação de equipamentos são, em regra, tributadas pelo Anexo III. Visitas ou chamados periódicos, limitados ao tempo necessário para executar a tarefa e sem equipe à disposição, caracterizam empreitada e não cessão de mão de obra.',
      aplicacao: [
        'Aplicar quando a contratada assume a execução e o resultado da manutenção ou do reparo.',
        'A presença no cliente apenas pelo tempo necessário à tarefa não configura cessão automaticamente.',
      ],
      fonte: FONTES_CNAE.cosit67,
    }
    const riscoExclusao: EntendimentoAdministrativoCnae = {
      tipo: 'solucao_consulta_cosit',
      identificacao: 'SC Cosit nº 67/2026',
      data_publicacao: '2026-04-24',
      efeito: 'risco_exclusao',
      titulo: 'Equipe colocada à disposição pode causar exclusão do Simples',
      resumo: 'Quando a execução envolver colocação de trabalhadores à disposição da contratante para serviço contínuo, pode haver cessão ou locação de mão de obra e, consequentemente, vedação ou exclusão do Simples Nacional.',
      aplicacao: [
        'A caracterização tributária não depende apenas do nome adotado no contrato ou na licitação.',
        'A ausência de transferência formal do comando ou da supervisão não afasta, sozinha, a cessão de mão de obra.',
      ],
      fonte: FONTES_CNAE.cosit67,
    }

    return {
      ...baseEnquadramento(
        'servico', 'anexo_iii', 'III', 'Regra principal: manutenção e reparação no Anexo III',
        'A receita de manutenção, reparação ou instalação de máquinas e equipamentos da divisão CNAE 33 é, em regra, tributada pelo Anexo III quando a contratada assume a execução e o resultado do serviço.',
        'alta', true,
        [
          'Confirmar que a receita corresponde ao serviço de manutenção, reparação ou instalação descrito no CNAE.',
          'Confirmar que a equipe permanece sob organização da contratada e comparece apenas pelo tempo necessário à execução das tarefas.',
        ],
        ['Se os trabalhadores forem colocados à disposição do contratante para serviço contínuo, avaliar vedação ou exclusão do Simples Nacional.'],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit67],
      entendimentos: [confirmacao, riscoExclusao],
    }
  }

  if (CNAES_ANEXO_IV_EXATOS.has(codigo)) {
    return baseEnquadramento(
      'servico', 'anexo_iv', 'IV', 'Atividade indicada para o Anexo IV',
      'A atividade está entre as hipóteses expressamente tributadas pelo Anexo IV.',
      'alta', true,
      ['Confirmar que a receita consultada corresponde efetivamente à atividade descrita no CNAE.'],
      ['A contribuição patronal previdenciária do Anexo IV não está incluída no DAS.'],
    )
  }

  if (CNAES_CONSTRUCAO_ANEXO_III_EXATOS.has(codigo)) {
    return {
      ...baseEnquadramento(
        'construcao', 'anexo_iii', 'III', 'Regra geral: Anexo III',
        'Serviços de instalação, manutenção, reparação ou pintura prestados de forma autônoma são, em regra, tributados pelo Anexo III.',
        'alta', true,
        [
          'Confirmar que a empresa foi contratada para executar o serviço específico, ainda que por empreitada.',
          'Confirmar no contrato que o objeto não é a construção do imóvel ou a execução integral da obra de engenharia.',
        ],
      ),
      fontes: [
        FONTES_CNAE.ibge,
        FONTES_CNAE.lc123,
        FONTES_CNAE.resolucao140,
        FONTES_CNAE.cosit252,
      ],
      excecoes: [excecaoContratoDeObra()],
    }
  }

  if (secao === 'F' && (cnae.hierarquia.grupo.id === '432' || cnae.hierarquia.grupo.id === '433')) {
    return {
      ...baseEnquadramento(
        'construcao', 'anexo_iii', 'III', 'Regra geral indicativa: Anexo III',
        'Instalações e serviços especializados de acabamento prestados autonomamente são, em regra, tratados como serviços no Anexo III.',
        'media', false,
        [
          'Confirmar a atividade efetivamente prestada e o objeto do contrato.',
          'Verificar se o serviço possui solução de consulta ou regra específica.',
        ],
        ['A conclusão é indicativa porque o grupo CNAE reúne atividades com diferentes características contratuais.'],
      ),
      fontes: [
        FONTES_CNAE.ibge,
        FONTES_CNAE.lc123,
        FONTES_CNAE.resolucao140,
        FONTES_CNAE.cosit252,
      ],
      excecoes: [excecaoContratoDeObra()],
    }
  }

  if (secao === 'F') {
    return {
      ...baseEnquadramento(
        'construcao', 'anexo_iv', 'IV', 'Regra principal indicativa: Anexo IV',
        'Construção de imóveis e execução de obras de engenharia em geral, inclusive por subempreitada, são tributadas pelo Anexo IV.',
        'media', false,
        [
          'Confirmar que a receita decorre efetivamente da construção do imóvel ou da execução da obra de engenharia.',
          'Separar serviços autônomos de instalação, manutenção, reparo ou acabamento quando houver contratação própria.',
        ],
        ['O CNAE orienta a consulta, mas o objeto da receita e do contrato define o tratamento aplicável.'],
      ),
      excecoes: [{
        tratamento: 'anexo_iii',
        anexo: 'III',
        titulo: 'Possível exceção: serviço autônomo',
        quando: 'Quando a receita decorrer de instalação, manutenção, reparo ou serviço auxiliar contratado separadamente da execução da obra.',
        explicacao: 'O serviço pode ser tributado pelo Anexo III, conforme sua natureza e o objeto efetivamente contratado.',
        alertas: ['Confirme a atividade, o contrato e eventual entendimento específico da Receita Federal.'],
        fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.cosit252],
      }],
    }
  }

  if (CNAES_ANEXO_III_EXATOS.has(codigo)) {
    return baseEnquadramento(
      'servico', 'anexo_iii', 'III', 'Atividade indicada para o Anexo III',
      'A atividade possui tratamento específico no grupo de serviços tributados pelo Anexo III, sem sujeição ao Fator R como regra geral.',
      'alta', true,
      ['Confirmar que a receita decorre da atividade indicada e observar eventuais condições específicas da legislação.'],
    )
  }

  if (CNAES_FATOR_R_EXATOS.has(codigo) || PREFIXOS_FATOR_R.some(prefixo => codigo.startsWith(prefixo))) {
    return {
      ...baseEnquadramento(
        'servico', 'fator_r', null, 'Atividade sujeita à verificação do Fator R',
        'O anexo resulta da relação entre a folha de salários dos 12 meses anteriores e a receita bruta acumulada no mesmo período.',
        CNAES_FATOR_R_EXATOS.has(codigo) ? 'alta' : 'media',
        CNAES_FATOR_R_EXATOS.has(codigo),
        [
          'Fator R igual ou superior a 28%: Anexo III.',
          'Fator R inferior a 28%: Anexo V.',
          'Confirmar a natureza efetiva do serviço, especialmente em CNAEs com atividades amplas.',
        ],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.perguntao],
    }
  }

  if (divisao === '56') {
    return {
      ...baseEnquadramento(
        'comercio', 'anexo_i', 'I', 'Regra principal: fornecimento de alimentação no Anexo I',
        'A receita de venda e fornecimento de alimentos e bebidas por restaurantes, bares, lanchonetes, estabelecimentos ambulantes, cozinhas, cantinas e similares é, em regra, tributada pelo Anexo I.',
        'alta', true,
        [
          'Confirmar que a receita decorre do fornecimento de alimentos ou bebidas ao consumidor ou para consumo pelos destinatários.',
          'O preparo não deve resultar em produto industrializado acondicionado em embalagem de apresentação.',
          'Segregar receitas autônomas de entretenimento, organização de eventos, locação ou outros serviços.',
        ],
        [
          'Fabricação industrial própria, inclusive de bebidas ou alimentos acondicionados em embalagem de apresentação, pode exigir segregação no Anexo II.',
          'A denominação “serviço de alimentação” na CNAE não desloca, por si só, a receita principal para o Anexo III.',
        ],
      ),
      fontes: [FONTES_CNAE.ibge, FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.ripi],
      excecoes: [
        {
          tratamento: 'anexo_ii',
          anexo: 'II',
          titulo: 'Exceção: produto industrializado pelo estabelecimento',
          quando: 'Quando houver fabricação de produto próprio caracterizada como industrialização, inclusive alimento ou bebida acondicionado em embalagem de apresentação.',
          explicacao: 'A receita da venda do produto industrializado pelo próprio contribuinte deve ser segregada no Anexo II.',
          alertas: ['Não aplicar esta exceção ao simples preparo de refeições e bebidas abrangido pelas exclusões do art. 5º do RIPI.'],
          fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140, FONTES_CNAE.ripi],
        },
        {
          tratamento: 'anexo_iii',
          anexo: 'III',
          titulo: 'Segregação: entretenimento ou serviço autônomo',
          quando: 'Quando houver receita própria e destacável de apresentação artística, entretenimento, produção ou organização de evento, além do fornecimento de alimentação.',
          explicacao: 'A parcela correspondente ao serviço autônomo deve ser analisada e segregada segundo sua natureza; produções artísticas e culturais admitidas no Simples são, em regra, tratadas no Anexo III.',
          alertas: ['A simples existência de música ambiente ou entretenimento acessório não autoriza presumir uma segunda receita sem verificar a cobrança e o objeto efetivo.'],
          fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140],
        },
      ],
    }
  }

  if (divisao === '55') {
    return {
      ...baseEnquadramento(
        'servico', 'anexo_iii', 'III', 'Regra principal: hospedagem no Anexo III',
        'As receitas próprias de hospedagem e alojamento são, em regra, tributadas pelo Anexo III como serviços não sujeitos ao Fator R.',
        'alta', true,
        [
          'Confirmar que a receita corresponde à hospedagem ou ao alojamento.',
          'Segregar a venda autônoma de mercadorias, alimentos e bebidas quando houver cobrança destacada.',
        ],
      ),
      excecoes: [{
        tratamento: 'anexo_i',
        anexo: 'I',
        titulo: 'Segregação: venda autônoma de alimentos, bebidas ou mercadorias',
        quando: 'Quando o estabelecimento auferir receita destacável de fornecimento de alimentação, bebidas ou revenda de mercadorias, separada da hospedagem.',
        explicacao: 'A receita comercial deve ser segregada no Anexo I, sem alterar o Anexo III aplicável à hospedagem.',
        alertas: ['Verificar a composição do preço e a documentação fiscal antes de separar receitas incluídas na diária.'],
        fontes: [FONTES_CNAE.lc123, FONTES_CNAE.resolucao140],
      }],
    }
  }

  if (CNAES_CONSIGNACAO_AUTOMOTIVA.has(codigo)) {
    return baseEnquadramento(
      'comercio', 'inconclusivo', null, 'Consignação de veículos: confirmar a modalidade contratual',
      'O tratamento varia conforme a venda seja realizada por contrato estimatório, tributável pelo Anexo I sobre o produto da venda, ou por contrato de comissão, cuja comissão é tributável pelo Anexo III.',
      'alta', false,
      [
        'Contrato estimatório e venda em nome próprio: Anexo I sobre o produto da venda.',
        'Contrato de comissão e venda em nome próprio: Anexo III sobre a comissão.',
        'Distinguir essas modalidades da simples intermediação em nome de terceiro.',
      ],
    )
  }

  if (CNAES_COMERCIO_AUTOMOTIVO.has(codigo)) {
    return baseEnquadramento(
      'comercio', 'anexo_i', 'I', 'Comércio automotivo — indicação de Anexo I',
      'A receita de venda, por conta própria, de veículos, motocicletas, peças e acessórios novos ou usados é tributada pelo Anexo I.',
      'alta', true,
      [
        'A indicação vale para compra e venda por conta própria.',
        'Reparação, representação, intermediação e consignação devem ser segregadas e analisadas separadamente.',
      ],
    )
  }

  if (codigo.startsWith('45200') || codigo === '4543900') {
    return baseEnquadramento(
      'servico', 'anexo_iii', 'III', 'Reparação automotiva — indicação de Anexo III',
      'A receita dos serviços de manutenção e reparação de veículos automotores ou motocicletas é, em regra, tributada pelo Anexo III.',
      'alta', true,
      [
        'Segregar as peças ou mercadorias vendidas autonomamente no Anexo I.',
        'Confirmar a documentação fiscal e a composição da receita quando peças forem aplicadas no reparo.',
      ],
    )
  }

  if (divisao === '46' || divisao === '47' || texto.includes('COMÉRCIO ATACADISTA') || texto.includes('COMÉRCIO VAREJISTA')) {
    return baseEnquadramento(
      'comercio', 'anexo_i', 'I', 'Atividade comercial — indicação de Anexo I',
      'Receitas de revenda de mercadorias adquiridas de terceiros são, em regra, segregadas no Anexo I.',
      'alta', true,
      [
        'A indicação vale para receita de revenda de mercadorias adquiridas de terceiros.',
        'Produção própria, serviços e receitas sujeitas a tratamentos específicos devem ser segregados separadamente.',
      ],
    )
  }

  if (secao === 'C') {
    return baseEnquadramento(
      'industria', 'anexo_ii', 'II', 'Atividade industrial — indicação de Anexo II',
      'Receitas decorrentes da venda de produtos industrializados pelo próprio estabelecimento são, em regra, segregadas no Anexo II.',
      'alta', true,
      [
        'A indicação vale para venda de produção própria.',
        'Mercadorias adquiridas de terceiros para revenda devem ser segregadas no Anexo I.',
      ],
    )
  }

  if (divisao === '49' || divisao === '50' || divisao === '51') {
    return baseEnquadramento(
      'transporte', 'inconclusivo', null, 'Transporte — enquadramento depende da modalidade',
      'O tratamento no Simples varia conforme transporte municipal, intermunicipal ou interestadual, de cargas ou passageiros e características do serviço.',
      'media', false,
      ['Informar modalidade, percurso e se o transporte é de cargas ou passageiros.'],
    )
  }

  if (secao === 'A') {
    return baseEnquadramento(
      'agropecuaria', 'inconclusivo', null, 'Atividade agropecuária — análise complementar necessária',
      'O CNAE descreve a atividade, mas o tratamento depende do produto, da operação e da forma como a receita é auferida.',
      'baixa', false,
      ['Analisar a operação e a receita efetiva antes de definir o anexo.'],
    )
  }

  if (secao === 'B') {
    return baseEnquadramento(
      'extracao', 'inconclusivo', null, 'Atividade extrativa — análise complementar necessária',
      'A classificação cadastral não é suficiente para definir o tratamento de cada receita ou verificar eventuais impedimentos e regimes específicos.',
      'baixa', false,
      ['Analisar o produto, a operação e eventuais regras específicas da atividade.'],
    )
  }

  if (secao === 'K') {
    return baseEnquadramento(
      'financeira', 'inconclusivo', null, 'Atividade financeira — verificar permissão no Simples',
      'Diversas atividades financeiras possuem vedação ou tratamento específico. O CNAE deve ser confrontado com o art. 17 da LC nº 123/2006.',
      'media', false,
      ['Verificar previamente se a atividade pode optar ou permanecer no Simples Nacional.'],
      ['Não utilizar um anexo antes de concluir a análise de permissão da atividade.'],
    )
  }

  if (secao === 'O') {
    return baseEnquadramento(
      'administracao_publica', 'inconclusivo', null, 'Administração pública — fora da classificação usual do Simples',
      'A seção cadastral não corresponde, em regra, a atividade empresarial enquadrável no Simples Nacional.',
      'alta', false,
    )
  }

  if (SECOES_SERVICOS.has(secao) || texto.includes('SERVIÇO')) {
    return baseEnquadramento(
      'servico', 'inconclusivo', null, 'Serviço — atividade e prestação precisam ser confirmadas',
      'O CNAE identifica uma atividade de serviços, mas não há elementos suficientes para afirmar Anexo III, IV ou Fator R sem analisar a prestação efetiva.',
      'baixa', false,
      [
        'Confirmar o código do serviço ou item da LC nº 116/2003.',
        'Verificar descrição da NFS-e e características do contrato.',
      ],
    )
  }

  return baseEnquadramento(
    'outros', 'inconclusivo', null, 'Enquadramento tributário não conclusivo pelo CNAE',
    'A descrição oficial foi localizada, mas a atividade não permite determinar com segurança um anexo apenas pelo código cadastral.',
    'baixa', false,
    ['Analisar a receita e a operação efetivamente realizadas.'],
  )
}

export function normalizarCnae(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function formatarCnae(valor: string): string {
  const codigo = normalizarCnae(valor)
  if (codigo.length !== 7) return valor
  return `${codigo.slice(0, 4)}-${codigo[4]}/${codigo.slice(5)}`
}

export function normalizarTextoBusca(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR')
    .trim()
}
