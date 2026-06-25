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
