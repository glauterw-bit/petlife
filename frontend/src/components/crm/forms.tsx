'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { AlertTriangle, ChevronDown, Smartphone, Trash2, UserPlus } from 'lucide-react'
import { useToast } from '@/components/ui/ToastContext'
import { crm, isCrmError, type Client, type Patient, type Item, type Member, type Appt, type RecordEntry } from '@/lib/crmApi'
import {
  Btn, Field, Input, Select, TextArea, APPT_TYPE, RECORD_KIND, SPECIES, PET_SIZE, TEMPERAMENT,
  toLocalInput, toDate, type ApptStatus, fmtTime, fmtPhone, parseDecimal, ymd,
} from './ui'
import { Sheet } from './kit/Sheet'
import { useConfirm } from './kit/ConfirmDialog'
import { DecimalInput, SearchInput, Switch } from './kit/Inputs'
import { PetAvatar, PersonAvatar } from './kit/PetAvatar'
import { StatusMenu } from './kit/StatusMenu'
import { Skeleton } from './kit/Skeleton'
import { emitCrmChange } from './kit/events'

/** Formulários compartilhados do PetLife Clínica (gavetas com Ctrl/Cmd+Enter para salvar). */

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)
const grid2 = 'grid grid-cols-1 sm:grid-cols-2 gap-3'
const grid3 = 'grid grid-cols-1 sm:grid-cols-3 gap-3'

/* ───────── cliente ───────── */

export function ClientModal({ open, onClose, onSaved, initial }: {
  open: boolean; onClose: () => void; onSaved: (c: Client, petId?: number) => void; initial?: Client | null
}) {
  const { error, success } = useToast()
  const [f, setF] = useState({ name: '', phone: '', email: '', document: '', address: '', notes: '' })
  const [pet, setPet] = useState({ name: '', species: 'dog', breed: '' })
  const [busy, setBusy] = useState(false)
  const [nameErr, setNameErr] = useState('')
  useEffect(() => {
    if (!open) return
    setF({ name: initial?.name ?? '', phone: initial?.phone ?? '', email: initial?.email ?? '', document: initial?.document ?? '', address: initial?.address ?? '', notes: initial?.notes ?? '' })
    if (!initial) setPet({ name: '', species: 'dog', breed: '' })
    setNameErr('')
  }, [open, initial])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setF(x => ({ ...x, [k]: e.target.value }))
    if (k === 'name') setNameErr('')
  }
  async function save() {
    if (busy) return
    if (!f.name.trim()) { setNameErr('Informe o nome do tutor.'); return }
    setBusy(true)
    try {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])) as Partial<Client>
      const c = initial ? await crm.updateClient(initial.id, body) : await crm.createClient(body)
      let petId: number | undefined
      if (!initial && pet.name.trim()) {
        const p = await crm.createPatient({ client_id: c.id, name: pet.name.trim(), species: pet.species, breed: pet.breed.trim() || null })
        petId = p.id
        emitCrmChange('patient')
      }
      success(initial ? 'Cliente atualizado.' : 'Cliente cadastrado.')
      emitCrmChange('client')
      onSaved(c, petId)
      onClose()
    } catch (e) { error(errMsg(e, 'Não foi possível salvar o cliente.')) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} onSubmit={save} title={initial ? 'Editar cliente' : 'Novo cliente'} size="lg"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} loading={busy}>Salvar</Btn></>}>
      <div className="space-y-3">
        <Field label="Nome do tutor *" error={nameErr}><Input value={f.name} onChange={set('name')} autoComplete="off" data-autofocus /></Field>
        <div className={grid2}>
          <Field label="Celular ou WhatsApp"><Input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="(11) 99999-9999" /></Field>
          <Field label="E-mail"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        </div>
        <div className={grid2}>
          <Field label="CPF (opcional)"><Input inputMode="numeric" value={f.document} onChange={set('document')} /></Field>
          <Field label="Endereço"><Input value={f.address} onChange={set('address')} /></Field>
        </div>
        <Field label="Observações"><TextArea rows={2} value={f.notes} onChange={set('notes')} /></Field>
        {!initial && (
          <fieldset className="rounded-xl bg-panel-2 p-3">
            <legend className="sr-only">Primeiro pet</legend>
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-2">Primeiro pet (opcional)</p>
            <div className={grid3}>
              <Field label="Nome do pet"><Input value={pet.name} onChange={e => setPet(p => ({ ...p, name: e.target.value }))} /></Field>
              <Field label="Espécie">
                <Select value={pet.species} onChange={e => setPet(p => ({ ...p, species: e.target.value }))}>
                  {Object.entries(SPECIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Raça"><Input value={pet.breed} onChange={e => setPet(p => ({ ...p, breed: e.target.value }))} /></Field>
            </div>
          </fieldset>
        )}
      </div>
    </Sheet>
  )
}

