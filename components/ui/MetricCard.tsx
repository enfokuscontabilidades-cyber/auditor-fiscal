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
      borderRadius: 18,
      padding: '18px 18px 16px',
      boxShadow: 'var(--af-shadow-sm)',
      ...(accentBorder ? { borderTop: `4px solid ${color}` } : {}),
      ...style,
    },
    labelRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginBottom: 12,
    },
    label: {
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      color,
      margin: 0,
    },
    value: {
      fontSize: 32,
      fontWeight: 800,
      lineHeight: 1,
      letterSpacing: '-0.04em',
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
