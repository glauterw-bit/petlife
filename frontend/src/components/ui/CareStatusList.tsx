'use client'

import { Syringe, Pill, Bug, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import type { CareItem, CareKind, PetCareSummary } from '@/lib/care'
import { StatusBadge, careStateLabel } from './StatusBadge'

const ICONS: Record<CareKind, typeof Syringe> = { vaccines: Syringe, vermifugo: Pill, antipulgas: Bug }
const LABEL: Record<CareKind, string> = {
  vaccines: 'ui.care.vaccines',
  vermifugo: 'ui.care.vermifugo',
  antipulgas: 'ui.care.antipulgas',
}
const ICON_TONE = {
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  soon: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  overdue: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  never: 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400',
}

/** Três linhas — vacinas, vermífugo, antipulgas — com ícone, rótulo e situação em texto. */
export function CareStatusList({
  summary,
  compact = false,
  onItemClick,
}: {
  summary: PetCareSummary
  compact?: boolean
  onItemClick?: (item: CareItem) => void
}) {
  const t = useT()
  return (
    <ul className={cn('divide-y divide-surface-100 dark:divide-surface-800', compact ? '' : '-my-1')}>
      {summary.items.map(item => {
        const Icon = ICONS[item.kind]
        const detail = careStateLabel(t, item.state, item.daysLeft)
        const sub = item.kind === 'vaccines' && item.vaccineName && item.state !== 'never' ? item.vaccineName : null
        const inner = (
          <>
            <span className={cn('rounded-xl flex items-center justify-center shrink-0', compact ? 'w-8 h-8' : 'w-10 h-10', ICON_TONE[item.state])}>
              <Icon className={compact ? 'w-4 h-4' : 'w-5 h-5'} aria-hidden />
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-sm font-semibold text-surface-900 dark:text-white">{t(LABEL[item.kind])}</span>
              {compact ? (
                <span className="block text-xs text-surface-500 dark:text-surface-400 truncate">
                  {sub ? `${sub} · ${detail}` : detail}
                </span>
              ) : sub ? (
                <span className="block text-xs text-surface-500 dark:text-surface-400 truncate">{sub}</span>
              ) : null}
            </span>
            {!compact && (
              <span className="shrink-0 whitespace-nowrap">
                <StatusBadge state={item.state}>{detail}</StatusBadge>
              </span>
            )}
            {onItemClick && <ChevronRight className="w-4 h-4 text-surface-400 shrink-0" aria-hidden />}
          </>
        )
        return (
          <li key={item.kind}>
            {onItemClick ? (
              <button
                type="button"
                onClick={() => onItemClick(item)}
                className={cn('pressable w-full flex items-center gap-3 min-h-[44px] rounded-xl', compact ? 'py-1.5' : 'py-2.5')}
              >
                {inner}
              </button>
            ) : (
              <div className={cn('flex items-center gap-3 min-h-[44px]', compact ? 'py-1.5' : 'py-2.5')}>{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
