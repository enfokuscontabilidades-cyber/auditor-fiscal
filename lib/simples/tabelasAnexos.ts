// Tabelas do Simples Nacional — LC 123/2006 com redação da LC 155/2016
// Vigência: a partir de 01/01/2018
// Fórmula da alíquota efetiva: ((RBT12 × aliq_nominal) - parcela_deduzir) / RBT12

export type AnexoSimples = 'I' | 'II' | 'III' | 'IV' | 'V'

export type TributoSimples = 'IRPJ' | 'CSLL' | 'COFINS' | 'PIS' | 'CPP' | 'ICMS' | 'ISS' | 'IPI'

export interface FaixaSimples {
  faixa: number        // 1 a 6
  de: number           // valor mínimo (inclusive)
  ate: number          // valor máximo (inclusive); Infinity na última faixa
  aliquota: number     // alíquota nominal em decimal (ex: 0.04 = 4%)
  parcela: number      // parcela a deduzir em R$
}

// Formato expandido com repartição por tributo (compatível com spec do usuário)
export interface FaixaCompleta {
  anexo: AnexoSimples
  faixa: number
  receitaInicial: number
  receitaFinal: number
  aliquotaNominal: number   // percentual (ex: 4.00 para 4%)
  parcelaDeduzir: number
  reparticao: Partial<Record<TributoSimples, number>>  // % de repartição — soma 100
}

// Distribuição % de cada tributo dentro do DAS para cada faixa
// Fonte: Anexos I-V da LC 123/2006 conforme LC 155/2016
export interface DistribuicaoSimples {
  IRPJ: number
  CSLL: number
  COFINS: number
  PIS: number
  CPP: number    // 0 no Anexo IV
  ICMS: number   // 0 nos anexos de serviço puro
  ISS: number    // 0 nos anexos de comércio/indústria
  IPI: number    // somente Anexo II
}

// ──────────────────────────────────────────────────────────────────────────
// ANEXO I — Comércio / Revenda
// ──────────────────────────────────────────────────────────────────────────
export const TABELA_ANEXO_I: FaixaSimples[] = [
  { faixa: 1, de: 0,             ate: 180_000,    aliquota: 0.0400, parcela:       0 },
  { faixa: 2, de: 180_000.01,   ate: 360_000,    aliquota: 0.0730, parcela:   5_940 },
  { faixa: 3, de: 360_000.01,   ate: 720_000,    aliquota: 0.0950, parcela:  13_860 },
  { faixa: 4, de: 720_000.01,   ate: 1_800_000,  aliquota: 0.1070, parcela:  22_500 },
  { faixa: 5, de: 1_800_000.01, ate: 3_600_000,  aliquota: 0.1430, parcela:  87_300 },
  { faixa: 6, de: 3_600_000.01, ate: 4_800_000,  aliquota: 0.1900, parcela: 378_000 },
]

export const DISTRIBUICAO_ANEXO_I: Record<number, DistribuicaoSimples> = {
  1: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00, ISS: 0, IPI: 0 },
  2: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00, ISS: 0, IPI: 0 },
  3: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00, ISS: 0, IPI: 0 },
  4: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00, ISS: 0, IPI: 0 },
  5: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00, ISS: 0, IPI: 0 },
  // Faixa 6: ICMS recolhido fora do DAS em alguns estados; distribuição SEM ICMS
  6: { IRPJ: 13.50, CSLL: 10.00, COFINS: 28.27, PIS: 6.13, CPP: 42.10, ICMS: 0, ISS: 0, IPI: 0 },
}

// ──────────────────────────────────────────────────────────────────────────
// ANEXO II — Indústria / Fabricação
// ──────────────────────────────────────────────────────────────────────────
export const TABELA_ANEXO_II: FaixaSimples[] = [
  { faixa: 1, de: 0,             ate: 180_000,    aliquota: 0.0450, parcela:       0 },
  { faixa: 2, de: 180_000.01,   ate: 360_000,    aliquota: 0.0780, parcela:   5_940 },
  { faixa: 3, de: 360_000.01,   ate: 720_000,    aliquota: 0.1000, parcela:  13_860 },
  { faixa: 4, de: 720_000.01,   ate: 1_800_000,  aliquota: 0.1120, parcela:  22_500 },
  { faixa: 5, de: 1_800_000.01, ate: 3_600_000,  aliquota: 0.1470, parcela:  85_500 },
  { faixa: 6, de: 3_600_000.01, ate: 4_800_000,  aliquota: 0.3000, parcela: 720_000 },
]

