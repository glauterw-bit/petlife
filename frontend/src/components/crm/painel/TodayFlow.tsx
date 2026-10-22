'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutGroup, motion } from 'framer-motion'
import { ArrowRight, CalendarDays, Plus, Receipt, type LucideIcon } from 'lucide-react'
import type { Appt, ApptStatus } from '@/lib/crmApi'
import { Badge, Btn, fmtTime, nextStep } from '@/components/crm/ui'
import { EmptyState, PetAvatar, StatusMenu } from '@/components/crm/kit'
import { dur, spring } from '@/components/crm/motion'
import { IN_CLINIC, WaitTime, serviceOf } from './shared'

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number]

/** Linha do tempo de hoje: quem está na clínica fica no topo. */
export function TodayFlow({ appts, now, onStatus, onSchedule }: {
  appts: Appt[]
  now: Date
  onStatus: (a: Appt, s: ApptStatus) => Promise<void>
  onSchedule: () => void
}) {
  const inside = appts.filter(a => IN_CLINIC.indexOf(a.status) >= 0)
    .sort((a, b) => (a.checked_in_at || a.starts_at).localeCompare(b.checked_in_at || b.starts_at))
  const rest = appts.filter(a => IN_CLINIC.indexOf(a.status) < 0)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  if (!appts.length) {
    return (
      <EmptyState icon={CalendarDays} title="Nenhum atendimento hoje" hint="Os agendamentos do dia aparecem aqui, em ordem de horário."
        action={<Btn icon={Plus} onClick={onSchedule}>Agendar</Btn>} />
    )
  }

  return (
    <LayoutGroup id="today-flow">
      {inside.length > 0 && (
        <section aria-label="Na clínica agora" className="mb-4">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-2">Na clínica agora</p>
          <ol className="space-y-2">
            {inside.map((a, i) => <FlowRow key={a.id} a={a} i={i} now={now} onStatus={onStatus} highlight />)}
          </ol>
        </section>
      )}
      {rest.length > 0 && (
        <section aria-label="Agenda do dia">
          {inside.length > 0 && <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-1">Agenda do dia</p>}
          <ol className="relative">
            <span aria-hidden className="absolute left-[52px] top-3 bottom-3 w-px bg-line hidden sm:block" />
            {rest.map((a, i) => <FlowRow key={a.id} a={a} i={i + inside.length} now={now} onStatus={onStatus} />)}
          </ol>
        </section>
      )}
    </LayoutGroup>
  )
}

function FlowRow({ a, i, now, onStatus, highlight }: {
  a: Appt; i: number; now: Date; onStatus: (a: Appt, s: ApptStatus) => Promise<void>; highlight?: boolean
}) {
  const router = useRouter()
  const step = nextStep(a)
  const canFinish = IN_CLINIC.indexOf(a.status) >= 0
  const past = a.status === 'concluido' || a.status === 'cancelado' || a.status === 'faltou'
  return (
    <motion.li
      layout="position"
      layoutId={`flow-${a.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease: easeOut, delay: i < 12 ? i * 0.03 : 0, layout: spring.soft }}
      className={`relative flex flex-wrap items-center gap-x-3 gap-y-2 ${highlight
        ? 'rounded-xl bg-primary-50/70 dark:bg-primary-500/10 ring-1 ring-primary-200/70 dark:ring-primary-500/20 px-3 py-2.5'
        : 'px-1 py-2.5 border-b border-line last:border-b-0'} ${past ? 'opacity-70' : ''}`}
    >
      <span className="w-11 shrink-0 text-sm font-bold tabular-nums text-ink">{fmtTime(a.starts_at)}</span>
      <span className="relative z-[1] shrink-0 hidden sm:inline-flex rounded-full ring-4 ring-panel">
        <PetAvatar name={a.patient_name || a.client_name || '?'} species={a.patient_species} size="sm" />
      </span>
      <div className="min-w-0 flex-1 basis-[180px]">
        <p className="text-sm font-semibold text-ink truncate">
          {a.patient_id
            ? <Link href={`/clinica/pacientes/${a.patient_id}`} className="hover:underline">{a.patient_name}</Link>
            : <span>{a.patient_name || 'Sem pet'}</span>}
          <span className="font-normal text-muted"> · {serviceOf(a)}</span>
        </p>
        <p className="text-xs text-muted truncate flex items-center gap-2 flex-wrap">
          <span className="truncate">
            {a.client_id ? <Link href={`/clinica/clientes/${a.client_id}`} className="hover:underline">{a.client_name}</Link> : a.client_name}
            {a.staff_name ? ` · ${a.staff_name}` : ''}
          </span>
          {highlight && <WaitTime since={a.started_at && a.status !== 'chegou' ? a.started_at : a.checked_in_at} now={now} prefix={a.status === 'chegou' ? 'chegou' : undefined} />}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-end ml-auto">
        {a.is_fit_in && <Badge tone="warn">Encaixe</Badge>}
        <StatusMenu status={a.status} onChange={s => onStatus(a, s)} />
        {step && (
          <Btn size="sm" variant="soft" onClick={() => { onStatus(a, step.to).catch(() => undefined) }}>{step.label}</Btn>
        )}
        {canFinish && (
          <Btn size="sm" icon={Receipt} onClick={() => router.push(`/clinica/caixa?appointment=${a.id}`)}>Finalizar</Btn>
        )}
      </div>
    </motion.li>
  )
}

/** Link-contador do card "Para hoje". */
export function CounterLink({ href, icon: Icon, label, count, tone }: {
  href: string; icon: LucideIcon; label: string; count: number; tone?: 'warn' | 'brand'
}) {
  const active = count > 0
  return (
    <Link href={href}
      className="group flex items-center gap-3 h-11 -mx-2 px-2 rounded-lg hover:bg-panel-2 transition-colors focus-visible:outline-none focus-visible:shadow-crm-glow">
      <span className={`h-8 w-8 shrink-0 rounded-lg inline-flex items-center justify-center ${active
        ? tone === 'warn' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
        : 'bg-panel-2 text-muted'}`}>
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </span>
      <span className="flex-1 min-w-0 text-sm text-ink truncate">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${active ? 'text-ink' : 'text-muted'}`}>{count}</span>
      <ArrowRight className="w-4 h-4 text-muted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" strokeWidth={1.75} aria-hidden />
    </Link>
  )
}
