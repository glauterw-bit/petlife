'use client'

import { CalendarPlus, ChevronRight } from 'lucide-react'
import type { Appt } from '@/lib/crmApi'
import type { ApptStatus } from '../ui'
import { Btn, nextStep } from '../ui'
import { EmptyState, PetAvatar, StatusMenu } from '../kit'
import { MotionItem, MotionList } from '../motion'
import { apptAria, durationOf, fmtDuration, hhmm, serviceOf, startOf } from './utils'

/** Visão Lista: atendimentos do dia agrupados por hora. */
export function AgendaList({ appts, onOpen, onStatus, onNew }: {
  appts: Appt[]
  onOpen: (a: Appt) => void
  onStatus: (a: Appt, s: ApptStatus) => Promise<void>
  onNew: () => void
}) {
  if (!appts.length) {
    return (
      <div className="bg-panel rounded-2xl shadow-crm-card">
        <EmptyState icon={CalendarPlus} title="Agenda livre neste dia" hint="Nenhum atendimento marcado. Que tal encaixar alguém da lista de espera?"
          action={<Btn icon={CalendarPlus} onClick={onNew}>Agendar</Btn>} />
      </div>
    )
  }
  const sorted = [...appts].sort((x, y) => startOf(x).getTime() - startOf(y).getTime())
  const groups: Array<{ hour: number; items: Appt[] }> = []
  for (const a of sorted) {
    const h = startOf(a).getHours()
    const g = groups[groups.length - 1]
    if (g && g.hour === h) g.items.push(a)
    else groups.push({ hour: h, items: [a] })
  }
  let i = 0
  return (
    <MotionList className="space-y-4">
      {groups.map(g => (
        <section key={g.hour} aria-label={`${String(g.hour).padStart(2, '0')}:00`}>
          <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted mb-1.5 tabular-nums px-1">{String(g.hour).padStart(2, '0')}:00</h3>
          <div className="space-y-2">
            {g.items.map(a => {
              const step = nextStep(a)
              const idx = i++
              return (
                <MotionItem key={a.id} index={idx} className="bg-panel rounded-2xl shadow-crm-card flex items-center gap-2 pr-2 sm:pr-3 min-h-[64px]">
                  <button type="button" onClick={() => onOpen(a)} aria-label={apptAria(a)}
                    className="flex-1 min-w-0 flex items-center gap-3 pl-3 sm:pl-4 py-3 text-left rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                    <span className="w-12 shrink-0">
                      <span className="block text-sm font-bold tabular-nums text-ink">{hhmm(startOf(a))}</span>
                      <span className="block text-2xs text-muted tabular-nums">{fmtDuration(durationOf(a))}</span>
                    </span>
                    <PetAvatar name={a.patient_name || a.client_name || '?'} species={a.patient_species} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-semibold text-ink truncate">{a.patient_name || 'Sem pet'}</span>
                        {a.is_fit_in && <span className="shrink-0 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 px-1.5 text-2xs font-semibold">Encaixe</span>}
                      </span>
                      <span className="block text-xs text-muted truncate">{serviceOf(a)} · {a.client_name}{a.staff_name ? ` · ${a.staff_name}` : ''}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted shrink-0 sm:hidden" strokeWidth={1.75} aria-hidden />
                  </button>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 shrink-0">
                    <StatusMenu status={a.status} onChange={s => onStatus(a, s)} />
                    {step && <Btn size="sm" variant="soft" onClick={() => { void onStatus(a, step.to).catch(() => {}) }}>{step.label}</Btn>}
                  </div>
                </MotionItem>
              )
            })}
          </div>
        </section>
      ))}
    </MotionList>
  )
}
