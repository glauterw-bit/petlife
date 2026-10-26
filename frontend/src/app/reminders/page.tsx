'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { ScrollHint } from '@/components/ui/ScrollHint'
import { SkeletonRow, FADE_IN } from '@/components/ui/Skeleton'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/ToastContext'
import { ReminderRow, formatWhen } from '@/components/reminders/ReminderRow'
import { ReminderSheet } from '@/components/reminders/ReminderSheet'
import { useLocale } from '@/contexts/LocaleContext'
import { useCached, invalidate } from '@/lib/cache'
import { pets as petsApi, reminders as remindersApi, type Reminder } from '@/lib/api'
import { isReminderOverdue, parseReminderDate, reminderHasTime } from '@/lib/reminders'
import { haptic } from '@/lib/feedback'
import { dur, easeOut, usePrefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

type SectionKey = 'overdue' | 'today' | 'week' | 'later'
const SECTION_ORDER: SectionKey[] = ['overdue', 'today', 'week', 'later']
const SECTION_TITLE: Record<SectionKey, string> = {
  overdue: 'rem.sec.overdue',
  today: 'rem.sec.today',
  week: 'rem.sec.week',
  later: 'rem.sec.later',
}

/** Próxima data de um lembrete que repete (mesma regra do servidor: due + N dias, até repeat_until). */
function nextAfter(r: Reminder): Date | null {
  const n = r.repeat_days ? Math.floor(r.repeat_days) : 0
  if (!n) return null
  const due = parseReminderDate(r.due_date)
  if (!Number.isFinite(due.getTime())) return null
  const next = new Date(due)
  next.setDate(due.getDate() + n)
  if (r.repeat_until) {
    const until = parseReminderDate(r.repeat_until)
    if (Number.isFinite(until.getTime()) && next.getTime() > until.getTime()) return null
  }
  return next
}

/**
 * Lembretes e remédios: tudo o que o tutor marcou, separado em Vencidos,
 * Hoje, Próximos 7 dias e Mais tarde. "Feito"/"Dei" conclui; quando o
 * lembrete repete, o servidor cria a próxima ocorrência.
 */
function RemindersInner() {
  const { t, locale } = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const reduced = usePrefersReducedMotion()

  const remQ = useCached('reminders:all', () => remindersApi.list(), { ttlMs: 15_000 })
  const petsQ = useCached('pets', () => petsApi.list())
  const pets = useMemo(() => petsQ.data ?? [], [petsQ.data])
  const petName = useMemo(() => new Map(pets.map(p => [p.id, p.name])), [pets])

  const qsPet = Number(params.get('pet'))
  const [filter, setFilter] = useState<number | 'all'>(Number.isFinite(qsPet) && qsPet > 0 ? qsPet : 'all')
  const [sheet, setSheet] = useState<{ open: boolean; editing: Reminder | null }>({ open: false, editing: null })
  const [menuFor, setMenuFor] = useState<Reminder | null>(null)
  const openedFromQs = useRef(false)

  // ?new=1 abre a folha na hora (e sai da URL para não reabrir ao voltar).
  useEffect(() => {
    if (openedFromQs.current || params.get('new') !== '1') return
    openedFromQs.current = true
    setSheet({ open: true, editing: null })
    const url = new URL(window.location.href)
    url.searchParams.delete('new')
    router.replace(url.pathname + url.search, { scroll: false })
  }, [params, router])

  // Pet do filtro que não existe mais (ou ainda não carregou) → Todos.
  useEffect(() => {
    if (filter !== 'all' && petsQ.data && !petsQ.data.some(p => p.id === filter)) setFilter('all')
  }, [filter, petsQ.data])

  const sections = useMemo(() => {
    const now = new Date()
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
    const endWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999).getTime()
    const out: Record<SectionKey, Reminder[]> = { overdue: [], today: [], week: [], later: [] }
    const list = (remQ.data ?? [])
      .filter(r => !r.is_completed)
      .filter(r => filter === 'all' || r.pet_id === filter)
      .filter(r => Number.isFinite(parseReminderDate(r.due_date).getTime()))
      .sort((a, b) => parseReminderDate(a.due_date).getTime() - parseReminderDate(b.due_date).getTime())
    for (const r of list) {
      const ts = parseReminderDate(r.due_date).getTime()
      if (isReminderOverdue(r, now)) out.overdue.push(r)
      else if (ts <= endToday) out.today.push(r)
      else if (ts <= endWeek) out.week.push(r)
      else out.later.push(r)
    }
    return out
  }, [remQ.data, filter])

  const total = SECTION_ORDER.reduce((n, k) => n + sections[k].length, 0)
  const anyAtAll = (remQ.data ?? []).some(r => !r.is_completed)

  const refresh = useCallback(async () => {
    invalidate('reminders')
    await remQ.refresh()
  }, [remQ])

  const complete = useCallback(
    async (r: Reminder) => {
      const before = remQ.data
      remQ.mutate(prev => (prev ?? []).map(x => (x.id === r.id ? { ...x, is_completed: true } : x)))
      try {
        const res = await remindersApi.complete(r.id)
        haptic('saved')
        // Só o servidor novo devolve repeat_days: com ele, a próxima ocorrência
        // já foi criada lá. Servidor antigo → só "Concluído" (nunca criamos a
        // próxima pelo app, para não duplicar quando o servidor novo subir).
        const serverRepeats = !!res && typeof res === 'object' && 'repeat_days' in res
        if (serverRepeats && res.repeat_days) {
          const next = nextAfter({ ...r, ...res })
          toast.success(
            next
              ? t('rem.nextToast', { when: formatWhen(next, reminderHasTime(r), locale, t) })
              : t('rem.lastToast'),
          )
        } else {
          toast.success(t('rem.doneToast'))
        }
        invalidate('reminders')
      } catch (e) {
        if (before) remQ.mutate(before)
        haptic('error')
        toast.error(e instanceof Error && e.message ? e.message : t('rem.err'))
      }
    },
    [remQ, toast, t, locale],
  )

  async function remove(r: Reminder) {
    setMenuFor(null)
    const ok = await confirm({
      title: t('rem.deleteTitle'),
      message: t('rem.deleteMsg', { title: r.title }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    })
    if (!ok) return
    const before = remQ.data
    remQ.mutate(prev => (prev ?? []).filter(x => x.id !== r.id))
    try {
      await remindersApi.delete(r.id)
      haptic('destructive')
      toast.success(t('rem.deleted'))
      invalidate('reminders')
    } catch (e) {
      if (before) remQ.mutate(before)
      toast.error(e instanceof Error && e.message ? e.message : t('rem.err'))
    }
  }

  const onSaved = useCallback(
    ({ mode, items, failed }: { mode: 'create' | 'edit'; items: Reminder[]; failed: number }) => {
      setSheet({ open: false, editing: null })
      remQ.mutate(prev => {
        const base = prev ?? []
        if (mode === 'edit') return base.map(x => (items.some(i => i.id === x.id) ? { ...x, ...items.find(i => i.id === x.id) } : x))
        return [...base, ...items]
      })
      if (failed) toast.error(t('rem.err'))
      toast.success(
        mode === 'edit' ? t('rem.updated') : items.length > 1 ? t('rem.savedMany', { n: items.length }) : t('rem.savedOne'),
      )
      invalidate('reminders')
    },
    [remQ, toast, t],
  )

  const openNew = () => setSheet({ open: true, editing: null })
  const filterPetName = filter !== 'all' ? petName.get(filter) : undefined

  const loading = remQ.data === undefined && !remQ.error

  return (
    <DashboardLayout>
      <PageHeader
        title={t('rem.title')}
        subtitle={t('rem.subtitle')}
        actions={<IconButton icon={Plus} label={t('rem.add')} variant="header-primary" onClick={openNew} />}
      />

      <PullToRefresh onRefresh={refresh}>
        {pets.length > 1 && (
          <ScrollHint className="-mx-4 px-4 mb-4">
            <div role="radiogroup" aria-label={t('rem.filterAria')} className="flex gap-2 w-max">
              {([['all', t('rem.filterAll')] as const, ...pets.map(p => [p.id, p.name] as const)]).map(([id, label]) => {
                const on = filter === id
                return (
                  <button
                    key={String(id)}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => { if (!on) { haptic('toggle'); setFilter(id) } }}
                    className={cn(
                      'pressable shrink-0 min-h-[44px] px-4 rounded-full border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      on
                        ? 'bg-surface-900 border-surface-900 text-white dark:bg-white dark:border-white dark:text-surface-900'
                        : 'bg-white border-surface-200 text-surface-700 hover:bg-surface-50 dark:bg-surface-900 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </ScrollHint>
        )}

        {loading ? (
          <div className="space-y-2" aria-hidden>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : remQ.error && !remQ.data ? (
          <div className="text-center py-10">
            <p className="text-sm text-surface-700 dark:text-surface-200 mb-3">{t('rem.loadErr')}</p>
            <Button variant="secondary" onClick={() => void refresh()}>{t('rem.retry')}</Button>
          </div>
        ) : total === 0 ? (
          <div className={FADE_IN}>
            <EmptyState
              mascot="sleeping"
              title={filterPetName && anyAtAll ? t('rem.emptyPet.title', { name: filterPetName }) : t('rem.empty.title')}
              text={t('rem.empty.text')}
              ctaLabel={t('rem.add')}
              onCta={openNew}
            />
          </div>
        ) : (
          <div className={FADE_IN}>
            {SECTION_ORDER.filter(k => sections[k].length).map(k => (
              <section key={k} aria-labelledby={`rem-sec-${k}`} className="mb-6">
                <h2
                  id={`rem-sec-${k}`}
                  className={cn(
                    'flex items-center gap-2 text-base font-bold font-display mb-2',
                    k === 'overdue' ? 'text-red-700 dark:text-red-400' : 'text-surface-900 dark:text-white',
                  )}
                >
                  {t(SECTION_TITLE[k])}
                  <span className="text-sm font-semibold tabular-nums text-surface-500 dark:text-surface-400">{sections[k].length}</span>
                </h2>
                <ul
                  className={cn(
                    'rounded-2xl bg-white dark:bg-surface-900 border divide-y divide-surface-100 dark:divide-surface-800 overflow-hidden',
                    k === 'overdue' ? 'border-red-200 dark:border-red-500/30' : 'border-surface-200/70 dark:border-surface-800',
                  )}
                >
                  <AnimatePresence initial={false}>
                    {sections[k].map(r => (
                      <motion.li
                        key={r.id}
                        layout={reduced ? false : 'position'}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={{ duration: reduced ? 0 : dur.fast, ease: easeOut }}
                      >
                        <ReminderRow
                          reminder={r}
                          petName={pets.length > 1 && r.pet_id ? petName.get(r.pet_id) : undefined}
                          overdue={k === 'overdue'}
                          locale={locale}
                          t={t}
                          onComplete={complete}
                          onMore={setMenuFor}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
          </div>
        )}
      </PullToRefresh>

      <ReminderSheet
        open={sheet.open}
        onClose={() => setSheet(s => ({ ...s, open: false }))}
        pets={pets}
        defaultPetId={filter === 'all' ? null : filter}
        editing={sheet.editing}
        onSaved={onSaved}
      />

      {/* Ações do "…": editar e excluir (sem gesto escondido) */}
      <Sheet open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.title}>
        <div className="space-y-2 pb-2">
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            leftIcon={Pencil}
            onClick={() => {
              const r = menuFor
              setMenuFor(null)
              if (r) setSheet({ open: true, editing: r })
            }}
          >
            {t('common.edit')}
          </Button>
          <Button variant="ghost" size="lg" fullWidth leftIcon={Trash2} className="!text-red-700 dark:!text-red-400" onClick={() => menuFor && void remove(menuFor)}>
            {t('common.delete')}
          </Button>
        </div>
      </Sheet>
    </DashboardLayout>
  )
}

export default function RemindersPage() {
  // useSearchParams exige Suspense no App Router.
  return (
    <Suspense fallback={null}>
      <RemindersInner />
    </Suspense>
  )
}
