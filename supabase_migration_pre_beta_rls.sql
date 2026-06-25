-- ============================================================================
-- MIGRAÇÃO PRÉ-BETA: Fortalecimento do RLS — Isolamento Multi-tenant
-- Arquivo: supabase_migration_pre_beta_rls.sql
-- Idempotente: pode ser executado múltiplas vezes sem erros.
--
-- COMO APLICAR:
--   1. Abra o Supabase Studio do projeto sistema-controle
--   2. Vá em SQL Editor
--   3. Cole o conteúdo completo deste arquivo
--   4. Clique em "Run"
--   5. Verifique que todas as linhas terminaram com "Success"
--
-- IMPACTO ESPERADO:
--   - Nenhum fluxo legítimo é quebrado (todos usam createAdminClient que bypassa RLS)
--   - Chamadas diretas ao Supabase REST com anon key + JWT passam a ser bloqueadas
--     quando o usuário tenta criar dados em org alheia
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. FUNÇÃO AUXILIAR: is_admin_of(p_org_id UUID)
-- ─────────────────────────────────────────────────────────────────────────────
-- Verifica se o usuário autenticado é administrador da org informada.
-- SECURITY DEFINER segue o mesmo padrão de is_member_of() para evitar recursão.
-- Usada nas policies de membros e convites, onde apenas admins podem operar.

