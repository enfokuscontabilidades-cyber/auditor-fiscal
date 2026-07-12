import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { renderToBuffer } from '@react-pdf/renderer'
import type { DadosRelatorio } from '@/lib/relatorioReforma/dadosRelatorio'
import RelatorioDiagnosticoPdf from './RelatorioDiagnosticoPdf'
import { gerarQrCodeDataUri } from './qrcode'

let logoDataUriCache: string | null | undefined

async function carregarLogoDataUri(caminhoPublico: string): Promise<string | null> {
  if (logoDataUriCache !== undefined) return logoDataUriCache
  try {
    const caminhoAbsoluto = path.join(process.cwd(), 'public', path.basename(caminhoPublico))
    const buffer = await readFile(caminhoAbsoluto)
    logoDataUriCache = `data:image/png;base64,${buffer.toString('base64')}`
  } catch {
    // Sem logo disponível no filesystem da função — o cabeçalho usa o nome
    // da marca em texto no lugar da imagem, em vez de quebrar a geração.
    logoDataUriCache = null
  }
  return logoDataUriCache
}

export interface RelatorioGerado {
  buffer: Buffer
  hash: string
}

export async function gerarRelatorioPdf(dados: DadosRelatorio): Promise<RelatorioGerado> {
  const [logoDataUri, qrCodeDataUri] = await Promise.all([
    carregarLogoDataUri(dados.institucional.logoPrincipal),
    gerarQrCodeDataUri(dados.linkWhatsappEspecialista).catch(() => null),
  ])

  const buffer = await renderToBuffer(
    <RelatorioDiagnosticoPdf dados={dados} qrCodeDataUri={qrCodeDataUri} logoDataUri={logoDataUri} />,
  )
  const hash = createHash('sha256').update(buffer).digest('hex')

  return { buffer, hash }
}
