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
