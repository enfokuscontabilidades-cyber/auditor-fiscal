import { describe, expect, it } from 'vitest'
import { limparDescricaoNcm, montarHierarquiaNcm } from '@/lib/tributario/ncmHierarquia'

const registros = [
  { codigo: '68', descricao: 'Obras de pedra, gesso, cimento, amianto, mica ou de matérias semelhantes.' },
  { codigo: '68.10', descricao: 'Obras de cimento, de concreto (betão) ou de pedra artificial, mesmo armadas.' },
  { codigo: '6810.1', descricao: '- Telhas, ladrilhos, placas (lajes), tijolos e artigos semelhantes:' },
  { codigo: '6810.19', descricao: '-- Outros' },
  { codigo: '6810.19.00', descricao: '--- Outros' },
]

describe('hierarquia oficial da NCM', () => {
  it('monta a trilha anterior ao subitem consultado', () => {
    const resultado = montarHierarquiaNcm(registros, '6810.19.00')

    expect(resultado).toEqual([
      {
        nivel: 'secao',
        codigo: 'XIII',
        descricao: 'Obras de pedra, gesso, cimento, amianto, mica ou de matérias semelhantes; produtos cerâmicos; vidro e suas obras',
      },
      { nivel: 'capitulo', codigo: '68', descricao: 'Obras de pedra, gesso, cimento, amianto, mica ou de matérias semelhantes.' },
      { nivel: 'posicao', codigo: '68.10', descricao: 'Obras de cimento, de concreto (betão) ou de pedra artificial, mesmo armadas.' },
      { nivel: 'subposicao', codigo: '6810.1', descricao: 'Telhas, ladrilhos, placas (lajes), tijolos e artigos semelhantes:' },
      { nivel: 'subposicao', codigo: '6810.19', descricao: 'Outros' },
    ])
  })

  it('remove somente os marcadores estruturais da descrição oficial', () => {
    expect(limparDescricaoNcm('-- Outros')).toBe('Outros')
    expect(limparDescricaoNcm('<b>- Produto</b>  com\u00a0espaço')).toBe('Produto com espaço')
  })

  it('não inventa níveis intermediários ausentes na tabela oficial', () => {
    const resultado = montarHierarquiaNcm([
      { codigo: '68', descricao: 'Obras de pedra.' },
      { codigo: '6801.00.00', descricao: 'Pedras para calcetar.' },
    ], '6801.00.00')

    expect(resultado.map(item => item.nivel)).toEqual(['secao', 'capitulo'])
  })
})
