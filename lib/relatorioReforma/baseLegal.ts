// Base legal e técnica versionada da Reforma Tributária (IBS/CBS).
//
// Fonte única de verdade para qualquer referência legal citada no relatório
// de diagnóstico. Cada entrada representa uma NORMA (não um artigo
// específico) — o sistema não tem meios de validar automaticamente qual
// artigo, parágrafo ou inciso se aplica a cada divergência encontrada, então
// não inventamos essa granularidade aqui. Quando uma divergência não tiver
// uma referência segura, o gerador do relatório deve usar o texto de
// fallback definido em `REFERENCIA_NAO_DETERMINADA` — nunca forçar uma
// citação genérica.
//
// Para atualizar a base legal: adicionar uma nova entrada (nunca editar o
// resumo de uma entrada já publicada em relatórios — ver `status`), subir
// `VERSAO_BASE_LEGAL` e atualizar `BASE_LEGAL_ATUALIZADA_EM`. Relatórios já
// gerados guardam a versão usada no momento da geração e não mudam
// retroativamente (imutabilidade — ver lib/relatorioReforma/tipos.ts).

export type TipoNorma = 'emenda_constitucional' | 'lei_complementar' | 'resolucao' | 'ato_conjunto' | 'nota_tecnica' | 'manual_tecnico' | 'esquema_xml'
export type StatusNorma = 'ativo' | 'substituido' | 'revogado'
export type DocumentoFiscalRelacionado = 'NF-e' | 'NFC-e' | 'NFS-e' | 'geral'
export type RegimeRelacionado = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'MEI' | 'geral'

export interface ReferenciaLegal {
  codigo: string
  tipo: TipoNorma
  numero: string
  titulo: string
  orgaoEmissor: string
  dataPublicacao: string
  dataVigencia: string | null
  /** Intencionalmente ausente na maioria das entradas — ver nota no topo do arquivo. */
  artigoOuRegra: string | null
  resumo: string
  /** Versão condensada (uma linha) do resumo, para uso no relatório compacto de 4 páginas. */
  resumoCurto: string
  urlOficial: string | null
  documentoFiscalRelacionado: DocumentoFiscalRelacionado
  tipoOperacaoRelacionado: string
  regimeRelacionado: RegimeRelacionado
  versao: string
  dataUltimaRevisao: string
  status: StatusNorma
}

export const VERSAO_BASE_LEGAL = '2026.1'
export const BASE_LEGAL_ATUALIZADA_EM = '2026-07-12'

