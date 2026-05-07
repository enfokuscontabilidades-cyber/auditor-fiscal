import type { AlertaGerado, ContextoAnalise } from '../types'

// Crédito de PIS/COFINS em itens que podem estar fora do conceito de insumo (STJ RE 841979)
export function executarExclusaoIndevida(ctx: ContextoAnalise): AlertaGerado[] {
  const contrib = ctx.contribData as {
    c170?: Array<{
      classificacao?: string
      vl_pis?: number
      vl_cofins?: number
      cfop?: string
    }>
  } | null

  if (!contrib?.c170) return []

  // Itens de uso e consumo com crédito de PIS/COFINS são suspeitos
  const suspeitos = contrib.c170.filter(
    item =>
      item.classificacao === 'uso_consumo' &&
      ((item.vl_pis ?? 0) > 0 || (item.vl_cofins ?? 0) > 0)
  )

  if (suspeitos.length === 0) return []

  const totalPis = suspeitos.reduce((s, i) => s + (i.vl_pis ?? 0), 0)
  const totalCofins = suspeitos.reduce((s, i) => s + (i.vl_cofins ?? 0), 0)

  return [
    {
      regra_codigo: 'CONTRIB_EXCLUSAO_INDEVIDA',
      categoria: 'pis_cofins',
      nivel_risco: 'medio',
      titulo: 'Possível crédito de PIS/COFINS fora do conceito de insumo',
      descricao: `${suspeitos.length} item(ns) classificado(s) como Uso e Consumo com crédito de PIS/COFINS. Verificar se atende ao conceito de insumo definido no RE 841979 do STJ.`,
      detalhe: {
        quantidade: suspeitos.length,
        total_pis: totalPis,
        total_cofins: totalCofins,
      },
      valor_impacto: totalPis + totalCofins,
    },
  ]
}
