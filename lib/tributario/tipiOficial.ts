import 'server-only'

import * as XLSX from 'xlsx'
import { extrairTipiDasLinhas, type TipiOficial } from './tipi'

const URL_TIPI_OFICIAL = 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/legislacao/documentos-e-arquivos/tipi.xlsx/@@download/file'

export async function consultarTipiOficial(codigo: string): Promise<TipiOficial | null> {
  const response = await fetch(URL_TIPI_OFICIAL, {
    headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`TIPI oficial respondeu com status ${response.status}`)

  const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array', cellDates: false })
  const primeiraAba = workbook.SheetNames[0]
  if (!primeiraAba) return null
  const planilha = workbook.Sheets[primeiraAba]
  if (!planilha) return null

  const linhas = XLSX.utils.sheet_to_json<unknown[]>(planilha, {
    header: 1,
    defval: null,
    raw: false,
  })
  return extrairTipiDasLinhas(linhas, codigo)
}

export const FONTE_TIPI_OFICIAL = {
  titulo: 'Tabela de Incidência do IPI — Receita Federal',
  referencia: 'TIPI 2022 atualizada pelo ADE RFB nº 1/2026',
  url: 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/legislacao/tipi-tabela-de-incidencia-do-imposto-sobre-produtos-industrializados',
}
