// Orquestrador: monta o objeto completo de dados que o template do PDF
// consome, a partir da linha persistida em diagnosticos_reforma_tributaria e
// do lead relacionado. Nenhum dado é inventado aqui — tudo vem do resultado
// estruturado já salvo (gerado no momento da análise) ou da configuração
// institucional/base legal centralizadas. Escopo do relatório restrito a
// IBS/CBS — ver pontuacao.ts e divergencias.ts.

import { formatarCnpj } from '@/lib/validacao/documentos'
import { ENFOKUS_CONTABILIDADE, linkWhatsapp } from '@/lib/institucional/enfokusContabilidade'
import { calcularPontuacao, type ResultadoPontuacao } from './pontuacao'
import { montarDivergencias, listarArquivosComFalha, type DivergenciaConsolidada, type ArquivoComFalha, type DocumentoAfetado } from './divergencias'
import { montarOrientacoesPrioritarias, type OrientacaoPrioritaria } from './planoAcao'
import { conclusaoIbsCbs, blocoResultadoSemDivergencia as montarBlocoResultado, type BlocoResultado } from './narrativas'
import { referenciasAtivas, BASE_LEGAL_ATUALIZADA_EM } from './baseLegal'
import type { ResultadoArquivoDiagnostico, ResumoAnaliseDiagnostico } from './tipos'

export interface DiagnosticoPersistido {
  id: string
  lead_id: string | null
  token: string
  resultados: ResultadoArquivoDiagnostico[]
  resumo: ResumoAnaliseDiagnostico
  pontuacao: number
  classificacao: string
  versao_regras: string
  versao_base_legal: string
  versao_relatorio: number
  criado_em: string
}

export interface LeadPersistido {
  nome: string
  empresa: string
  cnpj: string
  regime_tributario: string
  estado: string
  cidade: string
  sistema_emissor: string | null
  codigo_diagnostico: string | null
}

/**
 * Métricas do diagnóstico — cada uma mede uma coisa DIFERENTE e não deve ser
 * usada no lugar de outra (esse foi o bug relatado: "1 apontamento" sendo
 * lido como "1 documento com problema", quando na verdade eram 3 documentos
 * e 6 itens afetados por um único TIPO de divergência).
 */
export interface ResumoConsolidado {
  /** Quantidade de arquivos XML enviados nesta análise (lidos ou não). */
  totalXmlsAnalisados: number
  /** Documentos lidos com sucesso e sem nenhuma divergência de IBS/CBS. */
  totalXmlsSemDivergencias: number
  /** Documentos lidos com sucesso, com divergências apenas de atenção. */
  totalXmlsComAtencao: number
  /** Documentos em situação crítica (inclui falha de leitura e ausência total do grupo IBS/CBS). */
  totalXmlsCriticos: number
  /** Quantidade de REGRAS distintas violadas (ex.: "grupo IBSCBS ausente" conta 1, não importa quantos documentos). */
  totalTiposDivergencia: number
  /** Soma de todas as ocorrências, de todas as regras (documentos × itens, ou 1 por documento quando a regra é do documento). */
  totalOcorrencias: number
  /** Soma dos itens afetados, de todas as regras (um mesmo item com 2 problemas distintos conta 2 vezes). */
  totalItensAfetados: number
  /** Quantidade de documentos distintos afetados por ao menos uma divergência (sem contar duas vezes o mesmo documento). */
  totalDocumentosAfetados: number
  /** Documentos afetados por cada regra, indexado pelo código da regra. */
  documentosAfetadosPorRegra: Record<string, DocumentoAfetado[]>
}

export interface DadosRelatorio {
  codigoDiagnostico: string
  dataEmissao: Date
  institucional: typeof ENFOKUS_CONTABILIDADE
  empresa: {
    nome: string
    cnpjFormatado: string
    regimeTributario: string
    cidade: string
    estado: string
    dataAnalise: Date
    quantidadeXmls: number
    versaoRelatorio: number
  }
  pontuacao: ResultadoPontuacao
  divergencias: DivergenciaConsolidada[]
  arquivosComFalha: ArquivoComFalha[]
  totalDocumentosAnalisados: number
  totalItensAnalisados: number
  resumoConsolidado: ResumoConsolidado
  blocoResultadoSemDivergencia: BlocoResultado
  orientacoesPrioritarias: OrientacaoPrioritaria[]
  legislacao: ReturnType<typeof referenciasAtivas>
  baseLegalAtualizadaEm: string
  baseLegalVersao: string
  conclusaoParagrafos: string[]
  linkWhatsappEspecialista: string
}

