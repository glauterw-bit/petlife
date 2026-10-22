'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, Check, MessageCircle, Pencil, Receipt, Stethoscope, User, UserRound, Wallet } from 'lucide-react'
import type { Appt } from '@/lib/crmApi'
import type { ApptStatus } from '../ui'
import { Btn, brl, fmtPhone, fmtTime, nextStep, waLink, APPT_TYPE } from '../ui'
import { PetAvatar, Sheet, StatusMenu } from '../kit'
import { OPEN_STATUS, confirmText, durationOf, endOf, fmtDuration, hhmm, readyText, serviceOf, startOf } from './utils'

const WD = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

/** Detalhe do atendimento: situação, WhatsApp, editar e finalizar no caixa. */
export function ApptPeek({ appt, open, onClose, clinicName, onStatus, onEdit, onMark }: {
  appt: Appt | null
  open: boolean
  onClose: () => void
  clinicName?: string | null
  onStatus: (a: Appt, s: ApptStatus) => Promise<void>
  onEdit: (a: Appt) => void
  onMark: (a: Appt, what: 'confirm' | 'ready') => void
}) {
  const router = useRouter()
  const a = appt
  const s = a ? startOf(a) : null
  const title = a ? (a.patient_name || a.client_name || 'Atendimento') : 'Atendimento'
  const desc = a && s
    ? `${WD[s.getDay()]}, ${s.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} · ${hhmm(s)}–${hhmm(endOf(a))}`
    : undefined
  const step = a ? nextStep(a) : null
  const canFinish = a ? OPEN_STATUS.includes(a.status) : false
  const waConfirm = a && ['agendado', 'confirmado'].includes(a.status) ? waLink(a.client_phone, confirmText(a, clinicName)) : null
  const waReady = a && a.status === 'pronto' ? waLink(a.client_phone, readyText(a, clinicName)) : null

  return (
    <Sheet open={open && !!a} onClose={onClose} title={title} description={desc} size="md" initialFocus={false}
      footer={a ? (
        <>
          <Btn variant="ghost" icon={Pencil} onClick={() => onEdit(a)}>Editar</Btn>
          {canFinish && (
            <Btn icon={Wallet} onClick={() => router.push(`/clinica/caixa?appointment=${a.id}`)}>Finalizar no caixa</Btn>
          )}
        </>
      ) : undefined}>
      {a && s && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <PetAvatar name={a.patient_name || a.client_name || '?'} species={a.patient_species} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate">{serviceOf(a)}</p>
              <p className="text-xs text-muted">{fmtDuration(durationOf(a))}{a.is_fit_in ? ' · Encaixe' : ''}</p>
            </div>
            <StatusMenu status={a.status} onChange={st => onStatus(a, st)} />
          </div>

          {step && (
            <Btn variant="soft" className="w-full" icon={Check} onClick={() => { void onStatus(a, step.to).catch(() => {}) }}>
              {step.label}
            </Btn>
          )}

          <dl className="rounded-xl bg-panel-2/60 divide-y divide-line text-sm">
            <Row icon={UserRound} label="Tutor">
              <Link href={`/clinica/clientes/${a.client_id}`} className="font-medium text-ink hover:underline">{a.client_name || '—'}</Link>
              {a.client_phone && <span className="block text-xs text-muted tabular-nums">{fmtPhone(a.client_phone)}</span>}
            </Row>
            {a.patient_id && (
              <Row icon={Stethoscope} label="Pet">
                <Link href={`/clinica/pacientes/${a.patient_id}`} className="font-medium text-primary-700 dark:text-primary-300 hover:underline">
                  Abrir ficha de {a.patient_name}
                </Link>
              </Row>
            )}
            <Row icon={User} label="Profissional"><span className="text-ink">{a.staff_name || 'Sem profissional'}</span></Row>
            <Row icon={CalendarClock} label="Tipo"><span className="text-ink">{APPT_TYPE[a.type] ?? a.type}</span></Row>
            {a.price != null && <Row icon={Receipt} label="Valor"><span className="text-ink tabular-nums">{brl(a.price)}</span></Row>}
          </dl>

          {a.notes && (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-1">Observações</p>
              <p className="text-sm text-ink whitespace-pre-wrap">{a.notes}</p>
            </div>
          )}

          {(waConfirm || waReady || ['agendado', 'confirmado', 'pronto'].includes(a.status)) && (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-1.5">WhatsApp</p>
              {waConfirm ? (
                <a href={waConfirm} target="_blank" rel="noreferrer" onClick={() => onMark(a, 'confirm')}
                  className="flex items-center gap-2 h-10 px-3 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25 text-sm font-semibold transition-colors">
                  <MessageCircle className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                  Pedir confirmação
                  {a.confirm_sent_at && <span className="ml-auto text-2xs font-medium opacity-80">enviado às {fmtTime(a.confirm_sent_at)}</span>}
                </a>
              ) : waReady ? (
                <a href={waReady} target="_blank" rel="noreferrer" onClick={() => onMark(a, 'ready')}
                  className="flex items-center gap-2 h-10 px-3 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25 text-sm font-semibold transition-colors">
                  <MessageCircle className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                  Avisar que está pronto
                  {a.ready_notified_at && <span className="ml-auto text-2xs font-medium opacity-80">avisado às {fmtTime(a.ready_notified_at)}</span>}
                </a>
              ) : (
                <p className="text-sm text-muted">Cadastre o telefone do tutor para enviar mensagens.</p>
              )}
            </div>
          )}

          <Timeline a={a} />
        </div>
      )}
    </Sheet>
  )
}

function Row({ icon: Icon, label, children }: { icon: typeof User; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <Icon className="w-4 h-4 mt-0.5 text-muted shrink-0" strokeWidth={1.75} aria-hidden />
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

function Timeline({ a }: { a: Appt }) {
  const steps: Array<[string, string | null]> = [
    ['Confirmado', a.confirmed_at], ['Chegou', a.checked_in_at], ['Em atendimento', a.started_at],
    ['Pronto para retirar', a.ready_at], ['Concluído', a.finished_at],
  ]
  const done = steps.filter(([, t]) => !!t)
  if (!done.length) return null
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-1.5">Andamento</p>
      <ol className="space-y-1.5">
        {done.map(([l, t]) => (
          <li key={l} className="flex items-center gap-2 text-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden />
            <span className="text-ink">{l}</span>
            <span className="ml-auto text-xs text-muted tabular-nums">{fmtTime(t)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
