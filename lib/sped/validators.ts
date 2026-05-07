// Validadores fiscais para cruzamento SPED Fiscal × SPED Contribuições

import type { SpedFiscalParsed, SpedContribParsed, InconsistenciaSped, ItemCruzamento } from "./types"

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

// ─── Cruzamento de documentos ─────────────────────────────────────────────────

export function cruzarDocumentos(
  fiscal: SpedFiscalParsed | null,
  contrib: SpedContribParsed | null,
): ItemCruzamento[] {
  if (!fiscal && !contrib) return []

  const fiscalDocs  = fiscal?.docs  ?? []
  const contribDocs = contrib?.docs ?? []

  const fiscalMap  = new Map(fiscalDocs.map(d  => [d.key, d]))
  const contribMap = new Map(contribDocs.map(d => [d.key, d]))

  const allKeys = new Set([...fiscalMap.keys(), ...contribMap.keys()])

  const result: ItemCruzamento[] = []
  for (const key of allKeys) {
    const f = fiscalMap.get(key)
    const c = contribMap.get(key)
    const ref = f || c!
    result.push({
      key,
      numDoc:      ref.numDoc,
      dtDoc:       ref.dtDoc,
      participante: ref.participante,
      vlDocFiscal:  f?.vlDoc ?? 0,
      vlDocContrib: c?.vlDoc ?? 0,
      cfopsFiscal:  f?.cfops ?? "",
      cfopsContrib: c?.cfops ?? "",
      status: f && c ? "OK" : f ? "só fiscal" : "só contrib",
    })
  }
  return result.sort((a, b) => a.dtDoc.localeCompare(b.dtDoc))
}

// ─── Validações individuais ───────────────────────────────────────────────────

// V01 — Nota no Fiscal ausente no Contrib
function v01(fiscal: SpedFiscalParsed, contrib: SpedContribParsed | null): InconsistenciaSped[] {
  if (!contrib) return []
  const contribKeys = new Set(contrib.docs.map(d => d.key))
  // Só validar notas com chave de 44 dígitos (NF-e)
  const divergentes = fiscal.docs.filter(d => d.key.length === 44 && !contribKeys.has(d.key) && d.indOper === "1") // saídas
  if (!divergentes.length) return []
  return [{
    id: "V01", nivel: "alto", categoria: "cruzamento",
    titulo: "Notas de saída no Fiscal ausentes no Contrib",
    descricao: `${divergentes.length} nota(s) de saída encontradas no SPED Fiscal não foram localizadas no SPED Contribuições. Pode indicar omissão no arquivo de contribuições.`,
    registros: divergentes.slice(0, 50).map(d => ({ nota: d.numDoc, data: d.dtDoc, participante: d.participante, valor: money.format(d.vlDoc) })),
    valorImpacto: divergentes.reduce((s, d) => s + d.vlDoc, 0),
  }]
}

// V02 — Nota no Contrib ausente no Fiscal
function v02(fiscal: SpedFiscalParsed | null, contrib: SpedContribParsed): InconsistenciaSped[] {
  if (!fiscal) return []
  const fiscalKeys = new Set(fiscal.docs.map(d => d.key))
  const divergentes = contrib.docs.filter(d => d.key.length === 44 && !fiscalKeys.has(d.key))
  if (!divergentes.length) return []
  return [{
    id: "V02", nivel: "medio", categoria: "cruzamento",
    titulo: "Notas no Contrib ausentes no Fiscal",
    descricao: `${divergentes.length} nota(s) do SPED Contribuições não localizadas no SPED Fiscal. Verifique se todos os períodos foram importados.`,
    registros: divergentes.slice(0, 50).map(d => ({ nota: d.numDoc, data: d.dtDoc, participante: d.participante, valor: money.format(d.vlDoc) })),
    valorImpacto: divergentes.reduce((s, d) => s + d.vlDoc, 0),
  }]
}