function montarResumoConsolidado(diagnostico: DiagnosticoPersistido, divergencias: DivergenciaConsolidada[]): ResumoConsolidado {
  const documentosAfetadosPorRegra: Record<string, DocumentoAfetado[]> = {}
  const idsDocumentosAfetados = new Set<string>()
  let totalOcorrencias = 0
  let totalItensAfetados = 0

  for (const d of divergencias) {
    documentosAfetadosPorRegra[d.ruleCode] = d.documentosAfetados
    totalOcorrencias += d.totalOcorrencias
    totalItensAfetados += d.totalItensAfetados
    for (const doc of d.documentosAfetados) idsDocumentosAfetados.add(doc.arquivoId)
  }

  return {
    totalXmlsAnalisados: diagnostico.resumo.totalAnalisado,
    totalXmlsSemDivergencias: diagnostico.resumo.adequado,
    totalXmlsComAtencao: diagnostico.resumo.atencao,
    totalXmlsCriticos: diagnostico.resumo.critico,
    totalTiposDivergencia: divergencias.length,
    totalOcorrencias,
    totalItensAfetados,
    totalDocumentosAfetados: idsDocumentosAfetados.size,
    documentosAfetadosPorRegra,
  }
}

export function montarDadosRelatorio(diagnostico: DiagnosticoPersistido, lead: LeadPersistido): DadosRelatorio {
  const resultados = diagnostico.resultados
  const divergencias = montarDivergencias(resultados)
  const pontuacao = calcularPontuacao(resultados, divergencias)
  const arquivosComFalha = listarArquivosComFalha(resultados)
  const resumoConsolidado = montarResumoConsolidado(diagnostico, divergencias)

  const documentosOk = resultados.filter(r => r.ok)
  const totalItensAnalisados = documentosOk.reduce((acc, d) => acc + (d.itens?.length || 0), 0)

  const codigoDiagnostico = lead.codigo_diagnostico || `RT-${diagnostico.id.slice(0, 6).toUpperCase()}`

  return {
    codigoDiagnostico,
    dataEmissao: new Date(),
    institucional: ENFOKUS_CONTABILIDADE,
    empresa: {
      nome: lead.empresa,
      cnpjFormatado: formatarCnpj(lead.cnpj),
      regimeTributario: lead.regime_tributario,
      cidade: lead.cidade,
      estado: lead.estado,
      dataAnalise: new Date(diagnostico.criado_em),
      quantidadeXmls: diagnostico.resumo.totalAnalisado,
      versaoRelatorio: diagnostico.versao_relatorio,
    },
    pontuacao,
    divergencias,
    arquivosComFalha,
    totalDocumentosAnalisados: documentosOk.length,
    totalItensAnalisados,
    resumoConsolidado,
    blocoResultadoSemDivergencia: montarBlocoResultado(documentosOk.length),
    orientacoesPrioritarias: montarOrientacoesPrioritarias(divergencias),
    legislacao: referenciasAtivas(),
    baseLegalAtualizadaEm: BASE_LEGAL_ATUALIZADA_EM,
    baseLegalVersao: diagnostico.versao_base_legal,
    conclusaoParagrafos: conclusaoIbsCbs(pontuacao, divergencias, documentosOk.length, resumoConsolidado.totalDocumentosAfetados),
    linkWhatsappEspecialista: linkWhatsapp(
      `Olá! Realizei o diagnóstico de IBS e CBS e gostaria de receber orientação da Enfokus Contabilidade. Meu código de análise é ${codigoDiagnostico}.`,
    ),
  }
}

/** Nome de arquivo seguro: diagnostico-ibs-cbs-[empresa]-[data]-[codigo].pdf — sem CNPJ, telefone ou e-mail. */
export function nomeArquivoRelatorio(dados: DadosRelatorio): string {
  const empresaSanitizada = dados.empresa.nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'empresa'
  const data = dados.dataEmissao.toISOString().slice(0, 10)
  const codigo = dados.codigoDiagnostico.toLowerCase().replace(/[^a-z0-9-]/g, '')
  return `diagnostico-ibs-cbs-${empresaSanitizada}-${data}-${codigo}.pdf`
}