export const DISTRIBUICAO_ANEXO_II: Record<number, DistribuicaoSimples> = {
  1: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.00, ICMS: 32.00, ISS: 0, IPI: 8.00 },
  2: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.00, ICMS: 32.00, ISS: 0, IPI: 8.00 },
  3: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.00, ICMS: 32.00, ISS: 0, IPI: 8.00 },
  4: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.00, ICMS: 32.00, ISS: 0, IPI: 8.00 },
  5: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.00, ICMS: 32.00, ISS: 0, IPI: 8.00 },
  6: { IRPJ: 8.50, CSLL: 7.50, COFINS: 20.96, PIS: 4.54, CPP: 23.50, ICMS: 35.00, ISS: 0, IPI: 0 },
}

// ──────────────────────────────────────────────────────────────────────────
// ANEXO III — Serviços (regra geral ou Fator R ≥ 28%)
// Inclui CPP e ISS no DAS
// ──────────────────────────────────────────────────────────────────────────
export const TABELA_ANEXO_III: FaixaSimples[] = [
  { faixa: 1, de: 0,             ate: 180_000,    aliquota: 0.0600, parcela:       0 },
  { faixa: 2, de: 180_000.01,   ate: 360_000,    aliquota: 0.1120, parcela:   9_360 },
  { faixa: 3, de: 360_000.01,   ate: 720_000,    aliquota: 0.1350, parcela:  17_640 },
  { faixa: 4, de: 720_000.01,   ate: 1_800_000,  aliquota: 0.1600, parcela:  35_640 },
  { faixa: 5, de: 1_800_000.01, ate: 3_600_000,  aliquota: 0.2100, parcela: 125_640 },
  { faixa: 6, de: 3_600_000.01, ate: 4_800_000,  aliquota: 0.3300, parcela: 648_000 },
]

export const DISTRIBUICAO_ANEXO_III: Record<number, DistribuicaoSimples> = {
  1: { IRPJ: 10.00, CSLL: 7.50, COFINS: 14.10, PIS: 3.05, CPP: 43.40, ICMS: 0, ISS: 21.95, IPI: 0 },
  2: { IRPJ: 10.00, CSLL: 7.50, COFINS: 14.10, PIS: 3.05, CPP: 43.40, ICMS: 0, ISS: 21.95, IPI: 0 },
  3: { IRPJ: 10.00, CSLL: 7.50, COFINS: 14.10, PIS: 3.05, CPP: 43.40, ICMS: 0, ISS: 21.95, IPI: 0 },
  4: { IRPJ: 10.00, CSLL: 7.50, COFINS: 14.10, PIS: 3.05, CPP: 43.40, ICMS: 0, ISS: 21.95, IPI: 0 },
  5: { IRPJ: 10.00, CSLL: 7.50, COFINS: 14.10, PIS: 3.05, CPP: 43.40, ICMS: 0, ISS: 21.95, IPI: 0 },
  6: { IRPJ: 35.00, CSLL: 15.00, COFINS: 16.03, PIS: 3.47, CPP: 30.50, ICMS: 0, ISS: 0, IPI: 0 },
}

// ──────────────────────────────────────────────────────────────────────────
// ANEXO IV — Serviços (determinadas atividades; SEM CPP no DAS)
// CPP é recolhido separadamente (INSS patronal via GFIP/eSocial)
// ──────────────────────────────────────────────────────────────────────────
export const TABELA_ANEXO_IV: FaixaSimples[] = [
  { faixa: 1, de: 0,             ate: 180_000,    aliquota: 0.0450, parcela:       0 },
  { faixa: 2, de: 180_000.01,   ate: 360_000,    aliquota: 0.0900, parcela:   8_100 },
  { faixa: 3, de: 360_000.01,   ate: 720_000,    aliquota: 0.1020, parcela:  12_420 },
  { faixa: 4, de: 720_000.01,   ate: 1_800_000,  aliquota: 0.1400, parcela:  39_780 },
  { faixa: 5, de: 1_800_000.01, ate: 3_600_000,  aliquota: 0.2200, parcela: 183_780 },
  { faixa: 6, de: 3_600_000.01, ate: 4_800_000,  aliquota: 0.3300, parcela: 828_000 },
]

