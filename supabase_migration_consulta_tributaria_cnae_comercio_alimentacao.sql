-- ============================================================================
-- CORRECAO DO CATALOGO CNAE - ALIMENTACAO, HOSPEDAGEM E SETOR AUTOMOTIVO
--
-- Corrige atividades que caiam no fallback generico porque a secao estatistica
-- da CNAE nao coincide necessariamente com o anexo tributario do Simples.
-- Idempotente: pode ser executada multiplas vezes no Supabase SQL Editor.
-- ============================================================================

insert into public.tributario_cnae_regras (
  codigo_regra, versao, tipo_correspondencia, padroes, prioridade,
  natureza, tratamento_principal, anexo_principal, titulo, explicacao,
  confianca, conclusivo, condicoes, alertas, excecoes, entendimentos, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values
(
  'SN_CNAE_ALIMENTACAO_BARES_RESTAURANTES', 1, 'divisao', array['56'], 125,
  'comercio', 'anexo_i', 'I', 'Regra principal: fornecimento de alimentacao no Anexo I',
  'A receita de venda e fornecimento de alimentos e bebidas por restaurantes, bares, lanchonetes, estabelecimentos ambulantes, cozinhas, cantinas e similares e, em regra, tributada pelo Anexo I.',
  'alta', true,
  $$[
    "Confirmar que a receita decorre do fornecimento de alimentos ou bebidas ao consumidor ou para consumo pelos destinatarios.",
    "O preparo nao deve resultar em produto industrializado acondicionado em embalagem de apresentacao.",
    "Segregar receitas autonomas de entretenimento, organizacao de eventos, locacao ou outros servicos."
  ]$$::jsonb,
  $$[
    "Fabricacao industrial propria, inclusive de bebidas ou alimentos acondicionados em embalagem de apresentacao, pode exigir segregacao no Anexo II.",
    "A denominacao servico de alimentacao na CNAE nao desloca, por si so, a receita principal para o Anexo III."
  ]$$::jsonb,
  $$[
    {
      "tratamento":"anexo_ii",
      "anexo":"II",
      "titulo":"Excecao: produto industrializado pelo estabelecimento",
      "quando":"Quando houver fabricacao de produto proprio caracterizada como industrializacao, inclusive alimento ou bebida acondicionado em embalagem de apresentacao.",
      "explicacao":"A receita da venda do produto industrializado pelo proprio contribuinte deve ser segregada no Anexo II.",
      "alertas":["Nao aplicar esta excecao ao simples preparo de refeicoes e bebidas abrangido pelas exclusoes do art. 5 do RIPI."],
      "fontes":[
        {"titulo":"Lei Complementar no 123/2006","referencia":"Art. 18, paragrafo 4, II","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},
        {"titulo":"Decreto no 7.212/2010 - RIPI","referencia":"Art. 5, I e II","url":"https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7212.htm"}
      ]
    },
    {
      "tratamento":"anexo_iii",
      "anexo":"III",
      "titulo":"Segregacao: entretenimento ou servico autonomo",
      "quando":"Quando houver receita propria e destacavel de apresentacao artistica, entretenimento, producao ou organizacao de evento, alem do fornecimento de alimentacao.",
      "explicacao":"A parcela correspondente ao servico autonomo deve ser analisada e segregada segundo sua natureza; producoes artisticas e culturais admitidas no Simples sao, em regra, tratadas no Anexo III.",
      "alertas":["Musica ambiente ou entretenimento meramente acessorio nao autorizam presumir uma segunda receita sem verificar a cobranca e o objeto efetivo."],
      "fontes":[{"titulo":"Resolucao CGSN no 140/2018","referencia":"Art. 25, paragrafo 1, III, h","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}]
    }
  ]$$::jsonb,
  '[]'::jsonb,
  $$[
    {"titulo":"Lei Complementar no 123/2006","referencia":"Art. 18, paragrafo 4, I e II; Anexos I e II","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},
    {"titulo":"Resolucao CGSN no 140/2018","referencia":"Art. 25, paragrafo 1, I e II","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"},
    {"titulo":"Decreto no 7.212/2010 - RIPI","referencia":"Art. 5, I e II - preparo em restaurantes, bares e similares","url":"https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/decreto/d7212.htm"}
  ]$$::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_HOSPEDAGEM_ALOJAMENTO', 1, 'divisao', array['55'], 110,
  'servico', 'anexo_iii', 'III', 'Regra principal: hospedagem no Anexo III',
  'As receitas proprias de hospedagem e alojamento sao, em regra, tributadas pelo Anexo III como servicos nao sujeitos ao Fator R.',
  'alta', true,
  $$["Confirmar que a receita corresponde a hospedagem ou ao alojamento.","Segregar a venda autonoma de mercadorias, alimentos e bebidas quando houver cobranca destacada."]$$::jsonb,
  '[]'::jsonb,
  $$[{
    "tratamento":"anexo_i","anexo":"I",
    "titulo":"Segregacao: venda autonoma de alimentos, bebidas ou mercadorias",
    "quando":"Quando houver receita destacavel de fornecimento de alimentacao, bebidas ou revenda de mercadorias separada da hospedagem.",
    "explicacao":"A receita comercial deve ser segregada no Anexo I, sem alterar o Anexo III aplicavel a hospedagem.",
    "alertas":["Verificar a composicao do preco e a documentacao fiscal antes de separar receitas incluidas na diaria."],
    "fontes":[{"titulo":"Resolucao CGSN no 140/2018","referencia":"Art. 25, paragrafo 1, I e III","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}]
  }]$$::jsonb,
  '[]'::jsonb,
  $$[
    {"titulo":"Lei Complementar no 123/2006","referencia":"Art. 18, paragrafos 4 e 5-F","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},
    {"titulo":"Resolucao CGSN no 140/2018","referencia":"Art. 25, paragrafo 1, III, m","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}
  ]$$::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_COMERCIO_AUTOMOTIVO', 1, 'exato',
  array['4511101','4511102','4511103','4511104','4511105','4511106','4530701','4530702','4530703','4530704','4530705','4541201','4541202','4541203','4541204','4541205','4541206','4541207'],
  120,
  'comercio', 'anexo_i', 'I', 'Comercio automotivo - indicacao de Anexo I',
  'A receita de venda, por conta propria, de veiculos, motocicletas, pecas e acessorios novos ou usados e tributada pelo Anexo I.',
  'alta', true,
  $$["A indicacao vale para compra e venda por conta propria.","Reparacao, representacao, intermediacao e consignacao devem ser segregadas e analisadas separadamente."]$$::jsonb,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  $$[
    {"titulo":"Lei Complementar no 123/2006","referencia":"Art. 18, paragrafo 4, I; Anexo I","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},
    {"titulo":"Solucao de Consulta Cosit no 166/2014","referencia":"Compra e venda de veiculos usados por conta propria","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=31148"}
  ]$$::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_REPARACAO_AUTOMOTIVA', 1, 'prefixo', array['452','4543900'], 120,
  'servico', 'anexo_iii', 'III', 'Reparacao automotiva - indicacao de Anexo III',
  'A receita dos servicos de manutencao e reparacao de veiculos automotores ou motocicletas e, em regra, tributada pelo Anexo III.',
  'alta', true,
  $$["Segregar as pecas ou mercadorias vendidas autonomamente no Anexo I.","Confirmar a documentacao fiscal e a composicao da receita quando pecas forem aplicadas no reparo."]$$::jsonb,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  $$[
    {"titulo":"Lei Complementar no 123/2006","referencia":"Art. 18, paragrafo 5-B, IX","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},
    {"titulo":"Resolucao CGSN no 140/2018","referencia":"Art. 25, paragrafo 1, III, g","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}
  ]$$::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_REPRESENTACAO_AUTOMOTIVA', 1, 'exato', array['4512901','4530706','4542101'], 130,
  'servico', 'fator_r', null, 'Representacao comercial automotiva - verificar Fator R',
  'As receitas de representacao comercial e agenciamento de veiculos, motocicletas, pecas e acessorios sao tributadas pelo Anexo III quando o Fator R for igual ou superior a 28%, ou pelo Anexo V quando for inferior.',
  'alta', true,
  $$["Fator R igual ou superior a 28%: Anexo III.","Fator R inferior a 28%: Anexo V.","Confirmar que a atividade e representacao ou agenciamento e nao compra e venda por conta propria."]$$::jsonb,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  $$[
    {"titulo":"Lei Complementar no 123/2006","referencia":"Art. 18, paragrafos 5-I, VII, e 5-J","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},
    {"titulo":"Resolucao CGSN no 140/2018","referencia":"Arts. 25 e 26 - representacao comercial e Fator R","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278"}
  ]$$::jsonb,
  '2018-08-01', null, true
),
(
  'SN_CNAE_CONSIGNACAO_AUTOMOTIVA', 1, 'exato', array['4512902','4542102'], 135,
  'comercio', 'inconclusivo', null, 'Consignacao de veiculos: confirmar a modalidade contratual',
  'O tratamento varia conforme a venda seja realizada por contrato estimatorio, tributavel pelo Anexo I sobre o produto da venda, ou por contrato de comissao, cuja comissao e tributavel pelo Anexo III.',
  'alta', false,
  $$["Contrato estimatorio e venda em nome proprio: Anexo I sobre o produto da venda.","Contrato de comissao e venda em nome proprio: Anexo III sobre a comissao.","Distinguir essas modalidades da simples intermediacao em nome de terceiro."]$$::jsonb,
  $$["A forma do contrato e da operacao prevalece sobre o uso generico da palavra consignacao."]$$::jsonb,
  '[]'::jsonb,
  $$[{
    "tipo":"solucao_consulta_cosit","identificacao":"SC Cosit no 166/2014","data_publicacao":"2014-06-25","efeito":"distingue_receitas",
    "titulo":"Conta propria, comissao e contrato estimatorio possuem bases e anexos distintos",
    "resumo":"A compra e venda por conta propria e o contrato estimatorio levam ao Anexo I sobre o produto da venda; no contrato de comissao, a comissao e tributada pelo Anexo III.",
    "aplicacao":["Identificar o tipo contratual e quem realiza a venda em nome proprio.","Definir a receita bruta conforme o produto da venda ou a comissao."],
    "fonte":{"titulo":"Solucao de Consulta Cosit no 166/2014","referencia":"Venda de veiculos usados, conta propria e consignacao","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=31148"}
  }]$$::jsonb,
  $$[
    {"titulo":"Lei Complementar no 123/2006","referencia":"Arts. 17 e 18","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"},
    {"titulo":"Solucao de Consulta Cosit no 166/2014","referencia":"Venda de veiculos usados, conta propria e consignacao","url":"https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=31148"}
  ]$$::jsonb,
  '2018-08-01', null, true
)
on conflict (codigo_regra, versao) do nothing;
