'use client'

import { useId } from 'react'
import { m, LayoutGroup } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hapticSelect } from '@/lib/feedback'
import { spring } from '@/lib/motion'

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  options: { value: T; label: string; icon?: LucideIcon }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
}) {
  const id = useId()
  return (
    <LayoutGroup id={`seg-${id}`}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className="inline-flex w-full p-1 gap-1 rounded-xl bg-surface-100 dark:bg-surface-900 border border-surface-200/60 dark:border-surface-800"
      >
        {options.map(o => {
          const active = o.value === value
          const Icon = o.icon
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (active) return
                void hapticSelect()
                onChange(o.value)
              }}
              className={cn(
                'relative flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors',
                size === 'sm' ? 'min-h-[40px] text-[13px] px-2' : 'min-h-[44px] text-sm px-3',
                active ? 'text-surface-900 dark:text-white' : 'text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-surface-200',
              )}
            >
              {active && (
                <m.span
                  layoutId={`seg-${id}-pill`}
                  transition={spring.snappy}
                  aria-hidden
                  className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-surface-700"
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                {Icon && <Icon className="w-4 h-4" aria-hidden />}
                {o.label}
              </span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
