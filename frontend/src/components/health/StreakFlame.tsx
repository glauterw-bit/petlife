'use client'

import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { celebrate } from '@/components/ui/CelebrationOverlay'
import { innovations, type Pet, type CareStreak } from '@/lib/api'
import { useCountUp, usePrefersReducedMotion } from '@/lib/motion'
import { useT } from '@/contexts/LocaleContext'

/**
 * Streak de cuidado com chama animada (estilo Duolingo/Snap).
 * - Chama "viva" (pulsa) quando o usuário cuidou hoje.
 * - Chama apagada/cinza quando ainda não cuidou hoje → gatilho de retorno.
 * - Mostra progresso até o próximo marco (3/7/14/30/60/100).
 */
export function StreakFlame({ pet, refreshKey }: { pet: Pet; refreshKey?: number }) {
  const t = useT()
  const [data, setData] = useState<CareStreak | null>(null)
  const [loading, setLoading] = useState(true)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    let alive = true
    innovations.careStreak(pet.id)
      .then(d => { if (alive) setData(d) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [pet.id, refreshKey])

  const animatedStreak = useCountUp(data?.current_streak ?? 0, { durationMs: 800, startWhen: !!data })

  if (loading) {
    return <div className="h-[88px] rounded-2xl bg-surface-100 dark:bg-surface-700 animate-pulse" />
  }
  if (!data) return null

  const lit = data.did_today && data.current_streak > 0
  // 🔥 celebração de marco (7/30/100) — 1x por marco
  if (typeof window !== 'undefined' && data.current_streak > 0) {
    for (const m of [100, 30, 7]) {
      if (data.current_streak >= m) {
        const key = `petlife_streak_${pet.id}_${m}`
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1')
          setTimeout(() => celebrate({
            title: t('h.streak.celebTitle', { count: m }),
            message: t('h.streak.celebMsg', { name: pet.name, count: data.current_streak }),
            shareText: t('h.streak.celebShare', { count: data.current_streak, name: pet.name }),
            trackEvent: 'recap_share',
            card: {
              title: t('h.streak.cardTitle', { count: data.current_streak }),
              subtitle: t('h.streak.cardSubtitle'),
              emoji: '🔥',
              stats: [
                { label: t('h.streak.statDays'), value: String(data.current_streak) },
                { label: t('h.streak.statDedicated'), value: '🏆' },
              ],
            },
          }), 600)
        }
        break
      }
    }
  }
  const streak = data.current_streak
  // intensidade da chama escala com o streak (cor mais quente conforme cresce)
  const flameColor = !lit
    ? 'text-surface-300 dark:text-surface-600'
    : streak >= 30 ? 'text-orange-500'
    : streak >= 7 ? 'text-amber-500'
    : 'text-amber-400'

  const progressPct = data.next_milestone
    ? Math.min(100, (streak / data.next_milestone) * 100)
    : 100

  return (
    <div className={`rounded-2xl border p-4 transition-colors ${
      lit
        ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-200 dark:border-amber-900'
        : 'bg-white dark:bg-surface-800 border-surface-100 dark:border-surface-700'
    }`}>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Flame
            className={`w-11 h-11 ${flameColor} ${lit && !reduced ? 'animate-flame' : ''}`}
            fill={lit ? 'currentColor' : 'none'}
            strokeWidth={lit ? 1.5 : 2}
          />
          {lit && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-extrabold text-orange-600 dark:text-orange-400 tabular-nums">
              {Math.round(animatedStreak)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-surface-900 dark:text-white">
            {streak === 0
              ? t('h.streak.start')
              : streak === 1
              ? t('h.streak.daysOne', { count: streak })
              : t('h.streak.daysMany', { count: streak })}
          </div>
          <div className="text-xs text-surface-500 dark:text-surface-400">
            {!data.did_today && streak > 0
              ? t('h.streak.keepGoing')
              : data.next_milestone
              ? t('h.streak.toMilestone', { days: data.days_to_milestone ?? 0, milestone: data.next_milestone })
              : t('h.streak.best', { count: data.best_streak })}
          </div>
          {/* barra de progresso até o próximo marco */}
          {data.next_milestone && (
            <div className="h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>

        {data.best_streak > 0 && (
          <div className="text-center shrink-0 px-2">
            <div className="text-xs text-surface-400 uppercase tracking-wide">{t('h.streak.recordLabel')}</div>
            <div className="text-lg font-bold text-surface-700 dark:text-surface-200 tabular-nums">{data.best_streak}</div>
          </div>
        )}
      </div>
    </div>
  )
}
