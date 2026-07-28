-- ============================================================================
-- CONSULTA TRIBUTÁRIA NCM — CATÁLOGO FEDERAL 03 — AUTOPEÇAS
--
-- Carga conservadora dos Anexos I e II da Lei 10.485/2002.
-- - Códigos objetivos do Anexo I podem gerar conclusão por etapa da cadeia.
-- - Códigos dependentes de Ex TIPI ou de destinação específica geram apenas
--   alerta inconclusivo, evitando classificação automática indevida.
-- - As alíquotas de importação não são inferidas nesta carga.
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
  'PISCOFINS_MONOFASICO_AUTOPECAS_ANEXO_I', 1, array['pis','cofins'], 'prefixo',
  array[
    '40161010','6813','70071100','70072100','70091000','83012000','83023000',
    '84073390','84073490','840820','840991','840999','841330','84148021',
    '84148022','841520','84212300','84213100','84314100','84314200','84339090',
    '848310','84832000','848330','848340','848350','850520','85071000','8511',
    '851220','85123000','851240','85129000','85272','853910','85443000','8707',
    '8708','90292010','90299010','90303921','90318040','9032892','91040000',
    '94012000'
  ],
  '{}', 145,
  'Autopeças — Anexo I da Lei 10.485/2002',
  'PIS/Cofins monofásicos — autopeças com enquadramento objetivo',
  'A receita do fabricante ou importador na venda das autopeças relacionadas no Anexo I da Lei nº 10.485/2002 possui alíquota concentrada definida conforme o comprador. A revenda por comerciante atacadista ou varejista fica sujeita à alíquota zero.',
  true, '{}', array['usado','usada','recondicionado','recondicionada'],
  '[
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"contextos_operacao":["fabricante_veiculos"],"tratamento":"tributacao_concentrada","titulo":"Venda destinada a fabricante de veículos ou máquinas","explicacao":"A autopeça será empregada na fabricação dos produtos automotivos previstos no art. 1º da Lei nº 10.485/2002.","orientacao_simples":"Destacar a receita como monofásica no PGDAS-D, desconsiderar os percentuais de PIS/Cofins do DAS e conferir o recolhimento concentrado pela legislação específica.","aliquota_pis":1.65,"aliquota_cofins":7.6,"cst_saida":"02","codigo_natureza_receita":"303","tabela_efd":"4.3.10"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"contextos_operacao":["atacadista_varejista","consumidor"],"tratamento":"tributacao_concentrada","titulo":"Venda destinada ao comércio ou a consumidor da autopeça","explicacao":"Na venda pelo fabricante ou importador para atacadista, varejista ou consumidor, aplicam-se as alíquotas concentradas do art. 3º, II, da Lei nº 10.485/2002.","orientacao_simples":"Destacar a receita como monofásica no PGDAS-D, desconsiderar os percentuais de PIS/Cofins do DAS e conferir o recolhimento concentrado pela legislação específica.","aliquota_pis":2.3,"aliquota_cofins":10.8,"cst_saida":"02","codigo_natureza_receita":"302","tabela_efd":"4.3.10"},
    {"perfis":["fabricante","importador"],"operacoes":["venda_producao"],"contextos_operacao":["nao_informado","outro"],"tratamento":"inconclusivo","titulo":"Identifique o destinatário da autopeça","explicacao":"A alíquota concentrada depende de saber se o comprador é fabricante dos veículos/máquinas previstos em lei, comerciante ou consumidor da peça.","orientacao_simples":"Não conclua a segregação nem a alíquota concentrada antes de confirmar o destinatário e a destinação da mercadoria."},
    {"perfis":["fabricante"],"operacoes":["revenda"],"tratamento":"tributacao_concentrada","titulo":"Fabricante revendendo autopeça adquirida de terceiro","explicacao":"O art. 3º, § 6º, da Lei nº 10.485/2002 determina as alíquotas do inciso II para o fabricante de veículos que revende autopeças.","orientacao_simples":"Destacar a receita como monofásica no PGDAS-D e conferir a tributação concentrada fora dos percentuais de PIS/Cofins do DAS.","aliquota_pis":2.3,"aliquota_cofins":10.8,"cst_saida":"02","codigo_natureza_receita":"302","tabela_efd":"4.3.10"},
    {"perfis":["atacadista","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda: alíquota zero na etapa posterior","explicacao":"A receita de revenda da autopeça por comerciante atacadista ou varejista integra a etapa posterior do regime monofásico.","orientacao_simples":"Segregar a receita no PGDAS-D como tributação monofásica de PIS e Cofins; os demais tributos do Simples continuam incidindo.","cst_saida":"04","codigo_natureza_receita":"003","tabela_efd":"4.3.10"},
    {"perfis":["importador"],"operacoes":["importacao"],"tratamento":"inconclusivo","titulo":"Importação de autopeça exige análise própria","explicacao":"As alíquotas de PIS-Importação e Cofins-Importação variam conforme a condição do importador e podem envolver adicional de Cofins; elas não são iguais, automaticamente, às alíquotas da venda interna.","orientacao_simples":"Não use as alíquotas da venda interna para calcular a importação. Confirme o enquadramento do importador e a legislação vigente da operação aduaneira."}
  ]'::jsonb,
  '["Confirmar que o produto é novo e corresponde à descrição oficial do NCM.","Na venda pelo fabricante/importador, confirmar documentalmente o comprador e a destinação da autopeça.","Na revenda, confirmar que a empresa não industrializou nem importou a mercadoria."]'::jsonb,
  '["A regra não se aplica a produtos usados.","A retenção na fonte aplicável a determinadas aquisições por fabricantes de veículos é uma análise separada.","As alíquotas exibidas neste resultado tratam da venda no mercado interno, não da importação."]'::jsonb,
  '[
    {"titulo":"Lei nº 10.485/2002","referencia":"Art. 3º, caput e §§ 2º, 3º e 6º; Anexo I","url":"https://www.planalto.gov.br/ccivil_03/leis/2002/l10485compilado.htm"},
    {"titulo":"EFD-Contribuições","referencia":"Tabela 4.3.10, códigos 003, 302 e 303","url":"https://sped.rfb.gov.br/item/show/1638"}
  ]'::jsonb,
  '2011-01-01', '2026-12-31', true
),
(
  'PISCOFINS_AUTOPECAS_EX_TIPI_PENDENTE', 1, array['pis','cofins'], 'exato',
  array['40169990','73201000','84139100','84818099','85365090'], '{}', 160,
  'Autopeças dependentes de Ex TIPI',
  'Possível autopeça monofásica — confirmar Ex TIPI',
  'Nestes códigos, somente os Ex expressamente relacionados no Anexo I da Lei nº 10.485/2002 integram o regime de autopeças.',
  true, '{}', '{}',
  '[{"perfis":["qualquer"],"operacoes":["qualquer"],"tratamento":"inconclusivo","titulo":"O NCM depende do Ex TIPI","explicacao":"O código NCM, sozinho, inclui produtos alcançados e não alcançados. É necessário confirmar o Ex TIPI aplicável à mercadoria.","orientacao_simples":"Não segregue PIS/Cofins como monofásico antes de confirmar o Ex TIPI e a descrição legal do produto."}]'::jsonb,
  '["Conferir o Ex TIPI na classificação fiscal e na descrição completa da mercadoria."]'::jsonb,
  '["Ex alcançados: 4016.99.90 Ex 03 e 05; 7320.10.00 Ex 01; 8413.91.00 Ex 01; 8481.80.99 Ex 01 e 02; 8536.50.90 Ex 01."]'::jsonb,
  '[{"titulo":"Lei nº 10.485/2002","referencia":"Anexo I","url":"https://www.planalto.gov.br/ccivil_03/leis/2002/l10485compilado.htm"}]'::jsonb,
  '2011-01-01', '2026-12-31', true
),
(
  'PISCOFINS_AUTOPECAS_ANEXO_II_DESTINACAO_PENDENTE', 1, array['pis','cofins'], 'prefixo',
  array[
    '4009','8431','84089090','84122110','84122190','84123110','84136019',
    '84148019','84149039','84329000','84811000','84812090','84818092',
    '8483601','85011019'
  ],
  array['84314100','84314200'], 155,
  'Autopeças condicionadas à destinação — Anexo II',
  'Possível autopeça monofásica — confirmar aplicação exclusiva',
  'O Anexo II da Lei nº 10.485/2002 alcança estes produtos somente quando forem próprios ou destinados às máquinas e aos veículos expressamente indicados.',
  true, '{}', array['usado','usada','recondicionado','recondicionada'],
  '[{"perfis":["qualquer"],"operacoes":["qualquer"],"tratamento":"inconclusivo","titulo":"A destinação técnica da peça precisa ser confirmada","explicacao":"O mesmo NCM pode classificar mercadoria de uso automotivo alcançada pela lei e mercadoria destinada a outras aplicações.","orientacao_simples":"Não segregue PIS/Cofins como monofásico apenas pelo NCM. Confirme a aplicação da peça, o equipamento de destino e a documentação técnica."}]'::jsonb,
  '["Confirmar catálogo, ficha técnica ou documento do fabricante que demonstre a aplicação da peça.","Confirmar que o produto é próprio para uma das máquinas ou veículos listados no Anexo II."]'::jsonb,
  '["A descrição genérica do NCM não é suficiente para concluir o regime.","A regra não se aplica a produtos usados."]'::jsonb,
  '[{"titulo":"Lei nº 10.485/2002","referencia":"Anexo II","url":"https://www.planalto.gov.br/ccivil_03/leis/2002/l10485compilado.htm"}]'::jsonb,
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

