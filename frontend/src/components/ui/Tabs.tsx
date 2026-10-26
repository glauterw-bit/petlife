'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/feedback'
import { spring } from '@/lib/motion'

/**
 * Props do painel ligado a uma aba: `<div {...tabPanelProps('pet', 'overview')}>`.
 * Use o mesmo idBase passado ao <Tabs>.
 */
export function tabPanelProps(idBase: string, id: string) {
  return {
    id: `${idBase}-panel-${id}`,
    role: 'tabpanel' as const,
    'aria-labelledby': `${idBase}-tab-${id}`,
    tabIndex: 0,
  }
}

export { ScrollHint } from './ScrollHint'

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  variant = 'pill',
  scrollable = false,
  layoutId,
  idBase,
}: {
  items: { id: T; label: string; icon?: LucideIcon; badge?: number }[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  variant?: 'pill' | 'underline'
  scrollable?: boolean
  layoutId?: string
  /**
   * Liga cada aba ao seu painel: aba `${idBase}-tab-${id}` com aria-controls
   * para `${idBase}-panel-${id}` (use tabPanelProps no painel).
   */
  idBase?: string
}) {
  const autoId = useId()
  const pillId = layoutId ?? `tabs-${autoId}`
  const listRef = useRef<HTMLDivElement>(null)
  const pill = variant === 'pill'

  // Degradê nas bordas só do lado em que ainda há abas escondidas — sinal
  // de "tem mais para o lado" sem cortar a primeira/última aba à toa.
  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    if (!scrollable) return
    const el = listRef.current
    if (!el) return
    const update = () => {
      const left = el.scrollLeft > 1
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setEdges(prev => (prev.left === left && prev.right === right ? prev : { left, right }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro?.disconnect()
    }
  }, [scrollable, items.length])

  // Mantém a aba ativa visível quando a lista rola. Equivale a
  // scrollIntoView({ inline: 'nearest' }) só no eixo horizontal da lista —
  // scrollIntoView também rola a PÁGINA quando as abas estão fora da tela.
  const firstRun = useRef(true)
  useEffect(() => {
    if (!scrollable) return
    const list = listRef.current
    const el = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!list || !el) return
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const lr = list.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    const pad = 16
    let delta = 0
    if (er.left < lr.left + pad) delta = er.left - lr.left - pad
    else if (er.right > lr.right - pad) delta = er.right - lr.right + pad
    if (delta !== 0) {
      list.scrollTo({ left: list.scrollLeft + delta, behavior: firstRun.current || reduced ? 'auto' : 'smooth' })
    }
    firstRun.current = false
  }, [value, scrollable])

  function select(id: T) {
    if (id === value) return
    haptic('tab')
    onChange(id)
  }

  const FADE = 16
  const mask =
    scrollable && (edges.left || edges.right)
      ? `linear-gradient(to right, ${edges.left ? 'transparent' : '#000'} 0, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${edges.right ? 'transparent' : '#000'} 100%)`
      : undefined

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
        style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
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
              id={idBase ? `${idBase}-tab-${id}` : undefined}
              aria-controls={idBase ? `${idBase}-panel-${id}` : undefined}
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
                  : 'text-surface-600 hover:text-surface-800 dark:text-surface-300 dark:hover:text-surface-100',
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
