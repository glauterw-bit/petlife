'use client'

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react'
import { m, useMotionValue, type PanInfo } from 'framer-motion'
import { Plus } from 'lucide-react'
import type { Appt } from '@/lib/crmApi'
import { APPT_STATUS } from '../ui'
import { PersonAvatar } from '../kit'
import {
  HOUR_PX, LOCKED_STATUS, apptAria, durationOf, hhmm, layoutColumn, roundTo, sameDay, serviceOf, startOf, startOfDay,
  type Placed,
} from './utils'

/**
 * Coluna da grade. staffId: número = profissional, null = "Sem profissional",
 * undefined = a coluna não define profissional (visão Semana).
 */
export interface GridColumn {
  key: string
  date: Date
  label: string
  sub?: string
  staffId?: number | null
  person?: string
  isToday?: boolean
  appts: Appt[]
}

export interface TimeGridProps {
  columns: GridColumn[]
  startHour: number
  endHour: number
  now: Date
  minColWidth: number
  dragEnabled: boolean
  onSlot: (start: Date, staffId: number | null | undefined) => void
  onOpen: (a: Appt) => void
  onMove: (a: Appt, start: Date, staffId: number | null | undefined) => void
}

const GUTTER = 56

export function TimeGrid({ columns, startHour, endHour, now, minColWidth, dragEnabled, onSlot, onOpen, onMove }: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hours = endHour - startHour
  const height = hours * HOUR_PX
  const hasToday = columns.some(c => c.isToday)

  // ao abrir, rola até perto de agora (hoje) ou do primeiro atendimento
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let target = 8
    if (hasToday) target = now.getHours() - 1
    else {
      const firsts = columns.flatMap(c => c.appts).map(a => startOf(a).getHours())
      if (firsts.length) target = Math.min(...firsts)
    }
    el.scrollTop = Math.max(0, (target - startHour) * HOUR_PX - 8)
    // só na montagem; trocar de dia remonta a grade
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const template = `${GUTTER}px repeat(${columns.length}, minmax(${minColWidth}px, 1fr))`
  const minWidth = GUTTER + columns.length * minColWidth

  return (
    <div ref={scrollRef} className="relative overflow-auto overscroll-contain rounded-2xl bg-panel shadow-crm-card max-h-[calc(100dvh-260px)] min-h-[420px]">
      <div style={{ minWidth }}>
        {/* cabeçalho das colunas */}
        <div className="sticky top-0 z-20 grid border-b border-line bg-panel/95 backdrop-blur" style={{ gridTemplateColumns: template }}>
          <div className="sticky left-0 z-10 bg-panel/95" />
          {columns.map(c => (
            <div key={c.key} className="flex items-center gap-2 min-w-0 px-2.5 py-2 border-l border-line">
              {c.person && <PersonAvatar name={c.person} size="sm" />}
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${c.isToday ? 'text-primary-700 dark:text-primary-300' : 'text-ink'}`}>
                  {c.isToday && !c.person ? <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden />{c.label}</span> : c.label}
                </p>
                {c.sub && <p className="text-2xs text-muted tabular-nums truncate">{c.sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* corpo */}
        <div className="grid" style={{ gridTemplateColumns: template }}>
          <div className="sticky left-0 z-10 bg-panel border-r border-line" style={{ height }} aria-hidden>
            {Array.from({ length: hours }, (_, i) => (
              <div key={i} className="relative" style={{ height: HOUR_PX }}>
                {i > 0 && <span className="absolute -top-2 right-2 text-2xs font-medium text-muted tabular-nums">{String(startHour + i).padStart(2, '0')}:00</span>}
              </div>
            ))}
          </div>
          <div className="contents">
            {columns.map((c, idx) => (
              <Column key={c.key} col={c} index={idx} columns={columns} startHour={startHour} endHour={endHour} height={height}
                now={now} dragEnabled={dragEnabled} constraintsRef={scrollRef}
                onSlot={onSlot} onOpen={onOpen} onMove={onMove} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const Column = memo(function Column({ col, index, columns, startHour, endHour, height, now, dragEnabled, constraintsRef, onSlot, onOpen, onMove }: {
  col: GridColumn; index: number; columns: GridColumn[]; startHour: number; endHour: number; height: number; now: Date
  dragEnabled: boolean; constraintsRef: RefObject<HTMLDivElement>
  onSlot: TimeGridProps['onSlot']; onOpen: TimeGridProps['onOpen']; onMove: TimeGridProps['onMove']
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const placed = useMemo(() => layoutColumn(col.appts, col.date), [col.appts, col.date])
  const hours = endHour - startHour

  const minuteAt = (clientY: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return null
    const y = Math.min(Math.max(0, clientY - r.top), height - 1)
    const m = startHour * 60 + Math.floor((y / HOUR_PX) * 60 / 15) * 15
    return Math.min(m, endHour * 60 - 15)
  }
  const onMoveHover = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) { if (hover !== null) setHover(null); return }
    const m = minuteAt(e.clientY)
    if (m !== hover) setHover(m)
  }
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const m = minuteAt(e.clientY)
    if (m === null) return
    const d = startOfDay(col.date)
    d.setMinutes(m)
    onSlot(d, col.staffId)
  }

  const nowTop = col.isToday && sameDay(now, col.date)
    ? ((now.getHours() * 60 + now.getMinutes() - startHour * 60) / 60) * HOUR_PX
    : null

  return (
    <div
      ref={ref}
      className="relative border-l border-line cursor-copy"
      style={{ height }}
      onClick={onClick}
      onMouseMove={onMoveHover}
      onMouseLeave={() => setHover(null)}
      aria-label={`${col.label}${col.sub ? `, ${col.sub}` : ''}: clique num horário vazio para agendar`}
    >
      {/* linhas de hora e meia hora */}
      {Array.from({ length: hours }, (_, i) => (
        <div key={i} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ top: i * HOUR_PX }}>
          <div className="absolute inset-x-0 border-t border-dashed border-line/60" style={{ top: HOUR_PX / 2 }} />
        </div>
      ))}
      {col.isToday && <div aria-hidden className="pointer-events-none absolute inset-0 bg-primary-500/[0.025] dark:bg-primary-400/[0.03]" />}

      {hover !== null && (
        <div aria-hidden className="pointer-events-none absolute inset-x-1 rounded-md border border-dashed border-primary-500/60 bg-primary-500/5 text-2xs font-semibold text-primary-700 dark:text-primary-300 px-1.5 flex items-center gap-1"
          style={{ top: ((hover - startHour * 60) / 60) * HOUR_PX + 1, height: HOUR_PX / 4 * 2 - 2 }}>
          <Plus className="w-3 h-3" strokeWidth={2} />{hhmm(new Date(2000, 0, 1, 0, hover))}
        </div>
      )}

      {placed.map(p => (
        <Block key={p.appt.id} p={p} col={col} index={index} columns={columns} startHour={startHour} endHour={endHour}
          dragEnabled={dragEnabled && !LOCKED_STATUS.includes(p.appt.status)} constraintsRef={constraintsRef}
          onOpen={onOpen} onMove={onMove} />
      ))}

      {nowTop !== null && nowTop >= 0 && nowTop <= height && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[5]" style={{ top: nowTop }}>
          <div className="relative border-t-2 border-red-500 dark:border-red-400">
            <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />
          </div>
        </div>
      )}
    </div>
  )
})

function Block({ p, col, index, columns, startHour, endHour, dragEnabled, constraintsRef, onOpen, onMove }: {
  p: Placed; col: GridColumn; index: number; columns: GridColumn[]; startHour: number; endHour: number
  dragEnabled: boolean; constraintsRef: RefObject<HTMLDivElement>
  onOpen: TimeGridProps['onOpen']; onMove: TimeGridProps['onMove']
}) {
  const a = p.appt
  const ref = useRef<HTMLButtonElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const moved = useRef(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const top = ((p.startMin - startHour * 60) / 60) * HOUR_PX
  const dur = durationOf(a)
  const h = Math.max(28, (dur / 60) * HOUR_PX)
  const s = startOf(a)
  const e = new Date(s.getTime() + dur * 60000)
  const st = APPT_STATUS[a.status] ?? APPT_STATUS.agendado

  // a posição nova chega pelo top; zera o deslocamento do arrasto no mesmo quadro
  useLayoutEffect(() => { x.set(0); y.set(0) }, [top, col.key, x, y])

  const target = (info: PanInfo) => {
    const colW = ref.current?.parentElement?.offsetWidth || 1
    const dCol = Math.round(info.offset.x / colW)
    const ti = Math.min(columns.length - 1, Math.max(0, index + dCol))
    const dMin = roundTo((info.offset.y / HOUR_PX) * 60)
    const startMin = Math.min(Math.max(p.startMin + dMin, startHour * 60), endHour * 60 - 15)
    return { ti, startMin }
  }
  const onDrag = (_: unknown, info: PanInfo) => {
    const { ti, startMin } = target(info)
    const label = `${hhmm(new Date(2000, 0, 1, 0, startMin))}${ti !== index ? ` · ${columns[ti].label}` : ''}`
    if (label !== preview) setPreview(label)
  }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    setDragging(false)
    setPreview(null)
    setTimeout(() => { moved.current = false }, 0)
    const { ti, startMin } = target(info)
    if (ti === index && startMin === p.startMin) { x.set(0); y.set(0); return }
    const tc = columns[ti]
    const d = startOfDay(tc.date)
    d.setMinutes(startMin)
    const staff = ti !== index && tc.staffId !== undefined && tc.staffId !== col.staffId ? tc.staffId : undefined
    onMove(a, d, staff)
    // se nada mudar de lugar (erro, mesma posição), o bloco volta
    requestAnimationFrame(() => { x.set(0); y.set(0) })
  }

  const compact = h < 44
  const roomy = h >= 76
  return (
    <m.button
      ref={ref}
      type="button"
      aria-label={apptAria(a)}
      onClick={() => { if (!moved.current) onOpen(a) }}
      drag={dragEnabled}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={constraintsRef}
      onDragStart={() => { moved.current = true; setDragging(true) }}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, zIndex: 30, cursor: 'grabbing' }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.16 }}
      style={{
        x, y, top: top + 1, height: h - 2,
        left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
        width: `calc(${100 / p.lanes}% - 4px)`,
      }}
      className={`group absolute z-[1] rounded-lg bg-panel text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500 touch-manipulation
        ${dragEnabled ? 'cursor-grab' : 'cursor-pointer'} ${dragging ? 'shadow-crm-pop' : 'hover:shadow-crm-pop'} transition-shadow`}
    >
      <span className={`absolute inset-0 rounded-lg ${st.block} overflow-hidden px-2 ${compact ? 'py-0.5 flex items-center gap-1.5' : 'py-1'} ${a.status === 'cancelado' ? 'line-through decoration-muted/60' : ''}`}>
        {compact ? (
          <span className="flex items-center gap-1.5 min-w-0 text-xs leading-tight">
            <span className="font-semibold tabular-nums text-ink/80">{preview ?? hhmm(s)}</span>
            <span className="font-semibold text-ink truncate">{a.patient_name || a.client_name}</span>
            <span className="text-muted truncate">{serviceOf(a)}</span>
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-2xs font-semibold tabular-nums text-ink/70">
              <span className="truncate">{preview ?? `${hhmm(s)}–${hhmm(e)}`}</span>
              {a.is_fit_in && <span className="shrink-0 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 px-1.5 leading-4">Encaixe</span>}
            </span>
            <span className="block text-[13px] font-semibold text-ink truncate leading-tight mt-0.5">{a.patient_name || a.client_name || 'Sem pet'}</span>
            <span className="block text-xs text-muted truncate leading-tight">{serviceOf(a)}</span>
            {roomy && a.patient_name && a.client_name && <span className="block text-xs text-muted/90 truncate leading-tight mt-0.5">{a.client_name}</span>}
          </>
        )}
      </span>
    </m.button>
  )
}
