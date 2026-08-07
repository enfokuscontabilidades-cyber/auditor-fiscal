-- Blindagem do vínculo usuário × organização e da coerência org × empresa.
-- Pré-requisito: a consulta de diagnóstico ao final deve retornar zero linhas.

begin;

do $$
begin
  if exists (
    select 1
      from public.membros_organizacao
     group by user_id
    having count(*) > 1
  ) then
    raise exception 'Existem usuários em mais de uma organização. Consolide os vínculos antes desta migração.';
  end if;
end $$;

-- O produto atual trabalha com exatamente um escritório por usuário.
create unique index if not exists ux_membros_organizacao_user
  on public.membros_organizacao(user_id);

-- Chaves compostas usadas para impedir que um registro carregue empresa_id de
-- um escritório e org_id de outro. NOT VALID evita uma varredura longa agora,
-- mas já protege toda inserção/alteração nova.
create unique index if not exists ux_empresas_id_org
  on public.empresas(id, org_id);

create unique index if not exists ux_sessoes_id_empresa_org
  on public.fa_sessoes_analise(id, empresa_id, org_id);

do $$
declare
  v_table text;
  v_constraint text;
begin
  foreach v_table in array array[
    'fa_sessoes_analise',
    'fa_arquivos_sped',
    'fa_arquivos_xml',
    'fa_documentos_fiscais',
    'fa_documentos_itens',
    'fa_apuracoes_icms',
    'fa_apuracoes_contrib',
    'fa_alertas',
    'fa_obrigacoes_acessorias',
    'fa_planejamento_tributario',
    'sn_declaracoes',
    'sn_receitas_mensais',
    'sn_apuracoes',
    'sn_apuracoes_receitas',
    'cobrancas'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      v_constraint := 'fk_' || v_table || '_empresa_org';
      if not exists (
        select 1 from pg_constraint
         where conname = v_constraint
           and conrelid = to_regclass('public.' || v_table)
      ) then
        execute format(
          'alter table public.%I add constraint %I foreign key (empresa_id, org_id) references public.empresas(id, org_id) not valid',
          v_table,
          v_constraint
        );
      end if;
    end if;
  end loop;
end $$;

-- Arquivos também não podem apontar para uma sessão de outra empresa/org.
alter table public.fa_arquivos_sped
  drop constraint if exists fk_fa_arquivos_sped_sessao_empresa_org;
alter table public.fa_arquivos_sped
  add constraint fk_fa_arquivos_sped_sessao_empresa_org
  foreign key (sessao_id, empresa_id, org_id)
  references public.fa_sessoes_analise(id, empresa_id, org_id) not valid;

alter table public.fa_arquivos_xml
  drop constraint if exists fk_fa_arquivos_xml_sessao_empresa_org;
alter table public.fa_arquivos_xml
  add constraint fk_fa_arquivos_xml_sessao_empresa_org
  foreign key (sessao_id, empresa_id, org_id)
  references public.fa_sessoes_analise(id, empresa_id, org_id) not valid;

commit;

-- Ferramenta de diagnóstico: deve retornar zero linhas.
select
  m.user_id,
  count(*) as total_vinculos,
  array_agg(m.org_id order by m.created_at) as organizacoes
from public.membros_organizacao m
group by m.user_id
having count(*) > 1;

