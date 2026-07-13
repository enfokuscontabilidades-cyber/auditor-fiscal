'use client'

import { useEffect, useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import CabecalhoPublico from '@/app/diagnostico-reforma-tributaria/_components/CabecalhoPublico'
import RodapePublico from '@/app/diagnostico-reforma-tributaria/_components/RodapePublico'
import { cor, container, cardBase, botaoPrimario, botaoSecundario } from '@/app/diagnostico-reforma-tributaria/_components/tokens'
import { formatarPrecoCentavos, formatarLimite, type PlanoReformaTributaria } from '@/lib/planos/reformaTributariaPlanos'

export default function PlanosReformaTributariaPage() {
  const [planos, setPlanos] = useState<PlanoReformaTributaria[]>([])

  useEffect(() => {
    fetch('/api/planos').then(r => r.json()).then(setPlanos).catch(() => setPlanos([]))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: cor.fundoDegrade, color: cor.texto, fontFamily: 'var(--font-geist-sans)' }}>
      <CabecalhoPublico />

      <main style={{ ...container, padding: '64px 0 40px' }}>
        <div style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto 48px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999,
            background: cor.acentoSuave, border: `1px solid ${cor.acentoBorda}`, fontSize: 12.5, fontWeight: 700,
            color: cor.acento, marginBottom: 18,
          }}>
            <ShieldCheck size={14} /> Acesso exclusivo à Reforma Tributária
          </div>
          <h1 style={{ fontSize: 34, lineHeight: 1.15, letterSpacing: '-0.03em', margin: '0 0 14px' }}>
            Análise de IBS e CBS para os seus clientes, com histórico e relatório em PDF
          </h1>
          <p style={{ color: cor.textoSuave, fontSize: 15.5, lineHeight: 1.6, margin: 0 }}>
            Cadastre empresas, importe XMLs e acompanhe a adequação à reforma tributária direto na plataforma Enfokus.
            Cobrança mensal recorrente, cancele quando quiser.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22 }}>
          {planos.map(plano => (
            <div
              key={plano.codigo}
              style={{
                ...cardBase,
                padding: 28,
                position: 'relative',
                border: plano.destaque ? `1px solid ${cor.acento}` : cardBase.border,
                transform: plano.destaque ? 'translateY(-6px)' : undefined,
              }}
            >
              {plano.destaque && (
                <div style={{
                  position: 'absolute', top: -13, left: 24, background: cor.acento, color: '#04181a',
                  fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 999,
                }}>
                  Recomendado
                </div>
              )}
              <div style={{ fontSize: 15, fontWeight: 700, color: cor.textoSuave, marginBottom: 6 }}>{plano.nome}</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 2 }}>
                {formatarPrecoCentavos(plano.precoCentavos)}
              </div>
              <div style={{ fontSize: 13, color: cor.textoFraco, marginBottom: 22 }}>por mês</div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 26px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[
                  formatarLimite(plano.limiteCnpj, 'CNPJ'),
                  plano.limiteXmlPorCiclo === null
                    ? 'XMLs sem limite mensal comercial'
                    : `Até ${plano.limiteXmlPorCiclo} XMLs por mês`,
                  'Análise de IBS e CBS',
                  'Histórico de análises',
                  'Relatório em PDF',
                ].map(item => (
                  <li key={item} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: cor.texto }}>
                    <Check size={16} color={cor.acento} style={{ flexShrink: 0, marginTop: 1 }} />
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href={`/cadastro?produto=reforma_tributaria&plano=${plano.codigo}`}
                style={{ ...(plano.destaque ? botaoPrimario : botaoSecundario), width: '100%', textDecoration: 'none' }}
              >
                {plano.codigo === 'rt_essencial' && 'Começar com 1 CNPJ'}
                {plano.codigo === 'rt_profissional' && 'Analisar até 5 empresas'}
                {plano.codigo === 'rt_ilimitado' && 'Acesso ilimitado'}
              </a>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, fontSize: 12, lineHeight: 1.7, color: cor.textoFraco, maxWidth: 820, margin: '40px auto 0' }}>
          <p style={{ margin: '0 0 8px' }}>
            Cobrança mensal recorrente via cartão de crédito. O cancelamento pode ser feito a qualquer momento na área
            de Assinatura; o acesso permanece disponível até o fim do período já pago.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            Após vinculado, o CNPJ ocupa permanentemente uma vaga do plano contratado e não pode ser substituído por
            outro — arquivar ou excluir a empresa não libera a vaga. Para cadastrar um CNPJ diferente, é necessário
            fazer upgrade de plano.
          </p>
          <p style={{ margin: 0 }}>
            Planos &ldquo;ilimitados&rdquo; não possuem franquia comercial de CNPJs ou XMLs, mas continuam sujeitos a limites
            técnicos de tamanho de arquivo, lote e uso adequado da plataforma.
          </p>
        </div>
      </main>

      <RodapePublico />
    </div>
  )
}
