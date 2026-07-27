-- ============================================================================
-- CATÁLOGO JURÍDICO VERSIONADO — NCM x TRATAMENTO TRIBUTÁRIO
--
-- O catálogo não presume tributação apenas pelo NCM. Cada regra informa o
-- papel da empresa, a operação, condições, fontes e vigência. A primeira carga
-- cobre somente grupos federais de PIS/Cofins validados em lei.
-- Idempotente: pode ser executada múltiplas vezes no Supabase SQL Editor.
-- ============================================================================

create table if not exists public.tributario_ncm_regras (
  id                    uuid primary key default gen_random_uuid(),
  codigo_regra          text not null,
  versao                integer not null check (versao > 0),
  tributos              text[] not null check (cardinality(tributos) > 0),
  tipo_correspondencia  text not null check (tipo_correspondencia in ('exato','prefixo')),
  padroes               text[] not null check (cardinality(padroes) > 0),
  padroes_excluir       text[] not null default '{}',
  prioridade            smallint not null default 0,
  categoria             text not null,
  titulo                text not null,
  explicacao            text not null,
  descricao_obrigatoria boolean not null default false,
  palavras_incluir      text[] not null default '{}',
  palavras_excluir      text[] not null default '{}',
  resultados            jsonb not null check (jsonb_typeof(resultados) = 'array'),
  condicoes             jsonb not null default '[]'::jsonb check (jsonb_typeof(condicoes) = 'array'),
  alertas               jsonb not null default '[]'::jsonb check (jsonb_typeof(alertas) = 'array'),
  fontes                jsonb not null default '[]'::jsonb check (jsonb_typeof(fontes) = 'array'),
  vigencia_inicio       date not null,
  vigencia_fim          date,
  ativo                 boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (codigo_regra, versao),
  check (tributos <@ array['pis','cofins','icms','ipi']::text[]),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

create index if not exists idx_tributario_ncm_regras_vigencia
  on public.tributario_ncm_regras (ativo, vigencia_inicio, vigencia_fim, prioridade desc);
create index if not exists idx_tributario_ncm_regras_padroes
  on public.tributario_ncm_regras using gin (padroes);

alter table public.tributario_ncm_regras enable row level security;

drop policy if exists "tributario_ncm_regras_select" on public.tributario_ncm_regras;
create policy "tributario_ncm_regras_select"
  on public.tributario_ncm_regras
  for select
  using (auth.role() = 'authenticated');

revoke all on table public.tributario_ncm_regras from anon;
grant select on table public.tributario_ncm_regras to authenticated;

insert into public.tributario_ncm_regras (
  codigo_regra, versao, tributos, tipo_correspondencia, padroes, padroes_excluir,
  prioridade, categoria, titulo, explicacao, descricao_obrigatoria,
  palavras_incluir, palavras_excluir, resultados, condicoes, alertas, fontes,
  vigencia_inicio, vigencia_fim, ativo
)
values
(
  'PISCOFINS_MONOFASICO_HIGIENE_PERFUMARIA', 1, array['pis','cofins'], 'prefixo',
  array['3303','3304','3305','3307'], '{}', 120,
  'Perfumaria, toucador e higiene pessoal',
  'PIS/Cofins concentrados — perfumaria e higiene pessoal',
  'A Lei nº 10.147/2000 concentra PIS e Cofins no fabricante ou importador para os produtos alcançados por estas posições da TIPI, excetuada a posição 33.06.',
  false, '{}', '{}',
  '[
    {"perfis":["fabricante"],"operacoes":["venda_producao"],"tratamento":"tributacao_concentrada","titulo":"Fabricante: tributação concentrada","explicacao":"Na venda de produção própria, o fabricante ocupa a etapa concentrada de PIS/Cofins.","orientacao_simples":"No Simples Nacional, segregar a receita como tributação monofásica; o PGDAS-D desconsidera PIS/Cofins no DAS e eventual valor devido na etapa concentrada é apurado fora do Simples, conforme a legislação federal.","aliquota_pis":2.2,"aliquota_cofins":10.3},
    {"perfis":["importador"],"operacoes":["importacao","venda_producao"],"tratamento":"tributacao_concentrada","titulo":"Importador: tributação concentrada","explicacao":"O importador ocupa a etapa concentrada de PIS/Cofins nas operações alcançadas pela lei.","orientacao_simples":"No Simples Nacional, segregar a receita como tributação monofásica; o tratamento da importação e da venda deve ser conferido fora do DAS.","aliquota_pis":2.2,"aliquota_cofins":10.3},
    {"perfis":["atacadista","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda: etapa posterior com alíquota zero","explicacao":"A revenda por pessoa jurídica que não seja industrial nem importadora integra a etapa posterior do regime concentrado.","orientacao_simples":"Segregar a receita no PGDAS-D como tributação monofásica de PIS e Cofins; os demais tributos do Simples continuam incidindo."}
  ]'::jsonb,
  '["Confirmar que a receita decorre da mercadoria classificada no NCM informado.","Confirmar se a empresa atua como fabricante/importador ou apenas revende o produto."]'::jsonb,
  '["A posição 33.06 não integra esta regra.","O NCM não substitui a conferência da descrição e das exceções da TIPI."]'::jsonb,
  '[{"titulo":"Lei nº 10.147/2000","referencia":"Arts. 1º e 2º","url":"https://www.planalto.gov.br/ccivil_03/leis/l10147.htm"},{"titulo":"Manual do PGDAS-D","referencia":"Item 6.6.4 — Tributação monofásica","url":"https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/MANUAL_PGDAS-D_2018_V4.pdf"}]'::jsonb,
  '2007-07-01', '2026-12-31', true
),
(
  'PISCOFINS_MONOFASICO_PNEUS_CAMARAS', 1, array['pis','cofins'], 'prefixo',
  array['4011','4013'], '{}', 120,
  'Pneus novos e câmaras de ar',
  'PIS/Cofins concentrados — pneus novos e câmaras de ar',
  'A Lei nº 10.485/2002 concentra PIS e Cofins no fabricante ou importador de pneus novos e câmaras de ar e prevê alíquota zero nas etapas atacadista e varejista.',
  true, '{}', '{}',
  '[
    {"perfis":["fabricante"],"operacoes":["venda_producao"],"tratamento":"tributacao_concentrada","titulo":"Fabricante: tributação concentrada","explicacao":"A venda de produção própria está na etapa concentrada de PIS/Cofins.","orientacao_simples":"No Simples Nacional, segregar PIS/Cofins como tributação monofásica e conferir a apuração fora do DAS.","aliquota_pis":2.0,"aliquota_cofins":9.5},
    {"perfis":["importador"],"operacoes":["importacao","venda_producao"],"tratamento":"tributacao_concentrada","titulo":"Importador: tributação concentrada","explicacao":"O importador ocupa a etapa concentrada prevista para estes produtos.","orientacao_simples":"No Simples Nacional, segregar PIS/Cofins como tributação monofásica e conferir importação e venda fora do DAS.","aliquota_pis":2.0,"aliquota_cofins":9.5},
    {"perfis":["atacadista","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda: alíquota zero na etapa posterior","explicacao":"A receita de revenda por comerciante atacadista ou varejista está na etapa posterior do regime.","orientacao_simples":"Segregar a receita no PGDAS-D como tributação monofásica de PIS e Cofins; os demais tributos continuam incidindo."}
  ]'::jsonb,
  '["Confirmar que se trata de pneu novo ou câmara de ar.","Confirmar o papel da empresa na cadeia e se a operação é produção/importação ou revenda."]'::jsonb,
  '["A Lei nº 10.485/2002 afasta expressamente os produtos usados."]'::jsonb,
  '[{"titulo":"Lei nº 10.485/2002","referencia":"Arts. 5º e 6º","url":"https://www.planalto.gov.br/ccivil_03/leis/2002/l10485compilado.htm"},{"titulo":"Manual do PGDAS-D","referencia":"Item 6.6.4 — Tributação monofásica","url":"https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/MANUAL_PGDAS-D_2018_V4.pdf"}]'::jsonb,
  '2007-07-01', '2026-12-31', true
),
(
  'PISCOFINS_MONOFASICO_VEICULOS_MAQUINAS', 1, array['pis','cofins'], 'prefixo',
  array['7309','731029','76129012','842481','8429','84306990','8432','8433','8434','8435','8436','8437','8701','8702','8703','8704','8705','8706','87162000'], '{}', 110,
  'Máquinas, implementos e veículos',
  'PIS/Cofins concentrados — máquinas e veículos especificados em lei',
  'A Lei nº 10.485/2002 estabelece tributação concentrada para os códigos e posições relacionados em seu art. 1º.',
  true, '{}', '{}',
  '[
    {"perfis":["fabricante"],"operacoes":["venda_producao"],"tratamento":"tributacao_concentrada","titulo":"Fabricante: tributação concentrada","explicacao":"A venda dos produtos especificados em lei pelo fabricante está na etapa concentrada.","orientacao_simples":"Segregar PIS/Cofins no PGDAS-D como tributação monofásica e validar a parcela apurada fora do DAS.","aliquota_pis":2.0,"aliquota_cofins":9.6},
    {"perfis":["importador"],"operacoes":["importacao","venda_producao"],"tratamento":"tributacao_concentrada","titulo":"Importador: tributação concentrada","explicacao":"A operação do importador está na etapa concentrada prevista na lei.","orientacao_simples":"Segregar PIS/Cofins no PGDAS-D como tributação monofásica e validar importação e venda fora do DAS.","aliquota_pis":2.0,"aliquota_cofins":9.6},
    {"perfis":["atacadista","varejista"],"operacoes":["revenda","venda_consumidor"],"tratamento":"aliquota_zero","titulo":"Revenda: etapa posterior com alíquota zero","explicacao":"A revenda por comerciante atacadista ou varejista integra a etapa posterior do regime concentrado, observadas as exceções legais.","orientacao_simples":"Segregar a receita no PGDAS-D como tributação monofásica de PIS e Cofins; os demais tributos continuam incidindo."}
  ]'::jsonb,
  '["Confirmar a descrição completa, inclusive Ex TIPI quando houver.","Confirmar se o produto é novo e o papel da empresa na cadeia."]'::jsonb,
  '["Alguns códigos possuem redução de base e exceções específicas; o percentual exibido é a alíquota nominal do caput.","A regra não se aplica a produtos usados."]'::jsonb,
  '[{"titulo":"Lei nº 10.485/2002","referencia":"Arts. 1º, 3º, § 2º, e 6º","url":"https://www.planalto.gov.br/ccivil_03/leis/2002/l10485compilado.htm"},{"titulo":"Manual do PGDAS-D","referencia":"Item 6.6.4 — Tributação monofásica","url":"https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/MANUAL_PGDAS-D_2018_V4.pdf"}]'::jsonb,
  '2007-07-01', '2026-12-31', true
)
on conflict (codigo_regra, versao) do nothing;

comment on table public.tributario_ncm_regras is
  'Regras globais e versionadas por NCM. O resultado depende de perfil, operação, descrição e vigência; não autoriza conclusão automática apenas pelo código.';
