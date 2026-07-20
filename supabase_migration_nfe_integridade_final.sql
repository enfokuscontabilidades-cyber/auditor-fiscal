-- =====================================================================
-- MIGRAÇÃO FINAL — integridade e idempotência da importação de NF-e
-- Aplicar DEPOIS das migrações nfe_confiabilidade e classificacao_itens_fix.
-- Idempotente: esta é a definição autoritativa das RPCs de NF-e.
-- =====================================================================

alter table public.fa_documentos_itens
  add column if not exists situacao_classificacao text;

alter table public.fa_documentos_fiscais
  add column if not exists natureza_operacao text,
  add column if not exists finalidade_nfe text,
  add column if not exists valor_seguro numeric(15,2) default 0,
  add column if not exists valor_outras_despesas numeric(15,2) default 0;

alter table public.fa_documentos_itens
  add column if not exists ean text,
  add column if not exists valor_seguro numeric(15,2) default 0,
  add column if not exists valor_outras_despesas numeric(15,2) default 0,
  add column if not exists origem_mercadoria text,
  add column if not exists cbenef text,
  add column if not exists cst_ipi text,
  add column if not exists valor_bc_ipi numeric(15,2) default 0,
  add column if not exists aliquota_ipi numeric(7,4) default 0;

alter table public.fa_documentos_itens
  drop constraint if exists fa_documentos_itens_classificacao_check;
alter table public.fa_documentos_itens
  add constraint fa_documentos_itens_classificacao_check
  check (classificacao in ('revenda','insumo','uso_consumo','imobilizado','combustivel','servico','outros'));

alter table public.fa_documentos_itens
  drop constraint if exists fa_documentos_itens_situacao_classificacao_check;
alter table public.fa_documentos_itens
  add constraint fa_documentos_itens_situacao_classificacao_check
  check (situacao_classificacao is null or situacao_classificacao in ('desconhece','nao_recebido'));

-- A tabela foi criada pela migração de confiabilidade. Reforça o isolamento
-- no próprio RLS, inclusive contra chamadas diretas do browser ao PostgREST.
do $$
begin
  if to_regclass('public.fa_documentos_fiscais') is not null then
    execute 'drop policy if exists "fa_docs_insert" on public.fa_documentos_fiscais';
    execute 'create policy "fa_docs_insert" on public.fa_documentos_fiscais for insert with check (public.is_member_of(org_id))';
  end if;
  if to_regclass('public.fa_documentos_itens') is not null then
    execute 'drop policy if exists "fa_itens_insert" on public.fa_documentos_itens';
    execute 'create policy "fa_itens_insert" on public.fa_documentos_itens for insert with check (public.is_member_of(org_id))';
  end if;
  if to_regclass('public.fa_arquivos_xml') is not null then
    execute 'drop policy if exists "xml_insert" on public.fa_arquivos_xml';
    execute 'drop policy if exists "fa_xml_insert" on public.fa_arquivos_xml';
    execute 'create policy "xml_insert" on public.fa_arquivos_xml for insert with check (public.is_member_of(org_id))';
  end if;
  if to_regclass('public.fa_cfop_faturamento_config') is not null then
    execute 'drop policy if exists "fa_cfop_cfg_insert" on public.fa_cfop_faturamento_config';
    execute 'create policy "fa_cfop_cfg_insert" on public.fa_cfop_faturamento_config for insert with check (public.is_member_of(org_id))';
  end if;
end $$;

