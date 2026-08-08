'use client'

import { useMemo, useState } from 'react'
import type { RoutePoint } from '@/lib/api'
import { useChartTheme, smoothPath } from '@/lib/charts'
import { haversineMeters } from '@/lib/walk-utils'

const W = 320, H = 96, PAD = 8

/**
 * Ritmo ao longo do passeio (km/h por trecho), suavizado por janela.
 * Dados como beleza: área suave, sem eixo pesado, tooltip por trecho.
 */
export function PaceChart({ points }: { points: RoutePoint[] }) {
  const { palette, ink } = useChartTheme()
  const [hover, setHover] = useState<number | null>(null)

  const speeds = useMemo(() => {
    if (!points || points.length < 4) return []
    const raw: number[] = []
    for (let i = 1; i < points.length; i++) {
      const d = haversineMeters(points[i - 1], points[i])
      const dt = (points[i].ts - points[i - 1].ts) / 1000
      if (dt > 0) raw.push(Math.min((d / dt) * 3.6, 30)) // km/h, clamp anti-ruído GPS
    }
    // suaviza em ~24 buckets com média móvel
    const buckets = Math.min(24, raw.length)
    const size = raw.length / buckets
    const out: number[] = []
    for (let b = 0; b < buckets; b++) {
      const slice = raw.slice(Math.floor(b * size), Math.max(Math.floor((b + 1) * size), Math.floor(b * size) + 1))
      out.push(slice.reduce((a, v) => a + v, 0) / slice.length)
    }
    return out
  }, [points])

  if (speeds.length < 3) return null
  const max = Math.max(...speeds) * 1.15 || 1
  const px = (i: number) => PAD + (i / (speeds.length - 1)) * (W - PAD * 2)
  const py = (v: number) => H - 18 - (v / max) * (H - 30)
  const pts = speeds.map((v, i) => [px(i), py(v)] as [number, number])
  const line = smoothPath(pts)
  const cor = palette[1] // azul — distinto do emerald do mapa

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-bold text-sm text-surface-900 dark:text-white">Ritmo do passeio</h3>
        <span className="text-[11px] text-surface-400">média por trecho · km/h</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
          <defs>
            <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={cor} stopOpacity="0.3" />
              <stop offset="1" stopColor={cor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${pts.at(-1)![0]},${H - 18} L${pts[0][0]},${H - 18} Z`} fill="url(#paceGrad)" />
          <path d={line} fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          {hover != null && (
            <circle cx={px(hover)} cy={py(speeds[hover])} r="4" fill={cor} stroke="white" strokeWidth="2" />
          )}
          {speeds.map((_, i) => (
            <rect key={i} x={px(i) - (W - PAD * 2) / speeds.length / 2} y="0"
              width={(W - PAD * 2) / speeds.length} height={H} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onClick={() => setHover(i)} />
          ))}
          <text x={PAD} y={H - 4} fontSize="8.5" fill={ink.axis}>início</text>
          <text x={W - PAD} y={H - 4} fontSize="8.5" fill={ink.axis} textAnchor="end">fim</text>
        </svg>
        {hover != null && (
          <div className="absolute -translate-x-1/2 -translate-y-full pointer-events-none bg-surface-900 dark:bg-surface-700 text-white text-[11px] rounded-lg px-2 py-1 tabular-nums"
            style={{ left: `${(px(hover) / W) * 100}%`, top: `${(py(speeds[hover]) / H) * 100}%`, marginTop: -6 }}>
            {speeds[hover].toFixed(1)} km/h
          </div>
        )}
      </div>
    </div>
  )
}
