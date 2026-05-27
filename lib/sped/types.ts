// Tipos do módulo Auditor SPED

export type TipoSped = "fiscal" | "contrib"
export type SubtipoSped = "matriz" | "filial"

export interface SpedCompany {
  cnpj: string
  nome: string
  uf: string
  ie: string
  periodoInicial: string
  periodoFinal: string
}

export interface SpedParticipant { nome: string; cnpj: string; cpf: string; uf?: string }
export interface SpedProduct     { descricao: string; ncm: string }

export interface SpedDoc {
  key: string
  indOper: string            // "0"=entrada "1"=saída
  numDoc: string
  dtDoc: string
  vlDoc: number
  base: number               // 0 no contrib
  icms: number               // 0 no contrib
  cfops: string
  participante: string
  ufOperacao: string
  sourceCnpj: string
  sourceLabel: string
  periodo: string
}

export interface SpedC190 {
  key: string
  indOper: string
  numDoc: string; dtDoc: string
  cfop: string; vlOpr: number; base: number; icms: number
  participante: string; ufOperacao: string
  sourceCnpj: string; periodo: string
}

export interface SpedE110 {
  vlTotDebitos: number
  vlTotCreditos: number
  vlSldApurado: number
  vlIcmsRecolher: number
  vlSldCredorTransportar: number
  periodo: string
}

// Cada item de linha de documento do SPED Fiscal (registro C170)
export interface SpedC170Item {
  // Identificação do documento pai (C100)
  docKey:             string   // chave de acesso (C100)
  numDoc:             string   // número da NF
  dtDoc:              string   // data da NF (DDMMAAAA)
  participanteCodigo: string   // código do participante (0150)
  participanteCnpj:   string   // CNPJ do participante
  participanteNome:   string   // nome do participante

  // Dados do item (C170)
  numItem:   string   // número sequencial do item
  codItem:   string   // código do produto (0200)
  descrCompl:string   // descrição complementar do C170
  descricao: string   // descrição do produto (de 0200)
  ncm:       string   // NCM (de 0200)
  cfop:      string
  cstIcms:   string   // CST ICMS (regime normal) ou CSOSN (Simples)
  quantidade:number
  unidade:   string
  vlItem:    number
  vlDesc:    number
  vlBcIcms:  number
  aliqIcms:  number
  vlIcms:    number
  vlBcSt:    number
  vlSt:      number
  vlIpi:     number
  periodo:   string   // MM/AAAA
}

export interface SpedFiscalParsed {
  company: SpedCompany | null
  participants: Record<string, SpedParticipant>
  products: Record<string, SpedProduct>
  docs: SpedDoc[]
  c190: SpedC190[]
  e110: SpedE110 | null
  c170Items: SpedC170Item[]   // itens individuais (C170) — 5.2
  temCiap:   boolean          // bloco G com movimentação (CIAP) — 5.2
}

export interface SpedC170Contrib {
  docKey: string
  numItem: string; codItem: string; vlItem: number
  cstPis: string; vlBcPis: number; aliqPis: number; vlPis: number
  cstCofins: string; vlBcCofins: number; aliqCofins: number; vlCofins: number
  periodo: string
}

export interface SpedApuracaoContrib {
  vlRecBrt: number
  vlBcCont: number
  vlContNc: number
  vlContPer: number
  vlContPagar: number
  periodo: string
}

export interface SpedContribParsed {
  company: SpedCompany | null
  docs: SpedDoc[]
  c170contrib: SpedC170Contrib[]
  m200: SpedApuracaoContrib | null   // apuração PIS
  m600: SpedApuracaoContrib | null   // apuração COFINS
  isZeroed: boolean
}

export interface InconsistenciaSped {
  id: string
  titulo: string
  descricao: string
  nivel: "alto" | "medio" | "baixo"
  categoria: "cruzamento" | "apuracao" | "pis_cofins" | "cfop" | "cst"
  registros: Record<string, unknown>[]
  valorImpacto?: number
}

export interface ItemCruzamento {
  key: string
  numDoc: string; dtDoc: string; participante: string
  vlDocFiscal: number; vlDocContrib: number
  cfopsFiscal: string; cfopsContrib: string
  status: "OK" | "só fiscal" | "só contrib"
}
