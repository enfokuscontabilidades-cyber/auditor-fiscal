// Relatório de conferência de IBS/CBS — VERSÃO DO CONTADOR PARA O CLIENTE.
//
// Consome exatamente o mesmo resultado estruturado da análise que a versão
// empresarial (RelatorioReformaAutenticadoPdf.tsx): os mesmos `grupos`
// (lib/fiscal/resumoReformaTributaria.ts) e o mesmo `resumo` consolidado
// (documentos e itens sempre contados separadamente — nunca somados).
// NENHUMA regra de IBS/CBS é recalculada ou duplicada aqui — só a
// apresentação, o tom de comunicação e a identidade visual mudam.
//
// Ordem das seções (não iniciar pela relação de notas — ela vai só no
// anexo final): capa/resumo executivo → parâmetros → divergências e
// providências → mensagem ao fornecedor → conclusão → avisos → assinatura
// do escritório → Anexo I (relação dos documentos).
//
// Não deve conter, em nenhuma hipótese: nome, logo, CNPJ, endereço,
// telefone, WhatsApp, site, QR Code ou chamada comercial da Enfokus. O
// emissor deste documento é o escritório contábil do workspace.

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { dataBrDeIso, dataHoraBr } from './formatadores'
import type { SituacaoReforma } from '@/lib/fiscal/analiseReformaTributariaPaga'
import type { ParametrosReferenciaReforma } from '@/lib/fiscal/parametrosReforma2026'
import type { GrupoDivergenciaReforma, ResumoAnaliseReforma } from '@/lib/fiscal/resumoReformaTributaria'
import type { ModoParametrosReforma } from '@/lib/types'

const CORES_PADRAO = {
  texto: '#1c1c1c',
  textoSuave: '#4b4b4b',
  textoFraco: '#7a7a7a',
  borda: '#dcdcdc',
  fundoAlt: '#f7f7f7',
  ok: '#1a7a4c', okFundo: '#e7f6ee',
  alerta: '#8a6d00', alertaFundo: '#fbf6e0',
  critico: '#b3261e', criticoFundo: '#fbeceb',
}

function corSituacao(cor: { ok: string; alerta: string; critico: string }, situacao: SituacaoReforma) {
  return { ok: cor.ok, alerta: cor.alerta, critico: cor.critico }[situacao]
}

const LABEL_SITUACAO: Record<SituacaoReforma, string> = { ok: 'Adequado', alerta: 'Atenção', critico: 'Crítico' }

