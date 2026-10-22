'use client'

import { useEffect, useState } from 'react'
import { CalendarPlus, ListPlus, MessageCircle, Trash2, Users } from 'lucide-react'
import { crm, type Client, type Item, type Member, type Patient, type WaitItem } from '@/lib/crmApi'
import { useToast } from '@/components/ui/ToastContext'
import { Btn, Field, Select, TextArea, fmtDate, fmtPhone, waLink } from '../ui'
import { ClientPicker } from '../forms'
import { Chip, EmptyState, ErrorState, PetAvatar, Segmented, Sheet, SkeletonRows, useConfirm } from '../kit'
import { MotionItem, MotionList } from '../motion'
import { emitCrmChange } from '../kit/events'

const PERIOD: Record<WaitItem['period'], string> = { manha: 'Manhã', tarde: 'Tarde', qualquer: 'Qualquer horário' }
const DAYS = [['seg', 'Seg'], ['ter', 'Ter'], ['qua', 'Qua'], ['qui', 'Qui'], ['sex', 'Sex'], ['sab', 'Sáb'], ['dom', 'Dom']] as const
const DAY_LABEL: Record<string, string> = Object.fromEntries(DAYS)

const errMsg = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb)

function prefText(w: WaitItem) {
  const days = (w.days || '').split(',').map(d => d.trim()).filter(Boolean).map(d => DAY_LABEL[d] ?? d)
  return `${PERIOD[w.period] ?? 'Qualquer horário'}${days.length ? ` · ${days.join(', ')}` : ''}`
}

/** Lista de espera: quem quer um horário quando vagar. */
export function WaitlistSheet({ open, onClose, items, error, onRetry, onSchedule, team, clinicName }: {
  open: boolean
  onClose: () => void
  items: WaitItem[] | null
  error: string | null
  onRetry: () => void
  onSchedule: (w: WaitItem) => void
  team: Member[]
  clinicName?: string | null
}) {
  const [mode, setMode] = useState<'list' | 'add'>('list')
  useEffect(() => { if (open) setMode('list') }, [open])

  return (
    <Sheet open={open} onClose={onClose} size="md" initialFocus={false}
      title={mode === 'add' ? 'Adicionar à lista de espera' : 'Lista de espera'}
      description={mode === 'add' ? 'Quando vagar um horário, você avisa pelo WhatsApp.' : 'Quem quer um horário assim que vagar.'}
      footer={mode === 'list' ? <Btn icon={ListPlus} onClick={() => setMode('add')}>Adicionar à lista</Btn> : undefined}>
      {mode === 'add'
        ? <AddForm team={team} onCancel={() => setMode('list')} onDone={() => { setMode('list'); onRetry() }} />
        : <List items={items} error={error} onRetry={onRetry} onSchedule={onSchedule} onAdd={() => setMode('add')} clinicName={clinicName} />}
    </Sheet>
  )
}

function List({ items, error, onRetry, onSchedule, onAdd, clinicName }: {
  items: WaitItem[] | null; error: string | null; onRetry: () => void; onSchedule: (w: WaitItem) => void; onAdd: () => void; clinicName?: string | null
}) {
  const { confirm } = useConfirm()
  const toast = useToast()
  const [removing, setRemoving] = useState<number | null>(null)

  if (!items && error) return <ErrorState message={error} onRetry={onRetry} compact />
  if (!items) return <SkeletonRows rows={4} />
  if (!items.length) {
    return <EmptyState icon={Users} title="Ninguém na lista de espera" hint="Quando um tutor pedir um horário que está cheio, anote aqui para avisar quando vagar."
      action={<Btn variant="soft" icon={ListPlus} onClick={onAdd}>Adicionar à lista</Btn>} />
  }

  const remove = async (w: WaitItem) => {
    const ok = await confirm({ title: 'Remover da lista de espera?', message: `${w.patient_name || w.client_name} sai da lista.`, confirmLabel: 'Remover', tone: 'danger' })
    if (!ok) return
    setRemoving(w.id)
    try {
      await crm.deleteWait(w.id)
      emitCrmChange('waitlist')
      toast.success('Removido da lista de espera.')
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível remover.'))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <MotionList as="ul" className="space-y-2.5">
      {items.map((w, i) => {
        const first = (w.client_name || '').split(/\s+/)[0]
        const wa = waLink(w.client_phone, `Olá${first ? `, ${first}` : ''}! Vagou um horário${clinicName ? ` na ${clinicName}` : ''}${w.item_name ? ` para ${w.item_name.toLowerCase()}` : ''}${w.patient_name ? ` de ${w.patient_name}` : ''}. Quer que a gente reserve para você?`)
        return (
          <MotionItem as="li" key={w.id} index={i} className="rounded-xl bg-panel-2/60 p-3">
            <div className="flex items-start gap-3">
              <PetAvatar name={w.patient_name || w.client_name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">{w.patient_name || 'Sem pet'} <span className="font-normal text-muted">· {w.client_name}</span></p>
                <p className="text-xs text-muted truncate">{[w.item_name, w.staff_name].filter(Boolean).join(' · ') || 'Qualquer serviço'}</p>
                <p className="text-xs text-ink/80 mt-0.5">{prefText(w)}</p>
                {w.notes && <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{w.notes}</p>}
                <p className="text-2xs text-muted mt-1">Na lista desde {fmtDate(w.created_at)}{w.client_phone ? ` · ${fmtPhone(w.client_phone)}` : ''}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Btn size="sm" icon={CalendarPlus} onClick={() => onSchedule(w)}>Agendar</Btn>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25">
                  <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />Avisar que vagou
                </a>
              )}
              <Btn size="sm" variant="ghost" icon={Trash2} className="ml-auto text-red-600 dark:text-red-400" loading={removing === w.id}
                onClick={() => { void remove(w) }} aria-label={`Remover ${w.patient_name || w.client_name} da lista`}>Remover</Btn>
            </div>
          </MotionItem>
        )
      })}
    </MotionList>
  )
}

