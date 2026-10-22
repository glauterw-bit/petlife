'use client'

import { CalendarDays } from 'lucide-react'
import type { Appt } from '@/lib/crmApi'
import { APPT_TYPE, StatusBadge, toDate } from '@/components/crm/ui'
import { EmptyState } from '@/components/crm/kit'
import { MotionItem, MotionList } from '@/components/crm/motion'

/** Lista de atendimentos (ficha do cliente e do pet). Clicar abre para editar. */
export function ApptList({ appts, onOpen, showPet = true, emptyAction }: {
  appts: Appt[]; onOpen?: (a: Appt) => void; showPet?: boolean; emptyAction?: React.ReactNode
}) {
  if (!appts.length) return <EmptyState icon={CalendarDays} title="Nenhum atendimento ainda" compact action={emptyAction} />
  return (
    <MotionList as="ul" className="divide-y divide-line">
      {appts.map((a, i) => {
        const d = toDate(a.starts_at)
        const what = a.item_name || APPT_TYPE[a.type] || a.type
        return (
          <MotionItem as="li" key={a.id} index={i}>
            <button type="button" onClick={onOpen ? () => onOpen(a) : undefined} disabled={!onOpen}
              className="w-full flex items-center gap-3 min-h-14 md:min-h-11 py-1.5 px-1 text-left rounded-lg hover:bg-panel-2/60 focus-visible:bg-panel-2/60 transition-colors disabled:cursor-default disabled:hover:bg-transparent">
              <span className="w-12 shrink-0 text-center">
                <span className="block text-2xs font-semibold uppercase text-muted">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                <span className="block text-base font-bold text-ink leading-none tabular-nums">{d.getDate()}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink truncate">
                  {what}{showPet && a.patient_name ? <span className="text-muted font-normal"> · {a.patient_name}</span> : null}
                </span>
                <span className="block text-xs text-muted truncate tabular-nums">
                  {d.toLocaleDateString('pt-BR', { weekday: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}
                  {' · '}{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {a.staff_name ? ` · ${a.staff_name}` : ''}
                </span>
              </span>
              <StatusBadge status={a.status} />
            </button>
          </MotionItem>
        )
      })}
    </MotionList>
  )
}
