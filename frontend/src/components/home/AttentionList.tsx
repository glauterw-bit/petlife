'use client'

import { useState } from 'react'
import { Check, Loader2, Syringe, Pill, Bug, type LucideIcon } from 'lucide-react'
import type { Reminder, Vaccine } from '@/lib/api'
import { reminders as remindersApi } from '@/lib/api'
import { invalidate } from '@/lib/cache'
import { haptic } from '@/lib/feedback'
import { latestDoses, vaccineState, daysUntil, type CareKind, type CareState, type PetCareSummary } from '@/lib/care'
import { parseReminderDate, reminderHasTime, isReminderOverdue, reminderKindIcon } from '@/lib/reminders'
import { formatDate, cn } from '@/lib/utils'
import { useT, useLocale } from '@/contexts/LocaleContext'
import { formatWhen } from '@/components/reminders/ReminderRow'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { StatusBadge, careStateLabel } from '@/components/ui/StatusBadge'
import { vaccineAddHref } from '@/components/pets/PetHero'

type TFn = (key: string, vars?: Record<string, string | number>) => string

export interface AttentionRow {
  key: string
  petId: number
  kind: CareKind
  state: Extract<CareState, 'overdue' | 'soon'>
  daysLeft: number | null
  title: string
  vaccineName?: string
  vaccineId?: number
}

export type AttentionExclude = { petId: number; kind: CareKind; vaccineId?: number } | null | undefined

const KIND_LABEL: Record<CareKind, string> = {
  vaccines: 'ui.care.vaccines',
  vermifugo: 'ui.care.vermifugo',
  antipulgas: 'ui.care.antipulgas',
}

/** Quantas pendências o "Precisa de atenção" mostra. */
const ATTENTION_MAX = 3
/** Janela de "Esta semana" para o que ainda não venceu. */
const WEEK_DAYS = 7

/**
 * Todas as pendências (vencidas e que vencem em breve) de todos os pets, sem
 * o item que já é a próxima ação do herói. Vencidas antes; depois por prazo.
 * Só a dose mais recente de cada vacina conta.
 */
export function attentionRows(
  summaries: PetCareSummary[],
  vaccines: Vaccine[],
  t: TFn,
  exclude?: AttentionExclude,
): AttentionRow[] {
  const petIds = new Set(summaries.map(s => s.pet.id))
  const rows: AttentionRow[] = []
  for (const v of latestDoses(vaccines)) {
    if (!petIds.has(v.pet_id)) continue
    const state = vaccineState(v)
    if (state !== 'overdue' && state !== 'soon') continue
    rows.push({
      key: `v-${v.id}`,
      petId: v.pet_id,
      kind: 'vaccines',
      state,
      daysLeft: v.next_due ? daysUntil(v.next_due) : null,
      title: v.name,
      vaccineName: v.name,
      vaccineId: v.id,
    })
  }
  for (const s of summaries) {
    for (const item of s.items) {
      if (item.kind === 'vaccines') continue
      if (item.state !== 'overdue' && item.state !== 'soon') continue
      rows.push({
        key: `p-${s.pet.id}-${item.kind}`,
        petId: s.pet.id,
        kind: item.kind,
        state: item.state,
        daysLeft: item.daysLeft,
        title: t(KIND_LABEL[item.kind]),
      })
    }
  }
  return rows
    .filter(r => {
      if (!exclude) return true
      if (exclude.kind === 'vaccines') return !(r.kind === 'vaccines' && r.vaccineId === exclude.vaccineId)
      return !(r.petId === exclude.petId && r.kind === exclude.kind)
    })
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === 'overdue' ? -1 : 1
      return (a.daysLeft ?? 0) - (b.daysLeft ?? 0)
    })
}

/**
 * Divide as pendências entre o "Precisa de atenção" (as 3 mais urgentes) e
 * "Esta semana" (o resto que já venceu ou vence em até 7 dias). Assim nada
 * aparece duas vezes e nada vencido fica de fora da semana.
 */
