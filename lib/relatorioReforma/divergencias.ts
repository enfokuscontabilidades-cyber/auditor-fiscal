// Classificação e consolidação das divergências do diagnóstico de IBS/CBS.
//
// Escopo estritamente limitado a IBS e CBS: campos gerais do XML (chave de
// acesso, data de emissão, número, série, CNPJ, protocolo, assinatura,
// informações complementares, ICMS/IPI/PIS/Cofins etc.) NUNCA geram
// divergência aqui — servem apenas para identificar o documento. Falhas de
// leitura do arquivo (XML malformado, não suportado etc.) também não entram
// nesta lista de divergências de IBS/CBS — ver `listarArquivosComFalha`.
//
// Fonte dos apontamentos: exclusivamente os alertas já produzidos pelo motor
// de regras existente (lib/fiscal/analiseReformaTributaria.ts). Este módulo
// não cria nenhuma regra de validação nova — apenas dá a cada alerta já
// existente uma gravidade, uma explicação em linguagem simples, um impacto
// possível, uma orientação prática e um responsável sugerido.
//
// IMPORTANTE — não confundir métricas: cada REGRA (ex.: "grupo IBSCBS
// ausente") pode afetar VÁRIOS documentos, e cada documento pode ter VÁRIOS
// itens afetados. "totalOcorrencias" (documentos × itens, ou 1 por documento
// para regras no nível do documento) é diferente de "totalDocumentosAfetados"
// (quantos XMLs distintos têm o problema), que por sua vez é diferente de
// "totalItensAfetados" (quantos itens, somados entre todos os documentos).
// Um agrupamento por regra NUNCA deve descartar os demais documentos
// afetados — todos ficam listados em `documentosAfetados`.

import type { ResultadoArquivoDiagnostico, ItemResultadoDiagnostico } from './tipos'
import { REFERENCIA_NAO_DETERMINADA } from './baseLegal'

export type GravidadeDivergencia = 'critica' | 'alta' | 'media' | 'baixa' | 'informativa'

export const LABEL_GRAVIDADE: Record<GravidadeDivergencia, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
  informativa: 'Informativa',
}

export const ORDEM_GRAVIDADE: Record<GravidadeDivergencia, number> = {
  critica: 0, alta: 1, media: 2, baixa: 3, informativa: 4,
}

export type ResponsavelSugerido =
  | 'Empresa' | 'Contador' | 'Departamento fiscal' | 'Fornecedor do sistema emissor' | 'Desenvolvedor' | 'Consultor tributário'

/** Um documento (XML) afetado por uma regra, com todos os itens afetados NESSE documento. */
export interface DocumentoAfetado {
  arquivoId: string
  arquivo: string
  documento: string
  numeroDocumento: string
  serieDocumento: string
  tipoDocumento: string
  /** Números dos itens afetados neste documento (vazio quando a regra é do documento como um todo, ex.: totalizador). */
  itensAfetados: string[]
  valorEncontrado: string
}

export interface DivergenciaConsolidada {
  numero: number
  ruleCode: string
  campo: string
  caminhoXml: string
  gravidade: GravidadeDivergencia
  valorEsperado: string
  explicacao: string
  impacto: string
  orientacao: string
  responsavelSugerido: ResponsavelSugerido
  baseLegalCodigo: string | null
  statusValidacao: string
  /** Todos os documentos afetados por esta regra — nunca só o primeiro. */
  documentosAfetados: DocumentoAfetado[]
  totalDocumentosAfetados: number
  totalItensAfetados: number
  totalOcorrencias: number
}

/** Arquivo que não pôde ser lido — informativo, não é uma divergência de IBS/CBS e não afeta a pontuação. */
export interface ArquivoComFalha {
  arquivo: string
  mensagem: string
}

interface DefinicaoTipo {
  ruleCode: string
  campo: string
  caminhoXml: string
  gravidade: GravidadeDivergencia
  explicacao: string
  impacto: string
  orientacao: string
  responsavelSugerido: ResponsavelSugerido
  baseLegalCodigo: string | null
  statusValidacao: string
}

