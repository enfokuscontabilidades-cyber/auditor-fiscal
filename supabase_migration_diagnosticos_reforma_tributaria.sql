-- =============================================================================
-- MIGRACAO: Diagnosticos de Reforma Tributaria (IBS/CBS) — resultado estruturado
-- Guarda o RESULTADO ESTRUTURADO de cada analise (nao os XMLs) para permitir a
-- geracao sob demanda do Relatorio Tecnico de Diagnostico de IBS e CBS em PDF,
-- localizado por um token de alta entropia (nao sequencial, nao previsivel).
-- Idempotente: pode ser executada multiplas vezes no SQL Editor do Supabase.
-- =============================================================================

create table if not exists public.diagnosticos_reforma_tributaria (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads_reforma_tributaria(id) on delete set null,

  -- Identificador publico de alta entropia usado na URL de download do PDF.
  -- Gerado em memoria pela aplicacao (crypto.randomBytes), nunca sequencial.
  token text not null,

  -- Resultado estruturado da analise (o mesmo shape retornado por
  -- /api/diagnostico-reforma-tributaria/analisar). Nao contem o XML original.
  resultados jsonb not null,
  resumo jsonb not null,

  pontuacao integer not null,
  classificacao text not null,
  total_divergencias integer not null default 0,
  divergencias_por_gravidade jsonb not null default '{}'::jsonb,

  -- Carimbo de versao no momento da geracao: um relatorio ja emitido nao muda
  -- retroativamente se as regras ou a base legal forem atualizadas depois.
  versao_regras text not null,
  versao_base_legal text not null,
  versao_relatorio integer not null default 1,

  status text not null default 'pronto',
  mensagem_erro text,

  criado_em timestamptz not null default now(),
  relatorio_gerado_em timestamptz,
  relatorio_hash text,
  downloads_count integer not null default 0,
  primeiro_download_em timestamptz,
  ultimo_download_em timestamptz,

  constraint diagnosticos_reforma_status_check check (status in ('pronto', 'erro')),
  constraint diagnosticos_reforma_pontuacao_check check (pontuacao between 0 and 100)
);

create unique index if not exists idx_diagnosticos_reforma_token
  on public.diagnosticos_reforma_tributaria(token);

create index if not exists idx_diagnosticos_reforma_lead_id
  on public.diagnosticos_reforma_tributaria(lead_id);

create index if not exists idx_diagnosticos_reforma_criado_em
  on public.diagnosticos_reforma_tributaria(criado_em desc);

-- RLS habilitado sem policies: a tabela so e acessada pelo backend via
-- createAdminClient() (service-role), que ignora RLS por definicao. Isso
-- garante que nenhuma chave publica (anon) consiga ler ou escrever aqui,
-- mesmo que seja usada diretamente contra o Supabase.
alter table public.diagnosticos_reforma_tributaria enable row level security;

comment on table public.diagnosticos_reforma_tributaria is
  'Resultado estruturado de cada diagnostico publico de IBS/CBS, usado para gerar o Relatorio Tecnico em PDF sob demanda. Nunca armazena o XML original.';

comment on column public.diagnosticos_reforma_tributaria.token is
  'Identificador publico de alta entropia (nao sequencial) usado na URL de download do relatorio. Nunca expor o id (uuid sequencial-friendly no PostgREST) publicamente.';

comment on column public.diagnosticos_reforma_tributaria.versao_relatorio is
  'Incrementada a cada regeneracao controlada do PDF apos atualizacao de regras ou base legal.';

comment on column public.diagnosticos_reforma_tributaria.relatorio_hash is
  'SHA-256 do PDF gerado na ultima geracao, para conferencia de integridade.';
