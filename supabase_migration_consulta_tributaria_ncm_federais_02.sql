-- ============================================================================
-- CONSULTA TRIBUTÁRIA NCM — CATÁLOGO FEDERAL 02
--
-- Complementa o catálogo de PIS/Cofins com os metadados de escritura da
-- EFD-Contribuições (CST e natureza da receita), corrige o alcance do grupo
-- de perfumaria/higiene e inclui os produtos farmacêuticos da Lei 10.147/2000.
--
-- A carga é idempotente e pressupõe a execução anterior de
-- supabase_migration_consulta_tributaria_ncm.sql.
-- ============================================================================

do $$
begin
  if to_regclass('public.tributario_ncm_regras') is null then
    raise exception 'Execute primeiro supabase_migration_consulta_tributaria_ncm.sql';
  end if;
end
$$;

-- Os metadados abaixo não alteram a conclusão das regras já instaladas.
-- Eles identificam a escrituração correspondente na Tabela 4.3.10.
update public.tributario_ncm_regras r
set resultados = (
  select jsonb_agg(
    item || case
      when item->>'tratamento' = 'tributacao_concentrada'
        then jsonb_build_object(
          'cst_saida', '02',
          'codigo_natureza_receita', case r.codigo_regra
            when 'PISCOFINS_MONOFASICO_PNEUS_CAMARAS' then '304'
            when 'PISCOFINS_MONOFASICO_VEICULOS_MAQUINAS' then '301'
          end,
          'tabela_efd', '4.3.10'
        )
      when item->>'tratamento' = 'aliquota_zero'
        then jsonb_build_object(
          'cst_saida', '04',
          'codigo_natureza_receita', '003',
          'tabela_efd', '4.3.10'
        )
      else '{}'::jsonb
    end
    order by ordinalidade
  )
  from jsonb_array_elements(r.resultados) with ordinality as itens(item, ordinalidade)
), updated_at = now()
where r.codigo_regra in (
  'PISCOFINS_MONOFASICO_PNEUS_CAMARAS',
  'PISCOFINS_MONOFASICO_VEICULOS_MAQUINAS'
);

-- A versão 1 de perfumaria não continha os códigos autônomos seguros da
-- alínea b do art. 1º. Ela é preservada para auditoria, mas deixa de participar
-- das consultas vigentes quando a versão 2 é instalada.
update public.tributario_ncm_regras
set ativo = false, updated_at = now()
where codigo_regra = 'PISCOFINS_MONOFASICO_HIGIENE_PERFUMARIA'
  and versao = 1;

