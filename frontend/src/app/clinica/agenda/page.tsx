'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CalendarPlus, Columns3, List, ListTodo, Users, X } from 'lucide-react'
import { crm, isCrmError, type Appt, type Client, type WaitItem } from '@/lib/crmApi'
import { useToast } from '@/components/ui/ToastContext'
import { useCrm, useCrmChange, emitCrmChange } from '@/components/crm/CrmShell'
import { ApptModal } from '@/components/crm/forms'
import { Btn, Card, PageHead, dayRange, weekRange, type ApptStatus } from '@/components/crm/ui'
import { Chip, DateNav, ErrorState, PersonAvatar, Segmented, dateNavLabel, useAsync, useConfirm, useHotkey, useMediaQuery, useNow } from '@/components/crm/kit'
import { dur, slideDay } from '@/components/crm/motion'
import { TimeGrid, type GridColumn } from '@/components/crm/agenda/TimeGrid'
import { ApptPeek } from '@/components/crm/agenda/ApptPeek'
import { AgendaList } from '@/components/crm/agenda/AgendaList'
import { WaitlistSheet } from '@/components/crm/agenda/WaitlistSheet'
import { AgendaSkeleton } from '@/components/crm/agenda/AgendaSkeleton'
import {
  addDays, durationOf, hhmm, hourRange, readPrefs, sameDay, startOf, startOfDay, writePrefs, type AgendaView,
} from '@/components/crm/agenda/utils'

const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const errMsg = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

interface ModalState {
  initial?: Appt | null
  initialStart?: Date
  presetStaffId?: number | null
  presetClient?: Client | null
  presetPatientId?: number
  presetItemId?: number
  waitId?: number
}

