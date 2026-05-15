import type { SpedEditorParsed, ErroValidacao, SpedRegistro } from "./types"

export function validarArquivoFinal(
  registros: SpedRegistro[],
  parsedA: SpedEditorParsed,
  parsedB: SpedEditorParsed,
): ErroValidacao[] {
  const erros: ErroValidacao[] = []

  const produtos0200 = new Set<string>()
  const unidades0190 = new Set<string>()
  const contagem0200 = new Map<string, number>()

  for (const r of registros) {
    if (r.tipo === "0190") {
      const unid = r.campos[1]?.trim()
      if (unid) unidades0190.add(unid)
    }
    if (r.tipo === "0200") {
      const cod = r.campos[1]?.trim()
      if (cod) {
        produtos0200.add(cod)
        contagem0200.set(cod, (contagem0200.get(cod) ?? 0) + 1)
      }
    }
  }

  // V01 — Produtos do K devem existir no 0200 final
  const faltando = parsedB.resumo.produtosNoK.filter(c => c && !produtos0200.has(c))
  if (faltando.length > 0) {
    erros.push({
      id: "V01", nivel: "erro",
      descricao: `${faltando.length} produto(s) do Bloco K não encontrado(s) no 0200 final`,
      detalhes: faltando.slice(0, 20).join(", ") + (faltando.length > 20 ? ` (+${faltando.length - 20})` : ""),
    })
  }

  // V02 — UNID_INV do 0200 deve ter registro no 0190
  const unidSemCad: string[] = []
  for (const r of registros) {
    if (r.tipo === "0200") {
      const unid = r.campos[5]?.trim()
      if (unid && !unidades0190.has(unid) && !unidSemCad.includes(unid)) {
        unidSemCad.push(unid)
      }
    }
  }
  if (unidSemCad.length > 0) {
    erros.push({
      id: "V02", nivel: "aviso",
      descricao: `${unidSemCad.length} unidade(s) em 0200 sem cadastro no 0190`,
      detalhes: unidSemCad.slice(0, 10).join(", "),
    })
  }

  // V03 — Sem duplicidade no 0200
  const dup = [...contagem0200.entries()].filter(([, n]) => n > 1).map(([c]) => c)
  if (dup.length > 0) {
    erros.push({
      id: "V03", nivel: "erro",
      descricao: `${dup.length} produto(s) duplicado(s) no 0200`,
      detalhes: dup.join(", "),
    })
  }

  // V04 — K001 deve estar presente se há registros K
  const temK = registros.some(r => r.bloco === "K" && r.tipo !== "K001" && r.tipo !== "K990")
  const temK001 = registros.some(r => r.tipo === "K001")
  if (temK && !temK001) {
    erros.push({ id: "V04", nivel: "erro", descricao: "Bloco K sem registro K001 (abertura obrigatória)" })
  }

  // V05 — K990 deve estar presente se há K001
  const temK990 = registros.some(r => r.tipo === "K990")
  if (temK001 && !temK990) {
    erros.push({ id: "V05", nivel: "aviso", descricao: "K001 presente mas K990 (encerramento) não encontrado — será gerado automaticamente" })
  }

  // V07 — CNPJ dos arquivos de origem compatíveis
  const cnpjA = parsedA.resumo.cnpj.replace(/\D/g, "").slice(0, 8)
  const cnpjB = parsedB.resumo.cnpj.replace(/\D/g, "").slice(0, 8)
  if (cnpjA && cnpjB && cnpjA !== cnpjB) {
    erros.push({ id: "V07", nivel: "aviso", descricao: `CNPJ dos arquivos de origem de grupos diferentes (${cnpjA} × ${cnpjB})` })
  }

  // V08 — Períodos compatíveis
  if (parsedA.resumo.periodoInicial && parsedB.resumo.periodoInicial &&
      (parsedA.resumo.periodoInicial !== parsedB.resumo.periodoInicial ||
       parsedA.resumo.periodoFinal   !== parsedB.resumo.periodoFinal)) {
    erros.push({ id: "V08", nivel: "aviso", descricao: "Os arquivos de origem são de períodos diferentes" })
  }

  return erros
}
