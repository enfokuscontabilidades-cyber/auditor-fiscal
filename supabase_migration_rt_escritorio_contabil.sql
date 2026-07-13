-- =======================================================================
-- MIGRAÇÃO — Relatório do contador para o cliente (Reforma Tributária)
-- Executar no Supabase Studio → SQL Editor
-- IDEMPOTENTE: pode ser executado múltiplas vezes sem erros.
--
-- Cria a camada necessária para a segunda modalidade de relatório
-- (reportAudience = 'accountant_client'): perfil institucional do
-- escritório contábil por workspace, parâmetros tributários específicos
-- por cliente (versionados) e o registro de auditoria de cada relatório
-- gerado. Nenhuma tabela aqui altera o comportamento da versão
-- empresarial existente (rt_assinaturas, rt_uso_mensal etc. continuam
-- intocadas).
-- =======================================================================

-- -----------------------------------------------------------------------
-- 1. RT_ESCRITORIO_PERFIL — identidade institucional do escritório,
--    1 por workspace (org_id). Usada exclusivamente na versão do
--    relatório voltada ao contador — nunca na versão empresarial, que
--    continua usando lib/institucional/enfokusContabilidade.ts.
-- -----------------------------------------------------------------------
create table if not exists public.rt_escritorio_perfil (
  id                    uuid default gen_random_uuid() primary key,
  org_id                uuid references public.organizacoes(id) on delete cascade not null unique,

  nome                  text not null,
  razao_social          text,
  cnpj                  text,

  logo_path             text,   -- caminho dentro do bucket privado "escritorio-logos"
  logo_atualizado_em    timestamptz,

  telefone              text,
  whatsapp              text,
  email                 text,
  site                  text,
  cidade                text,
  estado                text,

  contador_responsavel  text,
  crc                   text,
  cor_principal         text,   -- hex, ex: "#27c7d8"

  criado_em             timestamptz default now(),
  atualizado_em         timestamptz default now()
);

create index if not exists idx_rt_escritorio_org on public.rt_escritorio_perfil(org_id);

alter table public.rt_escritorio_perfil enable row level security;

drop policy if exists "rt_escritorio_select" on public.rt_escritorio_perfil;
create policy "rt_escritorio_select" on public.rt_escritorio_perfil
  for select using (public.is_member_of(org_id));

-- Sem policy de insert/update: a escrita acontece via API route com
-- createAdminClient(), após checagem explícita de papel = 'admin' no
-- servidor (mesmo padrão de rt_assinaturas).

-- -----------------------------------------------------------------------
-- 2. RT_PARAMETROS_CLIENTE — parâmetros tributários específicos por
--    empresa analisada, versionados (nunca sobrescreve silenciosamente).
--    Só a linha com ativo=true é a referência vigente; as demais formam
--    o histórico.
-- -----------------------------------------------------------------------
create table if not exists public.rt_parametros_cliente (
  id                  uuid default gen_random_uuid() primary key,
  org_id              uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id          uuid references public.empresas(id) on delete cascade not null,

  versao              integer not null,

  aliquota_cbs        numeric(7,4) not null,
  aliquota_ibs_total  numeric(7,4) not null,
  aliquota_ibs_uf     numeric(7,4),
  aliquota_ibs_mun    numeric(7,4),
  cst                 text not null,
  cclass_trib         text not null,
  observacao          text,

  vigencia_inicio     date not null,
  vigencia_fim        date,

  ativo               boolean not null default true,

  criado_por          uuid references auth.users(id),
  criado_por_email    text,
  criado_em           timestamptz default now(),

  unique(empresa_id, versao)
);

create index if not exists idx_rt_param_cliente_org      on public.rt_parametros_cliente(org_id);
create index if not exists idx_rt_param_cliente_empresa   on public.rt_parametros_cliente(empresa_id);
create index if not exists idx_rt_param_cliente_ativo     on public.rt_parametros_cliente(empresa_id, ativo);

alter table public.rt_parametros_cliente enable row level security;

drop policy if exists "rt_param_cliente_select" on public.rt_parametros_cliente;
create policy "rt_param_cliente_select" on public.rt_parametros_cliente
  for select using (public.is_member_of(org_id));

-- Sem policy de insert/update: escrita via API route com createAdminClient(),
-- sempre criando uma nova versão (nunca UPDATE de uma versão já existente).

-- -----------------------------------------------------------------------
-- 3. RT_RELATORIOS_GERADOS — trilha de auditoria de cada PDF gerado
--    (qual modalidade, qual identidade/parâmetros foram usados, hash do
--    arquivo). Não guarda o binário do PDF — o arquivo é entregue direto
--    ao usuário na resposta HTTP, como já acontecia antes desta migração.
-- -----------------------------------------------------------------------
create table if not exists public.rt_relatorios_gerados (
  id                            uuid default gen_random_uuid() primary key,
  org_id                        uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id                    uuid references public.empresas(id) on delete cascade not null,

  tipo_relatorio                text not null check (tipo_relatorio in ('company', 'accountant_client')),
  gerado_por                    uuid references auth.users(id),

  -- Snapshot da identidade do escritório NO MOMENTO da geração — se o
  -- contador trocar a logo ou o nome depois, este registro não muda.
  escritorio_nome_snapshot      text,
  escritorio_logo_path_snapshot text,
  escritorio_cor_snapshot       text,

  modo_parametros               text not null check (modo_parametros in ('padrao_2026', 'especifico', 'estrutural')),
  parametros_utilizados         jsonb,
  observacao                    text,
  versao_parametros             text not null,

  total_documentos              integer not null default 0,
  total_itens                   integer not null default 0,
  hash_arquivo                  text not null,
  competencia                   text,

  criado_em                     timestamptz default now()
);

create index if not exists idx_rt_relatorios_org      on public.rt_relatorios_gerados(org_id);
create index if not exists idx_rt_relatorios_empresa  on public.rt_relatorios_gerados(empresa_id);

alter table public.rt_relatorios_gerados enable row level security;

drop policy if exists "rt_relatorios_select" on public.rt_relatorios_gerados;
create policy "rt_relatorios_select" on public.rt_relatorios_gerados
  for select using (public.is_member_of(org_id));

-- Sem policy de insert: gravado via createAdminClient() ao final da geração do PDF.

-- -----------------------------------------------------------------------
-- 4. Bucket de Storage privado para logos de escritório
--    Sem policies em storage.objects: só o service role (createAdminClient())
--    lê/grava/apaga arquivos deste bucket. O preview no navegador usa uma
--    signed URL de curta duração gerada pela API — nunca uma URL pública.
-- -----------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('escritorio-logos', 'escritorio-logos', false)
on conflict (id) do nothing;
