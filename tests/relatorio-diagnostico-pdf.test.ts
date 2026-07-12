/**
 * Testes automatizados — motor de pontuação, classificação de divergências e
 * orientação prática do Relatório de Diagnóstico de IBS e CBS em PDF.
 * Escopo restrito a IBS/CBS: chave de acesso, data de emissão e demais
 * campos gerais do XML nunca devem gerar divergência nem afetar a pontuação.
 *
 * EXECUÇÃO:
 *   npx vitest tests/relatorio-diagnostico-pdf.test.ts
 *   (mesmo padrão de globals de tests/reforma-tributaria-leads.test.ts — requer vitest configurado)
 */

import { calcularPontuacao } from '../lib/relatorioReforma/pontuacao'
import { montarDivergencias, listarArquivosComFalha } from '../lib/relatorioReforma/divergencias'
import { montarOrientacoesPrioritarias } from '../lib/relatorioReforma/planoAcao'
import { nomeArquivoRelatorio, montarDadosRelatorio, type DiagnosticoPersistido, type LeadPersistido } from '../lib/relatorioReforma/dadosRelatorio'
import type { ResultadoArquivoDiagnostico, ItemResultadoDiagnostico } from '../lib/relatorioReforma/tipos'

function item(overrides: Partial<ItemResultadoDiagnostico> = {}): ItemResultadoDiagnostico {
  return {
    itemNumero: 1, descricao: 'Produto', ncm: '12345678', cfop: '5102', valorItem: 1000,
    cst: '000', cclass: '000001', base: 1000, aliquotaIbsUf: 0.1, valorIbsUf: 1, aliquotaIbsMun: 0, valorIbsMun: 0,
    valorIbs: 1, aliquotaCbs: 0.9, valorCbs: 9,
    alertas: [], situacao: 'ok', destacado: true,
    ...overrides,
  }
}

/** Item sem grupo IBSCBS — mesmo shape usado pelo endpoint de análise para documentos com grupo ausente. */
function itemSemGrupo(itemNumero: number): ItemResultadoDiagnostico {
  return item({
    itemNumero, destacado: false, cst: '-', cclass: '-', base: 0,
    valorIbs: 0, valorCbs: 0, valorIbsUf: 0, aliquotaIbsUf: 0, aliquotaCbs: 0,
    alertas: ['Sem destaque de IBS/CBS'], situacao: 'critico',
  })
}

