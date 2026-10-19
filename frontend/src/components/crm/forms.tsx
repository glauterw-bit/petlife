'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastContext'
import { crm, type Client, type Patient, type Item, type Member, type Appt, type RecordEntry } from '@/lib/crmApi'
import { Btn, Field, Input, Select, TextArea, APPT_TYPE, RECORD_KIND, toLocalInput, SPECIES } from './ui'

/** Formulários compartilhados do PetLife Clínica. */

export function ClientModal({ open, onClose, onSaved, initial }: {
  open: boolean; onClose: () => void; onSaved: (c: Client, petId?: number) => void; initial?: Client | null
}) {
  const { error, success } = useToast()
  const [f, setF] = useState({ name: '', phone: '', email: '', document: '', address: '', notes: '' })
  const [pet, setPet] = useState({ name: '', species: 'dog', breed: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setF({ name: initial?.name ?? '', phone: initial?.phone ?? '', email: initial?.email ?? '', document: initial?.document ?? '', address: initial?.address ?? '', notes: initial?.notes ?? '' })
    if (open && !initial) setPet({ name: '', species: 'dog', breed: '' })
  }, [open, initial])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }))
  async function save() {
    if (!f.name.trim()) { error('Informe o nome do cliente.'); return }
    setBusy(true)
    try {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])) as Partial<Client>
      const c = initial ? await crm.updateClient(initial.id, body) : await crm.createClient(body)
      let petId: number | undefined
      if (!initial && pet.name.trim()) {
        const p = await crm.createPatient({ client_id: c.id, name: pet.name.trim(), species: pet.species, breed: pet.breed.trim() || null })
        petId = p.id
      }
      success(initial ? 'Cliente atualizado.' : 'Cliente cadastrado.')
      onSaved(c, petId)
      onClose()
    } catch (e) { error(e instanceof Error ? e.message : 'Não consegui salvar.') } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Editar cliente' : 'Novo cliente'} size="lg">
      <div className="space-y-3">
        <Field label="Nome do tutor *"><Input value={f.name} onChange={set('name')} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Celular / WhatsApp"><Input value={f.phone} onChange={set('phone')} placeholder="(11) 99999-9999" /></Field>
          <Field label="E-mail"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CPF (opcional)"><Input value={f.document} onChange={set('document')} /></Field>
          <Field label="Endereço"><Input value={f.address} onChange={set('address')} /></Field>
        </div>
        <Field label="Observações"><TextArea rows={2} value={f.notes} onChange={set('notes')} /></Field>
        {!initial && (
          <div className="rounded-xl bg-surface-50 dark:bg-surface-700/40 p-3">
            <p className="text-xs font-semibold text-surface-600 dark:text-surface-300 mb-2">Primeiro pet (opcional)</p>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Nome do pet" value={pet.name} onChange={e => setPet(p => ({ ...p, name: e.target.value }))} />
              <Select value={pet.species} onChange={e => setPet(p => ({ ...p, species: e.target.value }))}>
                {Object.entries(SPECIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <Input placeholder="Raça" value={pet.breed} onChange={e => setPet(p => ({ ...p, breed: e.target.value }))} />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

export function PatientModal({ open, onClose, onSaved, clientId, initial }: {
  open: boolean; onClose: () => void; onSaved: (p: Patient) => void; clientId: number; initial?: Patient | null
}) {
  const { error, success } = useToast()
  const blank = { name: '', species: 'dog', breed: '', sex: '', birth_date: '', weight_kg: '', neutered: '', microchip: '', color: '', notes: '', deceased: false }
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setF(initial ? {
      name: initial.name, species: initial.species, breed: initial.breed ?? '', sex: initial.sex ?? '',
      birth_date: initial.birth_date?.slice(0, 10) ?? '', weight_kg: initial.weight_kg?.toString() ?? '',
      neutered: initial.neutered == null ? '' : initial.neutered ? 'sim' : 'nao', microchip: initial.microchip ?? '',
      color: initial.color ?? '', notes: initial.notes ?? '', deceased: initial.deceased,
    } : blank)
  }, [open, initial]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }))
  async function save() {
    if (!f.name.trim()) { error('Informe o nome do pet.'); return }
    setBusy(true)
    try {
      const body: Partial<Patient> = {
        client_id: clientId, name: f.name.trim(), species: f.species, breed: f.breed.trim() || null, sex: f.sex || null,
        birth_date: f.birth_date ? `${f.birth_date}T12:00:00` : null, weight_kg: f.weight_kg ? Number(f.weight_kg.replace(',', '.')) : null,
        neutered: f.neutered === '' ? null : f.neutered === 'sim', microchip: f.microchip.trim() || null, color: f.color.trim() || null,
        notes: f.notes.trim() || null, deceased: !!f.deceased,
      }
      const p = initial ? await crm.updatePatient(initial.id, body) : await crm.createPatient(body)
      success(initial ? 'Pet atualizado.' : 'Pet cadastrado.')
      onSaved(p)
      onClose()
    } catch (e) { error(e instanceof Error ? e.message : 'Não consegui salvar.') } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={initial ? `Editar ${initial.name}` : 'Novo pet'} size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Nome *" className="col-span-2"><Input value={f.name} onChange={set('name')} /></Field>
          <Field label="Espécie"><Select value={f.species} onChange={set('species')}>{Object.entries(SPECIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Raça"><Input value={f.breed} onChange={set('breed')} /></Field>
          <Field label="Sexo"><Select value={f.sex} onChange={set('sex')}><option value="">—</option><option value="male">Macho</option><option value="female">Fêmea</option></Select></Field>
          <Field label="Nascimento"><Input type="date" value={f.birth_date} onChange={set('birth_date')} /></Field>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Peso (kg)"><Input inputMode="decimal" value={f.weight_kg} onChange={set('weight_kg')} /></Field>
          <Field label="Castrado"><Select value={f.neutered} onChange={set('neutered')}><option value="">—</option><option value="sim">Sim</option><option value="nao">Não</option></Select></Field>
          <Field label="Cor / pelagem"><Input value={f.color} onChange={set('color')} /></Field>
          <Field label="Microchip"><Input value={f.microchip} onChange={set('microchip')} /></Field>
        </div>
        <Field label="Observações (alergias, temperamento…)"><TextArea rows={2} value={f.notes} onChange={set('notes')} /></Field>
        {initial && (
          <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
            <input type="checkbox" checked={!!f.deceased} onChange={e => setF(x => ({ ...x, deceased: e.target.checked }))} /> Falecido (sai dos lembretes)
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

/** Busca de cliente com lista dos pets — usado na agenda e no caixa. */
export function ClientPicker({ value, onChange }: { value: Client | null; onChange: (c: Client | null) => void }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Client[]>([])
  const [newOpen, setNewOpen] = useState(false)
  useEffect(() => {
    if (value) return
    const t = setTimeout(() => { crm.clients(q).then(setList).catch(() => {}) }, 250)
    return () => clearTimeout(t)
  }, [q, value])
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/20 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{value.name}</p>
          <p className="text-xs text-surface-500 dark:text-surface-400">{value.phone || value.email || ''}</p>
        </div>
        <button className="text-xs font-semibold text-primary-700 dark:text-primary-300" onClick={() => onChange(null)}>Trocar</button>
      </div>
    )
  }
  return (
    <div>
      <Input placeholder="Buscar por tutor, pet ou telefone…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-surface-100 dark:border-surface-700 divide-y divide-surface-100 dark:divide-surface-700">
        {list.slice(0, 20).map(c => (
          <button key={c.id} type="button" onClick={() => onChange(c)} className="w-full text-left px-3 py-2 hover:bg-surface-50 dark:hover:bg-surface-700/50">
            <span className="text-sm font-medium text-surface-900 dark:text-white">{c.name}</span>
            <span className="text-xs text-surface-500 dark:text-surface-400"> · {(c.patients || []).map(p => p.name).join(', ') || 'sem pets'}</span>
          </button>
        ))}
        <button type="button" onClick={() => setNewOpen(true)} className="w-full text-left px-3 py-2 text-sm font-semibold text-primary-700 dark:text-primary-300">+ Cadastrar novo cliente</button>
      </div>
      <ClientModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={c => onChange({ ...c, patients: [] })} />
    </div>
  )
}

export function ApptModal({ open, onClose, onSaved, initialStart, presetClient }: {
  open: boolean; onClose: () => void; onSaved: (a: Appt) => void; initialStart?: Date; presetClient?: Client | null
}) {
  const { error, success } = useToast()
  const [client, setClient] = useState<Client | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [team, setTeam] = useState<Member[]>([])
  const [f, setF] = useState({ patient_id: '', item_id: '', type: 'consulta', starts_at: '', staff_user_id: '', notes: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setClient(presetClient ?? null)
    const st = initialStart ?? (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d })()
    setF({ patient_id: '', item_id: '', type: 'consulta', starts_at: toLocalInput(st), staff_user_id: '', notes: '' })
    crm.items('service').then(setItems).catch(() => {})
    crm.team().then(setTeam).catch(() => {})
  }, [open, initialStart, presetClient])
  useEffect(() => {
    if (!client) { setPatients([]); return }
    crm.client(client.id).then(c => {
      setPatients(c.patients)
      if (c.patients.length === 1) setF(x => ({ ...x, patient_id: String(c.patients[0].id) }))
    }).catch(() => {})
  }, [client])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }))
  const typeFromItem = (it?: Item) => {
    const c = it?.category
    return c === 'vacina' ? 'vacina' : c === 'banho_tosa' ? 'banho_tosa' : c === 'cirurgia' ? 'cirurgia' : c === 'exame' ? 'exame' : (it?.name.toLowerCase().includes('retorno') ? 'retorno' : 'consulta')
  }
  async function save() {
    if (!client) { error('Escolha o cliente.'); return }
    if (!f.starts_at) { error('Informe a data e a hora.'); return }
    setBusy(true)
    try {
      const a = await crm.createAppt({
        client_id: client.id, patient_id: f.patient_id ? Number(f.patient_id) : null, item_id: f.item_id ? Number(f.item_id) : null,
        type: f.type, starts_at: new Date(f.starts_at).toISOString(), staff_user_id: f.staff_user_id ? Number(f.staff_user_id) : null,
        notes: f.notes.trim() || null,
      })
      success('Agendamento criado.')
      onSaved(a)
      onClose()
    } catch (e) { error(e instanceof Error ? e.message : 'Não consegui agendar.') } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Novo agendamento" size="lg">
      <div className="space-y-3">
        <Field label="Cliente *"><ClientPicker value={client} onChange={setClient} /></Field>
        {client && (
          <Field label="Pet">
            <Select value={f.patient_id} onChange={set('patient_id')}>
              <option value="">{patients.length ? 'Escolha o pet' : 'Cliente sem pets cadastrados'}</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({SPECIES[p.species] ?? p.species})</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Serviço">
            <Select value={f.item_id} onChange={e => { const it = items.find(i => String(i.id) === e.target.value); setF(x => ({ ...x, item_id: e.target.value, type: it ? typeFromItem(it) : x.type })) }}>
              <option value="">—</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}{i.duration_min ? ` · ${i.duration_min} min` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Tipo"><Select value={f.type} onChange={set('type')}>{Object.entries(APPT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data e hora *"><Input type="datetime-local" value={f.starts_at} onChange={set('starts_at')} /></Field>
          <Field label="Profissional">
            <Select value={f.staff_user_id} onChange={set('staff_user_id')}>
              <option value="">—</option>
              {team.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Observações"><TextArea rows={2} value={f.notes} onChange={set('notes')} /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Agendar'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

export function RecordModal({ open, onClose, onSaved, patient, appointmentId, defaultKind = 'consulta', allowedKinds }: {
  open: boolean; onClose: () => void; onSaved: (r: RecordEntry) => void; patient: Patient; appointmentId?: number; defaultKind?: string; allowedKinds?: string[]
}) {
  const { error, success } = useToast()
  const blank = { kind: defaultKind, title: '', body: '', weight_kg: '', temperature_c: '', vaccine_name: '', vaccine_lot: '', next_due: '' }
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setF({ ...blank, kind: defaultKind }) }, [open, defaultKind]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }))
  const kinds = Object.entries(RECORD_KIND).filter(([k]) => !allowedKinds || allowedKinds.includes(k))
  async function save() {
    const title = f.title.trim() || (f.kind === 'vacina' ? `Vacina ${f.vaccine_name}`.trim() : RECORD_KIND[f.kind]?.replace(/^\S+\s/, '') ?? 'Registro')
    if (f.kind === 'vacina' && !f.vaccine_name.trim()) { error('Informe o nome da vacina.'); return }
    setBusy(true)
    try {
      const r = await crm.addRecord(patient.id, {
        kind: f.kind, title, body: f.body.trim() || null,
        weight_kg: f.weight_kg ? Number(f.weight_kg.replace(',', '.')) : null,
        temperature_c: f.temperature_c ? Number(f.temperature_c.replace(',', '.')) : null,
        vaccine_name: f.vaccine_name.trim() || null, vaccine_lot: f.vaccine_lot.trim() || null,
        next_due: f.next_due ? `${f.next_due}T12:00:00` : null, appointment_id: appointmentId,
      })
      success(r.sent_to_app ? 'Registrado — a vacina também foi para o app do tutor.' : 'Registrado no prontuário.')
      onSaved(r)
      onClose()
    } catch (e) { error(e instanceof Error ? e.message : 'Não consegui registrar.') } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Prontuário · ${patient.name}`} size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><Select value={f.kind} onChange={set('kind')}>{kinds.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Título"><Input value={f.title} onChange={set('title')} placeholder={f.kind === 'vacina' ? 'Ex.: V10 — 2ª dose' : 'Ex.: Consulta de rotina'} /></Field>
        </div>
        {f.kind === 'vacina' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vacina *"><Input value={f.vaccine_name} onChange={set('vaccine_name')} placeholder="V10, Antirrábica, V5…" /></Field>
            <Field label="Lote"><Input value={f.vaccine_lot} onChange={set('vaccine_lot')} /></Field>
          </div>
        )}
        <Field label={f.kind === 'consulta' ? 'Anamnese, exame físico e conduta' : 'Descrição'}><TextArea rows={5} value={f.body} onChange={set('body')} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Peso (kg)"><Input inputMode="decimal" value={f.weight_kg} onChange={set('weight_kg')} /></Field>
          <Field label="Temperatura (°C)"><Input inputMode="decimal" value={f.temperature_c} onChange={set('temperature_c')} /></Field>
          <Field label={f.kind === 'vacina' ? 'Próxima dose' : 'Retorno'}><Input type="date" value={f.next_due} onChange={set('next_due')} /></Field>
        </div>
        {f.kind === 'vacina' && patient.petlife_linked && <p className="text-xs text-emerald-700 dark:text-emerald-300">📱 Este pet usa o app PetLife: a vacina vai também para a carteirinha do tutor, com aviso no celular.</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Registrar'}</Btn>
        </div>
      </div>
    </Modal>
  )
}
