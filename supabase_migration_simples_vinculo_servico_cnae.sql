-- ============================================================================
-- IDENTIDADE DO SERVIÇO DA NFS-e × CNAE CONSULTIVO
--
-- O anexo continua definido pela configuração do serviço efetivamente
-- informado na NFS-e. O CNAE relacionado permanece apenas como conferência.
-- Distingue item nacional da Lista de Serviços de código municipal e evita
-- colisão entre códigos municipais iguais de municípios diferentes.
-- Idempotente.
-- ============================================================================

alter table public.sn_config_servicos_atividade
  add column if not exists chave_servico text,
  add column if not exists origem_codigo_servico text,
  add column if not exists municipio_codigo text;

-- Registros anteriores não informavam a origem do código. Eles são mantidos
-- expressamente como legados, sem presumir que fossem nacionais ou municipais.
update public.sn_config_servicos_atividade
set
  origem_codigo_servico = coalesce(origem_codigo_servico, 'legado'),
  chave_servico = coalesce(
    chave_servico,
    'legado:' || upper(regexp_replace(codigo_servico, '[^[:alnum:]]', '', 'g'))
  )
where origem_codigo_servico is null or chave_servico is null;

alter table public.sn_config_servicos_atividade
  alter column chave_servico set not null,
  alter column origem_codigo_servico set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sn_cfg_atv_origem_codigo_servico'
      and conrelid = 'public.sn_config_servicos_atividade'::regclass
  ) then
    alter table public.sn_config_servicos_atividade
      add constraint sn_cfg_atv_origem_codigo_servico
      check (origem_codigo_servico in ('lista_nacional','municipal','legado'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sn_cfg_atv_municipio_formato'
      and conrelid = 'public.sn_config_servicos_atividade'::regclass
  ) then
    alter table public.sn_config_servicos_atividade
      add constraint sn_cfg_atv_municipio_formato
      check (municipio_codigo is null or municipio_codigo ~ '^[0-9]{7}$');
  end if;
end $$;

-- A chave antiga não distinguia a origem nem o município do código.
alter table public.sn_config_servicos_atividade
  drop constraint if exists sn_config_servicos_atividade_empresa_id_codigo_servico_key;

create unique index if not exists uq_sn_cfg_atv_empresa_chave_servico
  on public.sn_config_servicos_atividade(empresa_id, chave_servico);

create index if not exists idx_sn_cfg_atv_origem_municipio
  on public.sn_config_servicos_atividade(origem_codigo_servico, municipio_codigo);

comment on column public.sn_config_servicos_atividade.chave_servico is
  'Identidade técnica do serviço da NFS-e: lista nacional ou código municipal acompanhado do município.';
comment on column public.sn_config_servicos_atividade.cnae_vinculado is
  'CNAE relacionado ao serviço somente para consulta e conferência; não substitui o código da NFS-e nem altera automaticamente o anexo.';

-- ----------------------------------------------------------------------------
-- CATÁLOGO GLOBAL E VERSIONADO DE CORRESPONDÊNCIAS SERVIÇO × CNAE
-- Não representa conversão oficial universal. Cada regra registra candidatos
-- tecnicamente compatíveis e exige confirmação do usuário.
-- ----------------------------------------------------------------------------

create table if not exists public.tributario_servico_cnae_vinculos (
  id                 uuid primary key default gen_random_uuid(),
  codigo_regra       text not null,
  versao             integer not null check (versao > 0),
  tipo_codigo        text not null check (tipo_codigo in ('subitem_lc116','codigo_nacional','codigo_municipal')),
  codigo_padrao      text not null,
  municipio_codigo   text,
  cnaes              text[] not null check (cardinality(cnaes) > 0),
  palavras_incluir   text[] not null default '{}',
  palavras_excluir   text[] not null default '{}',
  prioridade         smallint not null default 0,
  confianca          text not null check (confianca in ('alta','media','baixa')),
  conclusivo         boolean not null default false,
  explicacao         text not null,
  fontes             jsonb not null default '[]'::jsonb check (jsonb_typeof(fontes) = 'array'),
  vigencia_inicio    date not null,
  vigencia_fim       date,
  ativo              boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (codigo_regra, versao),
  check (municipio_codigo is null or municipio_codigo ~ '^[0-9]{7}$'),
  check (tipo_codigo = 'codigo_municipal' or municipio_codigo is null),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

create index if not exists idx_tributario_servico_cnae_codigo
  on public.tributario_servico_cnae_vinculos(tipo_codigo, codigo_padrao, municipio_codigo, prioridade desc);
create index if not exists idx_tributario_servico_cnae_vigencia
  on public.tributario_servico_cnae_vinculos(ativo, vigencia_inicio, vigencia_fim);

alter table public.tributario_servico_cnae_vinculos enable row level security;

drop policy if exists "tributario_servico_cnae_select" on public.tributario_servico_cnae_vinculos;
create policy "tributario_servico_cnae_select"
  on public.tributario_servico_cnae_vinculos
  for select using (auth.role() = 'authenticated');

revoke all on table public.tributario_servico_cnae_vinculos from anon;
grant select on table public.tributario_servico_cnae_vinculos to authenticated;

insert into public.tributario_servico_cnae_vinculos (
  codigo_regra, versao, tipo_codigo, codigo_padrao, municipio_codigo, cnaes,
  palavras_incluir, palavras_excluir, prioridade, confianca, conclusivo,
  explicacao, fontes, vigencia_inicio, vigencia_fim, ativo
)
values
  ('SERVICO_ADVOCACIA', 1, 'subitem_lc116', '1714', null, array['6911701'], '{}', '{}', 100, 'alta', true,
   'O subitem 17.14 identifica advocacia e o CNAE 6911-7/01 compreende serviços advocatícios.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 17.14 — Advocacia","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 6911-7/01 — Serviços advocatícios","url":"https://cnae.ibge.gov.br/?subclasse=6911701&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_CONTABILIDADE', 1, 'subitem_lc116', '1719', null, array['6920601','6920602'], '{}', '{}', 90, 'media', false,
   'O subitem 17.19 abrange contabilidade e serviços técnicos ou auxiliares; a descrição deve distinguir contabilidade de consultoria ou auditoria contábil e tributária.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 17.19 — Contabilidade","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"Classe CNAE 69.20-6","url":"https://cnae.ibge.gov.br/?classe=69206&tipo=cnae&view=classe"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_AGENCIA_VIAGEM', 1, 'subitem_lc116', '0902', null, array['7911200'], '{}', '{}', 100, 'alta', true,
   'O subitem 9.02 e o CNAE 7911-2/00 descrevem atividades de agenciamento, organização e intermediação de viagens.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 9.02 — Agenciamento e organização de viagens","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 7911-2/00 — Agências de viagens","url":"https://cnae.ibge.gov.br/?subclasse=7911200&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_PROGRAMACAO', 1, 'subitem_lc116', '0102', null, array['6201501'], '{}', '{}', 90, 'media', true,
   'Programação costuma corresponder ao desenvolvimento de programas de computador sob encomenda; confirme a descrição contratada.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 1.02 — Programação","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 6201-5/01","url":"https://cnae.ibge.gov.br/?subclasse=6201501&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_PROCESSAMENTO_DADOS', 1, 'subitem_lc116', '0103', null, array['6311900'], '{}', '{}', 90, 'media', true,
   'Processamento de dados e atividades correlatas podem corresponder ao CNAE 6311-9/00; hospedagem e outros serviços devem ser confirmados pela descrição.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 1.03 — Processamento de dados e congêneres","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 6311-9/00","url":"https://cnae.ibge.gov.br/?subclasse=6311900&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_CONSULTORIA_TI', 1, 'subitem_lc116', '0106', null, array['6204000'], '{}', '{}', 100, 'alta', true,
   'O subitem 1.06 identifica assessoria e consultoria em informática, compatível com o CNAE 6204-0/00.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 1.06 — Assessoria e consultoria em informática","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 6204-0/00","url":"https://cnae.ibge.gov.br/?subclasse=6204000&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_SUPORTE_TI', 1, 'subitem_lc116', '0107', null, array['6209100'], '{}', '{}', 95, 'media', true,
   'Suporte técnico em informática costuma corresponder ao CNAE 6209-1/00; instalação de equipamentos deve ser segregada.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 1.07 — Suporte técnico em informática","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 6209-1/00","url":"https://cnae.ibge.gov.br/?subclasse=6209100&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_CABELEIREIROS', 1, 'subitem_lc116', '0601', null, array['9602501'], '{}', '{}', 100, 'alta', true,
   'O subitem 6.01 identifica serviços de cabeleireiros, correspondentes ao CNAE 9602-5/01.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 6.01 — Cabeleireiros","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 9602-5/01","url":"https://cnae.ibge.gov.br/?subclasse=9602501&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_ESTETICA', 1, 'subitem_lc116', '0602', null, array['9602502'], '{}', '{}', 90, 'media', true,
   'O subitem 6.02 abrange cuidados pessoais e estética; confirme se não se trata de atividade de saúde com CNAE específico.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 6.02 — Esteticistas e atividades congêneres","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 9602-5/02","url":"https://cnae.ibge.gov.br/?subclasse=9602502&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_MONITORAMENTO_ELETRONICO', 1, 'subitem_lc116', '1102', null, array['8020001'], array['monitoramento eletrônico','alarme','sistema de segurança'], '{}', 120, 'alta', true,
   'A descrição indica monitoramento de sistemas de segurança eletrônico, compatível com o CNAE 8020-0/01.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 11.02 — Vigilância, segurança ou monitoramento","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 8020-0/01","url":"https://cnae.ibge.gov.br/?subclasse=8020001&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_VIGILANCIA_PRIVADA', 1, 'subitem_lc116', '1102', null, array['8011101'], array['vigilância','segurança privada'], array['monitoramento eletrônico'], 110, 'alta', true,
   'A descrição indica vigilância ou segurança privada, compatível com o CNAE 8011-1/01.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 11.02 — Vigilância e segurança","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 8011-1/01","url":"https://cnae.ibge.gov.br/?subclasse=8011101&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_SEGURANCA_GERAL', 1, 'subitem_lc116', '1102', null, array['8011101','8020001'], '{}', '{}', 20, 'media', false,
   'O subitem 11.02 pode representar vigilância física ou monitoramento eletrônico. A descrição do serviço deve definir o CNAE.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 11.02","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_LIMPEZA', 1, 'subitem_lc116', '0710', null, array['8121400','8129000'], '{}', '{}', 40, 'media', false,
   'O subitem 7.10 abrange diferentes serviços de limpeza. Confirme se a atividade é limpeza de prédios e domicílios ou outra limpeza especializada.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 7.10 — Limpeza e conservação","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAEs 8121-4/00 e 8129-0/00","url":"https://cnae.ibge.gov.br/?classe=81214&tipo=cnae&view=classe"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_ARQUITETURA', 1, 'subitem_lc116', '0701', null, array['7111100'], array['arquitetura','arquitetônico'], '{}', 120, 'alta', true,
   'A descrição identifica serviço de arquitetura, compatível com o CNAE 7111-1/00.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 7.01 — Engenharia, arquitetura e congêneres","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 7111-1/00","url":"https://cnae.ibge.gov.br/?subclasse=7111100&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_ENGENHARIA', 1, 'subitem_lc116', '0701', null, array['7112000'], array['engenharia','engenheiro'], array['arquitetura'], 110, 'alta', true,
   'A descrição identifica serviço de engenharia, compatível com o CNAE 7112-0/00.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 7.01 — Engenharia, arquitetura e congêneres","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"},{"titulo":"CONCLA/IBGE","referencia":"CNAE 7112-0/00","url":"https://cnae.ibge.gov.br/?subclasse=7112000&tipo=cnae&view=subclasse"}]'::jsonb,
   '2026-01-01', null, true),

  ('SERVICO_TECNICO_0701_GERAL', 1, 'subitem_lc116', '0701', null, array['7111100','7112000'], '{}', '{}', 20, 'baixa', false,
   'O subitem 7.01 abrange várias profissões técnicas. Sem descrição suficiente, arquitetura e engenharia são apenas candidatos iniciais.',
   '[{"titulo":"LC nº 116/2003","referencia":"Subitem 7.01","url":"https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm"}]'::jsonb,
   '2026-01-01', null, true)
on conflict (codigo_regra, versao) do nothing;

comment on table public.tributario_servico_cnae_vinculos is
  'Correspondências indicativas e versionadas entre serviços da NFS-e e CNAEs candidatos; nunca substituem a confirmação do usuário.';

-- ----------------------------------------------------------------------------
-- TRILHA AUTOMÁTICA DE AUDITORIA (SEM JUSTIFICATIVA OBRIGATÓRIA)
-- ----------------------------------------------------------------------------

create table if not exists public.sn_config_servicos_atividade_historico (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id         uuid references public.empresas(id) on delete cascade not null,
  config_id          uuid references public.sn_config_servicos_atividade(id) on delete cascade not null,
  usuario_id         uuid,
  tipo_evento        text not null check (tipo_evento in ('criado','alterado')),
  chave_servico      text not null,
  codigo_servico     text not null,
  decisao            jsonb not null check (jsonb_typeof(decisao) = 'object'),
  created_at         timestamptz not null default now()
);

create index if not exists idx_sn_cfg_atv_hist_empresa_data
  on public.sn_config_servicos_atividade_historico(empresa_id, created_at desc);
create index if not exists idx_sn_cfg_atv_hist_config
  on public.sn_config_servicos_atividade_historico(config_id, created_at desc);

alter table public.sn_config_servicos_atividade_historico enable row level security;

drop policy if exists "sn_cfg_atv_hist_select" on public.sn_config_servicos_atividade_historico;
create policy "sn_cfg_atv_hist_select"
  on public.sn_config_servicos_atividade_historico
  for select using (public.is_member_of(org_id));

revoke all on table public.sn_config_servicos_atividade_historico from anon, authenticated;
grant select on table public.sn_config_servicos_atividade_historico to authenticated;

create or replace function public.registrar_historico_config_servico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mudou boolean;
begin
  if tg_op = 'INSERT' then
    mudou := true;
  else
    mudou := (
      old.chave_servico,
      old.codigo_servico,
      old.origem_codigo_servico,
      old.municipio_codigo,
      old.modo_tributacao,
      old.anexo_fixo,
      old.cnae_vinculado,
      old.tratamento_sugerido,
      old.anexo_sugerido,
      old.confianca_sugestao,
      old.regra_cnae_versao
    ) is distinct from (
      new.chave_servico,
      new.codigo_servico,
      new.origem_codigo_servico,
      new.municipio_codigo,
      new.modo_tributacao,
      new.anexo_fixo,
      new.cnae_vinculado,
      new.tratamento_sugerido,
      new.anexo_sugerido,
      new.confianca_sugestao,
      new.regra_cnae_versao
    );
  end if;

  if mudou then
    insert into public.sn_config_servicos_atividade_historico (
      org_id, empresa_id, config_id, usuario_id, tipo_evento,
      chave_servico, codigo_servico, decisao
    ) values (
      new.org_id,
      new.empresa_id,
      new.id,
      auth.uid(),
      case when tg_op = 'INSERT' then 'criado' else 'alterado' end,
      new.chave_servico,
      new.codigo_servico,
      jsonb_build_object(
        'origem_codigo_servico', new.origem_codigo_servico,
        'municipio_codigo', new.municipio_codigo,
        'modo_tributacao', new.modo_tributacao,
        'anexo_fixo', new.anexo_fixo,
        'cnae_vinculado', new.cnae_vinculado,
        'tratamento_sugerido', new.tratamento_sugerido,
        'anexo_sugerido', new.anexo_sugerido,
        'confianca_sugestao', new.confianca_sugestao,
        'regra_cnae_versao', new.regra_cnae_versao
      )
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.registrar_historico_config_servico() from public, anon, authenticated;

drop trigger if exists trg_sn_cfg_atv_historico on public.sn_config_servicos_atividade;
create trigger trg_sn_cfg_atv_historico
after insert or update on public.sn_config_servicos_atividade
for each row execute function public.registrar_historico_config_servico();

comment on table public.sn_config_servicos_atividade_historico is
  'Histórico automático das configurações por serviço, incluindo CNAE relacionado, seleção manual e sugestão vigente.';