const DEF_GRUPO_AUSENTE: DefinicaoTipo = {
  ruleCode: 'IBSCBS_GROUP_MISSING',
  campo: 'Grupo IBSCBS', caminhoXml: 'det/imposto/IBSCBS', gravidade: 'critica',
  explicacao: 'O item não possui o grupo de tributação do IBS e da CBS no XML.',
  impacto: 'Se a operação já exigir o preenchimento do IBS/CBS neste período, o documento pode não estar em conformidade com o leiaute vigente.',
  orientacao: 'Validar a configuração tributária no sistema emissor e confirmar se estes itens já deveriam trazer o grupo IBSCBS na data de emissão.',
  responsavelSugerido: 'Fornecedor do sistema emissor', baseLegalCodigo: 'LC-214-2025',
  statusValidacao: 'A aplicabilidade depende da natureza da operação e da data de emissão',
}

const DEF_CST_AUSENTE: DefinicaoTipo = {
  ruleCode: 'IBSCBS_CST_MISSING',
  campo: 'CST do IBS/CBS', caminhoXml: 'det/imposto/IBSCBS/gIBSCBS/CST', gravidade: 'alta',
  explicacao: 'O item possui o grupo IBSCBS, mas o campo CST não foi encontrado.',
  impacto: 'Pode indicar configuração tributária incompleta no cadastro do produto ou serviço.',
  orientacao: 'Revisar o cadastro do produto ou serviço no sistema emissor e confirmar o CST aplicável.',
  responsavelSugerido: 'Contador', baseLegalCodigo: 'BASE-TECNICA-NFE-IBSCBS',
  statusValidacao: 'Campo não encontrado',
}

const DEF_CCLASS_AUSENTE: DefinicaoTipo = {
  ruleCode: 'IBSCBS_CCLASSTRIB_MISSING',
  campo: 'cClassTrib', caminhoXml: 'det/imposto/IBSCBS/gIBSCBS/cClassTrib', gravidade: 'alta',
  explicacao: 'O item possui o grupo IBSCBS, mas o campo cClassTrib não foi encontrado.',
  impacto: 'Pode indicar que a operação não foi classificada corretamente para fins de IBS/CBS.',
  orientacao: 'Revisar o cadastro do produto ou serviço no sistema emissor e confirmar o cClassTrib aplicável.',
  responsavelSugerido: 'Contador', baseLegalCodigo: 'BASE-TECNICA-NFE-IBSCBS',
  statusValidacao: 'Campo não encontrado',
}

const DEF_ALIQUOTA_IBS: DefinicaoTipo = {
  ruleCode: 'IBS_RATE_MISMATCH',
  campo: 'Alíquota do IBS (UF)', caminhoXml: 'det/imposto/IBSCBS/gIBSCBS/gIBSUF/pIBSUF', gravidade: 'media',
  explicacao: 'A alíquota de IBS (UF) informada no item é diferente do percentual de teste vigente.',
  impacto: 'Pode gerar recolhimento em valor diferente do esperado durante o período de testes.',
  orientacao: 'Confirmar com o sistema emissor o percentual de teste vigente e ajustar a configuração tributária.',
  responsavelSugerido: 'Fornecedor do sistema emissor', baseLegalCodigo: 'LC-214-2025',
  statusValidacao: 'Divergência tributária',
}

const DEF_ALIQUOTA_CBS: DefinicaoTipo = {
  ruleCode: 'CBS_RATE_MISMATCH',
  campo: 'Alíquota da CBS', caminhoXml: 'det/imposto/IBSCBS/gIBSCBS/gCBS/pCBS', gravidade: 'media',
  explicacao: 'A alíquota de CBS informada no item é diferente do percentual de teste vigente.',
  impacto: 'Pode gerar recolhimento em valor diferente do esperado durante o período de testes.',
  orientacao: 'Confirmar com o sistema emissor o percentual de teste vigente e ajustar a configuração tributária.',
  responsavelSugerido: 'Fornecedor do sistema emissor', baseLegalCodigo: 'LC-214-2025',
  statusValidacao: 'Divergência tributária',
}

const DEF_VALOR_IBS: DefinicaoTipo = {
  ruleCode: 'IBS_VALUE_MISMATCH',
  campo: 'Valor do IBS (UF)', caminhoXml: 'det/imposto/IBSCBS/gIBSCBS/gIBSUF/vIBSUF', gravidade: 'alta',
  explicacao: 'O valor de IBS (UF) informado no item não corresponde ao cálculo esperado (base de cálculo x alíquota).',
  impacto: 'Pode indicar erro de cálculo no sistema emissor, com efeito direto no valor recolhido.',
  orientacao: 'Validar a base de cálculo e a fórmula de apuração do IBS configuradas no sistema emissor.',
  responsavelSugerido: 'Fornecedor do sistema emissor', baseLegalCodigo: 'LC-214-2025',
  statusValidacao: 'Divergência tributária',
}

