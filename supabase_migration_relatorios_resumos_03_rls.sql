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
