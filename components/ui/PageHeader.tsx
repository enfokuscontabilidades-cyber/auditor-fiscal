import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  badge?: { label: string; color?: string }
  actions?: React.ReactNode
  style?: React.CSSProperties
}

export default function PageHeader({ title, subtitle, badge, actions, style }: PageHeaderProps) {
  const S: Record<string, React.CSSProperties> = {
    wrap: {
      marginBottom: 28,
      ...style,
    },
    row: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
    },
    left: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flex: 1,
      minWidth: 0,
    },
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    title: {
      fontSize: 22,
      fontWeight: 800,
      margin: 0,
      letterSpacing: '-0.02em',
      color: 'var(--af-text)',
      lineHeight: 1.2,
    },
    subtitle: {
      margin: 0,
      fontSize: 13,
      color: 'var(--af-muted)',
      lineHeight: 1.55,
      maxWidth: 640,
    },
    actions: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
      flexWrap: 'wrap',
    },
  }

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '3px 10px',
    borderRadius: 20,
    background: badge?.color ? `${badge.color}22` : 'var(--af-primary-soft)',
    color: badge?.color ?? 'var(--af-primary)',
    border: `1px solid ${badge?.color ? `${badge.color}44` : 'var(--af-glass-border)'}`,
    whiteSpace: 'nowrap',
  }

  return (
    <div style={S.wrap}>
      <div style={S.row}>
        <div style={S.left}>
          <div style={S.titleRow}>
            <h1 style={S.title}>{title}</h1>
            {badge && <span style={badgeStyle}>{badge.label}</span>}
          </div>
          {subtitle && <p style={S.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div style={S.actions}>{actions}</div>}
      </div>
    </div>
  )
}
