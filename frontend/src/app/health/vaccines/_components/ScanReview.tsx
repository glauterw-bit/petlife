'use client'

/**
 * Revisão do que a IA leu na foto da carteirinha.
 *
 * As vacinas aparecem preenchendo em cascata (≈ 250 ms cada, ≤ 1,2 s no
 * total), com um cursor curto na linha que está "sendo digitada" — o tutor
 * vê a leitura acontecer e confere uma vez só. Com "reduzir movimento",
 * tudo aparece de uma vez. Todas já vêm marcadas para salvar.
 */
import { useEffect, useId, useState } from 'react'
import { m } from 'framer-motion'
import { Check } from 'lucide-react'
import type { ScannedVaccine } from '@/lib/api'
import { useT } from '@/contexts/LocaleContext'
import { usePrefersReducedMotion, dur, easeOut } from '@/lib/motion'
import { cn } from '@/lib/utils'

const fieldCls =
  'w-full min-h-[44px] px-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500'

export function ScanReview({
  items,
  include,
  onChange,
  onToggle,
}: {
  items: ScannedVaccine[]
  include: boolean[]
  onChange: (index: number, patch: Partial<ScannedVaccine>) => void
  onToggle: (index: number) => void
}) {
  const t = useT()
  const uid = useId()
  const reduced = usePrefersReducedMotion()
  const n = items.length
  const step = Math.min(250, Math.floor(1200 / Math.max(1, n)))
  const [shown, setShown] = useState(0)
  const [typing, setTyping] = useState(true)

  useEffect(() => {
    if (reduced) {
      setShown(n)
      setTyping(false)
      return
    }
    setShown(1)
    setTyping(true)
    let i = 1
    const id = window.setInterval(() => {
      i++
      if (i > n) {
        window.clearInterval(id)
        setTyping(false)
        return
      }
      setShown(i)
    }, step)
    return () => window.clearInterval(id)
    // só reinicia quando chega uma leitura nova (quantidade muda)
  }, [n, reduced, step])

  return (
    <ul className="space-y-2.5" aria-live="polite">
      {items.map((v, i) => {
        const visible = i < shown
        const isTyping = typing && i === shown - 1
        const on = include[i] !== false
        return (
          <m.li
            key={i}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={visible ? { opacity: on ? 1 : 0.55, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: dur.fast, ease: easeOut }}
            className={cn(
              'rounded-2xl border p-3 transition-colors',
              on
                ? 'border-primary-200 bg-primary-50/50 dark:border-primary-500/25 dark:bg-primary-500/[0.06]'
                : 'border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900',
              !visible && 'pointer-events-none',
            )}
            aria-hidden={!visible}
          >
            <div className="flex items-start gap-2">
              <label className="relative -ml-1 -mt-0.5 w-11 h-11 shrink-0 flex items-center justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(i)}
                  className="peer sr-only"
                  aria-label={t('care.scanInclude', { name: v.name || '—' })}
                />
                <span
                  aria-hidden
                  className={cn(
                    'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-surface-900',
                    on
                      ? 'bg-primary-700 border-primary-700 text-white dark:bg-primary-500 dark:border-primary-500 dark:text-surface-950'
                      : 'border-surface-300 dark:border-surface-600',
                  )}
                >
                  {on && <Check className="w-4 h-4" strokeWidth={3} />}
                </span>
              </label>
              <div className="flex-1 min-w-0 space-y-2">
                <label htmlFor={`${uid}-n${i}`} className="sr-only">
                  {t('care.scanName')}
                </label>
                {isTyping ? (
                  <div className={cn(fieldCls, 'flex items-center font-semibold')}>
                    <span className="truncate">{v.name}</span>
                    <span aria-hidden className="ml-0.5 inline-block w-[2px] h-4 bg-primary-600 dark:bg-primary-400 animate-pulse" />
                  </div>
                ) : (
                  <input
                    id={`${uid}-n${i}`}
                    value={v.name}
                    onChange={e => onChange(i, { name: e.target.value })}
                    className={cn(fieldCls, 'font-semibold')}
                  />
                )}
                <m.div
                  className="grid grid-cols-2 gap-2"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: visible && !isTyping ? 1 : reduced ? 1 : 0.25 }}
                  transition={{ duration: dur.fast, ease: easeOut }}
                >
                  <div>
                    <label htmlFor={`${uid}-g${i}`} className="block text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-1">
                      {t('care.scanGiven')}
                    </label>
                    <input
                      id={`${uid}-g${i}`}
                      type="date"
                      value={v.date_given ?? ''}
                      onChange={e => onChange(i, { date_given: e.target.value || null })}
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-x${i}`} className="block text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-1">
                      {t('care.scanNext')}
                    </label>
                    <input
                      id={`${uid}-x${i}`}
                      type="date"
                      value={v.next_due ?? ''}
                      onChange={e => onChange(i, { next_due: e.target.value || null })}
                      className={fieldCls}
                    />
                  </div>
                </m.div>
              </div>
            </div>
          </m.li>
        )
      })}
    </ul>
  )
}
