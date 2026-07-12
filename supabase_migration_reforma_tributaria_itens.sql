-- Campos da Reforma Tributaria (IBS/CBS) nos itens fiscais.
-- Idempotente: pode ser executado mais de uma vez no SQL Editor do Supabase.

alter table public.fa_documentos_itens
  add column if not exists cst_ibs_cbs text,
  add column if not exists cclass_trib text,
  add column if not exists valor_bc_ibs_cbs numeric(15,2) not null default 0,
  add column if not exists aliquota_ibs_uf numeric(9,4) not null default 0,
  add column if not exists valor_ibs_uf numeric(15,2) not null default 0,
  add column if not exists aliquota_ibs_mun numeric(9,4) not null default 0,
  add column if not exists valor_ibs_mun numeric(15,2) not null default 0,
  add column if not exists valor_ibs numeric(15,2) not null default 0,
  add column if not exists aliquota_cbs numeric(9,4) not null default 0,
  add column if not exists valor_cbs numeric(15,2) not null default 0;
