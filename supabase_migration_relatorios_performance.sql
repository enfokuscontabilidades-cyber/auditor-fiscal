-- ============================================================================
-- MIGRACAO: Performance de relatorios fiscais em alto volume
-- Idempotente: pode ser executada varias vezes.
--
-- Objetivo:
--   Acelerar consultas por empresa + competencia + tipo/status e joins de itens.
--   Especialmente util para empresas varejistas com centenas/milhares de XMLs por mes.
-- ============================================================================

create index if not exists idx_fa_docs_empresa_comp_status_tipo
  on public.fa_documentos_fiscais(empresa_id, data_competencia, status, tipo_movimento);

create index if not exists idx_fa_docs_empresa_comp_impacto
  on public.fa_documentos_fiscais(empresa_id, data_competencia, impacto_receita);

create index if not exists idx_fa_itens_empresa_documento_cfop
  on public.fa_documentos_itens(empresa_id, documento_id, cfop);

create index if not exists idx_fa_itens_empresa_documento_ncm
  on public.fa_documentos_itens(empresa_id, documento_id, ncm);

create index if not exists idx_fa_xml_empresa_comp_tipo_status
  on public.fa_arquivos_xml(empresa_id, competencia, tipo_operacao, status);

create index if not exists idx_fa_xml_empresa_data_tipo_status
  on public.fa_arquivos_xml(empresa_id, data_emissao, tipo_operacao, status);
