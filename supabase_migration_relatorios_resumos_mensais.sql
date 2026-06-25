-- ============================================================================
-- MIGRACAO: Resumos mensais para relatorios de alto volume
-- Idempotente: pode ser executada varias vezes.
--
-- Objetivo:
--   Evitar recalcular Produtos, CFOP, NCM e Participantes toda vez que a tela abre.
--   A funcao refresh_relatorios_mensais consolida uma empresa+competencia.
-- ============================================================================

create table if not exists public.rel_resumo_produtos_mensal (
  org_id uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id uuid references public.empresas(id) on delete cascade not null,
  competencia text not null,
  tipo_movimento text not null,
  descricao text not null default '',
  ncm text not null default '',
  valor_total numeric(15,2) not null default 0,
  quantidade numeric(15,4) not null default 0,
  count bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (empresa_id, competencia, tipo_movimento, descricao, ncm)
);

create table if not exists public.rel_resumo_cfop_mensal (
  org_id uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id uuid references public.empresas(id) on delete cascade not null,
  competencia text not null,
  cfop text not null default 'sem-cfop',
  tipo text not null,
  valor_total numeric(15,2) not null default 0,
  quantidade numeric(15,4) not null default 0,
  count bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (empresa_id, competencia, cfop)
);

create table if not exists public.rel_resumo_ncm_mensal (
  org_id uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id uuid references public.empresas(id) on delete cascade not null,
  competencia text not null,
  ncm text not null default 'sem-ncm',
  descricao_exemplo text not null default '',
  valor_total numeric(15,2) not null default 0,
  quantidade numeric(15,4) not null default 0,
  count_produtos bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (empresa_id, competencia, ncm)
);

create table if not exists public.rel_resumo_participantes_mensal (
  org_id uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id uuid references public.empresas(id) on delete cascade not null,
  competencia text not null,
  tipo_movimento text not null,
  cnpj text not null,
  nome text not null default '',
  valor_total numeric(15,2) not null default 0,
  count bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (empresa_id, competencia, tipo_movimento, cnpj)
);

create index if not exists idx_rel_prod_empresa_comp_tipo
  on public.rel_resumo_produtos_mensal(empresa_id, competencia, tipo_movimento, valor_total desc);

create index if not exists idx_rel_cfop_empresa_comp
  on public.rel_resumo_cfop_mensal(empresa_id, competencia, valor_total desc);

create index if not exists idx_rel_ncm_empresa_comp
  on public.rel_resumo_ncm_mensal(empresa_id, competencia, valor_total desc);

create index if not exists idx_rel_part_empresa_comp_tipo
  on public.rel_resumo_participantes_mensal(empresa_id, competencia, tipo_movimento, valor_total desc);

alter table public.rel_resumo_produtos_mensal enable row level security;
alter table public.rel_resumo_cfop_mensal enable row level security;
alter table public.rel_resumo_ncm_mensal enable row level security;
alter table public.rel_resumo_participantes_mensal enable row level security;

drop policy if exists "rel_prod_select" on public.rel_resumo_produtos_mensal;
drop policy if exists "rel_prod_all" on public.rel_resumo_produtos_mensal;
create policy "rel_prod_select" on public.rel_resumo_produtos_mensal
  for select using (public.is_member_of(org_id));
create policy "rel_prod_all" on public.rel_resumo_produtos_mensal
  for all using (public.is_member_of(org_id)) with check (public.is_member_of(org_id));

drop policy if exists "rel_cfop_select" on public.rel_resumo_cfop_mensal;
drop policy if exists "rel_cfop_all" on public.rel_resumo_cfop_mensal;
create policy "rel_cfop_select" on public.rel_resumo_cfop_mensal
  for select using (public.is_member_of(org_id));
create policy "rel_cfop_all" on public.rel_resumo_cfop_mensal
  for all using (public.is_member_of(org_id)) with check (public.is_member_of(org_id));

drop policy if exists "rel_ncm_select" on public.rel_resumo_ncm_mensal;
drop policy if exists "rel_ncm_all" on public.rel_resumo_ncm_mensal;
create policy "rel_ncm_select" on public.rel_resumo_ncm_mensal
  for select using (public.is_member_of(org_id));
create policy "rel_ncm_all" on public.rel_resumo_ncm_mensal
  for all using (public.is_member_of(org_id)) with check (public.is_member_of(org_id));

drop policy if exists "rel_part_select" on public.rel_resumo_participantes_mensal;
drop policy if exists "rel_part_all" on public.rel_resumo_participantes_mensal;
create policy "rel_part_select" on public.rel_resumo_participantes_mensal
  for select using (public.is_member_of(org_id));
create policy "rel_part_all" on public.rel_resumo_participantes_mensal
  for all using (public.is_member_of(org_id)) with check (public.is_member_of(org_id));

