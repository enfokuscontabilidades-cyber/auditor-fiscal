-- Parte 06A: cria a tabela de resumo mensal de documentos.
-- Execute este arquivo inteiro no Supabase SQL Editor.

create table if not exists public.rel_resumo_documentos_mensal (
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  competencia text not null,
  tipo_movimento text not null,
  valor_total numeric not null default 0,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, competencia, tipo_movimento)
);

create index if not exists idx_rel_doc_mensal_org_empresa_comp
  on public.rel_resumo_documentos_mensal(org_id, empresa_id, competencia);

alter table public.rel_resumo_documentos_mensal enable row level security;

drop policy if exists "rel_documentos_select" on public.rel_resumo_documentos_mensal;
drop policy if exists "rel_documentos_all" on public.rel_resumo_documentos_mensal;

create policy "rel_documentos_select" on public.rel_resumo_documentos_mensal
  for select using (public.is_member_of(org_id));

create policy "rel_documentos_all" on public.rel_resumo_documentos_mensal
  for all using (public.is_member_of(org_id)) with check (public.is_member_of(org_id));
