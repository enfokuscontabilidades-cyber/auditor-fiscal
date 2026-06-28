// Consolidação de receitas de um grupo econômico
// Agrega receitas mensais de múltiplos CNPJs e detecta risco de desenquadramento

import { LIMITE_SIMPLES_NACIONAL } from '@/lib/simples/tabelasAnexos'
import type {
  DadosBrutosEmpresa,
  ReceitaMensalConsolidada,
  ResultadoConsolidacao,
} from './types'

// Converte "MM/YYYY" → Date para ordenação
function parseMesAno(comp: string): Date {
  const [m, y] = comp.split('/')
  return new Date(parseInt(y), parseInt(m) - 1, 1)
}

export function consolidarGrupo(empresas: DadosBrutosEmpresa[]): ResultadoConsolidacao {
  const alertas: string[] = []
  const receitaPorMesMap = new Map<string, Record<string, number>>()

  let simplesAtualTotal = 0

  for (const { empresa, declaracoes, receitasMensais } of empresas) {
    // Prioridade: PGDAS > receitas_mensais (xml/manual) > zero
    const receitasMapa = new Map<string, number>()

    for (const rm of receitasMensais) {
      if ((rm.receita_bruta_mes ?? 0) > 0) {
        const comp = normalizeComp(rm.competencia)
        if (!receitasMapa.has(comp) || rm.origem === 'pgdas') {
          receitasMapa.set(comp, rm.receita_bruta_mes)
        }
      }
    }

    for (const decl of declaracoes) {
      const comp = normalizeComp(decl.competencia)
      if ((decl.receita_bruta_mes ?? 0) > 0) {
        receitasMapa.set(comp, decl.receita_bruta_mes!)
      }
      if ((decl.valor_total_devido ?? 0) > 0) {
        simplesAtualTotal += decl.valor_total_devido!
      }
    }

    if (receitasMapa.size === 0) {
      alertas.push(`Empresa ${empresa.razao_social} (${empresa.cnpj ?? 'sem CNPJ'}) sem receitas no período`)
    }

    for (const [comp, receita] of receitasMapa) {
      if (!receitaPorMesMap.has(comp)) receitaPorMesMap.set(comp, {})
      receitaPorMesMap.get(comp)![empresa.id] = (receitaPorMesMap.get(comp)![empresa.id] ?? 0) + receita
    }
  }

  // Ordenar competências
  const competencias = Array.from(receitaPorMesMap.keys())
    .sort((a, b) => parseMesAno(a).getTime() - parseMesAno(b).getTime())

  const receitaPorMes: ReceitaMensalConsolidada[] = competencias.map(comp => {
    const porEmpresa = receitaPorMesMap.get(comp)!
    const receitaTotal = Object.values(porEmpresa).reduce((s, v) => s + v, 0)
    return {
      competencia: comp,
      receitaTotal,
      porEmpresa,
      ultrapassaLimite: receitaTotal > LIMITE_SIMPLES_NACIONAL / 12,
      folga: (LIMITE_SIMPLES_NACIONAL / 12) - receitaTotal,
    }
  })

  // Receita anual total (período selecionado)
  const receitaAnualTotal = receitaPorMes.reduce((s, m) => s + m.receitaTotal, 0)

  // RBT12: últimos 12 meses disponíveis (pode ser menor se período < 12 meses)
  const ultimos12 = receitaPorMes.slice(-12)
  const rbt12Consolidado = ultimos12.reduce((s, m) => s + m.receitaTotal, 0)

  const mesesEmRisco = receitaPorMes
    .filter(m => m.receitaTotal > LIMITE_SIMPLES_NACIONAL / 12)
    .map(m => m.competencia)

  if (rbt12Consolidado > LIMITE_SIMPLES_NACIONAL) {
    alertas.push(
      `RBT12 consolidado (${fmtBRL(rbt12Consolidado)}) excede o limite do Simples Nacional (${fmtBRL(LIMITE_SIMPLES_NACIONAL)}) — risco de autuação por grupo econômico`
    )
  }

  if (mesesEmRisco.length > 0) {
    alertas.push(
      `${mesesEmRisco.length} mês(es) com receita mensal acima de ${fmtBRL(LIMITE_SIMPLES_NACIONAL / 12)} (limite proporcional)`
    )
  }

  return {
    empresas: empresas.map(e => e.empresa),
    receitaPorMes,
    receitaAnualTotal,
    rbt12Consolidado,
    ultrapassaLimiteAnual: rbt12Consolidado > LIMITE_SIMPLES_NACIONAL,
    mesesEmRisco,
    simplesAtualTotal,
    alertas,
  }
}

// Normaliza competência para "MM/YYYY"
function normalizeComp(comp: string): string {
  if (!comp) return ''
  // "YYYY-MM" → "MM/YYYY"
  if (/^\d{4}-\d{2}$/.test(comp)) {
    const [y, m] = comp.split('-')
    return `${m}/${y}`
  }
  // "MM/YYYY" já está correto
  if (/^\d{2}\/\d{4}$/.test(comp)) return comp
  // "YYYY-MM-DD" → "MM/YYYY"
  if (/^\d{4}-\d{2}-\d{2}/.test(comp)) {
    const [y, m] = comp.split('-')
    return `${m}/${y}`
  }
  return comp
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