const DEF_VALOR_CBS: DefinicaoTipo = {
  ruleCode: 'CBS_VALUE_MISMATCH',
  campo: 'Valor da CBS', caminhoXml: 'det/imposto/IBSCBS/gIBSCBS/gCBS/vCBS', gravidade: 'alta',
  explicacao: 'O valor de CBS informado no item não corresponde ao cálculo esperado (base de cálculo x alíquota).',
  impacto: 'Pode indicar erro de cálculo no sistema emissor, com efeito direto no valor recolhido.',
  orientacao: 'Validar a base de cálculo e a fórmula de apuração da CBS configuradas no sistema emissor.',
  responsavelSugerido: 'Fornecedor do sistema emissor', baseLegalCodigo: 'LC-214-2025',
  statusValidacao: 'Divergência tributária',
}

const DEF_TOTALIZADOR_IBS: DefinicaoTipo = {
  ruleCode: 'IBS_TOTAL_MISMATCH',
  campo: 'Totalizador de IBS', caminhoXml: 'total/IBSCBSTot/vIBS', gravidade: 'alta',
  explicacao: 'A soma do IBS dos itens não confere com o totalizador de IBS informado na nota.',
  impacto: 'Pode indicar erro de somatória no sistema emissor, com efeito direto no valor total recolhido.',
  orientacao: 'Revisar os cálculos e a consolidação dos valores de IBS no sistema emissor.',
  responsavelSugerido: 'Fornecedor do sistema emissor', baseLegalCodigo: 'BASE-TECNICA-NFE-IBSCBS',
  statusValidacao: 'Divergência de consistência',
}

const DEF_TOTALIZADOR_CBS: DefinicaoTipo = {
  ruleCode: 'CBS_TOTAL_MISMATCH',
  campo: 'Totalizador de CBS', caminhoXml: 'total/IBSCBSTot/vCBS', gravidade: 'alta',
  explicacao: 'A soma da CBS dos itens não confere com o totalizador de CBS informado na nota.',
  impacto: 'Pode indicar erro de somatória no sistema emissor, com efeito direto no valor total recolhido.',
  orientacao: 'Revisar os cálculos e a consolidação dos valores de CBS no sistema emissor.',
  responsavelSugerido: 'Fornecedor do sistema emissor', baseLegalCodigo: 'BASE-TECNICA-NFE-IBSCBS',
  statusValidacao: 'Divergência de consistência',
}

interface OcorrenciaBruta {
  definicao: DefinicaoTipo
  chaveAgrupamento: string
  arquivoId: string
  arquivo: string
  documento: string
  numeroDocumento: string
  serieDocumento: string
  tipoDocumento: string
  itemNumero?: string
  valorEncontrado: string
  valorEsperado: string
}

function nomeDocumento(resultado: ResultadoArquivoDiagnostico): string {
  return `${resultado.tipoDocumento || 'NF-e'} nº ${resultado.numero || '-'} / série ${resultado.serie || '-'}`
}

