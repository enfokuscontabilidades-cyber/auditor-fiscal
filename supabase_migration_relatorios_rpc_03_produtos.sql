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
