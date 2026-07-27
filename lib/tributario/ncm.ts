import type {
  TributarioCnaeFonte,
  TributarioNcmOperacao,
  TributarioNcmPerfil,
  TributarioNcmRegra,
  TributarioNcmResultadoRegra,
  TributarioNcmTributo,
} from '@/lib/types'

export interface NcmOficial {
  codigo: string
  descricao: string
  data_inicio: string | null
  data_fim: string | null
  ato_legal: string | null
}

export interface ResultadoTributoNcm {
  tributos: TributarioNcmTributo[]
  tratamento: TributarioNcmResultadoRegra['tratamento']
  titulo: string
  explicacao: string
  orientacao_simples: string
  aliquota_pis: number | null
  aliquota_cofins: number | null
  regra: string
  categoria: string
  condicoes: string[]
  alertas: string[]
  fontes: TributarioCnaeFonte[]
  requer_confirmacao_descricao: boolean
}

export interface ConsultaNcmResultado {
  ncm: string
  ncm_formatado: string
  perfil: TributarioNcmPerfil
  operacao: TributarioNcmOperacao
  descricao_informada: string
  classificacao_oficial: NcmOficial | null
  resultados: ResultadoTributoNcm[]
  tributos_sem_regra: TributarioNcmTributo[]
  avisos: string[]
}

export function normalizarNcm(valor: string): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, 8)
}

export function formatarNcm(valor: string): string {
  const codigo = normalizarNcm(valor)
  return codigo.length === 8
    ? `${codigo.slice(0, 4)}.${codigo.slice(4, 6)}.${codigo.slice(6)}`
    : codigo
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function correspondeAoCodigo(regra: TributarioNcmRegra, ncm: string): boolean {
  const corresponde = regra.padroes.some(padrao => {
    const codigo = normalizarNcm(padrao)
    return regra.tipo_correspondencia === 'prefixo' ? ncm.startsWith(codigo) : ncm === codigo
  })
  if (!corresponde) return false

  return !regra.padroes_excluir.some(padrao => ncm.startsWith(normalizarNcm(padrao)))
}

function correspondeDescricao(regra: TributarioNcmRegra, descricao: string): boolean {
  if (!descricao) return true
  const texto = normalizarTexto(descricao)
  const inclui = regra.palavras_incluir.length === 0
    || regra.palavras_incluir.some(palavra => texto.includes(normalizarTexto(palavra)))
  const exclui = regra.palavras_excluir.some(palavra => texto.includes(normalizarTexto(palavra)))
  return inclui && !exclui
}

function resultadoAplicavel(
  regra: TributarioNcmRegra,
  perfil: TributarioNcmPerfil,
  operacao: TributarioNcmOperacao,
): TributarioNcmResultadoRegra | null {
  return regra.resultados.find(resultado => {
    const perfilCompativel = resultado.perfis.includes('qualquer') || resultado.perfis.includes(perfil)
    const operacaoCompativel = resultado.operacoes.includes('qualquer') || resultado.operacoes.includes(operacao)
    return perfilCompativel && operacaoCompativel
  }) ?? null
}

export function analisarNcmComCatalogo(params: {
  ncm: string
  perfil: TributarioNcmPerfil
  operacao: TributarioNcmOperacao
  descricao?: string
  classificacaoOficial?: NcmOficial | null
  regras: TributarioNcmRegra[]
}): ConsultaNcmResultado {
  const ncm = normalizarNcm(params.ncm)
  const descricao = params.descricao?.trim() ?? ''
  const regras = [...params.regras]
    .filter(regra => regra.ativo && correspondeAoCodigo(regra, ncm) && correspondeDescricao(regra, descricao))
    .sort((a, b) => b.prioridade - a.prioridade || b.versao - a.versao)

  const resultados: ResultadoTributoNcm[] = []
  const tributosJaCobertos = new Set<TributarioNcmTributo>()

  for (const regra of regras) {
    if (regra.tributos.every(tributo => tributosJaCobertos.has(tributo))) continue
    const resultado = resultadoAplicavel(regra, params.perfil, params.operacao)
    if (!resultado) continue

    resultados.push({
      tributos: regra.tributos,
      tratamento: resultado.tratamento,
      titulo: resultado.titulo,
      explicacao: resultado.explicacao,
      orientacao_simples: resultado.orientacao_simples,
      aliquota_pis: resultado.aliquota_pis ?? null,
      aliquota_cofins: resultado.aliquota_cofins ?? null,
      regra: `${regra.codigo_regra}@${regra.versao}`,
      categoria: regra.categoria,
      condicoes: regra.condicoes,
      alertas: regra.alertas,
      fontes: regra.fontes,
      requer_confirmacao_descricao: regra.descricao_obrigatoria && !descricao,
    })
    regra.tributos.forEach(tributo => tributosJaCobertos.add(tributo))
  }

  const todosTributos: TributarioNcmTributo[] = ['pis', 'cofins', 'icms', 'ipi']
  const tributosSemRegra = todosTributos.filter(tributo => !tributosJaCobertos.has(tributo))
  const avisos: string[] = []
  if (!params.classificacaoOficial) {
    avisos.push('Não foi possível confirmar a descrição na tabela NCM vigente do Sistema Classif.')
  }
  if (!descricao) {
    avisos.push('Informe a descrição comercial do produto para validar exceções que o NCM, sozinho, não diferencia.')
  }
  if (tributosSemRegra.includes('icms')) {
    avisos.push('ICMS-ST não é concluído apenas pelo NCM: exige UF, descrição, CEST, operação e posição da empresa na cadeia.')
  }

  return {
    ncm,
    ncm_formatado: formatarNcm(ncm),
    perfil: params.perfil,
    operacao: params.operacao,
    descricao_informada: descricao,
    classificacao_oficial: params.classificacaoOficial ?? null,
    resultados,
    tributos_sem_regra: tributosSemRegra,
    avisos,
  }
}
