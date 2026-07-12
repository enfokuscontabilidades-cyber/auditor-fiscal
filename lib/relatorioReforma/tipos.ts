// Tipos compartilhados entre o endpoint de análise, o motor de pontuação, a
// classificação de divergências e o gerador do PDF do relatório técnico.
// Único ponto de verdade para o formato do "resultado estruturado" do
// diagnóstico — evita que cada módulo declare sua própria cópia do shape.

import type { SituacaoReforma } from '@/lib/fiscal/analiseReformaTributaria'
import type { ItemXmlDiagnostico } from '@/lib/fiscal/lerXmlDiagnostico'

export type MotivoFalhaArquivo =
  | 'vazio' | 'estrutura_suspeita' | 'nao_xml' | 'documento_nao_suportado'
  | 'malformado' | 'duplicado' | 'muito_grande' | 'extensao_invalida'

export interface ItemResultadoDiagnostico extends ItemXmlDiagnostico {
  alertas: string[]
  situacao: SituacaoReforma
  destacado: boolean
}

export interface ResultadoArquivoDiagnostico {
  id: string
  arquivo: string
  ok: boolean
  motivoFalha?: MotivoFalhaArquivo
  mensagemFalha?: string
  tipoDocumento?: string
  numero?: string
  serie?: string
  dataEmissao?: string | null
  emitenteMascarado?: string
  /** Usada apenas para identificar o documento na tela/relatório — nunca gera divergência, pontuação ou orientação. */
  chaveAcesso?: string | null
  /** Totalizador de IBS/CBS da nota (grupo IBSCBSTot). `null` quando o XML não traz esse grupo. */
  totalizadorIbs?: number | null
  totalizadorCbs?: number | null
  situacao?: SituacaoReforma
  camposEncontrados?: string[]
  camposAusentes?: string[]
  itens?: ItemResultadoDiagnostico[]
  recomendacoes?: string[]
}

export interface ResumoAnaliseDiagnostico {
  totalAnalisado: number
  adequado: number
  atencao: number
  critico: number
}

/** Metadados do cliente informados no formulário de captação (não incluem os XMLs). */
export interface IdentificacaoEmpresaDiagnostico {
  nomeSolicitante: string
  empresa: string
  cnpjMascarado: string
  regimeTributario: string
  cidade: string
  estado: string
  sistemaEmissor: string | null
}

/**
 * Versões que ficam "carimbadas" no diagnóstico no momento em que ele é
 * gerado (imutabilidade) — bump em 2026.2: pontuação e divergências restritas
 * exclusivamente a IBS/CBS (chave de acesso, data de emissão e demais campos
 * gerais do XML deixaram de gerar divergência ou afetar a nota).
 */
export const VERSAO_REGRAS_ANALISE = '2026.2'
