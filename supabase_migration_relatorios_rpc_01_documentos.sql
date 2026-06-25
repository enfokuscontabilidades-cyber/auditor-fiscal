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