function AddForm({ team, onCancel, onDone }: { team: Member[]; onCancel: () => void; onDone: () => void }) {
  const toast = useToast()
  const [client, setClient] = useState<Client | null>(null)
  const [patients, setPatients] = useState<Patient[] | null>(null)
  const [services, setServices] = useState<Item[]>([])
  const [patientId, setPatientId] = useState('')
  const [itemId, setItemId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [period, setPeriod] = useState<WaitItem['period']>('qualquer')
  const [days, setDays] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { crm.items('service').then(setServices).catch(() => setServices([])) }, [])
  useEffect(() => {
    setPatients(null); setPatientId('')
    if (!client) return
    let alive = true
    crm.client(client.id).then(c => {
      if (!alive) return
      const list = c.patients.filter(p => !p.deceased)
      setPatients(list)
      if (list.length === 1) setPatientId(String(list[0].id))
    }).catch(() => { if (alive) setPatients([]) })
    return () => { alive = false }
  }, [client])

  const toggleDay = (d: string) => setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d])

  const save = async () => {
    if (!client) { setErr('Escolha o tutor.'); return }
    setBusy(true); setErr('')
    try {
      await crm.createWait({
        client_id: client.id,
        patient_id: patientId ? Number(patientId) : null,
        item_id: itemId ? Number(itemId) : null,
        staff_user_id: staffId ? Number(staffId) : null,
        period,
        days: days.length ? DAYS.map(([k]) => k).filter(k => days.includes(k)).join(',') : null,
        notes: notes.trim() || null,
      })
      emitCrmChange('waitlist')
      toast.success('Adicionado à lista de espera.')
      onDone()
    } catch (e) {
      toast.error(errMsg(e, 'Não foi possível adicionar.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save() }}>
      <div>
        <span className="block text-xs font-semibold text-ink/80 mb-1">Tutor</span>
        <ClientPicker value={client} onChange={c => { setClient(c); setErr('') }} />
        {err && <span role="alert" className="block text-xs text-red-600 dark:text-red-400 mt-1">{err}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Pet">
          <Select value={patientId} onChange={e => setPatientId(e.target.value)} disabled={!client || !patients}>
            <option value="">{!client ? 'Escolha o tutor primeiro' : !patients ? 'Carregando pets' : 'Sem pet definido'}</option>
            {(patients ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Serviço">
          <Select value={itemId} onChange={e => setItemId(e.target.value)}>
            <option value="">Qualquer serviço</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Profissional" className="sm:col-span-2">
          <Select value={staffId} onChange={e => setStaffId(e.target.value)}>
            <option value="">Qualquer profissional</option>
            {team.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
          </Select>
        </Field>
      </div>
      <div>
        <span className="block text-xs font-semibold text-ink/80 mb-1">Período</span>
        <Segmented id="wait-period" value={period} onChange={setPeriod} ariaLabel="Período preferido"
          options={[{ value: 'manha', label: 'Manhã' }, { value: 'tarde', label: 'Tarde' }, { value: 'qualquer', label: 'Qualquer' }]} />
      </div>
      <div>
        <span className="block text-xs font-semibold text-ink/80 mb-1">Dias que prefere</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias que prefere">
          {DAYS.map(([k, l]) => <Chip key={k} active={days.includes(k)} onClick={() => toggleDay(k)}>{l}</Chip>)}
        </div>
        <span className="block text-xs text-muted mt-1">Deixe sem marcar para qualquer dia.</span>
      </div>
      <Field label="Observação">
        <TextArea rows={3} value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} placeholder="Ex.: só pode depois das 16h" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Btn variant="ghost" onClick={onCancel}>Voltar</Btn>
        <Btn type="submit" loading={busy}>Adicionar</Btn>
      </div>
    </form>
  )
}
