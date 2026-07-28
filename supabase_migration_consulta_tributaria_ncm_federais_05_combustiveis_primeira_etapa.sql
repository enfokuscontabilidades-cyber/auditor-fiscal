-- ============================================================================
-- CONSULTA TRIBUTÁRIA NCM — CATÁLOGO FEDERAL 05
-- COMBUSTÍVEIS: PRODUTOR, REFINARIA E IMPORTADOR
--
-- Complementa a carga 04 com:
-- - regime percentual sobre a receita;
-- - regime especial por unidade de medida;
-- - regra obrigatória da importação;
-- - condição específica do GLP doméstico em recipientes de até 13 kg;
-- - vigências temporárias do biodiesel em 2026.
--
-- Idempotente. Requer a tabela criada pela migração base de NCM.
-- ============================================================================

do $$
begin
  if to_regclass('public.tributario_ncm_regras') is null then
    raise exception 'Execute primeiro supabase_migration_consulta_tributaria_ncm.sql';
  end if;
end
$$;

insert into public.tributario_ncm_regras (
  codigo_regra, versao, tributos, tipo_correspondencia, padroes, padroes_excluir,
  prioridade, categoria, titulo, explicacao, descricao_obrigatoria,
  palavras_incluir, palavras_excluir, resultados, condicoes, alertas, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values
(
  'PISCOFINS_GASOLINA_PRIMEIRA_ETAPA_2026', 1, array['pis','cofins'], 'exato',
  array['27101259'], '{}', 198, 'Gasolina automotiva',
  'Gasolina — primeira etapa e revenda',
  'A venda pelo produtor ou importador pode seguir o regime percentual ou o regime especial por metro cúbico. Na importação, as contribuições são obrigatoriamente calculadas por unidade de volume.',
  true, array['gasolina'], array['aviacao','gasolina de aviacao'],
  '[
    {"perfis":["importador"],"operacoes":["importacao"],"tratamento":"tributacao_concentrada","titulo":"Importação de gasolina — alíquotas por metro cúbico","explicacao":"Na importação, o PIS/Pasep-Importação e a Cofins-Importação são fixados por unidade de volume, independentemente da opção pelo regime especial.","orientacao_simples":"Apurar as contribuições da importação fora do DAS e não utilizar as alíquotas percentuais da venda interna.","valor_pis_unidade":141.10,"valor_cofins_unidade":651.40,"unidade_medida":"m3","tabela_efd":"4.3.11"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["percentual"],"tratamento":"tributacao_concentrada","titulo":"Venda de gasolina — regime percentual","explicacao":"No regime percentual, as contribuições incidem sobre a receita bruta da venda de gasolina e suas correntes, exceto gasolina de aviação.","orientacao_simples":"Se a empresa estiver validamente enquadrada no Simples, segregar a receita monofásica e conferir o recolhimento concentrado previsto na legislação específica.","aliquota_pis":5.08,"aliquota_cofins":23.44,"cst_saida":"02","tabela_efd":"4.3.10"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["especial_unidade"],"tratamento":"tributacao_concentrada","titulo":"Venda de gasolina — regime especial por metro cúbico","explicacao":"No regime especial, as contribuições são calculadas por metro cúbico de gasolina comercializado.","orientacao_simples":"Aplicar os valores por volume à quantidade comercializada e confirmar a vigência do coeficiente na data do fato gerador.","valor_pis_unidade":141.10,"valor_cofins_unidade":651.40,"unidade_medida":"m3","cst_saida":"03","tabela_efd":"4.3.11"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["nao_informado"],"tratamento":"inconclusivo","titulo":"Informe o regime adotado","explicacao":"A alíquota da primeira etapa depende da opção entre o regime percentual e o regime especial por unidade de medida.","orientacao_simples":"Selecione o regime efetivamente adotado antes de utilizar os valores da consulta."},
    {"perfis":["distribuidor","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda de gasolina — alíquota zero","explicacao":"A receita da etapa posterior do regime monofásico é tributada à alíquota zero de PIS/Cofins.","orientacao_simples":"Segregar a receita no PGDAS-D como monofásica; os demais tributos do Simples continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar que o produto é gasolina automotiva do NCM 2710.12.59.","Na venda da primeira etapa, confirmar documentalmente o regime adotado."]'::jsonb,
  '["Gasolina de aviação não integra esta regra.","Na importação, a tributação por unidade é obrigatória e não depende da opção informada na consulta."]'::jsonb,
  '[
    {"titulo":"Lei nº 9.718/1998","referencia":"Art. 4º, I","url":"https://www.planalto.gov.br/ccivil_03/leis/l9718compilada.htm"},
    {"titulo":"Lei nº 10.865/2004","referencia":"Arts. 8º, § 8º, e 23, I","url":"https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.865compilado.htm"},
    {"titulo":"Decreto nº 5.059/2004","referencia":"Arts. 1º e 2º, I","url":"https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5059.htm"}
  ]'::jsonb,
  '2026-06-01', '2026-12-31', true
),
(
  'PISCOFINS_DIESEL_PRIMEIRA_ETAPA_2026_06', 1, array['pis','cofins'], 'exato',
  array['27101921'], '{}', 199, 'Óleo diesel',
  'Óleo diesel — primeira etapa e revenda',
  'A partir de 1º de junho de 2026, encerrada a redução temporária do Decreto nº 12.875/2026, o regime especial volta aos valores resultantes do coeficiente ordinário do Decreto nº 5.059/2004.',
  true, array['diesel','gasoleo'], '{}',
  '[
    {"perfis":["importador"],"operacoes":["importacao"],"tratamento":"tributacao_concentrada","titulo":"Importação de diesel — alíquotas por metro cúbico","explicacao":"Na importação, as contribuições são fixadas por unidade de volume, independentemente de opção pelo regime especial.","orientacao_simples":"Apurar as contribuições da importação fora do DAS e observar a data do desembaraço aduaneiro.","valor_pis_unidade":62.61,"valor_cofins_unidade":288.89,"unidade_medida":"m3","tabela_efd":"4.3.11"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["percentual"],"tratamento":"tributacao_concentrada","titulo":"Venda de diesel — regime percentual","explicacao":"No regime percentual, as contribuições incidem sobre a receita bruta da venda de óleo diesel e suas correntes.","orientacao_simples":"Se houver enquadramento válido no Simples, segregar a receita monofásica e conferir o recolhimento concentrado específico.","aliquota_pis":4.21,"aliquota_cofins":19.42,"cst_saida":"02","tabela_efd":"4.3.10"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["especial_unidade"],"tratamento":"tributacao_concentrada","titulo":"Venda de diesel — regime especial por metro cúbico","explicacao":"No regime especial vigente a partir de 1º de junho de 2026, aplicam-se os valores por metro cúbico resultantes do coeficiente de redução ordinário.","orientacao_simples":"Aplicar os valores à quantidade comercializada e sempre conferir se houve novo ato alterando o coeficiente para a data consultada.","valor_pis_unidade":62.61,"valor_cofins_unidade":288.89,"unidade_medida":"m3","cst_saida":"03","tabela_efd":"4.3.11"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["nao_informado"],"tratamento":"inconclusivo","titulo":"Informe o regime adotado","explicacao":"A primeira etapa pode ser apurada por percentual sobre a receita ou por valor específico por metro cúbico.","orientacao_simples":"Selecione o regime efetivamente adotado antes de utilizar os valores da consulta."},
    {"perfis":["distribuidor","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda de diesel — alíquota zero","explicacao":"A receita da etapa posterior do regime monofásico é tributada à alíquota zero.","orientacao_simples":"Segregar a receita no PGDAS-D como monofásica; os demais tributos do Simples continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar que o produto é óleo diesel do NCM 2710.19.21.","Confirmar a data do fato gerador, pois o coeficiente temporário vigorou somente até 31 de maio de 2026."]'::jsonb,
  '["Os valores de R$ 0,01 e R$ 0,05 por m³ não devem ser usados depois de 31 de maio de 2026.","Novo decreto poderá alterar novamente o coeficiente dentro da vigência desta carga."]'::jsonb,
  '[
    {"titulo":"Lei nº 9.718/1998","referencia":"Art. 4º, II","url":"https://www.planalto.gov.br/ccivil_03/leis/l9718compilada.htm"},
    {"titulo":"Lei nº 10.865/2004","referencia":"Arts. 8º, § 8º, e 23, II","url":"https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.865compilado.htm"},
    {"titulo":"Decreto nº 5.059/2004","referencia":"Arts. 1º e 2º, II","url":"https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5059.htm"},
    {"titulo":"SPED — atualização diesel 2026","referencia":"Tabela 4.3.11","url":"https://sped.rfb.gov.br/item/show/8072"}
  ]'::jsonb,
  '2026-06-01', '2026-12-31', true
),
(
  'PISCOFINS_GLP_PRIMEIRA_ETAPA_2026', 1, array['pis','cofins'], 'exato',
  array['27111910'], '{}', 200, 'Gás liquefeito de petróleo — GLP',
  'GLP — primeira etapa, acondicionamento e revenda',
  'O regime especial do GLP utiliza valores por tonelada. Quando destinado ao uso doméstico e envasado em recipientes de até 13 kg, os valores específicos estão reduzidos a zero.',
  true, array['glp','gas liquefeito de petroleo','gas de cozinha'], '{}',
  '[
    {"perfis":["importador"],"operacoes":["importacao"],"contextos_produto":["glp_domestico_ate_13kg"],"tratamento":"aliquota_zero","titulo":"Importação de GLP doméstico até 13 kg — valores específicos zerados","explicacao":"Para GLP destinado ao uso doméstico e envasado em recipientes de até 13 kg, os valores específicos de PIS/Cofins estão reduzidos a zero.","orientacao_simples":"Manter a documentação que comprove cumulativamente a destinação doméstica e o acondicionamento em recipiente de até 13 kg.","valor_pis_unidade":0,"valor_cofins_unidade":0,"unidade_medida":"tonelada","tabela_efd":"4.3.11"},
    {"perfis":["importador"],"operacoes":["importacao"],"contextos_produto":["demais"],"tratamento":"tributacao_concentrada","titulo":"Importação de GLP — alíquotas por tonelada","explicacao":"Na importação de GLP não enquadrado na condição doméstica de até 13 kg, as contribuições são fixadas por tonelada.","orientacao_simples":"Apurar as contribuições da importação fora do DAS e confirmar peso e acondicionamento.","valor_pis_unidade":29.85,"valor_cofins_unidade":137.85,"unidade_medida":"tonelada","tabela_efd":"4.3.11"},
    {"perfis":["importador"],"operacoes":["importacao"],"contextos_produto":["nao_informado"],"tratamento":"inconclusivo","titulo":"Informe a destinação e o recipiente do GLP","explicacao":"O valor da importação pode ser zero somente quando o GLP tiver destinação doméstica e estiver envasado em recipiente de até 13 kg.","orientacao_simples":"Selecione a condição especial do produto antes de utilizar qualquer valor."},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["percentual"],"tratamento":"tributacao_concentrada","titulo":"Venda de GLP — regime percentual","explicacao":"No regime percentual, as contribuições incidem sobre a receita bruta da venda de GLP derivado de petróleo ou gás natural.","orientacao_simples":"Conferir se o estabelecimento adotou efetivamente o regime percentual e manter a segregação da receita monofásica.","aliquota_pis":10.2,"aliquota_cofins":47.4,"cst_saida":"02","tabela_efd":"4.3.10"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["especial_unidade"],"contextos_produto":["glp_domestico_ate_13kg"],"tratamento":"aliquota_zero","titulo":"GLP doméstico até 13 kg — valores específicos zerados","explicacao":"No regime especial, o GLP destinado ao uso doméstico e envasado em recipientes de até 13 kg possui valores específicos de PIS/Cofins iguais a zero.","orientacao_simples":"Não estender a redução a recipientes maiores ou a GLP sem comprovação da destinação doméstica.","valor_pis_unidade":0,"valor_cofins_unidade":0,"unidade_medida":"tonelada","cst_saida":"03","tabela_efd":"4.3.11"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["especial_unidade"],"contextos_produto":["demais"],"tratamento":"tributacao_concentrada","titulo":"Venda de GLP — regime especial por tonelada","explicacao":"Para GLP não enquadrado na condição doméstica de até 13 kg, aplicam-se os valores específicos por tonelada.","orientacao_simples":"Aplicar os valores ao peso comercializado e confirmar destinação e acondicionamento.","valor_pis_unidade":29.85,"valor_cofins_unidade":137.85,"unidade_medida":"tonelada","cst_saida":"03","tabela_efd":"4.3.11"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["especial_unidade"],"contextos_produto":["nao_informado"],"tratamento":"inconclusivo","titulo":"Informe a condição do GLP","explicacao":"No regime especial, é necessário saber se o GLP tem destinação doméstica e está envasado em recipiente de até 13 kg.","orientacao_simples":"Selecione a condição especial do produto antes de utilizar os valores por tonelada."},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["nao_informado"],"tratamento":"inconclusivo","titulo":"Informe o regime adotado","explicacao":"A primeira etapa pode seguir o regime percentual ou o regime especial por tonelada.","orientacao_simples":"Selecione o regime efetivamente adotado e, no regime especial, informe também a condição do produto."},
    {"perfis":["distribuidor","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda de GLP — alíquota zero","explicacao":"A receita da etapa posterior do regime monofásico é tributada à alíquota zero.","orientacao_simples":"Segregar a receita no PGDAS-D como monofásica; os demais tributos do Simples continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar o NCM 2711.19.10 e a descrição de GLP.","Para utilizar valor zero na primeira etapa, comprovar destinação doméstica e recipiente de até 13 kg."]'::jsonb,
  '["A simples descrição comercial gás de cozinha não comprova o peso do recipiente.","GLP a granel, industrial ou envasado acima de 13 kg não recebe a redução específica a zero desta regra."]'::jsonb,
  '[
    {"titulo":"Lei nº 9.718/1998","referencia":"Art. 4º, III","url":"https://www.planalto.gov.br/ccivil_03/leis/l9718compilada.htm"},
    {"titulo":"Lei nº 10.865/2004","referencia":"Arts. 8º, § 8º, e 23, III","url":"https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.865compilado.htm"},
    {"titulo":"Decreto nº 5.059/2004","referencia":"Arts. 1º, III e V, e 2º, III e V","url":"https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5059.htm"}
  ]'::jsonb,
  '2026-06-01', '2026-12-31', true
),
(
  'PISCOFINS_ETANOL_PRIMEIRA_ETAPA_2026', 1, array['pis','cofins'], 'exato',
  array['22071010','22071090','22072011','22072019'], '{}', 197, 'Etanol combustível',
  'Etanol combustível — importação, primeira etapa e revenda',
  'A importação possui alíquotas próprias. Na venda interna pelo produtor ou importador, a apuração pode seguir percentuais sobre a receita ou o regime especial por metro cúbico.',
  true, array['etanol combustivel','alcool combustivel','alcool carburante','etanol hidratado','etanol anidro'],
  array['bebida','perfumaria','cosmetico','farmaceutico','limpeza','solvente'],
  '[
    {"perfis":["importador"],"operacoes":["importacao"],"tratamento":"tributacao_concentrada","titulo":"Importação de etanol — alíquotas próprias","explicacao":"A importação de álcool, inclusive para fins carburantes, está sujeita a 2,1% de PIS/Pasep-Importação e 9,65% de Cofins-Importação, independentemente da opção pelo regime especial da venda interna.","orientacao_simples":"Apurar as contribuições da importação fora do DAS e não utilizar os valores por metro cúbico da venda interna.","aliquota_pis":2.1,"aliquota_cofins":9.65},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["percentual"],"tratamento":"tributacao_concentrada","titulo":"Venda de etanol — regime percentual","explicacao":"No regime percentual, as contribuições incidem sobre a receita bruta auferida pelo produtor ou importador.","orientacao_simples":"Segregar a receita monofásica e conferir a tributação concentrada prevista para o produtor ou importador.","aliquota_pis":5.25,"aliquota_cofins":24.15,"cst_saida":"02","tabela_efd":"4.3.10"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["especial_unidade"],"tratamento":"tributacao_concentrada","titulo":"Venda de etanol — regime especial por metro cúbico","explicacao":"No regime especial, aplicam-se valores específicos por metro cúbico de etanol combustível.","orientacao_simples":"Confirmar a opção válida e irretratável pelo regime especial no ano-calendário e aplicar os valores ao volume vendido.","valor_pis_unidade":34.33,"valor_cofins_unidade":157.87,"unidade_medida":"m3","cst_saida":"03","tabela_efd":"4.3.11"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["nao_informado"],"tratamento":"inconclusivo","titulo":"Informe o regime adotado","explicacao":"A venda interna pelo produtor ou importador depende da opção entre o regime percentual e o regime especial por metro cúbico.","orientacao_simples":"Selecione o regime efetivamente adotado no ano-calendário."},
    {"perfis":["distribuidor"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Distribuição de etanol combustível — alíquota zero","explicacao":"A receita de venda de etanol combustível auferida pelo distribuidor está sujeita à alíquota zero.","orientacao_simples":"Segregar a receita no PGDAS-D como monofásica; os demais tributos continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"},
    {"perfis":["varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda varejista de etanol — alíquota zero","explicacao":"A receita do comerciante varejista está sujeita à alíquota zero, exceto quando o próprio varejista tiver efetuado a importação.","orientacao_simples":"Segregar a receita como monofásica; em importação própria, refazer a consulta com o perfil Importador.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar que o produto é etanol combustível.","Na venda interna da primeira etapa, confirmar a opção pelo regime especial para o ano-calendário."]'::jsonb,
  '["As alíquotas da importação são diferentes das alíquotas da venda interna.","Cooperativas, interdependência e vendas diretas podem exigir regras adicionais."]'::jsonb,
  '[
    {"titulo":"Lei nº 9.718/1998","referencia":"Art. 5º, caput e §§ 1º e 4º","url":"https://www.planalto.gov.br/ccivil_03/leis/l9718compilada.htm"},
    {"titulo":"Lei nº 10.865/2004","referencia":"Art. 8º, § 19","url":"https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.865compilado.htm"}
  ]'::jsonb,
  '2026-01-01', '2026-12-31', true
),
(
  'PISCOFINS_BIODIESEL_TEMPORARIO_2026', 1, array['pis','cofins'], 'exato',
  array['38260000'], '{}', 205, 'Biodiesel',
  'Biodiesel — redução temporária até 31 de julho de 2026',
  'Entre 7 de abril e 31 de julho de 2026, o coeficiente do regime por unidade foi fixado em um inteiro, reduzindo a zero os valores específicos de PIS/Cofins do biodiesel.',
  true, array['biodiesel'], '{}',
  '[
    {"perfis":["importador"],"operacoes":["importacao"],"tratamento":"aliquota_zero","titulo":"Importação de biodiesel — valores específicos temporariamente zerados","explicacao":"Na vigência temporária, os valores de PIS/Pasep-Importação e Cofins-Importação por metro cúbico estão reduzidos a zero.","orientacao_simples":"Aplicar o resultado somente a fatos geradores entre 7 de abril e 31 de julho de 2026.","valor_pis_unidade":0,"valor_cofins_unidade":0,"unidade_medida":"m3","tabela_efd":"4.3.11"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["percentual"],"tratamento":"tributacao_concentrada","titulo":"Venda de biodiesel — regime percentual","explicacao":"Sem opção pelo regime especial por unidade, permanecem as alíquotas percentuais previstas no art. 3º da Lei nº 11.116/2005.","orientacao_simples":"Confirmar que a pessoa jurídica não optou pelo regime especial antes de aplicar os percentuais.","aliquota_pis":6.15,"aliquota_cofins":28.32,"cst_saida":"02","tabela_efd":"4.3.10"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["especial_unidade"],"tratamento":"aliquota_zero","titulo":"Venda de biodiesel — valores específicos temporariamente zerados","explicacao":"No regime especial por unidade, o coeficiente temporário reduz os valores de PIS/Cofins a zero até 31 de julho de 2026.","orientacao_simples":"Aplicar o resultado somente dentro da vigência e conferir a data do fato gerador.","valor_pis_unidade":0,"valor_cofins_unidade":0,"unidade_medida":"m3","cst_saida":"03","tabela_efd":"4.3.11"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["nao_informado"],"tratamento":"inconclusivo","titulo":"Informe o regime adotado","explicacao":"A redução temporária por unidade não substitui automaticamente o regime percentual.","orientacao_simples":"Confirme se houve opção pelo regime especial e informe a data do fato gerador."},
    {"perfis":["distribuidor","atacadista","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda de biodiesel — alíquota zero","explicacao":"A receita da etapa posterior à incidência concentrada está sujeita à alíquota zero.","orientacao_simples":"Segregar a receita no PGDAS-D como monofásica; os demais tributos continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar a data do fato gerador dentro da vigência temporária.","Confirmar o regime adotado pelo produtor ou importador."]'::jsonb,
  '["A redução temporária encerra-se em 31 de julho de 2026 se não houver novo ato de prorrogação.","Não transportar os valores zerados automaticamente para agosto de 2026."]'::jsonb,
  '[
    {"titulo":"Lei nº 11.116/2005","referencia":"Arts. 3º a 5º e 7º","url":"https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11116.htm"},
    {"titulo":"Decreto nº 10.527/2020","referencia":"Art. 5º, §§ 2º a 4º","url":"https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/decreto/d10527.htm"},
    {"titulo":"Decreto nº 12.991/2026","referencia":"Art. 2º","url":"https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12991.htm"}
  ]'::jsonb,
  '2026-04-07', '2026-07-31', true
),
(
  'PISCOFINS_BIODIESEL_REGULAR_2026_08', 1, array['pis','cofins'], 'exato',
  array['38260000'], '{}', 204, 'Biodiesel',
  'Biodiesel — tratamento a partir de agosto de 2026',
  'Encerrada a redução temporária, a importação retorna aos valores específicos ordinários. Para o produtor, o regime especial pode variar conforme matéria-prima, região e Selo Biocombustível Social.',
  true, array['biodiesel'], '{}',
  '[
    {"perfis":["importador"],"operacoes":["importacao"],"tratamento":"tributacao_concentrada","titulo":"Importação de biodiesel — valores por metro cúbico","explicacao":"O biodiesel importado não utiliza os coeficientes diferenciados vinculados à matéria-prima nacional e ao Selo Biocombustível Social.","orientacao_simples":"Apurar as contribuições da importação fora do DAS conforme o volume importado.","valor_pis_unidade":26.41,"valor_cofins_unidade":121.59,"unidade_medida":"m3","tabela_efd":"4.3.11"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["percentual"],"tratamento":"tributacao_concentrada","titulo":"Venda de biodiesel — regime percentual","explicacao":"No regime percentual, aplicam-se as alíquotas previstas no art. 3º da Lei nº 11.116/2005.","orientacao_simples":"Confirmar que não houve opção pelo regime especial por unidade.","aliquota_pis":6.15,"aliquota_cofins":28.32,"cst_saida":"02","tabela_efd":"4.3.10"},
    {"perfis":["importador"],"operacoes":["venda_producao"],"regimes_apuracao":["especial_unidade"],"tratamento":"tributacao_concentrada","titulo":"Venda de biodiesel importado — regime por metro cúbico","explicacao":"Para biodiesel importado, aplicam-se os valores ordinários por metro cúbico, sem os coeficientes diferenciados reservados às matérias-primas nacionais elegíveis.","orientacao_simples":"Aplicar os valores ao volume vendido e manter a vinculação com o produto importado.","valor_pis_unidade":26.41,"valor_cofins_unidade":121.59,"unidade_medida":"m3","cst_saida":"03","tabela_efd":"4.3.11"},
    {"perfis":["fabricante"],"operacoes":["venda_producao"],"regimes_apuracao":["especial_unidade"],"tratamento":"inconclusivo","titulo":"Produtor de biodiesel — identificar matéria-prima e Selo","explicacao":"Os valores por metro cúbico podem variar conforme a matéria-prima, a região de produção, a aquisição da agricultura familiar e a regularidade do Selo Biocombustível Social.","orientacao_simples":"Não aplique o valor geral antes de identificar a composição proporcional das matérias-primas e a habilitação do produtor."},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"regimes_apuracao":["nao_informado"],"tratamento":"inconclusivo","titulo":"Informe o regime adotado","explicacao":"A primeira etapa pode seguir percentual sobre a receita ou valores por metro cúbico.","orientacao_simples":"Selecione o regime; para produtor no regime especial, será necessária análise da matéria-prima e do Selo."},
    {"perfis":["distribuidor","atacadista","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda de biodiesel — alíquota zero","explicacao":"A receita da etapa posterior à incidência concentrada está sujeita à alíquota zero.","orientacao_simples":"Segregar a receita no PGDAS-D como monofásica; os demais tributos continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar a inexistência de prorrogação da redução temporária após 31 de julho de 2026.","No produtor, identificar matéria-prima, região e situação do Selo Biocombustível Social."]'::jsonb,
  '["Esta vigência deverá ser revista se houver novo decreto antes de agosto de 2026.","O valor geral do biodiesel nacional pode não ser aplicável quando houver coeficiente diferenciado."]'::jsonb,
  '[
    {"titulo":"Lei nº 11.116/2005","referencia":"Arts. 3º a 7º","url":"https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11116.htm"},
    {"titulo":"Decreto nº 10.527/2020","referencia":"Arts. 5º e 6º","url":"https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/decreto/d10527.htm"},
    {"titulo":"Decreto nº 12.991/2026","referencia":"Vigência da redução temporária","url":"https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12991.htm"}
  ]'::jsonb,
  '2026-08-01', '2026-12-31', true
)
on conflict (codigo_regra, versao) do update set
  tributos = excluded.tributos,
  tipo_correspondencia = excluded.tipo_correspondencia,
  padroes = excluded.padroes,
  padroes_excluir = excluded.padroes_excluir,
  prioridade = excluded.prioridade,
  categoria = excluded.categoria,
  titulo = excluded.titulo,
  explicacao = excluded.explicacao,
  descricao_obrigatoria = excluded.descricao_obrigatoria,
  palavras_incluir = excluded.palavras_incluir,
  palavras_excluir = excluded.palavras_excluir,
  resultados = excluded.resultados,
  condicoes = excluded.condicoes,
  alertas = excluded.alertas,
  fontes = excluded.fontes,
  vigencia_inicio = excluded.vigencia_inicio,
  vigencia_fim = excluded.vigencia_fim,
  ativo = excluded.ativo,
  updated_at = now();
