'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Brain, CheckCircle2, Calendar, AlertTriangle, Sparkles, Flag, LifeBuoy } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonHero, SkeletonList } from '@/components/ui/Skeleton'
import { hapticSelect, hapticSuccess } from '@/lib/feedback'
import { cn } from '@/lib/utils'
import { innovations, type BehaviorPlanDetail } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'

/** Rótulos dos valores de intensidade que voltam do backend. */
const INTENSITY_KEY: Record<string, string> = {
  leve: 'g.beh.int.leve',
  moderada: 'g.beh.int.moderada',
  alta: 'g.beh.int.alta',
}

export default function BehaviorPlanPage() {
  const t = useT()
  const params = useParams()
  const { success, error } = useToast()
  const planId = Number(params.planId)
  const [plan, setPlan] = useState<BehaviorPlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState<number | null>(null)

  useEffect(() => {
    innovations.getBehaviorPlan(planId)
      .then(setPlan)
      .catch(() => error(t('g.beh.errLoad')))
      .finally(() => setLoading(false))
  }, [planId, error])

  async function checkIn(day: number, score: number) {
    setCheckingIn(day)
    try {
      void hapticSelect()
      await innovations.behaviorCheckIn(planId, day, score)
      const updated = await innovations.getBehaviorPlan(planId)
      setPlan(updated)
      void hapticSuccess()
      success(t('g.beh.checkinSaved', { day }))
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.misc.error'))
    } finally {
      setCheckingIn(null)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title={t('g.beh.title')} back large={false} />
        <div className="space-y-4"><SkeletonHero /><SkeletonList count={2} /></div>
      </>
    )
  }
  if (!plan) {
    return (
      <>
        <PageHeader title={t('g.beh.title')} back large={false} />
        <EmptyState icon={Brain} title={t('g.beh.notFound')} ctaLabel={t('nav.back')} ctaHref="/behavior" />
      </>
    )
  }

  const completedDays = new Set(plan.check_ins.map(c => c.day_number))
  const data = plan.plan_data

  return (
    <>
      <PageHeader title={data.issue_label} back="/behavior" large={false} />

      <div className="bg-gradient-to-br from-violet-700 to-indigo-800 text-white rounded-3xl p-6 mb-6 shadow-float">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-7 h-7" aria-hidden />
          <span className="text-xs uppercase tracking-widest text-white/85 font-semibold">{t('g.beh.badge')}</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">{data.issue_label}</h1>
        <p className="text-sm text-white/90 leading-relaxed">{data.summary}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-xs text-white/90">
          <span>{t('g.beh.petLabel')} <strong>{plan.pet_name}</strong></span>
          <span>{t('g.beh.intensity')} <strong className="capitalize">{INTENSITY_KEY[plan.intensity] ? t(INTENSITY_KEY[plan.intensity]) : plan.intensity}</strong></span>
          <span>{t('g.beh.daysCount', { done: completedDays.size, total: plan.duration_weeks * 7 })}</span>
        </div>
      </div>

      {data.core_principles?.length > 0 && (
        <Card padding="lg" className="mb-4">
          <h3 className="font-display font-bold text-surface-900 dark:text-white mb-3">{t('g.beh.principles')}</h3>
          <ul className="space-y-1.5">
            {data.core_principles.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-200">
                <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-300 shrink-0 mt-0.5" aria-hidden /><span>{p}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.weeks?.map((w) => (
        <Card key={w.week} padding="lg" className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-violet-600 dark:text-violet-300" aria-hidden />
            <h3 className="font-display font-bold text-surface-900 dark:text-white">{t('g.beh.week', { n: w.week })}</h3>
          </div>
          <p className="text-sm text-surface-600 dark:text-surface-300 italic mb-3">{w.focus}</p>
          <div className="space-y-2">
            {w.daily_exercises?.map(ex => {
              const dayNum = (w.week - 1) * 7 + ex.day
              const done = completedDays.has(dayNum)
              return (
                <div
                  key={dayNum}
                  className={`p-3 rounded-xl border transition ${
                    done
                      ? 'tone-success-bg'
                      : 'border-surface-200 dark:border-surface-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-violet-700 dark:text-violet-300">{t('g.beh.day', { n: dayNum })}</span>
                        <span className="text-xs text-surface-500 dark:text-surface-400">{t('g.misc.min', { n: ex.duration_min })}</span>
                        {done && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-label={t('g.beh.status.completed')} />}
                      </div>
                      <p className="font-semibold text-sm text-surface-900 dark:text-white">{ex.title}</p>
                      <p className="text-xs text-surface-600 dark:text-surface-300 mt-1 leading-relaxed">{ex.description}</p>
                    </div>
                  </div>
                  {!done && plan.status === 'active' && (
                    <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
                      <p id={`how-${dayNum}`} className="text-xs text-surface-600 dark:text-surface-400 mb-2">{t('g.beh.howToday')}</p>
                      <div role="group" aria-labelledby={`how-${dayNum}`} className="flex gap-1.5 flex-wrap">
                        {[0,1,2,3,4,5,6,7,8,9,10].map(s => (
                          <button
                            key={s}
                            onClick={() => checkIn(dayNum, s)}
                            disabled={checkingIn === dayNum}
                            className={cn(
                              'pressable min-w-[44px] h-11 rounded-xl text-sm font-bold tabular-nums transition-colors disabled:opacity-50',
                              s >= 7
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 dark:text-emerald-300'
                                : s >= 4
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:text-amber-300'
                                  : 'bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-500/15 dark:hover:bg-red-500/25 dark:text-red-300',
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {w.milestone && (
            <div className="mt-3 p-3 bg-violet-50 dark:bg-violet-500/10 rounded-xl flex items-start gap-2">
              <Flag className="w-4 h-4 mt-0.5 text-violet-700 dark:text-violet-300 shrink-0" aria-hidden />
              <div>
                <p className="text-xs text-violet-700 dark:text-violet-300 font-semibold uppercase tracking-wide mb-0.5">{t('g.beh.milestone')}</p>
                <p className="text-sm text-violet-950 dark:text-violet-100">{w.milestone}</p>
              </div>
            </div>
          )}
        </Card>
      ))}

      {data.warning_signs?.length > 0 && (
        <div className="tone-warning-bg border rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-300" aria-hidden />
            <h3 className="font-bold text-amber-900 dark:text-amber-200">{t('g.beh.warningSigns')}</h3>
          </div>
          <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-100">
            {data.warning_signs.map((w, i) => <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{w}</span></li>)}
          </ul>
        </div>
      )}

      {data.when_to_seek_help && (
        <div className="tone-danger-bg border rounded-2xl p-5 mb-4">
          <h3 className="font-bold text-red-900 dark:text-red-200 mb-2 flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-red-700 dark:text-red-300" aria-hidden />
            {t('g.beh.whenSeekHelp')}
          </h3>
          <p className="text-sm text-red-800 dark:text-red-100">{data.when_to_seek_help}</p>
        </div>
      )}

      {data.disclaimer && (
        <p className="text-xs text-surface-500 dark:text-surface-400 italic text-center mb-8">
          <Sparkles className="w-3 h-3 inline mr-1" aria-hidden />
          {data.disclaimer}
        </p>
      )}
    </>
  )
}
