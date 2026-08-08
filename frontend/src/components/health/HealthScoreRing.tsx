'use client'

import { useCountUp, usePrefersReducedMotion, scoreColor } from '@/lib/motion'

interface Props {
  score: number
  grade: string
  size?: number
  stroke?: number
  startWhen?: boolean
}

/**
 * Anel circular animado do Health Score (estilo Apple Watch).
 * O arco "desenha" até o valor e o número conta de 0 ao score.
 */
export function HealthScoreRing({ score, grade, size = 160, stroke = 14, startWhen = true }: Props) {
  const reduced = usePrefersReducedMotion()
  const animated = useCountUp(score, { durationMs: 1100, startWhen })
  const color = scoreColor(score)

  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const shown = reduced ? score : animated
  const offset = circumference - (shown / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* trilha de fundo */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-surface-100 dark:text-surface-700"
        />
        {/* arco do score — com brilho suave da própria cor */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: reduced ? 'none' : 'stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1)',
            filter: reduced ? 'none' : `drop-shadow(0 0 5px ${color}59)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold tabular-nums text-surface-900 dark:text-white leading-none">
          {Math.round(shown)}
        </span>
        <span className="text-xs font-semibold mt-0.5" style={{ color }}>
          {grade}
        </span>
      </div>
    </div>
  )
}
