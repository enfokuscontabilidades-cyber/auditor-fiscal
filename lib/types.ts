export type Regime = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'MEI' | 'CPF'

export interface Organizacao {
  id: string
  nome: string
  plano: 'pendente' | 'founder_access' | 'pro' | 'enterprise'
  produto_escopo: 'full_platform' | 'tax_reform_only'
  created_at: string
  updated_at: string
}

export type PlanoReformaTributariaCodigo = 'rt_essencial' | 'rt_profissional' | 'rt_ilimitado'

export type StatusAssinaturaRt =
  | 'pending' | 'active' | 'past_due' | 'canceled' | 'expired' | 'suspended' | 'manual'

export interface AssinaturaRt {
  id: string
  org_id: string
  plano_codigo: PlanoReformaTributariaCodigo
  preco_contratado_centavos: number
  status: StatusAssinaturaRt
  periodo_inicio: string | null
  ciclo_inicio: string | null
  ciclo_fim: string | null
  proxima_renovacao: string | null
  cancelamento_solicitado: boolean
  acesso_ate: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  criado_em: string
  atualizado_em: string
}

export interface RtCnpjSlot {
  id: string
  assinatura_id: string
  org_id: string
  empresa_id: string
  cnpj_normalizado: string
  vinculado_em: string
  vinculado_por: string | null
  status: 'ativo' | 'corrigido'
}

export interface RtUsoMensal {
  id: string
  assinatura_id: string
  org_id: string
  periodo_inicio: string
  periodo_fim: string
  xmls_processados: number
  atualizado_em: string
}

// ---------------------------------------------------------------
// Relatório do contador para o cliente (segunda modalidade de PDF)
// ---------------------------------------------------------------

export type ReportAudience = 'company' | 'accountant_client'

/** Como os parâmetros tributários de referência devem ser aplicados na análise. */
export type ModoParametrosReforma = 'padrao_2026' | 'especifico' | 'estrutural'

/** Identidade institucional do escritório contábil (workspace) — usada só na versão do contador. */
export interface EscritorioContabilPerfil {
  id: string
  org_id: string
  nome: string
  razao_social: string | null
  cnpj: string | null
  logo_path: string | null
  logo_atualizado_em: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  site: string | null
  cidade: string | null
  estado: string | null
  contador_responsavel: string | null
  crc: string | null
  cor_principal: string | null
  criado_em: string
  atualizado_em: string
}

/** Parâmetros tributários específicos de um cliente, versionados — só a linha `ativo=true` é a referência vigente. */
export interface RtParametrosCliente {
  id: string
  org_id: string
  empresa_id: string
  versao: number
  aliquota_cbs: number
  aliquota_ibs_total: number
  aliquota_ibs_uf: number | null
  aliquota_ibs_mun: number | null
  cst: string
  cclass_trib: string
  observacao: string | null
  vigencia_inicio: string
  vigencia_fim: string | null
  ativo: boolean
  criado_por: string | null
  criado_por_email: string | null
  criado_em: string
}

/** Trilha de auditoria de cada PDF de Reforma Tributária gerado. */
export interface RtRelatorioGerado {
  id: string
  org_id: string
  empresa_id: string
  tipo_relatorio: ReportAudience
  gerado_por: string | null
  escritorio_nome_snapshot: string | null
  escritorio_logo_path_snapshot: string | null
  escritorio_cor_snapshot: string | null
  modo_parametros: ModoParametrosReforma
  parametros_utilizados: unknown
  observacao: string | null
  versao_parametros: string
  total_documentos: number
  total_itens: number
  hash_arquivo: string
  competencia: string | null
  criado_em: string
}

export interface MembroOrganizacao {
  id: string
  org_id: string
  user_id: string
  papel: 'admin' | 'membro'
  created_at: string
  email?: string
}

export interface ConviteOrganizacao {
  id: string
  org_id: string
  email: string
  papel: 'admin' | 'membro'
  criado_em: string
  organizacao?: { nome: string }
}

