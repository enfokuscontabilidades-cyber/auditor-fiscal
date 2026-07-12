// Template do Relatório de Diagnóstico de IBS e CBS — papel timbrado da
// Enfokus Contabilidade. Renderizado no servidor com @react-pdf/renderer
// (gera PDF nativo com texto pesquisável/selecionável). Restrito a 4
// páginas: (1) identificação e resultado geral, (2) divergências de IBS/CBS,
// (3) resumo legal e técnico, (4) conclusão, orientação e contato.

import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { DadosRelatorio } from '@/lib/relatorioReforma/dadosRelatorio'
import { LABEL_GRAVIDADE, type GravidadeDivergencia } from '@/lib/relatorioReforma/divergencias'
import { dataBr, dataHoraBr } from './formatadores'

const CORES = {
  primaria: '#0e8a96',
  primariaClara: '#e6f7f8',
  texto: '#16232c',
  textoSuave: '#4b5c68',
  textoFraco: '#7c8a94',
  borda: '#dbe3e7',
  fundoAlt: '#f6f9fa',
  critica: '#b3261e',
  criticaFundo: '#fbeceb',
  alta: '#c25b0a',
  altaFundo: '#fdf1e6',
  media: '#8a6d00',
  mediaFundo: '#fbf6e0',
  baixa: '#1257a3',
  baixaFundo: '#e9f1fb',
  informativa: '#5a5a5a',
  informativaFundo: '#f0f0f0',
}

