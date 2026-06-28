import type { SnParsedData, SnTributo, SnHistoricoMes, SnAtividade, SnEstabelecimento } from '@/lib/types'

let workerConfigured = false

async function getPdfjsLib() {
  const pdfjsLib = await import('pdfjs-dist')
  if (!workerConfigured && typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    workerConfigured = true
  }
  return pdfjsLib
}

function parseBRL(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0
}

// Extrai todos os valores BRL (ex: "1.234,56") de uma janela de texto
function extractBRLNumbers(window: string): string[] {
  return window.match(/([\d.]+,\d{2})/g) ?? []
}

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await getPdfjsLib()
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false }).promise

  let fullText = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const parts: string[] = []
    let lastY: number | null = null
    for (const item of content.items) {
      if ('str' in item) {
        const { str, transform } = item as { str: string; transform: number[] }
        if (lastY !== null && Math.abs(transform[5] - lastY) > 3) parts.push('\n')
        parts.push(str)
        lastY = transform[5]
      }
    }
    fullText += parts.join(' ') + '\n'
  }
  return fullText
}

function extractHistoricoMensal(text: string): SnHistoricoMes[] {
  const secMatch = text.match(/2\.2\.?\s*1\)\s*Mercado\s+Interno([\s\S]*?)2\.2\.?\s*2\)/)
  const section = secMatch ? secMatch[1] : text
  const result: SnHistoricoMes[] = []
  const re = /(\d{2}\/\d{4})\s+([\d.]+,\d{2})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(section)) !== null) {
    result.push({ mes: m[1], receita: parseBRL(m[2]) })
  }
  return result
}

function extractTributos(text: string): SnTributo[] {
  // Localiza a seção 2.8 e procura o primeiro cabeçalho "IRPJ CSLL...Total"
  // Em alguns PDFs o rodapé da página fica entre o cabeçalho e os valores,
  // por isso usamos uma janela de 800 chars e extraímos os primeiros 9 números BRL.
  const sec28Idx = text.indexOf('2.8)')
  if (sec28Idx < 0) return []
  const sec28 = text.slice(sec28Idx, sec28Idx + 2500)

  const headerMatch = sec28.match(
    /IRPJ\s+CSLL\s+COFINS\s+PIS\/Pasep\s+INSS\/CPP\s+ICMS\s+IPI\s+ISS\s+Total/
  )
  if (!headerMatch) return []

  const afterHeader = sec28.slice(
    headerMatch.index! + headerMatch[0].length,
    headerMatch.index! + headerMatch[0].length + 800
  )
  const nums = extractBRLNumbers(afterHeader)
  if (nums.length < 8) return []

  const names = ['IRPJ', 'CSLL', 'COFINS', 'PIS/PASEP', 'INSS/CPP', 'ICMS', 'IPI', 'ISS']
  return names
    .map((nome, i) => ({ nome, valor: parseBRL(nums[i]) }))
    .filter(t => !['IPI', 'ISS'].includes(t.nome) || t.valor > 0)
}

const NOMES8 = ['IRPJ', 'CSLL', 'COFINS', 'PIS/PASEP', 'INSS/CPP', 'ICMS', 'IPI', 'ISS']