function ocorrenciasDoItem(resultado: ResultadoArquivoDiagnostico, item: ItemResultadoDiagnostico): OcorrenciaBruta[] {
  const ocorrencias: OcorrenciaBruta[] = []
  const base = {
    arquivoId: resultado.id, arquivo: resultado.arquivo, documento: nomeDocumento(resultado),
    numeroDocumento: resultado.numero || '-', serieDocumento: resultado.serie || '-', tipoDocumento: resultado.tipoDocumento || 'NF-e',
  }

  if (!item.destacado) {
    ocorrencias.push({
      definicao: DEF_GRUPO_AUSENTE, chaveAgrupamento: 'grupo_ausente', ...base, itemNumero: item.itemNumero,
      valorEncontrado: 'Grupo IBSCBS não encontrado', valorEsperado: 'Grupo IBSCBS presente',
    })
    return ocorrencias
  }

  if (item.alertas.includes('CST IBS/CBS ausente')) {
    ocorrencias.push({
      definicao: DEF_CST_AUSENTE, chaveAgrupamento: 'cst_ausente', ...base, itemNumero: item.itemNumero,
      valorEncontrado: 'Não informado', valorEsperado: 'CST do IBS/CBS informado',
    })
  }
  if (item.alertas.includes('cClassTrib ausente')) {
    ocorrencias.push({
      definicao: DEF_CCLASS_AUSENTE, chaveAgrupamento: 'cclass_ausente', ...base, itemNumero: item.itemNumero,
      valorEncontrado: 'Não informado', valorEsperado: 'cClassTrib informado',
    })
  }

  const alertaAliquotaIbs = item.alertas.find(a => a.startsWith('Alíquota IBS UF'))
  if (alertaAliquotaIbs) {
    ocorrencias.push({
      definicao: DEF_ALIQUOTA_IBS, chaveAgrupamento: 'aliquota_ibs', ...base, itemNumero: item.itemNumero,
      valorEncontrado: `${item.aliquotaIbsUf}%`, valorEsperado: alertaAliquotaIbs,
    })
  }
  const alertaAliquotaCbs = item.alertas.find(a => a.startsWith('Alíquota CBS'))
  if (alertaAliquotaCbs) {
    ocorrencias.push({
      definicao: DEF_ALIQUOTA_CBS, chaveAgrupamento: 'aliquota_cbs', ...base, itemNumero: item.itemNumero,
      valorEncontrado: `${item.aliquotaCbs}%`, valorEsperado: alertaAliquotaCbs,
    })
  }
  const alertaValorIbs = item.alertas.find(a => a.startsWith('IBS UF esperado'))
  if (alertaValorIbs) {
    ocorrencias.push({
      definicao: DEF_VALOR_IBS, chaveAgrupamento: 'valor_ibs', ...base, itemNumero: item.itemNumero,
      valorEncontrado: `R$ ${item.valorIbsUf.toFixed(2)}`, valorEsperado: alertaValorIbs.replace('IBS UF esperado: ', ''),
    })
  }
  const alertaValorCbs = item.alertas.find(a => a.startsWith('CBS esperado'))
  if (alertaValorCbs) {
    ocorrencias.push({
      definicao: DEF_VALOR_CBS, chaveAgrupamento: 'valor_cbs', ...base, itemNumero: item.itemNumero,
      valorEncontrado: `R$ ${item.valorCbs.toFixed(2)}`, valorEsperado: alertaValorCbs.replace('CBS esperado: ', ''),
    })
  }

  return ocorrencias
}

const TOLERANCIA_TOTALIZADOR = 0.05

