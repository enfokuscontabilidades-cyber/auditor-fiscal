'use client'

import { CalendarClock, FileCode2, ShieldCheck, ArrowRight, CheckCircle2, Gauge } from 'lucide-react'
import { cor, cardBase, botaoPrimario, raio } from './tokens'

export default function HeroDiagnostico({ onComecar }: { onComecar: () => void }) {
  return (
    <section
      style={{
        paddingTop: 64,
        paddingBottom: 56,
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,0.95fr)',
        gap: 48,
        alignItems: 'center',
      }}
      className="hero-grid"
    >
      <div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '6px 14px',
            borderRadius: 999,
            background: cor.acentoSuave,
            border: `1px solid ${cor.acentoBorda}`,
            color: cor.acento,
            fontSize: 12.5,
            fontWeight: 700,
            marginBottom: 20,
          }}
        >
          <CalendarClock size={14} />
          Novas exigências a partir de 1º de agosto de 2026
        </span>

        <h1
          style={{
            fontSize: 'clamp(30px, 4vw, 46px)',
            lineHeight: 1.12,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: cor.texto,
            margin: '0 0 18px',
          }}
        >
          Seu emissor de notas está preparado para o <span style={{ color: cor.acento }}>IBS</span> e a <span style={{ color: cor.acento }}>CBS</span>?
        </h1>

        <p style={{ fontSize: 16.5, lineHeight: 1.6, color: cor.textoSuave, maxWidth: 520, margin: '0 0 28px' }}>
          Envie um XML e faça uma verificação gratuita antes que erros de preenchimento prejudiquem a emissão das
          notas fiscais da sua empresa.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <button type="button" onClick={onComecar} style={{ ...botaoPrimario, fontSize: 16, padding: '15px 28px' }}>
            Analisar meu XML gratuitamente
            <ArrowRight size={17} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: cor.textoFraco, fontSize: 12.5 }}>
          <ShieldCheck size={15} color={cor.acento} />
          Disponível para empresas de todos os regimes tributários.
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ ...cardBase, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: raio.sm, background: cor.acentoSuave, display: 'grid', placeItems: 'center' }}>
                <FileCode2 size={17} color={cor.acento} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: cor.texto }}>nfe-35260712345.xml</p>
                <p style={{ margin: 0, fontSize: 11.5, color: cor.textoFraco }}>Fluxo de validação</p>
              </div>
            </div>
            <Gauge size={16} color={cor.textoFraco} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {['Estrutura do XML', 'Grupo de IBS localizado', 'Grupo de CBS localizado'].map((linha, i) => (
              <div
                key={linha}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: raio.sm,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${cor.borda}`,
                }}
              >
                <CheckCircle2 size={16} color={cor.acento} style={{ opacity: 0.55 + i * 0.15, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: cor.textoSuave }}>{linha}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '14px 14px', borderRadius: raio.sm, background: 'rgba(39,199,216,0.07)', border: `1px solid ${cor.acentoBorda}` }}>
              <p style={{ margin: '0 0 4px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: cor.acento }}>IBS</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: cor.texto }}>0,10%</p>
            </div>
            <div style={{ padding: '14px 14px', borderRadius: raio.sm, background: 'rgba(39,199,216,0.07)', border: `1px solid ${cor.acentoBorda}` }}>
              <p style={{ margin: '0 0 4px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: cor.acento }}>CBS</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: cor.texto }}>0,90%</p>
            </div>
          </div>
        </div>

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '-30px -30px auto auto',
            width: 160,
            height: 160,
            background: 'radial-gradient(circle, rgba(39,199,216,0.28), transparent 70%)',
            filter: 'blur(6px)',
            zIndex: -1,
          }}
        />
      </div>
    </section>
  )
}
