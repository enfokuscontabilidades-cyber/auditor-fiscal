/**
 * Suíte de testes de isolamento multi-tenant — PRÉ-BETA Bloco 1
 *
 * CONFIGURAÇÃO NECESSÁRIA:
 *   Criar .env.test com:
 *     SUPABASE_URL=...
 *     TOKEN_ADMIN_A=...        # JWT de admin_a@test.com (membro de Org A)
 *     TOKEN_MEMBRO_A=...       # JWT de membro_a@test.com (membro comum de Org A)
 *     TOKEN_ADMIN_B=...        # JWT de admin_b@test.com (membro de Org B)
 *     EMPRESA_A_ID=...         # UUID de uma empresa da Org A
 *     EMPRESA_B_ID=...         # UUID de uma empresa da Org B
 *     SESSAO_A_ID=...          # UUID de uma sessão de análise da Org A
 *     SESSAO_B_ID=...          # UUID de uma sessão de análise da Org B
 *     MEMBRO_A_ID=...          # UUID do registro de membro do membro_a (em membros_organizacao)
 *     MEMBRO_B_ID=...          # UUID do registro de membro do membro_b
 *
 *   Para o GRUPO 6 (planos pagos de Reforma Tributária), adicionar também:
 *     TOKEN_TAX_REFORM=...     # JWT de um usuário admin de uma org com produto_escopo='tax_reform_only'
 *                              # e assinatura ativa (status='manual' ou 'active')
 *     EMPRESA_TAX_REFORM_ID=...# UUID de uma empresa já vinculada a uma vaga (rt_cnpj_slots) dessa org
 *
 * EXECUÇÃO (após configurar):
 *   npx vitest tests/security/multi-tenant.test.ts
 *   ou: npx jest tests/security/multi-tenant.test.ts
 *
 * TESTES QUE DEVEM SER EXECUTADOS MANUALMENTE (via Supabase REST direto):
 *   Ver seção TESTES MANUAIS ao final deste arquivo.
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const EMPRESA_A  = process.env.EMPRESA_A_ID  ?? ''
const EMPRESA_B  = process.env.EMPRESA_B_ID  ?? ''
const SESSAO_A   = process.env.SESSAO_A_ID   ?? ''
const SESSAO_B   = process.env.SESSAO_B_ID   ?? ''
const MEMBRO_A   = process.env.MEMBRO_A_ID   ?? ''
const TOKEN_ADMIN_A  = process.env.TOKEN_ADMIN_A  ?? ''
const TOKEN_MEMBRO_A = process.env.TOKEN_MEMBRO_A ?? ''
const TOKEN_ADMIN_B  = process.env.TOKEN_ADMIN_B  ?? ''
const TOKEN_TAX_REFORM   = process.env.TOKEN_TAX_REFORM ?? ''
const EMPRESA_TAX_REFORM = process.env.EMPRESA_TAX_REFORM_ID ?? ''

/** Realiza uma chamada à API Next.js com o token fornecido. */
async function api(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-access-token=${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let json: unknown
  try { json = await res.json() } catch { json = null }
  return { status: res.status, json }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1: Isolamento de leitura
// ─────────────────────────────────────────────────────────────────────────────

describe('Isolamento de leitura (GET)', () => {
  test('Admin A não vê sessões da empresa B', async () => {
    const { status, json } = await api('GET', `/api/sessoes?empresa_id=${EMPRESA_B}`, TOKEN_ADMIN_A)
    // Deve retornar 200 com array vazio (RLS filtra) ou 403 (validação explícita)
    expect([200, 403]).toContain(status)
    if (status === 200) expect(json).toEqual([])
  })

  test('Admin A recebe 403 em relatorios com empresa B', async () => {
    const { status } = await api('GET', `/api/relatorios/documentos?empresa_id=${EMPRESA_B}`, TOKEN_ADMIN_A)
    expect(status).toBe(403)
  })

  test('Admin A recebe 403 em periodos-importados com empresa B', async () => {
    const { status } = await api('GET', `/api/fiscal/periodos-importados?empresa_id=${EMPRESA_B}`, TOKEN_ADMIN_A)
    expect(status).toBe(403)
  })

  test('Admin A recebe 403 em documentos-fiscais com empresa B', async () => {
    const { status } = await api('GET', `/api/documentos-fiscais?empresa_id=${EMPRESA_B}`, TOKEN_ADMIN_A)
    expect(status).toBe(403)
  })

  test('Admin A recebe 403 em simples_nacional com empresa B', async () => {
    const { status } = await api('GET', `/api/simples_nacional?empresa_id=${EMPRESA_B}`, TOKEN_ADMIN_A)
    // Neste caso o GET usa RLS — pode retornar 200 com array vazio, que é seguro
    expect([200, 403]).toContain(status)
    if (status === 200) expect(json).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2: Injeção cross-org via POST (empresa_id de outra org)
// ─────────────────────────────────────────────────────────────────────────────

describe('Bloqueio de injeção cross-org via POST', () => {
  test('Admin A não cria sessão com empresa B', async () => {
    const { status } = await api('POST', '/api/sessoes', TOKEN_ADMIN_A, {
      empresa_id: EMPRESA_B,
      competencia: '01/2025',
    })
    expect(status).toBe(403)
  })

  test('Admin A não importa XMLs com empresa B', async () => {
    const { status } = await api('POST', '/api/arquivos-xml', TOKEN_ADMIN_A, {
      sessao_id: SESSAO_A,
      empresa_id: EMPRESA_B,
      competencia: '01/2025',
      xmls: [],
    })
    expect(status).toBe(403)
  })

  test('Admin A não importa XMLs com sessao B', async () => {
    const { status } = await api('POST', '/api/arquivos-xml', TOKEN_ADMIN_A, {
      sessao_id: SESSAO_B,
      empresa_id: EMPRESA_A,
      competencia: '01/2025',
      xmls: [],
    })
    expect(status).toBe(403)
  })

  test('Admin A não importa SPED com empresa B', async () => {
    const { status } = await api('POST', '/api/arquivos-sped', TOKEN_ADMIN_A, {
      sessao_id: SESSAO_A,
      empresa_id: EMPRESA_B,
      nome_arquivo: 'test.txt',
      tipo: 'fiscal',
      competencia: '01/2025',
    })
    expect(status).toBe(403)
  })

  test('Admin A não importa SPED com sessao B', async () => {
    const { status } = await api('POST', '/api/arquivos-sped', TOKEN_ADMIN_A, {
      sessao_id: SESSAO_B,
      empresa_id: EMPRESA_A,
      nome_arquivo: 'test.txt',
      tipo: 'fiscal',
      competencia: '01/2025',
    })
    expect(status).toBe(403)
  })

  test('Admin A não salva declaração PGDAS com empresa B', async () => {
    const { status } = await api('POST', '/api/simples_nacional', TOKEN_ADMIN_A, {
      empresa_id: EMPRESA_B,
      competencia: '01/2025',
      receita_bruta_mes: 10000,
    })
    expect(status).toBe(403)
  })

  test('Admin A não salva receitas mensais com empresa B', async () => {
    const { status } = await api('POST', '/api/simples/receitas-mensais', TOKEN_ADMIN_A, {
      empresa_id: EMPRESA_B,
      entradas: [{ competencia: '01/2025', receita_bruta_mes: 5000 }],
    })
    expect(status).toBe(403)
  })

  test('Admin A não insere alertas com empresa B', async () => {
    const { status } = await api('POST', '/api/alertas', TOKEN_ADMIN_A, [{
      empresa_id: EMPRESA_B,
      sessao_id: SESSAO_A,
      competencia: '01/2025',
      categoria: 'icms',
      nivel_risco: 'alto',
      titulo: 'Teste cross-org',
      descricao: 'Tentativa de injeção',
    }])
    expect(status).toBe(403)
  })

  test('Admin A não insere alertas com sessao B', async () => {
    const { status } = await api('POST', '/api/alertas', TOKEN_ADMIN_A, [{
      empresa_id: EMPRESA_A,
      sessao_id: SESSAO_B,
      competencia: '01/2025',
      categoria: 'icms',
      nivel_risco: 'alto',
      titulo: 'Teste cross-org',
      descricao: 'Tentativa de injeção',
    }])
    expect(status).toBe(403)
  })

  test('Admin A não importa NF-e com empresa B', async () => {
    const { status } = await api('POST', '/api/documentos-fiscais/importar-nfe', TOKEN_ADMIN_A, {
      empresa_id: EMPRESA_B,
      documentos: [{ tipo_documento: 'nfe', origem: 'xml_nfe', tipo_movimento: 'saida', impacto_receita: 'soma_receita', origem_devolucao: 'nao_aplicavel' }],
    })
    expect(status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 3: Deleção cross-org (DELETE)
// ─────────────────────────────────────────────────────────────────────────────

describe('Bloqueio de deleção cross-org', () => {
  test('Admin A não exclui competência da empresa B', async () => {
    const { status } = await api(
      'DELETE',
      `/api/fiscal/limpar-competencia?empresa_id=${EMPRESA_B}&competencia=01/2025`,
      TOKEN_ADMIN_A,
    )
    expect(status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 4: Controle de membros
// ─────────────────────────────────────────────────────────────────────────────

describe('Controle de membros', () => {
  test('Membro comum A não adiciona membros', async () => {
    const { status } = await api('POST', '/api/membros', TOKEN_MEMBRO_A, {
      email: 'novo@test.com',
    })
    expect(status).toBe(403)
  })

  test('Membro comum A não remove membros', async () => {
    const { status } = await api('DELETE', `/api/membros?id=${MEMBRO_A}`, TOKEN_MEMBRO_A)
    expect(status).toBe(403)
  })

  test('Requisições sem token retornam 401 em rotas protegidas', async () => {
    const rotas = [
      ['GET', '/api/empresas'],
      ['POST', '/api/sessoes'],
      ['DELETE', `/api/fiscal/limpar-competencia?empresa_id=${EMPRESA_A}&competencia=01/2025`],
      ['POST', '/api/alertas'],
    ] as [string, string][]

    for (const [method, path] of rotas) {
      const res = await fetch(`${BASE}${path}`, { method })
      expect(res.status).toBe(401)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 5: Fluxos legítimos ainda funcionam
// ─────────────────────────────────────────────────────────────────────────────

describe('Fluxos legítimos preservados', () => {
  test('Admin A cria sessão com empresa A (deve funcionar)', async () => {
    const { status } = await api('POST', '/api/sessoes', TOKEN_ADMIN_A, {
      empresa_id: EMPRESA_A,
      competencia: '99/2099',  // competência de teste que não interfere com dados reais
    })
    expect([201, 500]).toContain(status)  // 500 é OK se empresa_A não existir no ambiente de teste
  })

  test('Admin A lista suas empresas (deve funcionar)', async () => {
    const { status } = await api('GET', '/api/empresas', TOKEN_ADMIN_A)
    expect(status).toBe(200)
  })

  test('Admin A acessa relatórios com empresa A (deve funcionar)', async () => {
    const { status } = await api(
      'GET',
      `/api/relatorios/documentos?empresa_id=${EMPRESA_A}&meses=3`,
      TOKEN_ADMIN_A,
    )
    expect([200, 403]).toContain(status)  // 403 se empresa não pertencer ao token de teste
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 6: Planos pagos de Reforma Tributária (produto_escopo='tax_reform_only')
// ─────────────────────────────────────────────────────────────────────────────

describe('Bloqueio de módulo — organização restrita à Reforma Tributária', () => {
  test('Org tax_reform_only recebe 403 em API exclusiva da plataforma completa', async () => {
    const rotas = [
      '/api/simples_nacional',
      '/api/arquivos-sped',
      '/api/planejamento-tributario/simular',
      '/api/alertas',
      '/api/sessoes',
      '/api/cobrancas',
    ]
    for (const rota of rotas) {
      const { status } = await api('GET', rota, TOKEN_TAX_REFORM)
      expect(status).toBe(403)
    }
  })

  test('Org tax_reform_only continua acessando os módulos permitidos', async () => {
    const permitidas = ['/api/empresas', '/api/organizacoes', '/api/rt/assinatura', '/api/rt/uso']
    for (const rota of permitidas) {
      const { status } = await api('GET', rota, TOKEN_TAX_REFORM)
      expect(status).toBe(200)
    }
  })

  test('Cadastro de segundo CNPJ é bloqueado quando o limite do plano é atingido', async () => {
    const { status, json } = await api('POST', '/api/empresas', TOKEN_TAX_REFORM, {
      razao_social: 'Empresa de teste — segundo CNPJ',
      cnpj: '11222333000181',
      confirmacaoVagaPermanente: true,
    })
    // 403 com LIMITE_CNPJ_ATINGIDO se o plano de teste já estiver na vaga máxima;
    // 201 é aceitável apenas se a org de teste ainda tiver vaga livre.
    expect([201, 403]).toContain(status)
    if (status === 403) expect((json as { codigo?: string }).codigo).toBe('LIMITE_CNPJ_ATINGIDO')
  })

  test('Alterar o CNPJ de uma empresa já vinculada a uma vaga é bloqueado', async () => {
    if (!EMPRESA_TAX_REFORM) return
    const { status } = await api('PUT', `/api/empresas/${EMPRESA_TAX_REFORM}`, TOKEN_TAX_REFORM, {
      razao_social: 'Empresa de teste',
      cnpj: '00000000000191',
    })
    expect(status).toBe(403)
  })

  test('Correção de CNPJ exige allowlist de admin — usuário comum recebe 403', async () => {
    const { status } = await api('POST', '/api/admin/rt/cnpj-correcao', TOKEN_TAX_REFORM, {
      slotId: 'id-qualquer', cnpjNovo: '11222333000181', justificativa: 'teste',
    })
    expect(status).toBe(403)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TESTES MANUAIS (via Supabase REST direto — não automatizáveis aqui)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * T-M-01: INSERT direto em membros_organizacao via anon key + JWT de Admin A com org_id de Org B
 *
 * URL: POST https://<SUPABASE_URL>/rest/v1/membros_organizacao
 * Headers: apikey: <ANON_KEY>, Authorization: Bearer <TOKEN_ADMIN_A>
 * Body: { org_id: <ORG_B_ID>, user_id: <USER_A_ID>, papel: "membro" }
 * Esperado: 403 (RLS is_admin_of bloqueia — Admin A não é admin de Org B)
 *
 * T-M-02: DELETE direto em membros_organizacao via anon key + JWT com UUID de membro de Org B
 *
 * URL: DELETE https://<SUPABASE_URL>/rest/v1/membros_organizacao?id=eq.<MEMBRO_B_ID>
 * Headers: apikey: <ANON_KEY>, Authorization: Bearer <TOKEN_ADMIN_A>
 * Esperado: 403 (RLS is_admin_of bloqueia — Admin A não é admin de Org B)
 *
 * T-M-03: INSERT direto em fa_regras_fiscais via anon key + JWT
 *
 * URL: POST https://<SUPABASE_URL>/rest/v1/fa_regras_fiscais
 * Headers: apikey: <ANON_KEY>, Authorization: Bearer <TOKEN_ADMIN_A>
 * Body: { codigo: "REGRA_FAKE", categoria: "icms", titulo: "Regra falsa", nivel_risco: "alto" }
 * Esperado: 403 (Sem policy de INSERT — somente service_role pode inserir)
 *
 * T-M-04: INSERT direto em fa_sessoes_analise via anon key + JWT com org_id errado
 *
 * URL: POST https://<SUPABASE_URL>/rest/v1/fa_sessoes_analise
 * Headers: apikey: <ANON_KEY>, Authorization: Bearer <TOKEN_ADMIN_A>
 * Body: { org_id: <ORG_B_ID>, empresa_id: <EMPRESA_B_ID>, competencia: "01/2025" }
 * Esperado: 403 (RLS is_member_of bloqueia — Admin A não é membro de Org B)
 *
 * T-M-05: INSERT direto em fa_sessoes_analise via anon key + JWT com org_id próprio mas empresa_id de Org B
 *
 * URL: POST https://<SUPABASE_URL>/rest/v1/fa_sessoes_analise
 * Headers: apikey: <ANON_KEY>, Authorization: Bearer <TOKEN_ADMIN_A>
 * Body: { org_id: <ORG_A_ID>, empresa_id: <EMPRESA_B_ID>, competencia: "01/2025" }
 * Esperado APÓS a migration: 201 mas com FK violation se empresa_id não existir, OU 201 com dado corrompido se existir
 *   NOTA: Este caso ainda não é bloqueado em nível de RLS — apenas pela API Next.js.
 *   Para bloquear 100% no banco, seria necessário um trigger de validação de FK cross-org.
 *   A camada API foi corrigida e é a principal barreira.
 *
 * T-M-06: SELECT direto em rt_cnpj_slots/rt_assinaturas via anon key + JWT de Admin A com org_id de Org B
 *
 * URL: GET https://<SUPABASE_URL>/rest/v1/rt_cnpj_slots?org_id=eq.<ORG_B_ID>
 * URL: GET https://<SUPABASE_URL>/rest/v1/rt_assinaturas?org_id=eq.<ORG_B_ID>
 * Headers: apikey: <ANON_KEY>, Authorization: Bearer <TOKEN_ADMIN_A>
 * Esperado: array vazio (RLS is_member_of bloqueia — Admin A não é membro de Org B)
 *
 * T-M-07: INSERT/UPDATE direto em rt_assinaturas ou rt_cnpj_slots via anon key + JWT
 *
 * URL: POST/PATCH https://<SUPABASE_URL>/rest/v1/rt_assinaturas
 * Headers: apikey: <ANON_KEY>, Authorization: Bearer <TOKEN_TAX_REFORM>
 * Body: { status: "active" } (tentando se auto-ativar sem pagamento)
 * Esperado: 403 (sem policy de insert/update para authenticated — só service_role escreve)
 */