export interface Cobranca {
  id: string
  org_id: string
  empresa_id?: string
  descricao: string
  valor?: number
  vencimento: string
  pago_em?: string
  status: 'pendente' | 'pago' | 'atrasado'
  observacao?: string
  created_at: string
  updated_at: string
  empresa?: { id: string; razao_social: string }
}
export type StatusEmpresa = 'Ativo' | 'Inativo' | 'Suspenso'
export type NivelRisco = 'baixo' | 'medio' | 'alto' | 'critico'
export type StatusSessao = 'rascunho' | 'processando' | 'concluido' | 'erro'
export type StatusArquivo = 'aguardando' | 'processando' | 'ok' | 'erro'
export type StatusAlerta = 'aberto' | 'em_analise' | 'resolvido' | 'descartado'

export interface Empresa {
  id: string
  org_id?: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  cpf?: string
  regime?: Regime
  cnae_principal?: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  uf: string
  tipo?: 'Matriz' | 'Filial' | 'Autônoma'
  matriz_id?: string
  status: StatusEmpresa
  situacao_cadastral?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cep?: string
  municipio?: string
  telefone?: string
  email?: string
  created_at: string
  updated_at: string
}

export interface SessaoAnalise {
  id: string
  org_id?: string
  empresa_id: string
  criado_por?: string
  competencia: string
  periodo_inicial?: string
  periodo_final?: string
  status: StatusSessao
  observacoes?: string
  created_at: string
  updated_at: string
  empresa?: Empresa
  _alertas?: { alto: number; medio: number; baixo: number; critico: number }
}

export interface ArquivoSped {
  id: string
  org_id?: string
  sessao_id: string
  empresa_id: string
  nome_arquivo: string
  tipo: 'fiscal' | 'contrib' | 'ecf' | 'efd_reinf'
  subtipo?: 'matriz' | 'filial'
  competencia: string
  periodo_inicial?: string
  periodo_final?: string
  cnpj_declarante?: string
  storage_path?: string
  tamanho_bytes?: number
  total_linhas?: number
  parsed_data?: unknown
  parsed_at?: string
  status: StatusArquivo
  erro_msg?: string
  created_at: string
}

export interface ArquivoXml {
  id: string
  org_id?: string
  sessao_id: string
  empresa_id: string
  competencia?: string
  chave_nfe?: string
  numero_nf?: string
  data_emissao?: string
  emitente_cnpj?: string
  emitente_nome?: string
  destinatario_cnpj?: string
  destinatario_nome?: string
  tipo_operacao?: 'entrada' | 'saida'
  valor_total?: number
  storage_path?: string
  parsed_data?: unknown
  status: StatusArquivo
  created_at: string
}

export interface RegraFiscal {
  id: string
  codigo: string
  categoria: string
  titulo: string
  descricao?: string
  nivel_risco: NivelRisco
  ativo: boolean
  versao: number
  parametros: Record<string, unknown>
  fundamento_legal?: string
  created_at: string
  updated_at: string
}

export interface AlertaFiscal {
  id: string
  org_id?: string
  sessao_id: string
  empresa_id: string
  regra_id?: string
  competencia: string
  categoria: string
  nivel_risco: NivelRisco
  titulo: string
  descricao: string
  detalhe: Record<string, unknown>
  valor_impacto?: number
  status: StatusAlerta
  resolvido_por?: string
  resolvido_em?: string
  observacao_resolucao?: string
  created_at: string
  empresa?: Empresa
  regra?: RegraFiscal
}

export interface ObrigacaoAcessoria {
  id: string
  org_id?: string
  empresa_id: string
  competencia: string
  tipo: string
  prazo_legal?: string
  data_entrega?: string
  status: 'pendente' | 'entregue' | 'atrasada' | 'sem_movimento' | 'nao_obrigado'
  observacao?: string
  arquivo_sped_id?: string
  created_at: string
  updated_at: string
  empresa?: Empresa
}

export interface SimulacaoRegime {
  regime: Regime
  aliquota_efetiva: number
  valor_total_impostos: number
  detalhamento: Array<{
    imposto: string
    base_calculo: number
    aliquota: number
    valor: number
  }>
}

