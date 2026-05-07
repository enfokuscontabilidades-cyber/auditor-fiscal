// Funções de parsing do SPED Fiscal e SPED Contribuições
// Extraídas e refatoradas de auditor_fiscal/page.tsx

import type {
  SpedFiscalParsed, SpedContribParsed, SpedCompany,
  SpedParticipant, SpedProduct, SpedDoc, SpedC190, SpedE110,
  SpedC170Contrib, SpedApuracaoContrib,
} from "./types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseSpedLine(line: string): string[] | null {
  if (!line.startsWith("|")) return null
  return line.split("|").slice(1, -1)
}

export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0
  return Number(String(v).replace(/\./g, "").replace(",", ".")) || 0
}

export function onlyDigits(v: string | undefined | null): string {
  return String(v || "").replace(/\D/g, "")
}

export function baseCnpj(cnpj: string | undefined | null): string {
  return onlyDigits(cnpj).slice(0, 8)
}

export function branchCnpj(cnpj: string | undefined | null): string {
  return onlyDigits(cnpj).slice(8, 12)
}

export function isMatrix(cnpj: string | undefined | null): boolean {
  return branchCnpj(cnpj) === "0001"
}

export function isSameGroup(a: string | undefined | null, b: string | undefined | null): boolean {
  return baseCnpj(a) !== "" && baseCnpj(a) === baseCnpj(b)
}

export function detectarTipoSped(text: string): "fiscal" | "contrib" | null {
  if (text.includes("|M001|") || text.includes("|M200|")) return "contrib"
  if (text.includes("|E001|") || text.includes("|E110|")) return "fiscal"
  return null
}

export function extractCnpjFromHeader(text: string): string {
  const line = text.split(/\r?\n/).find(l => l.startsWith("|0000|"))
  if (!line) return ""
  const fields = line.split("|")
  return fields.find(f => /^\d{14}$/.test(f)) ?? ""
}

