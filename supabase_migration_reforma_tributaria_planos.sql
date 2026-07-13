-- =======================================================================
-- MIGRAÇÃO — Planos pagos de Reforma Tributária (IBS/CBS)
-- Executar no Supabase Studio → SQL Editor
-- IDEMPOTENTE: pode ser executado múltiplas vezes sem erros.
--
-- Cria a camada comercial (assinaturas, vagas de CNPJ, uso mensal,
-- auditoria) para o produto "somente Reforma Tributária", sem alterar
-- o comportamento de organizações existentes (produto_escopo nasce
-- 'full_platform' por default).
-- =======================================================================

-- -----------------------------------------------------------------------
-- 0. PATCH em organizacoes — escopo de produto
-- -----------------------------------------------------------------------
alter table public.organizacoes
  add column if not exists produto_escopo text not null default 'full_platform';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizacoes_produto_escopo_check'
      and conrelid = 'public.organizacoes'::regclass
  ) then
    alter table public.organizacoes
      add constraint organizacoes_produto_escopo_check
      check (produto_escopo in ('full_platform', 'tax_reform_only'));
  end if;
end $$;

-- -----------------------------------------------------------------------
-- 1. RT_ASSINATURAS — assinatura do produto Reforma Tributária por org
-- -----------------------------------------------------------------------
create table if not exists public.rt_assinaturas (
  id                          uuid default gen_random_uuid() primary key,
  org_id                      uuid references public.organizacoes(id) on delete cascade not null unique,

  plano_codigo                text not null
                                check (plano_codigo in ('rt_essencial', 'rt_profissional', 'rt_ilimitado')),
  preco_contratado_centavos   integer not null,

  status                      text not null default 'pending'
                                check (status in ('pending', 'active', 'past_due', 'canceled', 'expired', 'suspended', 'manual')),

  periodo_inicio              timestamptz,
  ciclo_inicio                timestamptz,
  ciclo_fim                   timestamptz,
  proxima_renovacao           timestamptz,
  cancelamento_solicitado     boolean not null default false,
  acesso_ate                  timestamptz,

  stripe_customer_id          text,
  stripe_subscription_id      text,

  criado_em                   timestamptz default now(),
  atualizado_em                timestamptz default now()
);

create index if not exists idx_rt_assinaturas_org    on public.rt_assinaturas(org_id);
create index if not exists idx_rt_assinaturas_status on public.rt_assinaturas(status);
create index if not exists idx_rt_assinaturas_stripe_sub on public.rt_assinaturas(stripe_subscription_id);

alter table public.rt_assinaturas enable row level security;

drop policy if exists "rt_assinaturas_select" on public.rt_assinaturas;
create policy "rt_assinaturas_select" on public.rt_assinaturas
  for select using (public.is_member_of(org_id));

-- Sem policy de insert/update/delete: toda escrita de assinatura passa
-- por createAdminClient() nas API routes (regra de negócio server-side).

-- -----------------------------------------------------------------------
-- 2. RT_CNPJ_SLOTS — vaga permanente de CNPJ dentro da assinatura
-- -----------------------------------------------------------------------
create table if not exists public.rt_cnpj_slots (
  id                  uuid default gen_random_uuid() primary key,
  assinatura_id       uuid references public.rt_assinaturas(id) on delete cascade not null,
  org_id              uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id          uuid references public.empresas(id) on delete cascade not null unique,

  cnpj_normalizado    text not null check (cnpj_normalizado ~ '^[0-9]{14}$'),
  vinculado_em        timestamptz default now(),
  vinculado_por       uuid references auth.users(id),

  status              text not null default 'ativo' check (status in ('ativo', 'corrigido')),

  unique(org_id, cnpj_normalizado)
);

create index if not exists idx_rt_slots_org        on public.rt_cnpj_slots(org_id);
create index if not exists idx_rt_slots_assinatura on public.rt_cnpj_slots(assinatura_id);

alter table public.rt_cnpj_slots enable row level security;

drop policy if exists "rt_slots_select" on public.rt_cnpj_slots;
create policy "rt_slots_select" on public.rt_cnpj_slots
  for select using (public.is_member_of(org_id));

