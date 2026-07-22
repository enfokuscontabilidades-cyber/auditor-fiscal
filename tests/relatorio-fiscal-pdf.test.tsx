import fs from 'node:fs/promises'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import RelatorioFiscalSinteticoPdf, { type DadosRelatorioFiscalPdf } from '@/lib/pdf/RelatorioFiscalSinteticoPdf'

describe('PDF sintetico fiscal', () => {
  it('gera um PDF paginado e legivel pelo renderizador', async () => {
    const dados: DadosRelatorioFiscalPdf = {
      empresa: 'SC INDUSTRIA DE BOLSAS LTDA',
      cnpj: '06.111.768/0001-19',
      periodo: '01/2025 ate 02/2025',
      tipo: 'Relatorio de entradas',
      filtros: ['Entradas', 'Competência: fevereiro de 2025'],
      gerado_em: '21/07/2026 11:30',
      totais: {
        documentos: 167, valor_operacoes: 43125.91, base_icms: 321.5, icms: 57.87,
        st: 0, ipi: 14.21, pis: 23.5, cofins: 108.42,
        base_iss: 2800, iss: 56, iss_retido: 0, divergencias: 2, incompletos: 59,
      },
      linhas: Array.from({ length: 28 }, (_, indice) => ({
        data: `${String((indice % 27) + 1).padStart(2, '0')}/02/2025`,
        documento: String(25632 + indice),
        tipo_documento: indice === 1 ? 'NFS-e' : 'NF-e',
        participante: indice % 3 === 0 ? 'FORNECEDOR COM RAZAO SOCIAL MAIS EXTENSA LTDA' : `Fornecedor ${indice + 1}`,
        valor_total: 250 + indice * 17.43,
        tributo: indice === 1 ? 'ISS' : 'ICMS',
        valor_tributo: indice === 1 ? 56 : indice === 0 ? 57.87 : indice % 7 === 0 ? null : 0,
        situacao_tributo: indice === 1 ? 'ISS destacado' : indice === 0 ? 'Consolidado dos itens' : indice % 7 === 0 ? 'Nao informado' : 'Zero informado',
        divergencia: indice % 7 === 0,
      })),
    }

    const buffer = await renderToBuffer(<RelatorioFiscalSinteticoPdf dados={dados} />)
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(10_000)

    if (process.env.GERAR_AMOSTRA_PDF === '1') {
      const outputDir = path.resolve('tmp/pdfs')
      await fs.mkdir(outputDir, { recursive: true })
      await fs.writeFile(path.join(outputDir, 'relatorio-fiscal-amostra.pdf'), buffer)
    }
  }, 30_000)
})
