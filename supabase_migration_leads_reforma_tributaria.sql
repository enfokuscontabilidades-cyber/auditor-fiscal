-- =============================================================================
-- MIGRACAO: Leads da isca digital de Reforma Tributaria
-- Captura dados comerciais antes do diagnostico publico de IBS/CBS.
-- Idempotente: pode ser executada multiplas vezes no SQL Editor do Supabase.
-- =============================================================================

create table if not exists public.leads_reforma_tributaria (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  email text not null,
  empresa text not null,
  porte_empresa text not null,
  regime_tributario text not null,
  funcionarios_faixa text not null,
  faturamento_faixa text not null,
  segmentos text[] not null default '{}',
  origem text not null default 'diagnostico-reforma-tributaria',
  campanha text,
  resumo_analise jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_reforma_created_at
  on public.leads_reforma_tributaria(created_at desc);

create index if not exists idx_leads_reforma_email
  on public.leads_reforma_tributaria(lower(email));

alter table public.leads_reforma_tributaria enable row level security;

comment on table public.leads_reforma_tributaria is
  'Leads capturados pela pagina publica de diagnostico IBS/CBS da Reforma Tributaria.';

comment on column public.leads_reforma_tributaria.segmentos is
  'Segmentos selecionados pelo empresario: servico, comercio atacadista, comercio varejista, industria.';

comment on column public.leads_reforma_tributaria.resumo_analise is
  'Resumo agregado opcional do diagnostico. Os XMLs enviados pelo visitante nao sao armazenados.';