function fdata(v: string): string {
  if (!v || v.length !== 8) return v || ""
  return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`
}

function isDateLike(v: string | undefined | null): boolean {
  return /^\d{8}$/.test(String(v || "").trim())
}

function isCnpjLike(v: string | undefined | null): boolean {
  return /^\d{14}$/.test(onlyDigits(v))
}

function isUfLike(v: string | undefined | null): boolean {
  return /^[A-Z]{2}$/.test(String(v || "").trim().toUpperCase())
}

function parseContribHeader0000(row: string[]): { periodoInicial: string; periodoFinal: string; nome: string; cnpj: string; uf: string } {
  const cnpjIdx = row.findIndex(v => isCnpjLike(v))
  if (cnpjIdx === -1) return { periodoInicial: "", periodoFinal: "", nome: "", cnpj: "", uf: "" }
  const cnpj = row[cnpjIdx] || ""
  const uf = isUfLike(row[cnpjIdx + 1]) ? row[cnpjIdx + 1] : ""
  const nome = row[cnpjIdx - 1] || ""
  const beforeCnpj = row.slice(0, cnpjIdx)
  const dateFields = beforeCnpj.filter(v => isDateLike(v))
  return {
    periodoInicial: dateFields.length >= 2 ? dateFields[dateFields.length - 2] : "",
    periodoFinal:   dateFields.length >= 1 ? dateFields[dateFields.length - 1] : "",
    nome, cnpj, uf,
  }
}

export function docTypeFromCfop(cfop: string, indOper?: string): "Entrada" | "Saída" | "Não identificado" {
  const p = (cfop || "")[0]
  if (["1", "2", "3"].includes(p)) return "Entrada"
  if (["5", "6", "7"].includes(p)) return "Saída"
  if (indOper === "0") return "Entrada"
  if (indOper === "1") return "Saída"
  return "Não identificado"
}

function ufType(cfop: string): string {
  const p = (cfop || "")[0]
  if (["1", "5"].includes(p)) return "Interna"
  if (["2", "6"].includes(p)) return "Interestadual"
  if (["3", "7"].includes(p)) return "Exterior"
  return "Outra"
}

function buildDocKey(doc: { chave?: string; numDoc?: string; dtDoc?: string; codPart?: string; vlDoc?: number }): string {
  const parts = (v: unknown) => String(v || "").trim()
  if (doc.chave && doc.chave.trim()) return doc.chave.trim().toUpperCase()
  return [doc.numDoc, doc.dtDoc, doc.codPart, doc.vlDoc].map(parts).filter(Boolean).join("|").toUpperCase()
}

export function formatarPeriodo(periodoInicial: string): string {
  if (periodoInicial.length === 8) return `${periodoInicial.slice(2, 4)}/${periodoInicial.slice(4)}`
  return periodoInicial
}

// ─── Parser SPED Fiscal ───────────────────────────────────────────────────────

export function parseFiscal(content: string, sourceLabel: string): SpedFiscalParsed {
  const lines = content.split(/\r?\n/)
  const result: SpedFiscalParsed = {
    company: null, participants: {}, products: {}, docs: [], c190: [], e110: null,
  }

  type DocCtx = {
    key: string; indOper: string; codPart: string; participante: string
    numDoc: string; chave: string; dtDoc: string; vlDoc: number
    base: number; icms: number; sourceCnpj: string; sourceLabel: string; periodo: string
  }
  let ctx: DocCtx | null = null

  for (const line of lines) {
    const row = parseSpedLine(line)
    if (!row) continue
    const reg = row[0]

    if (reg === "0000") {
      result.company = {
        periodoInicial: row[3] || "", periodoFinal: row[4] || "",
        nome: row[5] || "", cnpj: row[6] || "", uf: row[8] || "", ie: row[9] || "",
      }
    }
    if (reg === "0150") {
      result.participants[row[1]?.trim() || ""] = { nome: row[2] || "", cnpj: row[4] || "", cpf: row[5] || "", uf: row[8] || "" }
    }
    if (reg === "0200") {
      result.products[row[1]?.trim() || ""] = { descricao: row[2] || "", ncm: row[7] || "Sem NCM" }
    }

    if (reg === "C100") {
      const codPart = row[3]?.trim() || ""
      const chave = row[8] || ""
      const participante = result.participants[codPart]?.nome || codPart || "Sem participante"
      const sourceCnpj = result.company?.cnpj || ""
      const periodo = result.company ? `${result.company.periodoInicial}–${result.company.periodoFinal}` : ""
      const draft = { indOper: row[1] || "", codPart, participante, numDoc: row[7] || "", chave, dtDoc: row[9] || "", vlDoc: toNumber(row[11]), base: toNumber(row[20]), icms: toNumber(row[21]), sourceCnpj, sourceLabel, periodo }
      ctx = { ...draft, key: buildDocKey(draft) }
    }

    if (reg === "C190" && ctx) {
      const cfop = row[2] || ""
      result.c190.push({
        key: ctx.key, indOper: ctx.indOper, codPart: ctx.codPart,
        numDoc: ctx.numDoc, dtDoc: ctx.dtDoc, participante: ctx.participante,
        cfop, vlOpr: toNumber(row[4]), base: toNumber(row[5]), icms: toNumber(row[6]),
        ufOperacao: ufType(cfop), sourceCnpj: ctx.sourceCnpj, periodo: ctx.periodo,
      } as SpedC190 & { codPart: string })
    }

    if (reg === "E110") {
      const periodo = result.company ? `${result.company.periodoInicial}–${result.company.periodoFinal}` : ""
      result.e110 = {
        vlTotDebitos: toNumber(row[1]), vlTotCreditos: toNumber(row[5]),
        vlSldApurado: toNumber(row[10]), vlIcmsRecolher: toNumber(row[12]),
        vlSldCredorTransportar: toNumber(row[13]), periodo,
      }
    }
  }

  // Agregar docs a partir do C190
  const docsMap = new Map<string, { base: SpedDoc; cfops: Set<string> }>()
  for (const c of result.c190) {
    const composedKey = `${c.sourceCnpj}|${c.key}`
    if (!docsMap.has(composedKey)) {
      docsMap.set(composedKey, {
        base: {
          key: c.key, indOper: c.indOper, numDoc: c.numDoc, dtDoc: c.dtDoc,
          vlDoc: 0, base: 0, icms: 0, cfops: "",
          participante: c.participante, ufOperacao: c.ufOperacao,
          sourceCnpj: c.sourceCnpj, sourceLabel, periodo: c.periodo,
        },
        cfops: new Set(),
      })
    }
    const entry = docsMap.get(composedKey)!
    entry.base.vlDoc += c.vlOpr
    entry.base.base  += c.base
    entry.base.icms  += c.icms
    entry.cfops.add(c.cfop)
    if (entry.base.ufOperacao !== c.ufOperacao) entry.base.ufOperacao = "Mista"
  }
  result.docs = Array.from(docsMap.values()).map(e => ({ ...e.base, cfops: Array.from(e.cfops).join(", ") }))

  return result
}

// ─── Parser SPED Contribuições ────────────────────────────────────────────────

export function parseContrib(content: string): SpedContribParsed {
  const lines = content.split(/\r?\n/)
  const result: SpedContribParsed = {
    company: null, docs: [], c170contrib: [], m200: null, m600: null, isZeroed: false,
  }
  const participants: Record<string, SpedParticipant> = {}
  const products: Record<string, SpedProduct> = {}

  // Itens intermediários para agregar docs
  const itemsForDocs: { key: string; indOper: string; codPart: string; participante: string; numDoc: string; dtDoc: string; vlItem: number; ufOperacao: string; periodo: string }[] = []

  type DocCtx = { key: string; indOper: string; codPart: string; participante: string; numDoc: string; dtDoc: string; periodo: string }
  let ctx: DocCtx | null = null
  let currentPeriodo = ""

  for (const line of lines) {
    const row = parseSpedLine(line)
    if (!row) continue
    const reg = row[0]

    if (reg === "0000") {
      const header = parseContribHeader0000(row)
      result.company = { periodoInicial: header.periodoInicial, periodoFinal: header.periodoFinal, nome: header.nome, cnpj: header.cnpj, uf: header.uf, ie: "" }
      currentPeriodo = `${header.periodoInicial}–${header.periodoFinal}`
    }
    if (reg === "0150") {
      participants[row[1]?.trim() || ""] = { nome: row[2] || "", cnpj: row[4] || "", cpf: row[5] || "" }
    }
    if (reg === "0200") {
      products[row[1]?.trim() || ""] = { descricao: row[2] || "", ncm: row[7] || "Sem NCM" }
    }

    if (reg === "C100") {
      const codPart = row[3]?.trim() || row[2]?.trim() || ""
      const participante = participants[codPart]?.nome || codPart || "Sem participante"
      // CHV_NFE é campo obrigatório em row[8] para NF-e; tentar todos
      const chave = [row[8], row[9]].find(v => /^\d{44}$/.test(v || "")) || row[8] || ""
      const numDoc = row[7] || row[6] || ""
      const dtDoc  = row[9] || row[10] || ""
      const draft  = { indOper: row[1] || "", codPart, participante, numDoc, chave, dtDoc, vlDoc: toNumber(row[11]) || toNumber(row[12]) }
      ctx = { key: buildDocKey(draft), indOper: draft.indOper, codPart, participante, numDoc, dtDoc, periodo: currentPeriodo }
    }

    if (reg === "C170" && ctx) {
      const codItem = row[2]?.trim() || ""
      const produto  = products[codItem]
      const vlItem   = toNumber(row[6]) || toNumber(row[7])
      const cfop     = produto ? "" : row[11] || ""   // Contrib C170 não tem CFOP direto
      itemsForDocs.push({
        key: ctx.key, indOper: ctx.indOper, codPart: ctx.codPart,
        participante: ctx.participante, numDoc: ctx.numDoc, dtDoc: ctx.dtDoc,
        vlItem, ufOperacao: ufType(cfop), periodo: ctx.periodo,
      })

      // Capturar campos PIS/COFINS
      result.c170contrib.push({
        docKey: ctx.key, numItem: row[1] || "", codItem,
        vlItem,
        cstPis: row[9] || "",    vlBcPis:    toNumber(row[10]), aliqPis:    toNumber(row[11]), vlPis:    toNumber(row[12]),
        cstCofins: row[13] || "",vlBcCofins: toNumber(row[14]), aliqCofins: toNumber(row[15]), vlCofins: toNumber(row[16]),
        periodo: ctx.periodo,
      })
    }

    // Apuração PIS (M200)
    if (reg === "M200") {
      result.m200 = {
        vlRecBrt:    toNumber(row[1]),
        vlBcCont:    toNumber(row[2]),
        vlContNc:    toNumber(row[6]),
        vlContPer:   toNumber(row[9]),
        vlContPagar: toNumber(row[16]),
        periodo: currentPeriodo,
      }
    }

    // Apuração COFINS (M600)
    if (reg === "M600") {
      result.m600 = {
        vlRecBrt:    toNumber(row[1]),
        vlBcCont:    toNumber(row[2]),
        vlContNc:    toNumber(row[6]),
        vlContPer:   toNumber(row[9]),
        vlContPagar: toNumber(row[16]),
        periodo: currentPeriodo,
      }
    }
  }

  // Agregar docs a partir dos itens C170
  const docsMap = new Map<string, { base: SpedDoc; cfops: Set<string> }>()
  for (const item of itemsForDocs) {
    if (!docsMap.has(item.key)) {
      docsMap.set(item.key, {
        base: {
          key: item.key, indOper: item.indOper, numDoc: item.numDoc, dtDoc: item.dtDoc,
          vlDoc: 0, base: 0, icms: 0, cfops: "",
          participante: item.participante, ufOperacao: item.ufOperacao,
          sourceCnpj: result.company?.cnpj || "", sourceLabel: "",
          periodo: item.periodo,
        },
        cfops: new Set(),
      })
    }
    const entry = docsMap.get(item.key)!
    entry.base.vlDoc += item.vlItem
    if (item.ufOperacao && entry.base.ufOperacao !== item.ufOperacao) entry.base.ufOperacao = "Mista"
  }
  result.docs = Array.from(docsMap.values()).map(e => ({ ...e.base, cfops: Array.from(e.cfops).join(", ") }))
  result.isZeroed = result.docs.length === 0 && result.c170contrib.length === 0

  return result
}

// ─── Merge ────────────────────────────────────────────────────────────────────

export function mergeFiscalDatasets(datasets: SpedFiscalParsed[]): SpedFiscalParsed | null {
  if (!datasets.length) return null
  const company = datasets[0].company
  const participants: Record<string, SpedParticipant> = {}
  const products: Record<string, SpedProduct> = {}
  const docsMap = new Map<string, SpedDoc>()
  const c190: SpedC190[] = []
  const e110List: SpedE110[] = []

  for (const ds of datasets) {
    Object.assign(participants, ds.participants)
    Object.assign(products, ds.products)
    ds.docs.forEach(d => docsMap.set(`${d.sourceCnpj}|${d.periodo}|${d.key}`, d))
    c190.push(...ds.c190)
    if (ds.e110) e110List.push(ds.e110)
  }

  // Soma e110s de múltiplos períodos
  const e110 = e110List.length === 0 ? null : e110List.reduce<SpedE110>((acc, e) => ({
    vlTotDebitos: acc.vlTotDebitos + e.vlTotDebitos,
    vlTotCreditos: acc.vlTotCreditos + e.vlTotCreditos,
    vlSldApurado: acc.vlSldApurado + e.vlSldApurado,
    vlIcmsRecolher: acc.vlIcmsRecolher + e.vlIcmsRecolher,
    vlSldCredorTransportar: acc.vlSldCredorTransportar + e.vlSldCredorTransportar,
    periodo: e110List.length > 1 ? "Múltiplos períodos" : e.periodo,
  }), { vlTotDebitos: 0, vlTotCreditos: 0, vlSldApurado: 0, vlIcmsRecolher: 0, vlSldCredorTransportar: 0, periodo: "" })

  return { company, participants, products, docs: Array.from(docsMap.values()), c190, e110 }
}

export function mergeContribDatasets(datasets: SpedContribParsed[]): SpedContribParsed | null {
  if (!datasets.length) return null
  const company = datasets[0].company
  const docsMap = new Map<string, SpedDoc>()
  const c170contrib: SpedC170Contrib[] = []

  let m200acc: SpedApuracaoContrib = { vlRecBrt: 0, vlBcCont: 0, vlContNc: 0, vlContPer: 0, vlContPagar: 0, periodo: "" }
  let m600acc: SpedApuracaoContrib = { vlRecBrt: 0, vlBcCont: 0, vlContNc: 0, vlContPer: 0, vlContPagar: 0, periodo: "" }
  let hasM200 = false; let hasM600 = false

  for (const ds of datasets) {
    ds.docs.forEach(d => docsMap.set(`${d.sourceCnpj}|${d.periodo}|${d.key}`, d))
    c170contrib.push(...ds.c170contrib)
    if (ds.m200) { hasM200 = true; m200acc = sumApuracao(m200acc, ds.m200) }
    if (ds.m600) { hasM600 = true; m600acc = sumApuracao(m600acc, ds.m600) }
  }

  return {
    company, docs: Array.from(docsMap.values()), c170contrib,
    m200: hasM200 ? m200acc : null,
    m600: hasM600 ? m600acc : null,
    isZeroed: docsMap.size === 0 && c170contrib.length === 0,
  }
}

function sumApuracao(a: SpedApuracaoContrib, b: SpedApuracaoContrib): SpedApuracaoContrib {
  return {
    vlRecBrt: a.vlRecBrt + b.vlRecBrt,
    vlBcCont: a.vlBcCont + b.vlBcCont,
    vlContNc: a.vlContNc + b.vlContNc,
    vlContPer: a.vlContPer + b.vlContPer,
    vlContPagar: a.vlContPagar + b.vlContPagar,
    periodo: "Múltiplos períodos",
  }
}