describe('calcularPontuacao', () => {
  it('retorna 100 quando todas as verificações aplicáveis de IBS/CBS são conformes', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{
      id: 'f1', arquivo: 'a.xml', ok: true, tipoDocumento: 'NF-e', numero: '1', serie: '1',
      dataEmissao: '2026-01-01', chaveAcesso: '1'.repeat(44), itens: [item()],
    }]
    const divergencias = montarDivergencias(resultados)
    const resultado = calcularPontuacao(resultados, divergencias)
    expect(resultado.pontuacao).toBe(100)
    expect(resultado.classificacao).toBe('estrutura_adequada')
  })

  it('não possui categoria de integridade geral do XML nem de chave/data (fora do escopo de IBS/CBS)', () => {
    const resultado = calcularPontuacao([], [])
    const categorias = resultado.categorias.map(c => c.categoria)
    expect(categorias).not.toContain('estrutura')
    expect(categorias).not.toContain('informacoes_complementares')
    expect(categorias.sort()).toEqual(['bases_aliquotas', 'consistencia_totalizadores', 'cst_cclasstrib', 'presenca_grupos', 'valores_ibs_cbs'].sort())
  })

  it('chave de acesso ausente não reduz a pontuação', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{
      id: 'f1', arquivo: 'a.xml', ok: true, chaveAcesso: null, dataEmissao: null, itens: [item()],
    }]
    const resultado = calcularPontuacao(resultados, montarDivergencias(resultados))
    expect(resultado.pontuacao).toBe(100)
  })

  it('arquivo que falhou na leitura não entra na pontuação de IBS/CBS (nem penaliza, nem "não aplicável" score)', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{ id: 'f1', arquivo: 'a.xml', ok: false, motivoFalha: 'malformado', mensagemFalha: 'x' }]
    const resultado = calcularPontuacao(resultados, montarDivergencias(resultados))
    expect(resultado.semDadosAplicaveis).toBe(true)
    expect(resultado.pontuacao).toBe(0)
  })

  it('não conta item sem grupo IBSCBS como conforme em CST/valores (fica não aplicável)', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{ id: 'f1', arquivo: 'a.xml', ok: true, itens: [itemSemGrupo(1)] }]
    const resultado = calcularPontuacao(resultados, montarDivergencias(resultados))
    const cst = resultado.categorias.find(c => c.categoria === 'cst_cclasstrib')!
    expect(cst.naoAplicaveis).toBe(1)
    expect(cst.conformes).toBe(0)
  })

  it('divergência de consistência entre itens e totalizador reduz somente a categoria correspondente', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{
      id: 'f1', arquivo: 'a.xml', ok: true, totalizadorIbs: 999, totalizadorCbs: null, itens: [item()],
    }]
    const resultado = calcularPontuacao(resultados, montarDivergencias(resultados))
    const consistencia = resultado.categorias.find(c => c.categoria === 'consistencia_totalizadores')!
    expect(consistencia.divergentes).toBeGreaterThan(0)
  })

  it('totalizador não encontrado no XML fica "não validado" e não reduz a nota', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{
      id: 'f1', arquivo: 'a.xml', ok: true, totalizadorIbs: null, totalizadorCbs: null, itens: [item()],
    }]
    const resultado = calcularPontuacao(resultados, montarDivergencias(resultados))
    expect(resultado.pontuacao).toBe(100)
  })

  it('TETO POR GRAVIDADE: havendo qualquer divergência crítica, a nota nunca passa de 49 — mesmo com maioria de itens conformes', () => {
    // Reproduz o caso relatado: 9 documentos, 3 deles inteiramente sem grupo
    // IBSCBS (crítico) e 6 perfeitamente OK. A média por item, sozinha,
    // resultaria em nota "adequada" — o teto por gravidade impede isso.
    const resultados: ResultadoArquivoDiagnostico[] = [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `critico-${i}`, arquivo: `critico-${i}.xml`, ok: true as const,
        itens: [itemSemGrupo(1), itemSemGrupo(2)],
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `ok-${i}`, arquivo: `ok-${i}.xml`, ok: true as const,
        itens: [item({ itemNumero: 1 })],
      })),
    ]
    const divergencias = montarDivergencias(resultados)
    const resultado = calcularPontuacao(resultados, divergencias)
    expect(resultado.pontuacao).toBeLessThanOrEqual(49)
    expect(resultado.classificacao).toBe('situacao_critica')
  })
})

