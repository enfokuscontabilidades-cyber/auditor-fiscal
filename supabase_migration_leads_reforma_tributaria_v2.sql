-- =============================================================================
-- MIGRACAO v2: Leads da isca digital de Reforma Tributaria (IBS/CBS)
-- Amplia leads_reforma_tributaria com dados de contato, consentimentos LGPD,
-- rastreamento de origem/UTM, status comercial e codigo de diagnostico.
-- Idempotente: pode ser executada multiplas vezes no SQL Editor do Supabase.
-- =============================================================================

alter table public.leads_reforma_tributaria
  add column if not exists cnpj text,
  add column if not exists estado text,
  add column if not exists cidade text,
  add column if not exists sistema_emissor text,
  add column if not exists consentimento_dados boolean not null default false,
  add column if not exists consentimento_contato boolean not null default false,
  add column if not exists consentimento_versao text,
  add column if not exists ip text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists pagina_origem text,
  add column if not exists status text not null default 'novo',
  add column if not exists codigo_diagnostico text,
  add column if not exists quantidade_xmls integer not null default 0,
  add column if not exists observacoes text,
  add column if not exists contatado_em timestamptz,
  add column if not exists atualizado_em timestamptz not null default now();

-- Campos que existiam como obrigatorios na v1 viram opcionais: o formulario
-- publico atual coleta apenas os campos essenciais (nome, empresa, cnpj,
-- whatsapp, e-mail, regime, estado, cidade + sistema emissor opcional).
alter table public.leads_reforma_tributaria
  alter column porte_empresa drop not null,
  alter column funcionarios_faixa drop not null,
  alter column faturamento_faixa drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_reforma_status_check'
  ) then
    alter table public.leads_reforma_tributaria
      add constraint leads_reforma_status_check check (status in (
        'novo', 'diagnostico_iniciado', 'diagnostico_concluido', 'aguardando_contato',
        'contatado', 'reuniao_agendada', 'proposta_enviada', 'convertido', 'sem_interesse', 'invalido'
      ));
  end if;
end $$;

create unique index if not exists idx_leads_reforma_codigo_diagnostico
  on public.leads_reforma_tributaria(codigo_diagnostico)
  where codigo_diagnostico is not null;

create index if not exists idx_leads_reforma_cnpj
  on public.leads_reforma_tributaria(cnpj);

create index if not exists idx_leads_reforma_status
  on public.leads_reforma_tributaria(status);

comment on column public.leads_reforma_tributaria.consentimento_dados is
  'Autorizacao para tratamento dos dados informados, exigida para liberar o diagnostico (LGPD).';
comment on column public.leads_reforma_tributaria.consentimento_contato is
  'Autorizacao separada para contato comercial por telefone, WhatsApp ou e-mail.';
comment on column public.leads_reforma_tributaria.consentimento_versao is
  'Versao do texto de consentimento apresentado no momento do aceite.';
comment on column public.leads_reforma_tributaria.codigo_diagnostico is
  'Codigo curto exibido ao lead e usado na mensagem automatica do WhatsApp.';
comment on column public.leads_reforma_tributaria.status is
  'Status comercial do lead no funil da Enfokus Contabilidade.';
