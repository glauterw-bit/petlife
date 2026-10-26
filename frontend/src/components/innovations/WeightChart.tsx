'use client'

import { useState, useEffect, useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn, localeTag } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, Plus, Loader2, Scale } from 'lucide-react'
import { innovations, type WeightHistory } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useChartTheme, smoothPath } from '@/lib/charts'
import { useT } from '@/contexts/LocaleContext'
import { parseWeightKg } from '@/lib/weight'
import { haptic, hapticError } from '@/lib/feedback'
import { invalidate } from '@/lib/cache'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'

interface WeightChartProps {
  petId: number
}

type Entry = WeightHistory['entries'][number]
type DayEntry = Entry & { ts: number; dayKey: string }

/**
 * Aviso de peso calculado no app (o texto do servidor é ignorado: vinha só em
 * PT, opinava sobre dieta e disparava com pesagens do mesmo dia).
 * Regra: a mais antiga e a mais recente pesagem precisam estar a pelo menos
 * 14 dias uma da outra e a variação ser de pelo menos 8%. O texto é neutro —
 * sugere comentar na consulta, sem diagnóstico.
 */
const ALERT_MIN_DAYS = 14
const ALERT_MIN_PCT = 8

function weightAlert(days: DayEntry[]): { dir: 'up' | 'down'; since: string } | null {
  if (days.length < 2) return null
  const first = days[0]
  const last = days[days.length - 1]
  if ((last.ts - first.ts) / 86_400_000 < ALERT_MIN_DAYS) return null
  const pct = ((last.weight_kg - first.weight_kg) / first.weight_kg) * 100
  if (Math.abs(pct) < ALERT_MIN_PCT) return null
  return { dir: pct > 0 ? 'up' : 'down', since: first.measured_at }
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/**
 * Uma pesagem por dia LOCAL (vale a última do dia), em ordem cronológica.
 * Antes, 3 pesagens no mesmo dia viravam 3 pontos com a mesma data no eixo
 * e uma "tendência" de horas.
 */
function groupByDay(entries: Entry[]): DayEntry[] {
  const byDay = new Map<string, DayEntry>()
  for (const e of entries) {
    const d = new Date(e.measured_at)
    const ts = d.getTime()
    if (!Number.isFinite(ts) || !(e.weight_kg > 0)) continue
    const dayKey = localDayKey(d)
    const cur = byDay.get(dayKey)
    if (!cur || ts > cur.ts || (ts === cur.ts && e.id > cur.id)) byDay.set(dayKey, { ...e, ts, dayKey })
  }
  return Array.from(byDay.values()).sort((a, b) => a.ts - b.ts)
}

// Coordenadas do plot. Os textos dos eixos ficam em HTML (fora do SVG), então
// têm sempre o tamanho real de 11 px, seja qual for a escala do viewBox.
const VB_W = 320, VB_H = 120, PAD_X = 8, PAD_T = 10, PAD_B = 10
/** Distância mínima entre rótulos de data, em fração da largura. */
const LABEL_MIN_GAP = 0.2

export function WeightChart({ petId }: WeightChartProps) {
  const t = useT()
  const { success, error } = useToast()
  const { palette, ink } = useChartTheme()
  const reduced = useReducedMotion()
  const [data, setData] = useState<WeightHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId().replace(/:/g, '')
  const cor = palette[0]

  useEffect(() => {
    let alive = true
    setLoading(true)
    innovations
      .weightHistory(petId)
      .then(d => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [petId])

  async function addWeight() {
    const w = parseWeightKg(weightInput)
    if (w === null) { error(t('g.wt.errInvalid')); return }
    setAdding(true)
    try {
      await innovations.addWeight(petId, w)
      setData(await innovations.weightHistory(petId))
      setWeightInput('')
      setHover(null)
      haptic('saved')
      invalidate(`pet:${petId}`)
      invalidate('pets')
      success(t('g.wt.saved', { w }))
    } catch (e: unknown) {
      void hapticError()
      error(e instanceof Error ? e.message : t('g.misc.errSave'))
    } finally { setAdding(false) }
  }

  const rawCount = data?.entries.length ?? 0
  const days = useMemo(() => groupByDay(data?.entries ?? []), [data])

  const geom = useMemo(() => {
    if (days.length === 0) return null
    const ws = days.map(e => e.weight_kg)
    let lo = Math.min(...ws), hi = Math.max(...ws)
    const pad = (hi - lo) * 0.18 || Math.max(0.5, hi * 0.05)
    lo = Math.max(0, lo - pad); hi += pad
    const span = hi - lo || 1
    const iw = VB_W - PAD_X * 2, ih = VB_H - PAD_T - PAD_B
    const t0 = days[0].ts, t1 = days[days.length - 1].ts
    // eixo x pelo tempo real (intervalos irregulares ficam honestos)
    const px = (i: number) => (days.length === 1 || t1 === t0 ? PAD_X + iw / 2 : PAD_X + ((days[i].ts - t0) / (t1 - t0)) * iw)
    const py = (v: number) => PAD_T + ih - ((v - lo) / span) * ih
    const pts = days.map((e, i) => [px(i), py(e.weight_kg)] as [number, number])
    return { lo, hi, px, py, pts, iw, ih }
  }, [days])

  if (loading) {
    // mesma altura do cartão com gráfico, para a ficha não "pular" ao carregar
    return (
      <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/70 dark:border-surface-800 p-4" aria-busy="true" aria-label={t('ui.loading')}>
        <Skeleton className="h-5 w-40 rounded-md" />
        <Skeleton className="mt-3 h-9 w-28 rounded-lg" />
        <Skeleton className="mt-3 h-11 w-full rounded-xl" />
        <Skeleton className="mt-4 h-[150px] w-full rounded-xl" />
      </div>
    )
  }
  if (!data) return null

  const last = days.at(-1)
  const current = data.current_weight != null ? Number(data.current_weight) : last?.weight_kg ?? null
  const trend = days.length >= 2 ? days.at(-1)!.weight_kg - days[0].weight_kg : 0
  const trendPct = days.length >= 2 && days[0].weight_kg ? (trend / days[0].weight_kg) * 100 : 0
  const TrendIcon = Math.abs(trend) < 0.05 ? Minus : trend > 0 ? TrendingUp : TrendingDown
  const nf = (v: number, d = 1) => v.toLocaleString(localeTag(), { minimumFractionDigits: 0, maximumFractionDigits: d })
  const fmtLongDate = (s: string) => new Date(s).toLocaleDateString(localeTag(), { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtDate = (s: string) => new Date(s).toLocaleDateString(localeTag(), { day: '2-digit', month: 'short' })
  const weightNote = weightAlert(days)
  const collapsed = rawCount > days.length

  // Rótulos de data: um por dia (cada ponto já é um dia diferente), sem
  // encavalar — o último sempre aparece; os do meio saem se ficarem perto.
  const dateLabels: { i: number; x: number }[] = []
  if (geom) {
    const xs = days.map((_, i) => geom.px(i) / VB_W)
    const lastI = days.length - 1
    for (let i = 0; i <= lastI; i++) {
      const x = xs[i]
      const prev = dateLabels.at(-1)
      if (prev && x - prev.x < LABEL_MIN_GAP) continue
      if (i !== lastI && lastI > 0 && xs[lastI] - x < LABEL_MIN_GAP) continue
      dateLabels.push({ i, x })
    }
  }

  return (
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/70 dark:border-surface-800 p-4">
      <h3 className="font-display font-bold text-surface-900 dark:text-white flex items-center gap-2">
        <Scale className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden /> {t('g.wt.title')}
      </h3>

      <div className="mt-2 flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {current != null && (
            <p className="flex items-baseline gap-2 flex-wrap">
              <span className="sr-only">{t('g.wt.current')}</span>
              <AnimatedNumber
                value={current}
                decimals={Number.isInteger(current) ? 0 : 1}
                suffix={' kg'}
                className="num-hero text-[34px] leading-none text-surface-900 dark:text-white"
              />
              {days.length >= 2 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-200">
                  <TrendIcon className="w-3 h-3" aria-hidden />
                  {trend > 0 ? '+' : ''}{nf(trend)}&nbsp;kg
                  {Math.abs(trendPct) >= 1 && <span className="opacity-80">({trendPct > 0 ? '+' : ''}{trendPct.toFixed(0)}%)</span>}
                </span>
              )}
            </p>
          )}
          {last && (
            <p className="mt-1 text-[13px] text-surface-600 dark:text-surface-300">{fmtLongDate(last.measured_at)}</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text" inputMode="decimal" aria-label={t('pw.pet.weight')} placeholder={t('g.wt.inputPh')} value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addWeight() }}
            className="w-24 px-3 min-h-[44px] text-[15px] bg-white border border-surface-200 dark:border-surface-700 dark:bg-surface-900 text-surface-900 dark:text-surface-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button onClick={addWeight} disabled={adding || !weightInput} aria-label={t('pet3.wt.add')}
            className="pressable flex items-center gap-1 min-h-[44px] min-w-[44px] bg-primary-700 hover:bg-primary-800 text-white dark:bg-primary-500 dark:text-surface-950 text-sm font-semibold px-3.5 rounded-xl disabled:opacity-50">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Plus className="w-4 h-4" aria-hidden />} kg
          </button>
        </div>
      </div>

      {weightNote && (
        <div role="note" className="flex items-start gap-2 rounded-xl p-3 mt-3 text-sm bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-100">
          {weightNote.dir === 'up' ? <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> : <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />}
          <span>{t(weightNote.dir === 'up' ? 'pet2.wt.up' : 'pet2.wt.down', { date: fmtLongDate(weightNote.since) })}</span>
        </div>
      )}

      {days.length === 1 ? (
        // um dia só: um ponto solto não é gráfico — diz o que falta para a evolução aparecer
        <div className="mt-4 rounded-xl bg-surface-50 dark:bg-surface-800/60 px-4 py-3 text-[13px] text-surface-700 dark:text-surface-200">
          <p>{t('pet3.wt.needTwo')}</p>
          {collapsed && <p className="mt-1 text-surface-600 dark:text-surface-400">{t('pet3.wt.oneDay')}</p>}
        </div>
      ) : days.length === 0 || !geom ? (
        <div className="text-center py-10">
          <Scale className="w-9 h-9 mx-auto text-surface-300 dark:text-surface-600 mb-2" aria-hidden />
          <p className="text-sm text-surface-600 dark:text-surface-300">{t('g.wt.empty')}</p>
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">{t('g.wt.emptyHint')}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-2 select-none">
            {/* eixo Y (máx/mín), em HTML: 11 px reais */}
            <div className="flex flex-col justify-between py-[2px] text-[11px] leading-none tabular-nums text-right shrink-0" style={{ color: ink.axis }} aria-hidden>
              <span>{nf(geom.hi, 0)} kg</span>
              <span>{nf(geom.lo, 0)} kg</span>
            </div>
            <div className="relative flex-1 min-w-0">
              <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full block" style={{ height: 'auto' }} role="img"
                aria-label={t('g.wt.chartAria', { count: days.length, from: nf(days[0].weight_kg), to: nf(days.at(-1)!.weight_kg) })}>
                <defs>
                  <linearGradient id={`area${gid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={cor} stopOpacity="0.28" />
                    <stop offset="1" stopColor={cor} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* linhas de referência do máx/mín */}
                <line x1={0} x2={VB_W} y1={PAD_T} y2={PAD_T} stroke={ink.axis} strokeOpacity="0.18" strokeWidth="0.8" strokeDasharray="3 4" />
                <line x1={0} x2={VB_W} y1={VB_H - PAD_B} y2={VB_H - PAD_B} stroke={ink.axis} strokeOpacity="0.25" strokeWidth="0.8" />

                {/* área + linha (a linha se desenha ao entrar, só com movimento permitido) */}
                {geom.pts.length > 1 && (() => {
                  const line = smoothPath(geom.pts)
                  const base = VB_H - PAD_B
                  return <>
                    <motion.path
                      d={`${line} L${geom.pts.at(-1)![0]},${base} L${geom.pts[0][0]},${base} Z`}
                      fill={`url(#area${gid})`}
                      initial={reduced ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: reduced ? 0 : 0.35 }}
                    />
                    <motion.path
                      key={`l-${days.length}`}
                      d={line} fill="none" stroke={cor} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"
                      initial={reduced ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  </>
                })()}

                {/* pontos */}
                {geom.pts.map(([x, y], i) => (
                  <circle key={days[i].dayKey} cx={x} cy={y} r={hover === i ? 5 : 3.5} fill={cor}
                    stroke="white" strokeWidth={hover === i ? 2 : 0} className="dark:stroke-surface-900"
                    style={{ transition: 'r .12s' }} />
                ))}

                {/* zonas de toque (alvo generoso) */}
                {days.map((d, i) => {
                  const prevX = i > 0 ? geom.px(i - 1) : 0
                  const nextX = i < days.length - 1 ? geom.px(i + 1) : VB_W
                  const x0 = i > 0 ? (prevX + geom.px(i)) / 2 : 0
                  const x1 = i < days.length - 1 ? (geom.px(i) + nextX) / 2 : VB_W
                  return <rect key={d.dayKey} x={x0} y={0} width={Math.max(x1 - x0, 1)} height={VB_H}
                    fill="transparent" style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                    onClick={() => setHover(h => (h === i ? null : i))} />
                })}
              </svg>

              {/* eixo X: datas só onde a data muda (1 dia → 1 rótulo) */}
              <div className="relative h-[18px] mt-1 text-[11px] leading-none tabular-nums" style={{ color: ink.axis }} aria-hidden>
                {dateLabels.map(({ i, x }) => {
                  const edge = x < 0.12 ? 'left' : x > 0.88 ? 'right' : 'center'
                  return (
                    <span
                      key={days[i].dayKey}
                      className={cn('absolute top-0 whitespace-nowrap', edge === 'center' && '-translate-x-1/2', edge === 'right' && '-translate-x-full')}
                      style={{ left: `${x * 100}%` }}
                    >
                      {fmtDate(days[i].measured_at)}
                    </span>
                  )
                })}
              </div>

              {/* tooltip */}
              {hover != null && days[hover] && (
                <div className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-10 whitespace-nowrap
                  bg-surface-900 dark:bg-surface-700 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg"
                  style={{ left: `${(geom.px(hover) / VB_W) * 100}%`, top: `${(geom.py(days[hover].weight_kg) / VB_H) * 100}%`, marginTop: -8 }}>
                  <div className="font-bold tabular-nums">{nf(days[hover].weight_kg)} kg</div>
                  <div className="opacity-80">{new Date(days[hover].measured_at).toLocaleDateString(localeTag())}</div>
                  {days[hover].body_condition_score != null && <div className="opacity-80">{t('g.wt.bcs', { score: days[hover].body_condition_score! })}</div>}
                </div>
              )}
            </div>
          </div>

          {collapsed && (
            <p className="mt-2 text-[12px] text-surface-600 dark:text-surface-400">{t('pet3.wt.oneDay')}</p>
          )}

          {days.length > 1 && (
            <ul className="mt-3 space-y-1">
              {[...days].reverse().slice(0, 5).map(e => (
                <li key={e.dayKey} className="flex items-center justify-between text-[13px] text-surface-600 dark:text-surface-300 py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
                  <span>{new Date(e.measured_at).toLocaleDateString(localeTag())}</span>
                  <span className="font-semibold text-surface-900 dark:text-white tabular-nums">{nf(e.weight_kg)} kg</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