export const BASE_LEGAL: ReferenciaLegal[] = [
  {
    codigo: 'EC-132-2023',
    tipo: 'emenda_constitucional',
    numero: 'Emenda Constitucional nº 132/2023',
    titulo: 'Reforma Tributária sobre o consumo',
    orgaoEmissor: 'Congresso Nacional',
    dataPublicacao: '2023-12-20',
    dataVigencia: '2023-12-20',
    artigoOuRegra: null,
    resumo:
      'Institui a reforma tributária sobre o consumo, criando o IBS (Imposto sobre Bens e Serviços, de competência ' +
      'estadual e municipal) e a CBS (Contribuição sobre Bens e Serviços, de competência federal), em substituição ' +
      'gradual a tributos como ICMS, ISS, PIS e Cofins.',
    resumoCurto: 'Institui o IBS e a CBS em substituição gradual a ICMS, ISS, PIS e Cofins.',
    urlOficial: 'https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm',
    documentoFiscalRelacionado: 'geral',
    tipoOperacaoRelacionado: 'Todas as operações com bens e serviços',
    regimeRelacionado: 'geral',
    versao: '1',
    dataUltimaRevisao: '2026-07-12',
    status: 'ativo',
  },
  {
    codigo: 'LC-214-2025',
    tipo: 'lei_complementar',
    numero: 'Lei Complementar nº 214/2025',
    titulo: 'Regulamentação da Reforma Tributária (IBS, CBS e Imposto Seletivo)',
    orgaoEmissor: 'Congresso Nacional',
    dataPublicacao: '2025-01-16',
    dataVigencia: '2026-01-01',
    artigoOuRegra: null,
    resumo:
      'Regulamenta o IBS e a CBS instituídos pela Emenda Constitucional nº 132/2023: fatos geradores, base de ' +
      'cálculo, alíquotas, não cumulatividade, regimes específicos e obrigações acessórias, incluindo os requisitos ' +
      'técnicos que os documentos fiscais eletrônicos passam a precisar atender durante o período de transição.',
    resumoCurto: 'Regulamenta fatos geradores, bases, alíquotas e requisitos técnicos do IBS/CBS nos documentos fiscais.',
    urlOficial: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm',
    documentoFiscalRelacionado: 'geral',
    tipoOperacaoRelacionado: 'Todas as operações com bens e serviços',
    regimeRelacionado: 'geral',
    versao: '1',
    dataUltimaRevisao: '2026-07-12',
    status: 'ativo',
  },
  {
    codigo: 'LC-227-2026',
    tipo: 'lei_complementar',
    numero: 'Lei Complementar nº 227/2026',
    titulo: 'Ajustes complementares à regulamentação da Reforma Tributária',
    orgaoEmissor: 'Congresso Nacional',
    dataPublicacao: '2026-01-01',
    dataVigencia: null,
    artigoOuRegra: null,
    resumo:
      'Referência normativa citada como parte do arcabouço complementar da Reforma Tributária. O sistema não possui, ' +
      'até o momento, o texto integral validado internamente para extrair dispositivos específicos — cite apenas o ' +
      'número da norma, sem atribuir artigos ou regras a ela.',
    resumoCurto: 'Ajustes complementares à regulamentação da Reforma Tributária (texto integral ainda não validado internamente).',
    urlOficial: null,
    documentoFiscalRelacionado: 'geral',
    tipoOperacaoRelacionado: 'A confirmar',
    regimeRelacionado: 'geral',
    versao: '1',
    dataUltimaRevisao: '2026-07-12',
    status: 'ativo',
  },
  {
    codigo: 'BASE-TECNICA-NFE-IBSCBS',
    tipo: 'esquema_xml',
    numero: 'Leiaute NF-e / NFC-e — grupo IBSCBS',
    titulo: 'Estrutura técnica dos grupos de tributação do IBS e da CBS no XML da NF-e',
    orgaoEmissor: 'Encontro Nacional de Coordenadores e Administradores Tributários Estaduais (ENCAT)',
    dataPublicacao: '2025-01-01',
    dataVigencia: null,
    artigoOuRegra: null,
    resumo:
      'Define os campos técnicos (grupo IBSCBS, CST, cClassTrib, bases, alíquotas e valores de IBS e CBS) que devem ' +
      'ser preenchidos no XML da NF-e e da NFC-e durante o período de testes e de transição da Reforma Tributária. ' +
      'Referência de natureza técnica de leiaute, não de legislação tributária.',
    resumoCurto: 'Define os campos técnicos do grupo IBSCBS (CST, cClassTrib, bases, alíquotas e valores) no XML da NF-e/NFC-e.',
    urlOficial: null,
    documentoFiscalRelacionado: 'NF-e',
    tipoOperacaoRelacionado: 'Emissão de NF-e e NFC-e',
    regimeRelacionado: 'geral',
    versao: '1',
    dataUltimaRevisao: '2026-07-12',
    status: 'ativo',
  },
]

export const REFERENCIA_NAO_DETERMINADA =
  'Referência específica não determinada automaticamente. Recomenda-se validação técnica complementar.'

export function buscarReferenciaLegal(codigo: string): ReferenciaLegal | null {
  return BASE_LEGAL.find(r => r.codigo === codigo) ?? null
}

export function referenciasAtivas(): ReferenciaLegal[] {
  return BASE_LEGAL.filter(r => r.status === 'ativo')
}