create or replace function public.refresh_relatorios_mensais(
  p_empresa_id uuid,
  p_competencia text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_org_id uuid;
  v_produtos integer := 0;
  v_cfops integer := 0;
  v_ncms integer := 0;
  v_participantes integer := 0;
begin
  select e.org_id into v_org_id
  from public.empresas e
  where e.id = p_empresa_id;

  if v_org_id is null then
    raise exception 'Empresa % nao encontrada', p_empresa_id;
  end if;

  delete from public.rel_resumo_produtos_mensal
  where empresa_id = p_empresa_id and competencia = p_competencia;

  delete from public.rel_resumo_cfop_mensal
  where empresa_id = p_empresa_id and competencia = p_competencia;

  delete from public.rel_resumo_ncm_mensal
  where empresa_id = p_empresa_id and competencia = p_competencia;

  delete from public.rel_resumo_participantes_mensal
  where empresa_id = p_empresa_id and competencia = p_competencia;

  insert into public.rel_resumo_produtos_mensal (
    org_id, empresa_id, competencia, tipo_movimento, descricao, ncm,
    valor_total, quantidade, count, updated_at
  )
  select
    v_org_id,
    p_empresa_id,
    p_competencia,
    d.tipo_movimento,
    coalesce(i.descricao, ''),
    coalesce(i.ncm, ''),
    coalesce(sum(i.valor_total), 0),
    coalesce(sum(i.quantidade), 0),
    count(*),
    now()
  from public.fa_documentos_itens i
  join public.fa_documentos_fiscais d on d.id = i.documento_id
  where i.empresa_id = p_empresa_id
    and d.empresa_id = p_empresa_id
    and d.data_competencia = p_competencia
    and d.status <> 'cancelada'
  group by d.tipo_movimento, coalesce(i.descricao, ''), coalesce(i.ncm, '');
  get diagnostics v_produtos = row_count;

  insert into public.rel_resumo_cfop_mensal (
    org_id, empresa_id, competencia, cfop, tipo, valor_total, quantidade, count, updated_at
  )
  select
    v_org_id,
    p_empresa_id,
    p_competencia,
    coalesce(i.cfop, 'sem-cfop'),
    case when coalesce(i.cfop, '') like '1%' or coalesce(i.cfop, '') like '2%' or coalesce(i.cfop, '') like '3%' then 'entrada' else 'saida' end,
    coalesce(sum(i.valor_total), 0),
    coalesce(sum(i.quantidade), 0),
    count(*),
    now()
  from public.fa_documentos_itens i
  join public.fa_documentos_fiscais d on d.id = i.documento_id
  where i.empresa_id = p_empresa_id
    and d.empresa_id = p_empresa_id
    and d.data_competencia = p_competencia
    and d.status <> 'cancelada'
  group by
    coalesce(i.cfop, 'sem-cfop'),
    case when coalesce(i.cfop, '') like '1%' or coalesce(i.cfop, '') like '2%' or coalesce(i.cfop, '') like '3%' then 'entrada' else 'saida' end;
  get diagnostics v_cfops = row_count;

  insert into public.rel_resumo_ncm_mensal (
    org_id, empresa_id, competencia, ncm, descricao_exemplo,
    valor_total, quantidade, count_produtos, updated_at
  )
  select
    v_org_id,
    p_empresa_id,
    p_competencia,
    coalesce(i.ncm, 'sem-ncm'),
    max(coalesce(i.descricao, '')),
    coalesce(sum(i.valor_total), 0),
    coalesce(sum(i.quantidade), 0),
    count(*),
    now()
  from public.fa_documentos_itens i
  join public.fa_documentos_fiscais d on d.id = i.documento_id
  where i.empresa_id = p_empresa_id
    and d.empresa_id = p_empresa_id
    and d.data_competencia = p_competencia
    and d.status <> 'cancelada'
  group by coalesce(i.ncm, 'sem-ncm');
  get diagnostics v_ncms = row_count;

  insert into public.rel_resumo_participantes_mensal (
    org_id, empresa_id, competencia, tipo_movimento, cnpj, nome, valor_total, count, updated_at
  )
  select
    v_org_id,
    p_empresa_id,
    p_competencia,
    d.tipo_movimento,
    case when d.tipo_movimento = 'entrada' then d.emitente_cnpj else d.destinatario_cnpj end,
    max(case when d.tipo_movimento = 'entrada' then d.emitente_nome else d.destinatario_nome end),
    coalesce(sum(d.valor_total), 0),
    count(*),
    now()
  from public.fa_documentos_fiscais d
  where d.empresa_id = p_empresa_id
    and d.data_competencia = p_competencia
    and d.status <> 'cancelada'
    and d.tipo_movimento in ('entrada', 'saida')
    and coalesce(case when d.tipo_movimento = 'entrada' then d.emitente_cnpj else d.destinatario_cnpj end, '') <> ''
  group by
    d.tipo_movimento,
    case when d.tipo_movimento = 'entrada' then d.emitente_cnpj else d.destinatario_cnpj end;
  get diagnostics v_participantes = row_count;

  return jsonb_build_object(
    'produtos', v_produtos,
    'cfops', v_cfops,
    'ncms', v_ncms,
    'participantes', v_participantes
  );
end;
$$;
