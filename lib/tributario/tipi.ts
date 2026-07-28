import { limparDescricaoNcm } from './ncmHierarquia'

export type TipiSituacao = 'tributado' | 'aliquota_zero' | 'nao_tributado' | 'sem_informacao'

export interface TipiExcecao {
  ex: string
  descricao: string
  aliquota: number | null
  aliquota_texto: string
  situacao: TipiSituacao
}

export interface TipiOficial {
  codigo: string
  descricao: string
  aliquota: number | null
  aliquota_texto: string
  situacao: TipiSituacao
  excecoes: TipiExcecao[]
}

interface AliquotaTipiInterpretada {
  aliquota: number | null
  aliquota_texto: string
  situacao: TipiSituacao
}

function textoCelula(valor: unknown): string {
  return typeof valor === 'string' || typeof valor === 'number'
    ? String(valor).replace(/\s+/g, ' ').trim()
    : ''
}

function codigoNumerico(valor: unknown): string {
  return textoCelula(valor).replace(/\D/g, '').slice(0, 8)
}

export function interpretarAliquotaTipi(valor: unknown): AliquotaTipiInterpretada {
  const texto = textoCelula(valor)
  if (texto.toUpperCase() === 'NT') {
    return { aliquota: null, aliquota_texto: 'NT', situacao: 'nao_tributado' }
  }

  const numero = Number(texto.replace(',', '.'))
  if (!texto || !Number.isFinite(numero)) {
    return { aliquota: null, aliquota_texto: 'Não informada', situacao: 'sem_informacao' }
  }

  return {
    aliquota: numero,
    aliquota_texto: `${numero.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`,
    situacao: numero === 0 ? 'aliquota_zero' : 'tributado',
  }
}

export function extrairTipiDasLinhas(linhas: unknown[][], codigoInformado: string): TipiOficial | null {
  const codigo = codigoNumerico(codigoInformado)
  if (codigo.length !== 8) return null

  const correspondencias = linhas.filter(linha => codigoNumerico(linha[0]) === codigo)
  const linhaPrincipal = correspondencias.find(linha => !textoCelula(linha[1]))
  if (!linhaPrincipal) return null

  const aliquotaPrincipal = interpretarAliquotaTipi(linhaPrincipal[3])
  const excecoes = correspondencias.flatMap<TipiExcecao>(linha => {
    const ex = textoCelula(linha[1])
    if (!ex) return []
    const aliquotaEx = interpretarAliquotaTipi(linha[3])
    return [{
      ex,
      descricao: limparDescricaoNcm(textoCelula(linha[2])),
      ...aliquotaEx,
    }]
  })

  return {
    codigo,
    descricao: limparDescricaoNcm(textoCelula(linhaPrincipal[2])),
    ...aliquotaPrincipal,
    excecoes,
  }
}
