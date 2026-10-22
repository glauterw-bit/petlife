'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Gráficos próprios do CRM, sem biblioteca. Cores por currentColor e classes;
 * cada barra ou ponto tem rótulo acessível e dica no hover/foco.
 */

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number]
const plain = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => setW(Math.max(120, el.clientWidth))
    set()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function Sparkline({ data, width = 80, height = 28, className = '' }: { data: number[]; width?: number; height?: number; className?: string }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const step = width / (data.length - 1)
  const pts = data.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <motion.path d={d} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, ease: easeOut }} />
      <circle cx={last[0]} cy={last[1]} r={2.25} fill="currentColor" />
    </svg>
  )
}

function Tip({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null
  return (
    <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 whitespace-nowrap rounded-md bg-surface-900 px-2 py-1 text-2xs font-medium text-white shadow-crm-pop dark:bg-surface-100 dark:text-surface-900 tabular-nums">
      {children}
    </span>
  )
}

export function BarChart({ data, height = 160, format = plain, className = '', highlightLast }: {
  data: Array<{ label: string; value: number; hint?: string }>; height?: number; format?: (n: number) => string; className?: string; highlightLast?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(0, ...data.map(d => d.value)) || 1
  const every = Math.max(1, Math.ceil(data.length / 8))
  return (
    <div className={className} role="group" aria-label="Gráfico de barras">
      <div className="flex items-end gap-[3px] sm:gap-1" style={{ height }}>
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)
          const active = hover === i
          const hl = highlightLast && i === data.length - 1
          return (
            <div key={`${d.label}-${i}`} className="relative flex-1 h-full flex items-end outline-none group"
              tabIndex={0} aria-label={`${d.label}: ${format(d.value)}${d.hint ? `, ${d.hint}` : ''}`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              <Tip show={active}>{d.label}: {format(d.value)}{d.hint ? ` · ${d.hint}` : ''}</Tip>
              <motion.div
                className={`w-full rounded-t-[3px] origin-bottom transition-colors ${hl || active ? 'bg-primary-500 dark:bg-primary-400' : 'bg-primary-500/35 dark:bg-primary-400/35'} group-focus-visible:ring-2 group-focus-visible:ring-primary-500`}
                style={{ height: `${h}%` }}
                initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                transition={{ duration: 0.28, ease: easeOut, delay: Math.min(i, 30) * 0.008 }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-[3px] sm:gap-1 mt-1.5" aria-hidden>
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-2xs text-muted tabular-nums overflow-visible whitespace-nowrap">
            {i % every === 0 || i === data.length - 1 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export function DualBarChart({ data, labels, height = 160, format = plain }: {
  data: Array<{ label: string; a: number; b: number }>; labels: [string, string]; height?: number; format?: (n: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(0, ...data.map(d => Math.max(d.a, d.b))) || 1
  const every = Math.max(1, Math.ceil(data.length / 8))
  return (
    <div role="group" aria-label={`${labels[0]} e ${labels[1]}`}>
      <div className="flex items-center gap-4 mb-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" />{labels[0]}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 dark:bg-red-400" />{labels[1]}</span>
      </div>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} tabIndex={0} className="relative flex-1 h-full flex items-end gap-px outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm"
            aria-label={`${d.label}: ${labels[0]} ${format(d.a)}, ${labels[1]} ${format(d.b)}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            <Tip show={hover === i}>{d.label} · {labels[0]} {format(d.a)} · {labels[1]} {format(d.b)}</Tip>
            {([['a', 'bg-emerald-500 dark:bg-emerald-400'], ['b', 'bg-red-500 dark:bg-red-400']] as const).map(([k, c]) => {
              const v = d[k]
              return (
                <motion.div key={k} className={`flex-1 rounded-t-[2px] origin-bottom ${c} ${hover === i ? 'opacity-100' : 'opacity-80'}`}
                  style={{ height: `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%` }}
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                  transition={{ duration: 0.28, ease: easeOut, delay: Math.min(i, 30) * 0.008 }} />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1.5" aria-hidden>
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-2xs text-muted tabular-nums whitespace-nowrap">{i % every === 0 || i === data.length - 1 ? d.label : ''}</span>
        ))}
      </div>
    </div>
  )
}

export function HBars({ data, format = plain, max }: { data: Array<{ label: string; value: number; sub?: string }>; format?: (n: number) => string; max?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const top = max ?? (Math.max(0, ...data.map(d => d.value)) || 1)
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={`${d.label}-${i}`} aria-label={`${d.label}: ${format(d.value)} (${Math.round((d.value / total) * 100)}%)`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{d.label}{d.sub && <span className="text-muted text-xs"> · {d.sub}</span>}</span>
            <span className="shrink-0 tabular-nums font-semibold text-ink">{format(d.value)} <span className="text-2xs font-medium text-muted">{Math.round((d.value / total) * 100)}%</span></span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-panel-2 overflow-hidden">
            <motion.div className="h-full rounded-full bg-primary-500 dark:bg-primary-400"
              initial={{ width: 0 }} animate={{ width: `${Math.min(100, (d.value / top) * 100)}%` }}
              transition={{ duration: 0.32, ease: easeOut, delay: Math.min(i, 12) * 0.03 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function LineChart({ points, height = 180, format = plain, xFormat = (x: string) => x }: {
  points: Array<{ x: string; y: number }>; height?: number; format?: (n: number) => string; xFormat?: (x: string) => string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId().replace(/:/g, '')
  if (!points.length) return null
  const padL = 8, padR = 44, padT = 16, padB = 22
  const ys = points.map(p => p.y)
  let min = Math.min(...ys), max = Math.max(...ys)
  if (min === max) { min -= 1; max += 1 }
  const span = max - min
  const iw = Math.max(10, width - padL - padR), ih = height - padT - padB
  const X = (i: number) => padL + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw)
  const Y = (v: number) => padT + ih - ((v - min) / span) * ih
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ')
  const area = `${d} L${X(points.length - 1).toFixed(1)} ${padT + ih} L${X(0).toFixed(1)} ${padT + ih} Z`
  const last = points.length - 1
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 80))))
  return (
    <div ref={ref} className="relative w-full text-primary-500 dark:text-primary-400">
      <svg width={width} height={height} role="img" aria-label={`Gráfico: ${points.map(p => `${xFormat(p.x)} ${format(p.y)}`).join('; ')}`}>
        <defs>
          <linearGradient id={`lg-${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(t => (
          <line key={t} x1={padL} x2={padL + iw} y1={padT + ih * t} y2={padT + ih * t} className="stroke-line" strokeDasharray="2 4" />
        ))}
        {points.length > 1 && <motion.path d={area} fill={`url(#lg-${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.32 }} />}
        {points.length > 1 && <motion.path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, ease: easeOut }} />}
        {points.map((p, i) => (
          <g key={i} tabIndex={0} className="outline-none" aria-label={`${xFormat(p.x)}: ${format(p.y)}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
            <title>{`${xFormat(p.x)}: ${format(p.y)}`}</title>
            <circle cx={X(i)} cy={Y(p.y)} r={12} fill="transparent" />
            <circle cx={X(i)} cy={Y(p.y)} r={i === last || hover === i ? 4.5 : 3} fill={i === last ? 'currentColor' : 'rgb(var(--crm-panel))'} stroke="currentColor" strokeWidth={2} />
          </g>
        ))}
        <text x={X(last) + 8} y={Y(points[last].y) + 4} className="fill-ink text-[11px] font-semibold tabular-nums">{format(points[last].y)}</text>
        {points.map((p, i) => (i % every === 0 || i === last) ? (
          <text key={`x${i}`} x={X(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} className="fill-muted text-[10px] tabular-nums">{xFormat(p.x)}</text>
        ) : null)}
      </svg>
      {hover != null && (
        <span role="tooltip" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-surface-900 px-2 py-1 text-2xs font-medium text-white shadow-crm-pop dark:bg-surface-100 dark:text-surface-900 tabular-nums whitespace-nowrap"
          style={{ left: X(hover), top: Y(points[hover].y) - 10 }}>
          {xFormat(points[hover].x)} · {format(points[hover].y)}
        </span>
      )}
    </div>
  )
}

export function StackBar({ parts, height = 8 }: { parts: Array<{ value: number; className: string; label: string }>; height?: number }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0)
  if (!total) return <div className="w-full rounded-full bg-panel-2" style={{ height }} aria-hidden />
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-panel-2 gap-px" style={{ height }} role="img"
      aria-label={parts.filter(p => p.value > 0).map(p => `${p.label}: ${p.value}`).join(', ')}>
      {parts.filter(p => p.value > 0).map((p, i) => (
        <motion.div key={`${p.label}-${i}`} title={`${p.label}: ${p.value}`} className={`h-full ${p.className}`}
          initial={{ width: 0 }} animate={{ width: `${(p.value / total) * 100}%` }} transition={{ duration: 0.32, ease: easeOut }} />
      ))}
    </div>
  )
}

export function Meter({ value, max, danger, className = '' }: { value: number; max: number; danger?: boolean; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : value > 0 ? 100 : 0
  return (
    <div className={`h-1.5 w-full rounded-full bg-panel-2 overflow-hidden ${className}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <motion.div className={`h-full rounded-full ${danger ? 'bg-red-500 dark:bg-red-400' : 'bg-primary-500 dark:bg-primary-400'}`}
        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.32, ease: easeOut }} />
    </div>
  )
}
