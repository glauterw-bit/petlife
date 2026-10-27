'use client'

/**
 * Anel de proteção: 3 arcos (vacinas, vermífugo, antipulgas) ao redor da foto
 * do pet. Cor + texto acessível (aria-label) — nunca só cor. Os arcos se
 * desenham ao aparecer; `pulseKind` faz um arco "crescer" quando um registro
 * acabou de ser feito (com vibração de sucesso).
 *
 * `showLegend` mostra abaixo do anel o que cada arco significa (bolinha +
 * nome + estado por extenso). Sem `onSegmentClick`, tocar no centro alterna
 * a legenda — exceto quando o anel está dentro de um link (o toque navega).
 *
 * Acessibilidade: o desenho é uma imagem só (role="img" + aria-label com os 3
 * estados). Os arcos não recebem foco — quem dá acesso por teclado são as
 * linhas de cuidado abaixo do anel, sem paradas de Tab duplicadas.
 * Toque: cada arco tem uma faixa invisível larga (≥ 32 px) que aceita o dedo.
 *
 * "Anel completo": quando, com o mesmo pet montado, o último item pendente
 * fica em dia, um brilho percorre o anel (600 ms) com vibração de marco.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { usePrefersReducedMotion, spring } from '@/lib/motion'
import { haptic } from '@/lib/feedback'
import type { CareKind, CareState, PetCareSummary } from '@/lib/care'
import { PetAvatar } from './PetAvatar'
import { careStateLabel } from './StatusBadge'

const STROKE: Record<CareState, string> = {
  ok: 'stroke-emerald-500',
  soon: 'stroke-amber-500',
  overdue: 'stroke-red-500',
  never: 'stroke-surface-200 dark:stroke-surface-700',
}

const KIND_LABEL: Record<CareKind, string> = {
  vaccines: 'ui.care.vaccines',
  vermifugo: 'ui.care.vermifugo',
  antipulgas: 'ui.care.antipulgas',
}

const DOT: Record<CareState, string> = {
  ok: 'bg-emerald-500',
  soon: 'bg-amber-500',
  overdue: 'bg-red-500',
  never: 'border-2 border-surface-400 dark:border-surface-500',
}

/** Espaço entre os arcos — 10° deixa claro que são 3 coisas, não uma barra. */
const GAP_DEG = 10

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
  showLegend = false,
  onComplete,
  children,
}: {
  summary: PetCareSummary
  size?: number
  animate?: boolean
  onSegmentClick?: (kind: CareKind) => void
  pulseKind?: CareKind
  /** Legenda abaixo do anel (estado inicial; tocar no centro alterna). */
  showLegend?: boolean
  /** Chamado no momento "anel completo" (para a tela anunciar por texto). */
  onComplete?: () => void
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
    // Vibra no pico do crescimento do arco, não no toque.
    const id = setTimeout(() => haptic('saved'), 180)
    return () => clearTimeout(id)
  }, [pulseKind])

  // ── Momento "anel completo" ──
  const stateKey = summary.items.map(i => i.state).join('|')
  const prevRef = useRef<{ petId: number; key: string } | null>(null)
  const [complete, setComplete] = useState(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { petId: summary.pet.id, key: stateKey }
    if (!prev || prev.petId !== summary.pet.id) return // nunca na 1ª renderização nem ao trocar de pet
    const wasIncomplete = prev.key.split('|').some(s => s !== 'ok')
    const nowComplete = summary.items.every(i => i.state === 'ok')
    if (!wasIncomplete || !nowComplete) return
    setComplete(n => n + 1)
    const id = setTimeout(() => haptic('milestone'), 120)
    onCompleteRef.current?.()
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey, summary.pet.id])
  const [haloOn, setHaloOn] = useState(false)
  useEffect(() => {
    if (!complete) return
    setHaloOn(true)
    const id = setTimeout(() => setHaloOn(false), 600)
    return () => clearTimeout(id)
  }, [complete])

  const [legend, setLegend] = useState(showLegend)
  useEffect(() => setLegend(showLegend), [showLegend])
  const canToggle = !onSegmentClick
  // Dentro de um link o toque navega; só fora dele o centro vira botão.
  const centerRef = useRef<HTMLDivElement>(null)
  const [inLink, setInLink] = useState(true)
  useEffect(() => {
    setInLink(!!centerRef.current?.closest('a'))
  }, [])
  const centerIsButton = canToggle && !inLink

  function onCenterClick(e: MouseEvent<HTMLDivElement>) {
    if (!canToggle) return
    const target = e.target as HTMLElement
    // Botão dentro do centro (ex.: câmera da foto) ou anel dentro de link: não é nosso toque.
    const interactive = target.closest('button, a, input, label, [role="button"]')
    if (interactive && interactive !== e.currentTarget) return
    if (e.currentTarget.closest('a')) return
    haptic('toggle')
    setLegend(v => !v)
  }

  function onCenterKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      haptic('toggle')
      setLegend(v => !v)
    }
  }

  const legendId = `ring-legend-${summary.pet.id}`
  const parts = summary.items.map(i => `${t(KIND_LABEL[i.kind])}: ${careStateLabel(t, i.state, i.daysLeft).toLowerCase()}`)
  const aria = t('ui.care.ringAria', { name: summary.pet.name, summary: parts.join('; ') })

  const plainImg = !centerIsButton && !children
  const circ = 2 * Math.PI * r
  const hitWidth = Math.max(32, stroke * 3)
  const plusSize = Math.max(12, Math.min(14, Math.round(size * 0.1)))

  const ringEl = (
    <div
      // Sem filhos interativos, o próprio contêiner é a imagem. Com centro
      // interativo (botão da legenda, câmera da foto), a imagem vira um irmão
      // — role="img" esconderia esses botões do VoiceOver.
      role={plainImg ? 'img' : undefined}
      aria-label={plainImg ? aria : undefined}
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {!plainImg && <span role="img" aria-label={aria} className="absolute inset-0 rounded-full pointer-events-none" />}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 overflow-visible" aria-hidden>
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
            <g key={item.kind} aria-hidden>
              {/* trilho suave por baixo — a forma do anel aparece mesmo antes de desenhar */}
              {!isNever && (
                <path d={d} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-surface-200/70 dark:stroke-surface-800" />
              )}
              {isNever ? (
                <m.path
                  {...common}
                  initial={draw ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: draw ? i * 0.08 : 0 }}
                />
              ) : (
                <m.path
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
              {/* "+" no meio do arco sem registro: convida a registrar */}
              {isNever && onSegmentClick && (() => {
                const m = polar(c, c, r, (start + end) / 2)
                const h = plusSize / 2
                return (
                  <path
                    d={`M ${m.x - h} ${m.y} H ${m.x + h} M ${m.x} ${m.y - h} V ${m.y + h}`}
                    fill="none"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    className="stroke-surface-500 dark:stroke-surface-400 pointer-events-none"
                  />
                )
              })()}
              {/* área de toque larga (invisível): o dedo não precisa acertar o traço fino */}
              {onSegmentClick && (
                <path
                  d={d}
                  fill="none"
                  strokeWidth={hitWidth}
                  stroke="transparent"
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={e => {
                    e.stopPropagation()
                    onSegmentClick(item.kind)
                  }}
                />
              )}
            </g>
          )
        })}
        {/* brilho do "anel completo" */}
        {complete > 0 && haloOn && (
          reduced ? (
            <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke + 4} className="stroke-emerald-300/70 dark:stroke-emerald-400/60" />
          ) : (
            <m.circle
              key={`glow-${complete}`}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              strokeWidth={stroke + 2}
              strokeLinecap="round"
              transform={`rotate(-90 ${c} ${c})`}
              className="stroke-emerald-200 dark:stroke-emerald-300"
              strokeDasharray={`${circ * 0.18} ${circ}`}
              initial={{ strokeDashoffset: circ * 0.18, opacity: 0 }}
              animate={{ strokeDashoffset: -circ, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1], opacity: { duration: 0.6, times: [0, 0.15, 0.75, 1] } }}
            />
          )
        )}
      </svg>
      <div
        ref={centerRef}
        className={cn('relative rounded-full', centerIsButton && 'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-500')}
        style={{ width: inner, height: inner }}
        onClick={canToggle ? onCenterClick : undefined}
        onKeyDown={centerIsButton ? onCenterKey : undefined}
        role={centerIsButton ? 'button' : undefined}
        tabIndex={centerIsButton ? 0 : undefined}
        aria-label={centerIsButton ? t('ui2.ring.legendToggle') : undefined}
        aria-expanded={centerIsButton ? legend : undefined}
        aria-controls={centerIsButton && legend ? legendId : undefined}
      >
        {children ?? <PetAvatar pet={summary.pet} size={inner} priority />}
      </div>
    </div>
  )

  if (!canToggle && !legend) return ringEl

  return (
    <div className="inline-flex flex-col items-center shrink-0">
      {ringEl}
      <AnimatePresence initial={false}>
        {legend && (
          <m.ul
            id={legendId}
            key="legend"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="mt-3 space-y-1"
          >
            {summary.items.map(item => (
              <li key={item.kind} className="flex items-center gap-2 text-[12px] leading-tight whitespace-nowrap">
                <span aria-hidden className={cn('w-2.5 h-2.5 rounded-full shrink-0', DOT[item.state])} />
                <span className="font-semibold text-surface-800 dark:text-surface-100">{t(KIND_LABEL[item.kind])}</span>
                <span className="text-surface-600 dark:text-surface-300">{careStateLabel(t, item.state, item.daysLeft)}</span>
              </li>
            ))}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
