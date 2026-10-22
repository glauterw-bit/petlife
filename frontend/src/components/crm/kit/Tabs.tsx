'use client'

import { useRef, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { spring } from '../motion'

export function Tabs<T extends string>({ value, onChange, tabs, id, className = '' }: {
  value: T; onChange: (v: T) => void; tabs: Array<{ value: T; label: string; count?: number }>; id: string; className?: string
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex(t => t.value === value)
    let n = -1
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = tabs.length - 1
    if (n < 0) return
    e.preventDefault()
    onChange(tabs[n].value)
    refs.current[n]?.focus()
    refs.current[n]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  return (
    <div role="tablist" onKeyDown={onKey} className={`flex gap-1 border-b border-line overflow-x-auto crm-scroll-x -mx-4 px-4 md:mx-0 md:px-0 ${className}`}>
      {tabs.map((t, i) => {
        const active = t.value === value
        return (
          <button key={t.value} ref={el => { refs.current[i] = el }} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={`relative shrink-0 h-10 px-3 text-sm font-semibold whitespace-nowrap transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}>
            <span className="inline-flex items-center gap-1.5">
              {t.label}
              {t.count != null && <span className="tabular-nums text-2xs rounded-full px-1.5 bg-panel-2 text-muted">{t.count}</span>}
            </span>
            {active && <motion.span layoutId={`tabs-${id}`} transition={spring.snappy} className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-primary-500 dark:bg-primary-400" />}
          </button>
        )
      })}
    </div>
  )
}
