// Tipos compartilhados do módulo de Planejamento Tributário
// Todos os valores monetários em R$; percentuais em decimal (0.065 = 6,5%)

import type { Empresa, DocumentoFiscal, DocumentoFiscalItem } from '@/lib/types'

// ──────────────────────────────────────────────────────────────────────────────
// Premissas editáveis pelo usuário
// ──────────────────────────────────────────────────────────────────────────────

export type TipoPredominante = 'comercio' | 'industria' | 'servico' | 'misto'
export type ModoIcms = 'apenas_real' | 'simular_faltantes' | 'conservador'

export interface PremissasLucroPresumido {
  percentualIrpjComercio: number       // default 0.08
  percentualIrpjServico: number        // default 0.32
  percentualIrpjIndustria: number      // default 0.08
  percentualCsllComercio: number       // default 0.12
  percentualCsllServico: number        // default 0.32
  percentualCsllIndustria: number      // default 0.12
}

export interface PremissasLucroReal {
  margemLucroEstimada: number          // default 0.10 (10%)
  cmvSobreReceita: number              // default 0.60
  despesasOperacionaisSobreReceita: number  // default 0.15
  folhaSobreReceita: number            // default 0.10
  outrasDeducoesSobreReceita: number   // default 0.05
  creditosPisCofinsEstimados: number   // valor fixo estimado; 0 se não informado
}

export interface PremissasIcms {
  aliquotaInternaDefault: number       // default 0.17 (Goiás)
  aliquotaInterestadualSul: number     // default 0.12 (SP/MG/RS/etc)
  aliquotaInterestadualNorte: number   // default 0.07 (regiões N/NE/CO)
  aliquotaImportado: number            // default 0.04
  ufEmpresa: string                    // UF da empresa (ex: 'GO')
  modo: ModoIcms
}

export interface PremissesCenario {
  nomeCenario: string
  tipoPredominante: TipoPredominante
  periodoInicial: string               // "YYYY-MM"
  periodoFinal: string                 // "YYYY-MM"
  empresaIds: string[]
  lucroPresumido: PremissasLucroPresumido
  lucroReal: PremissasLucroReal
  icms: PremissasIcms
}

// ──────────────────────────────────────────────────────────────────────────────
// Resultado de consolidação do grupo
// ──────────────────────────────────────────────────────────────────────────────

export interface ReceitaMensalEmpresa {
  empresaId: string
  razaoSocial: string
  cnpj: string
  competencia: string                  // "MM/YYYY"
  receita: number
  fonteReceita: 'pgdas' | 'xml' | 'manual' | 'estimado'
}

export interface ReceitaMensalConsolidada {
  competencia: string                  // "MM/YYYY"
  receitaTotal: number
  porEmpresa: Record<string, number>   // empresaId → receita
  ultrapassaLimite: boolean
  folga: number                        // negativo = excedeu
}

export interface ResultadoConsolidacao {
  empresas: Empresa[]
  receitaPorMes: ReceitaMensalConsolidada[]
  receitaAnualTotal: number
  rbt12Consolidado: number
  ultrapassaLimiteAnual: boolean
  mesesEmRisco: string[]
  simplesAtualTotal: number            // DAS total do período (de sn_declaracoes)
  alertas: string[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Resultado Lucro Presumido
// ──────────────────────────────────────────────────────────────────────────────

export interface TributoLP {
  nome: string
  base: number
  aliquota: number
  valor: number
  nota?: string
}

export interface ResultadoLPMes {
  competencia: string
  receitaTributavel: number
  pis: number
  cofins: number
  irpjBase: number
  csllBase: number
  irpjMensal: number                   // estimativa mensal; IRPJ/CSLL é trimestral
  csllMensal: number
  totalMensal: number
  tributos: TributoLP[]
}

export interface ResultadoLucroPresumido {
  porMes: ResultadoLPMes[]
  totalPeriodo: number
  aliquotaEfetiva: number
  premissasUsadas: PremissasLucroPresumido
  confianca: NivelConfianca
  alertas: string[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Resultado Lucro Real
// ──────────────────────────────────────────────────────────────────────────────

export interface ResultadoLRMes {
  competencia: string
  receitaBruta: number
  deducoes: number                     // devoluções, etc
  receitaLiquida: number
  cmv: number
  despesasOperacionais: number
  folha: number
  outrasDeducoes: number
  lucroEstimado: number
  pisSobreReceita: number              // débito
  cofinsSobreReceita: number           // débito
  creditosPis: number
  creditosCofins: number
  pisLiquido: number
  cofinsLiquido: number
  irpjMensal: number
  csllMensal: number
  totalMensal: number
}

export interface ResultadoLucroReal {
  porMes: ResultadoLRMes[]
  totalPeriodo: number
  aliquotaEfetiva: number
  premissasUsadas: PremissasLucroReal
  confianca: NivelConfianca
  alertas: string[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Resultado ICMS — por nível de confiança
// ──────────────────────────────────────────────────────────────────────────────

export type NivelIcms = 'real_destacado' | 'simulado_por_aliquota' | 'sem_base_suficiente' | 'st_encerrado' | 'isento_ou_nao_tributado'

export interface ItemIcms {
  documentoId: string
  empresaId: string
  competencia: string
  descricao?: string
  cfop?: string
  ncm?: string
  cstIcms?: string
  csosn?: string
  valorBase: number
  aliquotaUsada: number
  valorIcms: number
  origemAliquota: string
  nivel: NivelIcms
  ehCredito: boolean
  motivoCredito?: string
  motivoSemCredito?: string
}

export interface ResultadoIcmsMes {
  competencia: string
  debitoReal: number
  debitoSimulado: number
  creditoAproveitavel: number
  creditoGlosado: number
  icmsSt: number
  icmsEstimadoPagar: number
  nivelConfianca: 'alto' | 'medio' | 'baixo'
  itens: ItemIcms[]
  alertas: string[]
}

export interface ResultadoIcms {
  porMes: ResultadoIcmsMes[]
  totalDebitoReal: number
  totalDebitoSimulado: number
  totalCreditoAproveitavel: number
  totalEstimadoPagar: number
  alertas: string[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Resultado comparativo final
// ──────────────────────────────────────────────────────────────────────────────

export type NivelConfianca = 'alto' | 'medio' | 'baixo'

export interface ResultadoComparativo {
  consolidacao: ResultadoConsolidacao
  simplesAtual: number
  lucroPresumido: ResultadoLucroPresumido
  lucroReal: ResultadoLucroReal
  icms: ResultadoIcms
  melhorRegime: 'simples' | 'presumido' | 'real' | 'indeterminado'
  economiaEstimada: number             // positivo = SN mais caro; negativo = SN mais barato
  confiancaGeral: NivelConfianca
  premissas: PremissesCenario
  alertasGerais: string[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Payload da API
// ──────────────────────────────────────────────────────────────────────────────

export interface PayloadSimulacao {
  premissas: PremissesCenario
}

export interface RespostaSimulacao {
  resultado: ResultadoComparativo
  geradoEm: string
}

// ──────────────────────────────────────────────────────────────────────────────
// Dados brutos buscados do banco (passados internamente entre funções)
// ──────────────────────────────────────────────────────────────────────────────

export interface DadosBrutosEmpresa {
  empresa: Empresa
  declaracoes: Array<{
    competencia: string
    receita_bruta_mes?: number
    receita_bruta_acumulada_12m?: number
    valor_total_devido?: number
  }>
  receitasMensais: Array<{
    competencia: string
    receita_bruta_mes: number
    origem: string
  }>
  documentos: DocumentoFiscal[]
  itens: DocumentoFiscalItem[]
}
