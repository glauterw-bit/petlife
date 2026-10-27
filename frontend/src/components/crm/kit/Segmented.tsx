'use client'

import { useRef, type KeyboardEvent } from 'react'
import { m } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { spring } from '../motion'

export function Segmented<T extends string>({ value, onChange, options, id, size = 'md', className = '', ariaLabel }: {
  value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; icon?: LucideIcon; count?: number }>
  id: string; size?: 'sm' | 'md'; className?: string; ariaLabel?: string
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex(o => o.value === value)
    let n = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + options.length) % options.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = options.length - 1
    if (n < 0) return
    e.preventDefault()
    onChange(options[n].value)
    refs.current[n]?.focus()
  }
  const h = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm'
  return (
    <div role="tablist" aria-label={ariaLabel} onKeyDown={onKey}
      className={`inline-flex items-center gap-0.5 rounded-lg bg-panel-2 p-0.5 max-w-full overflow-x-auto crm-scroll-x ${className}`}>
      {options.map((o, i) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button key={o.value} ref={el => { refs.current[i] = el }} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`relative ${h} shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 font-semibold transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}>
            {active && <m.span layoutId={`seg-${id}`} transition={spring.snappy} className="absolute inset-0 rounded-md bg-panel shadow-crm-card" />}
            <span className="relative inline-flex items-center gap-1.5">
              {Icon && <Icon className="w-4 h-4" strokeWidth={1.75} aria-hidden />}
              {o.label}
              {o.count != null && <span className={`tabular-nums text-2xs rounded-full px-1.5 ${active ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300' : 'bg-panel text-muted'}`}>{o.count}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