describe('montarDivergencias — consolidação (bug real: 9 XMLs, 3 críticos, 2 itens cada)', () => {
  const resultados: ResultadoArquivoDiagnostico[] = [
    { id: 'doc-1', arquivo: 'nfce-35356.xml', ok: true, tipoDocumento: 'NFC-e', numero: '35356', serie: '1', itens: [itemSemGrupo(1), itemSemGrupo(2)] },
    { id: 'doc-2', arquivo: 'nfce-35357.xml', ok: true, tipoDocumento: 'NFC-e', numero: '35357', serie: '1', itens: [itemSemGrupo(1), itemSemGrupo(2)] },
    { id: 'doc-3', arquivo: 'nfce-35358.xml', ok: true, tipoDocumento: 'NFC-e', numero: '35358', serie: '1', itens: [itemSemGrupo(1), itemSemGrupo(2)] },
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `ok-${i}`, arquivo: `ok-${i}.xml`, ok: true as const, tipoDocumento: 'NFC-e', numero: String(40000 + i), serie: '1',
      itens: [item({ itemNumero: 1 })],
    })),
  ]
  const divergencias = montarDivergencias(resultados)

  it('agrupa em 1 TIPO de divergência, mas preserva os 3 documentos e os 6 itens afetados', () => {
    expect(divergencias).toHaveLength(1)
    const d = divergencias[0]
    expect(d.ruleCode).toBe('IBSCBS_GROUP_MISSING')
    expect(d.totalDocumentosAfetados).toBe(3)
    expect(d.totalItensAfetados).toBe(6)
    expect(d.totalOcorrencias).toBe(6)
  })

  it('lista todos os 3 documentos afetados, cada um com os 2 itens corretos — nenhum é descartado', () => {
    const d = divergencias[0]
    expect(d.documentosAfetados).toHaveLength(3)
    const numeros = d.documentosAfetados.map(doc => doc.numeroDocumento).sort()
    expect(numeros).toEqual(['35356', '35357', '35358'])
    for (const doc of d.documentosAfetados) {
      expect(doc.itensAfetados).toEqual([1, 2])
      expect(doc.serieDocumento).toBe('1')
      expect(doc.tipoDocumento).toBe('NFC-e')
    }
  })

  it('grupo ausente é classificado como crítico', () => {
    expect(divergencias[0].gravidade).toBe('critica')
  })

  it('métricas consolidadas do relatório não confundem tipos de divergência com documentos afetados', () => {
    const lead: LeadPersistido = {
      nome: 'Fulano', empresa: 'Empresa Teste', cnpj: '11444777000161',
      regime_tributario: 'Simples Nacional', estado: 'GO', cidade: 'Goiânia', sistema_emissor: null, codigo_diagnostico: 'RT-BUG1',
    }
    const diagnostico: DiagnosticoPersistido = {
      id: 'diag-1', lead_id: 'lead-1', token: 'a'.repeat(64), resultados,
      resumo: { totalAnalisado: 9, adequado: 6, atencao: 0, critico: 3 },
      pontuacao: 0, classificacao: 'situacao_critica', versao_regras: '2026.2', versao_base_legal: '2026.1',
      versao_relatorio: 1, criado_em: new Date().toISOString(),
    }
    const dados = montarDadosRelatorio(diagnostico, lead)
    expect(dados.resumoConsolidado.totalXmlsAnalisados).toBe(9)
    expect(dados.resumoConsolidado.totalXmlsCriticos).toBe(3)
    expect(dados.resumoConsolidado.totalTiposDivergencia).toBe(1)
    expect(dados.resumoConsolidado.totalOcorrencias).toBe(6)
    expect(dados.resumoConsolidado.totalItensAfetados).toBe(6)
    expect(dados.resumoConsolidado.totalDocumentosAfetados).toBe(3)
    // a conclusão nunca deve dizer "1 apontamento" como se fosse 1 documento
    const textoConclusao = dados.conclusaoParagrafos.join(' ')
    expect(textoConclusao).toContain('3 documentos')
  })
})

describe('montarDivergencias', () => {
  it('não gera divergência quando não há alertas', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{
      id: 'f1', arquivo: 'a.xml', ok: true, chaveAcesso: '1'.repeat(44), dataEmissao: '2026-01-01', itens: [item()],
    }]
    expect(montarDivergencias(resultados)).toHaveLength(0)
  })

  it('chave de acesso ausente/inválida NUNCA gera divergência', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{
      id: 'f1', arquivo: 'a.xml', ok: true, chaveAcesso: null, dataEmissao: null, itens: [item()],
    }]
    const divergencias = montarDivergencias(resultados)
    expect(divergencias.some(d => d.campo.toLowerCase().includes('chave'))).toBe(false)
    expect(divergencias.some(d => d.campo.toLowerCase().includes('emissão'))).toBe(false)
    expect(divergencias).toHaveLength(0)
  })

  it('arquivo que falhou na leitura não vira divergência de IBS/CBS', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{ id: 'f1', arquivo: 'a.xml', ok: false, motivoFalha: 'estrutura_suspeita', mensagemFalha: 'x' }]
    expect(montarDivergencias(resultados)).toHaveLength(0)
  })

  it('consolida divergências repetidas em vários itens do MESMO documento contando ocorrências', () => {
    const itens = Array.from({ length: 8 }, (_, i) => item({ itemNumero: i + 1, cst: '-', alertas: ['CST IBS/CBS ausente'] }))
    const resultados: ResultadoArquivoDiagnostico[] = [{ id: 'f1', arquivo: 'a.xml', ok: true, itens }]
    const divergencias = montarDivergencias(resultados)
    expect(divergencias).toHaveLength(1)
    expect(divergencias[0].totalOcorrencias).toBe(8)
    expect(divergencias[0].totalDocumentosAfetados).toBe(1)
    expect(divergencias[0].documentosAfetados[0].itensAfetados).toHaveLength(8)
  })

  it('detecta divergência de consistência entre soma dos itens e totalizador da nota', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{
      id: 'f1', arquivo: 'a.xml', ok: true, totalizadorIbs: 50, itens: [item({ valorIbs: 1 })],
    }]
    const divergencias = montarDivergencias(resultados)
    expect(divergencias.some(d => d.campo.includes('Totalizador de IBS'))).toBe(true)
  })

  it('grupo ausente é crítico e gera orientação ao fornecedor do sistema', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [{ id: 'f1', arquivo: 'a.xml', ok: true, itens: [itemSemGrupo(1)] }]
    const divergencias = montarDivergencias(resultados)
    expect(divergencias[0].gravidade).toBe('critica')
    expect(divergencias[0].responsavelSugerido).toBe('Fornecedor do sistema emissor')
  })
})

