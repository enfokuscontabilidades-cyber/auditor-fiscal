// Simulação de Lucro Presumido
// PIS 0,65% + COFINS 3% cumulativos + IRPJ/CSLL sobre base presumida
// Apuração mensal para visualização; IRPJ/CSLL agrupáveis por trimestre

import type {
  DadosBrutosEmpresa,
  PremissesCenario,
  ResultadoLPMes,
  ResultadoLucroPresumido,
  TributoLP,
} from './types'

// Limite mensal para adicional de IRPJ: R$ 20.000/mês ou R$ 60.000/trimestre
const ADICIONAL_IRPJ_LIMITE_MES = 20_000

export function simularLucroPresumido(
  empresas: DadosBrutosEmpresa[],
  premissas: PremissesCenario,
): ResultadoLucroPresumido {
  const alertas: string[] = []
  const { lucroPresumido: p, tipoPredominante } = premissas

  // Mapear receita por competência (consolidada do grupo)
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

  // Percentuais presumidos baseados no tipo predominante
  const pctIrpj = tipoPredominante === 'servico'
    ? p.percentualIrpjServico
    : tipoPredominante === 'industria'
      ? p.percentualIrpjIndustria
      : p.percentualIrpjComercio

  const pctCsll = tipoPredominante === 'servico'
    ? p.percentualCsllServico
    : tipoPredominante === 'industria'
      ? p.percentualCsllIndustria
      : p.percentualCsllComercio

  const porMes: ResultadoLPMes[] = competencias.map(comp => {
    const receita = receitaPorComp.get(comp) ?? 0

    // PIS e COFINS cumulativos sobre receita bruta
    const pis = round2(receita * 0.0065)
    const cofins = round2(receita * 0.03)

    // Bases presumidas
    const irpjBase = round2(receita * pctIrpj)
    const csllBase = round2(receita * pctCsll)

    // IRPJ: 15% sobre base; adicional de 10% sobre excedente de R$ 20.000/mês
    const irpjPrincipal = round2(irpjBase * 0.15)
    const adicionalIrpj = round2(Math.max(0, irpjBase - ADICIONAL_IRPJ_LIMITE_MES) * 0.10)
    const irpjMensal = irpjPrincipal + adicionalIrpj

    // CSLL: 9% sobre base presumida
    const csllMensal = round2(csllBase * 0.09)

    const totalMensal = pis + cofins + irpjMensal + csllMensal

    const tributos: TributoLP[] = [
      { nome: 'PIS', base: receita, aliquota: 0.0065, valor: pis },
      { nome: 'COFINS', base: receita, aliquota: 0.03, valor: cofins },
      {
        nome: 'IRPJ (15%)',
        base: irpjBase,
        aliquota: 0.15,
        valor: irpjPrincipal,
        nota: `Base presumida ${(pctIrpj * 100).toFixed(0)}% sobre receita`,
      },
    ]
    if (adicionalIrpj > 0) {
      tributos.push({
        nome: 'Adicional IRPJ (10%)',
        base: Math.max(0, irpjBase - ADICIONAL_IRPJ_LIMITE_MES),
        aliquota: 0.10,
        valor: adicionalIrpj,
        nota: 'Excedente de R$ 20.000/mês na base presumida',
      })
    }
    tributos.push({
      nome: 'CSLL (9%)',
      base: csllBase,
      aliquota: 0.09,
      valor: csllMensal,
      nota: `Base presumida ${(pctCsll * 100).toFixed(0)}% sobre receita`,
    })

    return {
      competencia: comp,
      receitaTributavel: receita,
      pis,
      cofins,
      irpjBase,
      csllBase,
      irpjMensal,
      csllMensal,
      totalMensal,
      tributos,
    }
  })

  const totalPeriodo = porMes.reduce((s, m) => s + m.totalMensal, 0)
  const receitaTotalPeriodo = porMes.reduce((s, m) => s + m.receitaTributavel, 0)
  const aliquotaEfetiva = receitaTotalPeriodo > 0 ? totalPeriodo / receitaTotalPeriodo : 0

  if (tipoPredominante === 'misto') {
    alertas.push(
      'Empresa com atividade mista: premissas de Lucro Presumido aplicadas com tipo predominante configurado. ' +
      'Receitas de serviço (32%) e comércio/indústria (8%) podem ter bases diferentes — refine as premissas.'
    )
  }

  alertas.push(
    'IRPJ e CSLL no Lucro Presumido têm apuração TRIMESTRAL. Os valores mensais são estimativas lineares para comparação. ' +
    'Adicional de IRPJ (10%) calculado mensalmente para simplificação; o correto é apurar por trimestre (R$ 60.000).'
  )

  alertas.push('ISS, ICMS e encargos trabalhistas (FGTS, INSS patronal) NÃO estão incluídos nesta simulação.')

  return {
    porMes,
    totalPeriodo,
    aliquotaEfetiva,
    premissasUsadas: premissas.lucroPresumido,
    confianca: 'medio' as const,
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