export const DISTRIBUICAO_ANEXO_IV: Record<number, DistribuicaoSimples> = {
  // CPP = 0 neste anexo — INSS patronal recolhido separadamente
  1: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, CPP: 0, ICMS: 0, ISS: 44.50, IPI: 0 },
  2: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, CPP: 0, ICMS: 0, ISS: 44.50, IPI: 0 },
  3: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, CPP: 0, ICMS: 0, ISS: 44.50, IPI: 0 },
  4: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, CPP: 0, ICMS: 0, ISS: 44.50, IPI: 0 },
  5: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, CPP: 0, ICMS: 0, ISS: 44.50, IPI: 0 },
  6: { IRPJ: 53.50, CSLL: 21.50, COFINS: 20.55, PIS: 4.45, CPP: 0, ICMS: 0, ISS: 0, IPI: 0 },
}

// ──────────────────────────────────────────────────────────────────────────
// ANEXO V — Serviços com Fator R < 28% (senão vai para Anexo III)
// ──────────────────────────────────────────────────────────────────────────
export const TABELA_ANEXO_V: FaixaSimples[] = [
  { faixa: 1, de: 0,             ate: 180_000,    aliquota: 0.1550, parcela:       0 },
  { faixa: 2, de: 180_000.01,   ate: 360_000,    aliquota: 0.1800, parcela:   4_500 },
  { faixa: 3, de: 360_000.01,   ate: 720_000,    aliquota: 0.1950, parcela:   9_900 },
  { faixa: 4, de: 720_000.01,   ate: 1_800_000,  aliquota: 0.2050, parcela:  17_100 },
  { faixa: 5, de: 1_800_000.01, ate: 3_600_000,  aliquota: 0.2300, parcela:  62_100 },
  { faixa: 6, de: 3_600_000.01, ate: 4_800_000,  aliquota: 0.3050, parcela: 540_000 },
]

export const DISTRIBUICAO_ANEXO_V: Record<number, DistribuicaoSimples> = {
  1: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ICMS: 0, ISS: 14.00, IPI: 0 },
  2: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ICMS: 0, ISS: 14.00, IPI: 0 },
  3: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ICMS: 0, ISS: 14.00, IPI: 0 },
  4: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ICMS: 0, ISS: 14.00, IPI: 0 },
  5: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ICMS: 0, ISS: 14.00, IPI: 0 },
  6: { IRPJ: 21.00, CSLL: 15.00, COFINS: 16.03, PIS: 3.47, CPP: 37.00, ICMS: 0, ISS: 7.50, IPI: 0 },
}

// ──────────────────────────────────────────────────────────────────────────
// Índice de acesso por anexo
// ──────────────────────────────────────────────────────────────────────────
export const TABELAS_ANEXOS: Record<AnexoSimples, FaixaSimples[]> = {
  I: TABELA_ANEXO_I,
  II: TABELA_ANEXO_II,
  III: TABELA_ANEXO_III,
  IV: TABELA_ANEXO_IV,
  V: TABELA_ANEXO_V,
}

export const DISTRIBUICOES_ANEXOS: Record<AnexoSimples, Record<number, DistribuicaoSimples>> = {
  I: DISTRIBUICAO_ANEXO_I,
  II: DISTRIBUICAO_ANEXO_II,
  III: DISTRIBUICAO_ANEXO_III,
  IV: DISTRIBUICAO_ANEXO_IV,
  V: DISTRIBUICAO_ANEXO_V,
}

export const LIMITE_SIMPLES_NACIONAL = 4_800_000
export const LIMITE_MEI = 81_000

// Atividades que tipicamente se enquadram em cada anexo de serviços
// (referência para sugestão automática; não substitui análise do contador)
export const ATIVIDADES_ANEXO_III = [
  'academia', 'escola', 'ensino', 'curso', 'estética', 'beleza',
  'construção civil', 'obras', 'engenharia civil', 'manutenção',
  'agência de viagem', 'turismo', 'marketing', 'publicidade',
  'academias', 'academia de ginástica',
]

export const ATIVIDADES_ANEXO_IV = [
  'advocacia', 'direito', 'consultoria', 'gestão', 'administração',
  'auditoria', 'contabilidade', 'perícia', 'jornalismo', 'arquitetura',
  'engenharia consultiva', 'odontologia', 'medicina', 'psicologia',
  'fisioterapia', 'fonoaudiologia', 'veterinária', 'corretagem',
  'representação comercial',
]