// Extrai breakdown por atividade da seção 2.8 (retorna [] se empresa tem só 1 atividade)
function extractAtividades(text: string): SnAtividade[] {
  const sec28Idx = text.indexOf('2.8)')
  if (sec28Idx < 0) return []
  const sec28 = text.slice(sec28Idx, sec28Idx + 4000)

  const headerMatch = sec28.match(
    /IRPJ\s+CSLL\s+COFINS\s+PIS\/Pasep\s+INSS\/CPP\s+ICMS\s+IPI\s+ISS\s+Total/
  )
  if (!headerMatch) return []

  const afterHeader = sec28.slice(headerMatch.index! + headerMatch[0].length)

  // Abordagem por linha: cada linha da tabela com exatamente 9 números BRL é uma atividade
  const actRows: { nome: string; nums: number[] }[] = []
  for (const line of afterHeader.split('\n')) {
    const numsStr = extractBRLNumbers(line)
    if (numsStr.length !== 9) continue
    const nome = line.replace(/([\d.]+,\d{2})/g, '').replace(/\s+/g, ' ').trim()
    if (/^total/i.test(nome)) continue
    actRows.push({ nome, nums: numsStr.map(parseBRL) })
  }

  if (actRows.length < 2) return []

  return actRows.map(({ nome, nums }) => {
    const mAnexo = nome.match(/Anexo\s+(I{1,3}V?|IV|V)/i)
    const anexo = mAnexo ? `Anexo ${mAnexo[1].toUpperCase()}` : ''
    const tributos = NOMES8
      .map((n, i) => ({ nome: n, valor: nums[i] }))
      .filter(t => t.valor > 0)
    return { nome, anexo, tributos, total: nums[8] }
  })
}

function extractEstabelecimentos(text: string): SnEstabelecimento[] {
  // Seção 2.7 do PGDAS-D usa "CNPJ Estabelecimento: XX.XXX.XXX/XXXX-XX" como cabeçalho
  // de cada bloco, seguido de "Receita Bruta Informada: R$ VALOR" (ou nenhuma atividade → 0)
  const estabelRe = /CNPJ\s+Estabelecimento:\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g
  const encontrados: { cnpj: string; start: number; end: number }[] = []
  let em: RegExpExecArray | null
  while ((em = estabelRe.exec(text)) !== null) {
    encontrados.push({ cnpj: em[1], start: em.index, end: em.index + em[0].length })
  }

  if (encontrados.length < 2) return []

  const resultado: SnEstabelecimento[] = []
  for (let i = 0; i < encontrados.length; i++) {
    // Bloco = texto após o cabeçalho até o início do próximo cabeçalho (ou fim do texto)
    const blocoInicio = encontrados[i].end
    const blocoFim = i + 1 < encontrados.length ? encontrados[i + 1].start : text.length
    const bloco = text.slice(blocoInicio, blocoFim)

    // O total do CNPJ fica em "Valor Informado"; quando não houver, somamos as atividades.
    const valorInformadoMatch = bloco.match(/Valor\s+Informado:\s*([\d.]+,\d{2})/)
    const receitasAtividades = Array.from(
      bloco.matchAll(/Receita\s+Bruta\s+Informada:\s+R\$\s+([\d.]+,\d{2})/g),
    ).map(match => parseBRL(match[1]))
    const receita = valorInformadoMatch
      ? parseBRL(valorInformadoMatch[1])
      : receitasAtividades.reduce((sum, valor) => sum + valor, 0)

    // Imposto: na seção "Totais do Estabelecimento", primeira linha com 9 valores BRL
    // (colunas IRPJ CSLL COFINS PIS/PASEP INSS/CPP ICMS IPI ISS Total)
    let imposto = 0
    const totaisIdx = bloco.indexOf('Totais')
    if (totaisIdx >= 0) {
      for (const linha of bloco.slice(totaisIdx).split('\n')) {
        const nums = extractBRLNumbers(linha)
        if (nums.length >= 9) { imposto = parseBRL(nums[8]); break }
      }
    }

    resultado.push({ cnpj: encontrados[i].cnpj, receita_bruta_mes: receita, imposto_devido: imposto })
  }

  return resultado
}

