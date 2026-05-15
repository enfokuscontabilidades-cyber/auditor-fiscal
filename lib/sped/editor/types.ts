// Types for the Editor SPED Fiscal module

export interface SpedRegistro {
  bloco: string
  tipo: string
  campos: string[]
  linhaOriginal: number
}

export interface Sped0000 {
  cod_ver: string; cod_fin: string
  dt_ini: string; dt_fin: string
  nome: string; cnpj: string; cpf: string; uf: string; ie: string
  cod_mun: string; suframa: string; ind_perfil: string; ind_ativ: string
}

export interface Sped0190 { unid: string; descr: string }

export interface Sped0200Ext {
  cod_item: string; descr_item: string; cod_barra: string; cod_ant_item: string
  unid_inv: string; tipo_item: string; cod_ncm: string; ex_ipi: string
  cod_gen: string; cod_lst: string; aliq_icms: string; cest: string
}

export interface Sped0220 { cod_item: string; unid_conv: string; fat_conv: string }

export interface SpedK200 { dt_est: string; cod_item: string; qt_est: string; ind_est: string; cod_part: string }
export interface SpedK220 { dt_mov: string; cod_item_ori: string; qt_ori: string; cod_item_dest: string; qt_dest: string }
export interface SpedK230 { ord_prod: string; dt_ini_op: string; dt_fin_op: string; cod_doc_op: string; cod_item: string; qt_ord: string; qt_prod: string }
export interface SpedK235 { dt_saida: string; cod_item: string; qt_cons: string; cod_ins_subst: string }
export interface SpedK250 { dt_prod: string; cod_item: string; qt_prod: string }
export interface SpedK255 { dt_cons: string; cod_item: string; qt_cons: string; cod_ins_subst: string }
export interface SpedK260 { ord_reop: string; dt_ini_op: string; dt_fin_op: string; cod_item: string; qt_reop: string; qt_prod: string }
export interface SpedK265 { dt_saida: string; cod_item: string; qt_cons: string }
export interface SpedK270 { dt_apur: string; cod_op_os: string; cod_item: string; qt_bfx: string; qt_sfx: string }
export interface SpedK275 { dt_saida: string; cod_item: string; qt_cons: string; cod_ins_subst: string }
export interface SpedK280 { dt_est: string; cod_item: string; qt_bfx: string; qt_sfx: string; ind_est: string; cod_part: string }

export interface ConflitoRegistro {
  tipo: "0200" | "0190" | "0220"
  codigo: string
  label: string
  camposDivergentes: string[]
  valorA: Record<string, string>
  valorB: Record<string, string>
  resolucao: "A" | "B" | null
}

export interface LogAlteracao {
  tipo: "inserido" | "substituido" | "removido" | "atualizado"
  bloco: string; registro: string; descricao: string
  origem: "mescla_automatica" | "edicao_manual" | "importacao_excel"
  timestamp: string
}

export interface ResumoArquivo {
  cnpj: string; nome: string; uf: string
  periodoInicial: string; periodoFinal: string
  totalLinhas: number; blocos: string[]
  temBlocoK: boolean
  totalRegistros0200: number; totalRegistrosK: number
  produtosNoK: string[]
}

export interface SpedEditorParsed {
  raw: SpedRegistro[]
  resumo: ResumoArquivo
  r0000: Sped0000 | null
  r0190: Record<string, Sped0190>
  r0200: Record<string, Sped0200Ext>
  r0220: Record<string, Sped0220[]>
  rK: {
    k200: SpedK200[]; k220: SpedK220[]; k230: SpedK230[]; k235: SpedK235[]
    k250: SpedK250[]; k255: SpedK255[]; k260: SpedK260[]; k265: SpedK265[]
    k270: SpedK270[]; k275: SpedK275[]; k280: SpedK280[]
  }
}

export interface ErroValidacao {
  id: string; nivel: "erro" | "aviso"; descricao: string; detalhes?: string
}

export interface ResultadoMescla {
  registros: SpedRegistro[]
  conflitos: ConflitoRegistro[]
  log: LogAlteracao[]
  warnings: string[]
}
