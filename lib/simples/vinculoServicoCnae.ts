import type { TributarioServicoCnaeVinculo } from '@/lib/types'
import type { OrigemCodigoServicoNfse } from './codigoServicoNfse'
import { normalizarCodigoServicoNfse } from './codigoServicoNfse'

export interface ContextoVinculoServicoCnae {
  codigo: string
  origem: OrigemCodigoServicoNfse
  municipioCodigo?: string | null
  descricao?: string | null
}

export function normalizarTextoVinculo(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

export function extrairSubitemLc116(codigo: string): string | null {
  const normalizado = normalizarCodigoServicoNfse(codigo, 'lista_nacional')
  if (!/^\d{4,}$/.test(normalizado)) return null
  return normalizado.slice(0, 4)
}

export function selecionarVinculoServicoCnae(
  contexto: ContextoVinculoServicoCnae,
  vinculos: TributarioServicoCnaeVinculo[],
): TributarioServicoCnaeVinculo | null {
  const codigoNormalizado = normalizarCodigoServicoNfse(contexto.codigo, contexto.origem)
  const subitem = contexto.origem === 'lista_nacional'
    ? extrairSubitemLc116(contexto.codigo)
    : null
  const municipio = (contexto.municipioCodigo ?? '').replace(/\D/g, '').slice(0, 7)
  const descricao = normalizarTextoVinculo(contexto.descricao ?? '')

  return vinculos
    .filter(vinculo => vinculo.ativo)
    .filter(vinculo => {
      if (vinculo.tipo_codigo === 'subitem_lc116') {
        return contexto.origem === 'lista_nacional' && subitem === vinculo.codigo_padrao
      }
      if (vinculo.tipo_codigo === 'codigo_nacional') {
        return contexto.origem === 'lista_nacional' && codigoNormalizado === vinculo.codigo_padrao
      }
      return contexto.origem === 'municipal' &&
        codigoNormalizado === vinculo.codigo_padrao &&
        municipio === (vinculo.municipio_codigo ?? '')
    })
    .filter(vinculo => {
      const inclusoes = vinculo.palavras_incluir.map(normalizarTextoVinculo).filter(Boolean)
      const exclusoes = vinculo.palavras_excluir.map(normalizarTextoVinculo).filter(Boolean)
      const atendeInclusao = inclusoes.length === 0 || inclusoes.some(palavra => descricao.includes(palavra))
      const atendeExclusao = exclusoes.some(palavra => descricao.includes(palavra))
      return atendeInclusao && !atendeExclusao
    })
    .sort((a, b) => b.prioridade - a.prioridade || b.versao - a.versao)[0] ?? null
}
