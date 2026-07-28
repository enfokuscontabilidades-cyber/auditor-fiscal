-- ============================================================================
-- CONSULTA TRIBUTÁRIA NCM — CATÁLOGO FEDERAL 04 — COMBUSTÍVEIS
--
-- Carga conservadora das regras monofásicas de PIS/Cofins para combustíveis.
-- - A etapa posterior é concluída somente para distribuidor de combustíveis
--   ou comerciante varejista, conforme o produto e a legislação aplicável.
-- - Produtor, refinaria e importador recebem resultado inconclusivo porque a
--   apuração pode depender de regime especial, alíquota por unidade, coeficiente
--   redutor e data do fato gerador.
-- - A importação própria nunca é tratada como simples revenda à alíquota zero.
--
-- A alíquota de IPI permanece sendo obtida da TIPI oficial pela aplicação.
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
  'PISCOFINS_MONOFASICO_COMBUSTIVEIS_PETROLEO', 1, array['pis','cofins'], 'exato',
  array['27101259','27101921','27111910'], '{}', 180,
  'Combustíveis derivados de petróleo',
  'Gasolina, óleo diesel e GLP — incidência monofásica',
  'A tributação de PIS/Cofins é concentrada no produtor ou importador. A venda posterior por distribuidor de combustíveis ou comerciante varejista fica, em regra, sujeita à alíquota zero.',
  true,
  array['gasolina','diesel','gasoleo','glp','gas liquefeito de petroleo','gas de cozinha'],
  array['aviacao','qav','querosene de aviacao'],
  '[
    {"perfis":["fabricante"],"operacoes":["venda_producao"],"tratamento":"inconclusivo","titulo":"Produtor ou refinaria: confirmar regime e vigência","explicacao":"A etapa concentrada pode ser apurada por alíquotas percentuais ou por regime especial com valores por unidade de medida e coeficientes vigentes na data do fato gerador.","orientacao_simples":"Não utilize uma alíquota fixa desta consulta. Confirme o produto, o regime especial adotado, a unidade de medida e a legislação vigente na data da operação."},
    {"perfis":["importador"],"operacoes":["importacao","venda_producao"],"tratamento":"inconclusivo","titulo":"Importador: incidência própria da primeira etapa","explicacao":"A importação ou a venda realizada pelo próprio importador não recebe automaticamente o tratamento da revenda posterior e exige a apuração prevista para o importador.","orientacao_simples":"Não aplique a alíquota zero da revenda à importação própria. Confirme PIS/Cofins-Importação, eventual regime especial e a tributação da venda subsequente."},
    {"perfis":["distribuidor","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda de combustível: alíquota zero de PIS/Cofins","explicacao":"Na etapa posterior do regime monofásico, a receita da venda por distribuidor de combustíveis ou comerciante varejista é tributada à alíquota zero de PIS/Cofins.","orientacao_simples":"Segregar a receita no PGDAS-D como tributação monofásica de PIS e Cofins. Os demais tributos do Simples Nacional continuam incidindo e a aquisição para revenda não gera crédito dessas contribuições.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar que o NCM e a descrição correspondem efetivamente a gasolina, óleo diesel ou GLP.","Confirmar que a empresa atua como distribuidor autorizado ou comerciante varejista e que a mercadoria foi adquirida para revenda."]'::jsonb,
  '["Se a própria empresa importou ou produziu o combustível, selecione o perfil Importador ou Fabricante; a alíquota zero da etapa posterior não é automática.","Gasolina de aviação e querosene de aviação não estão incluídos nesta regra.","A aquisição de combustível monofásico para revenda não gera crédito de PIS/Cofins para o revendedor."]'::jsonb,
  '[
    {"titulo":"Lei nº 9.718/1998","referencia":"Arts. 4º e 6º","url":"https://www.planalto.gov.br/ccivil_03/leis/l9718compilada.htm"},
    {"titulo":"MP nº 2.158-35/2001","referencia":"Art. 42","url":"https://www.planalto.gov.br/ccivil_03/mpv/2158-35.htm"},
    {"titulo":"Receita Federal — créditos de revendedores de combustíveis","referencia":"Item 2.1","url":"https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/restituicao-ressarcimento-reembolso-e-compensacao/conformidade-tributaria/operacao-inflamavel-II"}
  ]'::jsonb,
  '2026-01-01', '2026-12-31', true
),
(
  'PISCOFINS_MONOFASICO_ETANOL_COMBUSTIVEL', 1, array['pis','cofins'], 'exato',
  array['22071010','22071090','22072011','22072019'], '{}', 185,
  'Etanol combustível',
  'Etanol combustível — tratamento depende da etapa da cadeia',
  'O produtor e o importador estão sujeitos à incidência concentrada, com possibilidade de regime especial. A receita do distribuidor de etanol combustível e do comerciante varejista fica sujeita à alíquota zero nas hipóteses legais.',
  true,
  array['etanol combustivel','alcool combustivel','alcool carburante','etanol hidratado','etanol anidro'],
  array['bebida','perfumaria','cosmetico','farmaceutico','limpeza','solvente'],
  '[
    {"perfis":["fabricante"],"operacoes":["venda_producao"],"tratamento":"inconclusivo","titulo":"Produtor de etanol: confirmar regime especial","explicacao":"A incidência concentrada pode seguir as alíquotas percentuais do art. 5º da Lei nº 9.718/1998 ou o regime especial por metro cúbico, além de hipóteses específicas de venda direta e interdependência.","orientacao_simples":"Confirme a opção pelo regime especial, o tipo de etanol, o destinatário e a data do fato gerador antes de calcular PIS/Cofins."},
    {"perfis":["importador"],"operacoes":["importacao","venda_producao"],"tratamento":"inconclusivo","titulo":"Importador de etanol: incidência própria","explicacao":"A importação e a venda pelo próprio importador estão na etapa concentrada e não recebem automaticamente a alíquota zero aplicável à revenda posterior.","orientacao_simples":"Confirme PIS/Cofins-Importação, a eventual opção pelo regime especial e o tratamento da venda no mercado interno."},
    {"perfis":["distribuidor"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Distribuição de etanol combustível: alíquota zero","explicacao":"A receita de venda de etanol combustível auferida pelo distribuidor está sujeita à alíquota zero de PIS/Cofins, nos termos do art. 5º, § 1º, IV, da Lei nº 9.718/1998.","orientacao_simples":"Segregar a receita no PGDAS-D como tributação monofásica de PIS e Cofins. Os demais tributos do Simples Nacional continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"},
    {"perfis":["varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda varejista de etanol: alíquota zero","explicacao":"A receita auferida pelo comerciante varejista na revenda de etanol está sujeita à alíquota zero, ressalvada a venda realizada por varejista que tenha efetuado a própria importação.","orientacao_simples":"Segregar a receita no PGDAS-D como tributação monofásica de PIS e Cofins. Se o próprio varejista importou o produto, refaça a consulta com o perfil Importador.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar que o álcool é efetivamente etanol combustível e identificar se é hidratado ou anidro.","Confirmar o papel da empresa na cadeia e se houve importação própria."]'::jsonb,
  '["Comerciante atacadista comum não foi equiparado automaticamente a distribuidor de combustíveis.","Cooperativas, vendas diretas e relações de interdependência possuem regras próprias e permanecem sujeitas a análise específica.","Álcool destinado a bebidas, cosméticos, limpeza, uso farmacêutico ou solvente não deve receber esta conclusão apenas pelo NCM."]'::jsonb,
  '[
    {"titulo":"Lei nº 9.718/1998","referencia":"Art. 5º, caput e §§ 1º, 4º e 4º-B","url":"https://www.planalto.gov.br/ccivil_03/leis/l9718compilada.htm"},
    {"titulo":"Receita Federal — créditos de revendedores de combustíveis","referencia":"Item 2.1","url":"https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/restituicao-ressarcimento-reembolso-e-compensacao/conformidade-tributaria/operacao-inflamavel-II"}
  ]'::jsonb,
  '2026-01-01', '2026-12-31', true
),
(
  'PISCOFINS_MONOFASICO_BIODIESEL', 1, array['pis','cofins'], 'exato',
  array['38260000'], '{}', 182,
  'Biodiesel',
  'Biodiesel — incidência monofásica',
  'O PIS e a Cofins incidentes sobre o biodiesel são concentrados no produtor ou importador. A revenda posterior é tratada com alíquota zero, desde que a empresa não seja a própria produtora ou importadora.',
  true, array['biodiesel'], '{}',
  '[
    {"perfis":["fabricante"],"operacoes":["venda_producao"],"tratamento":"inconclusivo","titulo":"Produtor de biodiesel: confirmar coeficientes e regime","explicacao":"A Lei nº 11.116/2005 prevê incidência no produtor ou importador e permite regime especial por metro cúbico, com coeficientes de redução alteráveis por ato do Poder Executivo.","orientacao_simples":"Confirme o regime adotado e os coeficientes vigentes na data da operação antes de calcular PIS/Cofins."},
    {"perfis":["importador"],"operacoes":["importacao","venda_producao"],"tratamento":"inconclusivo","titulo":"Importador de biodiesel: incidência própria","explicacao":"A importação e a venda pelo importador integram a etapa concentrada e exigem a legislação aplicável à importação e ao regime escolhido.","orientacao_simples":"Não aplique a alíquota zero da revenda à importação própria. Confirme as contribuições na importação e na venda subsequente."},
    {"perfis":["distribuidor","atacadista","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda de biodiesel: alíquota zero","explicacao":"A receita da revenda de biodiesel na etapa posterior à incidência concentrada está sujeita à alíquota zero de PIS/Cofins.","orientacao_simples":"Segregar a receita no PGDAS-D como tributação monofásica de PIS e Cofins. Os demais tributos do Simples Nacional continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"001","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar que o produto corresponde a biodiesel do NCM 3826.00.00.","Confirmar que se trata de revenda de produto adquirido de terceiro, sem produção ou importação própria."]'::jsonb,
  '["Misturas e produtos que não correspondam à descrição legal de biodiesel exigem classificação própria.","Os valores da etapa concentrada variam conforme coeficientes e vigência e, por isso, não são apresentados como alíquota fixa nesta versão."]'::jsonb,
  '[
    {"titulo":"Lei nº 11.116/2005","referencia":"Arts. 3º e 4º","url":"https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11116.htm"},
    {"titulo":"Receita Federal — créditos de revendedores de combustíveis","referencia":"Item 2.1","url":"https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/restituicao-ressarcimento-reembolso-e-compensacao/conformidade-tributaria/operacao-inflamavel-II"}
  ]'::jsonb,
  '2026-01-01', '2026-12-31', true
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
