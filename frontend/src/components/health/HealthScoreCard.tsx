'use client'

import { useEffect, useState } from 'react'
import { Heart, ChevronDown, Syringe, Scale, Footprints, Smile, CalendarCheck, Sparkles } from 'lucide-react'
import { innovations, type HealthScore, type Pet } from '@/lib/api'
import { HealthScoreRing } from './HealthScoreRing'
import { useInView, STATUS_COLORS, scoreColor } from '@/lib/motion'

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
      <div className="bg-white dark:bg-surface-800 rounded-3xl border border-surface-100 dark:border-surface-700 p-5">
        <div className="flex items-center gap-4">
          <div className="w-32 h-32 rounded-full bg-surface-100 dark:bg-surface-700 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface-100 dark:bg-surface-700 rounded animate-pulse w-2/3" />
            <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded animate-pulse w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-surface-100 dark:bg-surface-700 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const tier = TIER_COPY[data.tier] ?? TIER_COPY.saudavel
  const color = scoreColor(data.score)

  return (
    <div
      ref={ref}
      className="relative rounded-3xl border border-surface-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5 overflow-hidden"
    >
      {/* brilho suave na cor do score — dá vida ao card */}
      <div
        className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full blur-3xl opacity-[0.14]"
        style={{ background: color }}
        aria-hidden
      />

      {/* header + badge do tier */}
      <div className="relative flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center shrink-0">
            <Heart className="w-4 h-4 text-pink-500" />
          </span>
          <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-200 truncate">
            Saúde do {data.pet_name}
          </h2>
        </div>
        <span
          className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ color, background: `${color}1f` }}
        >
          {tier.emoji} {tier.label}
        </span>
      </div>

      {/* herói: anel + próximo passo */}
      <div className="relative flex items-center gap-4">
        <div className="shrink-0">
          <HealthScoreRing score={data.score} grade={data.grade} startWhen={inView} size={132} stroke={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl p-3.5" style={{ background: `${color}14` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                Próximo passo
              </span>
            </div>
            <div className="text-sm font-bold text-surface-900 dark:text-white leading-snug">
              {data.top_action.label}
            </div>
            <div className="text-xs text-surface-600 dark:text-surface-300 mt-0.5 leading-snug line-clamp-2">
              {data.top_action.message}
            </div>
          </div>
        </div>
      </div>

      {/* faixa das 5 dimensões — sempre visível, "num olhar" */}
      <div className="relative grid grid-cols-5 gap-1 mt-4">
        {data.breakdown.map(dim => {
          const c = STATUS_COLORS[dim.status] ?? STATUS_COLORS.good
          return (
            <button
              key={dim.key}
              onClick={() => setExpanded(true)}
              className="pressable flex flex-col items-center gap-1 rounded-2xl py-2 px-0.5 hover:bg-surface-50 dark:hover:bg-surface-700/40 transition"
            >
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: `${c.ring}24`, color: c.ring }}
              >
                {DIM_ICON[dim.key]}
              </span>
              <span className="text-xs font-bold tabular-nums leading-none" style={{ color: c.ring }}>
                {dim.score}
              </span>
              <span className="text-[9px] text-surface-500 dark:text-surface-400 leading-tight text-center w-full truncate">
                {dim.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* detalhes expansíveis */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="mt-3 w-full flex items-center justify-center gap-1 text-xs font-medium text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 tap-target transition"
      >
        {expanded ? 'Ocultar detalhes' : 'Ver o que compõe o score'}
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="space-y-2.5 pt-3">
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
                    <div className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">{dim.message}</div>
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
