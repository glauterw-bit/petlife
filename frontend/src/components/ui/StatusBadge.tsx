'use client'

import type { ReactNode } from 'react'
import { CheckCircle2, Clock, AlertCircle, CircleDashed, Info, Circle, History, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import type { CareState } from '@/lib/care'

export type StatusState = 'ok' | 'soon' | 'overdue' | 'never' | 'info' | 'neutral' | 'superseded'

const MAP: Record<StatusState, { chip: string; Icon: LucideIcon }> = {
  ok: { chip: 'chip-success', Icon: CheckCircle2 },
  soon: { chip: 'chip-warning', Icon: Clock },
  overdue: { chip: 'chip-danger', Icon: AlertCircle },
  never: { chip: 'chip-neutral', Icon: CircleDashed },
  info: { chip: 'chip-info', Icon: Info },
  neutral: { chip: 'chip-neutral', Icon: Circle },
  superseded: { chip: 'chip-neutral', Icon: History },
}

/** Ícone + texto (nunca só cor). Sem children, usa o rótulo padrão do estado. */
export function StatusBadge({
  state,
  children,
  size = 'sm',
  showIcon = true,
}: {
  state: StatusState
  children?: ReactNode
  size?: 'sm' | 'md'
  showIcon?: boolean
}) {
  const t = useT()
  const { chip, Icon } = MAP[state]
  return (
    <span className={cn('chip', chip, size === 'md' && 'px-3 py-1.5 text-[13px]')}>
      {showIcon && <Icon className={size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} aria-hidden strokeWidth={2.4} />}
      <span>{children ?? t(`ui.status.${state}`)}</span>
    </span>
  )
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

/** "Protegido" · "Vence em 12 dias" · "Vence amanhã" · "Vence hoje" · "Atrasado há 3 dias" · "Sem registro". */
export function careStateLabel(t: TFn, state: CareState, daysLeft: number | null): string {
  if (state === 'never') return t('ui.care.never')
  if (daysLeft == null) return state === 'overdue' ? t('ui.status.overdue') : t('ui.care.protected')
  if (state === 'overdue' || daysLeft < 0) {
    const n = Math.abs(daysLeft)
    return n <= 1 ? t('ui.care.overdueOne') : t('ui.care.overdueBy', { n })
  }
  if (state === 'soon') {
    if (daysLeft === 0) return t('ui.care.dueToday')
    if (daysLeft === 1) return t('ui.care.dueInOne')
    return t('ui.care.dueIn', { n: daysLeft })
  }
  return t('ui.care.protected')
}
