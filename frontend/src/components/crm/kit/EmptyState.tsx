'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, title, hint, action, compact }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-12'} px-4`}>
      <span className="h-12 w-12 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 inline-flex items-center justify-center">
        <Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
