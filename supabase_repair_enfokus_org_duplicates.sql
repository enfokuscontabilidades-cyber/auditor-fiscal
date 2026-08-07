-- Reparo pontual dos vínculos duplicados encontrados em 07/08/2026.
-- Execute antes de supabase_migration_org_integrity.sql.
-- O bloco é transacional e aborta se encontrar dados fora do cenário auditado.

begin;

do $$
declare
  v_canonical_org constant uuid := '329bfcd9-5453-4211-99a1-1564518f2661';
  v_empty_org constant uuid := '0676627e-b10a-4a13-81f2-412b1e41f1fa';
  v_legacy_org constant uuid := '7ae31537-4e76-40a5-8db8-ddc187089db2';
  v_canonical_company constant uuid := '350b351e-367e-4db9-96d0-adf2a815e53c';
  v_legacy_company constant uuid := '9c04cdf8-1cca-43bb-894d-22d318e0791e';
  v_count bigint;
  v_legacy_sessions bigint;
  v_legacy_xmls bigint;
begin
  if not exists (select 1 from public.organizacoes where id = v_canonical_org) then
    raise exception 'Organização canônica não encontrada; reparo cancelado';
  end if;

  select count(*) into v_count from public.empresas where org_id = v_empty_org;
  if v_count <> 0 then
    raise exception 'Organização vazia possui % empresa(s); reparo cancelado', v_count;
  end if;

  select count(*) into v_count from public.empresas where org_id = v_legacy_org;
  if v_count <> 1 or not exists (
    select 1 from public.empresas
    where id = v_legacy_company and org_id = v_legacy_org and cnpj = '32807814000129'
  ) then
    raise exception 'Conteúdo da organização legada mudou; reparo cancelado';
  end if;

  if not exists (
    select 1 from public.empresas
    where id = v_canonical_company and org_id = v_canonical_org and cnpj = '32807814000129'
  ) then
    raise exception 'Empresa canônica não encontrada; reparo cancelado';
  end if;

  select count(*) into v_legacy_sessions
    from public.fa_sessoes_analise where org_id = v_legacy_org;
  select count(*) into v_legacy_xmls
    from public.fa_arquivos_xml where org_id = v_legacy_org;

  -- A sessão e seus XMLs legados passam a pertencer à empresa já existente
  -- no escritório compartilhado. Nenhum arquivo fiscal é descartado.
  update public.fa_sessoes_analise
     set org_id = v_canonical_org,
         empresa_id = v_canonical_company,
         updated_at = now()
   where org_id = v_legacy_org;
  get diagnostics v_count = row_count;
  if v_count <> v_legacy_sessions then
    raise exception 'Nem todas as sessões foram transferidas; reparo cancelado';
  end if;

  update public.fa_arquivos_xml
     set org_id = v_canonical_org,
         empresa_id = v_canonical_company
   where org_id = v_legacy_org;
  get diagnostics v_count = row_count;
  if v_count <> v_legacy_xmls then
    raise exception 'Nem todos os XMLs foram transferidos; reparo cancelado';
  end if;

  delete from public.empresas where id = v_legacy_company;

  -- Remove somente os vínculos excedentes. Os dois usuários permanecem na
  -- organização canônica com seus papéis atuais.
  delete from public.membros_organizacao
   where org_id in (v_empty_org, v_legacy_org);

  delete from public.organizacoes
   where id in (v_empty_org, v_legacy_org);
end $$;

commit;
