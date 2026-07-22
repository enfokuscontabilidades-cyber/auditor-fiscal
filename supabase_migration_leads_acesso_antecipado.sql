-- =============================================================================
-- MIGRACAO: Leads da landing page de acesso antecipado da plataforma
-- Idempotente: pode ser executada multiplas vezes no SQL Editor do Supabase.
-- =============================================================================

create table if not exists public.leads_acesso_antecipado (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  email text not null,
  empresa text,
  cargo text,
  perfil_profissional text not null,
  finalidades text[] not null default '{}',
  faixa_empresas text,
  principal_desafio text,
  origem text not null default 'landing-acesso-antecipado',
  campanha text,
  codigo_solicitacao text,
  consentimento_dados boolean not null default false,
  consentimento_contato boolean not null default false,
  consentimento_versao text,
  ip text,
  user_agent text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  pagina_origem text,
  status text not null default 'novo',
  observacoes text,
  contatado_em timestamptz,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_acesso_antecipado_status_check'
  ) then
    alter table public.leads_acesso_antecipado
      add constraint leads_acesso_antecipado_status_check check (status in (
        'novo', 'aguardando_contato', 'contatado', 'reuniao_agendada',
        'aprovado_beta', 'lista_espera', 'convertido', 'sem_interesse', 'invalido'
      ));
  end if;
end $$;

create unique index if not exists idx_leads_acesso_codigo
  on public.leads_acesso_antecipado(codigo_solicitacao)
  where codigo_solicitacao is not null;

create index if not exists idx_leads_acesso_created_at
  on public.leads_acesso_antecipado(created_at desc);

create index if not exists idx_leads_acesso_email
  on public.leads_acesso_antecipado(lower(email));

create index if not exists idx_leads_acesso_status
  on public.leads_acesso_antecipado(status);

create index if not exists idx_leads_acesso_perfil
  on public.leads_acesso_antecipado(perfil_profissional);

alter table public.leads_acesso_antecipado enable row level security;

comment on table public.leads_acesso_antecipado is
  'Solicitacoes de profissionais interessados em testar antecipadamente a plataforma Enfokus.';

comment on column public.leads_acesso_antecipado.finalidades is
  'Finalidades selecionadas pelo profissional para testar e avaliar a plataforma.';

comment on column public.leads_acesso_antecipado.consentimento_dados is
  'Autorizacao exigida para analisar a solicitacao e responder ao interessado.';
