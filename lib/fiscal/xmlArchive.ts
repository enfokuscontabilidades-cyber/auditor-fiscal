export type XmlArquivoExtraido = {
  nome: string
  txt: string
}

export type XmlArquivosExtraidos = {
  arquivos: XmlArquivoExtraido[]
  avisos: string[]
}

function isXml(nome: string) {
  return nome.toLowerCase().endsWith('.xml')
}

function isZip(nome: string) {
  return nome.toLowerCase().endsWith('.zip')
}

function isRar(nome: string) {
  return nome.toLowerCase().endsWith('.rar')
}

function getUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true)
}

function getUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true)
}

function encontrarEocd(view: DataView) {
  const minOffset = Math.max(0, view.byteLength - 66000)
  for (let offset = view.byteLength - 22; offset >= minOffset; offset--) {
    if (getUint32(view, offset) === 0x06054b50) return offset
  }
  return -1
}

async function inflarDeflateRaw(data: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Seu navegador não oferece suporte para descompactar ZIP automaticamente.')
  }
  const buffer = new ArrayBuffer(data.byteLength)
  new Uint8Array(buffer).set(data)
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function extrairXmlsZip(file: File): Promise<XmlArquivoExtraido[]> {
  const buffer = await file.arrayBuffer()
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const eocd = encontrarEocd(view)
  if (eocd < 0) throw new Error('ZIP inválido ou corrompido.')

  const totalEntradas = getUint16(view, eocd + 10)
  const centralOffset = getUint32(view, eocd + 16)
  const decoder = new TextDecoder('utf-8')
  const xmls: XmlArquivoExtraido[] = []
  let offset = centralOffset

  for (let i = 0; i < totalEntradas; i++) {
    if (getUint32(view, offset) !== 0x02014b50) break

    const flags = getUint16(view, offset + 8)
    const method = getUint16(view, offset + 10)
    const compressedSize = getUint32(view, offset + 20)
    const fileNameLength = getUint16(view, offset + 28)
    const extraLength = getUint16(view, offset + 30)
    const commentLength = getUint16(view, offset + 32)
    const localHeaderOffset = getUint32(view, offset + 42)
    const rawName = bytes.slice(offset + 46, offset + 46 + fileNameLength)
    const nomeInterno = decoder.decode(rawName).replace(/\\/g, '/')

    offset += 46 + fileNameLength + extraLength + commentLength

    if (!isXml(nomeInterno) || nomeInterno.endsWith('/')) continue
    if (getUint32(view, localHeaderOffset) !== 0x04034b50) continue

    const localNameLength = getUint16(view, localHeaderOffset + 26)
    const localExtraLength = getUint16(view, localHeaderOffset + 28)
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize)

    let conteudo: Uint8Array
    if (method === 0) {
      conteudo = compressed
    } else if (method === 8) {
      conteudo = await inflarDeflateRaw(compressed)
    } else {
      throw new Error(`${nomeInterno}: método de compactação não suportado (${method}).`)
    }

    const txt = decoder.decode(conteudo)
    if (txt.trim()) {
      xmls.push({ nome: `${file.name}/${nomeInterno}`, txt })
    }

    void flags
  }

  return xmls
}

export async function extrairXmlsDeArquivos(files: FileList | File[]): Promise<XmlArquivosExtraidos> {
  const arquivos: XmlArquivoExtraido[] = []
  const avisos: string[] = []

  for (const file of Array.from(files)) {
    if (isXml(file.name)) {
      const txt = await file.text().catch(() => '')
      if (txt.trim()) arquivos.push({ nome: file.name, txt })
      else avisos.push(`${file.name}: não foi possível ler o XML.`)
      continue
    }

    if (isZip(file.name)) {
      try {
        const xmlsZip = await extrairXmlsZip(file)
        if (xmlsZip.length === 0) avisos.push(`${file.name}: nenhum XML encontrado no ZIP.`)
        arquivos.push(...xmlsZip)
      } catch (err) {
        avisos.push(`${file.name}: ${err instanceof Error ? err.message : 'não foi possível abrir o ZIP.'}`)
      }
      continue
    }

    if (isRar(file.name)) {
      avisos.push(`${file.name}: arquivos RAR ainda precisam ser descompactados antes da importação. Use ZIP ou XML direto.`)
      continue
    }

    avisos.push(`${file.name}: formato ignorado. Use XML ou ZIP.`)
  }

  return { arquivos, avisos }
}