-- Cancelamento atômico: cabeçalho, itens e espelho legado ficam coerentes.
create or replace function public.fa_cancelar_nfe(
  p_org_id uuid,
  p_empresa_id uuid,
  p_chaves jsonb,
  p_cancelada_em date default current_date
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_docs integer := 0;
  v_itens integer := 0;
  v_xmls integer := 0;
begin
  if not public.is_member_of(p_org_id) then
    raise exception 'Organização inválida ou sem permissão';
  end if;
  if not exists (
    select 1 from public.empresas
    where id = p_empresa_id and org_id = p_org_id
  ) then
    raise exception 'Empresa inválida ou sem permissão';
  end if;
  if p_chaves is null or jsonb_typeof(p_chaves) <> 'array' then
    raise exception 'p_chaves deve ser um array jsonb';
  end if;

  update public.fa_documentos_fiscais
  set status = 'cancelada',
      cancelada_em = coalesce(p_cancelada_em, current_date),
      impacto_receita = 'sem_impacto',
      updated_at = now()
  where org_id = p_org_id
    and empresa_id = p_empresa_id
    and chave_acesso in (select jsonb_array_elements_text(p_chaves));
  get diagnostics v_docs = row_count;

  update public.fa_documentos_itens i
  set impacto_receita = 'sem_impacto',
      natureza_receita_simples = 'nao_receita'
  where i.org_id = p_org_id
    and i.empresa_id = p_empresa_id
    and exists (
      select 1 from public.fa_documentos_fiscais d
      where d.id = i.documento_id
        and d.chave_acesso in (select jsonb_array_elements_text(p_chaves))
    );
  get diagnostics v_itens = row_count;

  update public.fa_arquivos_xml
  set status = 'cancelada'
  where org_id = p_org_id
    and empresa_id = p_empresa_id
    and chave_nfe in (select jsonb_array_elements_text(p_chaves));
  get diagnostics v_xmls = row_count;

  return jsonb_build_object('documentos', v_docs, 'itens', v_itens, 'xmls', v_xmls);
end;
$$;

grant execute on function public.fa_cancelar_nfe(uuid, uuid, jsonb, date) to authenticated;

-- Remove assinaturas antigas para impedir que uma versão anterior seja escolhida
-- pelo cache de schema do PostgREST.
drop function if exists public.fa_importar_lote_nfe(uuid, uuid, uuid, jsonb);
drop function if exists public.fa_importar_lote_nfe(uuid, uuid, uuid, jsonb, jsonb);

create function public.fa_importar_lote_nfe(
  p_org_id uuid,
  p_empresa_id uuid,
  p_sessao_id uuid,
  p_documentos jsonb,
  p_cancelamentos jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_doc_json jsonb;
  v_itens_json jsonb;
  v_rec public.fa_documentos_fiscais;
  v_doc_id uuid;
  v_was_insert boolean;
  v_itens_count integer;
  v_itens_total integer := 0;
  v_salvos integer := 0;
  v_resultados jsonb := '[]'::jsonb;
  v_tipo_op text;
  v_legado_parsed jsonb;
  v_manuais jsonb;
  v_cancelamentos jsonb;
  v_status_final text;
begin
  if not public.is_member_of(p_org_id) then
    raise exception 'Organização inválida ou sem permissão';
  end if;
  if not exists (
    select 1 from public.empresas
    where id = p_empresa_id and org_id = p_org_id
  ) then
    raise exception 'Empresa inválida ou sem permissão';
  end if;
  if p_sessao_id is not null and not exists (
    select 1 from public.fa_sessoes_analise
    where id = p_sessao_id and empresa_id = p_empresa_id and org_id = p_org_id
  ) then
    raise exception 'Sessão inválida ou sem permissão';
  end if;
  if p_documentos is null or jsonb_typeof(p_documentos) <> 'array' then
    raise exception 'p_documentos deve ser um array jsonb';
  end if;

  for v_doc_json in select * from jsonb_array_elements(p_documentos)
  loop
    begin
      v_rec := jsonb_populate_record(null::public.fa_documentos_fiscais, v_doc_json);
      v_rec.org_id := p_org_id;
      v_rec.empresa_id := p_empresa_id;
      v_rec.sessao_id := p_sessao_id;
      v_rec.tipo_documento := coalesce(v_rec.tipo_documento, 'nfe');
      v_rec.origem := coalesce(v_rec.origem, 'xml_nfe');
      v_rec.valor_total := coalesce(v_rec.valor_total, 0);
      v_rec.valor_produtos := coalesce(v_rec.valor_produtos, 0);
      v_rec.valor_servicos := coalesce(v_rec.valor_servicos, 0);
      v_rec.valor_desconto := coalesce(v_rec.valor_desconto, 0);
      v_rec.valor_frete := coalesce(v_rec.valor_frete, 0);
      v_rec.valor_seguro := coalesce(v_rec.valor_seguro, 0);
      v_rec.valor_outras_despesas := coalesce(v_rec.valor_outras_despesas, 0);
      v_rec.valor_icms := coalesce(v_rec.valor_icms, 0);
      v_rec.valor_pis := coalesce(v_rec.valor_pis, 0);
      v_rec.valor_cofins := coalesce(v_rec.valor_cofins, 0);
      v_rec.valor_st := coalesce(v_rec.valor_st, 0);
      v_rec.valor_ipi := coalesce(v_rec.valor_ipi, 0);
      v_rec.tipo_movimento := coalesce(v_rec.tipo_movimento, 'outros');
      v_rec.impacto_receita := coalesce(v_rec.impacto_receita, 'pendente_revisao');
      v_rec.origem_devolucao := coalesce(v_rec.origem_devolucao, 'nao_aplicavel');
      v_rec.status := coalesce(v_rec.status, 'ok');

      if v_rec.status = 'cancelada' then
        v_rec.impacto_receita := 'sem_impacto';
        v_rec.cancelada_em := coalesce(v_rec.cancelada_em, current_date);
      end if;

      if v_rec.tipo_documento = 'nfe' and coalesce(v_rec.chave_acesso, '') !~ '^[0-9]{44}$' then
        raise exception 'NF-e % sem chave de acesso válida', coalesce(v_rec.numero, '?');
      end if;

      v_itens_json := v_doc_json->'itens';
      if jsonb_typeof(v_itens_json) <> 'array' then
        v_itens_json := '[]'::jsonb;
      end if;
      if v_rec.tipo_documento = 'nfe' and v_rec.status <> 'cancelada' and jsonb_array_length(v_itens_json) = 0 then
        raise exception 'NF-e % sem itens; documento não foi persistido', coalesce(v_rec.numero, v_rec.chave_acesso, '?');
      end if;

      insert into public.fa_documentos_fiscais as d (
        org_id, empresa_id, sessao_id, tipo_documento, origem, chave_acesso, numero, serie, modelo,
        data_emissao, data_competencia, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome,
        natureza_operacao, finalidade_nfe, valor_total, valor_produtos, valor_servicos, valor_desconto,
        valor_frete, valor_seguro, valor_outras_despesas, valor_icms, valor_pis,
        valor_cofins, valor_st, valor_ipi, tipo_movimento, impacto_receita, origem_devolucao,
        ref_chave_acesso, status, cancelada_em, nome_arquivo, hash_arquivo, parsed_data, updated_at
      ) values (
        v_rec.org_id, v_rec.empresa_id, v_rec.sessao_id, v_rec.tipo_documento, v_rec.origem,
        v_rec.chave_acesso, v_rec.numero, v_rec.serie, v_rec.modelo, v_rec.data_emissao,
        v_rec.data_competencia, v_rec.emitente_cnpj, v_rec.emitente_nome, v_rec.destinatario_cnpj,
        v_rec.destinatario_nome, v_rec.natureza_operacao, v_rec.finalidade_nfe, v_rec.valor_total,
        v_rec.valor_produtos, v_rec.valor_servicos, v_rec.valor_desconto, v_rec.valor_frete,
        v_rec.valor_seguro, v_rec.valor_outras_despesas, v_rec.valor_icms, v_rec.valor_pis, v_rec.valor_cofins,
        v_rec.valor_st, v_rec.valor_ipi, v_rec.tipo_movimento, v_rec.impacto_receita,
        v_rec.origem_devolucao, v_rec.ref_chave_acesso, v_rec.status, v_rec.cancelada_em,
        v_rec.nome_arquivo, v_rec.hash_arquivo, v_rec.parsed_data, now()
      )
      on conflict (empresa_id, chave_acesso) do update set
        sessao_id = coalesce(excluded.sessao_id, d.sessao_id),
        tipo_documento = excluded.tipo_documento, origem = excluded.origem, numero = excluded.numero,
        serie = excluded.serie, modelo = excluded.modelo, data_emissao = excluded.data_emissao,
        data_competencia = excluded.data_competencia, emitente_cnpj = excluded.emitente_cnpj,
        emitente_nome = excluded.emitente_nome, destinatario_cnpj = excluded.destinatario_cnpj,
        destinatario_nome = excluded.destinatario_nome, natureza_operacao = excluded.natureza_operacao,
        finalidade_nfe = excluded.finalidade_nfe, valor_total = excluded.valor_total,
        valor_produtos = excluded.valor_produtos, valor_servicos = excluded.valor_servicos,
        valor_desconto = excluded.valor_desconto, valor_frete = excluded.valor_frete,
        valor_seguro = excluded.valor_seguro, valor_outras_despesas = excluded.valor_outras_despesas,
        valor_icms = excluded.valor_icms, valor_pis = excluded.valor_pis,
        valor_cofins = excluded.valor_cofins, valor_st = excluded.valor_st, valor_ipi = excluded.valor_ipi,
        tipo_movimento = excluded.tipo_movimento,
        impacto_receita = case when d.status = 'cancelada' then 'sem_impacto' else excluded.impacto_receita end,
        origem_devolucao = excluded.origem_devolucao, ref_chave_acesso = excluded.ref_chave_acesso,
        status = case when d.status = 'cancelada' and excluded.status <> 'cancelada' then d.status else excluded.status end,
        cancelada_em = case when d.status = 'cancelada' then d.cancelada_em else excluded.cancelada_em end,
        nome_arquivo = excluded.nome_arquivo,
        hash_arquivo = excluded.hash_arquivo, parsed_data = excluded.parsed_data, updated_at = now()
      returning d.id, (xmax = 0), d.status into v_doc_id, v_was_insert, v_status_final;

      select coalesce(jsonb_object_agg(s.item_numero::text, s.payload), '{}'::jsonb)
      into v_manuais
      from (
        select distinct on (item_numero)
          item_numero,
          jsonb_build_object(
            'classificacao', classificacao,
            'situacao_classificacao', situacao_classificacao,
            'classificacao_manual', classificacao_manual
          ) as payload
        from public.fa_documentos_itens
        where documento_id = v_doc_id
          and item_numero is not null
          and classificacao_manual is true
        order by item_numero, created_at desc, id desc
      ) s;

      delete from public.fa_documentos_itens where documento_id = v_doc_id;

      insert into public.fa_documentos_itens (
        org_id, empresa_id, documento_id, item_numero, codigo_produto, ean, descricao, ncm, cest, cfop, unidade,
        quantidade, valor_unitario, valor_total, valor_desconto, valor_frete, valor_seguro,
        valor_outras_despesas, cst_icms, csosn, origem_mercadoria, cbenef,
        valor_bc_icms, aliquota_icms, valor_icms, valor_bc_st, valor_st, cst_pis, valor_bc_pis,
        aliquota_pis, valor_pis, cst_cofins, valor_bc_cofins, aliquota_cofins, valor_cofins,
        cst_ipi, valor_bc_ipi, aliquota_ipi,
        cst_ibs_cbs, cclass_trib, valor_bc_ibs_cbs, aliquota_ibs_uf, valor_ibs_uf,
        aliquota_ibs_mun, valor_ibs_mun, valor_ibs, aliquota_cbs, valor_cbs, valor_ipi,
        classificacao, situacao_classificacao, natureza_receita_simples, tipo_movimento,
        impacto_receita, anexo_sugerido, regra_aplicada, classificacao_manual
      )
      select
        p_org_id, p_empresa_id, v_doc_id, x.item_numero, x.codigo_produto, x.ean, x.descricao, x.ncm, x.cest,
        x.cfop, x.unidade, coalesce(x.quantidade,0), coalesce(x.valor_unitario,0),
        coalesce(x.valor_total,0), coalesce(x.valor_desconto,0), coalesce(x.valor_frete,0),
        coalesce(x.valor_seguro,0), coalesce(x.valor_outras_despesas,0), x.cst_icms, x.csosn,
        x.origem_mercadoria, x.cbenef, coalesce(x.valor_bc_icms,0), coalesce(x.aliquota_icms,0),
        coalesce(x.valor_icms,0), coalesce(x.valor_bc_st,0), coalesce(x.valor_st,0), x.cst_pis,
        coalesce(x.valor_bc_pis,0), coalesce(x.aliquota_pis,0), coalesce(x.valor_pis,0), x.cst_cofins,
        coalesce(x.valor_bc_cofins,0), coalesce(x.aliquota_cofins,0), coalesce(x.valor_cofins,0),
        x.cst_ipi, coalesce(x.valor_bc_ipi,0), coalesce(x.aliquota_ipi,0),
        x.cst_ibs_cbs, x.cclass_trib, coalesce(x.valor_bc_ibs_cbs,0), coalesce(x.aliquota_ibs_uf,0),
        coalesce(x.valor_ibs_uf,0), coalesce(x.aliquota_ibs_mun,0), coalesce(x.valor_ibs_mun,0),
        coalesce(x.valor_ibs,0), coalesce(x.aliquota_cbs,0), coalesce(x.valor_cbs,0), coalesce(x.valor_ipi,0),
        case when coalesce((v_manuais->(x.item_numero::text)->>'classificacao_manual')::boolean,false)
          then v_manuais->(x.item_numero::text)->>'classificacao'
          else coalesce(x.classificacao,'outros') end,
        case when coalesce((v_manuais->(x.item_numero::text)->>'classificacao_manual')::boolean,false)
          then nullif(v_manuais->(x.item_numero::text)->>'situacao_classificacao','')
          else x.situacao_classificacao end,
        case when v_status_final = 'cancelada' then 'nao_receita' else coalesce(x.natureza_receita_simples,'pendente') end,
        coalesce(x.tipo_movimento,'outros'),
        case when v_status_final = 'cancelada' then 'sem_impacto' else coalesce(x.impacto_receita,'pendente_revisao') end,
        x.anexo_sugerido, x.regra_aplicada,
        coalesce((v_manuais->(x.item_numero::text)->>'classificacao_manual')::boolean, x.classificacao_manual, false)
      from jsonb_populate_recordset(null::public.fa_documentos_itens, v_itens_json) x;

      get diagnostics v_itens_count = row_count;
      v_itens_total := v_itens_total + v_itens_count;

      if p_sessao_id is not null then
        v_tipo_op := coalesce(v_doc_json->>'legado_tipo_operacao',
          case when v_rec.tipo_movimento in ('saida','devolucao_compra') then 'saida' else 'entrada' end);
        v_legado_parsed := v_doc_json->'legado_parsed_data';

        insert into public.fa_arquivos_xml (
          org_id, sessao_id, empresa_id, competencia, chave_nfe, numero_nf, data_emissao,
          emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, tipo_operacao,
          valor_total, parsed_data, status
        ) values (
          p_org_id, p_sessao_id, p_empresa_id, v_rec.data_competencia, v_rec.chave_acesso,
          v_rec.numero, v_rec.data_emissao, v_rec.emitente_cnpj, v_rec.emitente_nome,
          v_rec.destinatario_cnpj, v_rec.destinatario_nome, v_tipo_op, v_rec.valor_total,
          v_legado_parsed, v_status_final
        )
        on conflict (empresa_id, chave_nfe) where chave_nfe is not null and chave_nfe <> '' do update set
          sessao_id = excluded.sessao_id, competencia = excluded.competencia, numero_nf = excluded.numero_nf,
          data_emissao = excluded.data_emissao, emitente_cnpj = excluded.emitente_cnpj,
          emitente_nome = excluded.emitente_nome, destinatario_cnpj = excluded.destinatario_cnpj,
          destinatario_nome = excluded.destinatario_nome, tipo_operacao = excluded.tipo_operacao,
          valor_total = excluded.valor_total, parsed_data = excluded.parsed_data, status = excluded.status;
      end if;

      v_salvos := v_salvos + 1;
      v_resultados := v_resultados || jsonb_build_object(
        'documento_id', v_doc_id, 'chave_acesso', v_rec.chave_acesso, 'numero', v_rec.numero,
        'status', case when v_was_insert then 'importado' else 'atualizado' end,
        'itens_salvos', v_itens_count
      );
    exception when others then
      v_resultados := v_resultados || jsonb_build_object(
        'documento_id', null, 'chave_acesso', v_doc_json->>'chave_acesso',
        'numero', v_doc_json->>'numero', 'status', 'erro', 'motivo', sqlerrm
      );
    end;
  end loop;

  v_cancelamentos := coalesce(p_cancelamentos, '[]'::jsonb);
  if jsonb_typeof(v_cancelamentos) <> 'array' then
    raise exception 'p_cancelamentos deve ser um array jsonb';
  end if;
  if jsonb_array_length(v_cancelamentos) > 0 then
    perform public.fa_cancelar_nfe(p_org_id, p_empresa_id, v_cancelamentos, current_date);
  end if;

  return jsonb_build_object(
    'salvos', v_salvos,
    'itens_salvos', v_itens_total,
    'resultados', v_resultados
  );
end;
$$;

grant execute on function public.fa_importar_lote_nfe(uuid, uuid, uuid, jsonb, jsonb) to authenticated;
