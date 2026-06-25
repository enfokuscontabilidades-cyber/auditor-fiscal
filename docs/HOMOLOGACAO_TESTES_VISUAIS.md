# Testes Visuais de Homologação — Guia Passo a Passo

## Antes de Começar

- Você precisa de acesso ao sistema rodando na Preview URL da Vercel
- A faixa laranja deve estar visível no topo (se não estiver, você está em produção — pare aqui)
- Tenha em mãos os quatro usuários fictícios criados no banco de homologação:
  - `admin_a@homologacao.test` / `Teste@1234`
  - `membro_a@homologacao.test` / `Teste@1234`
  - `admin_b@homologacao.test` / `Teste@1234`
  - `membro_b@homologacao.test` / `Teste@1234`

---

## PASSO 1 — Criar Admin A e Organização A

1. Acesse a Preview URL
2. Clique em **Criar conta** e cadastre `admin_a@homologacao.test`
3. Após o cadastro, na tela de onboarding, selecione **Criar novo escritório**
4. Nome: `Escritório Alfa Homologação` → clique em Criar
5. Você deve ser redirecionado para o Dashboard
6. **Verificação:** o nome do escritório aparece no topo da sidebar

---

## PASSO 2 — Criar Admin B e Organização B

1. **Abra uma aba anônima** no navegador (importante: não confundir sessões)
2. Acesse a mesma Preview URL
3. Cadastre `admin_b@homologacao.test`
4. Na tela de onboarding, crie **Escritório Beta Homologação**
5. **Verificação:** Admin B está no Dashboard com o nome correto do escritório

---

## PASSO 3 — Criar Membro A e Vinculá-lo à Organização A

1. Na aba do Admin A, vá em **Configurações > Membros**
2. Clique em **Convidar membro** e insira `membro_a@homologacao.test`
3. Abra uma nova aba anônima e acesse a Preview URL
4. Cadastre `membro_a@homologacao.test`
5. Na tela de onboarding, selecione **Já tenho um convite** e aceite o convite
6. **Verificação:** Membro A está no Dashboard com o nome "Escritório Alfa Homologação"

---

## PASSO 4 — Criar Membro B e Vinculá-lo à Organização B

1. Na aba do Admin B, vá em **Configurações > Membros**
2. Convide `membro_b@homologacao.test`
3. Crie uma nova aba anônima, cadastre `membro_b@homologacao.test` e aceite o convite
4. **Verificação:** Membro B está no Dashboard com o nome "Escritório Beta Homologação"

---

## PASSO 5 — Criar Empresa Teste A e Empresa Teste B

### Empresa A (como Admin A):
1. Na aba do Admin A, vá em **Empresas > Cadastrar empresa**
2. Preencha com dados fictícios:
   - CNPJ: `11.111.111/0001-11` (CNPJ inválido — para teste apenas)
   - Razão social: `Empresa Alfa Homologação LTDA`
3. **Verificação:** empresa aparece na lista de empresas do Admin A

### Empresa B (como Admin B):
1. Na aba do Admin B, vá em **Empresas > Cadastrar empresa**
2. CNPJ: `22.222.222/0001-22`, Razão: `Empresa Beta Homologação LTDA`
3. **Verificação:** empresa aparece na lista do Admin B

---

## PASSO 6 — Cadastrar Dados Fictícios

Na aba do Admin A, crie uma sessão de análise para a Empresa A:
1. Vá em **Auditor Fiscal** ou **Empresas**
2. Selecione a Empresa A e crie uma sessão para competência `01/2025`
3. (Opcional) Importe um XML de NF-e fictício se tiver um disponível
4. **Anote os IDs:** você precisará dos UUIDs da Empresa A e da Sessão A para os testes automatizados

Repita para o Admin B com a Empresa B e a Sessão B.

---

## PASSO 7 — Confirmar Isolamento (Admin A não vê dados da Org B)

### Teste 7.1 — Empresas
1. Ainda logado como Admin A
2. Vá em **Empresas**
3. **Esperado:** apenas "Empresa Alfa Homologação LTDA" aparece
4. "Empresa Beta Homologação LTDA" **NÃO deve aparecer**
5. **Registre:** [ ] PASSOU  [ ] FALHOU

### Teste 7.2 — Membros
1. Vá em **Configurações > Membros**
2. **Esperado:** apenas `admin_a` e `membro_a` aparecem
3. `admin_b` e `membro_b` **NÃO devem aparecer**
4. **Registre:** [ ] PASSOU  [ ] FALHOU

---

## PASSO 8 — Confirmar que Membro A Não Gerencia Membros

1. Abra a aba do Membro A (cadastrado no Passo 3)
2. Vá em **Configurações > Membros**
3. **Esperado:** botões de "Convidar membro" e "Excluir" **NÃO devem aparecer** para Membro A
4. Se os botões aparecerem mas retornarem erro, ainda é aceitável (defesa em camadas)
5. **Registre:** [ ] PASSOU  [ ] FALHOU

---

## PASSO 9 — Confirmar que Admin A Gerencia Membros da Própria Org

1. Na aba do Admin A, vá em **Configurações > Membros**
2. Tente convidar um novo endereço fictício: `novo_teste@homologacao.test`
3. **Esperado:** convite enviado com sucesso (ou erro de "e-mail não cadastrado", que é aceitável)
4. Tente remover o `membro_a` (clique em Excluir)
5. **Esperado:** remoção bem-sucedida
6. **Registre:** [ ] PASSOU  [ ] FALHOU

---

## PASSO 10 — Confirmar que Importações Funcionam na Org A

1. Como Admin A, acesse **Validador de Entradas** ou **Auditor Fiscal**
2. Tente importar um arquivo XML de NF-e fictício (pode ser qualquer XML pequeno)
3. **Esperado:** importação bem-sucedida, arquivo aparece na lista
4. Se não tiver arquivo XML, pule para o próximo passo
5. **Registre:** [ ] PASSOU  [ ] FALHOU  [ ] PULADO (sem arquivo)

---

## PASSO 11 — Confirmar Limpeza de Competência Funciona Apenas na Org A

1. Como Admin A, acesse os dados da Empresa A
2. Use a opção de **Limpar competência** para `01/2025`
3. **Esperado:** competência limpa com sucesso
4. Tente forçar (via URL ou Postman) a limpeza com o ID da Empresa B usando o token do Admin A
5. **Esperado:** erro 403 (Proibido)
6. **Registre:** [ ] PASSOU  [ ] FALHOU

---

## PASSO 12 — Registrar Resultados

Preencha o arquivo `HOMOLOGACAO_RESULTADOS_MODELO.md` com os resultados de cada teste.

---

## Anotações para os Testes Automatizados

Após completar os passos acima, colete:

| Dado | Onde encontrar | Valor |
|------|---------------|-------|
| UUID da Empresa A | Painel Supabase > Table Editor > `empresas` | |
| UUID da Empresa B | Idem | |
| UUID da Sessão A | Painel Supabase > `fa_sessoes_analise` | |
| UUID da Sessão B | Idem | |
| UUID do Membro A | Painel Supabase > `membros_organizacao` | |
| UUID do Membro B | Idem | |
| UUID da Org A | Painel Supabase > `organizacoes` | |
| UUID da Org B | Idem | |

Para obter os JWTs dos usuários (necessários para `.env.test`):
1. No Supabase > **Authentication > Users**
2. Clique no usuário desejado
3. Copie o **Access Token**