describe('listarArquivosComFalha', () => {
  it('lista arquivos ilegíveis separadamente das divergências, sem contar duplicados', () => {
    const resultados: ResultadoArquivoDiagnostico[] = [
      { id: 'f1', arquivo: 'a.xml', ok: false, motivoFalha: 'malformado', mensagemFalha: 'x' },
      { id: 'f2', arquivo: 'b.xml', ok: false, motivoFalha: 'duplicado', mensagemFalha: 'y' },
    ]
    const falhas = listarArquivosComFalha(resultados)
    expect(falhas).toHaveLength(1)
    expect(falhas[0].arquivo).toBe('a.xml')
  })
})

describe('montarOrientacoesPrioritarias', () => {
  it('limita a no máximo 3 orientações, sem repetir o mesmo texto, e cita o alcance real', () => {
    const itens = Array.from({ length: 5 }, (_, i) => item({ itemNumero: i + 1, cst: '-', cclass: '-', alertas: ['CST IBS/CBS ausente', 'cClassTrib ausente'] }))
    const resultados: ResultadoArquivoDiagnostico[] = [{ id: 'f1', arquivo: 'a.xml', ok: true, itens }]
    const divergencias = montarDivergencias(resultados)
    const orientacoes = montarOrientacoesPrioritarias(divergencias)
    expect(orientacoes.length).toBeLessThanOrEqual(3)
    expect(orientacoes[0].descricao).toMatch(/\d+ documento/)
  })
})

describe('nomeArquivoRelatorio', () => {
  const lead: LeadPersistido = {
    nome: 'Fulano', empresa: 'Comércio Exemplo & Cia Ltda!!', cnpj: '11444777000161',
    regime_tributario: 'Simples Nacional', estado: 'GO', cidade: 'Goiânia', sistema_emissor: null, codigo_diagnostico: 'RT-ABC123',
  }
  const diagnostico: DiagnosticoPersistido = {
    id: 'id-1', lead_id: 'lead-1', token: 'a'.repeat(64), resultados: [],
    resumo: { totalAnalisado: 0, adequado: 0, atencao: 0, critico: 0 },
    pontuacao: 100, classificacao: 'estrutura_adequada', versao_regras: '2026.2', versao_base_legal: '2026.1',
    versao_relatorio: 1, criado_em: new Date().toISOString(),
  }

  it('gera nome sem CNPJ, telefone ou e-mail e apenas caracteres seguros', () => {
    const dados = montarDadosRelatorio(diagnostico, lead)
    const nome = nomeArquivoRelatorio(dados)
    expect(nome).toMatch(/^diagnostico-ibs-cbs-[a-z0-9-]+\.pdf$/)
    expect(nome).not.toContain('11444777000161')
    expect(nome.startsWith('diagnostico-ibs-cbs-comercio-exemplo')).toBe(true)
  })
})
