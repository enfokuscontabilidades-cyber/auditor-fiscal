import React from 'react'

interface GlassCardProps {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
  title?: string
  titleRight?: React.ReactNode
  padding?: string | number
}

export default function GlassCard({
  children,
  style,
  className,
  title,
  titleRight,
  padding = '20px 22px',
}: GlassCardProps) {
  const S: Record<string, React.CSSProperties> = {
    card: {
      background: 'var(--af-surface)',
      border: '1px solid var(--af-border)',
      borderRadius: 14,
      boxShadow: 'var(--af-shadow-sm)',
      overflow: 'hidden',
      backdropFilter: 'var(--af-glass-blur)',
      WebkitBackdropFilter: 'var(--af-glass-blur)',
      ...style,
    },
    header: {
      padding: '12px 16px',
      borderBottom: '1px solid var(--af-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerTitle: {
      margin: 0,
      fontSize: 13.5,
      fontWeight: 700,
      color: 'var(--af-text)',
    },
    body: {
      padding,
    },
  }

  return (
    <div style={S.card} className={className}>
      {title && (
        <div style={S.header}>
          <p style={S.headerTitle}>{title}</p>
          {titleRight && <div>{titleRight}</div>}
        </div>
      )}
      <div style={S.body}>{children}</div>
    </div>
  )
}
