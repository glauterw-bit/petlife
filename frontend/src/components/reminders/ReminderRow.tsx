'use client'

import { useState } from 'react'
import { Check, MoreHorizontal, Repeat } from 'lucide-react'
import type { Reminder } from '@/lib/api'
import { parseReminderDate, reminderHasTime, reminderKindIcon } from '@/lib/reminders'
import { cn } from '@/lib/utils'

type T = (key: string, vars?: Record<string, string | number>) => string

const DAY = 86_400_000

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Diferença em dias de calendário locais (b − a). */
export function calendarDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY)
}

export function formatTime(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d)
}

export function formatDayShort(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d)
}

/** "Hoje, 08:00" · "Amanhã" · "ter., 28 de out., 20:00". */
export function formatWhen(d: Date, withTime: boolean, locale: string, t: T, now: Date = new Date()): string {
  const diff = calendarDays(now, d)
  const day =
    diff === 0
      ? t('rem.today')
      : diff === 1
        ? t('rem.tomorrow')
        : diff === -1
          ? t('rem.yesterday')
          : new Intl.DateTimeFormat(locale, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
            }).format(d)
  return withTime ? `${day}, ${formatTime(d, locale)}` : day
}

/** "A cada 15 dias" · "Todo dia até 2 de nov." · null sem repetição. */
export function repeatLabel(r: Pick<Reminder, 'repeat_days' | 'repeat_until'>, locale: string, t: T): string | null {
  const n = r.repeat_days ? Math.floor(r.repeat_days) : 0
  if (!n) return null
  const until = r.repeat_until ? parseReminderDate(r.repeat_until) : null
  const date = until && Number.isFinite(until.getTime()) ? formatDayShort(until, locale) : null
  if (n === 1) return date ? t('rem.everyDayUntil', { date }) : t('rem.everyDay')
  return date ? t('rem.everyNUntil', { n, date }) : t('rem.everyN', { n })
}

/** Texto de atraso no léxico único do app (não depende de gênero). */
function overdueText(d: Date, t: T, now: Date): string | null {
  const days = calendarDays(d, now)
  if (days <= 0) return null
  return days === 1 ? t('ui.care.overdueOne') : t('ui.care.overdueBy', { n: days })
}

const KIND_TONE: Record<string, string> = {
  medication: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  vet_appointment: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  grooming: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
}
const DEFAULT_TONE = 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'

/**
 * Uma linha da lista de lembretes: ícone do tipo, título, pet, quando,
 * repetição e o botão de concluir ("Dei" para remédio). Editar e excluir
 * ficam atrás do "…" (sem gesto escondido de deslizar).
 */
export function ReminderRow({
  reminder: r,
  petName,
  overdue,
  locale,
  t,
  onComplete,
  onMore,
}: {
  reminder: Reminder
  petName?: string
  overdue: boolean
  locale: string
  t: T
  onComplete: (r: Reminder) => Promise<void>
  onMore: (r: Reminder) => void
}) {
  const [busy, setBusy] = useState(false)
  const Icon = reminderKindIcon(r.type)
  const due = parseReminderDate(r.due_date)
  const valid = Number.isFinite(due.getTime())
  const now = new Date()
  const when = valid ? formatWhen(due, reminderHasTime(r), locale, t, now) : ''
  const late = overdue && valid ? overdueText(due, t, now) : null
  const rep = repeatLabel(r, locale, t)
  const isMed = r.type === 'medication'
  const doneLabel = isMed ? t('rem.gave') : t('rem.done')

  async function complete() {
    if (busy) return
    setBusy(true)
    try {
      await onComplete(r)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 pl-3 pr-2">
      <span className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', KIND_TONE[r.type] ?? DEFAULT_TONE)}>
        <Icon className="w-5 h-5" aria-hidden />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-surface-900 dark:text-white leading-snug break-words">{r.title}</p>
        {isMed && r.description && (
          <p className="text-[13px] text-surface-600 dark:text-surface-300 leading-snug break-words">{r.description}</p>
        )}
        <p className="text-[13px] leading-snug mt-0.5">
          {petName && <span className="text-surface-600 dark:text-surface-300">{petName} · </span>}
          {/* Vencido há dias: o atraso diz mais que a data (que fica no título acessível). */}
          {late ? (
            <span className="font-semibold text-red-700 dark:text-red-400" title={when}>
              {late}
            </span>
          ) : (
            <span className={overdue ? 'font-semibold text-red-700 dark:text-red-400' : 'text-surface-600 dark:text-surface-300'}>
              {when}
            </span>
          )}
          {late && <span className="sr-only"> ({when})</span>}
        </p>
        {rep && (
          <p className="inline-flex items-center gap-1 text-[12px] font-medium text-surface-600 dark:text-surface-300 mt-0.5">
            <Repeat className="w-3.5 h-3.5" aria-hidden />
            {rep}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={complete}
        disabled={busy}
        aria-label={isMed ? t('rem.gaveAria', { title: r.title }) : t('rem.doneAria', { title: r.title })}
        className={cn(
          'pressable shrink-0 inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[76px] px-2.5 rounded-xl text-sm font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-900',
          overdue
            ? 'bg-primary-700 text-white hover:bg-primary-800 dark:bg-primary-500 dark:text-surface-950 dark:hover:bg-primary-400'
            : 'bg-primary-50 text-primary-800 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-200 dark:hover:bg-primary-500/25',
          busy && 'opacity-60',
        )}
      >
        <Check className="w-4 h-4" aria-hidden />
        <span aria-hidden>{doneLabel}</span>
      </button>
      <button
        type="button"
        onClick={() => onMore(r)}
        aria-label={t('rem.more', { title: r.title })}
        className="pressable shrink-0 w-11 h-11 -ml-1 rounded-xl inline-flex items-center justify-center text-surface-500 hover:bg-surface-100 hover:text-surface-800 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <MoreHorizontal className="w-5 h-5" aria-hidden />
      </button>
    </div>
  )
}
