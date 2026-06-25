-- =============================================================================
-- CONSULTAS DE VERIFICAÇÃO — BANCO DE HOMOLOGAÇÃO
-- Execute no SQL Editor do Supabase após aplicar todos os scripts.
-- Todas as queries são somente leitura (SELECT).
-- =============================================================================

-- 1. Tabelas criadas
-- Esperado: lista de tabelas do sistema (mínimo 15)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. RLS habilitado em tabelas críticas
-- Esperado: rowsecurity = true em TODAS as linhas
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizacoes',
    'membros_organizacao',
    'convites_organizacao',
    'empresas',
    'fa_sessoes_analise',
    'fa_arquivos_xml',
    'fa_arquivos_sped',
    'fa_documentos_fiscais',
    'fa_documentos_itens',
    'fa_alertas',
    'fa_regras_fiscais',
    'sn_declaracoes',
    'sn_receitas_mensais',
    'sn_apuracoes',
    'sn_apuracoes_receitas',
    'cnpj_cache'
  )
ORDER BY tablename;

-- 3. Funções RLS
-- Esperado: exatamente 2 linhas (is_member_of e is_admin_of)
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_member_of', 'is_admin_of')
ORDER BY routine_name;

-- 4. Todas as policies RLS
-- Esperado: policies para cada tabela com RLS habilitado
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 5. Policies de membros_organizacao
-- Esperado: policies cobrindo SELECT, INSERT, DELETE com restrição is_admin_of
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'membros_organizacao'
ORDER BY policyname;

-- 6. Policies de convites_organizacao
-- Esperado: policies cobrindo SELECT, INSERT, DELETE com restrição is_admin_of
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'convites_organizacao'
ORDER BY policyname;

-- 7. Proteção de fa_regras_fiscais
-- Esperado: policy de SELECT existe, mas NÃO deve haver policy de INSERT/UPDATE/DELETE
-- para usuários comuns (apenas service_role pode modificar)
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'fa_regras_fiscais'
ORDER BY policyname;

-- 8. Policies de INSERT das tabelas fiscais (verificar restrição de org_id)
-- Esperado: todas as tabelas fiscais com política de INSERT que valida is_member_of
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'fa_sessoes_analise',
    'fa_arquivos_xml',
    'fa_arquivos_sped',
    'fa_documentos_fiscais',
    'fa_alertas',
    'sn_declaracoes',
    'sn_receitas_mensais'
  )
  AND cmd = 'INSERT'
ORDER BY tablename, policyname;

-- 9. Verificar colunas de org_id nas tabelas críticas
-- Esperado: coluna org_id do tipo uuid em todas as tabelas listadas
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'org_id'
  AND table_name IN (
    'empresas',
    'fa_sessoes_analise',
    'fa_arquivos_xml',
    'fa_arquivos_sped',
    'fa_documentos_fiscais',
    'fa_alertas',
    'sn_declaracoes',
    'sn_receitas_mensais',
    'sn_apuracoes'
  )
ORDER BY table_name;

-- 10. Verificar se alguma tabela crítica está sem org_id (não deve aparecer nenhuma)
-- Esperado: resultado VAZIO (nenhuma tabela crítica sem org_id)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'empresas',
    'fa_sessoes_analise',
    'fa_arquivos_xml',
    'fa_arquivos_sped',
    'fa_documentos_fiscais',
    'fa_alertas',
    'sn_declaracoes'
  )
  AND table_name NOT IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'org_id'
  );

-- 11. Contar policies por tabela (resumo)
SELECT tablename, COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
