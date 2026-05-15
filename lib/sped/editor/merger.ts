import { isSameGroup } from "../parsers"
import type {
  SpedEditorParsed, SpedRegistro, Sped0190, Sped0200Ext, Sped0220,
  ConflitoRegistro, LogAlteracao, ResultadoMescla,
} from "./types"

const CAMPOS_COMPARE: (keyof Sped0200Ext)[] = [
  "descr_item", "unid_inv", "tipo_item", "cod_ncm", "aliq_icms", "cest",
]

function makeReg(bloco: string, tipo: string, campos: string[]): SpedRegistro {
  return { bloco, tipo, campos, linhaOriginal: -1 }
}

function campos0200(p: Sped0200Ext): string[] {
  return ["0200", p.cod_item, p.descr_item, p.cod_barra, p.cod_ant_item,
          p.unid_inv, p.tipo_item, p.cod_ncm, p.ex_ipi, p.cod_gen,
          p.cod_lst, p.aliq_icms, p.cest]
}

// ─── Merger principal ─────────────────────────────────────────────────────────

export function mesclarSped(
  parsedA: SpedEditorParsed,
  parsedB: SpedEditorParsed,
  resolucoes: Record<string, "A" | "B">,
  produtosEditados: Record<string, Sped0200Ext>,
): ResultadoMescla {
  const log: LogAlteracao[]       = []
  const warnings: string[]        = []
  const conflitos: ConflitoRegistro[] = []
  const now = new Date().toISOString()

  const produtosK = new Set(parsedB.resumo.produtosNoK.filter(Boolean))

  const novos0190  = new Map<string, Sped0190>()
  const novos0200  = new Map<string, string[]>()   // cod_item → campos
  const novos0220  = new Map<string, string[][]>() // cod_item → list of campos
  const subst0200  = new Map<string, string[]>()   // cod_item → campos (replace)

  for (const codItem of produtosK) {
    const prodB = parsedB.r0200[codItem]
    if (!prodB) {
      warnings.push(`Produto "${codItem}" do Bloco K não encontrado no 0200 do arquivo B`)
      continue
    }

    const editado   = produtosEditados[codItem]
    const prodFinal = editado ?? prodB
    const prodA     = parsedA.r0200[codItem]

    if (!prodA) {
      // New product from B
      novos0200.set(codItem, campos0200(prodFinal))
      log.push({ tipo: "inserido", bloco: "0", registro: "0200",
        descricao: `Produto ${codItem} (${prodFinal.descr_item}) importado do arquivo B`,
        origem: "mescla_automatica", timestamp: now })

      const unid = prodFinal.unid_inv
      if (unid && !parsedA.r0190[unid] && parsedB.r0190[unid]) {
        novos0190.set(unid, parsedB.r0190[unid])
        log.push({ tipo: "inserido", bloco: "0", registro: "0190",
          descricao: `Unidade "${unid}" importada do arquivo B`,
          origem: "mescla_automatica", timestamp: now })
      }

      const conv = parsedB.r0220[codItem]
      if (conv?.length) {
        novos0220.set(codItem, conv.map(c => ["0220", c.cod_item, c.unid_conv, c.fat_conv]))
        log.push({ tipo: "inserido", bloco: "0", registro: "0220",
          descricao: `Fatores de conversão do produto ${codItem}`,
          origem: "mescla_automatica", timestamp: now })
      }
    } else {
      const divergentes = CAMPOS_COMPARE.filter(
        c => (prodA[c] ?? "").trim().toUpperCase() !== (prodB[c] ?? "").trim().toUpperCase()
      )
      if (divergentes.length > 0) {
        const res = (resolucoes[codItem] as "A" | "B" | undefined) ?? null
        conflitos.push({
          tipo: "0200", codigo: codItem,
          label: prodA.descr_item || prodB.descr_item,
          camposDivergentes: divergentes,
          valorA: Object.fromEntries(CAMPOS_COMPARE.map(c => [c, prodA[c] ?? ""])),
          valorB: Object.fromEntries(CAMPOS_COMPARE.map(c => [c, prodB[c] ?? ""])),
          resolucao: res,
        })
        if (res === "B") {
          subst0200.set(codItem, campos0200(prodFinal))
          log.push({ tipo: "substituido", bloco: "0", registro: "0200",
            descricao: `Produto ${codItem} substituído pela versão do arquivo B`,
            origem: "mescla_automatica", timestamp: now })
        } else if (!res) {
          warnings.push(`Conflito não resolvido para o produto "${codItem}" — mantida a versão do arquivo A`)
        }
      }
    }
  }

  // Build merged block 0
  const bloco0Final = buildBloco0(parsedA.raw, novos0190, novos0200, novos0220, subst0200)

  // K records from B
  const kRecordsB = parsedB.raw.filter(r => r.bloco === "K")
  if (kRecordsB.length > 0) {
    log.push({ tipo: "inserido", bloco: "K", registro: "K001-K990",
      descricao: `${kRecordsB.length} registros do Bloco K importados do arquivo B`,
      origem: "mescla_automatica", timestamp: now })
  }

  // Assemble by block order: 0 A B C D E G H K 1 9
  const BLOCK_ORDER = ["0", "A", "B", "C", "D", "E", "G", "H", "K", "1", "9"]
  const byBloco: Record<string, SpedRegistro[]> = { "0": bloco0Final, "K": kRecordsB }
  for (const r of parsedA.raw) {
    if (r.bloco === "0" || r.bloco === "K") continue
    if (!byBloco[r.bloco]) byBloco[r.bloco] = []
    byBloco[r.bloco].push(r)
  }

  const registros: SpedRegistro[] = []
  for (const b of BLOCK_ORDER) {
    if (byBloco[b]) registros.push(...byBloco[b])
  }

  return { registros, conflitos, log, warnings }
}

