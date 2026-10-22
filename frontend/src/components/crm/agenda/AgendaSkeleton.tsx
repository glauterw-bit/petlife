'use client'

import { Skeleton } from '../kit'
import { HOUR_PX } from './utils'

/** Grade cinza enquanto a agenda carrega. */
export function AgendaSkeleton({ columns = 3, list }: { columns?: number; list?: boolean }) {
  if (list) {
    return (
      <div role="status" aria-label="Carregando a agenda" className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="bg-panel rounded-2xl shadow-crm-card p-4 flex items-center gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full hidden sm:block" />
          </div>
        ))}
      </div>
    )
  }
  const rows = 8
  const blocks = [[1, 1.5], [3, 1], [5.5, 2], [0.5, 1], [2.5, 0.5], [4, 1.5]]
  return (
    <div role="status" aria-label="Carregando a agenda" className="rounded-2xl bg-panel shadow-crm-card overflow-hidden">
      <div className="flex border-b border-line">
        <div className="w-14 shrink-0" />
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className="flex-1 px-3 py-2.5 border-l border-line"><Skeleton className="h-3.5 w-24" /></div>
        ))}
      </div>
      <div className="flex">
        <div className="w-14 shrink-0 border-r border-line" style={{ height: rows * HOUR_PX }} />
        {Array.from({ length: columns }, (_, c) => (
          <div key={c} className="relative flex-1 border-l border-line" style={{ height: rows * HOUR_PX }}>
            {Array.from({ length: rows }, (_, r) => <div key={r} className="absolute inset-x-0 border-t border-line" style={{ top: r * HOUR_PX }} />)}
            {blocks.filter((_, i) => (i + c) % 2 === 0).map(([t, h], i) => (
              <div key={i} className="absolute left-1.5 right-1.5" style={{ top: t * HOUR_PX + 2, height: h * HOUR_PX - 4 }}>
                <Skeleton className="h-full w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
