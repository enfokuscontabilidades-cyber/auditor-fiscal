-- =======================================================================
-- MIGRAÇÃO — Correção da classificação de itens e isolamento de falhas
-- por documento na importação de NF-e (Validador de Entradas)
-- Executar no Supabase Studio → SQL Editor
-- IDEMPOTENTE: pode ser executada múltiplas vezes sem erros.
--
-- CAUSA-RAIZ CORRIGIDA:
--
-- 1) O seletor manual de classificação do Validador de Entradas
--    (ClassificacaoManual, em validador_entradas/page.tsx) sempre aceitou
--    "combustivel", "desconhece" e "nao_recebido" além dos valores fiscais
--    reais. A gravação enviava `classificacao: l.classificacao || "outros"`
--    — como essas três strings são truthy, elas iam direto para o banco.
--    A constraint fa_documentos_itens_classificacao_check só aceitava
--    ('revenda','insumo','uso_consumo','imobilizado','servico','outros'),
--    então qualquer item marcado como combustível/desconhece/não recebido
--    derrubava a função fa_importar_lote_nfe inteira — e, por ela processar
--    até 200 documentos por chamada numa única transação implícita, um
--    único item ruim invalidava TODOS os documentos do lote (nenhum
--    documento, item ou fa_arquivos_xml era gravado, mesmo os válidos).
--
--    Correção adotada (documentada em lib/types.ts):
--      a) "combustivel" é uma classificação fiscal legítima (já usada em
--         lib/fiscal/classificacao.ts para o SPED) — passa a ser aceita
--         na constraint de fa_documentos_itens.classificacao.
--      b) "desconhece" e "nao_recebido" são RESPOSTAS OPERACIONAIS do
--         usuário durante a conferência (não são uma classificação
--         fiscal do item) — ganham coluna própria,
--         fa_documentos_itens.situacao_classificacao, e nunca são
--         gravadas na coluna `classificacao`.
--
-- 2) fa_importar_lote_nfe processava até 200 documentos numa única
--    transação de função: uma exceção em qualquer ponto (constraint
--    violation, erro de tipo, etc.) desfazia TODOS os documentos do lote,
--    inclusive os que não tinham problema algum. Esta migração isola cada
--    documento num bloco BEGIN/EXCEPTION próprio (savepoint implícito do
--    PL/pgSQL) — agora uma falha em um documento é revertida SOMENTE para
--    aquele documento (ele + seus itens + seu fa_arquivos_xml voltam
--    atrás), e os demais documentos do mesmo lote continuam sendo
--    salvos normalmente. O motivo do erro (SQLERRM) é reportado por
--    documento em `resultados`, para a API devolver uma mensagem útil.
-- =======================================================================

-- -----------------------------------------------------------------------
-- 1. NOVA COLUNA — situacao_classificacao (estado operacional de revisão,
--    separado da classificação fiscal). Nunca é usada por nenhuma regra
--    fiscal ou apuração — é só um marcador do andamento da conferência.
-- -----------------------------------------------------------------------
alter table public.fa_documentos_itens
  add column if not exists situacao_classificacao text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fa_documentos_itens_situacao_classificacao_check'
  ) then
    alter table public.fa_documentos_itens
      add constraint fa_documentos_itens_situacao_classificacao_check
      check (situacao_classificacao in ('desconhece', 'nao_recebido'));
  end if;
end $$;

-- -----------------------------------------------------------------------
-- 2. AMPLIA A CONSTRAINT DE classificacao — adiciona "combustivel"
--    (classificação fiscal real, não um estado operacional).
-- -----------------------------------------------------------------------
alter table public.fa_documentos_itens
  drop constraint if exists fa_documentos_itens_classificacao_check;

alter table public.fa_documentos_itens
  add constraint fa_documentos_itens_classificacao_check
  check (classificacao in ('revenda', 'insumo', 'uso_consumo', 'imobilizado', 'combustivel', 'servico', 'outros'));

