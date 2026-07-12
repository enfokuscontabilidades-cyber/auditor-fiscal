-- =======================================================================
-- MIGRAÇÃO: sn_config_servicos_atividade
-- Configuração de anexo do Simples Nacional por código de serviço (NFS-e).
-- Permite classificar cada serviço detectado nas NFS-e em Anexo III, IV, V
-- ou Fator R, de forma independente por empresa.
-- IDEMPOTENTE: pode ser executada múltiplas vezes sem erros.
-- =======================================================================

create table if not exists public.sn_config_servicos_atividade (
  id                  uuid default gen_random_uuid() primary key,
  org_id              uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id          uuid references public.empresas(id) on delete cascade not null,
  codigo_servico      text not null,
  descricao_servico   text,
  modo_tributacao     text not null default 'fator_r'
                        check (modo_tributacao in ('anexo_fixo','fator_r')),
  anexo_fixo          text check (anexo_fixo in ('III','IV','V')),
  observacoes         text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique(empresa_id, codigo_servico)
);

create index if not exists idx_sn_cfg_atv_org
  on public.sn_config_servicos_atividade(org_id);
create index if not exists idx_sn_cfg_atv_empresa
  on public.sn_config_servicos_atividade(empresa_id);

alter table public.sn_config_servicos_atividade enable row level security;

drop policy if exists "sn_cfg_atv_select" on public.sn_config_servicos_atividade;
drop policy if exists "sn_cfg_atv_insert" on public.sn_config_servicos_atividade;
drop policy if exists "sn_cfg_atv_update" on public.sn_config_servicos_atividade;
drop policy if exists "sn_cfg_atv_delete" on public.sn_config_servicos_atividade;

create policy "sn_cfg_atv_select" on public.sn_config_servicos_atividade
  for select using (public.is_member_of(org_id));
create policy "sn_cfg_atv_insert" on public.sn_config_servicos_atividade
  for insert with check (auth.role() = 'authenticated');
create policy "sn_cfg_atv_update" on public.sn_config_servicos_atividade
  for update using (public.is_member_of(org_id));
create policy "sn_cfg_atv_delete" on public.sn_config_servicos_atividade
  for delete using (public.is_member_of(org_id));
