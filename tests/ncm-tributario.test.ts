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
    },
    {
      perfis: ['atacadista', 'varejista'],
      operacoes: ['revenda', 'venda_consumidor'],
      tratamento: 'aliquota_zero',
      titulo: 'Revenda',
      explicacao: 'Etapa posterior.',
      orientacao_simples: 'Segregar no PGDAS-D.',
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
    expect(varejista.resultados[0]?.tratamento).toBe('aliquota_zero')
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
})
