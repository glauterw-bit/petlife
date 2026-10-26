'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Section({
  title,
  action,
  children,
  className,
  id,
}: {
  title: string
  action?: { label: string; href?: string; onClick?: () => void }
  children: ReactNode
  className?: string
  id?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  const actionCls =
    'pressable inline-flex items-center gap-0.5 -mr-2 px-2 min-h-[44px] rounded-lg text-sm font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200'
  return (
    <section id={id} aria-labelledby={headingId} className={cn('mb-6', className)}>
      <div className="flex items-center justify-between gap-3 mb-2 min-h-[44px]">
        <h2 id={headingId} className="text-base font-bold font-display text-surface-900 dark:text-white">
          {title}
        </h2>
        {action &&
          (action.href ? (
            <Link href={action.href} className={actionCls}>
              {action.label}
              <ChevronRight className="w-4 h-4" aria-hidden />
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} className={actionCls}>
              {action.label}
              <ChevronRight className="w-4 h-4" aria-hidden />
            </button>
          ))}
      </div>
      {children}
    </section>
  )
}
