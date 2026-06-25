create index if not exists idx_rel_prod_empresa_comp_tipo
  on public.rel_resumo_produtos_mensal(empresa_id, competencia, tipo_movimento, valor_total desc);

create index if not exists idx_rel_cfop_empresa_comp
  on public.rel_resumo_cfop_mensal(empresa_id, competencia, valor_total desc);

create index if not exists idx_rel_ncm_empresa_comp
  on public.rel_resumo_ncm_mensal(empresa_id, competencia, valor_total desc);

create index if not exists idx_rel_part_empresa_comp_tipo
  on public.rel_resumo_participantes_mensal(empresa_id, competencia, tipo_movimento, valor_total desc);
