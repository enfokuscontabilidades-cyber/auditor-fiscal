-- =======================================================================
-- MIGRAÇÃO FASE A — Base Fiscal Central + Apuração Simples Nacional
-- Executar no Supabase Studio → SQL Editor
-- IDEMPOTENTE: pode ser executado múltiplas vezes sem erros.
-- =======================================================================

-- -----------------------------------------------------------------------
-- 0. PATCH em tabelas existentes
-- -----------------------------------------------------------------------

-- Adiciona coluna competencia em fa_arquivos_xml (formato "MM/YYYY")
alter table public.fa_arquivos_xml
  add column if not exists competencia text;

create index if not exists idx_fa_xml_competencia
  on public.fa_arquivos_xml(empresa_id, competencia)
  where competencia is not null;

-- Backfill: popula competencia nos registros antigos derivando de data_emissao.
-- Idempotente (where competencia is null). Usa lpad/extract em vez de to_char
-- para evitar problemas de encoding em alguns ambientes Supabase.
update public.fa_arquivos_xml
set competencia =
  lpad(extract(month from data_emissao)::int::text, 2, '0')
  || '/'
  || extract(year from data_emissao)::int::text
where competencia is null
  and data_emissao is not null;

-- -----------------------------------------------------------------------
-- 1. FA_DOCUMENTOS_FISCAIS — cabeçalho dos documentos fiscais centrais
-- -----------------------------------------------------------------------
create table if not exists public.fa_documentos_fiscais (
  id                  uuid default gen_random_uuid() primary key,
  org_id              uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id          uuid references public.empresas(id) on delete cascade not null,
  sessao_id           uuid references public.fa_sessoes_analise(id) on delete set null,

  tipo_documento      text not null check (tipo_documento in ('nfe','nfce','nfse','cte','pgdas','sped','outro')),
  origem              text not null check (origem in ('xml_nfe','xml_nfce','xml_nfse','txt_nfse','excel_nfse','pdf_pgdas','sped_txt','manual','outro')),

  chave_acesso        text,
  numero              text,
  serie               text,
  modelo              text,
  data_emissao        date,
  data_competencia    text,                           -- "MM/YYYY"

  emitente_cnpj       text,
  emitente_nome       text,
  destinatario_cnpj   text,
  destinatario_nome   text,

  valor_total         numeric(15,2) default 0,
  valor_produtos      numeric(15,2) default 0,
  valor_servicos      numeric(15,2) default 0,
  valor_desconto      numeric(15,2) default 0,
  valor_frete         numeric(15,2) default 0,
  valor_icms          numeric(15,2) default 0,
  valor_pis           numeric(15,2) default 0,
  valor_cofins        numeric(15,2) default 0,
  valor_st            numeric(15,2) default 0,
  valor_ipi           numeric(15,2) default 0,

  tipo_movimento      text not null default 'outros'
                        check (tipo_movimento in ('saida','entrada','devolucao_venda','devolucao_compra','remessa','retorno','transferencia','outros')),
  impacto_receita     text not null default 'pendente_revisao'
                        check (impacto_receita in ('soma_receita','reduz_receita','sem_impacto','pendente_revisao')),
  origem_devolucao    text not null default 'nao_aplicavel'
                        check (origem_devolucao in ('emitida_propria','emitida_terceiro','nao_aplicavel')),

  ref_chave_acesso    text,
  status              text not null default 'ok'
                        check (status in ('ok','cancelada','pendente','erro')),
  cancelada_em        date,

  nome_arquivo        text,
  hash_arquivo        text,
  parsed_data         jsonb,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create unique index if not exists idx_fa_docs_chave_empresa
  on public.fa_documentos_fiscais(empresa_id, chave_acesso);

create index if not exists idx_fa_docs_org          on public.fa_documentos_fiscais(org_id);
create index if not exists idx_fa_docs_empresa      on public.fa_documentos_fiscais(empresa_id);
create index if not exists idx_fa_docs_competencia  on public.fa_documentos_fiscais(data_competencia);
create index if not exists idx_fa_docs_tipo_mov     on public.fa_documentos_fiscais(tipo_movimento);
create index if not exists idx_fa_docs_impacto      on public.fa_documentos_fiscais(impacto_receita);
create index if not exists idx_fa_docs_emissao      on public.fa_documentos_fiscais(data_emissao);

alter table public.fa_documentos_fiscais enable row level security;

drop policy if exists "fa_docs_select" on public.fa_documentos_fiscais;
drop policy if exists "fa_docs_insert" on public.fa_documentos_fiscais;
drop policy if exists "fa_docs_update" on public.fa_documentos_fiscais;
drop policy if exists "fa_docs_delete" on public.fa_documentos_fiscais;

create policy "fa_docs_select" on public.fa_documentos_fiscais
  for select using (public.is_member_of(org_id));
create policy "fa_docs_insert" on public.fa_documentos_fiscais
  for insert with check (auth.role() = 'authenticated');
create policy "fa_docs_update" on public.fa_documentos_fiscais
  for update using (public.is_member_of(org_id));
create policy "fa_docs_delete" on public.fa_documentos_fiscais
  for delete using (public.is_member_of(org_id));

-- -----------------------------------------------------------------------
-- 2. FA_DOCUMENTOS_ITENS — itens dos documentos fiscais
-- -----------------------------------------------------------------------
create table if not exists public.fa_documentos_itens (
  id                      uuid default gen_random_uuid() primary key,
  org_id                  uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id              uuid references public.empresas(id) on delete cascade not null,
  documento_id            uuid references public.fa_documentos_fiscais(id) on delete cascade not null,

  item_numero             integer,
  codigo_produto          text,
  descricao               text,
  ncm                     text,
  cest                    text,
  cfop                    text,
  unidade                 text,
  quantidade              numeric(15,4) default 0,
  valor_unitario          numeric(15,4) default 0,
  valor_total             numeric(15,2) default 0,
  valor_desconto          numeric(15,2) default 0,
  valor_frete             numeric(15,2) default 0,

  cst_icms                text,
  csosn                   text,
  valor_bc_icms           numeric(15,2) default 0,
  aliquota_icms           numeric(7,4) default 0,
  valor_icms              numeric(15,2) default 0,
  valor_bc_st             numeric(15,2) default 0,
  valor_st                numeric(15,2) default 0,

  cst_pis                 text,
  valor_bc_pis            numeric(15,2) default 0,
  aliquota_pis            numeric(7,4) default 0,
  valor_pis               numeric(15,2) default 0,

  cst_cofins              text,
  valor_bc_cofins         numeric(15,2) default 0,
  aliquota_cofins         numeric(7,4) default 0,
  valor_cofins            numeric(15,2) default 0,

  valor_ipi               numeric(15,2) default 0,

  classificacao           text default 'outros'
                            check (classificacao in ('revenda','insumo','uso_consumo','imobilizado','servico','outros')),
  natureza_receita_simples text default 'pendente'
                            check (natureza_receita_simples in ('tributada','st','monofasica','isenta','exportacao','devolucao','nao_receita','pendente')),
  tipo_movimento          text default 'outros'
                            check (tipo_movimento in ('saida','entrada','devolucao_venda','devolucao_compra','remessa','retorno','transferencia','outros')),
  impacto_receita         text default 'pendente_revisao'
                            check (impacto_receita in ('soma_receita','reduz_receita','sem_impacto','pendente_revisao')),
  anexo_sugerido          text check (anexo_sugerido in ('I','II','III','IV','V')),
  regra_aplicada          text,
  classificacao_manual    boolean default false,

  created_at              timestamptz default now()
);

create index if not exists idx_fa_itens_org        on public.fa_documentos_itens(org_id);
create index if not exists idx_fa_itens_empresa    on public.fa_documentos_itens(empresa_id);
create index if not exists idx_fa_itens_documento  on public.fa_documentos_itens(documento_id);
create index if not exists idx_fa_itens_ncm        on public.fa_documentos_itens(ncm);
create index if not exists idx_fa_itens_cfop       on public.fa_documentos_itens(cfop);

alter table public.fa_documentos_itens enable row level security;

drop policy if exists "fa_itens_select" on public.fa_documentos_itens;
drop policy if exists "fa_itens_insert" on public.fa_documentos_itens;
drop policy if exists "fa_itens_update" on public.fa_documentos_itens;
drop policy if exists "fa_itens_delete" on public.fa_documentos_itens;

create policy "fa_itens_select" on public.fa_documentos_itens
  for select using (public.is_member_of(org_id));
create policy "fa_itens_insert" on public.fa_documentos_itens
  for insert with check (auth.role() = 'authenticated');
create policy "fa_itens_update" on public.fa_documentos_itens
  for update using (public.is_member_of(org_id));
create policy "fa_itens_delete" on public.fa_documentos_itens
  for delete using (public.is_member_of(org_id));

-- -----------------------------------------------------------------------
-- 3. SN_RECEITAS_MENSAIS — histórico de receita bruta mensal
-- -----------------------------------------------------------------------
create table if not exists public.sn_receitas_mensais (
  id                  uuid default gen_random_uuid() primary key,
  org_id              uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id          uuid references public.empresas(id) on delete cascade not null,
  competencia         text not null,
  receita_bruta_mes   numeric(15,2) not null default 0,
  origem              text not null default 'manual'
                        check (origem in ('pgdas','xml','manual','importacao_excel')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique(empresa_id, competencia)
);

create index if not exists idx_sn_rec_org         on public.sn_receitas_mensais(org_id);
create index if not exists idx_sn_rec_empresa     on public.sn_receitas_mensais(empresa_id);
create index if not exists idx_sn_rec_competencia on public.sn_receitas_mensais(competencia);

alter table public.sn_receitas_mensais enable row level security;

drop policy if exists "sn_rec_select" on public.sn_receitas_mensais;
drop policy if exists "sn_rec_insert" on public.sn_receitas_mensais;
drop policy if exists "sn_rec_update" on public.sn_receitas_mensais;
drop policy if exists "sn_rec_delete" on public.sn_receitas_mensais;

create policy "sn_rec_select" on public.sn_receitas_mensais
  for select using (public.is_member_of(org_id));
create policy "sn_rec_insert" on public.sn_receitas_mensais
  for insert with check (auth.role() = 'authenticated');
create policy "sn_rec_update" on public.sn_receitas_mensais
  for update using (public.is_member_of(org_id));
create policy "sn_rec_delete" on public.sn_receitas_mensais
  for delete using (public.is_member_of(org_id));

-- -----------------------------------------------------------------------
-- 4. SN_APURACOES — resultado da apuração simulada do Simples Nacional
-- -----------------------------------------------------------------------
create table if not exists public.sn_apuracoes (
  id                      uuid default gen_random_uuid() primary key,
  org_id                  uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id              uuid references public.empresas(id) on delete cascade not null,
  competencia             text not null,

  rbt12_utilizado         numeric(15,2),
  origem_rbt12            text check (origem_rbt12 in ('pgdas','xml','manual','estimado')),

  receita_xml_total       numeric(15,2) default 0,
  receita_devolucoes      numeric(15,2) default 0,
  receita_liquida         numeric(15,2) default 0,
  receita_st              numeric(15,2) default 0,
  receita_pgdas_total     numeric(15,2),

  valor_simples_calculado numeric(15,2) default 0,
  valor_pgdas             numeric(15,2),
  diferenca_valor         numeric(15,2),
  diferenca_percentual    numeric(7,4),

  status                  text not null default 'pendente_revisao'
                            check (status in ('ok','divergente','pendente_revisao')),
  detalhes                jsonb,

  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  unique(empresa_id, competencia)
);

create index if not exists idx_sn_apur_org         on public.sn_apuracoes(org_id);
create index if not exists idx_sn_apur_empresa     on public.sn_apuracoes(empresa_id);
create index if not exists idx_sn_apur_competencia on public.sn_apuracoes(competencia);
create index if not exists idx_sn_apur_status      on public.sn_apuracoes(status);

alter table public.sn_apuracoes enable row level security;

drop policy if exists "sn_apur_select" on public.sn_apuracoes;
drop policy if exists "sn_apur_insert" on public.sn_apuracoes;
drop policy if exists "sn_apur_update" on public.sn_apuracoes;
drop policy if exists "sn_apur_delete" on public.sn_apuracoes;

create policy "sn_apur_select" on public.sn_apuracoes
  for select using (public.is_member_of(org_id));
create policy "sn_apur_insert" on public.sn_apuracoes
  for insert with check (auth.role() = 'authenticated');
create policy "sn_apur_update" on public.sn_apuracoes
  for update using (public.is_member_of(org_id));
create policy "sn_apur_delete" on public.sn_apuracoes
  for delete using (public.is_member_of(org_id));

-- -----------------------------------------------------------------------
-- 5. SN_APURACOES_RECEITAS — breakdown por anexo/tipo dentro da apuração
-- -----------------------------------------------------------------------
create table if not exists public.sn_apuracoes_receitas (
  id                      uuid default gen_random_uuid() primary key,
  org_id                  uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id              uuid references public.empresas(id) on delete cascade not null,
  apuracao_id             uuid references public.sn_apuracoes(id) on delete cascade not null,
  competencia             text not null,

  anexo                   text check (anexo in ('I','II','III','IV','V')),
  tipo_receita            text,

  valor_receita           numeric(15,2) default 0,
  valor_base_tributavel   numeric(15,2) default 0,
  aliquota_nominal        numeric(7,4) default 0,
  parcela_deduzir         numeric(15,2) default 0,
  aliquota_efetiva        numeric(7,4) default 0,
  valor_das               numeric(15,2) default 0,

  detalhes                jsonb,
  created_at              timestamptz default now()
);

create index if not exists idx_sn_apur_rec_org      on public.sn_apuracoes_receitas(org_id);
create index if not exists idx_sn_apur_rec_apuracao on public.sn_apuracoes_receitas(apuracao_id);
create index if not exists idx_sn_apur_rec_empresa  on public.sn_apuracoes_receitas(empresa_id);

alter table public.sn_apuracoes_receitas enable row level security;

drop policy if exists "sn_apur_rec_select" on public.sn_apuracoes_receitas;
drop policy if exists "sn_apur_rec_insert" on public.sn_apuracoes_receitas;
drop policy if exists "sn_apur_rec_update" on public.sn_apuracoes_receitas;
drop policy if exists "sn_apur_rec_delete" on public.sn_apuracoes_receitas;

create policy "sn_apur_rec_select" on public.sn_apuracoes_receitas
  for select using (public.is_member_of(org_id));
create policy "sn_apur_rec_insert" on public.sn_apuracoes_receitas
  for insert with check (auth.role() = 'authenticated');
create policy "sn_apur_rec_update" on public.sn_apuracoes_receitas
  for update using (public.is_member_of(org_id));
create policy "sn_apur_rec_delete" on public.sn_apuracoes_receitas
  for delete using (public.is_member_of(org_id));
