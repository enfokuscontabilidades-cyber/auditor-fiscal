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