export default function AgendaPage() {
  const { me } = useCrm()
  const toast = useToast()
  const { confirm } = useConfirm()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const finePointer = useMediaQuery('(min-width: 768px) and (pointer: fine)')
  const now = useNow(60000)

  /* ── preferências (lembradas neste navegador) ── */
  const [ready, setReady] = useState(false)
  const [view, setView] = useState<AgendaView>('dia')
  const [staff, setStaff] = useState<number | null>(null)
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const [dir, setDir] = useState<1 | -1 | 0>(0)
  const [showCancelled, setShowCancelled] = useState(false)
  useEffect(() => {
    const p = readPrefs()
    const mobile = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 767px)').matches
    setView(p.view ?? (mobile ? 'lista' : 'dia'))
    setStaff(p.staff ?? null)
    setReady(true)
  }, [])
  useEffect(() => { if (ready) writePrefs({ view, staff }) }, [ready, view, staff])

  const eff: AgendaView = isMobile && view === 'semana' ? 'lista' : view
  const mode: 'day' | 'week' = eff === 'semana' ? 'week' : 'day'
  const dayKey = day.getTime()
  const [start, end] = useMemo(() => (mode === 'week' ? weekRange(new Date(dayKey)) : dayRange(new Date(dayKey))), [mode, dayKey])
  const key = `${start.getTime()}|${end.getTime()}|${staff ?? ''}`

  /* ── dados ── */
  const q = useAsync<{ key: string; list: Appt[] }>(
    () => (ready ? crm.appointments(start, end, staff).then(list => ({ key, list })) : new Promise(() => {})),
    [key, ready],
  )
  const appts = q.data && q.data.key === key ? q.data.list : null
  const dataRef = useRef(q.data)
  dataRef.current = q.data
  useCrmChange(['appointment'], q.reload)

  const teamQ = useAsync(() => crm.team(), [])
  const team = useMemo(() => teamQ.data ?? [], [teamQ.data])
  useEffect(() => {
    if (staff != null && teamQ.data && !teamQ.data.some(m => m.user_id === staff)) setStaff(null)
  }, [teamQ.data, staff])

  const waitQ = useAsync(() => crm.waitlist('aguardando'), [])
  useCrmChange(['waitlist'], waitQ.reload)
  const waitCount = waitQ.data?.length ?? 0

  /* ── estado das gavetas ── */
  const [modalOpen, setModalOpen] = useState(false)
  const [modal, setModal] = useState<ModalState>({})
  const [peekId, setPeekId] = useState<number | null>(null)
  const lastPeek = useRef<Appt | null>(null)
  const [waitOpen, setWaitOpen] = useState(false)
  const [waitHint, setWaitHint] = useState(false)
  useEffect(() => {
    if (!waitHint) return
    const t = setTimeout(() => setWaitHint(false), 10000)
    return () => clearTimeout(t)
  }, [waitHint])

  const peekAppt = (peekId != null && appts?.find(a => a.id === peekId)) || (peekId != null ? lastPeek.current : null)
  if (peekAppt) lastPeek.current = peekAppt

  const openNew = (m: ModalState = {}) => { setModal(m); setModalOpen(true) }

  /* ── atualização local (otimista) ── */
  const setList = (fn: (l: Appt[]) => Appt[]) => {
    const d = dataRef.current
    if (!d) return
    const next = { key: d.key, list: fn(d.list) }
    dataRef.current = next
    q.setData(next)
  }
  const replace = (a: Appt) => setList(l => l.map(x => (x.id === a.id ? a : x)))

  async function changeStatus(a: Appt, s: ApptStatus) {
    const prev = a
    replace({ ...a, status: s })
    try {
      const res = await crm.patchAppt(a.id, { status: s })
      replace(res)
      emitCrmChange('appointment')
      if (s === 'cancelado' && waitCount > 0) {
        setWaitHint(true)
        toast.info(`Há ${plural(waitCount, 'pessoa', 'pessoas')} na lista de espera.`)
      }
    } catch (e) {
      replace(prev)
      toast.error(errMsg(e, 'Não foi possível mudar a situação.'))
      throw e
    }
  }

  async function move(a: Appt, s: Date, staffId: number | null | undefined) {
    const minutes = durationOf(a)
    const e = new Date(s.getTime() + minutes * 60000)
    const staffChanged = staffId !== undefined && staffId !== a.staff_user_id
    const member = staffChanged && staffId != null ? team.find(m => m.user_id === staffId) : null
    const moved: Appt = {
      ...a, starts_at: s.toISOString(), ends_at: e.toISOString(), duration_min: minutes,
      ...(staffChanged ? { staff_user_id: staffId ?? null, staff_name: member?.name ?? null } : {}),
    }
    const body = {
      starts_at: s.toISOString(), ends_at: e.toISOString(),
      ...(staffChanged ? { staff_user_id: staffId ?? null } : {}),
    }
    replace(moved)
    try {
      const res = await crm.patchAppt(a.id, body)
      replace(res)
      emitCrmChange('appointment')
      toast.success(`${a.patient_name || a.client_name || 'Atendimento'} remarcado para ${hhmm(s)}${mode === 'week' && !sameDay(s, startOf(a)) ? ` de ${WD[s.getDay()]}` : ''}.`)
    } catch (err) {
      replace(a)
      if (isCrmError(err) && err.status === 409 && err.data?.code === 'conflict') {
        const others = (err.data.conflicts ?? []).map(c => `${c.patient_name || c.client_name} às ${hhmm(startOf(c))}`).join(', ')
        const ok = await confirm({
          title: 'Horário ocupado. Manter como encaixe?',
          message: others ? `Já existe ${others} com ${moved.staff_name || 'este profissional'}.` : err.data.message,
          confirmLabel: 'Manter como encaixe',
          cancelLabel: 'Voltar',
        })
        if (!ok) return
        replace({ ...moved, is_fit_in: true })
        try {
          const res = await crm.patchAppt(a.id, { ...body, allow_conflict: true, is_fit_in: true })
          replace(res)
          emitCrmChange('appointment')
          toast.success('Encaixe confirmado.')
        } catch (e2) {
          replace(a)
          toast.error(errMsg(e2, 'Não foi possível remarcar.'))
        }
      } else {
        toast.error(errMsg(err, 'Não foi possível remarcar.'))
      }
    }
  }

  function mark(a: Appt, what: 'confirm' | 'ready') {
    crm.patchAppt(a.id, what === 'confirm' ? { mark_confirm_sent: true } : { mark_ready_notified: true })
      .then(res => { replace(res); emitCrmChange('appointment') })
      .catch(e => toast.error(errMsg(e, 'Não foi possível registrar o envio.')))
  }

  async function scheduleFromWait(w: WaitItem) {
    let client: Client = {
      id: w.client_id, name: w.client_name, phone: w.client_phone, email: null, document: null, address: null,
      notes: null, petlife_linked: false, created_at: w.created_at,
    }
    try { client = await crm.client(w.client_id) } catch { /* segue com os dados da lista */ }
    const base = sameDay(day, new Date()) || day < new Date() ? new Date() : day
    const st = new Date(base.getFullYear(), base.getMonth(), base.getDate(), w.period === 'tarde' ? 14 : 9, 0)
    if (st < new Date()) { st.setTime(Date.now()); st.setMinutes(0, 0, 0); st.setHours(st.getHours() + 1) }
    setWaitOpen(false)
    openNew({
      presetClient: client, presetPatientId: w.patient_id ?? undefined, presetItemId: w.item_id ?? undefined,
      presetStaffId: w.staff_user_id, initialStart: st, waitId: w.id,
    })
  }

  async function onSaved(a: Appt) {
    const wid = modal.waitId
    if (wid) {
      try {
        await crm.patchWait(wid, { status: 'agendado', appointment_id: a.id })
        emitCrmChange('waitlist')
      } catch (e) {
        toast.error(errMsg(e, 'O agendamento foi salvo, mas não saiu da lista de espera.'))
      }
    }
    if (!modal.initial) {
      const s = startOf(a)
      if (s < start || s >= end) { setDir(s > start ? 1 : -1); setDay(startOfDay(s)) }
    }
  }

  /* ── navegação ── */
  const goTo = (d: Date, dr: 1 | -1 | 0) => { setDir(dr); setDay(startOfDay(d)) }
  const shift = (n: 1 | -1) => goTo(addDays(day, mode === 'week' ? 7 * n : n), n)
  const blocked = (e: KeyboardEvent) =>
    !!document.querySelector('[aria-modal="true"]') || !!(e.target as HTMLElement | null)?.closest?.('[role=tablist],[role=menu],[role=dialog]')
  useHotkey('ArrowLeft', e => { if (blocked(e)) return; e.preventDefault(); shift(-1) }, { when: ready })
  useHotkey('ArrowRight', e => { if (blocked(e)) return; e.preventDefault(); shift(1) }, { when: ready })
  useHotkey('t', e => { if (blocked(e)) return; goTo(new Date(), new Date() > day ? 1 : -1) }, { when: ready })

  /* ── colunas da grade ── */
  const visible = useMemo(
    () => (appts ?? []).filter(a => showCancelled || a.status !== 'cancelado'),
    [appts, showCancelled],
  )
  const cancelledCount = (appts ?? []).filter(a => a.status === 'cancelado').length

  const columns: GridColumn[] = useMemo(() => {
    const today = new Date()
    if (mode === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i)
        const list = visible.filter(a => sameDay(startOf(a), d))
        return {
          key: `d${d.getTime()}`, date: d, label: `${WD[d.getDay()]} ${d.getDate()}`,
          sub: list.length ? plural(list.length, 'atendimento', 'atendimentos') : 'livre',
          isToday: sameDay(d, today), appts: list,
        }
      })
    }
    const isToday = sameDay(start, today)
    if (staff != null) {
      const m = team.find(x => x.user_id === staff)
      return [{ key: `s${staff}`, date: start, label: m?.name ?? 'Profissional', person: m?.name, sub: plural(visible.length, 'atendimento', 'atendimentos'), staffId: staff, isToday, appts: visible }]
    }
    const ids: Array<number | null> = []
    for (const a of visible) if (!ids.includes(a.staff_user_id)) ids.push(a.staff_user_id)
    if (!ids.length) {
      return [{ key: 'all', date: start, label: dateNavLabel('day', start), sub: 'Clique num horário para agendar', isToday, appts: [] }]
    }
    const order = (id: number | null) => (id == null ? 1e9 : team.findIndex(m => m.user_id === id) + 1 || 1e8)
    ids.sort((x, y) => order(x) - order(y))
    return ids.map(id => {
      const list = visible.filter(a => a.staff_user_id === id)
      const name = id == null ? 'Sem profissional' : team.find(m => m.user_id === id)?.name ?? list[0]?.staff_name ?? 'Profissional'
      return { key: `s${id ?? 'none'}`, date: start, label: name, person: id == null ? undefined : name, sub: plural(list.length, 'atendimento', 'atendimentos'), staffId: id, isToday, appts: list }
    })
  }, [mode, start, visible, staff, team])

  const [h0, h1] = useMemo(() => hourRange(visible), [visible])

  /* ── textos ── */
  const total = appts ? appts.filter(a => a.status !== 'cancelado').length : null
  const sub = total == null ? 'Carregando atendimentos' : mode === 'week'
    ? `${plural(total, 'atendimento', 'atendimentos')} na semana`
    : total ? `${plural(total, 'atendimento', 'atendimentos')} no dia` : 'Nenhum atendimento no dia'

  const viewOptions = [
    { value: 'dia' as const, label: 'Dia', icon: CalendarDays },
    ...(isMobile ? [] : [{ value: 'semana' as const, label: 'Semana', icon: Columns3 }]),
    { value: 'lista' as const, label: 'Lista', icon: List },
  ]

  const gridKey = `${eff}-${start.getTime()}-${staff ?? 'all'}`

  return (
    <div>
      <PageHead
        title="Agenda"
        sub={sub}
        actions={
          <>
            <Btn variant="outline" icon={ListTodo} onClick={() => setWaitOpen(true)}>
              Lista de espera{waitQ.data ? <span className="tabular-nums text-muted">({waitCount})</span> : null}
            </Btn>
            <Btn icon={CalendarPlus} onClick={() => openNew({ presetStaffId: staff })}>Agendar</Btn>
          </>
        }
      />

      {/* barra de controles */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <DateNav mode={mode} value={day} onChange={goTo} />
        <Segmented id="agenda-view" value={eff} onChange={v => { setView(v); setDir(0) }} options={viewOptions} ariaLabel="Modo de visualização" className="ml-auto" />
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto crm-scroll-x -mx-4 px-4 md:mx-0 md:px-0 pb-1 mb-3" role="group" aria-label="Filtrar por profissional">
        <Chip active={staff == null} onClick={() => setStaff(null)} icon={Users}>Toda a equipe</Chip>
        {team.map(m => (
          <Chip key={m.user_id} active={staff === m.user_id} onClick={() => setStaff(staff === m.user_id ? null : m.user_id)}>
            <span className="-ml-2 inline-flex"><PersonAvatar name={m.name} size="sm" /></span>
            {m.name.split(' ')[0]}
          </Chip>
        ))}
        {cancelledCount > 0 && (
          <span className="ml-auto pl-2 shrink-0">
            <Chip active={showCancelled} onClick={() => setShowCancelled(v => !v)} count={cancelledCount}>Cancelados</Chip>
          </span>
        )}
      </div>

      {/* aviso de vaga com lista de espera */}
      <AnimatePresence>
        {waitHint && (
          <motion.div key="hint" initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: dur.base }} className="overflow-hidden">
            <Card className="mb-3 !py-3 flex items-center gap-3 border-l-[3px] border-amber-500 dark:border-amber-400">
              <ListTodo className="w-[18px] h-[18px] text-amber-600 dark:text-amber-300 shrink-0" strokeWidth={1.75} aria-hidden />
              <p className="text-sm text-ink flex-1 min-w-0">
                Um horário vagou. Há {plural(waitCount, 'pessoa', 'pessoas')} na lista de espera.
              </p>
              <Btn size="sm" variant="soft" onClick={() => { setWaitHint(false); setWaitOpen(true) }}>Ver lista</Btn>
              <button type="button" onClick={() => setWaitHint(false)} aria-label="Fechar aviso"
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-panel-2">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* conteúdo */}
      {!appts && q.error ? (
        <Card><ErrorState message={q.error} onRetry={q.reload} /></Card>
      ) : (
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={gridKey} custom={dir} variants={slideDay} initial="enter" animate="center" exit="exit">
            {!appts ? (
              <AgendaSkeleton list={eff === 'lista'} columns={mode === 'week' ? 7 : isMobile ? 1 : 3} />
            ) : eff === 'lista' ? (
              <AgendaList appts={visible} onOpen={a => setPeekId(a.id)} onStatus={changeStatus} onNew={() => openNew({ presetStaffId: staff })} />
            ) : (
              <TimeGrid
                columns={columns}
                startHour={h0}
                endHour={h1}
                now={now}
                minColWidth={mode === 'week' ? 132 : columns.length > 1 ? 180 : 220}
                dragEnabled={finePointer}
                onSlot={(d, sid) => openNew({ initialStart: d, presetStaffId: sid !== undefined ? sid : staff })}
                onOpen={a => setPeekId(a.id)}
                onMove={(a, d, sid) => { void move(a, d, sid) }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {eff !== 'lista' && appts && (
        <p className="hidden md:block text-xs text-muted mt-2">
          {finePointer ? 'Arraste um atendimento para remarcar. ' : ''}Use ← e → para trocar {mode === 'week' ? 'de semana' : 'de dia'} e T para voltar a hoje.
        </p>
      )}

      <ApptPeek
        appt={peekAppt}
        open={peekId != null}
        onClose={() => setPeekId(null)}
        clinicName={me.clinic.name}
        onStatus={changeStatus}
        onEdit={a => { setPeekId(null); openNew({ initial: a }) }}
        onMark={mark}
      />

      <WaitlistSheet
        open={waitOpen}
        onClose={() => setWaitOpen(false)}
        items={waitQ.data}
        error={waitQ.error}
        onRetry={waitQ.reload}
        onSchedule={w => { void scheduleFromWait(w) }}
        team={team}
        clinicName={me.clinic.name}
      />

      <ApptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={a => { void onSaved(a) }}
        onDeleted={() => setPeekId(null)}
        initial={modal.initial ?? null}
        initialStart={modal.initialStart}
        presetClient={modal.presetClient ?? null}
        presetPatientId={modal.presetPatientId}
        presetItemId={modal.presetItemId}
        presetStaffId={modal.presetStaffId ?? null}
      />
    </div>
  )
}