export function splitCareRows(
  summaries: PetCareSummary[],
  vaccines: Vaccine[],
  t: TFn,
  exclude?: AttentionExclude,
): { attention: AttentionRow[]; week: AttentionRow[] } {
  const all = attentionRows(summaries, vaccines, t, exclude)
  const attention = all.slice(0, ATTENTION_MAX)
  const week = all
    .slice(ATTENTION_MAX)
    .filter(r => r.state === 'overdue' || (r.daysLeft != null && r.daysLeft <= WEEK_DAYS))
  return { attention, week }
}

/**
 * "Precisa de atenção": até 3 pendências de todos os pets — vencidas antes
 * das que vencem em breve. O item que já é a próxima ação do herói fica de
 * fora (sem repetir).
 */
export function AttentionList({
  summaries,
  vaccines,
  exclude,
  onRegister,
}: {
  summaries: PetCareSummary[]
  vaccines: Vaccine[]
  exclude?: AttentionExclude
  onRegister: (petId: number, kind: 'vermifugo' | 'antipulgas') => void
}) {
  const t = useT()
  const byId = new Map(summaries.map(s => [s.pet.id, s.pet]))
  const visible = splitCareRows(summaries, vaccines, t, exclude).attention

  if (visible.length === 0) return null

  return (
    <Section title={t('home.att.title')} action={{ label: t('home.att.seeAll'), href: '/health/vaccines' }} className="mb-5">
      <ul className="space-y-2">
        {visible.map(r => {
          const pet = byId.get(r.petId)
          if (!pet) return null
          return (
            <li key={r.key}>
              <div className={`rounded-2xl border p-3 ${r.state === 'overdue' ? 'tone-danger-bg' : 'tone-warning-bg'}`}>
                <div className="flex items-center gap-3">
                  <PetAvatar pet={pet} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                      {r.title} · {pet.name}
                    </div>
                    <div className="mt-1">
                      <StatusBadge state={r.state}>{careStateLabel(t, r.state, r.daysLeft)}</StatusBadge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2.5">
                  {r.kind === 'vaccines' ? (
                    <>
                      <Button size="sm" variant="secondary" href={vaccineAddHref(r.petId, r.vaccineName)} className="flex-1">
                        {t('home.att.register')}
                      </Button>
                      <Button size="sm" variant="ghost" href={`/health/vaccines/carteirinha/${r.petId}`} className="text-primary-800 dark:text-primary-200">
                        {t('home.att.card')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => onRegister(r.petId, r.kind as 'vermifugo' | 'antipulgas')}
                    >
                      {t('home.att.registerProt')}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

const CARE_ICON: Record<CareKind, LucideIcon> = { vaccines: Syringe, vermifugo: Pill, antipulgas: Bug }
const DAY = 86_400_000

type WeekItem =
  | { type: 'care'; at: number; row: AttentionRow }
  | { type: 'reminder'; at: number; r: Reminder }

/**
 * "Esta semana": o que vence (ou já venceu) e ainda não apareceu acima —
 * cuidados que passaram do limite do "Precisa de atenção" e os lembretes do
 * tutor (inclusive os vencidos). Vazio honesto: se há algo vencido ou que
 * vence em breve mais acima, diz "fora o que aparece acima".
 */
export function WeekList({
  summaries,
  careRows,
  reminders,
  hasAbove,
  newHref,
  onRegister,
}: {
  summaries: PetCareSummary[]
  /** Linhas de cuidado de splitCareRows().week. */
  careRows: AttentionRow[]
  /** GET /reminders/upcoming (com vencidos quando o servidor aceita). */
  reminders: Reminder[]
  /** Há algo vencido ou que vence em breve no herói ou no "Precisa de atenção". */
  hasAbove: boolean
  newHref: string
  onRegister: (petId: number, kind: 'vermifugo' | 'antipulgas') => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const byId = new Map(summaries.map(s => [s.pet.id, s.pet]))
  const [doneIds, setDoneIds] = useState<Set<number>>(() => new Set())
  const [busy, setBusy] = useState<number | null>(null)
  const now = Date.now()
  const horizon = new Date()
  horizon.setHours(23, 59, 59, 999)
  horizon.setDate(horizon.getDate() + WEEK_DAYS)

  const items: WeekItem[] = []
  for (const row of careRows) {
    items.push({ type: 'care', at: now + (row.daysLeft ?? 0) * DAY, row })
  }
  for (const r of reminders) {
    if (r.is_completed || doneIds.has(r.id)) continue
    const d = parseReminderDate(r.due_date)
    const at = d.getTime()
    if (!Number.isFinite(at) || at > horizon.getTime()) continue
    items.push({ type: 'reminder', at, r })
  }
  items.sort((a, b) => a.at - b.at)
  const shown = items.slice(0, 6)

  async function done(r: Reminder) {
    if (busy != null) return
    setBusy(r.id)
    try {
      await remindersApi.complete(r.id)
      haptic('saved')
      setDoneIds(prev => new Set(prev).add(r.id))
      invalidate('reminders:upcoming')
    } catch {
      haptic('error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section title={t('home.rem.title')} action={{ label: t('home2.week.new'), href: newHref }} className="mb-5">
      {shown.length === 0 ? (
        <p className="text-sm text-surface-600 dark:text-surface-400 -mt-1">
          {t(hasAbove ? 'home.rem.emptyOther' : 'home.rem.empty')}
        </p>
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {shown.map(item => {
              if (item.type === 'care') {
                const { row } = item
                const pet = byId.get(row.petId)
                const Icon = CARE_ICON[row.kind]
                const overdue = row.state === 'overdue'
                return (
                  <li key={row.key} className="flex items-center gap-3 pl-4 pr-2 py-2 min-h-[60px]">
                    <span
                      className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                        overdue
                          ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
                      )}
                    >
                      <Icon className="w-[18px] h-[18px]" aria-hidden />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate text-surface-900 dark:text-surface-100">
                        {[row.title, pet?.name].filter(Boolean).join(' · ')}
                      </div>
                      <div className={cn('text-xs font-medium', overdue ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300')}>
                        {careStateLabel(t, row.state, row.daysLeft)}
                      </div>
                    </div>
                    {row.kind === 'vaccines' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        href={vaccineAddHref(row.petId, row.vaccineName)}
                        className="shrink-0 min-h-[44px]"
                        aria-label={t('home2.week.registerAria', { what: row.title, name: pet?.name ?? '' })}
                      >
                        {t('home2.week.register')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="shrink-0 min-h-[44px]"
                        onClick={() => onRegister(row.petId, row.kind as 'vermifugo' | 'antipulgas')}
                        aria-label={t('home2.week.registerAria', { what: row.title, name: pet?.name ?? '' })}
                      >
                        {t('home2.week.register')}
                      </Button>
                    )}
                  </li>
                )
              }
              const { r } = item
              const Icon = reminderKindIcon(r.type)
              const overdue = isReminderOverdue(r)
              const petName = (r.pet_id != null ? byId.get(r.pet_id)?.name : undefined) ?? r.pet?.name
              // Mesmo formato da tela Lembretes: "Hoje, 09:00" · "Amanhã" · "qua., 28 de out."
              const when = formatWhen(parseReminderDate(r.due_date), reminderHasTime(r), locale, t)
              return (
                <li key={`r-${r.id}`} className="flex items-center gap-3 pl-4 pr-2 py-2 min-h-[60px]">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-100 text-primary-700 dark:bg-surface-800 dark:text-primary-300">
                    <Icon className="w-[18px] h-[18px]" aria-hidden />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-surface-900 dark:text-surface-100">{r.title}</div>
                    <div className="flex items-center gap-1.5 min-w-0 text-xs text-surface-600 dark:text-surface-400">
                      {overdue && <StatusBadge state="overdue">{t('ui.care.shortOverdue')}</StatusBadge>}
                      <span className="truncate tabular-nums">{[petName, when].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => done(r)}
                    disabled={busy != null}
                    aria-busy={busy === r.id || undefined}
                    aria-label={t('home2.week.doneAria', { title: r.title })}
                    className="pressable shrink-0 inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-xl text-sm font-semibold text-primary-800 bg-primary-50 hover:bg-primary-100 dark:text-primary-200 dark:bg-primary-500/15 dark:hover:bg-primary-500/25 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Check className="w-4 h-4" aria-hidden strokeWidth={2.6} />}
                    <span>{t('home2.week.done')}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </Section>
  )
}
