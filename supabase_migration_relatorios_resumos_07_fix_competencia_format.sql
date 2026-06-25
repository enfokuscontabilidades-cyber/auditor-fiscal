-- Corrige o refresh dos resumos para aceitar documentos com competencia em
-- formato MM/YYYY ou YYYY-MM.
--
-- Sintoma corrigido:
-- - Relatorios deixam de dar timeout, mas mostram "Sem dados"
-- - Filtro da tela usa 2025-01, API normaliza para 01/2025
-- - Documentos importados podem estar com data_competencia = 2025-01

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
  v_competencia_alt text;
  v_documentos integer := 0;
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

  if p_competencia ~ '^\d{2}/\d{4}$' then
    v_competencia_alt := substring(p_competencia from 4 for 4) || '-' || substring(p_competencia from 1 for 2);
  elsif p_competencia ~ '^\d{4}-\d{2}$' then
    v_competencia_alt := substring(p_competencia from 6 for 2) || '/' || substring(p_competencia from 1 for 4);
  else
    v_competencia_alt := p_competencia;
  end if;

  delete from public.rel_resumo_documentos_mensal
  where empresa_id = p_empresa_id and competencia in (p_competencia, v_competencia_alt);

  delete from public.rel_resumo_produtos_mensal
  where empresa_id = p_empresa_id and competencia in (p_competencia, v_competencia_alt);

  delete from public.rel_resumo_cfop_mensal
  where empresa_id = p_empresa_id and competencia in (p_competencia, v_competencia_alt);

  delete from public.rel_resumo_ncm_mensal
  where empresa_id = p_empresa_id and competencia in (p_competencia, v_competencia_alt);

  delete from public.rel_resumo_participantes_mensal
  where empresa_id = p_empresa_id and competencia in (p_competencia, v_competencia_alt);

  insert into public.rel_resumo_documentos_mensal (
    org_id, empresa_id, competencia, tipo_movimento, valor_total, count, updated_at
  )
  select
    v_org_id,
    p_empresa_id,
    p_competencia,
    d.tipo_movimento,
    coalesce(sum(d.valor_total), 0),
    count(*),
    now()
  from public.fa_documentos_fiscais d
  where d.empresa_id = p_empresa_id
    and d.data_competencia in (p_competencia, v_competencia_alt)
    and d.status <> 'cancelada'
    and d.tipo_movimento in ('entrada', 'saida')
  group by d.tipo_movimento;
  get diagnostics v_documentos = row_count;

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
    and d.data_competencia in (p_competencia, v_competencia_alt)
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
    and d.data_competencia in (p_competencia, v_competencia_alt)
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
    and d.data_competencia in (p_competencia, v_competencia_alt)
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
    and d.data_competencia in (p_competencia, v_competencia_alt)
    and d.status <> 'cancelada'
    and d.tipo_movimento in ('entrada', 'saida')
    and coalesce(case when d.tipo_movimento = 'entrada' then d.emitente_cnpj else d.destinatario_cnpj end, '') <> ''
  group by
    d.tipo_movimento,
    case when d.tipo_movimento = 'entrada' then d.emitente_cnpj else d.destinatario_cnpj end;
  get diagnostics v_participantes = row_count;

  return jsonb_build_object(
    'competencia', p_competencia,
    'competencia_alternativa', v_competencia_alt,
    'documentos', v_documentos,
    'produtos', v_produtos,
    'cfops', v_cfops,
    'ncms', v_ncms,
    'participantes', v_participantes
  );
end;
$$;
