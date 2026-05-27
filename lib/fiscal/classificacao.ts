// lib/fiscal/classificacao.ts
// Biblioteca compartilhada de classificação fiscal
// Usada pelo Validador de Itens SPED (Fase 5) e futuramente por outros módulos.
// NÃO modifica validador_entradas/page.tsx — as funções aqui são cópias independentes.

import type { SpedC170Item } from "@/lib/sped/types"

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES DE NCM
// ═══════════════════════════════════════════════════════════════════════════════

/** NCMs tipicamente de uso e consumo */
export const NCM_UC: string[] = [
  "1006","0713","1701","1507","1511","1512","1517",
  "2201","2202","2203","2204","2205","2206","2207","2208",
  "0901","0902","1905","2101","2106",
  "3003","3004","3005",
  "3303","3304","3305","3306","3307",
  "3401","3402","3808","3924","4818","4823",
  "9603","9608",
  // Cama, mesa e banho (têxteis domésticos)
  "6301","6302","6304",
  // Artigos de vidro para mesa/cozinha
  "7013",
  // Artigos de ferro/aço inox doméstico
  "7323",
  // Cutelaria e talheres
  "8211","8215",
  // Louças e porcelana
  "6911","6912",
  // Artigos de plástico para banheiro/cozinha
  "3922",
]

/** NCMs tipicamente de ativo imobilizado */
export const NCM_IMOB: string[] = [
  "7321","8210","8414","8415","8418","8421","8422","8428",
  "8436","8450","8467","8470","8471","8472","8479",
  "8508","8509","8516","8517","8518","8528","8539",
  "8709","8716","9018","9403","9405",
]

/** NCMs tipicamente de combustíveis e lubrificantes */
export const NCM_COMB: string[] = ["2710","2711","220710","220720","382600"]

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

export type ClassificacaoItem =
  | "revenda"
  | "insumo"
  | "uso_consumo"
  | "imobilizado"
  | "combustivel"
  | "servico"
  | null

export type AnaliseSugestao = {
  tipo: "uso_consumo" | "imobilizado" | "combustivel" | null
  motivo: string
  confianca: "alta" | "media" | "baixa" | null
}