export async function parsePgdasPdf(file: File): Promise<SnParsedData | null> {
  try {
    const text = await extractTextFromPdf(file)

    const cnpj = text.match(/CNPJ\s+Matriz:\s+([\d.\/\-]+)/)?.[1]?.trim() ?? ''
    const razao_social = text.match(/Nome\s+empresarial:\s+(.+?)\s+Data\s+de\s+abertura/)?.[1]
      ?.replace(/\s+/g, ' ').trim() ?? ''
    const periodo = text.match(/Per[ií]odo\s+de\s+Apura[çc][ãa]o:\s+\d{2}\/(\d{2}\/\d{4})/)?.[1] ?? ''

    // Tipo de declaração: Original ou Retificadora
    const tipo_declaracao = (
      text.match(/Declara[çc][ãa]o\s+(Original|Retificadora)/i)?.[1] ?? 'Original'
    ) as 'Original' | 'Retificadora'

    // Atividade e Anexo — seção 2.7
    // A atividade aparece entre "Valor do Débito por Tributo para a Atividade (R$):" e "Receita Bruta Informada"
    let atividade = ''
    let anexo = ''
    const sec27Idx = text.indexOf('2.7)')
    if (sec27Idx >= 0) {
      const sec27 = text.slice(sec27Idx, sec27Idx + 2500)
      const atvMatch = sec27.match(
        /Valor\s+do\s+D[eé]bito[^:]*Atividade[^:]*:\s*\n([\s\S]*?)Receita\s+Bruta\s+Informada/
      )
      if (atvMatch) {
        atividade = atvMatch[1].replace(/\s+/g, ' ').trim()
        const mAnexo = atividade.match(/Anexo\s+(I{1,3}V?|IV|V)/i)
        if (mAnexo) anexo = `Anexo ${mAnexo[1].toUpperCase()}`
      }
    }

    const rpaRaw = text.match(/\(RPA\)[\s\S]*?Competência\s+([\d.]+,\d{2})/)?.[1]
    const receita_bruta_mes = rpaRaw ? parseBRL(rpaRaw) : 0

    const rbt12Raw = text.match(/ao\s+PA\s+\(RBT12\)\s+([\d.]+,\d{2})/)?.[1]
    const receita_bruta_acumulada_12m = rbt12Raw ? parseBRL(rbt12Raw) : 0

    const rbaRaw = text.match(/\(RBA\)\s+([\d.]+,\d{2})/)?.[1]
    const receita_bruta_ano = rbaRaw ? parseBRL(rbaRaw) : 0

    const limiteRaw = text.match(/Limite\s+de\s+receita\s+bruta\s+proporcionalizado\s+([\d.]+,\d{2})/)?.[1]
    const limite_receita = limiteRaw ? parseBRL(limiteRaw) : 4800000

    const numero_recibo = text.match(/N[uú]mero\s+do\s+Recibo:\s*([\d.\-]+)/)?.[1]?.trim() ?? ''

    // Seção 2.6: "Receita Bruta Auferida ... Valor Total do Débito Declarado (R$)"
    // Em alguns PDFs o rodapé da página é inserido entre o label e os valores.
    // Usamos uma janela de 500 chars e extraímos os primeiros 2 números BRL.
    // O 1º é a receita bruta auferida, o 2º é o total do débito declarado.
    let total_devido = 0
    const valorTotalIdx = text.indexOf('Valor Total do Débito Declarado')
    if (valorTotalIdx >= 0) {
      const window = text.slice(valorTotalIdx, valorTotalIdx + 500)
      const nums = extractBRLNumbers(window)
      if (nums.length >= 2) total_devido = parseBRL(nums[1])
    }

    const tributos = extractTributos(text)
    const historico_mensal = extractHistoricoMensal(text)
    const atividades = extractAtividades(text)
    const estabelecimentos = extractEstabelecimentos(text)

    if (!cnpj || !periodo) return null

    return {
      cnpj,
      razao_social,
      periodo,
      tipo_declaracao,
      atividade,
      anexo,
      limite_receita,
      receita_bruta_mes,
      receita_bruta_acumulada_12m,
      receita_bruta_ano,
      tributos,
      historico_mensal,
      total_devido,
      numero_recibo,
      ...(atividades.length >= 2 ? { atividades } : {}),
      ...(estabelecimentos.length >= 2 ? { estabelecimentos } : {}),
    }
  } catch {
    return null
  }
}
