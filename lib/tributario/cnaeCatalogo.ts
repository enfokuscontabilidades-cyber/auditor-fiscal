import type { TributarioCnaeRegra } from '@/lib/types'
import {
  FONTES_CNAE,
  analisarCnae,
  normalizarCnae,
  type CnaeIbge,
  type EnquadramentoCnae,
} from './cnae'

function corresponde(regra: TributarioCnaeRegra, cnae: CnaeIbge): boolean {
  const codigo = normalizarCnae(cnae.id)
  const valores: Record<TributarioCnaeRegra['tipo_correspondencia'], string> = {
    exato: codigo,
    prefixo: codigo,
    secao: cnae.hierarquia.secao.id.toUpperCase(),
    divisao: cnae.hierarquia.divisao.id,
    grupo: cnae.hierarquia.grupo.id,
  }
  const valor = valores[regra.tipo_correspondencia]

  return regra.padroes.some(padrao => {
    const normalizado = regra.tipo_correspondencia === 'secao'
      ? padrao.trim().toUpperCase()
      : normalizarCnae(padrao)
    return regra.tipo_correspondencia === 'prefixo'
      ? valor.startsWith(normalizado)
      : valor === normalizado
  })
}

export function encontrarRegraCnae(
  cnae: CnaeIbge,
  regras: TributarioCnaeRegra[],
): TributarioCnaeRegra | null {
  return [...regras]
    .sort((a, b) => b.prioridade - a.prioridade || b.versao - a.versao)
    .find(regra => regra.ativo && corresponde(regra, cnae)) ?? null
}

export function converterRegraCnae(
  regra: TributarioCnaeRegra,
): EnquadramentoCnae {
  const fontes = [FONTES_CNAE.ibge, ...regra.fontes]
  return {
    natureza: regra.natureza,
    tratamento: regra.tratamento_principal,
    anexo_indicativo: regra.anexo_principal === 'V' ? null : regra.anexo_principal,
    titulo: regra.titulo,
    explicacao: regra.explicacao,
    confianca: regra.confianca,
    conclusivo: regra.conclusivo,
    condicoes: regra.condicoes,
    alertas: regra.alertas,
    excecoes: regra.excecoes,
    entendimentos: regra.entendimentos ?? [],
    fontes: Array.from(new Map(fontes.map(fonte => [fonte.url, fonte])).values()),
    versao_regra: `${regra.codigo_regra}@${regra.versao}`,
  }
}

export function analisarCnaeComCatalogo(
  cnae: CnaeIbge,
  regras: TributarioCnaeRegra[],
): EnquadramentoCnae {
  const regra = encontrarRegraCnae(cnae, regras)
  return regra ? converterRegraCnae(regra) : analisarCnae(cnae)
}