export type AlertaItemSped = {
  nivel: "alto" | "medio" | "baixo"
  codigo: string
  titulo: string
  motivo: string
  sugestao: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ═══════════════════════════════════════════════════════════════════════════════

/** Verifica se o NCM começa com algum prefixo da lista */
function ncm2(ncm: string, lst: string[]): string | null {
  const l = String(ncm || "").replace(/\D/g, "")
  return l ? (lst.find(p => l.startsWith(p)) ?? null) : null
}

/** Normaliza CFOP para 4 dígitos numéricos */
function ncfop(cfop: string): string {
  return String(cfop || "").replace(/\D/g, "").slice(0, 4)
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSIFICAÇÃO POR CFOP
// ═══════════════════════════════════════════════════════════════════════════════

export function famCFOP(cfop: string): "revenda" | "industrializacao" | "uso_consumo" | "imobilizado" | "outro" {
  const f = ncfop(cfop).slice(2)
  if (["55", "56"].includes(f)) return "uso_consumo"
  if (["51"].includes(f))       return "imobilizado"
  if (["01"].includes(f))       return "industrializacao"
  if (["02"].includes(f))       return "revenda"
  return "outro"
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISE DE PRODUTO (versão para SPED — sem perfil de empresa)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analisa um produto pelo NCM e descrição, retornando sugestão de classificação.
 * No contexto do SPED, não há perfil de empresa — usa lógica "geral".
 */
export function analisarProduto(desc: string, ncm: string): AnaliseSugestao {
  const t = desc.toLowerCase()

  // 1. NCM de combustível
  const nc = ncm2(ncm, NCM_COMB)
  if (nc) return { tipo: "combustivel", motivo: `NCM compatível com combustível (prefixo ${nc})`, confianca: "alta" }

  // 2. NCM de uso e consumo
  const nu = ncm2(ncm, NCM_UC)
  if (nu) return { tipo: "uso_consumo", motivo: `NCM compatível com uso e consumo (prefixo ${nu})`, confianca: "alta" }

  // 3. NCM de imobilizado
  const ni = ncm2(ncm, NCM_IMOB)
  if (ni) return { tipo: "imobilizado", motivo: `NCM compatível com máquina/equipamento (prefixo ${ni})`, confianca: "alta" }

  // 4. Palavras-chave de combustível na descrição
  const palComb = ["gasolina","diesel","etanol","alcool","álcool","gnv","gás","oleo diesel","óleo diesel","combustivel","combustível","lubrificante"]
  const fcc = palComb.find(p => t.includes(p))
  if (fcc) return { tipo: "combustivel", motivo: `descrição contém "${fcc}"`, confianca: "media" }

  // 5. Palavras-chave de imobilizado na descrição
  const palImob = ["máquina","maquina","equipamento","compressor","freezer","geladeira","balança","balanca","empilhadeira","motor","forno","coifa","exaustor","notebook","computador","impressora","servidor","monitor","scanner","leitor","betoneira","andaime","furadeira","parafusadeira","serra","cortadora","misturador","microondas","liquidificador","batedeira","fogão","fogao","ar condicionado","inversor","nobreak","estabilizador"]
  const fi = palImob.find(p => t.includes(p))
  if (fi) return { tipo: "imobilizado", motivo: `descrição contém "${fi}"`, confianca: "media" }

  // 6. Palavras-chave de uso e consumo na descrição
  const palUC = [
    "arroz","feijão","feijao","açúcar","acucar","óleo","oleo","café","cafe","água","agua",
    "refrigerante","suco","cerveja","vinho","whisky","vodka","gin","leite","biscoito",
    "guardanapo","detergente","sabão","sabao","desinfetante","papel higiênico","papel higienico",
    "copo descartável","copo descartavel","papel sulfite","caneta","lapis","lápis","borracha",
    "grampeador","clips","vassoura","rodo","saco de lixo","água sanitária","agua sanitaria",
    "produto de limpeza","material de limpeza","medicamento","remedio","remédio","shampoo",
    "condicionador","sabonete","creme dental","pasta de dente","escova de dente","absorvente",
    "fralda","papel toalha","alcool em gel","álcool em gel","protetor solar","hidratante",
    "desodorante","algodão","algodao","curativo","gaze","esparadrapo",
    "toalha","lençol","fronha","colcha","cobertor","edredom","travesseiro",
    "prato","xícara","xcara","caneca","talher","talheres","garfo","colher de","concha de servir",
    "utensílio","utensilio","panela","frigideira","assadeira","bacia","balde","escorredor",
  ]
  const fu = palUC.find(p => t.includes(p))
  if (fu) return { tipo: "uso_consumo", motivo: `descrição contém "${fu}"`, confianca: "media" }

  return { tipo: null, motivo: "", confianca: null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUGESTÃO DE CLASSIFICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retorna a classificação sugerida para um item com base em NCM, descrição e CFOP.
 */
export function sugerirClassificacao(
  ncm: string,
  desc: string,
  cfop: string,
  ehIndustrial = false,
): ClassificacaoItem {
  const sugestao = analisarProduto(desc, ncm)
  if (sugestao.tipo === "uso_consumo") return "uso_consumo"
  if (sugestao.tipo === "imobilizado") return "imobilizado"
  if (sugestao.tipo === "combustivel") return "combustivel"

  const fam = famCFOP(cfop)
  if (fam === "industrializacao") return ehIndustrial ? "insumo" : "revenda"
  if (fam === "revenda")          return "revenda"
  if (fam === "uso_consumo")      return "uso_consumo"
  if (fam === "imobilizado")      return "imobilizado"

  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO DE ITENS SPED
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Valida um item do SPED Fiscal (C170) e retorna classificação sugerida + alertas.
 *
 * @param item       - Item C170 do SPED Fiscal
 * @param temCiap    - true se o SPED possui bloco G com movimentações CIAP
 * @param ehIndustrial - true se a empresa é industrial (IND_ATIV=0 no SPED)
 */
export function validarItemSped(
  item: SpedC170Item,
  temCiap: boolean,
  ehIndustrial: boolean,
): { classificacao: ClassificacaoItem; alertas: AlertaItemSped[] } {
  const alertas: AlertaItemSped[] = []
  const classificacao = sugerirClassificacao(item.ncm, item.descricao, item.cfop, ehIndustrial)
  const cstBase = item.cstIcms.replace(/\D/g, "")

  // ── UC_CREDITO_INDEVIDO ──────────────────────────────────────────────────────
  if (classificacao === "uso_consumo" && item.vlIcms > 0) {
    alertas.push({
      nivel: "alto",
      codigo: "UC_CREDITO_INDEVIDO",
      titulo: "Uso e consumo com crédito de ICMS",
      motivo: `Item classificado como uso e consumo com crédito de ICMS de R$ ${item.vlIcms.toFixed(2).replace(".", ",")}. Art. 33 LC 87/1996 veda o aproveitamento.`,
      sugestao: "Estornar o crédito de ICMS ou reclassificar o produto se a destinação for diferente.",
    })
  }

  // ── IMOB_SEM_CIAP ────────────────────────────────────────────────────────────
  if (classificacao === "imobilizado" && item.vlIcms > 0 && !temCiap) {
    alertas.push({
      nivel: "alto",
      codigo: "IMOB_SEM_CIAP",
      titulo: "Ativo imobilizado com crédito sem CIAP",
      motivo: `Item classificado como ativo imobilizado com crédito de ICMS, mas o SPED não possui bloco G (CIAP) com movimentações.`,
      sugestao: "Verificar se o crédito está sendo controlado via CIAP (1/48 ao mês) — o bloco G deve ser preenchido.",
    })
  }

  // ── CFOP_CLASSIFICACAO_INCOMPATIVEL ──────────────────────────────────────────
  if (classificacao !== null) {
    const fam = famCFOP(item.cfop)
    let incompativel = false

    if (classificacao === "uso_consumo" && fam !== "uso_consumo" && fam !== "imobilizado" && fam !== "outro") {
      incompativel = true
    }
    if (classificacao === "imobilizado" && fam !== "imobilizado" && fam !== "uso_consumo" && fam !== "outro") {
      incompativel = true
    }
    if (classificacao === "combustivel" && fam !== "uso_consumo" && fam !== "outro") {
      incompativel = true
    }
    if (classificacao === "revenda" && fam !== "revenda" && fam !== "industrializacao" && fam !== "outro") {
      incompativel = true
    }

    if (incompativel) {
      alertas.push({
        nivel: "medio",
        codigo: "CFOP_CLASSIFICACAO_INCOMPATIVEL",
        titulo: "CFOP incompatível com classificação sugerida",
        motivo: `CFOP ${item.cfop} (família: ${fam}) parece incompatível com a classificação sugerida "${classificacao}".`,
        sugestao: "Revisar o CFOP utilizado ou confirmar a destinação real do produto.",
      })
    }
  }

  // ── NCM_ST_CLASSIFICACAO ─────────────────────────────────────────────────────
  // NCMs do Anexo VIII RICMS/GO sujeitos a ST — CST esperado: 10, 30, 60 ou 70
  const NCM_ST_GOIAS_PREFIXOS = [
    "2402","2403","2710","3303","3304","3305","3306","3307",
    "3401","3402","3808","6910","6911","6912","7010","7013",
    "8214","8215","8414","8415","8418","8421","8422","8450",
    "8467","8508","8509","8516","8539","8544","9006","9018",
    "9603","9608",
  ]
  const cstsSt = ["10","30","60","70"]
  const ncmSt = ncm2(item.ncm, NCM_ST_GOIAS_PREFIXOS)
  if (ncmSt && !cstsSt.includes(cstBase)) {
    alertas.push({
      nivel: "medio",
      codigo: "NCM_ST_CLASSIFICACAO",
      titulo: "NCM sujeito à ST sem CST adequado",
      motivo: `NCM ${item.ncm} (prefixo ${ncmSt}) está sujeito à substituição tributária no RICMS/GO, mas o CST/CSOSN registrado é ${item.cstIcms || "(vazio)"}.`,
      sugestao: "Verificar se o CST deveria ser 10 (ST cobrada pelo fornecedor), 30, 60 (ST já recolhida) ou 70.",
    })
  }

  // ── IMOB_COM_ST ──────────────────────────────────────────────────────────────
  if (classificacao === "imobilizado" && item.vlBcSt > 0) {
    alertas.push({
      nivel: "baixo",
      codigo: "IMOB_COM_ST",
      titulo: "Ativo imobilizado com substituição tributária",
      motivo: `Item classificado como ativo imobilizado possui base de ST de R$ ${item.vlBcSt.toFixed(2).replace(".", ",")}. ST em imobilizado é incomum.`,
      sugestao: "Verificar se o produto é efetivamente imobilizado ou se foi classificado incorretamente.",
    })
  }

  return { classificacao, alertas }
}
