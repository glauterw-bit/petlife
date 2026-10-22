'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Check, ChevronDown, LogIn, MessageCircle, Receipt, Stethoscope, type LucideIcon } from 'lucide-react'
import type { Appt, ApptStatus } from '@/lib/crmApi'
import { APPT_STATUS, Badge, Btn, fmtTime } from '@/components/crm/ui'
import { PetAvatar, Tabs } from '@/components/crm/kit'
import { dur, spring } from '@/components/crm/motion'
import { WaitTime, serviceOf } from './shared'

export type ColKey = 'fila' | 'chegou' | 'em_atendimento' | 'pronto' | 'concluido'

export const COLUMNS: Array<{ key: ColKey; label: string; statuses: string[]; dot: string }> = [
  { key: 'fila', label: 'Agendado', statuses: ['agendado', 'confirmado'], dot: APPT_STATUS.confirmado.dot },
  { key: 'chegou', label: 'Chegou', statuses: ['chegou'], dot: APPT_STATUS.chegou.dot },
  { key: 'em_atendimento', label: 'Em atendimento', statuses: ['em_atendimento'], dot: APPT_STATUS.em_atendimento.dot },
  { key: 'pronto', label: 'Pronto para retirar', statuses: ['pronto'], dot: APPT_STATUS.pronto.dot },
  { key: 'concluido', label: 'Finalizado', statuses: ['concluido'], dot: APPT_STATUS.concluido.dot },
]

const easeOut = [0.16, 1, 0.3, 1] as [number, number, number, number]

function sortCol(key: ColKey, list: Appt[]) {
  const by = (a: Appt) =>
    key === 'chegou' ? a.checked_in_at || a.starts_at
    : key === 'em_atendimento' ? a.started_at || a.starts_at
    : key === 'pronto' ? a.ready_at || a.starts_at
    : key === 'concluido' ? a.finished_at || a.starts_at
    : a.starts_at
  return [...list].sort((a, b) => by(a).localeCompare(by(b)))
}

