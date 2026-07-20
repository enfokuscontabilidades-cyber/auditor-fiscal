-- =======================================================================
-- MIGRAÇÃO — Confiabilidade da importação de NF-e (Auditor Fiscal /
-- Validador de Entradas / Simples Nacional)
-- Executar no Supabase Studio → SQL Editor
-- IDEMPOTENTE: pode ser executada múltiplas vezes sem erros.
--
-- Corrige três causas-raiz do comportamento intermitente na importação
-- de XML de NF-e:
--
-- 1) fa_arquivos_xml nunca teve restrição de unicidade — cada reimportação
--    do mesmo XML empilhava uma linha nova (POST /api/arquivos-xml sempre
--    fazia INSERT puro). Esta migração remove as duplicatas já existentes
--    (mantendo a linha mais recente por empresa+chave) e cria um índice
--    único parcial para impedir que o problema volte a acontecer.
--
-- 2) A gravação de uma NF-e sempre envolvia duas chamadas HTTP
--    independentes e não-transacionais (fa_documentos_fiscais/itens de um
--    lado, fa_arquivos_xml do outro) — permitindo que uma tivesse sucesso
--    e a outra falhasse silenciosamente, deixando o banco inconsistente
--    ("nota gravada mas não aparece", "concluiu sem erro mas nada
--    carregou"). Esta migração cria uma única função Postgres
--    (fa_importar_lote_nfe) que grava as três tabelas dentro da mesma
--    transação implícita da função: se qualquer etapa falhar, tudo sofre
--    rollback. Mesmo padrão já usado em rt_reservar_quota_xml
--    (supabase_migration_rt_quota_atomica.sql), aqui sem advisory lock
--    porque não há contagem de cota envolvida — só upsert idempotente por
--    chave de acesso.
--
-- 3) Não havia como o contador configurar, por empresa, quais CFOP contam
--    como faturamento na apuração do Simples Nacional (regra vinha 100%
--    hardcoded em lib/simples/cfopReceita.ts). Esta migração cria a tabela
--    de override, seguindo a mesma estrutura de
--    sn_config_servicos_atividade (supabase_migration_simples_servicos_atividade.sql).
-- =======================================================================

-- -----------------------------------------------------------------------
-- 0. LIMPEZA DE DUPLICATAS PRÉ-EXISTENTES EM fa_arquivos_xml
--
-- Necessário antes de criar o índice único: sem restrição de unicidade
-- desde sempre, é esperado que existam linhas duplicadas (mesma
-- empresa_id + chave_nfe) acumuladas por reimportações. Mantém apenas a
-- linha mais recente de cada duplicata (created_at mais novo); as demais
-- são removidas por serem, por definição, cópias redundantes da mesma
-- nota fiscal (mesma chave de acesso já identifica univocamente o
-- documento — não há perda de informação em consolidar).
-- -----------------------------------------------------------------------
with duplicatas as (
  select id,
         row_number() over (
           partition by empresa_id, chave_nfe
           order by created_at desc, id desc
         ) as rn
  from public.fa_arquivos_xml
  where chave_nfe is not null and chave_nfe <> ''
)
delete from public.fa_arquivos_xml
where id in (select id from duplicatas where rn > 1);

-- Normaliza formato de competência existente (alguns registros antigos
-- podem ter sido gravados como "YYYY-MM" em vez do padrão "MM/YYYY").
update public.fa_arquivos_xml
set competencia = substring(competencia from 6 for 2) || '/' || substring(competencia from 1 for 4)
where competencia ~ '^\d{4}-\d{2}$';

-- -----------------------------------------------------------------------
-- 1. ÍNDICE ÚNICO PARCIAL — impede duplicidade de chave_nfe por empresa
--    (documentos sem chave_nfe preenchida não são cobertos: não há chave
--    natural para deduplicar um XML sem chave de acesso extraível).
-- -----------------------------------------------------------------------
create unique index if not exists idx_fa_xml_empresa_chave_uniq
  on public.fa_arquivos_xml(empresa_id, chave_nfe)
  where chave_nfe is not null and chave_nfe <> '';

