'use client'

import { useState, useEffect, useId, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Plus, Loader2, Scale } from 'lucide-react'
import { innovations, type WeightHistory } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useChartTheme, smoothPath, parseRange } from '@/lib/charts'

interface WeightChartProps {
  petId: number
}

// Coordenadas do plot (viewBox fixo → escala proporcional, sem distorcer os pontos)
const VB_W = 320, VB_H = 132, PAD_L = 6, PAD_R = 6, PAD_T = 14, PAD_B = 22

export function WeightChart({ petId }: WeightChartProps) {
  const { success, error } = useToast()
  const { palette, ink } = useChartTheme()
  const [data, setData] = useState<WeightHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId().replace(/:/g, '')
  const cor = palette[0]

  useEffect(() => {
    innovations.weightHistory(petId).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [petId])

  async function addWeight() {
    const w = parseFloat(weightInput.replace(',', '.'))
    if (!w || w <= 0 || w > 200) { error('Peso inválido'); return }
    setAdding(true)
    try {
      await innovations.addWeight(petId, w)
      setData(await innovations.weightHistory(petId))
      setWeightInput('')
      success(`Peso ${w} kg registrado!`)
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally { setAdding(false) }
  }

  const entries = data?.entries ?? []
  const band = parseRange(data?.breed_weight_range)

  // escala y engloba os dados E a faixa da raça, com respiro
  const geom = useMemo(() => {
    if (entries.length === 0) return null
    const ws = entries.map(e => e.weight_kg)
    let lo = Math.min(...ws), hi = Math.max(...ws)
    if (band) { lo = Math.min(lo, band[0]); hi = Math.max(hi, band[1]) }
    const pad = (hi - lo) * 0.15 || 1
    lo -= pad; hi += pad
    const span = hi - lo || 1
    const iw = VB_W - PAD_L - PAD_R, ih = VB_H - PAD_T - PAD_B
    const px = (i: number) => entries.length === 1 ? PAD_L + iw / 2 : PAD_L + (i / (entries.length - 1)) * iw
    const py = (v: number) => PAD_T + ih - ((v - lo) / span) * ih
    const pts = entries.map((e, i) => [px(i), py(e.weight_kg)] as [number, number])
    return { lo, hi, px, py, pts, iw, ih }
  }, [entries, band])

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-surface-400" /></div>
  if (!data) return null

  // tendência (atual vs primeiro registro)
  const trend = entries.length >= 2 ? entries.at(-1)!.weight_kg - entries[0].weight_kg : 0
  const trendPct = entries.length >= 2 && entries[0].weight_kg ? (trend / entries[0].weight_kg) * 100 : 0
  const TrendIcon = Math.abs(trend) < 0.05 ? Minus : trend > 0 ? TrendingUp : TrendingDown
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary-500" /> Peso ao longo do tempo
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {data.current_weight != null && (
              <span className="text-sm text-surface-500 dark:text-surface-400">
                Atual: <strong className="text-surface-900 dark:text-white tabular-nums">{data.current_weight} kg</strong>
              </span>
            )}
            {entries.length >= 2 && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                Math.abs(trend) < 0.05
                  ? 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-300'
                  : trend > 0
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
              }`}>
                <TrendIcon className="w-3 h-3" />
                {trend > 0 ? '+' : ''}{trend.toFixed(1)} kg
                {Math.abs(trendPct) >= 1 && <span className="opacity-70">({trendPct > 0 ? '+' : ''}{trendPct.toFixed(0)}%)</span>}
              </span>
            )}
            {data.breed_weight_range && (
              <span className="text-xs text-surface-400 dark:text-surface-500">faixa da raça: {data.breed_weight_range}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text" inputMode="decimal" placeholder="ex: 12.5" value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addWeight() }}
            className="w-24 px-3 py-2 text-sm border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button onClick={addWeight} disabled={adding || !weightInput}
            className="flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-3 py-2 rounded-xl disabled:opacity-60">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} kg
          </button>
        </div>
      </div>

      {data.alert && (
        <div className={`flex items-center gap-2 rounded-xl p-3 mb-3 text-sm ${
          data.alert.severity === 'alta'
            ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
        }`}>
          {data.alert.type === 'ganho' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{data.alert.message}</span>
        </div>
      )}

      {entries.length === 0 || !geom ? (
        <div className="text-center py-10">
          <Scale className="w-9 h-9 mx-auto text-surface-300 dark:text-surface-600 mb-2" />
          <p className="text-sm text-surface-400">Nenhuma medição ainda.</p>
          <p className="text-xs text-surface-400 mt-0.5">Registre o peso acima para acompanhar a evolução.</p>
        </div>
      ) : (
        <>
          <div className="relative select-none">
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full block" style={{ height: 'auto' }} role="img"
              aria-label={`Evolução de peso: ${entries.length} medições, de ${entries[0].weight_kg} a ${entries.at(-1)!.weight_kg} kg`}>
              <defs>
                <linearGradient id={`area${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={cor} stopOpacity="0.28" />
                  <stop offset="1" stopColor={cor} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* faixa saudável da raça */}
              {band && (
                <g>
                  <rect x={PAD_L} y={geom.py(band[1])} width={geom.iw}
                    height={Math.max(geom.py(band[0]) - geom.py(band[1]), 0)}
                    fill={cor} opacity="0.07" rx="3" />
                  <line x1={PAD_L} x2={VB_W - PAD_R} y1={geom.py(band[1])} y2={geom.py(band[1])}
                    stroke={cor} strokeOpacity="0.25" strokeWidth="0.7" strokeDasharray="3 3" />
                  <line x1={PAD_L} x2={VB_W - PAD_R} y1={geom.py(band[0])} y2={geom.py(band[0])}
                    stroke={cor} strokeOpacity="0.25" strokeWidth="0.7" strokeDasharray="3 3" />
                </g>
              )}

              {/* área + linha */}
              {(() => {
                const line = smoothPath(geom.pts)
                const base = VB_H - PAD_B
                return <>
                  <path d={`${line} L${geom.pts.at(-1)![0]},${base} L${geom.pts[0][0]},${base} Z`} fill={`url(#area${gid})`} />
                  <path d={line} fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                </>
              })()}

              {/* pontos */}
              {geom.pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={hover === i ? 4.5 : 3} fill={cor}
                  stroke="white" strokeWidth={hover === i ? 2 : 0} className="dark:stroke-surface-800"
                  style={{ transition: 'r .12s' }} />
              ))}

              {/* zonas de hover (alvo generoso) */}
              {entries.map((_, i) => {
                const w = geom.iw / Math.max(entries.length, 1)
                return <rect key={i} x={geom.px(i) - w / 2} y={PAD_T} width={w} height={geom.ih}
                  fill="transparent" style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(i)} />
              })}

              {/* eixo Y (máx/min) */}
              <text x={PAD_L} y={PAD_T - 4} fontSize="8.5" fill={ink.axis}>{geom.hi.toFixed(0)} kg</text>
              <text x={PAD_L} y={VB_H - PAD_B + 9} fontSize="8.5" fill={ink.axis}>{geom.lo.toFixed(0)} kg</text>
              {/* eixo X (primeira/última data) */}
              <text x={PAD_L} y={VB_H - 4} fontSize="8.5" fill={ink.axis}>{fmtDate(entries[0].measured_at)}</text>
              {entries.length > 1 && (
                <text x={VB_W - PAD_R} y={VB_H - 4} fontSize="8.5" fill={ink.axis} textAnchor="end">{fmtDate(entries.at(-1)!.measured_at)}</text>
              )}
            </svg>

            {/* tooltip */}
            {hover != null && entries[hover] && (
              <div className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-10 whitespace-nowrap
                bg-surface-900 dark:bg-surface-700 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg"
                style={{ left: `${(geom.px(hover) / VB_W) * 100}%`, top: `${(geom.py(entries[hover].weight_kg) / VB_H) * 100}%`, marginTop: -8 }}>
                <div className="font-bold tabular-nums">{entries[hover].weight_kg} kg</div>
                <div className="opacity-70">{new Date(entries[hover].measured_at).toLocaleDateString('pt-BR')}</div>
                {entries[hover].body_condition_score != null && <div className="opacity-70">ECC {entries[hover].body_condition_score}/9</div>}
              </div>
            )}
          </div>

          <div className="mt-3 max-h-32 overflow-y-auto space-y-1">
            {[...entries].reverse().slice(0, 6).map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs text-surface-600 dark:text-surface-300 py-1 border-b border-surface-100 dark:border-surface-700 last:border-0">
                <span>{new Date(e.measured_at).toLocaleDateString('pt-BR')}</span>
                <span className="font-semibold text-surface-900 dark:text-white tabular-nums">{e.weight_kg} kg</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
