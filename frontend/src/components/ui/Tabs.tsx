'use client'

import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hapticSelect } from '@/lib/feedback'
import { spring } from '@/lib/motion'

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  variant = 'pill',
  scrollable = false,
  layoutId,
}: {
  items: { id: T; label: string; icon?: LucideIcon; badge?: number }[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  variant?: 'pill' | 'underline'
  scrollable?: boolean
  layoutId?: string
}) {
  const autoId = useId()
  const pillId = layoutId ?? `tabs-${autoId}`
  const listRef = useRef<HTMLDivElement>(null)
  const pill = variant === 'pill'

  // Mantém a aba ativa visível quando a lista rola
  useEffect(() => {
    if (!scrollable) return
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [value, scrollable])

  function select(id: T) {
    if (id === value) return
    void hapticSelect()
    onChange(id)
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = items.findIndex(x => x.id === value)
    const next = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length]
    select(next.id)
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus())
  }

  return (
    <LayoutGroup id={pillId}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKey}
        data-scroll-x={scrollable ? '' : undefined}
        className={cn(
          'flex gap-1',
          pill ? 'p-1 rounded-2xl bg-surface-100 dark:bg-surface-900 border border-surface-200/60 dark:border-surface-800' : 'border-b border-surface-200 dark:border-surface-800',
          scrollable ? 'overflow-x-auto no-scrollbar' : '',
        )}
      >
        {items.map(({ id, label, icon: Icon, badge }) => {
          const active = id === value
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => select(id)}
              className={cn(
                'relative min-h-[44px] px-3.5 inline-flex items-center justify-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
                scrollable ? 'shrink-0' : 'flex-1',
                pill ? 'rounded-xl' : 'rounded-t-lg',
                active
                  ? pill
                    ? 'text-surface-900 dark:text-white'
                    : 'text-primary-700 dark:text-primary-300'
                  : 'text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-surface-200',
              )}
            >
              {active && (
                <motion.span
                  layoutId={`${pillId}-indicator`}
                  transition={spring.snappy}
                  aria-hidden
                  className={cn(
                    'absolute',
                    pill
                      ? 'inset-0 rounded-xl bg-white shadow-sm dark:bg-surface-700'
                      : 'left-2 right-2 -bottom-px h-0.5 rounded-full bg-primary-600 dark:bg-primary-400',
                  )}
                />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                {Icon && <Icon className="w-4 h-4" aria-hidden />}
                {label}
                {badge != null && badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none inline-flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
