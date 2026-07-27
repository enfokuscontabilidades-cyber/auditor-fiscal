-- ============================================================================
-- INTEGRAÇÃO CONSULTIVA — CNAE x CONFIGURAÇÃO DE SERVIÇOS DO SIMPLES
-- Mantém a escolha manual do usuário e registra somente a sugestão jurídica
-- utilizada para conferência. Idempotente.
-- ============================================================================

alter table public.sn_config_servicos_atividade
  add column if not exists cnae_vinculado text,
  add column if not exists tratamento_sugerido text,
  add column if not exists anexo_sugerido text,
  add column if not exists confianca_sugestao text,
  add column if not exists regra_cnae_versao text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sn_cfg_atv_cnae_formato'
      and conrelid = 'public.sn_config_servicos_atividade'::regclass
  ) then
    alter table public.sn_config_servicos_atividade
      add constraint sn_cfg_atv_cnae_formato
      check (cnae_vinculado is null or cnae_vinculado ~ '^[0-9]{7}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sn_cfg_atv_tratamento_sugerido'
      and conrelid = 'public.sn_config_servicos_atividade'::regclass
  ) then
    alter table public.sn_config_servicos_atividade
      add constraint sn_cfg_atv_tratamento_sugerido
      check (
        tratamento_sugerido is null or tratamento_sugerido in
        ('anexo_i','anexo_ii','anexo_iii','anexo_iv','fator_r','inconclusivo')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sn_cfg_atv_anexo_sugerido'
      and conrelid = 'public.sn_config_servicos_atividade'::regclass
  ) then
    alter table public.sn_config_servicos_atividade
      add constraint sn_cfg_atv_anexo_sugerido
      check (anexo_sugerido is null or anexo_sugerido in ('I','II','III','IV','V'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sn_cfg_atv_confianca_sugestao'
      and conrelid = 'public.sn_config_servicos_atividade'::regclass
  ) then
    alter table public.sn_config_servicos_atividade
      add constraint sn_cfg_atv_confianca_sugestao
      check (confianca_sugestao is null or confianca_sugestao in ('alta','media','baixa'));
  end if;
end $$;

create index if not exists idx_sn_cfg_atv_cnae
  on public.sn_config_servicos_atividade(cnae_vinculado)
  where cnae_vinculado is not null;

comment on column public.sn_config_servicos_atividade.cnae_vinculado is
  'CNAE informado pelo usuário para conferir o código de serviço da NFS-e; não altera automaticamente a apuração.';
comment on column public.sn_config_servicos_atividade.regra_cnae_versao is
  'Versão da regra jurídica exibida como sugestão no momento da última gravação.';