-- -----------------------------------------------------------------------
-- 2. FA_IMPORTAR_LOTE_NFE — gravação atômica de um lote de NF-e
--
-- Recebe um array jsonb de documentos (cada um já no formato de
-- fa_documentos_fiscais, mais um array "itens" no formato de
-- fa_documentos_itens, mais opcionalmente "legado_tipo_operacao" e
-- "legado_parsed_data" para espelhar em fa_arquivos_xml). Para cada
-- documento, dentro da mesma transação da função:
--   a) upsert em fa_documentos_fiscais (on conflict empresa_id+chave_acesso)
--   b) substitui os itens em fa_documentos_itens (delete + insert)
--   c) upsert em fa_arquivos_xml (on conflict empresa_id+chave_nfe),
--      só quando p_sessao_id não for nulo (coluna sessao_id é not null)
--
-- Documentos sem chave_acesso NEM numero são rejeitados individualmente
-- (não há identificador para persistir/deduplicar com segurança) — não
-- interrompem o processamento dos demais documentos do lote.
--
-- SECURITY INVOKER (padrão): roda com o papel do usuário chamador, então
-- as RLS policies já existentes (is_member_of / auth.role()='authenticated')
-- continuam sendo a barreira real — a função não contorna RLS.
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
      valor_ipi, classificacao, natureza_receita_simples, tipo_movimento, impacto_receita, anexo_sugerido,
      regra_aplicada, classificacao_manual
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
      coalesce(x.valor_cbs,0), coalesce(x.valor_ipi,0), coalesce(x.classificacao,'outros'),
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
  end loop;

  return jsonb_build_object('salvos', v_salvos, 'itens_salvos', v_itens_total, 'resultados', v_resultados);
end;
$$;

grant execute on function public.fa_importar_lote_nfe(uuid, uuid, uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------
-- 3. FA_CFOP_FATURAMENTO_CONFIG — override por empresa do CFOP considerado
--    faturamento na apuração do Simples Nacional. Mesma estrutura de
--    sn_config_servicos_atividade. Ausência de linha para um CFOP =
--    usa o padrão do sistema (lib/simples/cfopReceita.ts).
-- -----------------------------------------------------------------------
create table if not exists public.fa_cfop_faturamento_config (
  id                     uuid default gen_random_uuid() primary key,
  org_id                 uuid references public.organizacoes(id) on delete cascade not null,
  empresa_id             uuid references public.empresas(id) on delete cascade not null,
  cfop                   text not null,
  descricao              text,
  considerar_faturamento boolean not null default true,
  origem                 text not null default 'usuario'
                           check (origem in ('padrao','usuario')),
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  unique(empresa_id, cfop)
);

create index if not exists idx_fa_cfop_cfg_org      on public.fa_cfop_faturamento_config(org_id);
create index if not exists idx_fa_cfop_cfg_empresa  on public.fa_cfop_faturamento_config(empresa_id);

alter table public.fa_cfop_faturamento_config enable row level security;

drop policy if exists "fa_cfop_cfg_select" on public.fa_cfop_faturamento_config;
drop policy if exists "fa_cfop_cfg_insert" on public.fa_cfop_faturamento_config;
drop policy if exists "fa_cfop_cfg_update" on public.fa_cfop_faturamento_config;
drop policy if exists "fa_cfop_cfg_delete" on public.fa_cfop_faturamento_config;

create policy "fa_cfop_cfg_select" on public.fa_cfop_faturamento_config
  for select using (public.is_member_of(org_id));
create policy "fa_cfop_cfg_insert" on public.fa_cfop_faturamento_config
  for insert with check (auth.role() = 'authenticated');
create policy "fa_cfop_cfg_update" on public.fa_cfop_faturamento_config
  for update using (public.is_member_of(org_id));
create policy "fa_cfop_cfg_delete" on public.fa_cfop_faturamento_config
  for delete using (public.is_member_of(org_id));
