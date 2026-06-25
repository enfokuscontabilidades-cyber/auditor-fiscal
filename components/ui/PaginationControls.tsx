'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'

type PaginationControlsProps = {
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSizeOptions?: number[]
}

export function getPageItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export default function PaginationControls({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 50, 100],
}: PaginationControlsProps) {
  if (total <= 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize + 1
  const end = Math.min(total, safePage * pageSize)

  const buttonStyle = (disabled: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 32,
    padding: '6px 10px',
    borderRadius: 7,
    border: '1px solid var(--af-border)',
    background: disabled ? 'rgba(148,163,184,0.06)' : 'var(--af-surface-2)',
    color: disabled ? 'var(--af-muted)' : 'var(--af-text)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    fontWeight: 700,
    opacity: disabled ? 0.62 : 1,
  })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 16px',
        borderTop: '1px solid var(--af-border)',
        color: 'var(--af-muted)',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>
          Exibindo {start}-{end} de {total.toLocaleString('pt-BR')}
        </span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span>Linhas por pagina</span>
          <select
            value={pageSize}
            onChange={event => onPageSizeChange(Number(event.target.value))}
            style={{
              background: 'var(--af-surface-2)',
              border: '1px solid var(--af-border)',
              borderRadius: 7,
              color: 'var(--af-text)',
              padding: '5px 8px',
              fontSize: 12,
              outline: 'none',
            }}
          >
            {pageSizeOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          style={buttonStyle(safePage <= 1)}
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          title="Pagina anterior"
        >
          <ChevronLeft size={14} />
          Anterior
        </button>
        <span style={{ minWidth: 88, textAlign: 'center', color: 'var(--af-text)', fontWeight: 700 }}>
          Pagina {safePage} de {totalPages}
        </span>
        <button
          type="button"
          style={buttonStyle(safePage >= totalPages)}
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          title="Proxima pagina"
        >
          Proxima
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