/* ───────── pet ───────── */

export function PatientModal({ open, onClose, onSaved, clientId, initial }: {
  open: boolean; onClose: () => void; onSaved: (p: Patient) => void; clientId: number; initial?: Patient | null
}) {
  const { error, success } = useToast()
  const blank = {
    name: '', species: 'dog', breed: '', sex: '', birth_date: '', weight_kg: '', neutered: '', microchip: '', color: '', notes: '', deceased: false,
    allergies: '', size: '', coat: '', temperament: '', grooming_notes: '',
  }
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [groom, setGroom] = useState(false)
  const [errs, setErrs] = useState<{ name?: string; weight?: string }>({})
  useEffect(() => {
    if (!open) return
    const next = initial ? {
      name: initial.name, species: initial.species, breed: initial.breed ?? '', sex: initial.sex ?? '',
      birth_date: initial.birth_date?.slice(0, 10) ?? '', weight_kg: initial.weight_kg != null ? String(initial.weight_kg).replace('.', ',') : '',
      neutered: initial.neutered == null ? '' : initial.neutered ? 'sim' : 'nao', microchip: initial.microchip ?? '',
      color: initial.color ?? '', notes: initial.notes ?? '', deceased: initial.deceased,
      allergies: initial.allergies ?? '', size: initial.size ?? '', coat: initial.coat ?? '', temperament: initial.temperament ?? '',
      grooming_notes: initial.grooming_notes ?? '',
    } : blank
    setF(next)
    setGroom(!!(next.size || next.coat || next.temperament || next.grooming_notes))
    setErrs({})
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }))
  async function save() {
    if (busy) return
    const weight = f.weight_kg.trim() ? parseDecimal(f.weight_kg) : null
    const ne: typeof errs = {}
    if (!f.name.trim()) ne.name = 'Informe o nome do pet.'
    if (f.weight_kg.trim() && (weight == null || weight <= 0 || weight > 200)) ne.weight = 'Peso inválido. Ex.: 8,5'
    setErrs(ne)
    if (ne.name || ne.weight) return
    setBusy(true)
    try {
      const body: Partial<Patient> = {
        client_id: clientId, name: f.name.trim(), species: f.species, breed: f.breed.trim() || null, sex: f.sex || null,
        birth_date: f.birth_date ? `${f.birth_date}T12:00:00` : null, weight_kg: weight,
        neutered: f.neutered === '' ? null : f.neutered === 'sim', microchip: f.microchip.trim() || null, color: f.color.trim() || null,
        notes: f.notes.trim() || null, deceased: !!f.deceased,
        allergies: f.allergies.trim() || null, size: f.size || null, coat: f.coat.trim() || null,
        temperament: f.temperament || null, grooming_notes: f.grooming_notes.trim() || null,
      }
      const p = initial ? await crm.updatePatient(initial.id, body) : await crm.createPatient(body)
      success(initial ? 'Pet atualizado.' : 'Pet cadastrado.')
      emitCrmChange('patient')
      onSaved(p)
      onClose()
    } catch (e) { error(errMsg(e, 'Não foi possível salvar o pet.')) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} onSubmit={save} title={initial ? `Editar ${initial.name}` : 'Novo pet'} size="lg"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} loading={busy}>Salvar</Btn></>}>
      <div className="space-y-3">
        <div className={grid3}>
          <Field label="Nome *" className="sm:col-span-2" error={errs.name}><Input value={f.name} onChange={set('name')} data-autofocus /></Field>
          <Field label="Espécie"><Select value={f.species} onChange={set('species')}>{Object.entries(SPECIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <div className={grid3}>
          <Field label="Raça"><Input value={f.breed} onChange={set('breed')} /></Field>
          <Field label="Sexo"><Select value={f.sex} onChange={set('sex')}><option value="">Não informado</option><option value="male">Macho</option><option value="female">Fêmea</option></Select></Field>
          <Field label="Nascimento"><Input type="date" value={f.birth_date} onChange={set('birth_date')} max={ymd(new Date())} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Peso" error={errs.weight}><DecimalInput value={f.weight_kg} onChange={v => setF(x => ({ ...x, weight_kg: v }))} suffix="kg" placeholder="0,0" /></Field>
          <Field label="Castrado"><Select value={f.neutered} onChange={set('neutered')}><option value="">Não informado</option><option value="sim">Sim</option><option value="nao">Não</option></Select></Field>
          <Field label="Cor"><Input value={f.color} onChange={set('color')} /></Field>
          <Field label="Microchip"><Input value={f.microchip} onChange={set('microchip')} /></Field>
        </div>
        <div className="rounded-xl bg-red-50/70 dark:bg-red-500/10 p-3 ring-1 ring-red-200 dark:ring-red-500/25">
          <Field label="Alergias e alertas" hint="Aparece em destaque na ficha e no atendimento.">
            <TextArea rows={2} value={f.allergies} onChange={set('allergies')} placeholder="Ex.: alergia a dipirona; cardiopata"
              className="!border-red-200 dark:!border-red-500/30" />
          </Field>
        </div>
        <Field label="Observações"><TextArea rows={2} value={f.notes} onChange={set('notes')} /></Field>

        <div className="rounded-xl bg-panel-2">
          <button type="button" onClick={() => setGroom(g => !g)} aria-expanded={groom}
            className="w-full flex items-center justify-between gap-2 h-11 px-3 text-sm font-semibold text-ink">
            Ficha de banho e tosa
            <m.span animate={{ rotate: groom ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown className="w-4 h-4 text-muted" strokeWidth={1.75} /></m.span>
          </button>
          <AnimatePresence initial={false}>
            {groom && (
              <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="px-3 pb-3 space-y-3">
                  <div className={grid3}>
                    <Field label="Porte"><Select value={f.size} onChange={set('size')}><option value="">Não informado</option>{Object.entries(PET_SIZE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                    <Field label="Pelagem"><Input value={f.coat} onChange={set('coat')} placeholder="Ex.: longa, dupla" /></Field>
                    <Field label="Temperamento"><Select value={f.temperament} onChange={set('temperament')}><option value="">Não informado</option>{Object.entries(TEMPERAMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                  </div>
                  <Field label="Observações"><TextArea rows={2} value={f.grooming_notes} onChange={set('grooming_notes')} placeholder="Ex.: não usar secador" /></Field>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {initial && (
          <div className="pt-1">
            <Switch checked={!!f.deceased} onChange={v => setF(x => ({ ...x, deceased: v }))} label="Falecido" hint="Sai dos lembretes e da agenda." />
          </div>
        )}
      </div>
    </Sheet>
  )
}

/* ───────── busca de cliente ───────── */

/** Busca de cliente com os pets: usado na agenda e no caixa. */
export function ClientPicker({ value, onChange, locked }: { value: Client | null; onChange: (c: Client | null) => void; locked?: boolean }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Client[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  useEffect(() => {
    if (value) return
    let alive = true
    const t = setTimeout(() => {
      crm.clients(q.trim()).then(r => { if (alive) { setList(r); setErr(null) } })
        .catch(e => { if (alive) setErr(errMsg(e, 'Não foi possível buscar.')) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q, value])
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-primary-50/70 dark:bg-primary-500/10 ring-1 ring-primary-200 dark:ring-primary-500/25 px-3 py-2.5">
        <PersonAvatar name={value.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">{value.name}</p>
          <p className="text-xs text-muted truncate">{value.phone ? fmtPhone(value.phone) : value.email || 'Sem telefone'}</p>
        </div>
        {!!value.patients?.length && (
          <div className="hidden sm:flex -space-x-1.5">{value.patients.slice(0, 3).map(p => <PetAvatar key={p.id} name={p.name} species={p.species} size="sm" />)}</div>
        )}
        {!locked && <Btn variant="ghost" size="sm" onClick={() => onChange(null)}>Trocar</Btn>}
      </div>
    )
  }
  return (
    <div>
      <SearchInput value={q} onChange={setQ} placeholder="Buscar por tutor, pet ou telefone" ariaLabel="Buscar cliente" />
      <div className="mt-1.5 max-h-56 overflow-y-auto rounded-xl ring-1 ring-line divide-y divide-line bg-panel">
        {err && <p role="alert" className="px-3 py-2.5 text-sm text-red-600 dark:text-red-400">{err}</p>}
        {!list && !err && <div className="p-3 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>}
        {list && !list.length && <p className="px-3 py-2.5 text-sm text-muted">{q.trim() ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>}
        {list?.slice(0, 20).map(c => (
          <button key={c.id} type="button" onClick={() => onChange(c)} className="w-full flex items-center gap-3 text-left px-3 min-h-12 py-2 hover:bg-panel-2 focus-visible:bg-panel-2 outline-none">
            <PersonAvatar name={c.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink truncate">{c.name}</span>
              <span className="block text-xs text-muted truncate">
                {[c.phone ? fmtPhone(c.phone) : null, (c.patients || []).map(p => p.name).join(', ') || 'sem pets'].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="hidden sm:flex -space-x-1.5 shrink-0">{(c.patients || []).slice(0, 3).map(p => <PetAvatar key={p.id} name={p.name} species={p.species} size="sm" />)}</span>
          </button>
        ))}
        <button type="button" onClick={() => setNewOpen(true)} className="w-full flex items-center gap-2 text-left px-3 h-11 text-sm font-semibold text-primary-700 dark:text-primary-300 hover:bg-panel-2">
          <UserPlus className="w-4 h-4" strokeWidth={1.75} /> Cadastrar novo cliente
        </button>
      </div>
      <ClientModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={c => onChange({ ...c, patients: [] })} />
    </div>
  )
}

/* ───────── agendamento ───────── */

const typeFromItem = (it?: Item) => {
  const c = it?.category
  return c === 'vacina' ? 'vacina' : c === 'banho_tosa' ? 'banho_tosa' : c === 'cirurgia' ? 'cirurgia' : c === 'exame' ? 'exame' : (it?.name.toLowerCase().includes('retorno') ? 'retorno' : 'consulta')
}

function clientFromAppt(a: Appt): Client {
  return { id: a.client_id, name: a.client_name || 'Cliente', phone: a.client_phone, email: null, document: null, address: null, notes: null, petlife_linked: false, created_at: a.starts_at }
}

export function ApptModal({ open, onClose, onSaved, initialStart, presetClient, initial, presetPatientId, presetItemId, presetStaffId, onDeleted }: {
  open: boolean; onClose: () => void; onSaved: (a: Appt) => void; initialStart?: Date; presetClient?: Client | null
  initial?: Appt | null; presetPatientId?: number; presetItemId?: number; presetStaffId?: number | null; onDeleted?: () => void
}) {
  const { error, success } = useToast()
  const { confirm } = useConfirm()
  const [client, setClient] = useState<Client | null>(null)
  const [patients, setPatients] = useState<Patient[] | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [team, setTeam] = useState<Member[]>([])
  const blank = { patient_id: '', item_id: '', type: 'consulta', starts_at: '', staff_user_id: '', notes: '', duration: '30', is_fit_in: false }
  const [f, setF] = useState(blank)
  const [status, setStatus] = useState<string>('agendado')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [conflicts, setConflicts] = useState<Appt[] | null>(null)
  const [conflictMsg, setConflictMsg] = useState('')
  const [errs, setErrs] = useState<{ client?: string; starts?: string; duration?: string }>({})
  const touchedDuration = useRef(false)
  const editing = !!initial

  useEffect(() => {
    if (!open) return
    setConflicts(null); setErrs({}); touchedDuration.current = false
    if (initial) {
      setClient(clientFromAppt(initial))
      setStatus(initial.status)
      setF({
        patient_id: initial.patient_id ? String(initial.patient_id) : '', item_id: initial.item_id ? String(initial.item_id) : '',
        type: initial.type || 'consulta', starts_at: toLocalInput(toDate(initial.starts_at)),
        staff_user_id: initial.staff_user_id ? String(initial.staff_user_id) : '', notes: initial.notes ?? '',
        duration: String(initial.duration_min || 30), is_fit_in: !!initial.is_fit_in,
      })
      touchedDuration.current = true
    } else {
      setClient(presetClient ?? null)
      setStatus('agendado')
      const st = initialStart ?? (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d })()
      setF({
        ...blank, starts_at: toLocalInput(st),
        patient_id: presetPatientId ? String(presetPatientId) : '', item_id: presetItemId ? String(presetItemId) : '',
        staff_user_id: presetStaffId ? String(presetStaffId) : '',
      })
    }
    crm.items('service').then(list => {
      setItems(list)
      if (!initial && presetItemId) {
        const it = list.find(i => i.id === presetItemId)
        if (it) setF(x => ({ ...x, type: typeFromItem(it), duration: String(it.duration_min || 30) }))
      }
    }).catch(e => error(errMsg(e, 'Não foi possível carregar os serviços.')))
    crm.team().then(setTeam).catch(e => error(errMsg(e, 'Não foi possível carregar a equipe.')))
  }, [open, initial, initialStart, presetClient, presetPatientId, presetItemId, presetStaffId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    if (!client) { setPatients(null); return }
    let alive = true
    setPatients(null)
    crm.client(client.id).then(c => {
      if (!alive) return
      setPatients(c.patients)
      const live = c.patients.filter(p => !p.deceased)
      if (live.length === 1) setF(x => (x.patient_id ? x : { ...x, patient_id: String(live[0].id) }))
    }).catch(e => { if (alive) { setPatients([]); error(errMsg(e, 'Não foi possível carregar os pets.')) } })
    return () => { alive = false }
  }, [client, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const upd = (patch: Partial<typeof f>) => { setF(x => ({ ...x, ...patch })); setConflicts(null) }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => upd({ [k]: e.target.value } as Partial<typeof f>)

  async function save(allowConflict = false) {
    if (busy) return
    const ne: typeof errs = {}
    if (!client) ne.client = 'Escolha o cliente.'
    if (!f.starts_at) ne.starts = 'Informe a data e a hora.'
    const dur = parseDecimal(f.duration)
    if (dur == null || dur < 5 || dur > 720 || Math.round(dur) !== dur) ne.duration = 'Use minutos inteiros, de 5 a 720.'
    setErrs(ne)
    if (ne.client || ne.starts || ne.duration || !client || dur == null) return
    const st = new Date(f.starts_at)
    if (Number.isNaN(st.getTime())) { setErrs({ starts: 'Data e hora inválidas.' }); return }
    const en = new Date(st.getTime() + dur * 60000)
    const fit = f.is_fit_in || allowConflict
    const common = {
      patient_id: f.patient_id ? Number(f.patient_id) : null, item_id: f.item_id ? Number(f.item_id) : null,
      staff_user_id: f.staff_user_id ? Number(f.staff_user_id) : null, type: f.type,
      starts_at: st.toISOString(), ends_at: en.toISOString(), notes: f.notes.trim() || null,
      is_fit_in: fit, allow_conflict: fit,
    }
    setBusy(true)
    try {
      const a = initial ? await crm.patchAppt(initial.id, common) : await crm.createAppt({ client_id: client.id, ...common })
      success(initial ? 'Agendamento atualizado.' : allowConflict ? 'Encaixe agendado.' : 'Agendamento criado.')
      emitCrmChange('appointment')
      onSaved(a)
      onClose()
    } catch (e) {
      if (isCrmError(e) && e.status === 409 && e.data?.code === 'conflict') {
        setConflicts(e.data.conflicts ?? [])
        setConflictMsg(e.data.message || e.message)
      } else {
        error(errMsg(e, 'Não foi possível salvar o agendamento.'))
      }
    } finally { setBusy(false) }
  }

  async function changeStatus(s: ApptStatus) {
    if (!initial) return
    try {
      const a = await crm.patchAppt(initial.id, { status: s })
      setStatus(a.status)
      emitCrmChange('appointment')
    } catch (e) {
      error(errMsg(e, 'Não foi possível mudar a situação.'))
      throw e
    }
  }

  async function remove() {
    if (!initial) return
    const ok = await confirm({
      title: 'Excluir este agendamento?',
      message: `${initial.patient_name || initial.client_name || 'Agendamento'} · ${fmtTime(initial.starts_at)}. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir', tone: 'danger',
    })
    if (!ok) return
    setDeleting(true)
    try {
      await crm.deleteAppt(initial.id)
      success('Agendamento excluído.')
      emitCrmChange('appointment')
      onDeleted?.()
      onClose()
    } catch (e) { error(errMsg(e, 'Não foi possível excluir.')) } finally { setDeleting(false) }
  }

  const live = (patients || []).filter(p => !p.deceased || String(p.id) === f.patient_id)
  return (
    <Sheet open={open} onClose={onClose} onSubmit={() => save(false)} title={editing ? 'Editar agendamento' : 'Novo agendamento'} size="lg"
      footer={<>
        {editing && <Btn variant="danger" icon={Trash2} onClick={remove} loading={deleting} className="mr-auto">Excluir</Btn>}
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={() => save(false)} loading={busy}>{editing ? 'Salvar' : 'Agendar'}</Btn>
      </>}>
      <div className="space-y-3">
        {editing && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-panel-2 px-3 h-12">
            <span className="text-sm font-medium text-muted">Situação</span>
            <StatusMenu status={status} onChange={changeStatus} />
          </div>
        )}
        <Field label="Cliente *" error={errs.client}>
          <ClientPicker value={client} onChange={c => { setClient(c); upd({ patient_id: '' }); setErrs(x => ({ ...x, client: undefined })) }} locked={editing} />
        </Field>
        {client && (
          <Field label="Pet">
            {patients == null ? <Skeleton className="h-9 w-full" /> : (
              <Select value={f.patient_id} onChange={set('patient_id')}>
                <option value="">{live.length ? 'Escolha o pet' : 'Cliente sem pets cadastrados'}</option>
                {live.map(p => <option key={p.id} value={p.id}>{p.name} ({SPECIES[p.species] ?? p.species})</option>)}
              </Select>
            )}
          </Field>
        )}
        <div className={grid2}>
          <Field label="Serviço">
            <Select value={f.item_id} onChange={e => {
              const it = items.find(i => String(i.id) === e.target.value)
              upd({ item_id: e.target.value, ...(it ? { type: typeFromItem(it) } : {}), ...(it && !touchedDuration.current ? { duration: String(it.duration_min || 30) } : {}) })
            }}>
              <option value="">Sem serviço do catálogo</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}{i.duration_min ? ` · ${i.duration_min} min` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Tipo"><Select value={f.type} onChange={set('type')}>{Object.entries(APPT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <div className={grid3}>
          <Field label="Data e hora *" className="sm:col-span-2" error={errs.starts}><Input type="datetime-local" value={f.starts_at} onChange={set('starts_at')} /></Field>
          <Field label="Duração (min)" error={errs.duration}>
            <DecimalInput value={f.duration} onChange={v => { touchedDuration.current = true; upd({ duration: v.replace(/[.,]/g, '') }) }} suffix="min" inputMode="numeric" />
          </Field>
        </div>
        <Field label="Profissional">
          <Select value={f.staff_user_id} onChange={set('staff_user_id')}>
            <option value="">Sem profissional definido</option>
            {team.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Observações"><TextArea rows={2} value={f.notes} onChange={set('notes')} /></Field>
        <Switch checked={f.is_fit_in} onChange={v => upd({ is_fit_in: v })} label="Encaixe" hint="Permite marcar num horário que já tem atendimento." />

        <AnimatePresence>
          {conflicts && (
            <m.div role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }}
              className="rounded-xl bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-200 dark:ring-amber-500/30 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.75} /> {conflictMsg || 'Horário ocupado.'}
              </p>
              {conflicts.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-amber-900/90 dark:text-amber-100/90">
                  {conflicts.map(c => (
                    <li key={c.id}>Horário ocupado: {c.patient_name || c.client_name || 'atendimento'} com {c.staff_name || 'o profissional'} às {fmtTime(c.starts_at)}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn size="sm" onClick={() => save(true)} loading={busy}>Agendar como encaixe</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setConflicts(null)}>Escolher outro horário</Btn>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </Sheet>
  )
}

/* ───────── prontuário (registro simples) ───────── */

export function RecordModal({ open, onClose, onSaved, patient, appointmentId, defaultKind = 'consulta', allowedKinds }: {
  open: boolean; onClose: () => void; onSaved: (r: RecordEntry) => void; patient: Patient; appointmentId?: number; defaultKind?: string; allowedKinds?: string[]
}) {
  const { error, success } = useToast()
  const blank = { kind: defaultKind, title: '', body: '', weight_kg: '', temperature_c: '', vaccine_name: '', vaccine_lot: '', next_due: '', performed_at: '' }
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [errs, setErrs] = useState<{ vaccine?: string; weight?: string; temp?: string; performed?: string }>({})
  useEffect(() => {
    if (open) { setF({ ...blank, kind: defaultKind, performed_at: ymd(new Date()) }); setErrs({}) }
  }, [open, defaultKind]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }))
  const kinds = Object.entries(RECORD_KIND).filter(([k]) => !allowedKinds || allowedKinds.includes(k))
  const isVac = f.kind === 'vacina'
  async function save() {
    if (busy) return
    const weight = f.weight_kg.trim() ? parseDecimal(f.weight_kg) : null
    const temp = f.temperature_c.trim() ? parseDecimal(f.temperature_c) : null
    const ne: typeof errs = {}
    if (isVac && !f.vaccine_name.trim()) ne.vaccine = 'Informe o nome da vacina.'
    if (f.weight_kg.trim() && (weight == null || weight <= 0 || weight > 200)) ne.weight = 'Peso inválido.'
    if (f.temperature_c.trim() && (temp == null || temp < 30 || temp > 45)) ne.temp = 'Temperatura inválida.'
    if (f.performed_at && f.performed_at > ymd(new Date(Date.now() + 86400000))) ne.performed = 'A data não pode estar no futuro.'
    setErrs(ne)
    if (Object.keys(ne).length) return
    const title = f.title.trim() || (isVac ? `Vacina ${f.vaccine_name.trim()}` : RECORD_KIND[f.kind] ?? 'Registro')
    setBusy(true)
    try {
      const r = await crm.addRecord(patient.id, {
        kind: f.kind, title, body: f.body.trim() || null,
        weight_kg: weight, temperature_c: temp,
        vaccine_name: f.vaccine_name.trim() || null, vaccine_lot: f.vaccine_lot.trim() || null,
        next_due: f.next_due ? `${f.next_due}T12:00:00` : null,
        performed_at: f.performed_at ? `${f.performed_at}T12:00:00` : null,
        appointment_id: appointmentId ?? null,
      })
      success(r.sent_to_app ? 'Registrado. A vacina também foi para o app do tutor.' : 'Registrado no prontuário.')
      emitCrmChange('record')
      onSaved(r)
      onClose()
    } catch (e) { error(errMsg(e, 'Não foi possível registrar.')) } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} onSubmit={save} title={`Prontuário · ${patient.name}`} size="lg"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} loading={busy}>Registrar</Btn></>}>
      <div className="space-y-3">
        <div className={grid2}>
          <Field label="Tipo"><Select value={f.kind} onChange={set('kind')}>{kinds.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Título"><Input value={f.title} onChange={set('title')} placeholder={isVac ? 'Ex.: V10, 2ª dose' : 'Ex.: Consulta de rotina'} /></Field>
        </div>
        {isVac && (
          <div className={grid2}>
            <Field label="Vacina *" error={errs.vaccine}><Input value={f.vaccine_name} onChange={set('vaccine_name')} placeholder="V10, Antirrábica, V5…" /></Field>
            <Field label="Lote"><Input value={f.vaccine_lot} onChange={set('vaccine_lot')} /></Field>
          </div>
        )}
        <Field label={f.kind === 'consulta' ? 'Anamnese, exame físico e conduta' : 'Descrição'}><TextArea rows={5} value={f.body} onChange={set('body')} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label={isVac ? 'Data de aplicação' : 'Data do atendimento'} error={errs.performed}>
            <Input type="date" value={f.performed_at} onChange={set('performed_at')} max={ymd(new Date())} />
          </Field>
          <Field label="Peso" error={errs.weight}><DecimalInput value={f.weight_kg} onChange={v => setF(x => ({ ...x, weight_kg: v }))} suffix="kg" /></Field>
          <Field label="Temperatura" error={errs.temp}><DecimalInput value={f.temperature_c} onChange={v => setF(x => ({ ...x, temperature_c: v }))} suffix="°C" /></Field>
          <Field label={isVac ? 'Próxima dose' : 'Retorno'}><Input type="date" value={f.next_due} onChange={set('next_due')} /></Field>
        </div>
        {isVac && patient.consent_active === true && (
          <p className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-800 dark:text-emerald-200">
            <Smartphone className="w-4 h-4 shrink-0 mt-px" strokeWidth={1.75} />
            Este pet está ligado ao app PetLife: a vacina também vai para a carteirinha do tutor, com aviso no celular.
          </p>
        )}
      </div>
    </Sheet>
  )
}
