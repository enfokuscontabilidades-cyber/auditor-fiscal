-- =============================================================================
-- MIGRAÇÃO: Tabela cnpj_cache
-- Cache compartilhado de consultas à API pública de CNPJ (publica.cnpj.ws)
-- Idempotente: pode ser executado múltiplas vezes sem erro
-- =============================================================================

create table if not exists public.cnpj_cache (
  cnpj          text primary key,               -- 14 dígitos, sem formatação
  dados         jsonb not null default '{}',    -- resposta completa da API cnpj.ws
  consultado_em timestamptz default now(),      -- data da última consulta
  status        text default 'ok'
                  check (status in ('ok', 'erro', 'nao_encontrado'))
);

-- Índice para consultas de expiração de cache
create index if not exists idx_cnpj_cache_consultado
  on public.cnpj_cache(consultado_em);

-- Habilitar RLS
alter table public.cnpj_cache enable row level security;

-- Qualquer usuário autenticado pode ler (cache é compartilhado entre orgs)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'cnpj_cache' and policyname = 'cnpj_cache_select'
  ) then
    create policy "cnpj_cache_select" on public.cnpj_cache
      for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- Insert via usuário autenticado (API route usa service role, mas por segurança)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'cnpj_cache' and policyname = 'cnpj_cache_insert'
  ) then
    create policy "cnpj_cache_insert" on public.cnpj_cache
      for insert with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Update via usuário autenticado
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'cnpj_cache' and policyname = 'cnpj_cache_update'
  ) then
    create policy "cnpj_cache_update" on public.cnpj_cache
      for update using (auth.role() = 'authenticated');
  end if;
end $$;

-- Comentários explicativos
comment on table public.cnpj_cache is
  'Cache de consultas à API pública de CNPJ. Compartilhado entre organizações. TTL de 30 dias.';

comment on column public.cnpj_cache.cnpj is
  '14 dígitos sem formatação, ex: 12345678000199';

comment on column public.cnpj_cache.dados is
  'Resposta completa da API publica.cnpj.ws serializada como JSONB';

comment on column public.cnpj_cache.status is
  'ok = dados válidos; erro = falha na API; nao_encontrado = CNPJ inativo/não existente';
