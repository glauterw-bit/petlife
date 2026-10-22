'use client'

import type { KeyboardEvent, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Inbox } from 'lucide-react'
import { MotionItem, dur } from '../motion'
import { SkeletonRows } from './Skeleton'
import { ErrorState } from './ErrorState'
import { EmptyState } from './EmptyState'

export interface Column<T> { key: string; header: string; cell: (row: T) => ReactNode; className?: string; align?: 'left' | 'right'; hideBelow?: 'md' | 'lg' }

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number]
const hide = (h?: 'md' | 'lg') => (h === 'lg' ? 'hidden lg:table-cell' : '')

export function DataList<T>({ rows, columns, rowKey, renderMobile, onRowClick, rowActions, loading, error, onRetry, empty, footer, ariaLabel }: {
  rows: T[] | null; columns: Column<T>[]; rowKey: (r: T) => string | number; renderMobile: (r: T) => ReactNode
  onRowClick?: (r: T) => void; rowActions?: (r: T) => ReactNode; loading?: boolean; error?: string | null; onRetry?: () => void
  empty?: ReactNode; footer?: ReactNode; ariaLabel?: string
}) {
  const has = !!rows && rows.length > 0
  if (!has && error) return <ErrorState message={error} onRetry={onRetry} />
  if (!rows || (loading && !has)) return <SkeletonRows />
  if (!rows.length) return <>{empty ?? <EmptyState icon={Inbox} title="Nada por aqui ainda." compact />}</>

  const keyOpen = (r: T) => (e: KeyboardEvent) => {
    if (!onRowClick) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(r) }
  }
  const clickable = onRowClick ? { tabIndex: 0, role: 'button' as const } : {}

  return (
    <div aria-busy={loading || undefined}>
      {/* computador */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm" aria-label={ariaLabel}>
          <thead>
            <tr className="border-b border-line">
              {columns.map(c => (
                <th key={c.key} scope="col" className={`h-9 px-3 first:pl-1 text-2xs font-semibold uppercase tracking-wider text-muted ${c.align === 'right' ? 'text-right' : 'text-left'} ${hide(c.hideBelow)} ${c.className ?? ''}`}>{c.header}</th>
              ))}
              {rowActions && <th className="w-px" aria-label="Ações" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <motion.tr key={rowKey(r)} {...clickable}
                onClick={onRowClick ? () => onRowClick(r) : undefined} onKeyDown={onRowClick ? keyOpen(r) : undefined}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: dur.base, ease: easeOut, delay: i < 12 ? i * 0.03 : 0 }}
                className={`group h-11 border-b border-line last:border-b-0 transition-colors hover:bg-panel-2/60 ${onRowClick ? 'cursor-pointer focus-visible:bg-panel-2/60' : ''}`}>
                {columns.map(c => (
                  <td key={c.key} className={`px-3 first:pl-1 py-1.5 text-ink ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${hide(c.hideBelow)} ${c.className ?? ''}`}>{c.cell(r)}</td>
                ))}
                {rowActions && (
                  <td className="px-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                    <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">{rowActions(r)}</div>
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* celular */}
      <ul className="md:hidden divide-y divide-line -mx-1" aria-label={ariaLabel}>
        {rows.map((r, i) => (
          <MotionItem as="li" key={rowKey(r)} index={i}>
            <div {...clickable} onClick={onRowClick ? () => onRowClick(r) : undefined} onKeyDown={onRowClick ? keyOpen(r) : undefined}
              className={`flex items-center gap-3 min-h-14 px-1 py-2 rounded-lg ${onRowClick ? 'cursor-pointer active:bg-panel-2' : ''}`}>
              <div className="min-w-0 flex-1">{renderMobile(r)}</div>
              {rowActions && <div className="shrink-0 flex gap-1" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>{rowActions(r)}</div>}
              {onRowClick && <ChevronRight className="w-4 h-4 text-muted shrink-0" strokeWidth={1.75} aria-hidden />}
            </div>
          </MotionItem>
        ))}
      </ul>
      {footer && <div className="pt-3">{footer}</div>}
    </div>
  )
}
