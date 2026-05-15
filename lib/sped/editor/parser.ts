import { parseSpedLine } from "../parsers"
import type {
  SpedEditorParsed, SpedRegistro, Sped0000, Sped0190, Sped0200Ext, Sped0220,
  SpedK200, SpedK220, SpedK230, SpedK235, SpedK250, SpedK255,
  SpedK260, SpedK265, SpedK270, SpedK275, SpedK280,
} from "./types"

function getBlocoFromTipo(tipo: string): string {
  return tipo[0]?.toUpperCase() || "9"
}

export function parseSpedEditor(content: string): SpedEditorParsed {
  const lines = content.split(/\r?\n/)

  const result: SpedEditorParsed = {
    raw: [],
    resumo: {
      cnpj: "", nome: "", uf: "",
      periodoInicial: "", periodoFinal: "",
      totalLinhas: 0, blocos: [],
      temBlocoK: false,
      totalRegistros0200: 0, totalRegistrosK: 0,
      produtosNoK: [],
    },
    r0000: null,
    r0190: {},
    r0200: {},
    r0220: {},
    rK: {
      k200: [], k220: [], k230: [], k235: [],
      k250: [], k255: [], k260: [], k265: [],
      k270: [], k275: [], k280: [],
    },
  }

  const blocosSet = new Set<string>()
  const produtosNoK = new Set<string>()
  let totalRegistrosK = 0
  let linhaNum = 0

  for (const line of lines) {
    linhaNum++
    const campos = parseSpedLine(line)
    if (!campos) continue
    const tipo = campos[0]
    if (!tipo) continue

    const bloco = getBlocoFromTipo(tipo)
    blocosSet.add(bloco)
    result.raw.push({ bloco, tipo, campos, linhaOriginal: linhaNum })

    // ── Bloco 0 ──────────────────────────────────────────────────────────────

    if (tipo === "0000") {
      result.r0000 = {
        cod_ver: campos[1] || "", cod_fin: campos[2] || "",
        dt_ini:  campos[3] || "", dt_fin:  campos[4] || "",
        nome:    campos[5] || "", cnpj:    campos[6] || "",
        cpf:     campos[7] || "", uf:      campos[8] || "",
        ie:      campos[9] || "", cod_mun: campos[10] || "",
        suframa: campos[11] || "", ind_perfil: campos[12] || "",
        ind_ativ: campos[13] || "",
      } satisfies Sped0000
      result.resumo.cnpj           = campos[6] || ""
      result.resumo.nome           = campos[5] || ""
      result.resumo.uf             = campos[8] || ""
      result.resumo.periodoInicial = campos[3] || ""
      result.resumo.periodoFinal   = campos[4] || ""
    }

    if (tipo === "0190") {
      const unid = campos[1]?.trim() || ""
      if (unid) result.r0190[unid] = { unid, descr: campos[2] || "" } satisfies Sped0190
    }

    if (tipo === "0200") {
      const cod = campos[1]?.trim() || ""
      if (cod) {
        result.r0200[cod] = {
          cod_item:     cod,
          descr_item:   campos[2]  || "",
          cod_barra:    campos[3]  || "",
          cod_ant_item: campos[4]  || "",
          unid_inv:     campos[5]  || "",
          tipo_item:    campos[6]  || "",
          cod_ncm:      campos[7]  || "",
          ex_ipi:       campos[8]  || "",
          cod_gen:      campos[9]  || "",
          cod_lst:      campos[10] || "",
          aliq_icms:    campos[11] || "",
          cest:         campos[12] || "",
        } satisfies Sped0200Ext
      }
    }

    if (tipo === "0220") {
      const cod = campos[1]?.trim() || ""
      if (cod) {
        if (!result.r0220[cod]) result.r0220[cod] = []
        result.r0220[cod].push({ cod_item: cod, unid_conv: campos[2] || "", fat_conv: campos[3] || "" } satisfies Sped0220)
      }
    }

    // ── Bloco K ──────────────────────────────────────────────────────────────

    if (bloco === "K") {
      totalRegistrosK++

      if (tipo === "K200") {
        const cod = campos[2]?.trim() || ""
        result.rK.k200.push({ dt_est: campos[1] || "", cod_item: cod, qt_est: campos[3] || "", ind_est: campos[4] || "", cod_part: campos[5] || "" } satisfies SpedK200)
        if (cod) produtosNoK.add(cod)
      }
      if (tipo === "K220") {
        const ori = campos[2]?.trim() || ""; const dest = campos[4]?.trim() || ""
        result.rK.k220.push({ dt_mov: campos[1] || "", cod_item_ori: ori, qt_ori: campos[3] || "", cod_item_dest: dest, qt_dest: campos[5] || "" } satisfies SpedK220)
        if (ori)  produtosNoK.add(ori)
        if (dest) produtosNoK.add(dest)
      }
      if (tipo === "K230") {
        const cod = campos[5]?.trim() || ""
        result.rK.k230.push({ ord_prod: campos[1] || "", dt_ini_op: campos[2] || "", dt_fin_op: campos[3] || "", cod_doc_op: campos[4] || "", cod_item: cod, qt_ord: campos[6] || "", qt_prod: campos[7] || "" } satisfies SpedK230)
        if (cod) produtosNoK.add(cod)
      }
      if (tipo === "K235") {
        const cod = campos[2]?.trim() || ""
        result.rK.k235.push({ dt_saida: campos[1] || "", cod_item: cod, qt_cons: campos[3] || "", cod_ins_subst: campos[4] || "" } satisfies SpedK235)
        if (cod) produtosNoK.add(cod)
      }
      if (tipo === "K250") {
        const cod = campos[2]?.trim() || ""
        result.rK.k250.push({ dt_prod: campos[1] || "", cod_item: cod, qt_prod: campos[3] || "" } satisfies SpedK250)
        if (cod) produtosNoK.add(cod)
      }
      if (tipo === "K255") {
        const cod = campos[2]?.trim() || ""
        result.rK.k255.push({ dt_cons: campos[1] || "", cod_item: cod, qt_cons: campos[3] || "", cod_ins_subst: campos[4] || "" } satisfies SpedK255)
        if (cod) produtosNoK.add(cod)
      }
      if (tipo === "K260") {
        const cod = campos[4]?.trim() || ""
        result.rK.k260.push({ ord_reop: campos[1] || "", dt_ini_op: campos[2] || "", dt_fin_op: campos[3] || "", cod_item: cod, qt_reop: campos[5] || "", qt_prod: campos[6] || "" } satisfies SpedK260)
        if (cod) produtosNoK.add(cod)
      }
      if (tipo === "K265") {
        const cod = campos[2]?.trim() || ""
        result.rK.k265.push({ dt_saida: campos[1] || "", cod_item: cod, qt_cons: campos[3] || "" } satisfies SpedK265)
        if (cod) produtosNoK.add(cod)
      }
      if (tipo === "K270") {
        const cod = campos[3]?.trim() || ""
        result.rK.k270.push({ dt_apur: campos[1] || "", cod_op_os: campos[2] || "", cod_item: cod, qt_bfx: campos[4] || "", qt_sfx: campos[5] || "" } satisfies SpedK270)
        if (cod) produtosNoK.add(cod)
      }
      if (tipo === "K275") {
        const cod = campos[2]?.trim() || ""
        result.rK.k275.push({ dt_saida: campos[1] || "", cod_item: cod, qt_cons: campos[3] || "", cod_ins_subst: campos[4] || "" } satisfies SpedK275)
        if (cod) produtosNoK.add(cod)
      }
      if (tipo === "K280") {
        const cod = campos[2]?.trim() || ""
        result.rK.k280.push({ dt_est: campos[1] || "", cod_item: cod, qt_bfx: campos[3] || "", qt_sfx: campos[4] || "", ind_est: campos[5] || "", cod_part: campos[6] || "" } satisfies SpedK280)
        if (cod) produtosNoK.add(cod)
      }
    }
  }

  result.resumo.totalLinhas        = linhaNum
  result.resumo.blocos             = Array.from(blocosSet).sort()
  result.resumo.temBlocoK          = blocosSet.has("K")
  result.resumo.totalRegistros0200 = Object.keys(result.r0200).length
  result.resumo.totalRegistrosK    = totalRegistrosK
  result.resumo.produtosNoK        = Array.from(produtosNoK).filter(Boolean)

  return result
}
