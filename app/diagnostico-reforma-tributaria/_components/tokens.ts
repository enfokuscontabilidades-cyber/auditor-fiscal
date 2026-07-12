// Tokens visuais do novo diagnóstico público. Linguagem do Enfokus Sistemas
// (fundo escuro + destaque ciano, ver CLAUDE.md), composição própria desta página.
import type { CSSProperties } from 'react'

export const cor = {
  fundo: '#0a0f1a',
  fundoDegrade:
    'radial-gradient(1100px 560px at 82% -8%, rgba(39,199,216,0.14), transparent 60%), ' +
    'radial-gradient(820px 460px at -8% 18%, rgba(39,199,216,0.08), transparent 55%), #0a0f1a',
  acento: '#27c7d8',
  acentoSuave: 'rgba(39,199,216,0.12)',
  acentoBorda: 'rgba(39,199,216,0.30)',
  superficie: 'rgba(255,255,255,0.04)',
  superficieForte: 'rgba(255,255,255,0.065)',
  borda: 'rgba(255,255,255,0.09)',
  texto: '#eef6f7',
  textoSuave: '#a8bcc0',
  textoFraco: '#71868a',
  sucesso: '#3ddc97',
  sucessoSuave: 'rgba(61,220,151,0.12)',
  alerta: '#ffb648',
  alertaSuave: 'rgba(255,182,72,0.12)',
  critico: '#ff6b7a',
  criticoSuave: 'rgba(255,107,122,0.12)',
} as const

export const raio = { sm: 12, md: 16, lg: 22, xl: 28 }

export const sombra = {
  card: '0 20px 50px rgba(0,0,0,0.42)',
  botao: '0 10px 28px rgba(39,199,216,0.28)',
}

export const container: CSSProperties = {
  width: 'min(1120px, calc(100% - 40px))',
  margin: '0 auto',
}

export const cardBase: CSSProperties = {
  background: cor.superficie,
  border: `1px solid ${cor.borda}`,
  borderRadius: raio.lg,
  boxShadow: sombra.card,
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
}

export const botaoPrimario: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '13px 24px',
  borderRadius: 999,
  background: cor.acento,
  color: '#04181a',
  fontWeight: 800,
  fontSize: 15,
  border: 'none',
  cursor: 'pointer',
  boxShadow: sombra.botao,
  letterSpacing: '-0.01em',
}

export const botaoSecundario: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px 22px',
  borderRadius: 999,
  background: 'transparent',
  color: cor.texto,
  fontWeight: 700,
  fontSize: 14.5,
  border: `1px solid ${cor.borda}`,
  cursor: 'pointer',
}

export function situacaoCor(situacao: 'ok' | 'alerta' | 'critico') {
  if (situacao === 'ok') return { cor: cor.sucesso, fundo: cor.sucessoSuave }
  if (situacao === 'alerta') return { cor: cor.alerta, fundo: cor.alertaSuave }
  return { cor: cor.critico, fundo: cor.criticoSuave }
}
