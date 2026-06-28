// Simulação de Lucro Real
// PIS/COFINS não cumulativos + IRPJ/CSLL sobre lucro real estimado
// Resultado tem baixa/média confiança sem contabilidade completa

import type {
  DadosBrutosEmpresa,
  PremissesCenario,
  ResultadoLRMes,
  ResultadoLucroReal,
} from './types'

const ADICIONAL_IRPJ_LIMITE_MES = 20_000

export function simularLucroReal(
  empresas: DadosBrutosEmpresa[],
  premissas: PremissesCenario,
): ResultadoLucroReal {
  const alertas: string[] = []
  const { lucroReal: p } = premissas

  const receitaPorComp = new Map<string, number>()

  for (const { declaracoes, receitasMensais } of empresas) {
    for (const rm of receitasMensais) {
      const comp = normalizeComp(rm.competencia)
      receitaPorComp.set(comp, (receitaPorComp.get(comp) ?? 0) + rm.receita_bruta_mes)
    }
    for (const decl of declaracoes) {
      const comp = normalizeComp(decl.competencia)
      if ((decl.receita_bruta_mes ?? 0) > 0 && !receitaPorComp.has(comp)) {
        receitaPorComp.set(comp, decl.receita_bruta_mes!)
      }
    }
  }

  const competencias = Array.from(receitaPorComp.keys()).sort(sortComp)

  // Distribuir créditos estimados linearmente ao longo do período
  const creditoMensal = competencias.length > 0
    ? p.creditosPisCofinsEstimados / competencias.length
    : 0

  const porMes: ResultadoLRMes[] = competencias.map(comp => {
    const receitaBruta = receitaPorComp.get(comp) ?? 0
    const deducoes = 0  // devoluções: não temos granularidade aqui
    const receitaLiquida = receitaBruta - deducoes

    // Custos e despesas dedutíveis por premissas
    const cmv = round2(receitaBruta * p.cmvSobreReceita)
    const despesasOperacionais = round2(receitaBruta * p.despesasOperacionaisSobreReceita)
    const folha = round2(receitaBruta * p.folhaSobreReceita)
    const outrasDeducoes = round2(receitaBruta * p.outrasDeducoesSobreReceita)

    const lucroEstimado = round2(
      receitaLiquida - cmv - despesasOperacionais - folha - outrasDeducoes
    )

    // PIS 1,65% e COFINS 7,6% sobre receita bruta (débito)
    const pisSobreReceita = round2(receitaBruta * 0.0165)
    const cofinsSobreReceita = round2(receitaBruta * 0.076)

    // Créditos estimados (pelo usuário ou pelos documentos de entrada)
    const creditosPis = round2(creditoMensal * (0.0165 / (0.0165 + 0.076)))
    const creditosCofins = round2(creditoMensal * (0.076 / (0.0165 + 0.076)))

    const pisLiquido = round2(Math.max(0, pisSobreReceita - creditosPis))
    const cofinsLiquido = round2(Math.max(0, cofinsSobreReceita - creditosCofins))

    // IRPJ 15% + adicional; CSLL 9%
    const baseIrpj = Math.max(0, lucroEstimado)
    const irpjPrincipal = round2(baseIrpj * 0.15)
    const adicionalIrpj = round2(Math.max(0, baseIrpj - ADICIONAL_IRPJ_LIMITE_MES) * 0.10)
    const irpjMensal = irpjPrincipal + adicionalIrpj

    const csllMensal = round2(Math.max(0, lucroEstimado) * 0.09)

    const totalMensal = pisLiquido + cofinsLiquido + irpjMensal + csllMensal

    return {
      competencia: comp,
      receitaBruta,
      deducoes,
      receitaLiquida,
      cmv,
      despesasOperacionais,
      folha,
      outrasDeducoes,
      lucroEstimado,
      pisSobreReceita,
      cofinsSobreReceita,
      creditosPis,
      creditosCofins,
      pisLiquido,
      cofinsLiquido,
      irpjMensal,
      csllMensal,
      totalMensal,
    }
  })

  const totalPeriodo = porMes.reduce((s, m) => s + m.totalMensal, 0)
  const receitaTotal = porMes.reduce((s, m) => s + m.receitaBruta, 0)
  const aliquotaEfetiva = receitaTotal > 0 ? totalPeriodo / receitaTotal : 0

  // Confiança depende da qualidade das premissas
  const temPremissasCustomizadas =
    p.cmvSobreReceita !== 0.60 ||
    p.despesasOperacionaisSobreReceita !== 0.15 ||
    p.folhaSobreReceita !== 0.10

  const confianca: 'medio' | 'baixo' = temPremissasCustomizadas ? 'medio' : 'baixo'

  alertas.push(
    'IRPJ e CSLL no Lucro Real são apurados sobre o LUCRO FISCAL, que exige LALUR/LACS e ajustes fiscais. ' +
    'Esta simulação usa lucro estimado pelas premissas informadas — resultado com precisão limitada.'
  )
  alertas.push(
    'Créditos de PIS/COFINS não cumulativos dependem da natureza das entradas (insumos, ativos, serviços). ' +
    'Sem análise item a item das entradas, o crédito é estimado pelo campo "créditos estimados" nas premissas.'
  )
  alertas.push('ISS, ICMS e encargos trabalhistas (FGTS, INSS patronal) NÃO estão incluídos nesta simulação.')

  if (confianca === 'baixo') {
    alertas.push(
      'Premissas de custos/despesas estão nos valores padrão. Para maior precisão, informe CMV, folha e despesas reais da empresa.'
    )
  }

  return {
    porMes,
    totalPeriodo,
    aliquotaEfetiva,
    premissasUsadas: premissas.lucroReal,
    confianca,
    alertas,
  }
}

function normalizeComp(comp: string): string {
  if (!comp) return ''
  if (/^\d{4}-\d{2}$/.test(comp)) {
    const [y, m] = comp.split('-')
    return `${m}/${y}`
  }
  if (/^\d{2}\/\d{4}$/.test(comp)) return comp
  if (/^\d{4}-\d{2}-\d{2}/.test(comp)) {
    const [y, m] = comp.split('-')
    return `${m}/${y}`
  }
  return comp
}

function parseMesAno(comp: string): number {
  const [m, y] = comp.split('/')
  return parseInt(y) * 100 + parseInt(m)
}

function sortComp(a: string, b: string) {
  return parseMesAno(a) - parseMesAno(b)
}

function round2(v: number) {
  return Math.round(v * 100) / 100
}
