import 'server-only'

import type { CnaeIbge } from './cnae'
import { normalizarCnae, normalizarTextoBusca } from './cnae'

const IBGE_BASE_URL = 'https://servicodados.ibge.gov.br/api/v2/cnae'
const TEMPO_CACHE_SEGUNDOS = 24 * 60 * 60

interface IbgeSecao {
  id: string
  descricao: string
}

interface IbgeDivisao {
  id: string
  descricao: string
  secao: IbgeSecao
}

interface IbgeGrupo {
  id: string
  descricao: string
  divisao: IbgeDivisao
}

interface IbgeClasse {
  id: string
  descricao: string
  grupo: IbgeGrupo
}

interface IbgeSubclasse {
  id: string
  descricao: string
  classe: IbgeClasse
  atividades?: string[]
  observacoes?: string[]
}

function converterSubclasse(row: IbgeSubclasse, incluirDetalhes: boolean): CnaeIbge {
  return {
    id: row.id,
    descricao: row.descricao,
    hierarquia: {
      secao: row.classe.grupo.divisao.secao,
      divisao: { id: row.classe.grupo.divisao.id, descricao: row.classe.grupo.divisao.descricao },
      grupo: { id: row.classe.grupo.id, descricao: row.classe.grupo.descricao },
      classe: { id: row.classe.id, descricao: row.classe.descricao },
    },
    atividades: incluirDetalhes ? (row.atividades ?? []) : [],
    observacoes: incluirDetalhes ? (row.observacoes ?? []) : [],
  }
}

async function requisitarIbge<T>(caminho: string, tempoLimiteMs = 20_000): Promise<T> {
  const response = await fetch(`${IBGE_BASE_URL}${caminho}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: TEMPO_CACHE_SEGUNDOS },
    signal: AbortSignal.timeout(tempoLimiteMs),
  })

  if (!response.ok) {
    throw new Error(`IBGE respondeu com status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function consultarCnaeIbge(codigoInformado: string): Promise<CnaeIbge | null> {
  const codigo = normalizarCnae(codigoInformado)
  if (codigo.length !== 7) return null

  try {
    const row = await requisitarIbge<IbgeSubclasse>(`/subclasses/${codigo}`)
    return converterSubclasse(row, true)
  } catch (error) {
    if (error instanceof Error && error.message.includes('status 404')) return null
    throw error
  }
}

function pontuarResultado(row: IbgeSubclasse, termo: string, termoNumerico: string): number {
  if (termoNumerico && row.id === termoNumerico) return 100
  if (termoNumerico && row.id.startsWith(termoNumerico)) return 90

  const descricao = normalizarTextoBusca(row.descricao)
  if (descricao === termo) return 80
  if (descricao.startsWith(termo)) return 70
  if (descricao.includes(termo)) return 60
  if ((row.atividades ?? []).some(atividade => normalizarTextoBusca(atividade).includes(termo))) return 40
  return 0
}

export async function buscarCnaesIbge(termoInformado: string, limite = 25): Promise<CnaeIbge[]> {
  const termo = normalizarTextoBusca(termoInformado)
  const termoNumerico = normalizarCnae(termoInformado)
  if (termo.length < 2 && termoNumerico.length < 2) return []

  // A pesquisa textual precisa baixar o catálogo completo na primeira consulta.
  // As chamadas seguintes usam o cache do Next.js por 24 horas.
  const rows = await requisitarIbge<IbgeSubclasse[]>('/subclasses', 60_000)
  return rows
    .map(row => ({ row, pontos: pontuarResultado(row, termo, termoNumerico) }))
    .filter(resultado => resultado.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || a.row.descricao.localeCompare(b.row.descricao, 'pt-BR'))
    .slice(0, limite)
    .map(({ row }) => converterSubclasse(row, false))
}
