import React from 'react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  style?: React.CSSProperties
}

export default function EmptyState({ icon, title, description, action, style }: EmptyStateProps) {
  const S: Record<string, React.CSSProperties> = {
    wrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '48px 24px',
      gap: 12,
      ...style,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--af-primary-soft)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--af-primary)',
      marginBottom: 4,
    },
    title: {
      margin: 0,
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--af-text)',
    },
    desc: {
      margin: 0,
      fontSize: 13,
      color: 'var(--af-muted)',
      lineHeight: 1.6,
      maxWidth: 380,
    },
    btn: {
      marginTop: 8,
      padding: '8px 20px',
      fontSize: 13,
      fontWeight: 600,
      borderRadius: 10,
      border: '1px solid var(--af-primary)',
      background: 'var(--af-primary-soft)',
      color: 'var(--af-primary)',
      cursor: 'pointer',
    },
  }

  return (
    <div style={S.wrap}>
      {icon && <div style={S.iconWrap}>{icon}</div>}
      <p style={S.title}>{title}</p>
      {description && <p style={S.desc}>{description}</p>}
      {action && (
        <button style={S.btn} onClick={action.onClick} type="button">
          {action.label}
        </button>
      )}
    </div>
  )
}