// V03 — ICMS não abatido da base PIS/COFINS
// STF RE 574.706 — ICMS não compõe a base de cálculo de PIS/COFINS
function v03(contrib: SpedContribParsed): InconsistenciaSped[] {
  const CST_TRIBUTADOS = new Set(["01", "02", "49", "50", "99"])
  const suspeitos = contrib.c170contrib.filter(item => {
    if (!CST_TRIBUTADOS.has(item.cstPis) || item.vlBcPis <= 0 || item.vlItem < 50) return false
    // Se base PIS ≈ valor item (diferença < 2%), ICMS pode não ter sido excluído
    const diff = Math.abs(item.vlBcPis - item.vlItem) / item.vlItem
    return diff < 0.02
  })
  if (!suspeitos.length) return []
  const totalBase = suspeitos.reduce((s, i) => s + i.vlBcPis, 0)
  // Estimativa de impacto: ICMS ~12% sobre a base PIS indevida × alíquota PIS 1,65%
  const impactoEstimado = totalBase * 0.12 * 0.0165
  return [{
    id: "V03", nivel: "alto", categoria: "pis_cofins",
    titulo: "ICMS possivelmente incluso na base PIS/COFINS",
    descricao: `${suspeitos.length} item(ns) com base de PIS/COFINS igual ao valor total da operação. Pelo RE 574.706 (STF), o ICMS não deve compor a base de cálculo das contribuições.`,
    registros: suspeitos.slice(0, 30).map(i => ({ docKey: i.docKey.slice(0, 10) + "…", vlItem: money.format(i.vlItem), vlBcPis: money.format(i.vlBcPis), cstPis: i.cstPis })),
    valorImpacto: impactoEstimado,
  }]
}

// V04 — CST não tributável (04-09) com valor de PIS/COFINS declarado
function v04(contrib: SpedContribParsed): InconsistenciaSped[] {
  const CST_NAO_TRIB = new Set(["04", "05", "06", "07", "08", "09"])
  const inconsistentes = contrib.c170contrib.filter(i =>
    (CST_NAO_TRIB.has(i.cstPis) && i.vlPis > 0.01) ||
    (CST_NAO_TRIB.has(i.cstCofins) && i.vlCofins > 0.01)
  )
  if (!inconsistentes.length) return []
  const totalPis    = inconsistentes.reduce((s, i) => s + i.vlPis, 0)
  const totalCofins = inconsistentes.reduce((s, i) => s + i.vlCofins, 0)
  return [{
    id: "V04", nivel: "alto", categoria: "cst",
    titulo: "CST não tributável com valor de PIS/COFINS > 0",
    descricao: `${inconsistentes.length} item(ns) classificados com CST 04-09 (não tributável/isento/suspenso) apresentam valor de PIS ou COFINS maior que zero. Possível erro de classificação ou cálculo.`,
    registros: inconsistentes.slice(0, 30).map(i => ({ docKey: i.docKey.slice(0, 10) + "…", cstPis: i.cstPis, vlPis: money.format(i.vlPis), cstCofins: i.cstCofins, vlCofins: money.format(i.vlCofins) })),
    valorImpacto: totalPis + totalCofins,
  }]
}

// V05 — CST tributável (01/02) com alíquota zero (deveria ser CST 04/06)
function v05(contrib: SpedContribParsed): InconsistenciaSped[] {
  const inconsistentes = contrib.c170contrib.filter(i =>
    (i.cstPis === "01" || i.cstPis === "02") &&
    i.vlBcPis > 50 &&
    i.aliqPis === 0 &&
    i.aliqCofins === 0
  )
  if (!inconsistentes.length) return []
  return [{
    id: "V05", nivel: "medio", categoria: "cst",
    titulo: "CST tributável com alíquota zero — possível classificação incorreta",
    descricao: `${inconsistentes.length} item(ns) classificados com CST 01 ou 02 (operação tributável) mas com alíquota PIS e COFINS igual a zero. Provavelmente deveriam usar CST 04, 06 ou 07.`,
    registros: inconsistentes.slice(0, 30).map(i => ({ docKey: i.docKey.slice(0, 10) + "…", cstPis: i.cstPis, vlItem: money.format(i.vlItem), aliqPis: i.aliqPis, aliqCofins: i.aliqCofins })),
  }]
}

// V06 — CFOP invertido (CFOP de saída em registro de entrada ou vice-versa)
function v06(fiscal: SpedFiscalParsed): InconsistenciaSped[] {
  const entradaComSaida = fiscal.c190.filter(c => c.indOper === "0" && ["5", "6", "7"].includes((c.cfop || "")[0]))
  const saidaComEntrada = fiscal.c190.filter(c => c.indOper === "1" && ["1", "2", "3"].includes((c.cfop || "")[0]))

  const items = [
    ...entradaComSaida.map(c => ({ nota: c.numDoc, data: c.dtDoc, cfop: c.cfop, tipo: "Entrada c/ CFOP de saída", valor: money.format(c.vlOpr) })),
    ...saidaComEntrada.map(c => ({ nota: c.numDoc, data: c.dtDoc, cfop: c.cfop, tipo: "Saída c/ CFOP de entrada", valor: money.format(c.vlOpr) })),
  ]
  if (!items.length) return []
  return [{
    id: "V06", nivel: "alto", categoria: "cfop",
    titulo: "CFOP invertido — entrada com CFOP de saída ou vice-versa",
    descricao: `${items.length} registro(s) C190 com CFOP incompatível com o tipo da operação. Pode indicar erro de escrituração.`,
    registros: items.slice(0, 50),
    valorImpacto: [...entradaComSaida, ...saidaComEntrada].reduce((s, c) => s + c.vlOpr, 0),
  }]
}

