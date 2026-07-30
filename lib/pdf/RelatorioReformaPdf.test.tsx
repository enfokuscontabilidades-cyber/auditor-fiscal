import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { PARAMETROS_REFORMA_2026 } from '@/lib/fiscal/parametrosReforma2026'
import RelatorioReformaAutenticadoPdf from './RelatorioReformaAutenticadoPdf'
import RelatorioReformaContadorClientePdf from './RelatorioReformaContadorClientePdf'
import type { ResumoAnaliseReforma } from '@/lib/fiscal/resumoReformaTributaria'

const resumo: ResumoAnaliseReforma = {
  totalDocumentos: 400,
  totalItens: 400,
  documentosAdequados: 0,
  documentosAtencao: 0,
  documentosCriticos: 400,
  documentosAfetados: 400,
  itensAdequados: 0,
  itensAtencao: 0,
  itensCriticos: 400,
  itensAfetados: 400,
  tiposDivergencia: 1,
  ocorrenciasDivergencia: 400,
  totalIbs: 0,
  totalCbs: 0,
}

describe('relatorios de Reforma Tributaria em PDF', () => {
  it('renderiza o limite de 250 documentos mesmo com campo importado excepcionalmente longo', async () => {
    const participanteMuitoLongo = 'CLIENTESEMESPACOS'.repeat(2_000)
    const anexoDocumentos = Array.from({ length: 250 }, (_, indice) => ({
      nota: String(indice + 1),
      data: '2026-07-30',
      participante: indice === 0 ? participanteMuitoLongo : `Cliente ${indice + 1}`,
      situacao: 'critico' as const,
      valorIbs: 0,
      valorCbs: 0,
    }))

    const buffer = await renderToBuffer(
      <RelatorioReformaAutenticadoPdf
        logoDataUri={null}
        dados={{
          empresaNome: 'Empresa de teste',
          empresaCnpjFormatado: '00.000.000/0001-00',
          dataEmissao: new Date('2026-07-30T12:00:00-03:00'),
          parametros: PARAMETROS_REFORMA_2026,
          resumo,
          grupos: [],
          anexoDocumentos,
        }}
      />,
    )

    expect(buffer.byteLength).toBeGreaterThan(0)
  }, 30_000)

  it('renderiza a versao do contador com o limite completo do anexo', async () => {
    const documentosSemDestaque = Array.from({ length: 400 }, (_, indice) => ({
      tipoDocumento: 'NF-e',
      numero: String(indice + 1),
      serie: '1',
      data: '2026-07-30',
      itensAfetados: 1,
      principalDivergencia: indice === 0 ? 'DIVERGENCIASEMESPACOS'.repeat(2_000) : 'Grupo IBSCBS ausente',
      status: 'critico' as const,
    }))

    const buffer = await renderToBuffer(
      <RelatorioReformaContadorClientePdf
        logoDataUri={null}
        dados={{
          codigoRelatorio: 'TESTE123',
          empresaNome: 'Empresa de teste',
          empresaCnpjFormatado: '00.000.000/0001-00',
          dataEmissao: new Date('2026-07-30T12:00:00-03:00'),
          parametros: PARAMETROS_REFORMA_2026,
          modoParametros: 'padrao_2026',
          resumo,
          grupos: [],
          documentosSemDestaque,
          escritorio: {
            nome: 'Escritorio de teste',
            razaoSocial: null,
            cnpjFormatado: null,
            telefone: null,
            whatsapp: null,
            email: null,
            site: null,
            cidade: null,
            estado: null,
            contadorResponsavel: null,
            crc: null,
            corPrincipal: null,
          },
        }}
      />,
    )

    expect(buffer.byteLength).toBeGreaterThan(0)
  }, 30_000)
})
