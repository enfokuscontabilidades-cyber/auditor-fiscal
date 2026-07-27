import type { TributarioServicoCnaeVinculo } from '../lib/types'
import { extrairSubitemLc116, selecionarVinculoServicoCnae } from '../lib/simples/vinculoServicoCnae'

function vinculo(parcial: Partial<TributarioServicoCnaeVinculo>): TributarioServicoCnaeVinculo {
  return {
    id: '1', codigo_regra: 'TESTE', versao: 1, tipo_codigo: 'subitem_lc116',
    codigo_padrao: '1102', municipio_codigo: null, cnaes: ['8011101'],
    palavras_incluir: [], palavras_excluir: [], prioridade: 10, confianca: 'media',
    conclusivo: false, explicacao: '', fontes: [], vigencia_inicio: '2026-01-01',
    vigencia_fim: null, ativo: true, created_at: '', updated_at: '', ...parcial,
  }
}

describe('vínculo entre serviço da NFS-e e CNAE', () => {
  test('extrai o subitem da LC 116 de código nacional desdobrado ou formatado', () => {
    expect(extrairSubitemLc116('171201')).toBe('1712')
    expect(extrairSubitemLc116('17.12')).toBe('1712')
  })

  test('regra com palavra específica prevalece sobre o vínculo genérico', () => {
    const regras = [
      vinculo({ codigo_regra: 'GERAL', cnaes: ['8011101'], prioridade: 10 }),
      vinculo({ codigo_regra: 'ELETRONICO', cnaes: ['8020001'], palavras_incluir: ['monitoramento eletrônico'], prioridade: 100, conclusivo: true, confianca: 'alta' }),
    ]
    const encontrado = selecionarVinculoServicoCnae({
      codigo: '11.02', origem: 'lista_nacional', descricao: 'Monitoramento eletrônico de alarmes',
    }, regras)
    expect(encontrado?.codigo_regra).toBe('ELETRONICO')
    expect(encontrado?.cnaes).toEqual(['8020001'])
  })

  test('código municipal exige o mesmo município', () => {
    const regraMunicipal = vinculo({
      tipo_codigo: 'codigo_municipal', codigo_padrao: '123', municipio_codigo: '5208707',
    })
    expect(selecionarVinculoServicoCnae({
      codigo: '123', origem: 'municipal', municipioCodigo: '3550308',
    }, [regraMunicipal])).toBeNull()
  })
})
