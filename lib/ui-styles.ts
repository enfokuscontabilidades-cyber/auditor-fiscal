/**
 * Design tokens do Auditor Fiscal
 * Visual enterprise: sidebar escura, área de trabalho clara, cards brancos e azul Enfokus.
 */
export const T = {
  bgPage: 'var(--af-bg)',
  bgCard: 'var(--af-surface)',
  bgCardAlt: 'var(--af-surface-2)',
  bgInput: 'var(--af-surface)',
  bgOverlay: 'rgba(15, 23, 42, 0.45)',

  blue: 'var(--af-primary)',
  blueHover: 'var(--af-primary-hover)',
  blueSoft: '#eff6ff',
  blueBorder: '#bfdbfe',
  cyan: '#0284c7',
  cyanBright: '#0369a1',
  cyanMid: '#0ea5e9',
  cyanDim: '#bae6fd',
  cyanFaint: '#f0f9ff',
  cyanBorder: '#dbeafe',
  cyanBorderMid: '#93c5fd',

  textPrimary: 'var(--af-text)',
  textSecondary: 'var(--af-text-soft)',
  textMuted: 'var(--af-muted)',
  textDim: 'var(--af-muted)',
  textAccent: 'var(--af-primary)',

  critico: 'var(--af-danger)',
  alto: '#ea580c',
  medio: '#d97706',
  baixo: '#059669',

  gold: '#ca8a04',
  goldDim: '#facc15',

  sidebarBg: 'var(--af-text)',
  sidebarBorder: 'rgba(148,163,184,0.18)',
} as const

export function corNivel(nivel: string): string {
  if (nivel === 'critico') return T.critico
  if (nivel === 'alto')    return T.alto
  if (nivel === 'medio')   return T.medio
  return T.baixo
}
