import { renderToBuffer } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import RelatorioReformaContadorClientePdf, { type DadosRelatorioReformaContadorCliente } from './RelatorioReformaContadorClientePdf'

/** Busca a logo do escritório direto do bucket privado e converte para data URI — nunca expõe uma URL pública dentro do PDF. */
async function carregarLogoEscritorioDataUri(logoPath: string | null): Promise<string | null> {
  if (!logoPath) return null
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.storage.from('escritorio-logos').download(logoPath)
    if (error || !data) return null
    const buffer = Buffer.from(await data.arrayBuffer())
    const mime = logoPath.endsWith('.png') ? 'image/png' : logoPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

export async function gerarRelatorioReformaContadorClientePdf(
  dados: DadosRelatorioReformaContadorCliente,
  logoPath: string | null,
): Promise<Buffer> {
  const logoDataUri = await carregarLogoEscritorioDataUri(logoPath)
  return renderToBuffer(<RelatorioReformaContadorClientePdf dados={dados} logoDataUri={logoDataUri} />)
}
