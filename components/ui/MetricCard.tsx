import React from 'react'

interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: React.ReactNode
  accentBorder?: boolean
  style?: React.CSSProperties
}

export default function MetricCard({
  label,
  value,
  sub,
  color = 'var(--af-primary)',
  icon,
  accentBorder = false,
  style,
}: MetricCardProps) {
  const S: Record<string, React.CSSProperties> = {
    card: {
      background: 'var(--af-surface)',
      border: '1px solid var(--af-border)',
      borderRadius: 16,
      padding: '16px 18px 15px',
      boxShadow: 'var(--af-shadow-sm)',
      ...(accentBorder ? { borderTop: `3px solid ${color}` } : {}),
      ...style,
    },
    labelRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    label: {
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      color,
      margin: 0,
    },
    value: {
      fontSize: 26,
      fontWeight: 700,
      lineHeight: 1.08,
      letterSpacing: 0,
      color,
      margin: '0 0 6px',
    },
    sub: {
      fontSize: 12,
      color: 'var(--af-muted)',
      margin: 0,
    },
  }

  return (
    <div style={S.card}>
      <div style={S.labelRow}>
        {icon && <span style={{ color, display: 'flex' }}>{icon}</span>}
        <p style={S.label}>{label}</p>
      </div>
      <p style={S.value}>{value}</p>
      {sub && <p style={S.sub}>{sub}</p>}
    </div>
  )
}