// V07 — E110 (débito total) diverge da soma dos C190 de saída
function v07(fiscal: SpedFiscalParsed): InconsistenciaSped[] {
  if (!fiscal.e110) return []
  const somaC190Debitos = fiscal.c190.filter(c => c.indOper === "1").reduce((s, c) => s + c.icms, 0)
  if (somaC190Debitos === 0) return []
  const diff = Math.abs(fiscal.e110.vlTotDebitos - somaC190Debitos) / somaC190Debitos
  if (diff < 0.05) return []
  return [{
    id: "V07", nivel: "medio", categoria: "apuracao",
    titulo: "E110 diverge da soma dos débitos ICMS no C190",
    descricao: `Total de débitos no E110 (${money.format(fiscal.e110.vlTotDebitos)}) diverge ${(diff * 100).toFixed(1)}% da soma dos registros C190 de saída (${money.format(somaC190Debitos)}). Possível inconsistência na apuração.`,
    registros: [{ e110_debitos: money.format(fiscal.e110.vlTotDebitos), soma_c190: money.format(somaC190Debitos), diferenca: money.format(Math.abs(fiscal.e110.vlTotDebitos - somaC190Debitos)) }],
    valorImpacto: Math.abs(fiscal.e110.vlTotDebitos - somaC190Debitos),
  }]
}

// V08 — Alíquota efetiva de ICMS muito baixa
function v08(fiscal: SpedFiscalParsed): InconsistenciaSped[] {
  if (!fiscal.e110) return []
  const totalSaidas = fiscal.docs.filter(d => d.indOper === "1").reduce((s, d) => s + d.vlDoc, 0)
  if (totalSaidas < 1000) return []
  const aliqEfetiva = fiscal.e110.vlSldApurado / totalSaidas
  if (aliqEfetiva >= 0.01) return []   // >= 1% OK
  return [{
    id: "V08", nivel: "medio", categoria: "apuracao",
    titulo: "Alíquota efetiva de ICMS muito baixa",
    descricao: `Alíquota efetiva de ICMS de ${(aliqEfetiva * 100).toFixed(2)}% (saldo apurado ÷ receita de saídas). Pode indicar excesso de crédito, benefícios fiscais não documentados ou erros de escrituração.`,
    registros: [{ saldo_apurado: money.format(fiscal.e110.vlSldApurado), total_saidas: money.format(totalSaidas), aliq_efetiva: `${(aliqEfetiva * 100).toFixed(2)}%` }],
  }]
}

// ─── Agregador ────────────────────────────────────────────────────────────────

export function validarTudo(
  fiscal: SpedFiscalParsed | null,
  contrib: SpedContribParsed | null,
): InconsistenciaSped[] {
  const resultado: InconsistenciaSped[] = []
  try { if (fiscal && contrib) resultado.push(...v01(fiscal, contrib)) } catch { /* silencia */ }
  try { if (fiscal && contrib) resultado.push(...v02(fiscal, contrib)) } catch { /* silencia */ }
  try { if (contrib) resultado.push(...v03(contrib)) } catch { /* silencia */ }
  try { if (contrib) resultado.push(...v04(contrib)) } catch { /* silencia */ }
  try { if (contrib) resultado.push(...v05(contrib)) } catch { /* silencia */ }
  try { if (fiscal)  resultado.push(...v06(fiscal))  } catch { /* silencia */ }
  try { if (fiscal)  resultado.push(...v07(fiscal))  } catch { /* silencia */ }
  try { if (fiscal)  resultado.push(...v08(fiscal))  } catch { /* silencia */ }

  const ORDEM = { alto: 0, medio: 1, baixo: 2 }
  return resultado.sort((a, b) => (ORDEM[a.nivel] ?? 9) - (ORDEM[b.nivel] ?? 9))
}
