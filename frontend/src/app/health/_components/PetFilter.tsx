'use client'

import { m } from 'framer-motion'
import type { Pet } from '@/lib/api'
import { useT } from '@/contexts/LocaleContext'
import { spring } from '@/lib/motion'
import { hapticSelect } from '@/lib/feedback'
import { cn } from '@/lib/utils'
import { PetAvatar } from '@/components/ui/PetAvatar'

/** Filtro "Todos" + cada pet, com pílula deslizante. */
export function PetFilter({
  pets,
  value,
  onChange,
  layoutId = 'pet-filter-pill',
}: {
  pets: Pet[]
  value: number | 'all'
  onChange: (v: number | 'all') => void
  layoutId?: string
}) {
  const t = useT()
  const opts: Array<{ v: number | 'all'; label: string; pet?: Pet }> = [
    { v: 'all', label: t('care.all') },
    ...pets.map(p => ({ v: p.id, label: p.name, pet: p })),
  ]
  return (
    <div role="radiogroup" aria-label={t('care.filterAria')} className="-mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar">
      {opts.map(o => {
        const active = o.v === value
        return (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (active) return
              void hapticSelect()
              onChange(o.v)
            }}
            className={cn(
              'relative shrink-0 min-h-[44px] inline-flex items-center gap-2 rounded-full pl-2 pr-4 text-sm font-semibold transition-colors',
              !o.pet && 'pl-4',
              active
                ? 'text-white dark:text-surface-950'
                : 'bg-white text-surface-700 border border-surface-200 hover:bg-surface-50 dark:bg-surface-900 dark:text-surface-200 dark:border-surface-800 dark:hover:bg-surface-800',
            )}
          >
            {active && (
              <m.span
                layoutId={layoutId}
                transition={spring.snappy}
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary-700 dark:bg-primary-500"
              />
            )}
            {o.pet && <PetAvatar pet={o.pet} size={28} className="relative" />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
