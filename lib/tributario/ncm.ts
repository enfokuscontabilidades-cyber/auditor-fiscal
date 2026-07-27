import type {
  TributarioCnaeFonte,
  TributarioNcmOperacao,
  TributarioNcmPerfil,
  TributarioNcmPosicaoIcms,
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
  cests: string[]
  descricao_legal: string | null
}

export interface ConsultaNcmResultado {
  ncm: string
  ncm_formatado: string
  perfil: TributarioNcmPerfil
  operacao: TributarioNcmOperacao
  contexto_icms: {
    cest: string
    uf_origem: string
    uf_destino: string
    posicao: TributarioNcmPosicaoIcms
  }
  descricao_informada: string
  classificacao_oficial: NcmOficial | null
  resultados: ResultadoTributoNcm[]
  tributos_sem_regra: TributarioNcmTributo[]
  avisos: string[]
}

export function normalizarNcm(valor: string): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, 8)
}

export function normalizarCest(valor: string): string {
  return String(valor ?? '').replace(/\D/g, '').slice(0, 7)
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

function correspondeCestAoNcm(regra: TributarioNcmRegra, ncm: string, cest: string, descricao: string): boolean {
  const correspondencias = regra.correspondencias_cest ?? []
  if (correspondencias.length === 0) {
    return (regra.cests ?? []).map(normalizarCest).includes(cest)
  }

  return correspondencias.some(correspondencia => {
    if (!correspondencia.cests.map(normalizarCest).includes(cest)) return false
    const corresponde = correspondencia.padroes.some(padrao => {
      const codigo = normalizarNcm(padrao)
      return correspondencia.tipo_correspondencia === 'prefixo' ? ncm.startsWith(codigo) : ncm === codigo
    })
    if (!corresponde) return false
    if ((correspondencia.padroes_excluir ?? []).some(padrao => ncm.startsWith(normalizarNcm(padrao)))) return false
    if (!descricao) return true

    const texto = normalizarTexto(descricao)
    const incluiDescricao = !correspondencia.palavras_incluir?.length
      || correspondencia.palavras_incluir.some(palavra => texto.includes(normalizarTexto(palavra)))
    const excluiDescricao = (correspondencia.palavras_excluir ?? [])
      .some(palavra => texto.includes(normalizarTexto(palavra)))
    return incluiDescricao && !excluiDescricao
  })
}

function resultadoAplicavel(
  regra: TributarioNcmRegra,
  perfil: TributarioNcmPerfil,
  operacao: TributarioNcmOperacao,
  posicaoIcms: TributarioNcmPosicaoIcms,
): TributarioNcmResultadoRegra | null {
  return regra.resultados.find(resultado => {
    const perfilCompativel = resultado.perfis.includes('qualquer') || resultado.perfis.includes(perfil)
    const operacaoCompativel = resultado.operacoes.includes('qualquer') || resultado.operacoes.includes(operacao)
    const posicaoCompativel = !resultado.posicoes_icms?.length || resultado.posicoes_icms.includes(posicaoIcms)
    return perfilCompativel && operacaoCompativel && posicaoCompativel
  }) ?? null
}

export function analisarNcmComCatalogo(params: {
  ncm: string
  perfil: TributarioNcmPerfil
  operacao: TributarioNcmOperacao
  descricao?: string
  cest?: string
  ufOrigem?: string
  ufDestino?: string
  posicaoIcms?: TributarioNcmPosicaoIcms
  classificacaoOficial?: NcmOficial | null
  regras: TributarioNcmRegra[]
}): ConsultaNcmResultado {
  const ncm = normalizarNcm(params.ncm)
  const descricao = params.descricao?.trim() ?? ''
  const cest = normalizarCest(params.cest ?? '')
  const ufOrigem = (params.ufOrigem ?? '').trim().toUpperCase()
  const ufDestino = (params.ufDestino ?? '').trim().toUpperCase()
  const posicaoIcms = params.posicaoIcms ?? 'nao_informada'
  const regrasPorCodigo = [...params.regras]
    .filter(regra => regra.ativo && correspondeAoCodigo(regra, ncm))
    .sort((a, b) => b.prioridade - a.prioridade || b.versao - a.versao)

  const resultados: ResultadoTributoNcm[] = []
  const tributosJaCobertos = new Set<TributarioNcmTributo>()
  const avisosContexto = new Set<string>()

  for (const regra of regrasPorCodigo) {
    if (regra.tributos.every(tributo => tributosJaCobertos.has(tributo))) continue
    const regraIcms = regra.tributos.includes('icms')
    if (!correspondeDescricao(regra, descricao)) {
      if (regraIcms) avisosContexto.add('A descrição informada não corresponde à descrição legal da regra de ICMS-ST localizada para este NCM.')
      continue
    }

    const ufsDestino = regra.ufs_destino ?? []
    if (regraIcms && ufsDestino.length > 0 && ufDestino && !ufsDestino.includes(ufDestino)) {
      avisosContexto.add(`A regra estadual localizada foi validada para ${ufsDestino.join(', ')}, não para a UF de destino ${ufDestino}.`)
      continue
    }

    const cests = (regra.cests ?? []).map(normalizarCest)
    if (regraIcms && cest && cests.length > 0 && !correspondeCestAoNcm(regra, ncm, cest, descricao)) {
      avisosContexto.add('O CEST informado não corresponde a este NCM na regra de ICMS-ST validada para Goiás.')
      continue
    }

    const faltasContexto: string[] = []
    if (regraIcms && ufsDestino.length > 0 && !ufDestino) faltasContexto.push('UF de destino')
    if (regraIcms && regra.exige_cest && !cest) faltasContexto.push('CEST')
    if (regraIcms && regra.descricao_obrigatoria && !descricao) faltasContexto.push('descrição comercial')

    const resultado = resultadoAplicavel(regra, params.perfil, params.operacao, posicaoIcms)
    if (!resultado) continue

    const resultadoFinal: TributarioNcmResultadoRegra = faltasContexto.length > 0
      ? {
          perfis: ['qualquer'],
          operacoes: ['qualquer'],
          tratamento: 'inconclusivo',
          titulo: 'Possível ICMS-ST: informações pendentes',
          explicacao: `O NCM pertence a uma faixa com regra cadastrada, mas ainda faltam: ${faltasContexto.join(', ')}.`,
          orientacao_simples: 'Não segregue a receita como substituição tributária no PGDAS-D com base apenas neste resultado pendente.',
        }
      : resultado

    resultados.push({
      tributos: regra.tributos,
      tratamento: resultadoFinal.tratamento,
      titulo: resultadoFinal.titulo,
      explicacao: resultadoFinal.explicacao,
      orientacao_simples: resultadoFinal.orientacao_simples,
      aliquota_pis: resultadoFinal.aliquota_pis ?? null,
      aliquota_cofins: resultadoFinal.aliquota_cofins ?? null,
      regra: `${regra.codigo_regra}@${regra.versao}`,
      categoria: regra.categoria,
      condicoes: regra.condicoes,
      alertas: regra.alertas,
      fontes: regra.fontes,
      requer_confirmacao_descricao: regra.descricao_obrigatoria && !descricao,
      cests: regra.cests ?? [],
      descricao_legal: regra.descricao_legal ?? null,
    })
    regra.tributos.forEach(tributo => tributosJaCobertos.add(tributo))
  }

  const todosTributos: TributarioNcmTributo[] = ['pis', 'cofins', 'icms', 'ipi']
  const tributosSemRegra = todosTributos.filter(tributo => !tributosJaCobertos.has(tributo))
  const avisos: string[] = [...avisosContexto]
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
    contexto_icms: {
      cest,
      uf_origem: ufOrigem,
      uf_destino: ufDestino,
      posicao: posicaoIcms,
    },
    descricao_informada: descricao,
    classificacao_oficial: params.classificacaoOficial ?? null,
    resultados,
    tributos_sem_regra: tributosSemRegra,
    avisos,
  }
}