// ──────────────────────────────────────────────────────────────────────────
// FAIXAS_COMPLETAS — array plano unificando tabelas e distribuições
// aliquotaNominal em % (ex: 4.00 para 4%); reparticao soma 100
// ──────────────────────────────────────────────────────────────────────────
export const FAIXAS_COMPLETAS: FaixaCompleta[] = [
  // ── Anexo I — Comércio ──────────────────────────────────────────────────
  { anexo: 'I', faixa: 1, receitaInicial: 0, receitaFinal: 180_000, aliquotaNominal: 4.00, parcelaDeduzir: 0,
    reparticao: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00 } },
  { anexo: 'I', faixa: 2, receitaInicial: 180_000.01, receitaFinal: 360_000, aliquotaNominal: 7.30, parcelaDeduzir: 5_940,
    reparticao: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00 } },
  { anexo: 'I', faixa: 3, receitaInicial: 360_000.01, receitaFinal: 720_000, aliquotaNominal: 9.50, parcelaDeduzir: 13_860,
    reparticao: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00 } },
  { anexo: 'I', faixa: 4, receitaInicial: 720_000.01, receitaFinal: 1_800_000, aliquotaNominal: 10.70, parcelaDeduzir: 22_500,
    reparticao: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00 } },
  { anexo: 'I', faixa: 5, receitaInicial: 1_800_000.01, receitaFinal: 3_600_000, aliquotaNominal: 14.30, parcelaDeduzir: 87_300,
    reparticao: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00 } },
  { anexo: 'I', faixa: 6, receitaInicial: 3_600_000.01, receitaFinal: 4_800_000, aliquotaNominal: 19.00, parcelaDeduzir: 378_000,
    reparticao: { IRPJ: 13.50, CSLL: 10.00, COFINS: 28.27, PIS: 6.13, CPP: 42.10 } },

  // ── Anexo II — Indústria ────────────────────────────────────────────────
  { anexo: 'II', faixa: 1, receitaInicial: 0, receitaFinal: 180_000, aliquotaNominal: 4.50, parcelaDeduzir: 0,
    reparticao: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.00, ICMS: 32.00, IPI: 8.00 } },
  { anexo: 'II', faixa: 2, receitaInicial: 180_000.01, receitaFinal: 360_000, aliquotaNominal: 7.80, parcelaDeduzir: 5_940,
    reparticao: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.00, ICMS: 32.00, IPI: 8.00 } },
  { anexo: 'II', faixa: 3, receitaInicial: 360_000.01, receitaFinal: 720_000, aliquotaNominal: 10.00, parcelaDeduzir: 13_860,
    reparticao: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.00, ICMS: 32.00, IPI: 8.00 } },
  { anexo: 'II', faixa: 4, receitaInicial: 720_000.01, receitaFinal: 1_800_000, aliquotaNominal: 11.20, parcelaDeduzir: 22_500,
    reparticao: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.00, ICMS: 32.00, IPI: 8.00 } },
  { anexo: 'II', faixa: 5, receitaInicial: 1_800_000.01, receitaFinal: 3_600_000, aliquotaNominal: 14.70, parcelaDeduzir: 85_500,
    reparticao: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.00, ICMS: 32.00, IPI: 8.00 } },
  { anexo: 'II', faixa: 6, receitaInicial: 3_600_000.01, receitaFinal: 4_800_000, aliquotaNominal: 30.00, parcelaDeduzir: 720_000,
    reparticao: { IRPJ: 8.50, CSLL: 7.50, COFINS: 20.96, PIS: 4.54, CPP: 23.50, ICMS: 35.00 } },

  // ── Anexo III — Serviços (Fator R ≥ 28%) ───────────────────────────────
  { anexo: 'III', faixa: 1, receitaInicial: 0, receitaFinal: 180_000, aliquotaNominal: 6.00, parcelaDeduzir: 0,
    reparticao: { IRPJ: 10.00, CSLL: 7.50, COFINS: 14.10, PIS: 3.05, CPP: 43.40, ISS: 21.95 } },
  { anexo: 'III', faixa: 2, receitaInicial: 180_000.01, receitaFinal: 360_000, aliquotaNominal: 11.20, parcelaDeduzir: 9_360,
    reparticao: { IRPJ: 10.00, CSLL: 7.50, COFINS: 14.10, PIS: 3.05, CPP: 43.40, ISS: 21.95 } },
  { anexo: 'III', faixa: 3, receitaInicial: 360_000.01, receitaFinal: 720_000, aliquotaNominal: 13.50, parcelaDeduzir: 17_640,
    reparticao: { IRPJ: 10.00, CSLL: 7.50, COFINS: 14.10, PIS: 3.05, CPP: 43.40, ISS: 21.95 } },
  { anexo: 'III', faixa: 4, receitaInicial: 720_000.01, receitaFinal: 1_800_000, aliquotaNominal: 16.00, parcelaDeduzir: 35_640,
    reparticao: { IRPJ: 10.00, CSLL: 7.50, COFINS: 14.10, PIS: 3.05, CPP: 43.40, ISS: 21.95 } },
  { anexo: 'III', faixa: 5, receitaInicial: 1_800_000.01, receitaFinal: 3_600_000, aliquotaNominal: 21.00, parcelaDeduzir: 125_640,
    reparticao: { IRPJ: 10.00, CSLL: 7.50, COFINS: 14.10, PIS: 3.05, CPP: 43.40, ISS: 21.95 } },
  { anexo: 'III', faixa: 6, receitaInicial: 3_600_000.01, receitaFinal: 4_800_000, aliquotaNominal: 33.00, parcelaDeduzir: 648_000,
    reparticao: { IRPJ: 35.00, CSLL: 15.00, COFINS: 16.03, PIS: 3.47, CPP: 30.50 } },

  // ── Anexo IV — Serviços (sem CPP no DAS) ───────────────────────────────
  { anexo: 'IV', faixa: 1, receitaInicial: 0, receitaFinal: 180_000, aliquotaNominal: 4.50, parcelaDeduzir: 0,
    reparticao: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, ISS: 44.50 } },
  { anexo: 'IV', faixa: 2, receitaInicial: 180_000.01, receitaFinal: 360_000, aliquotaNominal: 9.00, parcelaDeduzir: 8_100,
    reparticao: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, ISS: 44.50 } },
  { anexo: 'IV', faixa: 3, receitaInicial: 360_000.01, receitaFinal: 720_000, aliquotaNominal: 10.20, parcelaDeduzir: 12_420,
    reparticao: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, ISS: 44.50 } },
  { anexo: 'IV', faixa: 4, receitaInicial: 720_000.01, receitaFinal: 1_800_000, aliquotaNominal: 14.00, parcelaDeduzir: 39_780,
    reparticao: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, ISS: 44.50 } },
  { anexo: 'IV', faixa: 5, receitaInicial: 1_800_000.01, receitaFinal: 3_600_000, aliquotaNominal: 22.00, parcelaDeduzir: 183_780,
    reparticao: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, ISS: 44.50 } },
  { anexo: 'IV', faixa: 6, receitaInicial: 3_600_000.01, receitaFinal: 4_800_000, aliquotaNominal: 33.00, parcelaDeduzir: 828_000,
    reparticao: { IRPJ: 53.50, CSLL: 21.50, COFINS: 20.55, PIS: 4.45 } },

  // ── Anexo V — Serviços (Fator R < 28%) ─────────────────────────────────
  { anexo: 'V', faixa: 1, receitaInicial: 0, receitaFinal: 180_000, aliquotaNominal: 15.50, parcelaDeduzir: 0,
    reparticao: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ISS: 14.00 } },
  { anexo: 'V', faixa: 2, receitaInicial: 180_000.01, receitaFinal: 360_000, aliquotaNominal: 18.00, parcelaDeduzir: 4_500,
    reparticao: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ISS: 14.00 } },
  { anexo: 'V', faixa: 3, receitaInicial: 360_000.01, receitaFinal: 720_000, aliquotaNominal: 19.50, parcelaDeduzir: 9_900,
    reparticao: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ISS: 14.00 } },
  { anexo: 'V', faixa: 4, receitaInicial: 720_000.01, receitaFinal: 1_800_000, aliquotaNominal: 20.50, parcelaDeduzir: 17_100,
    reparticao: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ISS: 14.00 } },
  { anexo: 'V', faixa: 5, receitaInicial: 1_800_000.01, receitaFinal: 3_600_000, aliquotaNominal: 23.00, parcelaDeduzir: 62_100,
    reparticao: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ISS: 14.00 } },
  { anexo: 'V', faixa: 6, receitaInicial: 3_600_000.01, receitaFinal: 4_800_000, aliquotaNominal: 30.50, parcelaDeduzir: 540_000,
    reparticao: { IRPJ: 21.00, CSLL: 15.00, COFINS: 16.03, PIS: 3.47, CPP: 37.00, ISS: 7.50 } },
]