insert into public.tributario_ncm_regras (
  codigo_regra, versao, tributos, tipo_correspondencia, padroes, padroes_excluir,
  prioridade, categoria, titulo, explicacao, descricao_obrigatoria,
  palavras_incluir, palavras_excluir, resultados, condicoes, alertas, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values
(
  'PISCOFINS_MONOFASICO_HIGIENE_PERFUMARIA', 2, array['pis','cofins'], 'prefixo',
  array['3303','3304','3305','3307','34012010','96032100'], '{}', 130,
  'Perfumaria, toucador e higiene pessoal',
  'PIS/Cofins monofásicos — perfumaria e higiene pessoal',
  'A Lei nº 10.147/2000 concentra PIS e Cofins no industrial ou importador e reduz a zero as etapas posteriores para os produtos expressamente relacionados.',
  true, '{}', '{}',
  '[
    {"perfis":["fabricante"],"operacoes":["venda_producao"],"tratamento":"tributacao_concentrada","titulo":"Industrial: tributação concentrada","explicacao":"A venda de produção própria ocupa a etapa concentrada do regime monofásico.","orientacao_simples":"Destacar a receita como monofásica no PGDAS-D, desconsiderar os percentuais de PIS/Cofins do DAS e conferir o recolhimento concentrado pelas alíquotas da legislação específica.","aliquota_pis":2.2,"aliquota_cofins":10.3,"cst_saida":"02","codigo_natureza_receita":"202","tabela_efd":"4.3.10"},
    {"perfis":["importador"],"operacoes":["importacao","venda_producao"],"tratamento":"tributacao_concentrada","titulo":"Importador: tributação concentrada","explicacao":"A operação do importador integra a etapa concentrada prevista na Lei nº 10.147/2000.","orientacao_simples":"Destacar a receita como monofásica no PGDAS-D e conferir separadamente a importação e a venda sujeitas à legislação específica.","aliquota_pis":2.2,"aliquota_cofins":10.3,"cst_saida":"02","codigo_natureza_receita":"202","tabela_efd":"4.3.10"},
    {"perfis":["atacadista","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda: alíquota zero na etapa posterior","explicacao":"A revenda por pessoa jurídica que não seja industrial nem importadora integra a etapa posterior do regime monofásico.","orientacao_simples":"Segregar a receita no PGDAS-D como tributação monofásica de PIS e Cofins; os demais tributos do Simples continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"002","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar a descrição comercial e a classificação fiscal vigente.","Confirmar se a empresa industrializa/importa ou somente revende a mercadoria."]'::jsonb,
  '["A posição 33.06 não integra esta regra.","O NCM 3401.11.90 exige conferência do Ex 01 e será tratado em regra específica; a consulta não o conclui nesta etapa."]'::jsonb,
  '[
    {"titulo":"Lei nº 10.147/2000","referencia":"Arts. 1º, I, b, e 2º","url":"https://www.planalto.gov.br/ccivil_03/leis/l10147.htm"},
    {"titulo":"EFD-Contribuições","referencia":"Tabela 4.3.10, códigos 002 e 202 — versão 1.24","url":"https://sped.rfb.gov.br/item/show/1638"}
  ]'::jsonb,
  '2013-03-08', '2026-12-31', true
),
(
  'PISCOFINS_MONOFASICO_FARMACEUTICOS', 1, array['pis','cofins'], 'prefixo',
  array[
    '3001','3003','3004',
    '3002101','3002102','3002103','3002201','3002202','3006301','3006302',
    '30029020','30029092','30029099','30051010','30066000'
  ],
  array['30039056','30049046'], 135,
  'Produtos farmacêuticos',
  'PIS/Cofins monofásicos — produtos farmacêuticos',
  'Os produtos farmacêuticos expressamente relacionados no art. 1º, I, a, da Lei nº 10.147/2000 estão sujeitos à tributação concentrada no industrial ou importador e à alíquota zero nas etapas posteriores.',
  true, '{}', '{}',
  '[
    {"perfis":["fabricante"],"operacoes":["venda_producao"],"tratamento":"tributacao_concentrada","titulo":"Industrial: tributação concentrada","explicacao":"A venda do produto farmacêutico industrializado pela empresa ocupa a etapa concentrada.","orientacao_simples":"Destacar a receita como monofásica no PGDAS-D, desconsiderar os percentuais de PIS/Cofins do DAS e apurar as contribuições pelas alíquotas concentradas da legislação específica.","aliquota_pis":2.1,"aliquota_cofins":9.9,"cst_saida":"02","codigo_natureza_receita":"201","tabela_efd":"4.3.10"},
    {"perfis":["importador"],"operacoes":["importacao","venda_producao"],"tratamento":"tributacao_concentrada","titulo":"Importador: tributação concentrada","explicacao":"A importação e a venda subsequente pelo importador exigem a verificação das regras específicas da etapa concentrada.","orientacao_simples":"Destacar a receita como monofásica no PGDAS-D e conferir separadamente as contribuições incidentes na importação e na venda.","aliquota_pis":2.1,"aliquota_cofins":9.9,"cst_saida":"02","codigo_natureza_receita":"201","tabela_efd":"4.3.10"},
    {"perfis":["atacadista","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda: alíquota zero na etapa posterior","explicacao":"A receita de revenda por pessoa jurídica não enquadrada como industrial ou importadora está na etapa posterior do regime monofásico.","orientacao_simples":"Segregar a receita no PGDAS-D como tributação monofásica de PIS e Cofins; os demais tributos do Simples continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"002","tabela_efd":"4.3.10"}
  ]'::jsonb,
  '["Confirmar que a mercadoria corresponde à descrição legal do código NCM.","Confirmar o papel da empresa na cadeia e se a receita é de produção/importação ou revenda."]'::jsonb,
  '["Os NCM 3003.90.56 e 3004.90.46 estão expressamente excluídos desta regra.","Medicamentos sujeitos ao regime especial de crédito presumido exigem análise adicional e não são concluídos apenas pelo NCM."]'::jsonb,
  '[
    {"titulo":"Lei nº 10.147/2000","referencia":"Arts. 1º, I, a, 2º e 3º","url":"https://www.planalto.gov.br/ccivil_03/leis/l10147.htm"},
    {"titulo":"EFD-Contribuições","referencia":"Tabela 4.3.10, códigos 002 e 201 — versão 1.24","url":"https://sped.rfb.gov.br/item/show/1638"}
  ]'::jsonb,
  '2011-01-01', '2026-12-31', true
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