const GRAVIDADE_COR: Record<GravidadeDivergencia, { cor: string; fundo: string }> = {
  critica: { cor: CORES.critica, fundo: CORES.criticaFundo },
  alta: { cor: CORES.alta, fundo: CORES.altaFundo },
  media: { cor: CORES.media, fundo: CORES.mediaFundo },
  baixa: { cor: CORES.baixa, fundo: CORES.baixaFundo },
  informativa: { cor: CORES.informativa, fundo: CORES.informativaFundo },
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 82,
    paddingBottom: 60,
    paddingHorizontal: 42,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: CORES.texto,
    lineHeight: 1.4,
  },
  header: {
    position: 'absolute', top: 24, left: 42, right: 42,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: CORES.borda,
  },
  headerLogo: { width: 108, height: 36, objectFit: 'contain' },
  headerRight: { alignItems: 'flex-end' },
  headerTitulo: { fontSize: 9, fontWeight: 700, color: CORES.primaria },
  headerMeta: { fontSize: 7.5, color: CORES.textoFraco, marginTop: 1 },
  footer: {
    position: 'absolute', bottom: 22, left: 42, right: 42,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: CORES.borda,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  footerTexto: { fontSize: 7, color: CORES.textoFraco, lineHeight: 1.5 },
  footerPagina: { fontSize: 7, color: CORES.textoFraco },

  capaTitulo: { fontSize: 19, fontWeight: 700, color: CORES.texto, marginTop: 26, marginBottom: 4 },
  capaSubtitulo: { fontSize: 12.5, color: CORES.primaria, fontWeight: 700, marginBottom: 24 },
  capaBoxPontuacao: {
    marginTop: 4, marginBottom: 26, padding: 20, borderRadius: 4, backgroundColor: CORES.fundoAlt,
    borderWidth: 1, borderColor: CORES.borda, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  capaPontuacaoNumero: { fontSize: 40, fontWeight: 700, color: CORES.primaria, lineHeight: 1 },
  capaPontuacaoLabel: { fontSize: 9.5, color: CORES.textoSuave, marginTop: 6 },
  capaClassificacao: { fontSize: 14, fontWeight: 700, color: CORES.texto, textAlign: 'right', maxWidth: 260 },

  secaoTitulo: {
    fontSize: 13, fontWeight: 700, color: CORES.texto, marginTop: 0, marginBottom: 10,
    paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: CORES.primaria,
  },
  subTitulo: { fontSize: 10.5, fontWeight: 700, color: CORES.texto, marginTop: 14, marginBottom: 6 },
  paragrafo: { fontSize: 9.5, color: CORES.textoSuave, marginBottom: 6, lineHeight: 1.5 },

  gridIdentificacao: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  campoIdent: { width: '50%', marginBottom: 12, paddingRight: 10 },
  campoIdentLabel: { fontSize: 7.5, color: CORES.textoFraco, textTransform: 'uppercase', marginBottom: 2 },
  campoIdentValor: { fontSize: 11, color: CORES.texto, fontWeight: 700 },

  divergenciaCard: {
    borderWidth: 1, borderColor: CORES.borda, borderRadius: 3, marginBottom: 4, padding: 6,
  },
  divergenciaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  divergenciaNumero: { fontSize: 9, fontWeight: 700, color: CORES.texto },
  badgeGravidade: { fontSize: 6.5, fontWeight: 700, paddingVertical: 1.5, paddingHorizontal: 6, borderRadius: 8 },
  linhaCompacta: { fontSize: 7.8, color: CORES.textoSuave, marginTop: 1, lineHeight: 1.3 },
  linhaCompactaForte: { fontSize: 7.8, color: CORES.texto, marginTop: 1, lineHeight: 1.3, fontWeight: 700 },

  blocoPositivo: {
    padding: 16, borderRadius: 4, backgroundColor: CORES.primariaClara, borderWidth: 1, borderColor: CORES.primaria,
    marginBottom: 14,
  },
  blocoSemDados: {
    padding: 16, borderRadius: 4, backgroundColor: CORES.fundoAlt, borderWidth: 1, borderColor: CORES.borda,
    marginBottom: 14,
  },
  blocoPositivoTitulo: { fontSize: 11, fontWeight: 700, color: CORES.texto, marginBottom: 4 },
  blocoPositivoTexto: { fontSize: 9.5, color: CORES.textoSuave, lineHeight: 1.5 },

  resumoContadores: { flexDirection: 'row', gap: 10, marginTop: 4 },
  contadorBox: { flex: 1, padding: 10, borderRadius: 3, backgroundColor: CORES.fundoAlt, borderWidth: 1, borderColor: CORES.borda },
  contadorNumero: { fontSize: 16, fontWeight: 700, color: CORES.primaria },
  contadorLabel: { fontSize: 7.5, color: CORES.textoFraco, marginTop: 2 },

  falhaBox: { marginTop: 12, padding: 10, borderRadius: 3, backgroundColor: CORES.fundoAlt, borderWidth: 1, borderColor: CORES.borda },
  falhaTitulo: { fontSize: 8.5, fontWeight: 700, color: CORES.texto, marginBottom: 3 },
  falhaLinha: { fontSize: 8, color: CORES.textoFraco, marginTop: 1 },

  legislacaoCard: { borderLeftWidth: 3, borderLeftColor: CORES.primaria, paddingLeft: 8, marginBottom: 8 },
  legislacaoTitulo: { fontSize: 9, fontWeight: 700, color: CORES.texto },
  legislacaoMeta: { fontSize: 7.5, color: CORES.textoFraco, marginTop: 1, marginBottom: 2 },
  legislacaoResumo: { fontSize: 8.3, color: CORES.textoSuave, lineHeight: 1.4 },

  orientacaoItem: { flexDirection: 'row', marginBottom: 5, alignItems: 'flex-start' },
  orientacaoNumero: {
    width: 15, height: 15, borderRadius: 8, backgroundColor: CORES.primaria, color: '#ffffff',
    fontSize: 8, fontWeight: 700, textAlign: 'center', marginRight: 7, paddingTop: 2.5,
  },
  orientacaoTexto: { fontSize: 9, color: CORES.textoSuave, flex: 1, lineHeight: 1.4 },

  avisoBox: {
    padding: 9, backgroundColor: CORES.fundoAlt, borderWidth: 1, borderColor: CORES.borda, borderRadius: 3, marginBottom: 6,
  },
  avisoTexto: { fontSize: 7.5, color: CORES.textoSuave, lineHeight: 1.45 },

  contatoBox: {
    marginTop: 10, padding: 14, backgroundColor: CORES.primariaClara, borderRadius: 4,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  contatoTitulo: { fontSize: 11, fontWeight: 700, color: CORES.texto, marginBottom: 4 },
  contatoTexto: { fontSize: 8.5, color: CORES.textoSuave, marginBottom: 6, maxWidth: 340 },
  contatoLinha: { fontSize: 8.5, color: CORES.texto, marginBottom: 2 },
  qrCode: { width: 70, height: 70 },
})

function Cabecalho({ dados, logoDataUri }: { dados: DadosRelatorio; logoDataUri: string | null }) {
  return (
    <View style={styles.header} fixed>
      {logoDataUri ? <Image src={logoDataUri} style={styles.headerLogo} /> : <Text style={styles.headerTitulo}>{dados.institucional.nomeFantasia}</Text>}
      <View style={styles.headerRight}>
        <Text style={styles.headerTitulo}>Relatório de Diagnóstico de IBS e CBS</Text>
        <Text style={styles.headerMeta}>Código: {dados.codigoDiagnostico} · Emitido em {dataBr(dados.dataEmissao)}</Text>
      </View>
    </View>
  )
}

function Rodape({ dados }: { dados: DadosRelatorio }) {
  const inst = dados.institucional
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerTexto}>
        {inst.razaoSocial} | CNPJ {inst.cnpjFormatado}{'\n'}
        {`${inst.endereco.logradouro}, nº ${inst.endereco.numero}, Qd. ${inst.endereco.quadra}, Lt. ${inst.endereco.lote}, Sala ${inst.endereco.sala}, ${inst.endereco.bairro}, ${inst.endereco.cidade} - ${inst.endereco.estado}`}{'\n'}
        {inst.telefoneFormatado} | {inst.siteExibicao}
      </Text>
      <Text style={styles.footerPagina} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}

