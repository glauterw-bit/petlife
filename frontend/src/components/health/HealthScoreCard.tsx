'use client'

import { useEffect, useState } from 'react'
import { Heart, ChevronDown, Syringe, Scale, Footprints, Smile, CalendarCheck, Sparkles } from 'lucide-react'
import { innovations, type HealthScore, type Pet } from '@/lib/api'
import { HealthScoreRing } from './HealthScoreRing'
import { useInView, STATUS_COLORS } from '@/lib/motion'

const DIM_ICON: Record<string, React.ReactNode> = {
  vaccination: <Syringe className="w-4 h-4" />,
  weight: <Scale className="w-4 h-4" />,
  activity: <Footprints className="w-4 h-4" />,
  wellbeing: <Smile className="w-4 h-4" />,
  consistency: <CalendarCheck className="w-4 h-4" />,
}

const TIER_COPY: Record<string, { label: string; emoji: string }> = {
  excelente: { label: 'Saúde excelente', emoji: '🌟' },
  saudavel: { label: 'Saudável', emoji: '💚' },
  atencao: { label: 'Requer atenção', emoji: '⚠️' },
  cuidado: { label: 'Precisa de cuidado', emoji: '🩺' },
}

export function HealthScoreCard({ pet }: { pet: Pet }) {
  const [data, setData] = useState<HealthScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 })

  useEffect(() => {
    let alive = true
    setLoading(true)
    innovations.healthScore(pet.id)
      .then(d => { if (alive) setData(d) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [pet.id])

  if (loading) {
    return (
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
        <div className="flex items-center gap-4">
          <div className="w-40 h-40 rounded-full bg-surface-100 dark:bg-surface-700 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface-100 dark:bg-surface-700 rounded animate-pulse w-2/3" />
            <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const tier = TIER_COPY[data.tier] ?? TIER_COPY.saudavel

  return (
    <div ref={ref} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-4 h-4 text-pink-500" />
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
          Health Score · {data.pet_name}
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        <HealthScoreRing score={data.score} grade={data.grade} startWhen={inView} />

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div className="text-lg font-bold text-surface-900 dark:text-white">
            {tier.emoji} {tier.label}
          </div>
          {/* ação sugerida — o "próximo passo" acionável */}
          <div className="mt-2 flex items-start gap-2 bg-primary-50 dark:bg-primary-950/40 rounded-xl p-3 text-left">
            <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                {data.top_action.label}
              </div>
              <div className="text-xs text-surface-600 dark:text-surface-300">
                {data.top_action.message}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* breakdown expansível */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="mt-4 w-full flex items-center justify-center gap-1 text-xs font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-200 tap-target transition"
      >
        {expanded ? 'Ocultar detalhes' : 'Ver o que compõe o score'}
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 pt-3">
            {data.breakdown.map(dim => {
              const c = STATUS_COLORS[dim.status] ?? STATUS_COLORS.good
              return (
                <div key={dim.key} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.bg} ${c.text}`}>
                    {DIM_ICON[dim.key]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-surface-800 dark:text-surface-200">{dim.label}</span>
                      <span className={`text-xs font-bold tabular-nums ${c.text}`}>{dim.score}</span>
                    </div>
                    <div className="h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{ width: expanded ? `${dim.score}%` : '0%', backgroundColor: c.ring }}
                      />
                    </div>
                    <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5 truncate">{dim.message}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
