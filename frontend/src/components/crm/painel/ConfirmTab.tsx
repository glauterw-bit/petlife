'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, Check, MessageCircle } from 'lucide-react'
import { crm, type Appt, type ApptPatch } from '@/lib/crmApi'
import { emitCrmChange, useCrmChange } from '@/components/crm/CrmShell'
import { APPT_TYPE, Badge, Btn, Card, StatusBadge, dayRange, fmtPhone, fmtTime, waLink, ymd } from '@/components/crm/ui'
import { DataList, DateNav, EmptyState, PetAvatar, useAsync, type Column } from '@/components/crm/kit'
import { AnimatedNumber } from '@/components/crm/motion'
import { useToast } from '@/components/ui/ToastContext'
import { ddmm, errMsg, firstName, openWa } from './shared'

const CONFIRMED = ['confirmado', 'chegou', 'em_atendimento', 'pronto', 'concluido']

function tomorrow() {
  const t = new Date()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)
}

export function ConfirmTab({ clinicName }: { clinicName: string }) {
  const toast = useToast()
  const [day, setDay] = useState(tomorrow)
  const key = ymd(day)
  const q = useAsync(() => { const [a, b] = dayRange(day); return crm.appointments(a, b) }, [key])
  useCrmChange(['appointment'], q.reload)
  const dataRef = useRef(q.data)
  dataRef.current = q.data

  const rows = useMemo(
    () => (q.data ? q.data.filter(a => a.status !== 'cancelado' && a.status !== 'faltou').sort((a, b) => a.starts_at.localeCompare(b.starts_at)) : null),
    [q.data],
  )
  const total = rows?.length ?? 0
  const sent = rows?.filter(a => a.confirm_sent_at).length ?? 0
  const confirmed = rows?.filter(a => CONFIRMED.indexOf(a.status) >= 0).length ?? 0

  async function patch(a: Appt, d: ApptPatch, opt: Partial<Appt>, failMsg: string) {
    const prev = dataRef.current
    if (prev) q.setData(prev.map(x => (x.id === a.id ? { ...x, ...opt } : x)))
    try {
      const saved = await crm.patchAppt(a.id, d)
      q.setData((dataRef.current ?? []).map(x => (x.id === a.id ? saved : x)))
      emitCrmChange('appointment')
    } catch (e) {
      if (prev) q.setData(prev)
      toast.error(errMsg(e, failMsg))
    }
  }

  const service = (a: Appt) => a.item_name || (APPT_TYPE[a.type] ?? a.type).toLowerCase()
  const whenText = () => {
    const t = new Date()
    if (key === ymd(t)) return 'hoje'
    if (key === ymd(tomorrow())) return 'amanhã'
    return `em ${ddmm(day)}`
  }

  function sendConfirm(a: Appt) {
    const text = `Olá, ${firstName(a.client_name)}! Confirmando ${service(a)} de ${a.patient_name || 'seu pet'} na ${clinicName} ${whenText()} às ${fmtTime(a.starts_at)}. Pode responder SIM para confirmar ou nos avisar se precisar remarcar.`
    const url = waLink(a.client_phone, text)
    if (!url) return
    openWa(url)
    patch(a, { mark_confirm_sent: true }, { confirm_sent_at: new Date().toISOString() }, 'Não foi possível marcar o envio.')
  }
  const markConfirmed = (a: Appt) =>
    patch(a, { status: 'confirmado' }, { status: 'confirmado', confirmed_at: a.confirmed_at ?? new Date().toISOString() }, 'Não foi possível confirmar.')

  const actions = (a: Appt) => {
    const isConf = CONFIRMED.indexOf(a.status) >= 0
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
        {a.client_phone ? (
          <Btn size="sm" variant={a.confirm_sent_at ? 'ghost' : 'soft'} icon={MessageCircle} onClick={() => sendConfirm(a)}>
            {a.confirm_sent_at ? `Enviada às ${fmtTime(a.confirm_sent_at)}` : 'Enviar confirmação'}
          </Btn>
        ) : (
          <span title="Sem celular cadastrado">
            <Btn size="sm" variant="ghost" icon={MessageCircle} disabled>Sem celular cadastrado</Btn>
          </span>
        )}
        {isConf
          ? <StatusBadge status={a.status} />
          : <Btn size="sm" variant="outline" icon={Check} onClick={() => markConfirmed(a)}>Confirmado</Btn>}
      </span>
    )
  }

  const columns: Column<Appt>[] = [
    { key: 'time', header: 'Hora', className: 'w-16', cell: a => <span className="font-bold tabular-nums">{fmtTime(a.starts_at)}</span> },
    {
      key: 'pet', header: 'Pet e serviço', cell: a => (
        <span className="inline-flex items-center gap-2.5 min-w-0">
          <PetAvatar name={a.patient_name || a.client_name || '?'} species={a.patient_species} size="sm" />
          <span className="min-w-0">
            {a.patient_id
              ? <Link href={`/clinica/pacientes/${a.patient_id}`} className="block font-semibold truncate hover:underline">{a.patient_name}</Link>
              : <span className="block font-semibold truncate">{a.patient_name || 'Sem pet'}</span>}
            <span className="block text-xs text-muted truncate">{a.item_name || APPT_TYPE[a.type] || a.type}{a.is_fit_in ? ' · encaixe' : ''}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'tutor', header: 'Tutor', cell: a => (
        <span className="block min-w-0">
          <Link href={`/clinica/clientes/${a.client_id}`} className="block truncate hover:underline">{a.client_name}</Link>
          <span className="block text-xs text-muted tabular-nums">{a.client_phone ? fmtPhone(a.client_phone) : 'Sem celular'}</span>
        </span>
      ),
    },
    { key: 'staff', header: 'Profissional', hideBelow: 'lg', cell: a => <span className="text-muted">{a.staff_name || '—'}</span> },
    { key: 'actions', header: 'Confirmação', align: 'right', cell: actions },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <DateNav mode="day" value={day} onChange={d => setDay(d)} showToday={false} />
        {rows && total > 0 && (
          <p className="text-sm text-muted tabular-nums" aria-live="polite">
            <b className="text-ink"><AnimatedNumber value={sent} /></b> de {total} {sent === 1 ? 'enviado' : 'enviados'}
            {' · '}<b className="text-emerald-700 dark:text-emerald-300"><AnimatedNumber value={confirmed} /></b> {confirmed === 1 ? 'confirmado' : 'confirmados'}
          </p>
        )}
      </div>
      {rows && total > 0 && (
        <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden mb-3" aria-hidden>
          <div className="h-full bg-emerald-500 dark:bg-emerald-400 transition-[width] duration-300 ease-out" style={{ width: `${(confirmed / total) * 100}%` }} />
        </div>
      )}
      <Card>
        <DataList
          ariaLabel="Agendamentos para confirmar"
          rows={rows}
          loading={q.loading}
          error={q.error}
          onRetry={q.reload}
          columns={columns}
          rowKey={a => a.id}
          renderMobile={a => (
            <div className="flex items-start gap-3">
              <span className="w-11 shrink-0 text-sm font-bold tabular-nums text-ink pt-1.5">{fmtTime(a.starts_at)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">{a.patient_name || 'Sem pet'} <span className="font-normal text-muted">· {a.item_name || APPT_TYPE[a.type] || a.type}</span></p>
                <p className="text-xs text-muted truncate">{a.client_name}{a.client_phone ? ` · ${fmtPhone(a.client_phone)}` : ''}</p>
                {a.is_fit_in && <div className="mt-1"><Badge tone="warn">Encaixe</Badge></div>}
                <div className="mt-2 flex">{actions(a)}</div>
              </div>
            </div>
          )}
          empty={<EmptyState icon={CalendarCheck} compact title="Nenhum agendamento neste dia" hint="Escolha outro dia para enviar as confirmações." />}
        />
      </Card>
    </div>
  )
}
