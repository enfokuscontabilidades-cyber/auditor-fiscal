// Relatório em PDF de conferência de IBS/CBS para clientes autenticados
// (planos pagos de Reforma Tributária). Reaproveita o mesmo motor de PDF
// (@react-pdf/renderer) e o MESMO motor de análise da área paga
// (lib/fiscal/analiseReformaTributariaPaga.ts) usado pela tela e pelo
// dashboard — nunca monta uma segunda listagem simples a partir de dados
// próprios. O relatório é estruturado em: capa/resumo, indicadores,
// parâmetros de referência, divergências agrupadas (com documentos e itens
// afetados, explicação, impacto e orientação), conclusão e anexo compacto
// com a listagem de notas — a listagem nunca é o conteúdo principal.

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { ENFOKUS_CONTABILIDADE } from '@/lib/institucional/enfokusContabilidade'
import { dataBrDeIso, dataHoraBr } from './formatadores'
import type { SituacaoReforma } from '@/lib/fiscal/analiseReformaTributariaPaga'
import type { ParametrosReferenciaReforma } from '@/lib/fiscal/parametrosReforma2026'
import type { GrupoDivergenciaReforma, ResumoAnaliseReforma } from '@/lib/fiscal/resumoReformaTributaria'

const CORES = {
  primaria: '#0e8a96',
  texto: '#16232c',
  textoSuave: '#4b5c68',
  textoFraco: '#7c8a94',
  borda: '#dbe3e7',
  fundoAlt: '#f6f9fa',
  ok: '#1a7a4c', okFundo: '#e7f6ee',
  alerta: '#8a6d00', alertaFundo: '#fbf6e0',
  critico: '#b3261e', criticoFundo: '#fbeceb',
}

const SITUACAO_COR: Record<SituacaoReforma, { cor: string; fundo: string; label: string }> = {
  ok: { cor: CORES.ok, fundo: CORES.okFundo, label: 'Adequado' },
  alerta: { cor: CORES.alerta, fundo: CORES.alertaFundo, label: 'Atenção' },
  critico: { cor: CORES.critico, fundo: CORES.criticoFundo, label: 'Crítico' },
}

const styles = StyleSheet.create({
  page: { paddingTop: 76, paddingBottom: 46, paddingHorizontal: 40, fontSize: 9.5, fontFamily: 'Helvetica', color: CORES.texto, lineHeight: 1.4 },
  header: {
    position: 'absolute', top: 20, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: CORES.borda,
  },
  headerLogo: { width: 96, height: 32, objectFit: 'contain' },
  headerRight: { alignItems: 'flex-end' },
  headerTitulo: { fontSize: 8.5, fontWeight: 700, color: CORES.primaria },
  headerMeta: { fontSize: 7.5, color: CORES.textoFraco, marginTop: 1 },
  footer: {
    position: 'absolute', bottom: 16, left: 40, right: 40,
    paddingTop: 6, borderTopWidth: 1, borderTopColor: CORES.borda,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerTexto: { fontSize: 7, color: CORES.textoFraco },

  tituloSecao: { fontSize: 12, fontWeight: 700, color: CORES.primaria, marginTop: 14, marginBottom: 7 },
  titulo: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitulo: { fontSize: 10, color: CORES.primaria, fontWeight: 700, marginBottom: 4 },
  paragrafo: { fontSize: 9.5, color: CORES.textoSuave, lineHeight: 1.45, marginBottom: 3 },

  metricasRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  metricaCard: { flex: 1, borderWidth: 1, borderColor: CORES.borda, borderRadius: 3, padding: 7, backgroundColor: CORES.fundoAlt },
  metricaLabel: { fontSize: 7, color: CORES.textoFraco, textTransform: 'uppercase', marginBottom: 3 },
  metricaValor: { fontSize: 13, fontWeight: 700, color: CORES.texto },

  parametrosBox: { borderWidth: 1, borderColor: CORES.primaria, borderRadius: 3, padding: 8, backgroundColor: CORES.fundoAlt, marginBottom: 6 },
  parametrosTitulo: { fontSize: 9, fontWeight: 700, color: CORES.primaria, marginBottom: 4, textTransform: 'uppercase' },
  parametrosLinha: { flexDirection: 'row', gap: 14, marginBottom: 3 },
  parametrosItem: { fontSize: 8.5, color: CORES.texto },
  parametrosNota: { fontSize: 8, color: CORES.textoFraco, marginTop: 2, lineHeight: 1.4 },

  grupoBox: { borderWidth: 1, borderColor: CORES.borda, borderRadius: 3, marginBottom: 7, padding: 9 },
  grupoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  grupoTitulo: { fontSize: 9.5, fontWeight: 700 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontWeight: 700 },
  grupoLinha: { fontSize: 8.5, color: CORES.textoSuave, marginBottom: 3, lineHeight: 1.45 },
  grupoLabel: { fontWeight: 700, color: CORES.texto },
  grupoOrientacaoItem: { fontSize: 8.5, color: CORES.textoSuave, marginBottom: 2, lineHeight: 1.4 },

  tabela: { borderWidth: 1, borderColor: CORES.borda, borderRadius: 3 },
  linhaCabecalho: { flexDirection: 'row', backgroundColor: CORES.fundoAlt, borderBottomWidth: 1, borderBottomColor: CORES.borda },
  linha: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: CORES.borda },
  celulaCabecalho: { padding: 5, fontSize: 8, fontWeight: 700, color: CORES.textoSuave, textTransform: 'uppercase' },
  celula: { padding: 5, fontSize: 8, color: CORES.texto },
})

