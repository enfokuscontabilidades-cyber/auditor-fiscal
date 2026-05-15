import type { SpedRegistro } from "./types"

const BLOCK_ORDER    = ["0", "A", "B", "C", "D", "E", "G", "H", "K", "1"]
const REQUIRED_BLOCKS = new Set(["A", "B", "1"])
const CLOSURE_SET    = new Set(["0990","A990","B990","C990","D990","E990","G990","H990","K990","1990","9990"])
const BLOCK_SORT_ORDER = ["0","A","B","C","D","E","G","H","K","1","9"]

export function gerarSpedTxt(registros: SpedRegistro[]): string {
  // Remove existing closure records and all block-9 records; we rebuild them
  const work = registros.filter(r => r.bloco !== "9" && !CLOSURE_SET.has(r.tipo))

  // Group by block
  const byBloco: Record<string, SpedRegistro[]> = {}
  for (const r of work) {
    if (!byBloco[r.bloco]) byBloco[r.bloco] = []
    byBloco[r.bloco].push(r)
  }

  const allLines: string[] = []
  const typeCounts: Record<string, number> = {}

  // ── Serialize non-9 blocks with closures ─────────────────────────────────

  for (const bloco of BLOCK_ORDER) {
    const recs = byBloco[bloco]
    if (!recs?.length) {
      if (REQUIRED_BLOCKS.has(bloco)) {
        const openTipo    = `${bloco}001`
        const closureTipo = `${bloco}990`
        allLines.push(`|${openTipo}|1|`)
        allLines.push(`|${closureTipo}|2|`)
        typeCounts[openTipo]    = (typeCounts[openTipo]    ?? 0) + 1
        typeCounts[closureTipo] = (typeCounts[closureTipo] ?? 0) + 1
      }
      continue
    }

    const blockLines: string[] = []
    for (const r of recs) {
      const line = "|" + r.campos.join("|") + "|"
      blockLines.push(line)
      typeCounts[r.tipo] = (typeCounts[r.tipo] ?? 0) + 1
    }

    const closureTipo = `${bloco}990`
    const qtLin = blockLines.length + 1
    blockLines.push(`|${closureTipo}|${qtLin}|`)
    typeCounts[closureTipo] = (typeCounts[closureTipo] ?? 0) + 1
    allLines.push(...blockLines)
  }

  // ── Build block 9 ─────────────────────────────────────────────────────────

  // We know: 9001, 9990, 9999 will each appear once
  // 9900 appears once per distinct register type (including itself)
  const preview: Record<string, number> = { ...typeCounts, "9001": 1, "9990": 1, "9999": 1 }
  // n9900 = number of distinct types after adding 9900 itself
  const n9900 = Object.keys(preview).length + 1   // +1 for 9900 itself
  preview["9900"] = n9900

  const bloco9: string[] = []
  bloco9.push("|9001|0|")

  const sortedTypes = Object.keys(preview).sort((a, b) => {
    const pa = BLOCK_SORT_ORDER.findIndex(p => a.startsWith(p))
    const pb = BLOCK_SORT_ORDER.findIndex(p => b.startsWith(p))
    if (pa !== pb) return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb)
    return a.localeCompare(b)
  })
  for (const tipo of sortedTypes) {
    bloco9.push(`|9900|${tipo}|${preview[tipo]}|`)
  }

  // QT_LIN_9 = 9001 + N×9900 + 9990 + 9999
  const qtLin9 = 1 + n9900 + 2
  bloco9.push(`|9990|${qtLin9}|`)

  const totalLines = allLines.length + bloco9.length + 1  // +1 for 9999 itself
  bloco9.push(`|9999|${totalLines}|`)

  allLines.push(...bloco9)

  return allLines.join("\r\n") + "\r\n"
}