export function ReceptionBoard({ appts, now, isDesktop, onStatus, onNotifyReady }: {
  appts: Appt[]
  now: Date
  isDesktop: boolean
  onStatus: (a: Appt, s: ApptStatus) => Promise<void>
  onNotifyReady: (a: Appt) => void
}) {
  const [tab, setTab] = useState<ColKey>('fila')
  const [showOff, setShowOff] = useState(false)
  const cols = COLUMNS.map(c => ({ ...c, items: sortCol(c.key, appts.filter(a => c.statuses.indexOf(a.status) >= 0)) }))
  const off = appts.filter(a => a.status === 'faltou' || a.status === 'cancelado').sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const card = (a: Appt, i: number) => (
    <BoardCard key={a.id} a={a} i={i} now={now} onStatus={onStatus} onNotifyReady={onNotifyReady} />
  )

  return (
    <LayoutGroup id="reception">
      {isDesktop ? (
        <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 overflow-x-auto pb-2 -mx-1 px-1 crm-scroll-x">
          {cols.map(c => (
            <section key={c.key} aria-label={c.label} className="min-w-0 rounded-2xl bg-panel-2/60 dark:bg-panel-2/40 p-2.5 flex flex-col">
              <header className="flex items-center gap-2 px-1 pb-2">
                <span aria-hidden className={`h-2 w-2 rounded-full ${c.dot}`} />
                <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted flex-1 truncate">{c.label}</h2>
                <span className="text-xs font-bold tabular-nums text-ink">{c.items.length}</span>
              </header>
              <div className="space-y-2 min-h-[96px] flex-1">
                <AnimatePresence initial={false}>
                  {c.items.map(card)}
                </AnimatePresence>
                {!c.items.length && (
                  <p className="text-xs text-muted text-center py-6 rounded-xl border border-dashed border-line">Ninguém aqui</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <Tabs id="reception-tabs" value={tab} onChange={setTab} tabs={cols.map(c => ({ value: c.key, label: c.label, count: c.items.length }))} className="mb-3" />
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {(cols.find(c => c.key === tab)?.items ?? []).map(card)}
            </AnimatePresence>
            {!(cols.find(c => c.key === tab)?.items.length) && (
              <p className="text-sm text-muted text-center py-8 rounded-xl border border-dashed border-line">Ninguém nesta etapa.</p>
            )}
          </div>
        </>
      )}

      {off.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowOff(v => !v)} aria-expanded={showOff}
            className="inline-flex items-center gap-1.5 h-9 px-2 -ml-2 rounded-lg text-sm font-semibold text-muted hover:text-ink hover:bg-panel-2">
            <motion.span animate={{ rotate: showOff ? 180 : 0 }} transition={{ duration: dur.fast }} className="inline-flex">
              <ChevronDown className="w-4 h-4" strokeWidth={1.75} aria-hidden />
            </motion.span>
            Faltas e cancelados <span className="tabular-nums text-xs rounded-full px-1.5 bg-panel-2">{off.length}</span>
          </button>
          <AnimatePresence initial={false}>
            {showOff && (
              <motion.div key="off" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: dur.base, ease: easeOut }} className="overflow-hidden">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-2">
                  {off.map(card)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </LayoutGroup>
  )
}

function BoardCard({ a, i, now, onStatus, onNotifyReady }: {
  a: Appt; i: number; now: Date; onStatus: (a: Appt, s: ApptStatus) => Promise<void>; onNotifyReady: (a: Appt) => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const go = (s: ApptStatus) => {
    setBusy(true)
    onStatus(a, s).catch(() => undefined).finally(() => setBusy(false))
  }
  const st = a.status
  const inClinic = st === 'chegou' || st === 'em_atendimento' || st === 'pronto'
  const since = st === 'chegou' ? a.checked_in_at : st === 'em_atendimento' ? a.started_at || a.checked_in_at : st === 'pronto' ? a.ready_at : null
  const sinceLabel = st === 'chegou' ? 'esperando' : st === 'em_atendimento' ? 'em atendimento' : st === 'pronto' ? 'pronto' : undefined
  const off = st === 'faltou' || st === 'cancelado'

  let primary: { label: string; to: ApptStatus; icon: LucideIcon } | null = null
  if (st === 'agendado' || st === 'confirmado') primary = { label: 'Chegou', to: 'chegou', icon: LogIn }
  else if (st === 'chegou') primary = { label: 'Atender', to: 'em_atendimento', icon: Stethoscope }
  else if (st === 'em_atendimento') primary = { label: 'Pronto', to: 'pronto', icon: Check }

  return (
    <motion.article
      layout
      layoutId={`appt-${a.id}`}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: off ? 0.75 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: dur.base, ease: easeOut, delay: i < 12 ? i * 0.02 : 0, layout: spring.soft }}
      className="rounded-xl bg-panel shadow-crm-card overflow-hidden"
    >
      <div className={`p-3 h-full ${APPT_STATUS[st]?.block ?? ''}`}>
      <div className="flex items-start gap-2.5">
        <PetAvatar name={a.patient_name || a.client_name || '?'} species={a.patient_species} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold tabular-nums text-ink">{fmtTime(a.starts_at)}</span>
            {a.patient_id
              ? <Link href={`/clinica/pacientes/${a.patient_id}`} className="text-sm font-semibold text-ink truncate hover:underline">{a.patient_name}</Link>
              : <span className="text-sm font-semibold text-ink truncate">{a.patient_name || 'Sem pet'}</span>}
          </div>
          <p className="text-xs text-muted truncate">{serviceOf(a)}</p>
          <p className="text-xs text-muted truncate">
            {a.client_name}{a.staff_name ? ` · ${a.staff_name}` : ''}
          </p>
        </div>
      </div>

      {(a.is_fit_in || a.confirmed_at || since || off) && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {off && <Badge cls={APPT_STATUS[st]?.cls}>{APPT_STATUS[st]?.label}</Badge>}
          {a.is_fit_in && <Badge tone="warn">Encaixe</Badge>}
          {a.confirmed_at && (st === 'agendado' || st === 'confirmado') && <Badge tone="info">Confirmado</Badge>}
          {inClinic && <WaitTime since={since} now={now} prefix={sinceLabel} />}
        </div>
      )}

      {!off && st !== 'concluido' && (
        <div className="flex gap-1.5 flex-wrap mt-2.5">
          {primary && (
            <Btn size="sm" variant="soft" icon={primary.icon} loading={busy} onClick={() => go(primary!.to)} className="flex-1 min-w-[96px]">
              {primary.label}
            </Btn>
          )}
          {st === 'pronto' && (
            a.ready_notified_at ? (
              <span className="flex-1 min-w-[96px] inline-flex items-center justify-center gap-1 h-8 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Check className="w-3.5 h-3.5" strokeWidth={2} aria-hidden /> Avisado às {fmtTime(a.ready_notified_at)}
              </span>
            ) : (
              <Btn size="sm" variant="outline" icon={MessageCircle} disabled={!a.client_phone}
                title={a.client_phone ? undefined : 'Sem celular cadastrado'}
                onClick={() => onNotifyReady(a)} className="flex-1 min-w-[96px]">
                Avisar que está pronto
              </Btn>
            )
          )}
          {inClinic && (
            <Btn size="sm" icon={Receipt} onClick={() => router.push(`/clinica/caixa?appointment=${a.id}`)} className="flex-1 min-w-[96px]">
              Finalizar
            </Btn>
          )}
        </div>
      )}
      </div>
    </motion.article>
  )
}
