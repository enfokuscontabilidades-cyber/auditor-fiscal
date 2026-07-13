import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import RelatorioReformaAutenticadoPdf, { type DadosRelatorioReformaAutenticado } from './RelatorioReformaAutenticadoPdf'
import { ENFOKUS_CONTABILIDADE } from '@/lib/institucional/enfokusContabilidade'

let logoDataUriCache: string | null | undefined

async function carregarLogoDataUri(): Promise<string | null> {
  if (logoDataUriCache !== undefined) return logoDataUriCache
  try {
    const caminhoAbsoluto = path.join(process.cwd(), 'public', path.basename(ENFOKUS_CONTABILIDADE.logoPrincipal))
    const buffer = await readFile(caminhoAbsoluto)
    logoDataUriCache = `data:image/png;base64,${buffer.toString('base64')}`
  } catch {
    logoDataUriCache = null
  }
  return logoDataUriCache
}

export async function gerarRelatorioReformaAutenticadoPdf(dados: DadosRelatorioReformaAutenticado): Promise<Buffer> {
  const logoDataUri = await carregarLogoDataUri()
  return renderToBuffer(<RelatorioReformaAutenticadoPdf dados={dados} logoDataUri={logoDataUri} />)
}