// ─── Montagem do Bloco 0 com inserções ───────────────────────────────────────

function buildBloco0(
  rawA: SpedRegistro[],
  novos0190: Map<string, Sped0190>,
  novos0200: Map<string, string[]>,
  novos0220: Map<string, string[][]>,
  subst0200: Map<string, string[]>,
): SpedRegistro[] {
  const recs   = rawA.filter(r => r.bloco === "0" && r.tipo !== "0990")
  const closer = rawA.find(r => r.tipo === "0990")
  const codsSubst = new Set(subst0200.keys())

  let last0190    = -1
  let last0200220 = -1
  for (let i = 0; i < recs.length; i++) {
    if (recs[i].tipo === "0190") last0190 = i
    if (recs[i].tipo === "0200" || recs[i].tipo === "0220") last0200220 = i
  }

  const result: SpedRegistro[] = []

  for (let i = 0; i < recs.length; i++) {
    const r = recs[i]
    if (r.tipo === "0200" || r.tipo === "0220") {
      const cod = r.campos[1]?.trim() || ""
      if (codsSubst.has(cod)) continue
    }
    result.push(r)

    if (i === last0190) {
      for (const [, u] of novos0190) {
        result.push(makeReg("0", "0190", ["0190", u.unid, u.descr]))
      }
    }

    if (i === last0200220) {
      appendNewProducts(result, novos0200, novos0220)
      for (const [, campos] of subst0200) {
        result.push(makeReg("0", "0200", campos))
      }
    }
  }

  // Edge: no 0190 in A → insert after last 0150/0175
  if (last0190 === -1 && novos0190.size > 0) {
    let idx = result.length
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].tipo === "0150" || result[i].tipo === "0175") { idx = i + 1; break }
    }
    result.splice(idx, 0,
      ...[...novos0190.values()].map(u => makeReg("0", "0190", ["0190", u.unid, u.descr])))
  }

  // Edge: no 0200/0220 in A → insert at end (before closure)
  if (last0200220 === -1) {
    appendNewProducts(result, novos0200, novos0220)
    for (const [, campos] of subst0200) {
      result.push(makeReg("0", "0200", campos))
    }
  }

  if (closer) result.push(closer)
  return result
}

function appendNewProducts(
  result: SpedRegistro[],
  novos0200: Map<string, string[]>,
  novos0220: Map<string, string[][]>,
) {
  for (const [codItem, campos] of novos0200) {
    result.push(makeReg("0", "0200", campos))
    for (const c of novos0220.get(codItem) ?? []) {
      result.push(makeReg("0", "0220", c))
    }
  }
}

// ─── Validação de CNPJ e período ─────────────────────────────────────────────

export function validarCnpjPeriodo(a: SpedEditorParsed, b: SpedEditorParsed): string[] {
  const erros: string[] = []
  if (!isSameGroup(a.resumo.cnpj, b.resumo.cnpj)) {
    erros.push(`CNPJ divergente: A (${a.resumo.cnpj}) e B (${b.resumo.cnpj}) não pertencem ao mesmo grupo`)
  }
  if (a.resumo.periodoInicial !== b.resumo.periodoInicial ||
      a.resumo.periodoFinal   !== b.resumo.periodoFinal) {
    erros.push(`Período divergente: A (${a.resumo.periodoInicial}–${a.resumo.periodoFinal}) ≠ B (${b.resumo.periodoInicial}–${b.resumo.periodoFinal})`)
  }
  return erros
}

// ─── Produtos novos (não em A, referenciados no K de B) ──────────────────────

export function getProdutosNovos(
  parsedA: SpedEditorParsed,
  parsedB: SpedEditorParsed,
): Sped0200Ext[] {
  return parsedB.resumo.produtosNoK
    .filter(cod => cod && !parsedA.r0200[cod] && parsedB.r0200[cod])
    .map(cod => parsedB.r0200[cod])
}
