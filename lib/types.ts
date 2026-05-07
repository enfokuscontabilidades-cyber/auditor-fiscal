export type Regime = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'MEI' | 'CPF'
export type StatusEmpresa = 'Ativo' | 'Inativo' | 'Suspenso'
export type NivelRisco = 'baixo' | 'medio' | 'alto' | 'critico'
export type StatusSessao = 'rascunho' | 'processando' | 'concluido' | 'erro'
export type StatusArquivo = 'aguardando' | 'processando' | 'ok' | 'erro'
export type StatusAlerta = 'aberto' | 'em_analise' | 'resolvido' | 'descartado'

export interface Empresa {
  id: string
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
  created_at: string
  updated_at: string
}

export interface SessaoAnalise {
  id: string
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
  sessao_id: string
  empresa_id: string
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
