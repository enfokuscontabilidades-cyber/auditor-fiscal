/**
 * Testes planejados para o importador ABRASF de NFS-e.
 *
 * A pasta tests fica fora do tsconfig do Next; estes testes seguem o mesmo
 * padrão de globals usado em tests/importador-xml.test.ts.
 */

import { detectarXmlNfse, parseNfseAbrasf, parseNfseXml, chaveNfse } from '../lib/nfse/parseNfseAbrasf'

const CNPJ_EMPRESA = '12345678000190'

function nfseXml(opts: {
  numero?: string
  cnpj?: string
  codigoVerificacao?: string
  cancelada?: boolean
  issRetido?: '1' | '2'
} = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseResposta xmlns="http://www.abrasf.org.br/nfse.xsd">
  <ListaNfse>
    <CompNfse>
      <Nfse>
        <InfNfse>
          <Numero>${opts.numero ?? '1526'}</Numero>
          <CodigoVerificacao>${opts.codigoVerificacao ?? 'ABC123'}</CodigoVerificacao>
          <DataEmissao>2026-05-10T09:30:00</DataEmissao>
          <Competencia>2026-05-01</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>1500.00</ValorServicos>
              <ValorDeducoes>100.00</ValorDeducoes>
              <ValorIss>45.00</ValorIss>
              <IssRetido>${opts.issRetido ?? '2'}</IssRetido>
              <ValorLiquidoNfse>1400.00</ValorLiquidoNfse>
            </Valores>
            <ItemListaServico>10.05</ItemListaServico>
            <CodigoTributacaoMunicipio>1005001</CodigoTributacaoMunicipio>
            <Discriminacao>Servicos de corretagem</Discriminacao>
          </Servico>
          <PrestadorServico>
            <IdentificacaoPrestador><CpfCnpj><Cnpj>${opts.cnpj ?? CNPJ_EMPRESA}</Cnpj></CpfCnpj></IdentificacaoPrestador>
            <RazaoSocial>Empresa Prestadora LTDA</RazaoSocial>
          </PrestadorServico>
          <TomadorServico>
            <IdentificacaoTomador><CpfCnpj><Cnpj>99887766000155</Cnpj></CpfCnpj></IdentificacaoTomador>
            <RazaoSocial>Cliente Tomador SA</RazaoSocial>
          </TomadorServico>
          <OrgaoGerador><CodigoMunicipio>5208707</CodigoMunicipio></OrgaoGerador>
        </InfNfse>
      </Nfse>
      ${opts.cancelada ? '<Cancelamento><Confirmacao /></Cancelamento>' : ''}
    </CompNfse>
  </ListaNfse>
</ConsultarNfseResposta>`
}

describe('parseNfseAbrasf', () => {
  test('extrai NFS-e ABRASF com namespace e gera documento/item de servico', () => {
    const [result] = parseNfseAbrasf(nfseXml(), CNPJ_EMPRESA, 'nfse.xml')
    expect(result.metadados.numero).toBe('1526')
    expect(result.documento.tipo_documento).toBe('nfse')
    expect(result.documento.origem).toBe('xml_nfse')
    expect(result.documento.data_competencia).toBe('05/2026')
    expect(result.documento.valor_servicos).toBe(1500)
    expect(result.itens[0].classificacao).toBe('servico')
    expect(result.itens[0].impacto_receita).toBe('soma_receita')
    expect(result.metadados.iss_retido).toBe(false)
    // Dedução da base municipal do ISS não é desconto incondicional da receita.
    expect(result.documento.valor_desconto).toBe(0)
    expect(result.itens[0].valor_desconto).toBe(0)
  })

  test('identifica ISS retido no padrão ABRASF e preserva o valor informado', () => {
    const [result] = parseNfseAbrasf(nfseXml({ issRetido: '1' }), CNPJ_EMPRESA)
    expect(result.metadados.iss_retido).toBe(true)
    expect(result.metadados.valor_iss_retido).toBe(45)
  })

  test('preserva a retencao declarada mesmo quando o optante do Simples informa ISS zerado', () => {
    const xml = nfseXml({ issRetido: '1' }).replace('<ValorIss>45.00</ValorIss>', '<ValorIss>0.00</ValorIss>')
    const [result] = parseNfseAbrasf(xml, CNPJ_EMPRESA)

    expect(result.metadados.iss_retido).toBe(true)
    expect(result.metadados.valor_iss_retido).toBe(0)
  })

  test('suporta lote/lista com mais de uma NFS-e', () => {
    const xml = nfseXml({ numero: '1', codigoVerificacao: 'A' }).replace('</ListaNfse>', `${nfseXml({ numero: '2', codigoVerificacao: 'B' }).match(/<CompNfse>[\s\S]*<\/CompNfse>/)?.[0] ?? ''}</ListaNfse>`)
    expect(parseNfseAbrasf(xml, CNPJ_EMPRESA)).toHaveLength(2)
  })

  test('recupera exportacao municipal com varios XMLs completos concatenados', () => {
    const municipal = (numero: string, codigo: string) => nfseXml({ numero, codigoVerificacao: codigo })
      .replace(/<\?xml[\s\S]*?\?>/, '')
      .replaceAll('ConsultarNfseResposta', 'GerarNfseResposta')
      .replace('http://www.abrasf.org.br/nfse.xsd', 'http://nfse.goiania.go.gov.br/xsd/nfse_gyn_v02.xsd')
    const xml = `${municipal('101', 'GYN101')}\n${municipal('102', 'GYN102')}`

    const resultados = parseNfseXml(xml, CNPJ_EMPRESA, '01-2025 NFS.XML')

    expect(detectarXmlNfse(xml)).toBe(true)
    expect(resultados).toHaveLength(2)
    expect(resultados.map(item => item.metadados.numero)).toEqual(['101', '102'])
    expect(resultados.every(item => item.metadados.layout_xml === 'municipal')).toBe(true)
  })

  test('cancelamento em lote afeta somente a NFS-e correspondente', () => {
    const xml = nfseXml({ numero: '1', codigoVerificacao: 'A' }).replace(
      '</ListaNfse>',
      `${nfseXml({ numero: '2', codigoVerificacao: 'B', cancelada: true }).match(/<CompNfse>[\s\S]*<\/CompNfse>/)?.[0] ?? ''}</ListaNfse>`,
    )

    const resultados = parseNfseAbrasf(xml, CNPJ_EMPRESA)

    expect(resultados).toHaveLength(2)
    expect(resultados[0].documento.status).toBe('ok')
    expect(resultados[1].documento.status).toBe('cancelada')
  })

  test('marca NFS-e cancelada sem gerar item tributavel', () => {
    const [result] = parseNfseAbrasf(nfseXml({ cancelada: true }), CNPJ_EMPRESA)
    expect(result.documento.status).toBe('cancelada')
    expect(result.itens).toHaveLength(0)
  })

  test('rejeita XML invalido e CNPJ prestador diferente', () => {
    expect(parseNfseAbrasf('<xml_invalido>', CNPJ_EMPRESA)).toHaveLength(0)
    expect(parseNfseAbrasf(nfseXml({ cnpj: '11111111000111' }), CNPJ_EMPRESA)).toHaveLength(0)
  })

  test('deduplicacao usa CNPJ, municipio, numero e codigo de verificacao', () => {
    expect(chaveNfse({
      prestador_cnpj: CNPJ_EMPRESA,
      municipio_codigo: '5208707',
      numero: '1526',
      codigo_verificacao: 'ABC123',
    })).toBe('NFSE:12345678000190:5208707:1526:ABC123')
  })

  test('suporta XML municipal com campos de prestador fora de PrestadorServico', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NotaFiscaldeServicoEletronicaNFSe>
  <NumeroNFSe>883</NumeroNFSe>
  <CodigoVerificacao>XYZ987</CodigoVerificacao>
  <DataEmissaoNFSe>2026-06-12</DataEmissaoNFSe>
  <CNPJPrestador>${CNPJ_EMPRESA}</CNPJPrestador>
  <NomePrestador>Empresa Prestadora LTDA</NomePrestador>
  <CNPJTomador>99887766000155</CNPJTomador>
  <NomeTomador>Cliente Tomador SA</NomeTomador>
  <CodigoMunicipio>5208707</CodigoMunicipio>
  <ValorServicos>900,50</ValorServicos>
  <ValorISS>27,02</ValorISS>
  <Discriminacao>Servicos imobiliarios</Discriminacao>
</NotaFiscaldeServicoEletronicaNFSe>`
    const [result] = parseNfseAbrasf(xml, CNPJ_EMPRESA, 'NotaFiscaldeServicoEletronicaNFSe_000883.xml')
    expect(result.metadados.numero).toBe('883')
    expect(result.metadados.prestador_cnpj).toBe(CNPJ_EMPRESA)
    expect(result.documento.data_competencia).toBe('06/2026')
    expect(result.documento.valor_servicos).toBe(900.5)
  })

  test('detecta provedor municipal por campos fiscais mesmo com raiz desconhecida', () => {
    const xml = `<DocumentoServico>
      <NumeroNotaFiscal>44</NumeroNotaFiscal>
      <DataEmissao>2024-02-10</DataEmissao>
      <CNPJPrestador>${CNPJ_EMPRESA}</CNPJPrestador>
      <ValorServicos>250.00</ValorServicos>
      <DescricaoServico>Consultoria</DescricaoServico>
    </DocumentoServico>`

    expect(detectarXmlNfse(xml)).toBe(true)
    expect(parseNfseXml(xml, CNPJ_EMPRESA)[0].metadados.layout_xml).toBe('municipal')
  })

  test('suporta ABRASF antigo com cadastro e identificacao do prestador em blocos separados', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseServicoPrestadoResposta xmlns="http://www.abrasf.org.br/nfse.xsd">
  <ListaNfse>
    <CompNfse>
      <Nfse>
        <InfNfse>
          <Numero>27</Numero>
          <CodigoVerificacao>OLD123</CodigoVerificacao>
          <DataEmissao>2025-01-20T08:30:00</DataEmissao>
          <ValoresNfse>
            <BaseCalculo>980.00</BaseCalculo>
            <ValorLiquidoNfse>950.00</ValorLiquidoNfse>
          </ValoresNfse>
          <PrestadorServico>
            <RazaoSocial>Empresa Prestadora LTDA</RazaoSocial>
          </PrestadorServico>
          <OrgaoGerador><CodigoMunicipio>5208707</CodigoMunicipio></OrgaoGerador>
          <DeclaracaoPrestacaoServico>
            <InfDeclaracaoPrestacaoServico>
              <Competencia>2025-01-01</Competencia>
              <Servico>
                <Valores>
                  <ValorServicos>1000.00</ValorServicos>
                  <ValorDeducoes>20.00</ValorDeducoes>
                  <ValorIss>30.00</ValorIss>
                  <Aliquota>0.03</Aliquota>
                  <DescontoIncondicionado>10.00</DescontoIncondicionado>
                </Valores>
                <IssRetido>1</IssRetido>
                <ItemListaServico>17.12</ItemListaServico>
                <CodigoTributacaoMunicipio>1712</CodigoTributacaoMunicipio>
                <Discriminacao>Administracao de bens</Discriminacao>
              </Servico>
              <Prestador>
                <CpfCnpj><Cnpj>${CNPJ_EMPRESA}</Cnpj></CpfCnpj>
              </Prestador>
              <TomadorServico>
                <IdentificacaoTomador><CpfCnpj><Cnpj>99887766000155</Cnpj></CpfCnpj></IdentificacaoTomador>
                <RazaoSocial>Cliente Tomador SA</RazaoSocial>
              </TomadorServico>
            </InfDeclaracaoPrestacaoServico>
          </DeclaracaoPrestacaoServico>
        </InfNfse>
      </Nfse>
    </CompNfse>
  </ListaNfse>
</ConsultarNfseServicoPrestadoResposta>`

    const [result] = parseNfseXml(xml, CNPJ_EMPRESA, 'nfse-antiga.xml')
    expect(result.metadados.layout_xml).toBe('abrasf')
    expect(result.metadados.prestador_cnpj).toBe(CNPJ_EMPRESA)
    expect(result.metadados.prestador_nome).toBe('Empresa Prestadora LTDA')
    expect(result.metadados.tomador_cnpj).toBe('99887766000155')
    expect(result.documento.data_competencia).toBe('01/2025')
    expect(result.documento.valor_servicos).toBe(1000)
    expect(result.metadados.valor_liquido).toBe(950)
    expect(result.metadados.base_calculo_iss).toBe(980)
    expect(result.metadados.iss_retido).toBe(true)
  })

  test('suporta NFS-e nacional com infNFSe, emit, toma e DPS', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseServicoPrestadoResposta xmlns="http://www.sped.fazenda.gov.br/nfse">
  <ListaNfse>
    <CompNfse>
      <NFSe versao="1.01">
        <infNFSe Id="NFS52087071212345678000190000000000089826061780406744">
          <xLocEmi>Goiania</xLocEmi>
          <nNFSe>898</nNFSe>
          <cLocIncid>5208707</cLocIncid>
          <xTribMun>17.12 - Administracao em geral.</xTribMun>
          <dhProc>2026-06-02T10:25:50-03:00</dhProc>
          <emit>
            <CNPJ>${CNPJ_EMPRESA}</CNPJ>
            <xNome>Empresa Prestadora LTDA</xNome>
          </emit>
          <valores>
            <vBC>128.88</vBC>
            <vISSQN>4.45</vISSQN>
            <vLiq>128.88</vLiq>
          </valores>
          <IBSCBS>
            <valores>
              <vBC>125.42</vBC>
              <uf><pIBSUF>0.10</pIBSUF></uf>
              <mun><pIBSMun>0.00</pIBSMun></mun>
              <fed><pCBS>0.90</pCBS></fed>
            </valores>
            <totCIBS>
              <gIBS>
                <vIBSTot>0.13</vIBSTot>
                <gIBSUFTot><vIBSUF>0.13</vIBSUF></gIBSUFTot>
                <gIBSMunTot><vIBSMun>0.00</vIBSMun></gIBSMunTot>
              </gIBS>
              <gCBS><vCBS>1.13</vCBS></gCBS>
            </totCIBS>
          </IBSCBS>
          <DPS versao="1.01">
            <infDPS>
              <dhEmi>2026-06-02T10:25:50-03:00</dhEmi>
              <dCompet>2026-06-02</dCompet>
              <prest><CNPJ>${CNPJ_EMPRESA}</CNPJ></prest>
              <toma><CPF>32061323120</CPF><xNome>Cliente Tomador</xNome></toma>
              <serv>
                <tribMun><tpRetISSQN>2</tpRetISSQN></tribMun>
                <cServ>
                  <cTribNac>171201</cTribNac>
                  <cTribMun>1712</cTribMun>
                  <xDescServ>TAXA DE ADMINISTRACAO</xDescServ>
                </cServ>
              </serv>
              <valores>
                <vServPrest><vServ>128.88</vServ></vServPrest>
              </valores>
              <IBSCBS>
                <valores><trib><gIBSCBS>
                  <CST>000</CST><cClassTrib>000001</cClassTrib>
                </gIBSCBS></trib></valores>
              </IBSCBS>
            </infDPS>
          </DPS>
        </infNFSe>
      </NFSe>
    </CompNfse>
  </ListaNfse>
</ConsultarNfseServicoPrestadoResposta>`
    const [result] = parseNfseAbrasf(xml, CNPJ_EMPRESA, '4830083_NotaFiscaldeServicoEletronicaNFSe_000898.xml')
    expect(result.metadados.numero).toBe('898')
    expect(result.metadados.layout_xml).toBe('nacional')
    expect(result.metadados.prestador_cnpj).toBe(CNPJ_EMPRESA)
    expect(result.documento.data_competencia).toBe('06/2026')
    expect(result.documento.valor_servicos).toBe(128.88)
    expect(result.documento.destinatario_cnpj).toBe('32061323120')
    expect(result.documento.destinatario_nome).toBe('Cliente Tomador')
    expect(result.itens[0].descricao).toBe('TAXA DE ADMINISTRACAO')
    expect(result.metadados.iss_retido).toBe(true)
    expect(result.metadados.tipo_retencao_iss).toBe('2')
    expect(result.itens[0]).toMatchObject({
      cst_ibs_cbs: '000',
      cclass_trib: '000001',
      valor_bc_ibs_cbs: 125.42,
      aliquota_ibs_uf: 0.1,
      valor_ibs_uf: 0.13,
      aliquota_cbs: 0.9,
      valor_ibs: 0.13,
      valor_cbs: 1.13,
    })
  })
})
