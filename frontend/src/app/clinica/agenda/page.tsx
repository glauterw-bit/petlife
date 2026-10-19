'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { crm, type Appt, type Member } from '@/lib/crmApi'
import { Card, PageHead, Btn, Badge, Empty, Select, fmtTime, waLink, APPT_STATUS, APPT_TYPE, brl } from '@/components/crm/ui'
import { ApptModal } from '@/components/crm/forms'
import { useToast } from '@/components/ui/ToastContext'

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

export default function Agenda() {
  const router = useRouter()
  const { error } = useToast()
  const [day, setDay] = useState(startOfDay(new Date()))
  const [view, setView] = useState<'dia' | 'semana'>('dia')
  const [appts, setAppts] = useState<Appt[]>([])
  const [team, setTeam] = useState<Member[]>([])
  const [staff, setStaff] = useState('')
  const [open, setOpen] = useState(false)
  const [slot, setSlot] = useState<Date | undefined>()

  const range = useMemo(() => {
    if (view === 'dia') return [day, addDays(day, 1)] as const
    const s = addDays(day, -((day.getDay() + 6) % 7))
    return [s, addDays(s, 7)] as const
  }, [day, view])
  const load = () => crm.appointments(range[0], range[1]).then(setAppts).catch(() => {})
  useEffect(() => { load() }, [range]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { crm.team().then(setTeam).catch(() => {}) }, [])

  const shown = appts.filter(a => !staff || String(a.staff_user_id) === staff)
  async function setStatus(a: Appt, status: string) {
    try { await crm.patchAppt(a.id, { status }); load() } catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }
  const hours = Array.from({ length: 13 }, (_, i) => 7 + i)

  const row = (a: Appt) => {
    const wa = waLink(a.client_phone, `Olá, ${a.client_name?.split(' ')[0] ?? ''}! Confirmando ${APPT_TYPE[a.type]?.toLowerCase() ?? 'o atendimento'} de ${a.patient_name ?? 'seu pet'} em ${new Date(a.starts_at + 'Z').toLocaleDateString('pt-BR')} às ${fmtTime(a.starts_at)}. Podemos confirmar? 🐾`)
    return (
      <div key={a.id} className="flex items-center gap-2 flex-wrap rounded-xl border border-surface-100 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2">
        <span className="text-sm font-bold tabular-nums w-11">{fmtTime(a.starts_at)}</span>
        <div className="flex-1 min-w-[150px]">
          <p className="text-sm font-semibold text-surface-900 dark:text-white">
            {a.patient_id ? <Link className="hover:underline" href={`/clinica/pacientes/${a.patient_id}`}>{a.patient_name}</Link> : '—'}
            <span className="font-normal text-surface-500"> · {APPT_TYPE[a.type]}{a.price ? ` · ${brl(a.price)}` : ''}</span>
          </p>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            <Link className="hover:underline" href={`/clinica/clientes/${a.client_id}`}>{a.client_name}</Link>{a.staff_name ? ` · ${a.staff_name}` : ''}{a.notes ? ` · ${a.notes}` : ''}
          </p>
        </div>
        <Badge cls={APPT_STATUS[a.status]?.cls}>{APPT_STATUS[a.status]?.label}</Badge>
        <Select className="!w-auto !py-1 text-xs" value="" onChange={e => e.target.value && setStatus(a, e.target.value)}>
          <option value="">Mudar…</option>
          {Object.entries(APPT_STATUS).filter(([k]) => k !== a.status).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        {wa && a.status === 'agendado' && <a href={wa} target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-700">Confirmar no WhatsApp</a>}
        {['chegou', 'em_atendimento', 'confirmado', 'agendado'].includes(a.status) && (
          <Btn className="!py-1 !px-2.5 text-xs" onClick={() => router.push(`/clinica/caixa?appointment=${a.id}`)}>Finalizar</Btn>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHead title="Agenda" sub={view === 'dia' ? day.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : `Semana de ${range[0].toLocaleDateString('pt-BR')}`}
        actions={<Btn onClick={() => { setSlot(undefined); setOpen(true) }}>+ Agendar</Btn>} />
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Btn variant="ghost" onClick={() => setDay(addDays(day, view === 'dia' ? -1 : -7))} aria-label="Anterior"><ChevronLeft className="w-4 h-4" /></Btn>
        <Btn variant="ghost" onClick={() => setDay(startOfDay(new Date()))}>Hoje</Btn>
        <Btn variant="ghost" onClick={() => setDay(addDays(day, view === 'dia' ? 1 : 7))} aria-label="Próximo"><ChevronRight className="w-4 h-4" /></Btn>
        <input type="date" className="px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm"
          value={new Date(day.getTime() - day.getTimezoneOffset() * 60000).toISOString().slice(0, 10)}
          onChange={e => e.target.value && setDay(new Date(e.target.value + 'T00:00:00'))} />
        <div className="flex rounded-xl border border-surface-200 dark:border-surface-600 overflow-hidden">
          {(['dia', 'semana'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-2 text-sm font-semibold ${view === v ? 'bg-primary-500 text-white' : 'text-surface-600 dark:text-surface-300'}`}>{v === 'dia' ? 'Dia' : 'Semana'}</button>
          ))}
        </div>
        <Select className="!w-auto" value={staff} onChange={e => setStaff(e.target.value)}>
          <option value="">Toda a equipe</option>
          {team.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
        </Select>
      </div>

      {view === 'dia' ? (
        <Card className="!p-0 overflow-hidden">
          {hours.map(h => {
            const list = shown.filter(a => new Date(a.starts_at + 'Z').getHours() === h)
            const slotDate = new Date(day); slotDate.setHours(h, 0, 0, 0)
            return (
              <div key={h} className="flex border-b border-surface-100 dark:border-surface-700 last:border-0 min-h-[56px]">
                <button onClick={() => { setSlot(slotDate); setOpen(true) }} title="Agendar neste horário"
                  className="w-16 shrink-0 text-xs font-semibold text-surface-400 pt-2 hover:text-primary-600">{String(h).padStart(2, '0')}:00</button>
                <div className="flex-1 p-1.5 space-y-1.5">{list.map(row)}</div>
              </div>
            )
          })}
          {shown.some(a => { const h = new Date(a.starts_at + 'Z').getHours(); return h < 7 || h > 19 }) && (
            <div className="p-2 space-y-1.5">{shown.filter(a => { const h = new Date(a.starts_at + 'Z').getHours(); return h < 7 || h > 19 }).map(row)}</div>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 7 }, (_, i) => addDays(range[0], i)).map(d => {
            const list = shown.filter(a => new Date(a.starts_at + 'Z').toDateString() === d.toDateString())
            return (
              <Card key={d.toISOString()}>
                <button className="font-bold text-surface-900 dark:text-white mb-2 hover:underline" onClick={() => { setDay(d); setView('dia') }}>
                  {d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} · {list.length}
                </button>
                {list.length ? <div className="space-y-1.5">{list.map(row)}</div> : <Empty>Sem atendimentos.</Empty>}
              </Card>
            )
          })}
        </div>
      )}
      <ApptModal open={open} onClose={() => setOpen(false)} onSaved={load} initialStart={slot} />
    </div>
  )
}
