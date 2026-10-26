'use client'

/**
 * Anel de proteção: 3 arcos (vacinas, vermífugo, antipulgas) ao redor da foto
 * do pet. Cor + texto acessível (aria-label) — nunca só cor. Os arcos se
 * desenham ao aparecer; `pulseKind` faz um arco "crescer" quando um registro
 * acabou de ser feito (com vibração de sucesso).
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { usePrefersReducedMotion, spring } from '@/lib/motion'
import { hapticSuccess } from '@/lib/feedback'
import type { CareKind, CareState, PetCareSummary } from '@/lib/care'
import { PetAvatar } from './PetAvatar'
import { careStateLabel } from './StatusBadge'

const STROKE: Record<CareState, string> = {
  ok: 'stroke-emerald-500',
  soon: 'stroke-amber-500',
  overdue: 'stroke-red-500',
  never: 'stroke-surface-300 dark:stroke-surface-600',
}

const KIND_LABEL: Record<CareKind, string> = {
  vaccines: 'ui.care.vaccines',
  vermifugo: 'ui.care.vermifugo',
  antipulgas: 'ui.care.antipulgas',
}

const GAP_DEG = 6

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const a = polar(cx, cy, r, start)
  const b = polar(cx, cy, r, end)
  const large = end - start > 180 ? 1 : 0
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

/** Helper para telas: `const ring = useRingCelebrate(); ring.celebrate('vaccines')` e passe `pulseKind={ring.pulseKind}`. */
export function useRingCelebrate(): { pulseKind: CareKind | undefined; celebrate: (k: CareKind) => void } {
  const [pulseKind, setPulseKind] = useState<CareKind | undefined>()
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const celebrate = useCallback((k: CareKind) => {
    setPulseKind(undefined)
    requestAnimationFrame(() => setPulseKind(k))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPulseKind(undefined), 1200)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { pulseKind, celebrate }
}

export function ProtectionRing({
  summary,
  size = 132,
  animate = true,
  onSegmentClick,
  pulseKind,
  children,
}: {
  summary: PetCareSummary
  size?: number
  animate?: boolean
  onSegmentClick?: (kind: CareKind) => void
  pulseKind?: CareKind
  children?: ReactNode
}) {
  const t = useT()
  const reduced = usePrefersReducedMotion()
  const draw = animate && !reduced
  const stroke = Math.max(5, Math.round(size * 0.055))
  const r = (size - stroke) / 2 - 1
  const c = size / 2
  const inner = Math.round(size - 2 * (stroke + Math.max(5, size * 0.045)))

  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!pulseKind) return
    setNonce(n => n + 1)
    void hapticSuccess()
  }, [pulseKind])

  const parts = summary.items.map(i => `${t(KIND_LABEL[i.kind])}: ${careStateLabel(t, i.state, i.daysLeft).toLowerCase()}`)
  const aria = t('ui.care.ringAria', { name: summary.pet.name, summary: parts.join('; ') })

  function onKey(e: KeyboardEvent, kind: CareKind) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSegmentClick?.(kind)
    }
  }

  return (
    <div
      role={onSegmentClick ? 'group' : 'img'}
      aria-label={aria}
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 overflow-visible" aria-hidden={!onSegmentClick}>
        {summary.items.map((item, i) => {
          const start = i * 120 + GAP_DEG / 2
          const end = (i + 1) * 120 - GAP_DEG / 2
          const d = arcPath(c, c, r, start, end)
          const pulsing = pulseKind === item.kind
          const isNever = item.state === 'never'
          const common = {
            d,
            fill: 'none',
            strokeWidth: stroke,
            strokeLinecap: 'round' as const,
            className: STROKE[item.state],
          }
          return (
            <g
              key={item.kind}
              role={onSegmentClick ? 'button' : undefined}
              tabIndex={onSegmentClick ? 0 : undefined}
              aria-label={onSegmentClick ? parts[i] : undefined}
              onClick={onSegmentClick ? () => onSegmentClick(item.kind) : undefined}
              onKeyDown={onSegmentClick ? e => onKey(e, item.kind) : undefined}
              className={onSegmentClick ? 'cursor-pointer outline-none focus-visible:opacity-80' : undefined}
            >
              {/* trilho suave por baixo — a forma do anel aparece mesmo antes de desenhar */}
              <path d={d} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-surface-200/70 dark:stroke-surface-800" />
              {isNever ? (
                <motion.path
                  {...common}
                  strokeDasharray={`${stroke * 0.2} ${stroke * 1.6}`}
                  initial={draw ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: draw ? i * 0.08 : 0 }}
                />
              ) : (
                <motion.path
                  key={pulsing ? `p-${nonce}` : 'static'}
                  {...common}
                  initial={draw || pulsing ? { pathLength: 0 } : false}
                  animate={pulsing && !reduced ? { pathLength: 1, strokeWidth: [stroke, stroke * 1.6, stroke] } : { pathLength: 1 }}
                  transition={
                    pulsing
                      ? { pathLength: spring.soft, strokeWidth: { duration: 0.4, times: [0, 0.5, 1] } }
                      : { ...spring.soft, delay: draw ? i * 0.08 : 0 }
                  }
                />
              )}
              {/* área de toque mais larga (invisível) */}
              {onSegmentClick && <path d={d} fill="none" strokeWidth={stroke + 16} stroke="transparent" />}
            </g>
          )
        })}
      </svg>
      <div className={cn('relative')} style={{ width: inner, height: inner }}>
        {children ?? <PetAvatar pet={summary.pet} size={inner} priority />}
      </div>
    </div>
  )
}