function Badge({ gravidade }: { gravidade: GravidadeDivergencia }) {
  const c = GRAVIDADE_COR[gravidade]
  return <Text style={[styles.badgeGravidade, { color: c.cor, backgroundColor: c.fundo }]}>{LABEL_GRAVIDADE[gravidade].toUpperCase()}</Text>
}

// ---------- Página 1: identificação e resultado geral ----------

function PaginaIdentificacao({ dados }: { dados: DadosRelatorio }) {
  const e = dados.empresa
  const campos: [string, string][] = [
    ['Empresa analisada', e.nome],
    ['CNPJ', e.cnpjFormatado],
    ['Regime tributário informado', e.regimeTributario],
    ['Cidade / Estado', `${e.cidade} - ${e.estado}`],
    ['Data da análise', dataBr(e.dataAnalise)],
    ['Quantidade de XMLs analisados', String(e.quantidadeXmls)],
    ['Código do diagnóstico', dados.codigoDiagnostico],
  ]

  return (
    <View>
      <Text style={styles.capaTitulo}>Relatório de Diagnóstico de IBS e CBS</Text>
      <Text style={styles.capaSubtitulo}>{e.nome}</Text>

      <View style={styles.capaBoxPontuacao}>
        <View>
          <Text style={styles.capaPontuacaoNumero}>{dados.pontuacao.pontuacao}</Text>
          <Text style={styles.capaPontuacaoLabel}>de 100 pontos em verificações de IBS e CBS</Text>
        </View>
        <Text style={styles.capaClassificacao}>{dados.pontuacao.classificacaoLabel}</Text>
      </View>

      <View style={styles.gridIdentificacao}>
        {campos.map(([label, valor]) => (
          <View key={label} style={styles.campoIdent}>
            <Text style={styles.campoIdentLabel}>{label}</Text>
            <Text style={styles.campoIdentValor}>{valor}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.paragrafo}>
        A pontuação considera exclusivamente as verificações de IBS e CBS aplicáveis aos documentos enviados. Ela não
        constitui certificação de conformidade tributária.
      </Text>
    </View>
  )
}

// ---------- Página 2: resultado e divergências de IBS/CBS ----------

function PaginaDivergencias({ dados }: { dados: DadosRelatorio }) {
  const semDivergencias = dados.divergencias.length === 0

  return (
    <View break>
      <Text style={styles.secaoTitulo}>Resultado da análise de IBS e CBS</Text>

      {semDivergencias ? (
        <View style={dados.blocoResultadoSemDivergencia.tipo === 'positivo' ? styles.blocoPositivo : styles.blocoSemDados}>
          <Text style={styles.blocoPositivoTitulo}>{dados.blocoResultadoSemDivergencia.titulo}</Text>
          <Text style={styles.blocoPositivoTexto}>{dados.blocoResultadoSemDivergencia.texto}</Text>
          {dados.blocoResultadoSemDivergencia.tipo === 'positivo' && (
            <View style={styles.resumoContadores}>
              <View style={styles.contadorBox}>
                <Text style={styles.contadorNumero}>{dados.totalDocumentosAnalisados}</Text>
                <Text style={styles.contadorLabel}>Documento(s) analisado(s)</Text>
              </View>
              <View style={styles.contadorBox}>
                <Text style={styles.contadorNumero}>{dados.totalItensAnalisados}</Text>
                <Text style={styles.contadorLabel}>Item(ns) analisado(s)</Text>
              </View>
              <View style={styles.contadorBox}>
                <Text style={styles.contadorNumero}>{dados.pontuacao.pontuacao}</Text>
                <Text style={styles.contadorLabel}>Pontuação de IBS/CBS</Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        dados.divergencias.map(d => {
          const documentoPlural = d.totalDocumentosAfetados === 1 ? 'documento afetado' : 'documentos afetados'
          const itemPlural = d.totalItensAfetados === 1 ? 'item afetado' : 'itens afetados'
          return (
            <View key={d.numero} style={styles.divergenciaCard} wrap={false}>
              <View style={styles.divergenciaTopo}>
                <Text style={styles.divergenciaNumero}>Nº {d.numero} — {d.campo}</Text>
                <Badge gravidade={d.gravidade} />
              </View>
              <Text style={styles.linhaCompactaForte}>
                {d.totalDocumentosAfetados} {documentoPlural} · {d.totalItensAfetados} {itemPlural} · esperado: {d.valorEsperado}
              </Text>
              {d.documentosAfetados.map((doc, i) => (
                <Text key={i} style={styles.linhaCompacta}>
                  • {doc.tipoDocumento} nº {doc.numeroDocumento}/{doc.serieDocumento}
                  {doc.itensAfetados.length > 0 ? ` — item(ns) ${doc.itensAfetados.join(', ')}` : ''}
                  {' '}· encontrado: {doc.valorEncontrado}
                </Text>
              ))}
              <Text style={styles.linhaCompacta}>{d.explicacao} {d.impacto}</Text>
              <Text style={styles.linhaCompactaForte}>Orientação: {d.orientacao}</Text>
            </View>
          )
        })
      )}

      {dados.arquivosComFalha.length > 0 && (
        <View style={styles.falhaBox}>
          <Text style={styles.falhaTitulo}>Arquivos que não puderam ser lidos (não avaliados em IBS/CBS)</Text>
          {dados.arquivosComFalha.map((a, i) => (
            <Text key={i} style={styles.falhaLinha}>• {a.arquivo}: {a.mensagem}</Text>
          ))}
        </View>
      )}
    </View>
  )
}

// ---------- Página 3: resumo legal e técnico ----------

function PaginaResumoLegal({ dados }: { dados: DadosRelatorio }) {
  return (
    <View break>
      <Text style={styles.secaoTitulo}>Resumo legal e técnico</Text>
      <Text style={styles.paragrafo}>
        O IBS e a CBS são os novos tributos da Reforma Tributária, em substituição gradual a ICMS, ISS, PIS e Cofins.
        Por isso, os documentos fiscais eletrônicos passaram a exigir novos campos — como o CST e o cClassTrib, que
        identificam a situação e a classificação tributária de cada item, além das bases, alíquotas e valores de IBS e CBS.
      </Text>
      <Text style={styles.paragrafo}>
        A simples presença desses campos no XML não garante, por si só, que o enquadramento tributário esteja correto:
        as regras variam conforme a operação, o documento e o regime da empresa. Esta análise automática não substitui
        uma avaliação tributária completa.
      </Text>

      <Text style={styles.subTitulo}>Principais referências consultadas</Text>
      {dados.legislacao.map(ref => (
        <View key={ref.codigo} style={styles.legislacaoCard} wrap={false}>
          <Text style={styles.legislacaoTitulo}>{ref.numero}</Text>
          <Text style={styles.legislacaoMeta}>{ref.orgaoEmissor}{ref.dataPublicacao ? ` · ${dataBr(new Date(ref.dataPublicacao))}` : ''}</Text>
          <Text style={styles.legislacaoResumo}>{ref.resumoCurto}</Text>
        </View>
      ))}

      <Text style={styles.avisoTexto}>
        Base legal e técnica consultada em {dataHoraBr(dados.dataEmissao)} · Versão da base técnica: {dados.baseLegalVersao}.
      </Text>
    </View>
  )
}

// ---------- Página 4: conclusão, orientação e contato ----------

function PaginaConclusao({ dados, qrCodeDataUri }: { dados: DadosRelatorio; qrCodeDataUri: string | null }) {
  const inst = dados.institucional
  return (
    <View break>
      <Text style={styles.secaoTitulo}>Conclusão</Text>
      {dados.conclusaoParagrafos.map((p, i) => <Text key={i} style={styles.paragrafo}>{p}</Text>)}

      {dados.orientacoesPrioritarias.length > 0 && (
        <View wrap={false}>
          <Text style={styles.subTitulo}>Orientação prática</Text>
          {dados.orientacoesPrioritarias.map(o => (
            <View key={o.ordem} style={styles.orientacaoItem}>
              <Text style={styles.orientacaoNumero}>{o.ordem}</Text>
              <Text style={styles.orientacaoTexto}>{o.descricao} (responsável sugerido: {o.responsavelSugerido.toLowerCase()})</Text>
            </View>
          ))}
        </View>
      )}

      <View wrap={false}>
        <Text style={styles.subTitulo}>Limitações</Text>
        <Text style={styles.paragrafo}>
          • A análise considera exclusivamente os arquivos XML enviados nesta ferramenta.{'\n'}
          • São verificados campos e consistências relacionados ao IBS e à CBS.{'\n'}
          • O resultado não substitui uma análise tributária completa.{'\n'}
          • A aplicabilidade dos campos pode variar conforme a operação e o enquadramento da empresa.
        </Text>
      </View>

      <View wrap={false}>
        <View style={styles.avisoBox}>
          <Text style={styles.avisoTexto}>
            Este relatório possui caráter informativo, elaborado a partir dos arquivos XML enviados e das regras
            automatizadas de IBS/CBS disponíveis na data da análise. Não constitui certificação fiscal, parecer
            jurídico, auditoria independente ou garantia de conformidade tributária.
          </Text>
        </View>
        <View style={styles.avisoBox}>
          <Text style={styles.avisoTexto}>
            A ausência de apontamentos não garante que todos os tratamentos tributários de IBS e CBS estejam corretos.
            Recomenda-se validação pelo responsável contábil ou tributário da empresa.
          </Text>
        </View>
      </View>

      <View style={styles.contatoBox} wrap={false}>
        <View style={{ flex: 1 }}>
          <Text style={styles.contatoTitulo}>Precisa de apoio para validar ou corrigir os apontamentos?</Text>
          <Text style={styles.contatoTexto}>
            A equipe da {inst.nomeFantasia} pode auxiliar na interpretação do diagnóstico e na revisão das regras
            tributárias de IBS e CBS junto ao fornecedor do sistema emissor.
          </Text>
          <Text style={styles.contatoLinha}>{inst.nomeFantasia}</Text>
          <Text style={styles.contatoLinha}>Telefone e WhatsApp: {inst.telefoneFormatado}</Text>
          <Text style={styles.contatoLinha}>Site: {inst.siteExibicao}</Text>
        </View>
        {qrCodeDataUri && <Image src={qrCodeDataUri} style={styles.qrCode} />}
      </View>
    </View>
  )
}

interface Props {
  dados: DadosRelatorio
  qrCodeDataUri: string | null
  logoDataUri: string | null
}

export default function RelatorioDiagnosticoPdf({ dados, qrCodeDataUri, logoDataUri }: Props) {
  return (
    <Document title={`Relatório de Diagnóstico de IBS e CBS — ${dados.empresa.nome}`} author={dados.institucional.nomeFantasia} language="pt-BR">
      <Page size="A4" style={styles.page}>
        <Cabecalho dados={dados} logoDataUri={logoDataUri} />
        <Rodape dados={dados} />

        <PaginaIdentificacao dados={dados} />
        <PaginaDivergencias dados={dados} />
        <PaginaResumoLegal dados={dados} />
        <PaginaConclusao dados={dados} qrCodeDataUri={qrCodeDataUri} />
      </Page>
    </Document>
  )
}
