'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Brain, CheckCircle, Calendar, AlertTriangle, Sparkles } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/ui/LoadingSpinner'
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
  const router = useRouter()
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
      await innovations.behaviorCheckIn(planId, day, score)
      const updated = await innovations.getBehaviorPlan(planId)
      setPlan(updated)
      success(t('g.beh.checkinSaved', { day }))
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.misc.error'))
    } finally {
      setCheckingIn(null)
    }
  }

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>
  if (!plan) return <DashboardLayout><div className="text-center py-20">{t('g.beh.notFound')}</div></DashboardLayout>

  const completedDays = new Set(plan.check_ins.map(c => c.day_number))
  const data = plan.plan_data

  return (
    <DashboardLayout>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-surface-600 dark:text-surface-300 hover:text-surface-900 mb-4">
        <ArrowLeft className="w-4 h-4" /> {t('nav.back')}
      </button>

      <div className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white rounded-3xl p-6 mb-6 shadow-xl shadow-purple-500/30">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-7 h-7" />
          <span className="text-xs uppercase tracking-widest opacity-80 font-semibold">{t('g.beh.badge')}</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">{data.issue_label}</h1>
        <p className="text-sm opacity-90 leading-relaxed">{data.summary}</p>
        <div className="flex items-center gap-4 mt-4 text-xs">
          <span>{t('g.beh.petLabel')} <strong>{plan.pet_name}</strong></span>
          <span>{t('g.beh.intensity')} <strong className="capitalize">{INTENSITY_KEY[plan.intensity] ? t(INTENSITY_KEY[plan.intensity]) : plan.intensity}</strong></span>
          <span>{t('g.beh.daysCount', { done: completedDays.size, total: plan.duration_weeks * 7 })}</span>
        </div>
      </div>

      {data.core_principles?.length > 0 && (
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5 mb-4">
          <h3 className="font-bold text-surface-900 dark:text-white mb-3">{t('g.beh.principles')}</h3>
          <ul className="space-y-1.5">
            {data.core_principles.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-200">
                <CheckCircle className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" /><span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.weeks?.map((w) => (
        <div key={w.week} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-surface-900 dark:text-white">{t('g.beh.week', { n: w.week })}</h3>
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
                      ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-surface-200 dark:border-surface-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-300">{t('g.beh.day', { n: dayNum })}</span>
                        <span className="text-xs text-surface-500 dark:text-surface-400">{t('g.misc.min', { n: ex.duration_min })}</span>
                        {done && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      </div>
                      <p className="font-semibold text-sm text-surface-900 dark:text-white">{ex.title}</p>
                      <p className="text-xs text-surface-600 dark:text-surface-300 mt-1 leading-relaxed">{ex.description}</p>
                    </div>
                  </div>
                  {!done && plan.status === 'active' && (
                    <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
                      <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">{t('g.beh.howToday')}</p>
                      <div className="flex gap-1 flex-wrap">
                        {[0,1,2,3,4,5,6,7,8,9,10].map(s => (
                          <button
                            key={s}
                            onClick={() => checkIn(dayNum, s)}
                            disabled={checkingIn === dayNum}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                              s >= 7 ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700' :
                              s >= 4 ? 'bg-amber-100 hover:bg-amber-200 text-amber-700' :
                              'bg-red-100 hover:bg-red-200 text-red-700'
                            } disabled:opacity-50`}
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
            <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
              <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold uppercase tracking-wide mb-0.5">{t('g.beh.milestone')}</p>
              <p className="text-sm text-purple-900 dark:text-purple-100">{w.milestone}</p>
            </div>
          )}
        </div>
      ))}

      {data.warning_signs?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-amber-900 dark:text-amber-200">{t('g.beh.warningSigns')}</h3>
          </div>
          <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-100">
            {data.warning_signs.map((w, i) => <li key={i}>• {w}</li>)}
          </ul>
        </div>
      )}

      {data.when_to_seek_help && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-2xl p-5 mb-4">
          <h3 className="font-bold text-red-900 dark:text-red-200 mb-2">{t('g.beh.whenSeekHelp')}</h3>
          <p className="text-sm text-red-800 dark:text-red-100">{data.when_to_seek_help}</p>
        </div>
      )}

      {data.disclaimer && (
        <p className="text-xs text-surface-500 dark:text-surface-400 italic text-center mb-8">
          <Sparkles className="w-3 h-3 inline mr-1" />
          {data.disclaimer}
        </p>
      )}
    </DashboardLayout>
  )
}
