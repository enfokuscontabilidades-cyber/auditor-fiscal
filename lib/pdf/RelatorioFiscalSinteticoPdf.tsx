import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export type LinhaRelatorioFiscalPdf = {
  data: string
  documento: string
  tipo_documento: string
  participante: string
  valor_total: number
  tributo: string
  valor_tributo: number | null
  situacao_tributo: string
  divergencia: boolean
}

export type DadosRelatorioFiscalPdf = {
  empresa: string
  cnpj: string
  periodo: string
  tipo: string
  filtros: string[]
  gerado_em: string
  totais: {
    documentos: number
    valor_operacoes: number
    base_icms: number
    icms: number
    st: number
    ipi: number
    pis: number
    cofins: number
    base_iss: number
    iss: number
    iss_retido: number
    divergencias: number
    incompletos: number
  }
  linhas: LinhaRelatorioFiscalPdf[]
  observacao?: string
}

const styles = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 34, paddingHorizontal: 34, fontFamily: 'Helvetica', color: '#14232b', fontSize: 8.5 },
  header: { borderBottomWidth: 2, borderBottomColor: '#27c7d8', paddingBottom: 10, marginBottom: 14 },
  eyebrow: { fontSize: 7.5, color: '#0a6674', textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 4 },
  title: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: '#0d3340' },
  subtitle: { marginTop: 4, fontSize: 8.5, color: '#52656d' },
  meta: { marginTop: 9, flexDirection: 'row', gap: 18 },
  metaItem: { flexGrow: 1 },
  metaLabel: { fontSize: 6.5, color: '#71838a', textTransform: 'uppercase', marginBottom: 2 },
  metaValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  sectionTitle: { marginTop: 11, marginBottom: 7, fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0d3340' },
  summary: { borderWidth: 1, borderColor: '#d9e6e9' },
  summaryRow: { flexDirection: 'row', minHeight: 24, borderBottomWidth: 1, borderBottomColor: '#e7eef0' },
  summaryItem: { width: '50%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 5 },
  summaryItemBorder: { borderRightWidth: 1, borderRightColor: '#e7eef0' },
  summaryLabel: { width: '55%', color: '#52656d', fontSize: 7.2 },
  summaryValue: { width: '45%', color: '#0d3340', fontSize: 8.5, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  filters: { backgroundColor: '#f3f8f9', borderRadius: 5, padding: 8, color: '#52656d', lineHeight: 1.35 },
  table: { borderWidth: 1, borderColor: '#d9e6e9', borderRadius: 4, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e7eef0', minHeight: 24, alignItems: 'center' },
  headerRow: { backgroundColor: '#0d3340', color: '#ffffff', minHeight: 26 },
  cell: { paddingHorizontal: 5, paddingVertical: 5 },
  data: { width: '11%' },
  documento: { width: '9%' },
  tipoDocumento: { width: '8%' },
  participante: { width: '27%' },
  valor: { width: '16%', textAlign: 'right' },
  icms: { width: '13%', textAlign: 'right' },
  situacao: { width: '16%' },
  alert: { color: '#b42318', fontFamily: 'Helvetica-Bold' },
  muted: { color: '#71838a' },
  note: { marginTop: 8, fontSize: 7.5, color: '#52656d', lineHeight: 1.35 },
  footer: { position: 'absolute', left: 34, right: 34, bottom: 18, flexDirection: 'row', justifyContent: 'space-between', color: '#71838a', fontSize: 6.5 },
})

function moeda(valor: number | null | undefined) {
  if (valor === null) return 'Não informado'
  return Number(valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Rodape({ geradoEm }: { geradoEm: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Enfokus Auditor - Relatório fiscal</Text>
      <Text render={({ pageNumber, totalPages }) => `${geradoEm} - Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}

export default function RelatorioFiscalSinteticoPdf({ dados }: { dados: DadosRelatorioFiscalPdf }) {
  const indicadores: Array<[string, string]> = [
    ['Documentos', dados.totais.documentos.toLocaleString('pt-BR')],
    ['Valor das operações', moeda(dados.totais.valor_operacoes)],
    ['Base de ICMS', moeda(dados.totais.base_icms)],
    ['ICMS consolidado', moeda(dados.totais.icms)],
    ['ICMS-ST', moeda(dados.totais.st)],
    ['IPI', moeda(dados.totais.ipi)],
    ['Base de ISS', moeda(dados.totais.base_iss)],
    ['ISS', moeda(dados.totais.iss)],
    ['ISS retido', moeda(dados.totais.iss_retido)],
    ['PIS / COFINS', `${moeda(dados.totais.pis)} / ${moeda(dados.totais.cofins)}`],
    ['Divergências / incompletos', `${dados.totais.divergencias} / ${dados.totais.incompletos}`],
  ]

  return (
    <Document title={`${dados.tipo} - ${dados.empresa}`} author="Enfokus Auditor" language="pt-BR">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Enfokus Auditor</Text>
          <Text style={styles.title}>{dados.tipo}</Text>
          <Text style={styles.subtitle}>Resumo sintético e conciliação dos documentos fiscais importados</Text>
          <View style={styles.meta}>
            <View style={styles.metaItem}><Text style={styles.metaLabel}>Empresa</Text><Text style={styles.metaValue}>{dados.empresa}</Text></View>
            <View style={styles.metaItem}><Text style={styles.metaLabel}>CNPJ</Text><Text style={styles.metaValue}>{dados.cnpj || 'Não informado'}</Text></View>
            <View style={styles.metaItem}><Text style={styles.metaLabel}>Período</Text><Text style={styles.metaValue}>{dados.periodo}</Text></View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Resumo executivo</Text>
        <View style={styles.summary}>
          {Array.from({ length: Math.ceil(indicadores.length / 2) }, (_, indice) => {
            const esquerda = indicadores[indice * 2]
            const direita = indicadores[indice * 2 + 1]
            return (
              <View key={esquerda[0]} style={styles.summaryRow}>
                <View style={[styles.summaryItem, styles.summaryItemBorder]}>
                  <Text style={styles.summaryLabel}>{esquerda[0]}</Text>
                  <Text style={styles.summaryValue}>{esquerda[1]}</Text>
                </View>
                {direita && (
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{direita[0]}</Text>
                    <Text style={styles.summaryValue}>{direita[1]}</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>

        <Text style={styles.sectionTitle}>Filtros utilizados</Text>
        <Text style={styles.filters}>{dados.filtros.length ? dados.filtros.join(' | ') : 'Nenhum filtro adicional.'}</Text>

        <Text style={styles.sectionTitle}>Documentos filtrados</Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]} fixed>
            <Text style={[styles.cell, styles.data]}>Data</Text><Text style={[styles.cell, styles.documento]}>Nota</Text><Text style={[styles.cell, styles.tipoDocumento]}>Tipo</Text><Text style={[styles.cell, styles.participante]}>Fornecedor / cliente</Text><Text style={[styles.cell, styles.valor]}>Valor total</Text><Text style={[styles.cell, styles.icms]}>ICMS / ISS</Text><Text style={[styles.cell, styles.situacao]}>Situação</Text>
          </View>
          {dados.linhas.map((linha, indice) => (
            <View key={`${linha.documento}-${indice}`} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.data]}>{linha.data}</Text>
              <Text style={[styles.cell, styles.documento]}>{linha.documento}</Text>
              <Text style={[styles.cell, styles.tipoDocumento]}>{linha.tipo_documento}</Text>
              <Text style={[styles.cell, styles.participante]}>{linha.participante}</Text>
              <Text style={[styles.cell, styles.valor]}>{moeda(linha.valor_total)}</Text>
              <Text style={[styles.cell, styles.icms]}>{linha.tributo}: {moeda(linha.valor_tributo)}</Text>
              <Text style={[styles.cell, styles.situacao, linha.divergencia ? styles.alert : styles.muted]}>{linha.situacao_tributo}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>{dados.observacao ?? 'O PDF prioriza o resumo gerencial. Para todos os itens e campos tributários, utilize a exportação Excel.'}</Text>
        <Rodape geradoEm={dados.gerado_em} />
      </Page>
    </Document>
  )
}
