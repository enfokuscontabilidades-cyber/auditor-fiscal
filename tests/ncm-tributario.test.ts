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
})