export interface PlacejamentoTributario {
  id: string
  org_id?: string
  empresa_id: string
  criado_por?: string
  competencia_base: string
  receita_bruta_anual: number
  custo_mercadorias?: number
  folha_pagamento?: number
  outras_despesas?: number
  regime_atual?: string
  resultado_simples?: SimulacaoRegime
  resultado_presumido?: SimulacaoRegime
  resultado_real?: SimulacaoRegime
  regime_recomendado?: string
  economia_estimada?: number
  observacoes?: string
  created_at: string
  empresa?: Empresa
}

// ---------------------------------------------------------------
// Simples Nacional — PGDAS-D
// ---------------------------------------------------------------

export interface SnTributo {
  nome: string  // 'IRPJ' | 'CSLL' | 'COFINS' | 'PIS/PASEP' | 'INSS/CPP' | 'ICMS'
  valor: number
}

export interface SnHistoricoMes {
  mes: string    // "01/2025"
  receita: number
}

export interface SnAtividade {
  nome: string
  anexo: string
  tributos: SnTributo[]
  total: number
}

export interface SnEstabelecimento {
  cnpj: string
  receita_bruta_mes: number
  imposto_devido: number
}

export interface SnParsedData {
  cnpj: string
  razao_social: string
  periodo: string
  tipo_declaracao: 'Original' | 'Retificadora'
  atividade: string
  anexo: string
  limite_receita: number
  receita_bruta_mes: number
  receita_bruta_acumulada_12m: number
  receita_bruta_ano: number
  tributos: SnTributo[]
  historico_mensal: SnHistoricoMes[]
  total_devido: number
  numero_recibo: string
  atividades?: SnAtividade[]
  estabelecimentos?: SnEstabelecimento[]
}

export interface SnDeclaracao {
  id: string
  org_id?: string
  empresa_id: string
  competencia: string
  periodo_inicial?: string
  periodo_final?: string
  receita_bruta_mes?: number
  receita_bruta_acumulada_12m?: number
  receita_bruta_ano?: number
  valor_total_devido?: number
  numero_recibo?: string
  nome_arquivo?: string
  parsed_data?: SnParsedData
  created_at: string
}

// ---------------------------------------------------------------
// Base Fiscal Central — documentos e itens
// ---------------------------------------------------------------

export type TipoDocumento = 'nfe' | 'nfce' | 'nfse' | 'cte' | 'pgdas' | 'sped' | 'outro'
export type OrigemDocumento = 'xml_nfe' | 'xml_nfce' | 'xml_nfse' | 'txt_nfse' | 'excel_nfse' | 'pdf_pgdas' | 'sped_txt' | 'manual' | 'outro'
export type TipoMovimento = 'saida' | 'entrada' | 'devolucao_venda' | 'devolucao_compra' | 'remessa' | 'retorno' | 'transferencia' | 'outros'
export type ImpactoReceita = 'soma_receita' | 'reduz_receita' | 'sem_impacto' | 'pendente_revisao'
export type OrigemDevolucao = 'emitida_propria' | 'emitida_terceiro' | 'nao_aplicavel'
export type StatusDocumentoFiscal = 'ok' | 'cancelada' | 'pendente' | 'erro'
export type ClassificacaoItem = 'revenda' | 'insumo' | 'uso_consumo' | 'imobilizado' | 'servico' | 'outros'
export type NaturezaReceitaSimples = 'tributada' | 'st' | 'monofasica' | 'isenta' | 'exportacao' | 'devolucao' | 'nao_receita' | 'pendente'

export interface DocumentoFiscal {
  id: string
  org_id: string
  empresa_id: string
  sessao_id?: string
  tipo_documento: TipoDocumento
  origem: OrigemDocumento
  chave_acesso?: string
  numero?: string
  serie?: string
  modelo?: string
  data_emissao?: string
  data_competencia?: string
  emitente_cnpj?: string
  emitente_nome?: string
  destinatario_cnpj?: string
  destinatario_nome?: string
  valor_total: number
  valor_produtos: number
  valor_servicos: number
  valor_desconto: number
  valor_frete: number
  valor_icms: number
  valor_pis: number
  valor_cofins: number
  valor_st: number
  valor_ipi: number
  tipo_movimento: TipoMovimento
  impacto_receita: ImpactoReceita
  origem_devolucao: OrigemDevolucao
  ref_chave_acesso?: string
  status: StatusDocumentoFiscal
  cancelada_em?: string
  nome_arquivo?: string
  hash_arquivo?: string
  parsed_data?: unknown
  created_at: string
  updated_at: string
}

