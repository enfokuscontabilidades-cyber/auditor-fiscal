-- ============================================================================
-- MIGRACAO: Funcoes SQL otimizadas para relatorios fiscais
-- Idempotente: pode ser executada varias vezes.
--
-- Por que existe:
--   Em empresas varejistas, carregar milhares de itens via API e agrupar no
--   Next.js fica lento. Estas funcoes fazem a agregacao dentro do PostgreSQL e
--   retornam apenas o resultado resumido.
-- ============================================================================

create or replace function public.relatorio_documentos_resumo(
  p_empresa_id uuid,
  p_competencias text[] default null,
  p_tipo_movimento text default null,
  p_limite integer default 24
)
returns table (
  competencia text,
  total_entrada numeric,
  total_saida numeric,
  count_entrada bigint,
  count_saida bigint
)
language sql
stable
as $$
  select
    d.data_competencia as competencia,
    coalesce(sum(d.valor_total) filter (where d.tipo_movimento = 'entrada'), 0) as total_entrada,
    coalesce(sum(d.valor_total) filter (where d.tipo_movimento = 'saida'), 0) as total_saida,
    count(*) filter (where d.tipo_movimento = 'entrada') as count_entrada,
    count(*) filter (where d.tipo_movimento = 'saida') as count_saida
  from public.fa_documentos_fiscais d
  where d.empresa_id = p_empresa_id
    and d.status <> 'cancelada'
    and d.data_competencia is not null
    and (p_competencias is null or d.data_competencia = any(p_competencias))
    and (p_tipo_movimento is null or d.tipo_movimento = p_tipo_movimento)
  group by d.data_competencia
  order by
    nullif(split_part(d.data_competencia, '/', 2), '')::int,
    nullif(split_part(d.data_competencia, '/', 1), '')::int
  limit greatest(p_limite, 1);
$$;

create or replace function public.relatorio_participantes_resumo(
  p_empresa_id uuid,
  p_tipo_movimento text,
  p_competencias text[] default null,
  p_limite integer default 50
)
returns table (
  cnpj text,
  nome text,
  valor_total numeric,
  count bigint
)
language sql
stable
as $$
  select
    case when p_tipo_movimento = 'entrada' then d.emitente_cnpj else d.destinatario_cnpj end as cnpj,
    max(case when p_tipo_movimento = 'entrada' then d.emitente_nome else d.destinatario_nome end) as nome,
    coalesce(sum(d.valor_total), 0) as valor_total,
    count(*) as count
  from public.fa_documentos_fiscais d
  where d.empresa_id = p_empresa_id
    and d.status <> 'cancelada'
    and d.tipo_movimento = p_tipo_movimento
    and (p_competencias is null or d.data_competencia = any(p_competencias))
    and coalesce(case when p_tipo_movimento = 'entrada' then d.emitente_cnpj else d.destinatario_cnpj end, '') <> ''
  group by case when p_tipo_movimento = 'entrada' then d.emitente_cnpj else d.destinatario_cnpj end
  order by coalesce(sum(d.valor_total), 0) desc
  limit greatest(p_limite, 1);
$$;

create or replace function public.relatorio_produtos_resumo(
  p_empresa_id uuid,
  p_competencias text[] default null,
  p_tipo_movimento text default null,
  p_limite integer default 50
)
returns table (
  descricao text,
  ncm text,
  valor_total numeric,
  quantidade numeric,
  count bigint
)
language sql
stable
as $$
  select
    coalesce(i.descricao, '') as descricao,
    coalesce(i.ncm, '') as ncm,
    coalesce(sum(i.valor_total), 0) as valor_total,
    coalesce(sum(i.quantidade), 0) as quantidade,
    count(*) as count
  from public.fa_documentos_itens i
  join public.fa_documentos_fiscais d on d.id = i.documento_id
  where i.empresa_id = p_empresa_id
    and d.empresa_id = p_empresa_id
    and d.status <> 'cancelada'
    and (p_competencias is null or d.data_competencia = any(p_competencias))
    and (p_tipo_movimento is null or d.tipo_movimento = p_tipo_movimento)
  group by coalesce(i.descricao, ''), coalesce(i.ncm, '')
  order by coalesce(sum(i.valor_total), 0) desc
  limit greatest(p_limite, 1);
$$;

create or replace function public.relatorio_cfop_resumo(
  p_empresa_id uuid,
  p_competencias text[] default null
)
returns table (
  cfop text,
  tipo text,
  valor_total numeric,
  quantidade numeric,
  count bigint,
  participacao numeric
)
language sql
stable
as $$
  with base as (
    select
      coalesce(i.cfop, 'sem-cfop') as cfop,
      coalesce(sum(i.valor_total), 0) as valor_total,
      coalesce(sum(i.quantidade), 0) as quantidade,
      count(*) as count
    from public.fa_documentos_itens i
    join public.fa_documentos_fiscais d on d.id = i.documento_id
    where i.empresa_id = p_empresa_id
      and d.empresa_id = p_empresa_id
      and d.status <> 'cancelada'
      and (p_competencias is null or d.data_competencia = any(p_competencias))
    group by coalesce(i.cfop, 'sem-cfop')
  ),
  total as (
    select coalesce(sum(valor_total), 0) as total_geral from base
  )
  select
    b.cfop,
    case when b.cfop like '1%' or b.cfop like '2%' or b.cfop like '3%' then 'entrada' else 'saida' end as tipo,
    b.valor_total,
    b.quantidade,
    b.count,
    case when t.total_geral > 0 then (b.valor_total / t.total_geral) * 100 else 0 end as participacao
  from base b cross join total t
  order by b.valor_total desc;
$$;

create or replace function public.relatorio_ncm_resumo(
  p_empresa_id uuid,
  p_competencias text[] default null,
  p_limite integer default 30
)
returns table (
  ncm text,
  descricao_exemplo text,
  valor_total numeric,
  quantidade numeric,
  count_produtos bigint,
  participacao numeric
)
language sql
stable
as $$
  with base as (
    select
      coalesce(i.ncm, 'sem-ncm') as ncm,
      max(coalesce(i.descricao, '')) as descricao_exemplo,
      coalesce(sum(i.valor_total), 0) as valor_total,
      coalesce(sum(i.quantidade), 0) as quantidade,
      count(*) as count_produtos
    from public.fa_documentos_itens i
    join public.fa_documentos_fiscais d on d.id = i.documento_id
    where i.empresa_id = p_empresa_id
      and d.empresa_id = p_empresa_id
      and d.status <> 'cancelada'
      and (p_competencias is null or d.data_competencia = any(p_competencias))
    group by coalesce(i.ncm, 'sem-ncm')
  ),
  total as (
    select coalesce(sum(valor_total), 0) as total_geral from base
  )
  select
    b.ncm,
    b.descricao_exemplo,
    b.valor_total,
    b.quantidade,
    b.count_produtos,
    case when t.total_geral > 0 then (b.valor_total / t.total_geral) * 100 else 0 end as participacao
  from base b cross join total t
  order by b.valor_total desc
  limit greatest(p_limite, 1);
$$;