-- -----------------------------------------------------------------------
-- 3. FA_IMPORTAR_LOTE_NFE — mesma assinatura e mesmo contrato de retorno
--    de supabase_migration_nfe_confiabilidade.sql, agora com:
--      a) coluna situacao_classificacao no insert de itens;
--      b) isolamento de falha por documento (bloco BEGIN/EXCEPTION),
--         para que um documento com problema não derrube o lote inteiro.
-- -----------------------------------------------------------------------
create or replace function public.fa_importar_lote_nfe(
  p_org_id      uuid,
  p_empresa_id  uuid,
  p_sessao_id   uuid,
  p_documentos  jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_doc_json      jsonb;
  v_itens_json    jsonb;
  v_rec           public.fa_documentos_fiscais;
  v_doc_id        uuid;
  v_was_insert    boolean;
  v_itens_count   integer;
  v_itens_total   integer := 0;
  v_salvos        integer := 0;
  v_resultados    jsonb := '[]'::jsonb;
  v_tipo_op       text;
  v_legado_parsed jsonb;
begin
  if p_documentos is null or jsonb_typeof(p_documentos) <> 'array' then
    raise exception 'p_documentos deve ser um array jsonb';
  end if;

  for v_doc_json in select * from jsonb_array_elements(p_documentos)
  loop
    -- Bloco por documento: uma exceção aqui (ex: constraint violation) só
    -- desfaz ESTE documento (savepoint implícito do PL/pgSQL) — os demais
    -- documentos do mesmo lote continuam sendo processados normalmente.
    begin
      v_rec := jsonb_populate_record(null::public.fa_documentos_fiscais, v_doc_json);
      v_rec.org_id           := p_org_id;
      v_rec.empresa_id       := p_empresa_id;
      v_rec.tipo_documento   := coalesce(v_rec.tipo_documento, 'nfe');
      v_rec.origem           := coalesce(v_rec.origem, 'xml_nfe');
      v_rec.valor_total      := coalesce(v_rec.valor_total, 0);
      v_rec.valor_produtos   := coalesce(v_rec.valor_produtos, 0);
      v_rec.valor_servicos   := coalesce(v_rec.valor_servicos, 0);
      v_rec.valor_desconto   := coalesce(v_rec.valor_desconto, 0);
      v_rec.valor_frete      := coalesce(v_rec.valor_frete, 0);
      v_rec.valor_icms       := coalesce(v_rec.valor_icms, 0);
      v_rec.valor_pis        := coalesce(v_rec.valor_pis, 0);
      v_rec.valor_cofins     := coalesce(v_rec.valor_cofins, 0);
      v_rec.valor_st         := coalesce(v_rec.valor_st, 0);
      v_rec.valor_ipi        := coalesce(v_rec.valor_ipi, 0);
      v_rec.tipo_movimento   := coalesce(v_rec.tipo_movimento, 'outros');
      v_rec.impacto_receita  := coalesce(v_rec.impacto_receita, 'pendente_revisao');
      v_rec.origem_devolucao := coalesce(v_rec.origem_devolucao, 'nao_aplicavel');
      v_rec.status           := coalesce(v_rec.status, 'ok');

      if v_rec.chave_acesso is null and v_rec.numero is null then
        v_resultados := v_resultados || jsonb_build_object(
          'documento_id', null, 'chave_acesso', null, 'numero', null,
          'status', 'erro', 'motivo', 'Documento sem chave de acesso nem número — não pode ser importado.'
        );
        continue;
      end if;

      insert into public.fa_documentos_fiscais as d (
        org_id, empresa_id, tipo_documento, origem, chave_acesso, numero, serie, modelo,
        data_emissao, data_competencia, emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome,
        valor_total, valor_produtos, valor_servicos, valor_desconto, valor_frete, valor_icms, valor_pis,
        valor_cofins, valor_st, valor_ipi, tipo_movimento, impacto_receita, origem_devolucao,
        ref_chave_acesso, status, cancelada_em, nome_arquivo, hash_arquivo, parsed_data, updated_at
      )
      values (
        v_rec.org_id, v_rec.empresa_id, v_rec.tipo_documento, v_rec.origem, v_rec.chave_acesso, v_rec.numero,
        v_rec.serie, v_rec.modelo, v_rec.data_emissao, v_rec.data_competencia, v_rec.emitente_cnpj, v_rec.emitente_nome,
        v_rec.destinatario_cnpj, v_rec.destinatario_nome, v_rec.valor_total, v_rec.valor_produtos, v_rec.valor_servicos,
        v_rec.valor_desconto, v_rec.valor_frete, v_rec.valor_icms, v_rec.valor_pis, v_rec.valor_cofins, v_rec.valor_st,
        v_rec.valor_ipi, v_rec.tipo_movimento, v_rec.impacto_receita, v_rec.origem_devolucao, v_rec.ref_chave_acesso,
        v_rec.status, v_rec.cancelada_em, v_rec.nome_arquivo, v_rec.hash_arquivo, v_rec.parsed_data, now()
      )
      on conflict (empresa_id, chave_acesso) do update set
        tipo_documento = excluded.tipo_documento, origem = excluded.origem, numero = excluded.numero,
        serie = excluded.serie, modelo = excluded.modelo, data_emissao = excluded.data_emissao,
        data_competencia = excluded.data_competencia, emitente_cnpj = excluded.emitente_cnpj,
        emitente_nome = excluded.emitente_nome, destinatario_cnpj = excluded.destinatario_cnpj,
        destinatario_nome = excluded.destinatario_nome, valor_total = excluded.valor_total,
        valor_produtos = excluded.valor_produtos, valor_servicos = excluded.valor_servicos,
        valor_desconto = excluded.valor_desconto, valor_frete = excluded.valor_frete,
        valor_icms = excluded.valor_icms, valor_pis = excluded.valor_pis, valor_cofins = excluded.valor_cofins,
        valor_st = excluded.valor_st, valor_ipi = excluded.valor_ipi, tipo_movimento = excluded.tipo_movimento,
        impacto_receita = excluded.impacto_receita, origem_devolucao = excluded.origem_devolucao,
        ref_chave_acesso = excluded.ref_chave_acesso, status = excluded.status, cancelada_em = excluded.cancelada_em,
        nome_arquivo = excluded.nome_arquivo, hash_arquivo = excluded.hash_arquivo, parsed_data = excluded.parsed_data,
        updated_at = now()
      returning d.id, (xmax = 0) into v_doc_id, v_was_insert;

      delete from public.fa_documentos_itens where documento_id = v_doc_id;

      v_itens_json := v_doc_json->'itens';
      if jsonb_typeof(v_itens_json) <> 'array' then
        v_itens_json := '[]'::jsonb;
      end if;

      insert into public.fa_documentos_itens (
        org_id, empresa_id, documento_id, item_numero, codigo_produto, descricao, ncm, cest, cfop, unidade,
        quantidade, valor_unitario, valor_total, valor_desconto, valor_frete, cst_icms, csosn, valor_bc_icms,
        aliquota_icms, valor_icms, valor_bc_st, valor_st, cst_pis, valor_bc_pis, aliquota_pis, valor_pis,
        cst_cofins, valor_bc_cofins, aliquota_cofins, valor_cofins, cst_ibs_cbs, cclass_trib, valor_bc_ibs_cbs,
        aliquota_ibs_uf, valor_ibs_uf, aliquota_ibs_mun, valor_ibs_mun, valor_ibs, aliquota_cbs, valor_cbs,
        valor_ipi, classificacao, situacao_classificacao, natureza_receita_simples, tipo_movimento, impacto_receita,
        anexo_sugerido, regra_aplicada, classificacao_manual
      )
      select
        p_org_id, p_empresa_id, v_doc_id, x.item_numero, x.codigo_produto, x.descricao, x.ncm, x.cest, x.cfop,
        x.unidade, coalesce(x.quantidade,0), coalesce(x.valor_unitario,0), coalesce(x.valor_total,0),
        coalesce(x.valor_desconto,0), coalesce(x.valor_frete,0), x.cst_icms, x.csosn, coalesce(x.valor_bc_icms,0),
        coalesce(x.aliquota_icms,0), coalesce(x.valor_icms,0), coalesce(x.valor_bc_st,0), coalesce(x.valor_st,0),
        x.cst_pis, coalesce(x.valor_bc_pis,0), coalesce(x.aliquota_pis,0), coalesce(x.valor_pis,0), x.cst_cofins,
        coalesce(x.valor_bc_cofins,0), coalesce(x.aliquota_cofins,0), coalesce(x.valor_cofins,0), x.cst_ibs_cbs,
        x.cclass_trib, coalesce(x.valor_bc_ibs_cbs,0), coalesce(x.aliquota_ibs_uf,0), coalesce(x.valor_ibs_uf,0),
        coalesce(x.aliquota_ibs_mun,0), coalesce(x.valor_ibs_mun,0), coalesce(x.valor_ibs,0), coalesce(x.aliquota_cbs,0),
        coalesce(x.valor_cbs,0), coalesce(x.valor_ipi,0), coalesce(x.classificacao,'outros'), x.situacao_classificacao,
        coalesce(x.natureza_receita_simples,'pendente'), coalesce(x.tipo_movimento,'outros'),
        coalesce(x.impacto_receita,'pendente_revisao'), x.anexo_sugerido, x.regra_aplicada,
        coalesce(x.classificacao_manual, false)
      from jsonb_populate_recordset(null::public.fa_documentos_itens, v_itens_json) as x;

      get diagnostics v_itens_count = row_count;
      v_itens_total := v_itens_total + v_itens_count;

      if p_sessao_id is not null then
        v_tipo_op := coalesce(
          v_doc_json->>'legado_tipo_operacao',
          case when v_rec.tipo_movimento in ('saida','devolucao_venda') then 'saida' else 'entrada' end
        );
        v_legado_parsed := v_doc_json->'legado_parsed_data';

        insert into public.fa_arquivos_xml (
          org_id, sessao_id, empresa_id, competencia, chave_nfe, numero_nf, data_emissao,
          emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome, tipo_operacao,
          valor_total, parsed_data, status
        )
        values (
          p_org_id, p_sessao_id, p_empresa_id, v_rec.data_competencia, v_rec.chave_acesso, v_rec.numero,
          v_rec.data_emissao, v_rec.emitente_cnpj, v_rec.emitente_nome, v_rec.destinatario_cnpj,
          v_rec.destinatario_nome, v_tipo_op, v_rec.valor_total, v_legado_parsed, 'ok'
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
      -- Reverte SOMENTE este documento (savepoint implícito do bloco) e segue o lote.
      v_resultados := v_resultados || jsonb_build_object(
        'documento_id', null,
        'chave_acesso', v_doc_json->>'chave_acesso',
        'numero', v_doc_json->>'numero',
        'status', 'erro',
        'motivo', sqlerrm
      );
    end;
  end loop;

  return jsonb_build_object('salvos', v_salvos, 'itens_salvos', v_itens_total, 'resultados', v_resultados);
end;
$$;

grant execute on function public.fa_importar_lote_nfe(uuid, uuid, uuid, jsonb) to authenticated;
