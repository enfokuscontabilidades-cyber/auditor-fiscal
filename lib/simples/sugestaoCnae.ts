import type { EnquadramentoCnae } from '@/lib/tributario/cnae'

export interface SelecaoServicoSimples {
  modo_tributacao: 'anexo_fixo' | 'fator_r'
  anexo_fixo: 'III' | 'IV' | 'V'
}

export interface AvaliacaoSugestaoCnae {
  rotulo: string
  divergente: boolean
  exigeAnalise: boolean
}

/** Compara a sugestão jurídica com a seleção manual sem modificar a seleção. */
export function avaliarSugestaoCnae(
  selecao: SelecaoServicoSimples,
  enquadramento?: EnquadramentoCnae,
): AvaliacaoSugestaoCnae {
  if (!enquadramento) return { rotulo: '', divergente: false, exigeAnalise: false }

  if (enquadramento.tratamento === 'fator_r') {
    return {
      rotulo: 'Fator R (III/V)',
      divergente: selecao.modo_tributacao !== 'fator_r',
      exigeAnalise: !enquadramento.conclusivo,
    }
  }

  const anexo = enquadramento.anexo_indicativo
  if (anexo) {
    const anexoConfiguravel = anexo === 'III' || anexo === 'IV'
    return {
      rotulo: `Anexo ${anexo}`,
      divergente: !anexoConfiguravel || selecao.modo_tributacao !== 'anexo_fixo' || selecao.anexo_fixo !== anexo,
      exigeAnalise: !enquadramento.conclusivo || enquadramento.excecoes.length > 0,
    }
  }

  return { rotulo: 'Análise necessária', divergente: false, exigeAnalise: true }
}