const styles = StyleSheet.create({
  page: { paddingTop: 76, paddingBottom: 46, paddingHorizontal: 40, fontSize: 9.5, fontFamily: 'Helvetica', color: CORES_PADRAO.texto, lineHeight: 1.4 },
  header: {
    position: 'absolute', top: 20, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: CORES_PADRAO.borda,
  },
  headerLogo: { width: 88, height: 32, objectFit: 'contain' },
  headerNomeEscritorio: { fontSize: 10, fontWeight: 700 },
  headerRight: { alignItems: 'flex-end' },
  headerTitulo: { fontSize: 8.5, fontWeight: 700 },
  headerMeta: { fontSize: 7.5, color: CORES_PADRAO.textoFraco, marginTop: 1 },
  footer: {
    position: 'absolute', bottom: 16, left: 40, right: 40,
    paddingTop: 6, borderTopWidth: 1, borderTopColor: CORES_PADRAO.borda,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerTexto: { fontSize: 7, color: CORES_PADRAO.textoFraco },

  tituloRelatorio: { fontSize: 17, fontWeight: 700, marginBottom: 3 },
  titulo: { fontSize: 15, fontWeight: 700, marginBottom: 2 },
  subtitulo: { fontSize: 9.5, color: CORES_PADRAO.textoSuave, marginBottom: 9 },
  tituloSecao: { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 7 },
  paragrafo: { fontSize: 9.5, color: CORES_PADRAO.textoSuave, lineHeight: 1.45, marginBottom: 3 },

  metricasRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  metricaCard: { flex: 1, borderWidth: 1, borderColor: CORES_PADRAO.borda, borderRadius: 3, padding: 7, backgroundColor: CORES_PADRAO.fundoAlt },
  metricaLabel: { fontSize: 7, color: CORES_PADRAO.textoFraco, textTransform: 'uppercase', marginBottom: 3 },
  metricaValor: { fontSize: 13, fontWeight: 700 },

  parametrosBox: { borderWidth: 1, borderColor: CORES_PADRAO.borda, borderRadius: 3, padding: 8, backgroundColor: CORES_PADRAO.fundoAlt, marginBottom: 6 },
  parametrosTitulo: { fontSize: 9, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' },
  parametrosLinha: { flexDirection: 'row', gap: 14, marginBottom: 3, flexWrap: 'wrap' },
  parametrosItem: { fontSize: 8.5 },
  parametrosNota: { fontSize: 8, color: CORES_PADRAO.textoFraco, marginTop: 2, lineHeight: 1.4 },

  grupoBox: { borderWidth: 1, borderColor: CORES_PADRAO.borda, borderRadius: 3, marginBottom: 7, padding: 9 },
  grupoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  grupoTitulo: { fontSize: 9.5, fontWeight: 700 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontWeight: 700 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 6 },
  statLabel: { fontSize: 7, color: CORES_PADRAO.textoFraco, textTransform: 'uppercase', marginBottom: 2 },
  statValor: { fontSize: 11, fontWeight: 700 },
  grupoLinha: { fontSize: 8.5, color: CORES_PADRAO.textoSuave, marginBottom: 3, lineHeight: 1.45 },
  grupoLabel: { fontWeight: 700, color: CORES_PADRAO.texto },
  grupoOrientacaoItem: { fontSize: 8.5, color: CORES_PADRAO.textoSuave, marginBottom: 2, lineHeight: 1.4 },

  tabela: { borderWidth: 1, borderColor: CORES_PADRAO.borda, borderRadius: 3 },
  linhaCabecalho: { flexDirection: 'row', backgroundColor: CORES_PADRAO.fundoAlt, borderBottomWidth: 1, borderBottomColor: CORES_PADRAO.borda },
  linha: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: CORES_PADRAO.borda },
  celulaCabecalho: { padding: 5, fontSize: 8, fontWeight: 700, color: CORES_PADRAO.textoSuave, textTransform: 'uppercase' },
  celula: { padding: 5, fontSize: 8 },

  mensagemBox: { borderWidth: 1, borderColor: CORES_PADRAO.borda, borderStyle: 'dashed', borderRadius: 3, padding: 9, marginTop: 3, marginBottom: 6, backgroundColor: CORES_PADRAO.fundoAlt },
  mensagemParagrafo: { fontSize: 9, fontStyle: 'italic', color: CORES_PADRAO.texto, lineHeight: 1.45, marginBottom: 4 },

  assinaturaBox: { marginTop: 12, paddingTop: 9, borderTopWidth: 1, borderTopColor: CORES_PADRAO.borda },
  iniciais: {
    width: 32, height: 32, borderRadius: 4, borderWidth: 1, borderColor: CORES_PADRAO.borda,
    alignItems: 'center', justifyContent: 'center', marginBottom: 5,
  },
})

const COLS_DOC = { tipo: '11%', numero: '11%', serie: '7%', data: '12%', itens: '11%', divergencia: '35%', status: '13%' }

export interface DocumentoSemDestaqueReforma {
  tipoDocumento: string
  numero: string
  serie: string
  data: string
  itensAfetados: number
  principalDivergencia: string
  status: SituacaoReforma
}

export interface EscritorioContabilPdf {
  nome: string
  razaoSocial: string | null
  cnpjFormatado: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  site: string | null
  cidade: string | null
  estado: string | null
  contadorResponsavel: string | null
  crc: string | null
  corPrincipal: string | null
}

export interface DadosRelatorioReformaContadorCliente {
  codigoRelatorio: string
  empresaNome: string
  empresaCnpjFormatado: string
  competencia?: string
  dataEmissao: Date
  parametros: ParametrosReferenciaReforma
  modoParametros: ModoParametrosReforma
  observacaoParametros?: string
  resumo: ResumoAnaliseReforma
  grupos: GrupoDivergenciaReforma[]
  /** Documentos com alguma divergência (atenção ou crítica) — exibidos só no Anexo I, nunca no corpo principal. */
  documentosSemDestaque: DocumentoSemDestaqueReforma[]
  escritorio: EscritorioContabilPdf
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numberFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const MAX_LINHAS_ANEXO = 400

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '—'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** Parágrafos da mensagem pronta para o suporte do sistema emissor — objetiva, sem repetir a mesma informação. */
function paragrafosMensagemFornecedor(dados: DadosRelatorioReformaContadorCliente): string[] {
  const p1 = 'Identificamos que os XMLs emitidos pela empresa estão sendo gerados sem o grupo IBSCBS ou com informações incompletas relacionadas ao IBS e à CBS.'
  const p2 = 'Solicitamos verificar se o sistema emissor está atualizado para o leiaute vigente da Reforma Tributária e se os novos campos estão devidamente habilitados.'

  if (dados.modoParametros === 'estrutural') return [p1, p2]

  const referencia = dados.modoParametros === 'padrao_2026'
    ? 'Para as operações enquadradas no padrão utilizado nesta análise'
    : 'Para as operações enquadradas na referência definida pelo escritório para este cliente'

  return [p1, p2, `${referencia}, verificar a parametrização do CST ${dados.parametros.cst}, cClassTrib ${dados.parametros.cClassTrib}, ` +
    `CBS de ${numberFmt.format(dados.parametros.aliquotaCbs)}% e IBS total de ${numberFmt.format(dados.parametros.aliquotaIbsTotal)}%.`]
}

/** Conclusão — três variantes conforme o resultado; nunca solicita envio manual de XML como regra geral. */
function paragrafosConclusao(dados: DadosRelatorioReformaContadorCliente): string[] {
  const { resumo } = dados

  if (resumo.documentosCriticos > 0) {
    return [
      `Com base nos ${resumo.totalDocumentos} XMLs analisados, identificamos ${resumo.documentosCriticos} documento(s) com divergências ` +
      `críticas relacionadas ao IBS e à CBS, abrangendo ${resumo.itensCriticos} item(ns).`,
      'Solicitamos que a empresa encaminhe este relatório ao suporte do sistema emissor e providencie as correções e parametrizações indicadas.',
      'Após a conclusão dos ajustes, a empresa deverá comunicar o escritório contábil. Uma nova conferência será realizada nos documentos ' +
      'fiscais emitidos por meio das fontes disponíveis ao escritório, sem necessidade de encaminhamento manual dos XMLs, salvo quando solicitado.',
    ]
  }

  if (resumo.documentosAtencao > 0) {
    return [
      `Com base nos ${resumo.totalDocumentos} XMLs analisados, identificamos ${resumo.documentosAtencao} documento(s) com parâmetros que precisam de validação.`,
      'As diferenças encontradas não representam automaticamente erro, pois podem decorrer de tratamentos tributários específicos.',
      'Recomendamos que a empresa valide as parametrizações junto ao escritório contábil e ao fornecedor do sistema emissor.',
    ]
  }

  return [
    `Nos ${resumo.totalDocumentos} XMLs analisados, não foram identificadas divergências relevantes nas verificações de IBS e CBS realizadas.`,
    'Recomendamos manter o sistema emissor atualizado e realizar conferências periódicas durante o período de implantação da Reforma Tributária.',
  ]
}

export default function RelatorioReformaContadorClientePdf({ dados, logoDataUri }: { dados: DadosRelatorioReformaContadorCliente; logoDataUri: string | null }) {
  const cores = CORES_PADRAO
  const corDestaque = dados.escritorio.corPrincipal || CORES_PADRAO.texto
  const { resumo } = dados
  const indicadorConsolidado: SituacaoReforma = resumo.documentosCriticos > 0 ? 'critico' : resumo.documentosAtencao > 0 ? 'alerta' : 'ok'
  const corIndicador = corSituacao(cores, indicadorConsolidado)
  const fundoIndicador = { ok: cores.okFundo, alerta: cores.alertaFundo, critico: cores.criticoFundo }[indicadorConsolidado]

  const contatosEscritorio = [
    dados.escritorio.telefone ? `Tel. ${dados.escritorio.telefone}` : null,
    dados.escritorio.email,
    dados.escritorio.site,
    dados.escritorio.cidade && dados.escritorio.estado ? `${dados.escritorio.cidade}/${dados.escritorio.estado}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <Document title={`Relatorio de adequacao IBS-CBS - ${dados.empresaNome}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          {logoDataUri ? (
            <Image src={logoDataUri} style={styles.headerLogo} />
          ) : (
            <Text style={[styles.headerNomeEscritorio, { color: corDestaque }]}>{dados.escritorio.nome}</Text>
          )}
          <View style={styles.headerRight}>
            <Text style={[styles.headerTitulo, { color: corDestaque }]}>Relatório de Adequação dos XMLs ao IBS e à CBS</Text>
            <Text style={styles.headerMeta}>Gerado em {dataHoraBr(dados.dataEmissao)} · Código {dados.codigoRelatorio}</Text>
          </View>
        </View>

        {/* Capa e identificação */}
        <Text style={[styles.tituloRelatorio, { color: corDestaque }]}>Relatório de Adequação dos XMLs ao IBS e à CBS</Text>
        <Text style={styles.titulo}>{dados.empresaNome}</Text>
        <Text style={styles.subtitulo}>
          {dados.empresaCnpjFormatado}{dados.competencia ? ` · Competência ${dados.competencia}` : ''} · Análise realizada pelo escritório contábil para orientação da empresa cliente
        </Text>
        <View style={[styles.badge, { backgroundColor: fundoIndicador, marginBottom: 10 }]}>
          <Text style={{ color: corIndicador, fontSize: 8.5, fontWeight: 700 }}>Indicador consolidado: {LABEL_SITUACAO[indicadorConsolidado]}</Text>
        </View>

        <Text style={styles.paragrafo}>
          Realizamos a análise dos arquivos XML disponibilizados pela empresa {dados.empresaNome}, com o objetivo de verificar
          o preenchimento das informações relacionadas ao IBS e à CBS.
        </Text>
        <Text style={styles.paragrafo}>
          A análise identificou {resumo.documentosAdequados} documento(s) adequado(s), {resumo.documentosAtencao} documento(s) que
          precisam de validação e {resumo.documentosCriticos} documento(s) com informações ausentes ou críticas, entre {resumo.totalDocumentos} XML(s)
          e {resumo.totalItens} item(ns) analisados.
        </Text>

        {/* Resumo executivo */}
        <Text style={styles.tituloSecao}>Resumo executivo</Text>
        <View style={styles.metricasRow}>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>XMLs analisados</Text><Text style={styles.metricaValor}>{resumo.totalDocumentos}</Text></View>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Itens analisados</Text><Text style={styles.metricaValor}>{resumo.totalItens}</Text></View>
        </View>
        <View style={styles.metricasRow}>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Documentos adequados</Text><Text style={[styles.metricaValor, { color: cores.ok }]}>{resumo.documentosAdequados}</Text></View>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Documentos em atenção</Text><Text style={[styles.metricaValor, { color: cores.alerta }]}>{resumo.documentosAtencao}</Text></View>
          <View style={styles.metricaCard}><Text style={styles.metricaLabel}>Documentos críticos</Text><Text style={[styles.metricaValor, { color: cores.critico }]}>{resumo.documentosCriticos}</Text></View>
        </View>
        {resumo.documentosAfetados > 0 && (
          <Text style={[styles.paragrafo, { fontWeight: 700, color: resumo.documentosCriticos > 0 ? cores.critico : cores.alerta }]}>
            Identificamos {resumo.documentosAfetados} documento(s) fiscal(is) com divergências de IBS e CBS, abrangendo {resumo.itensAfetados} item(ns) — relação completa no Anexo I.
          </Text>
        )}

        {/* Parâmetros utilizados */}
        <View style={styles.parametrosBox}>
          {dados.modoParametros === 'padrao_2026' && (
            <>
              <Text style={styles.parametrosTitulo}>Referência utilizada: padrão geral de {dados.parametros.ano}</Text>
              <View style={styles.parametrosLinha}>
                <Text style={styles.parametrosItem}>CBS: {numberFmt.format(dados.parametros.aliquotaCbs)}%</Text>
                <Text style={styles.parametrosItem}>IBS total: {numberFmt.format(dados.parametros.aliquotaIbsTotal)}%</Text>
                <Text style={styles.parametrosItem}>CST: {dados.parametros.cst}</Text>
                <Text style={styles.parametrosItem}>cClassTrib: {dados.parametros.cClassTrib}</Text>
              </View>
            </>
          )}
          {dados.modoParametros === 'especifico' && (
            <>
              <Text style={styles.parametrosTitulo}>Referência específica informada pelo escritório</Text>
              <View style={styles.parametrosLinha}>
                <Text style={styles.parametrosItem}>CBS: {numberFmt.format(dados.parametros.aliquotaCbs)}%</Text>
                <Text style={styles.parametrosItem}>IBS total: {numberFmt.format(dados.parametros.aliquotaIbsTotal)}%</Text>
                <Text style={styles.parametrosItem}>CST: {dados.parametros.cst}</Text>
                <Text style={styles.parametrosItem}>cClassTrib: {dados.parametros.cClassTrib}</Text>
              </View>
              {dados.observacaoParametros && <Text style={styles.parametrosNota}>Observação: {dados.observacaoParametros}</Text>}
            </>
          )}
          {dados.modoParametros === 'estrutural' && (
            <>
              <Text style={styles.parametrosTitulo}>Análise estrutural sem validação de parâmetros tributários</Text>
              <Text style={styles.parametrosNota}>
                Nesta análise foram verificadas a presença, a estrutura e a consistência dos campos de IBS e CBS, sem
                comparação com alíquotas, CST ou cClassTrib específicos.
              </Text>
            </>
          )}
        </View>

        {/* Divergências identificadas e providências */}
        <Text style={styles.tituloSecao} break>Divergências identificadas e providências</Text>
        {dados.grupos.length === 0 ? (
          <Text style={styles.paragrafo}>Nenhuma divergência identificada nos documentos analisados.</Text>
        ) : (
          dados.grupos.map(grupo => {
            const cor = corSituacao(cores, grupo.gravidade === 'critico' ? 'critico' : 'alerta')
            const fundo = grupo.gravidade === 'critico' ? cores.criticoFundo : cores.alertaFundo
            return (
              <View key={grupo.codigo} style={styles.grupoBox} wrap={false}>
                <View style={styles.grupoHeader}>
                  <Text style={styles.grupoTitulo}>{grupo.resumo}</Text>
                  <View style={[styles.badge, { backgroundColor: fundo }]}><Text style={{ color: cor, fontSize: 7, fontWeight: 700 }}>{grupo.gravidade === 'critico' ? 'Crítico' : 'Atenção'}</Text></View>
                </View>
                <View style={styles.statsRow}>
                  <View>
                    <Text style={styles.statLabel}>Documentos afetados</Text>
                    <Text style={styles.statValor}>{grupo.totalDocumentos} de {resumo.totalDocumentos}</Text>
                  </View>
                  <View>
                    <Text style={styles.statLabel}>Itens afetados</Text>
                    <Text style={styles.statValor}>{grupo.totalItens}</Text>
                  </View>
                </View>
                <Text style={styles.grupoLinha}><Text style={styles.grupoLabel}>Explicação: </Text>{grupo.explicacao}</Text>
                <Text style={[styles.grupoLinha, { marginBottom: 3 }]}><Text style={styles.grupoLabel}>Providências solicitadas:</Text></Text>
                {grupo.orientacao.map((passo, i) => (
                  <Text key={i} style={styles.grupoOrientacaoItem}>{i + 1}. {passo}</Text>
                ))}
              </View>
            )
          })
        )}

        {/* Mensagem pronta para o fornecedor */}
        {dados.grupos.length > 0 && (
          <>
            <Text style={styles.tituloSecao}>Mensagem sugerida para o suporte do sistema emissor</Text>
            <View style={styles.mensagemBox}>
              {paragrafosMensagemFornecedor(dados).map((par, i) => (
                <Text key={i} style={[styles.mensagemParagrafo, i === 0 ? { marginTop: 0 } : {}]}>{par}</Text>
              ))}
            </View>
          </>
        )}

        {/* Conclusão */}
        <Text style={styles.tituloSecao} break>Conclusão</Text>
        {paragrafosConclusao(dados).map((par, i) => <Text key={i} style={styles.paragrafo}>{par}</Text>)}

        {/* Avisos e limitações */}
        <Text style={styles.tituloSecao}>Avisos e limitações</Text>
        <Text style={styles.paragrafo}>
          Este relatório foi elaborado a partir dos arquivos XML disponibilizados pela empresa e das regras automatizadas de
          verificação de IBS e CBS disponíveis na data da análise.
        </Text>
        <Text style={styles.paragrafo}>
          O relatório possui caráter informativo e não constitui certificação fiscal, auditoria independente ou parecer
          jurídico. A aplicabilidade das regras pode variar conforme a operação, o produto, o serviço, o regime tributário e
          tratamentos específicos.
        </Text>
        {dados.modoParametros === 'especifico' && (
          <Text style={styles.paragrafo}>Os parâmetros tributários utilizados como referência foram informados pelo escritório responsável pela análise.</Text>
        )}

        {/* Identificação do escritório contábil */}
        <View style={styles.assinaturaBox}>
          {!logoDataUri && (
            <View style={[styles.iniciais, { borderColor: corDestaque }]}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: corDestaque }}>{iniciaisDoNome(dados.escritorio.nome)}</Text>
            </View>
          )}
          <Text style={{ fontSize: 10.5, fontWeight: 700, color: corDestaque }}>{dados.escritorio.nome}</Text>
          {dados.escritorio.razaoSocial && <Text style={styles.paragrafo}>{dados.escritorio.razaoSocial}</Text>}
          {(dados.escritorio.contadorResponsavel || dados.escritorio.crc) && (
            <Text style={styles.paragrafo}>
              {dados.escritorio.contadorResponsavel}{dados.escritorio.contadorResponsavel && dados.escritorio.crc ? ' · ' : ''}{dados.escritorio.crc ? `CRC ${dados.escritorio.crc}` : ''}
            </Text>
          )}
          {contatosEscritorio && <Text style={styles.paragrafo}>{contatosEscritorio}</Text>}
        </View>

        {/* Anexo I — relação dos documentos, sempre por último */}
        <Text style={styles.tituloSecao} break>
          {dados.documentosSemDestaque.length > 0 ? 'Anexo I — Documentos com divergências de IBS e CBS' : 'Anexo I — Relação dos documentos analisados'}
        </Text>
        <Text style={[styles.paragrafo, { marginBottom: 7 }]}>
          {resumo.documentosAdequados > 0 && `${resumo.documentosAdequados} documento(s) adequado(s) não estão listados abaixo (sem divergências identificadas). `}
          {dados.documentosSemDestaque.length > MAX_LINHAS_ANEXO
            ? `Exibindo os ${MAX_LINHAS_ANEXO} primeiros de ${dados.documentosSemDestaque.length} documentos com divergência — o total consolidado já está refletido nos indicadores acima.`
            : ''}
        </Text>
        {dados.documentosSemDestaque.length === 0 ? (
          <Text style={styles.paragrafo}>Nenhum documento com divergência foi identificado.</Text>
        ) : (
          <View style={styles.tabela}>
            <View style={styles.linhaCabecalho} fixed>
              <Text style={[styles.celulaCabecalho, { width: COLS_DOC.tipo }]}>Tipo</Text>
              <Text style={[styles.celulaCabecalho, { width: COLS_DOC.numero }]}>Número</Text>
              <Text style={[styles.celulaCabecalho, { width: COLS_DOC.serie }]}>Série</Text>
              <Text style={[styles.celulaCabecalho, { width: COLS_DOC.data }]}>Emissão</Text>
              <Text style={[styles.celulaCabecalho, { width: COLS_DOC.itens }]}>Itens afetados</Text>
              <Text style={[styles.celulaCabecalho, { width: COLS_DOC.divergencia }]}>Principal divergência</Text>
              <Text style={[styles.celulaCabecalho, { width: COLS_DOC.status }]}>Status</Text>
            </View>
            {dados.documentosSemDestaque.slice(0, MAX_LINHAS_ANEXO).map((d, i) => (
              <View key={i} style={styles.linha} wrap={false}>
                <Text style={[styles.celula, { width: COLS_DOC.tipo }]}>{d.tipoDocumento}</Text>
                <Text style={[styles.celula, { width: COLS_DOC.numero }]}>{d.numero}</Text>
                <Text style={[styles.celula, { width: COLS_DOC.serie }]}>{d.serie}</Text>
                <Text style={[styles.celula, { width: COLS_DOC.data }]}>{dataBrDeIso(d.data)}</Text>
                <Text style={[styles.celula, { width: COLS_DOC.itens }]}>{d.itensAfetados}</Text>
                <Text style={[styles.celula, { width: COLS_DOC.divergencia, fontSize: 7.5 }]}>{d.principalDivergencia}</Text>
                <View style={{ width: COLS_DOC.status, padding: 4 }}>
                  <Text style={[styles.badge, { color: corSituacao(cores, d.status), backgroundColor: { ok: cores.okFundo, alerta: cores.alertaFundo, critico: cores.criticoFundo }[d.status] }]}>
                    {LABEL_SITUACAO[d.status]}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerTexto}>{dados.escritorio.nome} · Relatório {dados.codigoRelatorio}</Text>
          <Text style={styles.footerTexto} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
