'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { weekRange } from '../ui'
import { useLayer } from './layers'

const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const ML = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export function dateNavLabel(mode: 'day' | 'week' | 'month', d: Date): string {
  if (mode === 'day') return `${WD[d.getDay()]}, ${d.getDate()} de ${MS[d.getMonth()]}`
  if (mode === 'month') return `${ML[d.getMonth()]} de ${d.getFullYear()}`
  const [a, b0] = weekRange(d)
  const b = new Date(b0.getFullYear(), b0.getMonth(), b0.getDate() - 1)
  return a.getMonth() === b.getMonth()
    ? `semana de ${a.getDate()} a ${b.getDate()} de ${MS[b.getMonth()]}`
    : `semana de ${a.getDate()} de ${MS[a.getMonth()]} a ${b.getDate()} de ${MS[b.getMonth()]}`
}

function shift(mode: 'day' | 'week' | 'month', d: Date, n: number) {
  if (mode === 'month') return new Date(d.getFullYear(), d.getMonth() + n, 1)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (mode === 'week' ? 7 * n : n))
}

export function DateNav({ mode, value, onChange, showToday = true }: {
  mode: 'day' | 'week' | 'month'; value: Date; onChange: (d: Date, dir: 1 | -1 | 0) => void; showToday?: boolean
}) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const isCurrent = mode === 'day' ? sameDay(value, today)
    : mode === 'week' ? sameDay(weekRange(value)[0], weekRange(today)[0])
    : value.getFullYear() === today.getFullYear() && value.getMonth() === today.getMonth()
  const go = (d: Date) => {
    const dir: 1 | -1 | 0 = d.getTime() > value.getTime() ? 1 : d.getTime() < value.getTime() ? -1 : 0
    onChange(d, dir)
  }
  const btn = 'h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink hover:bg-panel-2 transition-colors'
  return (
    <div className="relative inline-flex items-center gap-1 flex-wrap">
      <div className="inline-flex items-center rounded-lg bg-panel shadow-crm-card">
        <button type="button" className={btn} onClick={() => onChange(shift(mode, value, -1), -1)} aria-label="Anterior">
          <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open}
          className="h-9 px-2.5 inline-flex items-center gap-2 text-sm font-semibold text-ink hover:bg-panel-2 rounded-lg min-w-0">
          <CalendarDays className="w-4 h-4 text-muted shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="truncate first-letter:uppercase">{dateNavLabel(mode, value)}</span>
        </button>
        <button type="button" className={btn} onClick={() => onChange(shift(mode, value, 1), 1)} aria-label="Próximo">
          <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
      {showToday && !isCurrent && (
        <button type="button" onClick={() => go(mode === 'month' ? new Date(today.getFullYear(), today.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), today.getDate()))}
          className="h-9 px-3 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-500/15">
          {mode === 'month' ? 'Este mês' : mode === 'week' ? 'Esta semana' : 'Hoje'}
        </button>
      )}
      <AnimatePresence>
        {open && <Picker key="p" mode={mode} value={value} onClose={() => setOpen(false)} onPick={d => { setOpen(false); go(d) }} />}
      </AnimatePresence>
    </div>
  )
}

function Picker({ mode, value, onClose, onPick }: { mode: 'day' | 'week' | 'month'; value: Date; onClose: () => void; onPick: (d: Date) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { z } = useLayer(true, onClose, { lockScroll: false })
  const [view, setView] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1))
  const today = new Date()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const onClose = () => closeRef.current()
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(ref.current.parentElement?.contains(e.target as Node) && (e.target as HTMLElement).closest('[aria-haspopup=dialog]'))) onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-current=true]')?.focus(), 20)
    return () => { document.removeEventListener('pointerdown', onDown, true); clearTimeout(t) }
  }, [])

  const [wkStart] = weekRange(value)
  const cells: Date[] = []
  if (mode !== 'month') {
    const first = new Date(view.getFullYear(), view.getMonth(), 1)
    const off = (first.getDay() + 6) % 7
    for (let i = 0; i < 42; i++) cells.push(new Date(view.getFullYear(), view.getMonth(), 1 - off + i))
  }

  return (
    <motion.div ref={ref} role="dialog" aria-label="Escolher data"
      className="absolute left-0 top-full mt-2 w-[296px] max-w-[calc(100vw-32px)] rounded-xl bg-panel p-3 shadow-crm-pop text-ink"
      style={{ zIndex: z, transformOrigin: 'top left' }}
      initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={{ duration: 0.14 }}>
      <div className="flex items-center justify-between mb-2">
        <button type="button" aria-label={mode === 'month' ? 'Ano anterior' : 'Mês anterior'} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-panel-2"
          onClick={() => setView(v => mode === 'month' ? new Date(v.getFullYear() - 1, 0, 1) : new Date(v.getFullYear(), v.getMonth() - 1, 1))}>
          <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <span className="text-sm font-semibold first-letter:uppercase">{mode === 'month' ? view.getFullYear() : `${ML[view.getMonth()]} de ${view.getFullYear()}`}</span>
        <button type="button" aria-label={mode === 'month' ? 'Próximo ano' : 'Próximo mês'} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-panel-2"
          onClick={() => setView(v => mode === 'month' ? new Date(v.getFullYear() + 1, 0, 1) : new Date(v.getFullYear(), v.getMonth() + 1, 1))}>
          <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
      {mode === 'month' ? (
        <div className="grid grid-cols-3 gap-1">
          {ML.map((m, i) => {
            const cur = value.getFullYear() === view.getFullYear() && value.getMonth() === i
            return (
              <button key={m} type="button" data-current={cur} onClick={() => onPick(new Date(view.getFullYear(), i, 1))}
                className={`h-9 rounded-lg text-sm capitalize ${cur ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-surface-950 font-semibold' : 'hover:bg-panel-2'}`}>
                {MS[i]}
              </button>
            )
          })}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 mb-1">
            {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(w => <span key={w} className="text-center text-2xs uppercase tracking-wider text-muted">{w[0]}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map(d => {
              const inMonth = d.getMonth() === view.getMonth()
              const sel = mode === 'day' ? sameDay(d, value) : sameDay(weekRange(d)[0], wkStart)
              const isToday = sameDay(d, today)
              return (
                <button key={d.toISOString()} type="button" data-current={sameDay(d, value)} onClick={() => onPick(d)}
                  aria-label={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  className={`h-9 text-sm tabular-nums transition-colors ${mode === 'week' ? '' : 'rounded-lg'}
                    ${sel ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-surface-950 font-semibold' : inMonth ? 'hover:bg-panel-2' : 'text-muted/60 hover:bg-panel-2'}
                    ${isToday && !sel ? 'ring-1 ring-inset ring-primary-500 rounded-lg' : ''}`}>
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </>
      )}
    </motion.div>
  )
}
