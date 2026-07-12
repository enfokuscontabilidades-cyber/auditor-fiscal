-- Bloqueia novos cadastros/edicoes de empresas com CNPJ fora do padrao atual.
-- A constraint fica NOT VALID para nao falhar em bases que ja tenham cadastros antigos incorretos.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'empresas_cnpj_14_digits'
      and conrelid = 'public.empresas'::regclass
  ) then
    alter table public.empresas
      add constraint empresas_cnpj_14_digits
      check (cnpj is null or cnpj ~ '^[0-9]{14}$') not valid;
  end if;
end $$;
