'use client'

import { rastrearEvento } from '@/lib/analytics/track'
import { cor, cardBase, botaoPrimario, botaoSecundario } from './tokens'
import { PLANOS_REFORMA_TRIBUTARIA, formatarPrecoCentavos } from '@/lib/planos/reformaTributariaPlanos'

const CTA_LABEL: Record<string, string> = {
  rt_essencial: 'Começar com 1 CNPJ',
  rt_profissional: 'Analisar até 5 empresas',
  rt_ilimitado: 'Acesso ilimitado',
}

export default function CtaPlanosPagos({ codigoDiagnostico }: { codigoDiagnostico: string }) {
  return (
    <section style={{ padding: '10px 0 52px' }}>
      <div style={{ ...cardBase, padding: 32 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: cor.texto, textAlign: 'center' }}>
          Precisa analisar mais empresas ou mais documentos?
        </h2>
        <p style={{ margin: '0 auto 24px', fontSize: 14, color: cor.textoSuave, maxWidth: 560, lineHeight: 1.6, textAlign: 'center' }}>
          Acesse a área exclusiva de Reforma Tributária da Enfokus e acompanhe a adequação dos XMLs dos seus clientes,
          com cadastro de empresas, histórico de análises e relatório em PDF.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {PLANOS_REFORMA_TRIBUTARIA.map(plano => (
            <div key={plano.codigo} style={{ border: `1px solid ${plano.destaque ? cor.acento : cor.borda}`, borderRadius: 14, padding: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: cor.textoSuave }}>{plano.nome}</div>
              <div style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 14px' }}>{formatarPrecoCentavos(plano.precoCentavos)}<span style={{ fontSize: 11, fontWeight: 500 }}>/mês</span></div>
              <a
                href={`/cadastro?produto=reforma_tributaria&plano=${plano.codigo}&origem=diagnostico&ref=${encodeURIComponent(codigoDiagnostico)}`}
                onClick={() => rastrearEvento('reforma_clique_plano_pago')}
                style={{ ...(plano.destaque ? botaoPrimario : botaoSecundario), width: '100%', textDecoration: 'none' }}
              >
                {CTA_LABEL[plano.codigo] ?? 'Assinar'}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
