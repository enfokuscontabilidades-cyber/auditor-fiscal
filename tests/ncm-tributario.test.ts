import { describe, expect, it } from 'vitest'
import type { TributarioNcmRegra } from '@/lib/types'
import { analisarNcmComCatalogo, formatarNcm, normalizarNcm } from '@/lib/tributario/ncm'

const regraPneus: TributarioNcmRegra = {
  id: 'regra-pneus',
  codigo_regra: 'PISCOFINS_MONOFASICO_PNEUS_CAMARAS',
  versao: 1,
  tributos: ['pis', 'cofins'],
  tipo_correspondencia: 'prefixo',
  padroes: ['4011', '4013'],
  padroes_excluir: [],
  prioridade: 100,
  categoria: 'Pneus',
  titulo: 'Pneus novos',
  explicacao: 'Regime concentrado.',
  descricao_obrigatoria: true,
  palavras_incluir: [],
  palavras_excluir: [],
  resultados: [
    {
      perfis: ['fabricante'],
      operacoes: ['venda_producao'],
      tratamento: 'tributacao_concentrada',
      titulo: 'Fabricante',
      explicacao: 'Etapa concentrada.',
      orientacao_simples: 'Segregar no PGDAS-D.',
      aliquota_pis: 2,
      aliquota_cofins: 9.5,
      cst_saida: '02',
      codigo_natureza_receita: '304',
      tabela_efd: '4.3.10',
    },
    {
      perfis: ['atacadista', 'varejista'],
      operacoes: ['revenda', 'venda_consumidor'],
      tratamento: 'aliquota_zero',
      titulo: 'Revenda',
      explicacao: 'Etapa posterior.',
      orientacao_simples: 'Segregar no PGDAS-D.',
      cst_saida: '04',
      codigo_natureza_receita: '003',
      tabela_efd: '4.3.10',
    },
  ],
  condicoes: ['Confirmar produto novo.'],
  alertas: ['Não vale para produto usado.'],
  fontes: [],
  vigencia_inicio: '2007-07-01',
  vigencia_fim: '2026-12-31',
  ativo: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

const regraIcmsGoPneus: TributarioNcmRegra = {
  ...regraPneus,
  id: 'regra-icms-go-pneus',
  codigo_regra: 'ICMS_ST_GO_PNEUMATICOS_NOVOS',
  tributos: ['icms'],
  padroes: ['4011', '401290', '4013'],
  padroes_excluir: ['40115000', '40132000'],
  prioridade: 220,
  palavras_incluir: ['pneu', 'pneumatico', 'protetor', 'camara de ar'],
  palavras_excluir: ['usado', 'recauchutado', 'reformado', 'bicicleta'],
  cests: ['1600100', '1600200', '1600300', '1600400', '1600700', '1600800'],
  correspondencias_cest: [
    { cests: ['1600100'], tipo_correspondencia: 'exato', padroes: ['40111000'], palavras_incluir: ['automovel', 'carro'] },
    { cests: ['1600200'], tipo_correspondencia: 'prefixo', padroes: ['4011'], padroes_excluir: ['40111000', '40114000', '40115000'], palavras_incluir: ['caminhao', 'onibus', 'aviao', 'aeronave', 'agricola', 'terraplenagem', 'empilhadeira', 'maquina'] },
    { cests: ['1600300'], tipo_correspondencia: 'exato', padroes: ['40114000'], palavras_incluir: ['motocicleta', 'moto'] },
    { cests: ['1600400'], tipo_correspondencia: 'prefixo', padroes: ['4011'], padroes_excluir: ['40111000', '40114000', '40115000'], palavras_incluir: ['pneu', 'pneumatico'], palavras_excluir: ['caminhao', 'onibus', 'aviao', 'aeronave', 'agricola', 'terraplenagem', 'empilhadeira', 'motocicleta', 'moto', 'bicicleta'] },
    { cests: ['1600700'], tipo_correspondencia: 'prefixo', padroes: ['401290'], palavras_incluir: ['protetor'] },
    { cests: ['1600800'], tipo_correspondencia: 'prefixo', padroes: ['4013'], padroes_excluir: ['40132000'], palavras_incluir: ['camara de ar'] },
  ],
  ufs_destino: ['GO'],
  exige_cest: true,
  descricao_legal: 'Pneus, protetores e camaras de ar novos, exceto bicicletas.',
  resultados: [
    {
      perfis: ['qualquer'],
      operacoes: ['qualquer'],
      posicoes_icms: ['substituto'],
      tratamento: 'substituicao_tributaria',
      titulo: 'Substituto',
      explicacao: 'Retem o ICMS-ST.',
      orientacao_simples: 'Receita propria sem ST no PGDAS-D; ICMS-ST fora do DAS.',
    },
    {
      perfis: ['qualquer'],
      operacoes: ['qualquer'],
      posicoes_icms: ['substituido'],
      tratamento: 'substituicao_tributaria',
      titulo: 'Substituido',
      explicacao: 'Recebe com ICMS retido.',
      orientacao_simples: 'Segregar com ST no PGDAS-D.',
    },
    {
      perfis: ['qualquer'],
      operacoes: ['qualquer'],
      posicoes_icms: ['nao_informada'],
      tratamento: 'inconclusivo',
      titulo: 'Posicao pendente',
      explicacao: 'Identificar a posicao.',
      orientacao_simples: 'Nao segregar antes de confirmar.',
    },
  ],
  vigencia_fim: null,
}

const regraFarmaceuticos: TributarioNcmRegra = {
  ...regraPneus,
  id: 'regra-farmaceuticos',
  codigo_regra: 'PISCOFINS_MONOFASICO_FARMACEUTICOS',
  padroes: ['3001', '3003', '3004', '30029020', '30051010'],
  padroes_excluir: ['30039056', '30049046'],
  categoria: 'Produtos farmacêuticos',
  resultados: [
    {
      perfis: ['fabricante', 'importador'],
      operacoes: ['venda_producao', 'importacao'],
      tratamento: 'tributacao_concentrada',
      titulo: 'Etapa concentrada',
      explicacao: 'Industrial ou importador.',
      orientacao_simples: 'Segregar no PGDAS-D.',
      aliquota_pis: 2.1,
      aliquota_cofins: 9.9,
      cst_saida: '02',
      codigo_natureza_receita: '201',
      tabela_efd: '4.3.10',
    },
    {
      perfis: ['atacadista', 'varejista'],
      operacoes: ['revenda', 'venda_consumidor'],
      tratamento: 'aliquota_zero',
      titulo: 'Etapa posterior',
      explicacao: 'Revenda por comerciante.',
      orientacao_simples: 'Segregar no PGDAS-D.',
      cst_saida: '04',
      codigo_natureza_receita: '002',
      tabela_efd: '4.3.10',
    },
  ],
}

const regraAutopecas: TributarioNcmRegra = {
  ...regraPneus,
  id: 'regra-autopecas',
  codigo_regra: 'PISCOFINS_MONOFASICO_AUTOPECAS_ANEXO_I',
  padroes: ['8708'],
  padroes_excluir: [],
  categoria: 'Autopeças',
  resultados: [
    {
      perfis: ['fabricante', 'importador'],
      operacoes: ['venda_producao'],
      contextos_operacao: ['fabricante_veiculos'],
      tratamento: 'tributacao_concentrada',
      titulo: 'Venda para fabricante de veículos',
      explicacao: 'Destinada à fabricação.',
      orientacao_simples: 'Segregar no PGDAS-D.',
      aliquota_pis: 1.65,
      aliquota_cofins: 7.6,
      cst_saida: '02',
      codigo_natureza_receita: '303',
      tabela_efd: '4.3.10',
    },
    {
      perfis: ['fabricante', 'importador'],
      operacoes: ['venda_producao'],
      contextos_operacao: ['atacadista_varejista', 'consumidor'],
      tratamento: 'tributacao_concentrada',
      titulo: 'Venda para comércio ou consumidor',
      explicacao: 'Destinada ao comércio ou consumidor.',
      orientacao_simples: 'Segregar no PGDAS-D.',
      aliquota_pis: 2.3,
      aliquota_cofins: 10.8,
      cst_saida: '02',
      codigo_natureza_receita: '302',
      tabela_efd: '4.3.10',
    },
    {
      perfis: ['fabricante', 'importador'],
      operacoes: ['venda_producao'],
      contextos_operacao: ['nao_informado', 'outro'],
      tratamento: 'inconclusivo',
      titulo: 'Destinatário pendente',
      explicacao: 'Identificar o destinatário.',
      orientacao_simples: 'Não concluir.',
    },
    {
      perfis: ['atacadista', 'varejista'],
      operacoes: ['revenda', 'venda_consumidor'],
      tratamento: 'aliquota_zero',
      titulo: 'Revenda',
      explicacao: 'Etapa posterior.',
      orientacao_simples: 'Segregar no PGDAS-D.',
      cst_saida: '04',
      codigo_natureza_receita: '003',
      tabela_efd: '4.3.10',
    },
  ],
}

const regraCombustiveisPetroleo: TributarioNcmRegra = {
  ...regraPneus,
  id: 'regra-combustiveis-petroleo',
  codigo_regra: 'PISCOFINS_MONOFASICO_COMBUSTIVEIS_PETROLEO',
  tipo_correspondencia: 'exato',
  padroes: ['27101259', '27101921', '27111910'],
  padroes_excluir: [],
  categoria: 'Combustíveis derivados de petróleo',
  palavras_incluir: ['gasolina', 'diesel', 'gasoleo', 'glp', 'gas liquefeito de petroleo'],
  palavras_excluir: ['aviacao'],
  resultados: [
    {
      perfis: ['fabricante'],
      operacoes: ['venda_producao'],
      tratamento: 'inconclusivo',
      titulo: 'Produtor ou refinaria: confirmar regime e vigência',
      explicacao: 'A etapa concentrada pode depender de regime especial e coeficiente.',
      orientacao_simples: 'Confirmar a legislação vigente.',
    },
    {
      perfis: ['importador'],
      operacoes: ['importacao', 'venda_producao'],
      tratamento: 'inconclusivo',
      titulo: 'Importador: incidência própria',
      explicacao: 'A importação não é revenda posterior.',
      orientacao_simples: 'Não aplicar alíquota zero.',
    },
    {
      perfis: ['distribuidor', 'varejista'],
      operacoes: ['revenda', 'venda_consumidor'],
      tratamento: 'aliquota_zero',
      titulo: 'Revenda de combustível',
      explicacao: 'Etapa posterior do regime monofásico.',
      orientacao_simples: 'Segregar no PGDAS-D.',
      cst_saida: '04',
      codigo_natureza_receita: '001',
      tabela_efd: '4.3.10',
    },
  ],
}

const regraEtanol: TributarioNcmRegra = {
  ...regraPneus,
  id: 'regra-etanol',
  codigo_regra: 'PISCOFINS_MONOFASICO_ETANOL_COMBUSTIVEL',
  tipo_correspondencia: 'exato',
  padroes: ['22071010', '22071090', '22072011', '22072019'],
  padroes_excluir: [],
  categoria: 'Etanol combustível',
  palavras_incluir: ['etanol combustivel', 'alcool combustivel', 'alcool carburante'],
  palavras_excluir: ['bebida', 'perfumaria', 'limpeza'],
  resultados: [
    {
      perfis: ['fabricante', 'importador'],
      operacoes: ['venda_producao', 'importacao'],
      tratamento: 'inconclusivo',
      titulo: 'Etapa concentrada',
      explicacao: 'Confirmar regime especial.',
      orientacao_simples: 'Não concluir sem o regime.',
    },
    {
      perfis: ['distribuidor', 'varejista'],
      operacoes: ['revenda', 'venda_consumidor'],
      tratamento: 'aliquota_zero',
      titulo: 'Etapa posterior',
      explicacao: 'Alíquota zero na etapa posterior.',
      orientacao_simples: 'Segregar no PGDAS-D.',
      cst_saida: '04',
      codigo_natureza_receita: '001',
      tabela_efd: '4.3.10',
    },
  ],
}

describe('consulta tributária por NCM', () => {
  it('normaliza e formata o NCM completo', () => {
    expect(normalizarNcm('4011.10.00')).toBe('40111000')
    expect(formatarNcm('40111000')).toBe('4011.10.00')
  })

  it('distingue fabricante de varejista para o mesmo NCM', () => {
    const fabricante = analisarNcmComCatalogo({
      ncm: '40111000', perfil: 'fabricante', operacao: 'venda_producao',
      descricao: 'Pneu novo', regras: [regraPneus],
    })
    const varejista = analisarNcmComCatalogo({
      ncm: '40111000', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Pneu novo', regras: [regraPneus],
    })

    expect(fabricante.resultados[0]?.tratamento).toBe('tributacao_concentrada')
    expect(fabricante.resultados[0]?.aliquota_cofins).toBe(9.5)
    expect(fabricante.resultados[0]?.cst_saida).toBe('02')
    expect(fabricante.resultados[0]?.codigo_natureza_receita).toBe('304')
    expect(varejista.resultados[0]?.tratamento).toBe('aliquota_zero')
    expect(varejista.resultados[0]?.cst_saida).toBe('04')
  })

  it('identifica a revenda de produto farmacêutico com CST e natureza da receita', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '30049099', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Medicamento para uso humano', regras: [regraFarmaceuticos],
      escopoTributos: ['pis', 'cofins'],
    })

    expect(resultado.resultados[0]).toMatchObject({
      tratamento: 'aliquota_zero',
      cst_saida: '04',
      codigo_natureza_receita: '002',
      tabela_efd: '4.3.10',
    })
  })

  it('respeita as exclusões expressas da lista de produtos farmacêuticos', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '30049046', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Produto farmacêutico excluído da regra', regras: [regraFarmaceuticos],
      escopoTributos: ['pis', 'cofins'],
    })

    expect(resultado.resultados).toHaveLength(0)
    expect(resultado.tributos_sem_regra).toEqual(['pis', 'cofins'])
  })

  it('diferencia as alíquotas de autopeças conforme o destinatário da venda', () => {
    const paraFabricante = analisarNcmComCatalogo({
      ncm: '87082999', perfil: 'fabricante', operacao: 'venda_producao',
      contextoOperacao: 'fabricante_veiculos', descricao: 'Parte nova de carroceria',
      regras: [regraAutopecas], escopoTributos: ['pis', 'cofins'],
    })
    const paraVarejista = analisarNcmComCatalogo({
      ncm: '87082999', perfil: 'fabricante', operacao: 'venda_producao',
      contextoOperacao: 'atacadista_varejista', descricao: 'Parte nova de carroceria',
      regras: [regraAutopecas], escopoTributos: ['pis', 'cofins'],
    })

    expect(paraFabricante.resultados[0]).toMatchObject({
      aliquota_pis: 1.65, aliquota_cofins: 7.6, codigo_natureza_receita: '303',
    })
    expect(paraVarejista.resultados[0]).toMatchObject({
      aliquota_pis: 2.3, aliquota_cofins: 10.8, codigo_natureza_receita: '302',
    })
  })

  it('mantém autopeça inconclusiva quando o destinatário não foi informado', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '87082999', perfil: 'fabricante', operacao: 'venda_producao',
      descricao: 'Parte nova de carroceria', regras: [regraAutopecas],
      escopoTributos: ['pis', 'cofins'],
    })

    expect(resultado.resultados[0]?.tratamento).toBe('inconclusivo')
    expect(resultado.resultados[0]?.titulo).toBe('Destinatário pendente')
  })

  it('exige descrição comercial nas regras federais marcadas como obrigatórias', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '87082999', perfil: 'varejista', operacao: 'revenda',
      regras: [regraAutopecas], escopoTributos: ['pis', 'cofins'],
    })

    expect(resultado.resultados[0]?.tratamento).toBe('inconclusivo')
    expect(resultado.resultados[0]?.explicacao).toContain('descrição comercial')
  })

  it('identifica a alíquota zero na revenda de gasolina por distribuidor', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '27101259', perfil: 'distribuidor', operacao: 'revenda',
      descricao: 'Gasolina automotiva comum', regras: [regraCombustiveisPetroleo],
      escopoTributos: ['pis', 'cofins'],
    })

    expect(resultado.resultados[0]).toMatchObject({
      tratamento: 'aliquota_zero', cst_saida: '04',
      codigo_natureza_receita: '001', tabela_efd: '4.3.10',
    })
  })

  it('não aplica a alíquota zero da revenda ao produtor ou ao importador de combustível', () => {
    const refinaria = analisarNcmComCatalogo({
      ncm: '27101921', perfil: 'fabricante', operacao: 'venda_producao',
      descricao: 'Óleo diesel', regras: [regraCombustiveisPetroleo],
      escopoTributos: ['pis', 'cofins'],
    })
    const importador = analisarNcmComCatalogo({
      ncm: '27101921', perfil: 'importador', operacao: 'importacao',
      descricao: 'Óleo diesel importado', regras: [regraCombustiveisPetroleo],
      escopoTributos: ['pis', 'cofins'],
    })

    expect(refinaria.resultados[0]?.tratamento).toBe('inconclusivo')
    expect(importador.resultados[0]?.tratamento).toBe('inconclusivo')
  })

  it('distingue distribuidor de comerciante atacadista na venda de etanol', () => {
    const distribuidor = analisarNcmComCatalogo({
      ncm: '22071010', perfil: 'distribuidor', operacao: 'revenda',
      descricao: 'Etanol combustível anidro', regras: [regraEtanol],
      escopoTributos: ['pis', 'cofins'],
    })
    const atacadista = analisarNcmComCatalogo({
      ncm: '22071010', perfil: 'atacadista', operacao: 'revenda',
      descricao: 'Etanol combustível anidro', regras: [regraEtanol],
      escopoTributos: ['pis', 'cofins'],
    })

    expect(distribuidor.resultados[0]?.tratamento).toBe('aliquota_zero')
    expect(atacadista.resultados).toHaveLength(0)
  })

  it('não classifica álcool de outra finalidade como etanol combustível', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '22071010', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Álcool para limpeza', regras: [regraEtanol],
      escopoTributos: ['pis', 'cofins'],
    })

    expect(resultado.resultados).toHaveLength(0)
  })

  it('não transforma ICMS-ST em conclusão baseada apenas no NCM', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '40111000', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Pneu novo', regras: [regraPneus],
    })

    expect(resultado.tributos_sem_regra).toContain('icms')
    expect(resultado.avisos.some(aviso => aviso.includes('ICMS-ST'))).toBe(true)
  })

  it('não aplica resultado de produção própria a fabricante que informou revenda', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '40111000', perfil: 'fabricante', operacao: 'revenda',
      descricao: 'Pneu novo adquirido de terceiro', regras: [regraPneus],
    })

    expect(resultado.resultados).toHaveLength(0)
  })

  it('conclui ICMS-ST em Goias somente com NCM, descricao, CEST e posicao compativeis', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '40111000', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Pneu novo para automovel', cest: '16.001.00',
      ufOrigem: 'GO', ufDestino: 'GO', posicaoIcms: 'substituido',
      regras: [regraIcmsGoPneus],
    })

    expect(resultado.resultados[0]?.tratamento).toBe('substituicao_tributaria')
    expect(resultado.resultados[0]?.titulo).toBe('Substituido')
    expect(resultado.tributos_sem_regra).not.toContain('icms')
  })

  it('mantem a analise de ICMS-ST inconclusiva quando falta CEST', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '40111000', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Pneu novo para automovel', ufDestino: 'GO', posicaoIcms: 'substituido',
      regras: [regraIcmsGoPneus],
    })

    expect(resultado.resultados[0]?.tratamento).toBe('inconclusivo')
    expect(resultado.resultados[0]?.explicacao).toContain('CEST')
  })

  it('nao usa a regra de Goias para outro CEST ou outra UF de destino', () => {
    const cestDiferente = analisarNcmComCatalogo({
      ncm: '40111000', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Pneu novo', cest: '16.005.00', ufDestino: 'GO', posicaoIcms: 'substituido',
      regras: [regraIcmsGoPneus],
    })
    const outraUf = analisarNcmComCatalogo({
      ncm: '40111000', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Pneu novo', cest: '16.001.00', ufDestino: 'SP', posicaoIcms: 'substituido',
      regras: [regraIcmsGoPneus],
    })

    expect(cestDiferente.resultados).toHaveLength(0)
    expect(cestDiferente.avisos.some(aviso => aviso.includes('CEST informado'))).toBe(true)
    expect(outraUf.resultados).toHaveLength(0)
    expect(outraUf.avisos.some(aviso => aviso.includes('UF de destino SP'))).toBe(true)
  })

  it('rejeita CEST do mesmo segmento quando ele nao corresponde ao NCM', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '40111000', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Pneu novo para automovel', cest: '16.008.00',
      ufDestino: 'GO', posicaoIcms: 'substituido', regras: [regraIcmsGoPneus],
    })

    expect(resultado.resultados).toHaveLength(0)
    expect(resultado.avisos.some(aviso => aviso.includes('não corresponde a este NCM'))).toBe(true)
  })

  it('rejeita CEST amplo quando a descricao pertence a um item especifico', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '40112090', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Pneu novo para caminhao', cest: '16.004.00',
      ufDestino: 'GO', posicaoIcms: 'substituido', regras: [regraIcmsGoPneus],
    })

    expect(resultado.resultados).toHaveLength(0)
    expect(resultado.avisos.some(aviso => aviso.includes('não corresponde a este NCM'))).toBe(true)
  })

  it('exclui pneus de bicicleta da regra estadual cadastrada', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '40115000', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Pneu novo para bicicleta', cest: '16.005.00',
      ufDestino: 'GO', posicaoIcms: 'substituido', regras: [regraIcmsGoPneus],
    })

    expect(resultado.resultados).toHaveLength(0)
    expect(resultado.tributos_sem_regra).toContain('icms')
  })

  it('diferencia o efeito no PGDAS-D do substituto e do substituido', () => {
    const base = {
      ncm: '40111000', descricao: 'Pneu novo para automovel', cest: '16.001.00',
      ufDestino: 'GO', regras: [regraIcmsGoPneus],
    }
    const substituto = analisarNcmComCatalogo({
      ...base, perfil: 'fabricante', operacao: 'venda_producao', posicaoIcms: 'substituto',
    })
    const substituido = analisarNcmComCatalogo({
      ...base, perfil: 'varejista', operacao: 'revenda', posicaoIcms: 'substituido',
    })

    expect(substituto.resultados[0]?.orientacao_simples).toContain('sem ST')
    expect(substituido.resultados[0]?.orientacao_simples).toContain('com ST')
  })

  it('isola a consulta federal das regras e avisos de ICMS', () => {
    const resultado = analisarNcmComCatalogo({
      ncm: '40111000', perfil: 'varejista', operacao: 'revenda',
      descricao: 'Pneu novo para automovel', regras: [regraPneus, regraIcmsGoPneus],
      escopoTributos: ['pis', 'cofins', 'ipi'],
      tipiOficial: {
        codigo: '40111000', descricao: 'Pneus novos', aliquota: 0,
        aliquota_texto: '0%', situacao: 'aliquota_zero', excecoes: [],
      },
    })

    expect(resultado.escopo_tributos).toEqual(['pis', 'cofins', 'ipi'])
    expect(resultado.resultados.flatMap(item => item.tributos)).not.toContain('icms')
    expect(resultado.tributos_sem_regra).not.toContain('ipi')
    expect(resultado.avisos.some(aviso => aviso.includes('ICMS-ST'))).toBe(false)
  })
})
