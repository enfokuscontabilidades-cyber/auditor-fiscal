-- =============================================================
-- Plataforma de Auditoria Fiscal — Schema Supabase
-- Aplicar no SQL Editor do projeto Supabase do sistema-controle
-- =============================================================

-- ---------------------------------------------------------------
-- 1. EMPRESAS
-- ---------------------------------------------------------------
create table if not exists public.empresas (
  id             uuid default gen_random_uuid() primary key,
  razao_social   text not null,
  nome_fantasia  text,
  cnpj           text unique,
  cpf            text unique,
  regime         text check (regime in (
                   'Simples Nacional','Lucro Presumido','Lucro Real','MEI','CPF'
                 )),
  cnae_principal text,
  inscricao_estadual  text,
  inscricao_municipal text,
  uf             text default 'GO',
  status         text default 'Ativo'
                   check (status in ('Ativo','Inativo','Suspenso')),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.empresas enable row level security;
create policy "Usuarios autenticados podem ver empresas"
  on public.empresas for select using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem criar empresas"
  on public.empresas for insert with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem atualizar empresas"
  on public.empresas for update using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- 2. FA_SESSOES_ANALISE
-- ---------------------------------------------------------------
create table if not exists public.fa_sessoes_analise (
  id              uuid default gen_random_uuid() primary key,
  empresa_id      uuid references public.empresas(id) on delete cascade not null,
  criado_por      uuid references auth.users(id) on delete set null,
  competencia     text not null,
  periodo_inicial text,
  periodo_final   text,
  status          text default 'rascunho'
                    check (status in ('rascunho','processando','concluido','erro')),
  observacoes     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_fa_sessoes_empresa on public.fa_sessoes_analise(empresa_id);

alter table public.fa_sessoes_analise enable row level security;
create policy "Usuarios autenticados podem ver sessoes"
  on public.fa_sessoes_analise for select using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem criar sessoes"
  on public.fa_sessoes_analise for insert with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem atualizar sessoes"
  on public.fa_sessoes_analise for update using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- 3. FA_ARQUIVOS_SPED
-- ---------------------------------------------------------------
create table if not exists public.fa_arquivos_sped (
  id                uuid default gen_random_uuid() primary key,
  sessao_id         uuid references public.fa_sessoes_analise(id) on delete cascade not null,
  empresa_id        uuid references public.empresas(id) on delete cascade not null,
  nome_arquivo      text not null,
  tipo              text not null check (tipo in ('fiscal','contrib','ecf','efd_reinf')),
  subtipo           text check (subtipo in ('matriz','filial')),
  competencia       text not null,
  periodo_inicial   text,
  periodo_final     text,
  cnpj_declarante   text,
  storage_path      text,
  tamanho_bytes     bigint,
  total_linhas      integer,
  parsed_data       jsonb,
  parsed_at         timestamptz,
  status            text default 'aguardando'
                      check (status in ('aguardando','processando','ok','erro')),
  erro_msg          text,
  created_at        timestamptz default now()
);

create index idx_fa_arquivos_sped_sessao on public.fa_arquivos_sped(sessao_id);
create index idx_fa_arquivos_sped_empresa on public.fa_arquivos_sped(empresa_id);

alter table public.fa_arquivos_sped enable row level security;
create policy "Usuarios autenticados podem ver arquivos sped"
  on public.fa_arquivos_sped for select using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem criar arquivos sped"
  on public.fa_arquivos_sped for insert with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem atualizar arquivos sped"
  on public.fa_arquivos_sped for update using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- 4. FA_ARQUIVOS_XML
-- ---------------------------------------------------------------
create table if not exists public.fa_arquivos_xml (
  id                  uuid default gen_random_uuid() primary key,
  sessao_id           uuid references public.fa_sessoes_analise(id) on delete cascade not null,
  empresa_id          uuid references public.empresas(id) on delete cascade not null,
  chave_nfe           text,
  numero_nf           text,
  data_emissao        date,
  emitente_cnpj       text,
  emitente_nome       text,
  destinatario_cnpj   text,
  destinatario_nome   text,
  tipo_operacao       text check (tipo_operacao in ('entrada','saida')),
  valor_total         numeric(15,2),
  storage_path        text,
  parsed_data         jsonb,
  status              text default 'aguardando'
                        check (status in ('aguardando','ok','cancelada','erro')),
  created_at          timestamptz default now()
);

create index idx_fa_xml_sessao on public.fa_arquivos_xml(sessao_id);
create index idx_fa_xml_chave  on public.fa_arquivos_xml(chave_nfe);

alter table public.fa_arquivos_xml enable row level security;
create policy "Usuarios autenticados podem ver xml"
  on public.fa_arquivos_xml for select using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem criar xml"
  on public.fa_arquivos_xml for insert with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- 5. FA_APURACOES_ICMS
-- ---------------------------------------------------------------
create table if not exists public.fa_apuracoes_icms (
  id                          uuid default gen_random_uuid() primary key,
  sessao_id                   uuid references public.fa_sessoes_analise(id) on delete cascade not null,
  empresa_id                  uuid references public.empresas(id) on delete cascade not null,
  competencia                 text not null,
  vl_tot_debitos              numeric(15,2) default 0,
  vl_aj_debitos               numeric(15,2) default 0,
  vl_tot_creditos             numeric(15,2) default 0,
  vl_aj_creditos              numeric(15,2) default 0,
  vl_sld_apurado              numeric(15,2) default 0,
  vl_icms_recolher            numeric(15,2) default 0,
  vl_sld_credor_transportar   numeric(15,2) default 0,
  total_saidas                numeric(15,2) default 0,
  total_entradas              numeric(15,2) default 0,
  aliquota_efetiva_saidas     numeric(6,4),
  created_at                  timestamptz default now()
);

alter table public.fa_apuracoes_icms enable row level security;
create policy "Usuarios autenticados podem ver apuracoes icms"
  on public.fa_apuracoes_icms for select using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem criar apuracoes icms"
  on public.fa_apuracoes_icms for insert with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- 6. FA_APURACOES_CONTRIB
-- ---------------------------------------------------------------
create table if not exists public.fa_apuracoes_contrib (
  id                  uuid default gen_random_uuid() primary key,
  sessao_id           uuid references public.fa_sessoes_analise(id) on delete cascade not null,
  empresa_id          uuid references public.empresas(id) on delete cascade not null,
  competencia         text not null,
  regime_apuracao     text check (regime_apuracao in ('cumulativo','nao_cumulativo','ambos')),
  vl_rec_brt_pis      numeric(15,2) default 0,
  vl_bc_pis           numeric(15,2) default 0,
  vl_pis_apurado      numeric(15,2) default 0,
  vl_credito_pis      numeric(15,2) default 0,
  vl_pis_recolher     numeric(15,2) default 0,
  vl_rec_brt_cofins   numeric(15,2) default 0,
  vl_bc_cofins        numeric(15,2) default 0,
  vl_cofins_apurado   numeric(15,2) default 0,
  vl_credito_cofins   numeric(15,2) default 0,
  vl_cofins_recolher  numeric(15,2) default 0,
  created_at          timestamptz default now()
);

alter table public.fa_apuracoes_contrib enable row level security;
create policy "Usuarios autenticados podem ver apuracoes contrib"
  on public.fa_apuracoes_contrib for select using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem criar apuracoes contrib"
  on public.fa_apuracoes_contrib for insert with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- 7. FA_REGRAS_FISCAIS
-- ---------------------------------------------------------------
create table if not exists public.fa_regras_fiscais (
  id               uuid default gen_random_uuid() primary key,
  codigo           text not null unique,
  categoria        text not null check (categoria in (
                     'icms','pis_cofins','irpj_csll','cfop','ncm',
                     'st','beneficio_fiscal','obrigacao_acessoria','planejamento'
                   )),
  titulo           text not null,
  descricao        text,
  nivel_risco      text not null default 'medio'
                     check (nivel_risco in ('baixo','medio','alto','critico')),
  ativo            boolean default true,
  versao           integer default 1,
  parametros       jsonb default '{}',
  fundamento_legal text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table public.fa_regras_fiscais enable row level security;
create policy "Todos podem ver regras"
  on public.fa_regras_fiscais for select using (auth.role() = 'authenticated');
create policy "Autenticados podem modificar regras"
  on public.fa_regras_fiscais for all using (auth.role() = 'authenticated');

-- Seed das regras iniciais
insert into public.fa_regras_fiscais
  (codigo, categoria, titulo, nivel_risco, fundamento_legal, parametros)
values
  ('ICMS_CFOP_SAIDA_EM_ENTRADA','icms',
   'CFOP de saída (5xxx/6xxx) registrado como entrada','alto',
   'Guia de Auditoria SPED','{}'),
  ('ICMS_CFOP_ENTRADA_EM_SAIDA','icms',
   'CFOP de entrada (1xxx/2xxx) registrado como saída','alto',
   'Guia de Auditoria SPED','{}'),
  ('ICMS_SEM_PARTICIPANTE','icms',
   'Documentos sem cadastro 0150 de participante','baixo',
   NULL,'{}'),
  ('ICMS_ALIQUOTA_EFETIVA_BAIXA','icms',
   'Alíquota efetiva de ICMS sobre saídas abaixo do mínimo esperado','medio',
   'Art. 28 RCTE/GO','{"limiar_pct": 0.01}'),
  ('ICMS_DIVERGENCIA_FISCAL_CONTRIB','icms',
   'Documentos presentes no Fiscal sem correspondência no Contribuições','medio',
   'IN RFB 1252/2012','{}'),
  ('ICMS_UC_COM_CREDITO','icms',
   'Crédito de ICMS em item classificado como Uso e Consumo','alto',
   'Art. 33 LC 87/1996 (Lei Kandir)','{}'),
  ('ICMS_IMOB_SEM_CIAP','icms',
   'Crédito de ICMS em ativo imobilizado sem controle CIAP identificado','alto',
   'Art. 20 §5º LC 87/1996','{}'),
  ('CFOP_INCOMPAT_CNAE','cfop',
   'CFOP de industrialização em empresa comercial (sem CNAE industrial)','medio',
   'RIPI/2010 art. 4º','{}'),
  ('CFOP_DEVOLUCAO_INCORRETA','cfop',
   'CFOP de devolução incompatível com o CFOP original da operação','medio',
   'Convênio s/nº 1970 SINIEF','{}'),
  ('NCM_ST_SEM_TRATAMENTO','ncm',
   'Produto com NCM sujeito à ST sem CFOP/CST correspondente','alto',
   'RICMS/GO Anexo VIII','{}'),
  ('NCM_BENEFICIO_NAO_APLICADO','ncm',
   'Produto elegível a benefício fiscal sem cBenef informado','medio',
   'IN 1518/2022-GSE','{}'),
  ('CONTRIB_EXCLUSAO_INDEVIDA','pis_cofins',
   'Possível crédito de PIS/COFINS fora do conceito de insumo','medio',
   'RE 841979 STJ / Lei 10.637/2002','{}'),
  ('OBRIG_SPED_ZERADO_COM_RECEITA','obrigacao_acessoria',
   'SPED com movimento zerado mas empresa com receita declarada','alto',
   'IN RFB 1252/2012 art. 5º','{}')
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------
-- 8. FA_ALERTAS
-- ---------------------------------------------------------------
create table if not exists public.fa_alertas (
  id                    uuid default gen_random_uuid() primary key,
  sessao_id             uuid references public.fa_sessoes_analise(id) on delete cascade not null,
  empresa_id            uuid references public.empresas(id) on delete cascade not null,
  regra_id              uuid references public.fa_regras_fiscais(id) on delete set null,
  competencia           text not null,
  categoria             text not null,
  nivel_risco           text not null check (nivel_risco in ('baixo','medio','alto','critico')),
  titulo                text not null,
  descricao             text not null,
  detalhe               jsonb default '{}',
  valor_impacto         numeric(15,2),
  status                text default 'aberto'
                          check (status in ('aberto','em_analise','resolvido','descartado')),
  resolvido_por         uuid references auth.users(id) on delete set null,
  resolvido_em          timestamptz,
  observacao_resolucao  text,
  created_at            timestamptz default now()
);

create index idx_fa_alertas_sessao   on public.fa_alertas(sessao_id);
create index idx_fa_alertas_empresa  on public.fa_alertas(empresa_id);
create index idx_fa_alertas_risco    on public.fa_alertas(nivel_risco);
create index idx_fa_alertas_status   on public.fa_alertas(status);

alter table public.fa_alertas enable row level security;
create policy "Usuarios autenticados podem ver alertas"
  on public.fa_alertas for select using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem criar alertas"
  on public.fa_alertas for insert with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem atualizar alertas"
  on public.fa_alertas for update using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- 9. FA_OBRIGACOES_ACESSORIAS
-- ---------------------------------------------------------------
create table if not exists public.fa_obrigacoes_acessorias (
  id               uuid default gen_random_uuid() primary key,
  empresa_id       uuid references public.empresas(id) on delete cascade not null,
  competencia      text not null,
  tipo             text not null,
  prazo_legal      date,
  data_entrega     date,
  status           text default 'pendente'
                     check (status in ('pendente','entregue','atrasada','sem_movimento','nao_obrigado')),
  observacao       text,
  arquivo_sped_id  uuid references public.fa_arquivos_sped(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique(empresa_id, competencia, tipo)
);

alter table public.fa_obrigacoes_acessorias enable row level security;
create policy "Usuarios autenticados podem ver obrigacoes"
  on public.fa_obrigacoes_acessorias for select using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem criar obrigacoes"
  on public.fa_obrigacoes_acessorias for insert with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem atualizar obrigacoes"
  on public.fa_obrigacoes_acessorias for update using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- 10. FA_PLANEJAMENTO_TRIBUTARIO
-- ---------------------------------------------------------------
create table if not exists public.fa_planejamento_tributario (
  id                   uuid default gen_random_uuid() primary key,
  empresa_id           uuid references public.empresas(id) on delete cascade not null,
  criado_por           uuid references auth.users(id) on delete set null,
  competencia_base     text not null,
  receita_bruta_anual  numeric(15,2) not null,
  custo_mercadorias    numeric(15,2),
  folha_pagamento      numeric(15,2),
  outras_despesas      numeric(15,2),
  regime_atual         text,
  resultado_simples    jsonb,
  resultado_presumido  jsonb,
  resultado_real       jsonb,
  regime_recomendado   text,
  economia_estimada    numeric(15,2),
  observacoes          text,
  created_at           timestamptz default now()
);

alter table public.fa_planejamento_tributario enable row level security;
create policy "Usuarios autenticados podem ver planejamento"
  on public.fa_planejamento_tributario for select using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem criar planejamento"
  on public.fa_planejamento_tributario for insert with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- 11. SN_DECLARACOES (Simples Nacional — PGDAS-D)
-- ---------------------------------------------------------------
create table if not exists public.sn_declaracoes (
  id                          uuid default gen_random_uuid() primary key,
  empresa_id                  uuid references public.empresas(id) on delete cascade not null,
  competencia                 text not null,
  periodo_inicial             date,
  periodo_final               date,
  receita_bruta_mes           numeric(15,2),
  receita_bruta_acumulada_12m numeric(15,2),
  receita_bruta_ano           numeric(15,2),
  valor_total_devido          numeric(15,2),
  numero_recibo               text,
  nome_arquivo                text,
  parsed_data                 jsonb,
  created_at                  timestamptz default now(),
  unique(empresa_id, competencia)
);

create index idx_sn_declaracoes_empresa    on public.sn_declaracoes(empresa_id);
create index idx_sn_declaracoes_competencia on public.sn_declaracoes(competencia);

alter table public.sn_declaracoes enable row level security;
create policy "Usuarios autenticados podem ver sn_declaracoes"
  on public.sn_declaracoes for select using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem criar sn_declaracoes"
  on public.sn_declaracoes for insert with check (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem atualizar sn_declaracoes"
  on public.sn_declaracoes for update using (auth.role() = 'authenticated');
create policy "Usuarios autenticados podem deletar sn_declaracoes"
  on public.sn_declaracoes for delete using (auth.role() = 'authenticated');