-- -----------------------------------------------------------------------
-- 3. RT_CORRECOES_CNPJ — trilha de auditoria de correção administrativa
-- -----------------------------------------------------------------------
create table if not exists public.rt_correcoes_cnpj (
  id              uuid default gen_random_uuid() primary key,
  slot_id         uuid references public.rt_cnpj_slots(id) on delete cascade not null,
  org_id          uuid references public.organizacoes(id) on delete cascade not null,

  cnpj_anterior   text not null,
  cnpj_novo       text not null,
  justificativa   text not null,
  admin_email     text not null,

  criado_em       timestamptz default now()
);

create index if not exists idx_rt_correcoes_org  on public.rt_correcoes_cnpj(org_id);
create index if not exists idx_rt_correcoes_slot on public.rt_correcoes_cnpj(slot_id);

alter table public.rt_correcoes_cnpj enable row level security;

drop policy if exists "rt_correcoes_select" on public.rt_correcoes_cnpj;
create policy "rt_correcoes_select" on public.rt_correcoes_cnpj
  for select using (public.is_member_of(org_id));

-- -----------------------------------------------------------------------
-- 4. RT_USO_MENSAL — contador de XMLs processados por ciclo
-- -----------------------------------------------------------------------
create table if not exists public.rt_uso_mensal (
  id                  uuid default gen_random_uuid() primary key,
  assinatura_id       uuid references public.rt_assinaturas(id) on delete cascade not null,
  org_id              uuid references public.organizacoes(id) on delete cascade not null,

  periodo_inicio      date not null,
  periodo_fim         date not null,
  xmls_processados    integer not null default 0,

  atualizado_em       timestamptz default now(),
  unique(assinatura_id, periodo_inicio)
);

create index if not exists idx_rt_uso_org        on public.rt_uso_mensal(org_id);
create index if not exists idx_rt_uso_assinatura on public.rt_uso_mensal(assinatura_id);

alter table public.rt_uso_mensal enable row level security;

drop policy if exists "rt_uso_select" on public.rt_uso_mensal;
create policy "rt_uso_select" on public.rt_uso_mensal
  for select using (public.is_member_of(org_id));

-- -----------------------------------------------------------------------
-- 5. RT_DOCUMENTOS_PROCESSADOS — chaves de NF-e já contabilizadas no ciclo
--    (evita contagem duplicada ao reprocessar o mesmo documento)
-- -----------------------------------------------------------------------
create table if not exists public.rt_documentos_processados (
  id              uuid default gen_random_uuid() primary key,
  assinatura_id   uuid references public.rt_assinaturas(id) on delete cascade not null,
  org_id          uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id      uuid references public.empresas(id) on delete cascade not null,

  chave_acesso    text not null,
  periodo_inicio  date not null,

  criado_em       timestamptz default now(),
  unique(assinatura_id, chave_acesso)
);

create index if not exists idx_rt_docs_proc_org        on public.rt_documentos_processados(org_id);
create index if not exists idx_rt_docs_proc_assinatura on public.rt_documentos_processados(assinatura_id);

alter table public.rt_documentos_processados enable row level security;

drop policy if exists "rt_docs_proc_select" on public.rt_documentos_processados;
create policy "rt_docs_proc_select" on public.rt_documentos_processados
  for select using (public.is_member_of(org_id));

-- -----------------------------------------------------------------------
-- 6. RT_AUDITORIA — log de eventos comerciais (nunca grava XML/dado fiscal)
-- -----------------------------------------------------------------------
create table if not exists public.rt_auditoria (
  id              uuid default gen_random_uuid() primary key,
  org_id          uuid references public.organizacoes(id) on delete cascade not null,
  assinatura_id   uuid references public.rt_assinaturas(id) on delete set null,

  tipo_evento     text not null,
  detalhes        jsonb,
  ator_user_id    uuid references auth.users(id),

  criado_em       timestamptz default now()
);

create index if not exists idx_rt_auditoria_org    on public.rt_auditoria(org_id);
create index if not exists idx_rt_auditoria_tipo   on public.rt_auditoria(tipo_evento);

alter table public.rt_auditoria enable row level security;

drop policy if exists "rt_auditoria_select" on public.rt_auditoria;
create policy "rt_auditoria_select" on public.rt_auditoria
  for select using (public.is_member_of(org_id));

-- -----------------------------------------------------------------------
-- 7. RT_WEBHOOK_EVENTOS — idempotência de eventos do Stripe
--    (sem policy: só acessível via service role)
-- -----------------------------------------------------------------------
create table if not exists public.rt_webhook_eventos (
  id            text primary key,  -- event.id do Stripe
  tipo          text not null,
  recebido_em   timestamptz default now()
);

alter table public.rt_webhook_eventos enable row level security;
