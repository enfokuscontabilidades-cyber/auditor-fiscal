-- =======================================================================
-- MIGRACAO SIMPLES SERVICOS + NFS-e ABRASF
-- Idempotente: pode ser executada multiplas vezes no Supabase Studio.
-- =======================================================================

create table if not exists public.sn_config_servicos_empresa (
  id                  uuid default gen_random_uuid() primary key,
  org_id              uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id          uuid references public.empresas(id) on delete cascade not null,
  modo_servico        text not null default 'anexo_fixo'
                        check (modo_servico in ('anexo_fixo','fator_r')),
  anexo_fixo          text check (anexo_fixo in ('III','IV','V')),
  atividade_descricao text,
  observacoes         text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique(empresa_id)
);

create index if not exists idx_sn_cfg_serv_org
  on public.sn_config_servicos_empresa(org_id);
create index if not exists idx_sn_cfg_serv_empresa
  on public.sn_config_servicos_empresa(empresa_id);

alter table public.sn_config_servicos_empresa enable row level security;

drop policy if exists "sn_cfg_serv_select" on public.sn_config_servicos_empresa;
drop policy if exists "sn_cfg_serv_insert" on public.sn_config_servicos_empresa;
drop policy if exists "sn_cfg_serv_update" on public.sn_config_servicos_empresa;
drop policy if exists "sn_cfg_serv_delete" on public.sn_config_servicos_empresa;

create policy "sn_cfg_serv_select" on public.sn_config_servicos_empresa
  for select using (public.is_member_of(org_id));
create policy "sn_cfg_serv_insert" on public.sn_config_servicos_empresa
  for insert with check (auth.role() = 'authenticated');
create policy "sn_cfg_serv_update" on public.sn_config_servicos_empresa
  for update using (public.is_member_of(org_id));
create policy "sn_cfg_serv_delete" on public.sn_config_servicos_empresa
  for delete using (public.is_member_of(org_id));

create table if not exists public.sn_folha_mensal (
  id            uuid default gen_random_uuid() primary key,
  org_id        uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id    uuid references public.empresas(id) on delete cascade not null,
  competencia   text not null,
  valor_folha   numeric(15,2) not null default 0,
  origem        text not null default 'manual'
                  check (origem in ('manual','importacao_excel')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(empresa_id, competencia)
);

create index if not exists idx_sn_folha_org
  on public.sn_folha_mensal(org_id);
create index if not exists idx_sn_folha_empresa
  on public.sn_folha_mensal(empresa_id);
create index if not exists idx_sn_folha_competencia
  on public.sn_folha_mensal(competencia);

alter table public.sn_folha_mensal enable row level security;

drop policy if exists "sn_folha_select" on public.sn_folha_mensal;
drop policy if exists "sn_folha_insert" on public.sn_folha_mensal;
drop policy if exists "sn_folha_update" on public.sn_folha_mensal;
drop policy if exists "sn_folha_delete" on public.sn_folha_mensal;

create policy "sn_folha_select" on public.sn_folha_mensal
  for select using (public.is_member_of(org_id));
create policy "sn_folha_insert" on public.sn_folha_mensal
  for insert with check (auth.role() = 'authenticated');
create policy "sn_folha_update" on public.sn_folha_mensal
  for update using (public.is_member_of(org_id));
create policy "sn_folha_delete" on public.sn_folha_mensal
  for delete using (public.is_member_of(org_id));
