import { pdf } from '@react-pdf/renderer'
import RelatorioFiscalSinteticoPdf, { type DadosRelatorioFiscalPdf } from './RelatorioFiscalSinteticoPdf'

export async function gerarRelatorioFiscalSintetico(dados: DadosRelatorioFiscalPdf): Promise<Blob> {
  return pdf(<RelatorioFiscalSinteticoPdf dados={dados} />).toBlob()
}
