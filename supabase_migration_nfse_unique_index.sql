-- Migração: corrigir índice único de fa_documentos_fiscais para suportar upsert de NFS-e
--
-- PROBLEMA: o índice original era PARCIAL (WHERE chave_acesso IS NOT NULL).
-- O Supabase/PostgREST gera "ON CONFLICT (empresa_id, chave_acesso)" sem cláusula WHERE,
-- e o PostgreSQL só aceita isso com um índice único COMPLETO (não parcial).
-- Índices parciais exigem que o ON CONFLICT inclua o predicado exato do índice.
--
-- SOLUÇÃO: substituir pelo índice único completo. O comportamento em relação a NULLs é
-- idêntico — o PostgreSQL nunca considera NULL = NULL em unique indexes, então múltiplos
-- registros com chave_acesso = NULL são permitidos normalmente.
--
-- SEGURANÇA: idempotente (pode ser executado mais de uma vez sem efeito colateral).

-- 1. Remove o índice parcial antigo
drop index if exists public.idx_fa_docs_chave_empresa;

-- 2. Cria índice único completo (sem WHERE) sobre as mesmas colunas
create unique index if not exists idx_fa_docs_chave_empresa
  on public.fa_documentos_fiscais(empresa_id, chave_acesso);