export function montarDivergencias(resultados: ResultadoArquivoDiagnostico[]): DivergenciaConsolidada[] {
  const brutas: OcorrenciaBruta[] = []

  for (const resultado of resultados) {
    if (!resultado.ok) continue // falha de leitura não é divergência de IBS/CBS — ver listarArquivosComFalha

    const base = {
      arquivoId: resultado.id, arquivo: resultado.arquivo, documento: nomeDocumento(resultado),
      numeroDocumento: resultado.numero || '-', serieDocumento: resultado.serie || '-', tipoDocumento: resultado.tipoDocumento || 'NF-e',
    }

    // Cada item afetado do documento vira UMA ocorrência bruta — nada aqui
    // sobrescreve ou descarta ocorrências de outros itens/documentos: tudo é
    // empilhado em `brutas` e só agrupado por regra mais abaixo.
    for (const item of resultado.itens || []) {
      brutas.push(...ocorrenciasDoItem(resultado, item))
    }

    const itens = resultado.itens || []
    if (resultado.totalizadorIbs != null) {
      const somaIbs = itens.reduce((acc, i) => acc + i.valorIbs, 0)
      if (Math.abs(resultado.totalizadorIbs - somaIbs) > TOLERANCIA_TOTALIZADOR) {
        brutas.push({
          definicao: DEF_TOTALIZADOR_IBS, chaveAgrupamento: 'totalizador_ibs', ...base,
          valorEncontrado: `Soma dos itens: R$ ${somaIbs.toFixed(2)}`, valorEsperado: `Totalizador da nota: R$ ${resultado.totalizadorIbs.toFixed(2)}`,
        })
      }
    }
    if (resultado.totalizadorCbs != null) {
      const somaCbs = itens.reduce((acc, i) => acc + i.valorCbs, 0)
      if (Math.abs(resultado.totalizadorCbs - somaCbs) > TOLERANCIA_TOTALIZADOR) {
        brutas.push({
          definicao: DEF_TOTALIZADOR_CBS, chaveAgrupamento: 'totalizador_cbs', ...base,
          valorEncontrado: `Soma dos itens: R$ ${somaCbs.toFixed(2)}`, valorEsperado: `Totalizador da nota: R$ ${resultado.totalizadorCbs.toFixed(2)}`,
        })
      }
    }
  }

  // Passo 1 — agrupar por REGRA (chaveAgrupamento). Cada regra acumula TODAS
  // as ocorrências brutas que a disparam, de todos os documentos.
  const gruposPorRegra = new Map<string, OcorrenciaBruta[]>()
  for (const ocorrencia of brutas) {
    const lista = gruposPorRegra.get(ocorrencia.chaveAgrupamento) || []
    lista.push(ocorrencia)
    gruposPorRegra.set(ocorrencia.chaveAgrupamento, lista)
  }

  // Para valores calculados (IBS/CBS esperado), o "esperado" varia por item —
  // o cabeçalho consolidado usa um texto genérico e o valor específico fica
  // em cada ocorrência. Para os demais tipos, o esperado é o mesmo em todas
  // as ocorrências do grupo, então reaproveitamos o da primeira.
  const VALOR_ESPERADO_GENERICO: Record<string, string> = {
    valor_ibs: 'Valor calculado a partir da base de cálculo × alíquota vigente',
    valor_cbs: 'Valor calculado a partir da base de cálculo × alíquota vigente',
  }

  const consolidadas: DivergenciaConsolidada[] = Array.from(gruposPorRegra.entries()).map(([chave, listaDaRegra]) => {
    const { definicao } = listaDaRegra[0]

    // Passo 2 — dentro de cada regra, agrupar por DOCUMENTO (arquivoId), sem
    // descartar nenhum: cada documento mantém a lista completa dos seus
    // próprios itens afetados.
    const porDocumento = new Map<string, OcorrenciaBruta[]>()
    for (const ocorrencia of listaDaRegra) {
      const lista = porDocumento.get(ocorrencia.arquivoId) || []
      lista.push(ocorrencia)
      porDocumento.set(ocorrencia.arquivoId, lista)
    }

    const documentosAfetados: DocumentoAfetado[] = Array.from(porDocumento.values()).map(ocorrenciasDoDoc => ({
      arquivoId: ocorrenciasDoDoc[0].arquivoId,
      arquivo: ocorrenciasDoDoc[0].arquivo,
      documento: ocorrenciasDoDoc[0].documento,
      numeroDocumento: ocorrenciasDoDoc[0].numeroDocumento,
      serieDocumento: ocorrenciasDoDoc[0].serieDocumento,
      tipoDocumento: ocorrenciasDoDoc[0].tipoDocumento,
      itensAfetados: ocorrenciasDoDoc.map(o => o.itemNumero).filter((n): n is string => n != null),
      valorEncontrado: ocorrenciasDoDoc[0].valorEncontrado,
    }))

    const totalItensAfetados = listaDaRegra.filter(o => o.itemNumero != null).length

    return {
      numero: 0,
      ruleCode: definicao.ruleCode,
      campo: definicao.campo,
      caminhoXml: definicao.caminhoXml,
      gravidade: definicao.gravidade,
      valorEsperado: VALOR_ESPERADO_GENERICO[chave] || listaDaRegra[0].valorEsperado,
      explicacao: definicao.explicacao,
      impacto: definicao.impacto,
      orientacao: definicao.orientacao,
      responsavelSugerido: definicao.responsavelSugerido,
      baseLegalCodigo: definicao.baseLegalCodigo,
      statusValidacao: definicao.statusValidacao,
      documentosAfetados,
      totalDocumentosAfetados: documentosAfetados.length,
      totalItensAfetados: totalItensAfetados || documentosAfetados.length,
      totalOcorrencias: listaDaRegra.length,
    }
  })

  consolidadas.sort((a, b) =>
    ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade] || b.totalDocumentosAfetados - a.totalDocumentosAfetados,
  )
  consolidadas.forEach((d, i) => { d.numero = i + 1 })

  return consolidadas
}

/**
 * Arquivos que não puderam ser lidos — apresentados de forma informativa
 * (identificação do documento), nunca como divergência de IBS/CBS. Não afeta
 * pontuação, orientação, plano de ação ou conclusão.
 */
export function listarArquivosComFalha(resultados: ResultadoArquivoDiagnostico[]): ArquivoComFalha[] {
  return resultados
    .filter(r => !r.ok && r.motivoFalha !== 'duplicado')
    .map(r => ({ arquivo: r.arquivo, mensagem: r.mensagemFalha || 'Não foi possível ler o arquivo.' }))
}

export function referenciaLegalOuFallback(codigo: string | null): string {
  if (!codigo) return REFERENCIA_NAO_DETERMINADA
  return codigo
}