export interface DocumentoFiscalItem {
  id: string
  org_id: string
  empresa_id: string
  documento_id: string
  item_numero?: number
  codigo_produto?: string
  descricao?: string
  ncm?: string
  cest?: string
  cfop?: string
  unidade?: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  valor_desconto: number
  valor_frete: number
  cst_icms?: string
  csosn?: string
  valor_bc_icms: number
  aliquota_icms: number
  valor_icms: number
  valor_bc_st: number
  valor_st: number
  cst_pis?: string
  valor_bc_pis: number
  aliquota_pis: number
  valor_pis: number
  cst_cofins?: string
  valor_bc_cofins: number
  aliquota_cofins: number
  valor_cofins: number
  cst_ibs_cbs?: string
  cclass_trib?: string
  valor_bc_ibs_cbs?: number
  aliquota_ibs_uf?: number
  valor_ibs_uf?: number
  aliquota_ibs_mun?: number
  valor_ibs_mun?: number
  valor_ibs?: number
  aliquota_cbs?: number
  valor_cbs?: number
  valor_ipi: number
  classificacao: ClassificacaoItem
  natureza_receita_simples: NaturezaReceitaSimples
  tipo_movimento: TipoMovimento
  impacto_receita: ImpactoReceita
  anexo_sugerido?: 'I' | 'II' | 'III' | 'IV' | 'V'
  regra_aplicada?: string
  classificacao_manual: boolean
  created_at: string
}

export type DocumentoFiscalInput = Omit<DocumentoFiscal, 'id' | 'org_id' | 'created_at' | 'updated_at'>
export type DocumentoFiscalItemInput = Omit<DocumentoFiscalItem, 'id' | 'org_id' | 'created_at'>

// ---------------------------------------------------------------
// Simples Nacional — receitas mensais e apuração
// ---------------------------------------------------------------

export type OrigemRbt12 = 'pgdas' | 'xml' | 'manual' | 'estimado'

export interface SnReceitaMensal {
  id: string
  org_id: string
  empresa_id: string
  competencia: string
  receita_bruta_mes: number
  origem: 'pgdas' | 'xml' | 'manual' | 'importacao_excel'
  created_at: string
  updated_at: string
}

export type SnModoServico = 'anexo_fixo' | 'fator_r'

export interface SnConfigServicosEmpresa {
  id: string
  org_id: string
  empresa_id: string
  modo_servico: SnModoServico
  anexo_fixo?: 'III' | 'IV' | 'V'
  atividade_descricao?: string
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface SnConfigServicoAtividade {
  id: string
  org_id: string
  empresa_id: string
  codigo_servico: string
  descricao_servico?: string
  modo_tributacao: 'anexo_fixo' | 'fator_r'
  anexo_fixo?: 'III' | 'IV' | 'V'
  observacoes?: string
  created_at: string
  updated_at: string
}

export interface SnFolhaMensal {
  id: string
  org_id: string
  empresa_id: string
  competencia: string
  valor_folha: number
  origem: 'manual' | 'importacao_excel'
  created_at: string
  updated_at: string
}

export interface SnApuracao {
  id: string
  org_id: string
  empresa_id: string
  competencia: string
  rbt12_utilizado?: number
  origem_rbt12?: OrigemRbt12
  receita_xml_total: number
  receita_devolucoes: number
  receita_liquida: number
  receita_st: number
  receita_pgdas_total?: number
  valor_simples_calculado: number
  valor_pgdas?: number
  diferenca_valor?: number
  diferenca_percentual?: number
  status: 'ok' | 'divergente' | 'pendente_revisao'
  detalhes?: unknown
  created_at: string
  updated_at: string
}

export interface SnApuracaoReceita {
  id: string
  org_id: string
  empresa_id: string
  apuracao_id: string
  competencia: string
  anexo?: 'I' | 'II' | 'III' | 'IV' | 'V'
  tipo_receita?: string
  valor_receita: number
  valor_base_tributavel: number
  aliquota_nominal: number
  parcela_deduzir: number
  aliquota_efetiva: number
  valor_das: number
  detalhes?: unknown
  created_at: string
}
