'use client'

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`relative overflow-hidden bg-panel-2 rounded-lg before:absolute before:inset-0 before:-translate-x-full before:animate-crm-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/40 dark:before:via-white/5 before:to-transparent motion-reduce:before:hidden ${className}`} />
  )
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 h-14 md:h-11 px-1">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <Skeleton className="h-3.5 flex-1 max-w-[220px]" />
          <Skeleton className="h-3.5 w-24 hidden sm:block" />
          <Skeleton className="h-3.5 w-16 ml-auto" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonKpis({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-panel rounded-2xl shadow-crm-card p-4 lg:p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28 mt-3" />
          <Skeleton className="h-3 w-16 mt-2" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="bg-panel rounded-2xl shadow-crm-card p-4 lg:p-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={`h-3 ${i % 3 === 2 ? 'w-2/3' : i % 2 ? 'w-5/6' : 'w-full'}`} />)}
      </div>
    </div>
  )
}