const COLS_ANEXO = { nota: '12%', data: '12%', participante: '38%', ibs: '14%', cbs: '14%', situacao: '10%' }

export interface AnexoDocumentoReforma {
  nota: string
  data: string
  participante: string
  situacao: SituacaoReforma
  valorIbs: number
  valorCbs: number
}

export interface DadosRelatorioReformaAutenticado {
  empresaNome: string
  empresaCnpjFormatado: string
  competencia?: string
  dataEmissao: Date
  parametros: ParametrosReferenciaReforma
  resumo: ResumoAnaliseReforma
  grupos: GrupoDivergenciaReforma[]
  anexoDocumentos: AnexoDocumentoReforma[]
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numberFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const MAX_DOCUMENTOS_POR_GRUPO = 12
const MAX_LINHAS_ANEXO = 250

export default function RelatorioReformaAutenticadoPdf({ dados, logoDataUri }: { dados: DadosRelatorioReformaAutenticado; logoDataUri: string | null }) {
  const { resumo } = dados
  const indicadorConsolidado: SituacaoReforma = resumo.documentosCriticos > 0 ? 'critico' : resumo.documentosAtencao > 0 ? 'alerta' : 'ok'
  const corConsolidado = SITUACAO_COR[indicadorConsolidado]

  return (
    <Document title={`Relatorio IBS-CBS - ${dados.empresaNome}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          {logoDataUri ? <Image src={logoDataUri} style={styles.headerLogo} /> : <Text style={styles.headerTitulo}>{ENFOKUS_CONTABILIDADE.nomeFantasia}</Text>}
          <View style={styles.headerRight}>
            <Text style={styles.headerTitulo}>Relatório de Conferência IBS/CBS</Text>
            <Text style={styles.headerMeta}>Gerado em {dataHoraBr(dados.dataEmissao)}</Text>
          </View>
        </View>

        {/* Capa e resumo */}
        <Text style={styles.titulo}>{dados.empresaNome}</Text>
        <Text style={styles.subtitulo}>
          {dados.empresaCnpjFormatado}{dados.competencia ? ` · Competência ${dados.competencia}` : ''}
        </Text>
        <View style={[styles.badge, { backgroundColor: corConsolidado.fundo, marginBottom: 10 }]}>
          <Text style={{ color: corConsolidado.cor, fontSize: 8, fontWeight: 700 }}>Indicador consolidado: {corConsolidado.label}</Text>
        </View>

        {/* Indicadores — documentos e itens sempre em campos separados, nunca somados */}
        <View style={styles.metricasRow}>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>XMLs analisados</Text><Text style={styles.metricaValor}>{resumo.totalDocumentos}</Text></View>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Itens analisados</Text><Text style={styles.metricaValor}>{resumo.totalItens}</Text></View>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Total IBS</Text><Text style={styles.metricaValor}>{money.format(resumo.totalIbs)}</Text></View>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Total CBS</Text><Text style={styles.metricaValor}>{money.format(resumo.totalCbs)}</Text></View>
        </View>
        <View style={styles.metricasRow}>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Documentos adequados</Text><Text style={[styles.metricaValor, { color: CORES.ok }]}>{resumo.documentosAdequados}</Text></View>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Documentos em atenção</Text><Text style={[styles.metricaValor, { color: CORES.alerta }]}>{resumo.documentosAtencao}</Text></View>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Documentos críticos</Text><Text style={[styles.metricaValor, { color: CORES.critico }]}>{resumo.documentosCriticos}</Text></View>
        </View>
        <View style={styles.metricasRow}>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Itens adequados</Text><Text style={[styles.metricaValor, { color: CORES.ok, fontSize: 11 }]}>{resumo.itensAdequados}</Text></View>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Itens em atenção</Text><Text style={[styles.metricaValor, { color: CORES.alerta, fontSize: 11 }]}>{resumo.itensAtencao}</Text></View>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Itens críticos</Text><Text style={[styles.metricaValor, { color: CORES.critico, fontSize: 11 }]}>{resumo.itensCriticos}</Text></View>
        </View>

        {/* Parâmetros de referência */}
        <View style={styles.parametrosBox}>
          <Text style={styles.parametrosTitulo}>Parâmetros de referência — Ano de {dados.parametros.ano}</Text>
          <View style={styles.parametrosLinha}>
            <Text style={styles.parametrosItem}>CBS: {numberFmt.format(dados.parametros.aliquotaCbs)}%</Text>
            <Text style={styles.parametrosItem}>IBS total: {numberFmt.format(dados.parametros.aliquotaIbsTotal)}%</Text>
            <Text style={styles.parametrosItem}>CST: {dados.parametros.cst}</Text>
            <Text style={styles.parametrosItem}>cClassTrib: {dados.parametros.cClassTrib}</Text>
          </View>
          <Text style={styles.parametrosNota}>
            Os parâmetros acima são utilizados como referência simplificada para verificação dos XMLs no período de teste
            de {dados.parametros.ano}. Operações com tratamentos específicos devem ser confirmadas pelo responsável contábil ou tributário.
          </Text>
          <Text style={[styles.parametrosNota, { marginTop: 2 }]}>Parâmetros de referência: versão {dados.parametros.versao}.</Text>
        </View>

        {/* Divergências agrupadas */}
        <Text style={styles.tituloSecao}>Principais divergências</Text>
        {dados.grupos.length === 0 ? (
          <Text style={styles.paragrafo}>Nenhuma divergência identificada nos documentos analisados — todos os itens estão de acordo com os parâmetros de referência.</Text>
        ) : (
          dados.grupos.map(grupo => {
            const cor = SITUACAO_COR[grupo.gravidade === 'critico' ? 'critico' : 'alerta']
            const documentosExibidos = grupo.documentosAfetados.slice(0, MAX_DOCUMENTOS_POR_GRUPO)
            const restantes = grupo.totalDocumentos - documentosExibidos.length
            return (
              <View key={grupo.codigo} style={styles.grupoBox} wrap={false}>
                <View style={styles.grupoHeader}>
                  <Text style={styles.grupoTitulo}>{grupo.resumo}</Text>
                  <View style={[styles.badge, { backgroundColor: cor.fundo }]}><Text style={{ color: cor.cor, fontSize: 6.5, fontWeight: 700 }}>{cor.label}</Text></View>
                </View>
                <Text style={styles.grupoLinha}><Text style={styles.grupoLabel}>Documentos afetados: </Text>{grupo.totalDocumentos} de {resumo.totalDocumentos}</Text>
                <Text style={styles.grupoLinha}><Text style={styles.grupoLabel}>Itens afetados: </Text>{grupo.totalItens}</Text>
                <Text style={styles.grupoLinha}><Text style={styles.grupoLabel}>Documentos: </Text>{documentosExibidos.join(', ') || '—'}{restantes > 0 ? ` e mais ${restantes}` : ''}</Text>
                <Text style={styles.grupoLinha}><Text style={styles.grupoLabel}>Explicação: </Text>{grupo.explicacao}</Text>
                <Text style={styles.grupoLinha}><Text style={styles.grupoLabel}>Possível impacto: </Text>{grupo.impacto}</Text>
                <Text style={styles.grupoLinha}><Text style={styles.grupoLabel}>Responsável sugerido: </Text>{grupo.responsavel}</Text>
                <Text style={[styles.grupoLinha, { marginBottom: 2 }]}><Text style={styles.grupoLabel}>Orientação:</Text></Text>
                {grupo.orientacao.map((passo, i) => (
                  <Text key={i} style={styles.grupoOrientacaoItem}>{i + 1}. {passo}</Text>
                ))}
              </View>
            )
          })
        )}

        {/* Conclusão / próximas ações */}
        <Text style={styles.tituloSecao} break>Conclusão e próximas ações</Text>
        <Text style={styles.paragrafo}>
          Este relatório verifica se os XMLs analisados trazem os campos básicos de IBS e CBS de acordo com o padrão geral
          de referência do período de teste de {dados.parametros.ano} (versão {dados.parametros.versao}). Ele não substitui uma
          auditoria tributária completa nem determina automaticamente todas as classificações fiscais possíveis de cada operação.
        </Text>
        <Text style={styles.paragrafo}>
          Itens classificados como <Text style={{ color: CORES.critico, fontWeight: 700 }}>Crítico</Text> indicam ausência de
          informações obrigatórias — normalmente um indício de que o sistema emissor precisa ser atualizado ou configurado.
          Itens classificados como <Text style={{ color: CORES.alerta, fontWeight: 700 }}>Atenção</Text> têm os campos preenchidos,
          mas com valores diferentes da referência simplificada — o que pode ser um tratamento tributário específico legítimo
          (redução, isenção, diferimento) e deve ser confirmado pelo contador antes de qualquer alteração no cadastro fiscal.
        </Text>
        <Text style={styles.paragrafo}>
          Próximas ações sugeridas: (1) revisar os grupos de divergência acima com o contador responsável; (2) para pendências
          críticas, acionar o suporte do sistema emissor; (3) após ajustes, emitir uma nota em homologação e reanalisar antes
          de aplicar em produção.
        </Text>
        <Text style={styles.paragrafo}>
          Resumo legal: esta análise tem caráter informativo e utiliza parâmetros de referência simplificados para o período
          de teste da Reforma Tributária (Lei Complementar 214/2025 e normas correlatas). Não constitui parecer tributário nem
          substitui a orientação de um profissional de contabilidade habilitado.
        </Text>
        <Text style={styles.paragrafo}>
          Contato Enfokus: {ENFOKUS_CONTABILIDADE.nomeFantasia} · {ENFOKUS_CONTABILIDADE.telefoneFormatado} · {ENFOKUS_CONTABILIDADE.siteExibicao}
        </Text>

        {/* Anexo compacto — listagem de notas (nunca o conteúdo principal) */}
        <Text style={styles.tituloSecao} break>Anexo — documentos analisados</Text>
        <Text style={[styles.paragrafo, { marginBottom: 6 }]}>
          Listagem compacta de referência{dados.anexoDocumentos.length > MAX_LINHAS_ANEXO ? ` (exibindo os ${MAX_LINHAS_ANEXO} primeiros de ${dados.anexoDocumentos.length} documentos — o total consolidado já está refletido nos indicadores acima)` : ''}.
        </Text>
        <View style={styles.tabela}>
          <View style={styles.linhaCabecalho} fixed>
            <Text style={[styles.celulaCabecalho, { width: COLS_ANEXO.nota }]}>Nota</Text>
            <Text style={[styles.celulaCabecalho, { width: COLS_ANEXO.data }]}>Data</Text>
            <Text style={[styles.celulaCabecalho, { width: COLS_ANEXO.participante }]}>Participante</Text>
            <Text style={[styles.celulaCabecalho, { width: COLS_ANEXO.ibs }]}>IBS</Text>
            <Text style={[styles.celulaCabecalho, { width: COLS_ANEXO.cbs }]}>CBS</Text>
            <Text style={[styles.celulaCabecalho, { width: COLS_ANEXO.situacao }]}>Situação</Text>
          </View>
          {dados.anexoDocumentos.slice(0, MAX_LINHAS_ANEXO).map((l, i) => {
            const cor = SITUACAO_COR[l.situacao]
            return (
              <View key={i} style={styles.linha} wrap={false}>
                <Text style={[styles.celula, { width: COLS_ANEXO.nota }]}>{l.nota}</Text>
                <Text style={[styles.celula, { width: COLS_ANEXO.data }]}>{dataBrDeIso(l.data)}</Text>
                <Text style={[styles.celula, { width: COLS_ANEXO.participante }]}>{l.participante}</Text>
                <Text style={[styles.celula, { width: COLS_ANEXO.ibs }]}>{money.format(l.valorIbs)}</Text>
                <Text style={[styles.celula, { width: COLS_ANEXO.cbs }]}>{money.format(l.valorCbs)}</Text>
                <View style={{ width: COLS_ANEXO.situacao, padding: 4 }}>
                  <Text style={[styles.badge, { color: cor.cor, backgroundColor: cor.fundo }]}>{cor.label}</Text>
                </View>
              </View>
            )
          })}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerTexto}>{ENFOKUS_CONTABILIDADE.nomeFantasia} · {ENFOKUS_CONTABILIDADE.cnpjFormatado} · Relatório de uso interno do assinante</Text>
          <Text style={styles.footerTexto} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