CREATE OR REPLACE FUNCTION public.is_admin_of(p_org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros_organizacao
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND papel = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MEMBROS_ORGANIZACAO — corrigir INSERT e DELETE
-- ─────────────────────────────────────────────────────────────────────────────
-- Antes: INSERT e DELETE com apenas auth.role() = 'authenticated'
--   → qualquer autenticado podia deletar membro de qualquer org via REST direto
--   → qualquer autenticado podia inserir-se em org alheia via REST direto
--
-- Depois: INSERT restrito a admin da org; DELETE restrito a admin da org
--
-- Por que não quebra fluxos legítimos:
--   - POST /api/organizacoes usa createAdminClient() → service_role bypassa RLS → OK
--   - POST /api/convites (aceite) usa createAdminClient() → bypassa RLS → OK
--   - POST /api/membros (adicionar membro existente) usa createAdminClient() → bypassa RLS → OK
--   - DELETE /api/membros usa supabase (user client), mas o usuário é admin → passes is_admin_of → OK

DROP POLICY IF EXISTS "membros_insert" ON public.membros_organizacao;
DROP POLICY IF EXISTS "membros_delete" ON public.membros_organizacao;

CREATE POLICY "membros_insert" ON public.membros_organizacao
  FOR INSERT WITH CHECK (public.is_admin_of(org_id));

CREATE POLICY "membros_delete" ON public.membros_organizacao
  FOR DELETE USING (public.is_admin_of(org_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CONVITES_ORGANIZACAO — corrigir INSERT, DELETE e adicionar SELECT
-- ─────────────────────────────────────────────────────────────────────────────
-- Antes: INSERT com auth.role() = 'authenticated'; sem SELECT; DELETE is_member_of
--   → qualquer autenticado criava convite em org alheia via REST
--
-- Depois: INSERT e DELETE restritos a admin; SELECT para todos os membros da org
--
-- Por que não quebra fluxos legítimos:
--   - POST /api/membros (criar convite) usa createAdminClient() → bypassa RLS → OK
--   - GET /api/convites usa createAdminClient() para lookup por email → bypassa RLS → OK
--   - Aceite de convite via POST /api/convites usa createAdminClient() → bypassa RLS → OK

DROP POLICY IF EXISTS "convite_insert" ON public.convites_organizacao;
DROP POLICY IF EXISTS "convite_delete" ON public.convites_organizacao;
DROP POLICY IF EXISTS "convite_select" ON public.convites_organizacao;

CREATE POLICY "convite_select" ON public.convites_organizacao
  FOR SELECT USING (public.is_member_of(org_id));

CREATE POLICY "convite_insert" ON public.convites_organizacao
  FOR INSERT WITH CHECK (public.is_admin_of(org_id));

CREATE POLICY "convite_delete" ON public.convites_organizacao
  FOR DELETE USING (public.is_admin_of(org_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FA_REGRAS_FISCAIS — remover policy ALL, manter somente SELECT
-- ─────────────────────────────────────────────────────────────────────────────
-- Antes: policy "regras_all" permitia INSERT/UPDATE/DELETE para qualquer autenticado
--   → qualquer usuário podia adicionar regras falsas ou desativar regras existentes
--
-- Depois: somente SELECT; escrita apenas via service_role (admin)
--
-- Alterações no catálogo de regras devem ocorrer exclusivamente via operação
-- administrativa controlada (seed SQL ou API com createAdminClient).

DROP POLICY IF EXISTS "regras_all" ON public.fa_regras_fiscais;
DROP POLICY IF EXISTS "regras_select" ON public.fa_regras_fiscais;

CREATE POLICY "regras_select" ON public.fa_regras_fiscais
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABELAS COM org_id — FORTALECER INSERT (supabase_setup.sql)
-- ─────────────────────────────────────────────────────────────────────────────
-- Para cada tabela: trocar auth.role()='authenticated' por is_member_of(org_id).
-- Isso garante que o org_id no INSERT corresponde a uma org da qual o usuário
-- é membro — bloqueando injeção cross-org mesmo via Supabase REST direto.
-- As APIs Next.js já setam org_id via getOrgId() server-side; esta policy
-- adiciona a mesma verificação na camada do banco como segunda barreira.

-- 4.1 empresas
DROP POLICY IF EXISTS "empresas_insert" ON public.empresas;
CREATE POLICY "empresas_insert" ON public.empresas
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 4.2 fa_sessoes_analise
DROP POLICY IF EXISTS "sessoes_insert" ON public.fa_sessoes_analise;
CREATE POLICY "sessoes_insert" ON public.fa_sessoes_analise
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 4.3 fa_arquivos_sped
DROP POLICY IF EXISTS "sped_insert" ON public.fa_arquivos_sped;
CREATE POLICY "sped_insert" ON public.fa_arquivos_sped
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 4.4 fa_arquivos_xml
DROP POLICY IF EXISTS "xml_insert" ON public.fa_arquivos_xml;
CREATE POLICY "xml_insert" ON public.fa_arquivos_xml
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 4.5 fa_apuracoes_icms
DROP POLICY IF EXISTS "icms_insert" ON public.fa_apuracoes_icms;
CREATE POLICY "icms_insert" ON public.fa_apuracoes_icms
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 4.6 fa_apuracoes_contrib
DROP POLICY IF EXISTS "contrib_insert" ON public.fa_apuracoes_contrib;
CREATE POLICY "contrib_insert" ON public.fa_apuracoes_contrib
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 4.7 fa_alertas
DROP POLICY IF EXISTS "alertas_insert" ON public.fa_alertas;
CREATE POLICY "alertas_insert" ON public.fa_alertas
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 4.8 fa_obrigacoes_acessorias
DROP POLICY IF EXISTS "obrigacoes_insert" ON public.fa_obrigacoes_acessorias;
CREATE POLICY "obrigacoes_insert" ON public.fa_obrigacoes_acessorias
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 4.9 fa_planejamento_tributario
DROP POLICY IF EXISTS "planejamento_insert" ON public.fa_planejamento_tributario;
CREATE POLICY "planejamento_insert" ON public.fa_planejamento_tributario
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 4.10 sn_declaracoes
DROP POLICY IF EXISTS "sn_insert" ON public.sn_declaracoes;
CREATE POLICY "sn_insert" ON public.sn_declaracoes
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 4.11 cobrancas
DROP POLICY IF EXISTS "cobrancas_insert" ON public.cobrancas;
CREATE POLICY "cobrancas_insert" ON public.cobrancas
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TABELAS CRIADAS NAS MIGRATIONS (supabase_migration_fase_a.sql)
-- ─────────────────────────────────────────────────────────────────────────────
-- As migrations já usavam DROP POLICY IF EXISTS antes de recriar,
-- portanto este padrão é idempotente mesmo que a fase_a já tenha rodado.

-- 5.1 fa_documentos_fiscais
DROP POLICY IF EXISTS "fa_docs_insert" ON public.fa_documentos_fiscais;
CREATE POLICY "fa_docs_insert" ON public.fa_documentos_fiscais
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 5.2 fa_documentos_itens
DROP POLICY IF EXISTS "fa_itens_insert" ON public.fa_documentos_itens;
CREATE POLICY "fa_itens_insert" ON public.fa_documentos_itens
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 5.3 sn_receitas_mensais
DROP POLICY IF EXISTS "sn_rec_insert" ON public.sn_receitas_mensais;
CREATE POLICY "sn_rec_insert" ON public.sn_receitas_mensais
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 5.4 sn_apuracoes
DROP POLICY IF EXISTS "sn_apur_insert" ON public.sn_apuracoes;
CREATE POLICY "sn_apur_insert" ON public.sn_apuracoes
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- 5.5 sn_apuracoes_receitas
DROP POLICY IF EXISTS "sn_apur_rec_insert" ON public.sn_apuracoes_receitas;
CREATE POLICY "sn_apur_rec_insert" ON public.sn_apuracoes_receitas
  FOR INSERT WITH CHECK (public.is_member_of(org_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. cnpj_cache — sem org_id, compartilhada entre orgs
-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT ocorre via createAdminClient() em /api/cnpj-cache → service_role bypassa RLS.
-- A table não contém dados sensíveis por organização. Sem alteração necessária.

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. VERIFICAÇÃO PÓS-EXECUÇÃO (opcional — consulta informativa)
-- ─────────────────────────────────────────────────────────────────────────────
-- Para confirmar que as policies foram criadas corretamente, execute após a migration:
--
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
--
-- Verifique que:
--   - Todas as tabelas de dados têm INSERT with_check contendo 'is_member_of'
--   - membros_organizacao tem INSERT e DELETE com 'is_admin_of'
--   - fa_regras_fiscais NÃO tem policy de INSERT/UPDATE/DELETE
-- ============================================================================
