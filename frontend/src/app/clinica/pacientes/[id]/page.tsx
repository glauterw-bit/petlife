'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, CalendarPlus, FileText, MessageCircle, PawPrint, Pencil, Plus, Scale, Scissors, Send, Syringe } from 'lucide-react'
import { crm, type Appt, type PatientFull, type RecordEntry } from '@/lib/crmApi'
import { useCrm, can, useCrmChange } from '@/components/crm/CrmShell'
import { Badge, Btn, Card, PET_SIZE, SPECIES, TEMPERAMENT, ageFrom, fmtDate, fmtDay, fmtPhone, toDate, waLink } from '@/components/crm/ui'
import { ApptModal, PatientModal } from '@/components/crm/forms'
import { EmptyState, ErrorState, LineChart, PetAvatar, Skeleton, SkeletonCard, Tabs } from '@/components/crm/kit'
import { useLoad } from '@/components/crm/clientes/useLoad'
import { ApptList } from '@/components/crm/clientes/ApptList'
import { InviteSheet } from '@/components/crm/clientes/InviteSheet'
import { RecordSheet } from '@/components/crm/prontuario/RecordSheet'
import { RecordTimeline } from '@/components/crm/prontuario/RecordTimeline'
import { VaccinesPanel } from '@/components/crm/prontuario/VaccinesPanel'
import { DocumentSheet } from '@/components/crm/prontuario/DocumentSheet'

type Tab = 'rec' | 'vac' | 'peso' | 'appts' | 'dados'
const kg = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`
const sexLabel = (s: string | null) => (s === 'male' ? 'Macho' : s === 'female' ? 'Fêmea' : null)

function AppSeal({ p, onInvite, canInvite }: { p: PatientFull; onInvite: () => void; canInvite: boolean }) {
  if (p.consent_active) return <Badge tone="good" dot="bg-emerald-500">Ligado ao app PetLife</Badge>
  if (p.invite_pending) {
    return (
      <span className="inline-flex items-center gap-2">
        <Badge tone="warn">Convite enviado</Badge>
        {canInvite && <button type="button" onClick={onInvite} className="text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline">Ver link</button>}
      </span>
    )
  }
  if (p.petlife_linked) return <Badge>Acesso retirado pelo tutor</Badge>
  if (!canInvite || !p.client) return null
  return <Btn size="sm" variant="soft" icon={Send} onClick={onInvite}>Convidar para o app</Btn>
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-sm text-ink mt-0.5 break-words">{children || <span className="text-muted">—</span>}</dd>
    </div>
  )
}

export default function PacienteFicha() {
  const { id } = useParams<{ id: string }>()
  const pid = Number(id)
  const { me } = useCrm()
  const role = me.user.role
  const { data: p, setData, error, status, loading, reload } = useLoad(() => crm.patient(pid), [pid])
  useCrmChange(['record', 'patient', 'appointment'], reload)
  const [tab, setTab] = useState<Tab>('rec')
  const [rec, setRec] = useState<{ open: boolean; kind: string; initial: RecordEntry | null }>({ open: false, kind: 'consulta', initial: null })
  const [doc, setDoc] = useState(false)
  const [edit, setEdit] = useState(false)
  const [invite, setInvite] = useState(false)
  const [appt, setAppt] = useState<{ open: boolean; initial: Appt | null }>({ open: false, initial: null })

  if (!p && status === 404) {
    return (
      <Card><EmptyState icon={PawPrint} title="Pet não encontrado" hint="Ele pode ter sido excluído junto com o cliente."
        action={<Link href="/clinica/clientes" className="text-sm font-semibold text-primary-600 dark:text-primary-400">Voltar para Clientes</Link>} /></Card>
    )
  }
  if (!p && error) return <Card><ErrorState message={error} onRetry={reload} /></Card>
  if (!p) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-4"><Skeleton className="h-14 w-14 rounded-full" /><div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-64" /></div></div>
        <Skeleton className="h-10 w-full max-w-lg" />
        <SkeletonCard lines={6} />
      </div>
    )
  }

  const isVet = can(role, 'vet')
  const canRecord = can(role, 'vet', 'banho_tosa')
  const allowedKinds = isVet ? undefined : ['banho_tosa']
  const canInvite = can(role, 'vet', 'recepcao')
  const canAct = (kind: string) => isVet || (role === 'banho_tosa' && kind === 'banho_tosa')
  const lastWeight = p.weights.length ? p.weights[p.weights.length - 1].kg : p.weight_kg
  const client = p.client
  const wa = client ? waLink(client.phone, `Olá, ${client.name.split(' ')[0]}! Aqui é da ${me.clinic.name}, sobre o ${p.name}.`) : null
  const hasGroom = !!(p.size || p.coat || p.temperament || p.grooming_notes)
  const vaccines = p.records.filter(r => r.kind === 'vacina' && !r.voided_at).length + p.app_vaccines.length

  const newRecord = (kind: string) => setRec({ open: true, kind, initial: null })
  const defaultKind = isVet ? 'consulta' : 'banho_tosa'
  const onRecordChanged = (r: RecordEntry | null, removedId?: number) => {
    setData({ ...p, records: r ? p.records.map(x => (x.id === r.id ? r : x)) : p.records.filter(x => x.id !== removedId) })
    reload()
  }

  const facts = [
    SPECIES[p.species] ?? p.species, p.breed, sexLabel(p.sex), ageFrom(p.birth_date),
    lastWeight != null ? kg(lastWeight) : null,
    p.neutered === true ? (p.sex === 'female' ? 'Castrada' : 'Castrado') : p.neutered === false ? 'Não castrado' : null,
    p.microchip ? `Microchip ${p.microchip}` : null,
  ].filter(Boolean) as string[]

  const actions = (
    <>
      {canRecord && <Btn icon={isVet ? Plus : Scissors} onClick={() => newRecord(defaultKind)}>Novo registro</Btn>}
      {isVet && <Btn variant="outline" icon={Syringe} onClick={() => newRecord('vacina')}>Vacina</Btn>}
      {isVet && <Btn variant="outline" icon={FileText} onClick={() => setDoc(true)}>Documento</Btn>}
      {client && !p.deceased && <Btn variant="outline" icon={CalendarPlus} onClick={() => setAppt({ open: true, initial: null })}>Agendar</Btn>}
      <Btn variant="ghost" icon={Pencil} onClick={() => setEdit(true)}>Editar</Btn>
    </>
  )

  return (
    <div aria-busy={loading || undefined}>
      {client && (
        <Link href={`/clinica/clientes/${client.id}`} className="inline-flex items-center gap-0.5 text-sm font-medium text-muted hover:text-ink mb-2 -ml-1 rounded-md px-1">
          ‹ {client.name}
        </Link>
      )}

      <header className="flex flex-col lg:flex-row lg:items-end gap-4 mb-4">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <PetAvatar name={p.name} species={p.species} size="xl" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl lg:text-[28px] font-extrabold tracking-tight text-ink leading-tight flex items-center gap-2 flex-wrap">
              {p.name}
              {p.deceased && <Badge>Falecido</Badge>}
            </h1>
            <p className="text-sm text-muted mt-0.5 tabular-nums">{facts.join(' · ')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              {client && (
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <span className="text-muted">Tutor:</span>
                  <Link href={`/clinica/clientes/${client.id}`} className="font-medium text-ink hover:underline truncate">{client.name}</Link>
                  {client.phone && <span className="text-muted tabular-nums">{fmtPhone(client.phone)}</span>}
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${client.name}`}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10">
                      <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                    </a>
                  )}
                </span>
              )}
              <AppSeal p={p} canInvite={canInvite} onInvite={() => setInvite(true)} />
            </div>
          </div>
        </div>
        <div className="hidden md:flex flex-wrap gap-2 lg:justify-end">{actions}</div>
      </header>

      {/* faixa fixa: alergias e, no celular, as ações */}
      <div className={`sticky top-14 z-20 -mx-4 px-4 md:-mx-8 md:px-8 py-2 mb-3 bg-bg/90 backdrop-blur space-y-2 ${p.allergies ? '' : 'md:hidden'}`}>
        {p.allergies && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 text-red-800 ring-1 ring-red-200 px-3 py-2 text-sm dark:bg-red-500/15 dark:text-red-200 dark:ring-red-500/30">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
            <p><strong className="font-semibold">Alergias e alertas:</strong> {p.allergies}</p>
          </div>
        )}
        <div className="md:hidden flex gap-2 overflow-x-auto crm-scroll-x -mx-4 px-4">{actions}</div>
      </div>

      {hasGroom && (
        <Card className="mb-4 !py-3">
          <div className="flex items-center gap-2 mb-2">
            <Scissors className="w-4 h-4 text-teal-600 dark:text-teal-400" strokeWidth={1.75} aria-hidden />
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted">Ficha de banho e tosa</p>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Info label="Porte">{p.size ? PET_SIZE[p.size] ?? p.size : null}</Info>
            <Info label="Pelagem">{p.coat}</Info>
            <Info label="Temperamento">{p.temperament ? TEMPERAMENT[p.temperament] ?? p.temperament : null}</Info>
            <Info label="Observações">{p.grooming_notes}</Info>
          </dl>
        </Card>
      )}

      <Card>
        <Tabs id="pac" value={tab} onChange={setTab} className="mb-4"
          tabs={[
            { value: 'rec', label: 'Prontuário', count: p.records.length },
            { value: 'vac', label: 'Vacinas', count: vaccines },
            { value: 'peso', label: 'Peso' },
            { value: 'appts', label: 'Atendimentos', count: p.appointments.length },
            { value: 'dados', label: 'Dados' },
          ]} />

        {tab === 'rec' && (
          <RecordTimeline key={p.id} records={p.records} canAct={canAct} meId={me.user.id} isAdmin={role === 'admin'}
            onEdit={r => setRec({ open: true, kind: r.kind, initial: r })}
            onNew={canRecord ? () => newRecord(defaultKind) : undefined}
            onChanged={onRecordChanged} />
        )}
        {tab === 'vac' && <VaccinesPanel p={p} onNew={isVet ? () => newRecord('vacina') : undefined} />}
        {tab === 'peso' && (
          p.weights.length >= 2 ? (
            <div>
              <LineChart points={p.weights.map(w => ({ x: w.date, y: w.kg }))} format={kg}
                xFormat={x => toDate(x).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} />
              <ul className="mt-4 divide-y divide-line">
                {[...p.weights].reverse().map((w, i, arr) => {
                  const prev = arr[i + 1]
                  const diff = prev ? w.kg - prev.kg : null
                  return (
                    <li key={`${w.date}-${i}`} className="flex items-center justify-between h-11 text-sm">
                      <span className="text-muted tabular-nums">{fmtDate(w.date)}</span>
                      <span className="flex items-center gap-3 tabular-nums">
                        {diff != null && diff !== 0 && (
                          <span className={`text-xs ${diff > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {diff > 0 ? '+' : '−'}{kg(Math.abs(Math.round(diff * 100) / 100))}
                          </span>
                        )}
                        <span className="font-semibold text-ink">{kg(w.kg)}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <EmptyState icon={Scale} title="Registre o peso em duas consultas para ver a curva"
              hint={p.weights.length === 1 ? `Último peso: ${kg(p.weights[0].kg)} em ${fmtDate(p.weights[0].date)}.` : undefined} />
          )
        )}
        {tab === 'appts' && (
          <ApptList appts={p.appointments} showPet={false} onOpen={a => setAppt({ open: true, initial: a })}
            emptyAction={client && !p.deceased ? <Btn size="sm" variant="soft" icon={CalendarPlus} onClick={() => setAppt({ open: true, initial: null })}>Agendar</Btn> : undefined} />
        )}
        {tab === 'dados' && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Info label="Nome">{p.name}</Info>
            <Info label="Espécie">{SPECIES[p.species] ?? p.species}</Info>
            <Info label="Raça">{p.breed}</Info>
            <Info label="Sexo">{sexLabel(p.sex)}</Info>
            <Info label="Nascimento">{p.birth_date ? `${fmtDay(p.birth_date)}${ageFrom(p.birth_date) ? ` (${ageFrom(p.birth_date)})` : ''}` : null}</Info>
            <Info label="Peso cadastrado">{p.weight_kg != null ? kg(p.weight_kg) : null}</Info>
            <Info label="Castrado">{p.neutered == null ? null : p.neutered ? 'Sim' : 'Não'}</Info>
            <Info label="Cor">{p.color}</Info>
            <Info label="Microchip">{p.microchip}</Info>
            <Info label="Alergias e alertas">{p.allergies}</Info>
            <Info label="Porte">{p.size ? PET_SIZE[p.size] ?? p.size : null}</Info>
            <Info label="Pelagem">{p.coat}</Info>
            <Info label="Temperamento">{p.temperament ? TEMPERAMENT[p.temperament] ?? p.temperament : null}</Info>
            <Info label="Banho e tosa: observações">{p.grooming_notes}</Info>
            <Info label="Situação">{p.deceased ? 'Falecido' : 'Ativo'}</Info>
            <div className="sm:col-span-2 lg:col-span-3"><Info label="Observações"><span className="whitespace-pre-wrap">{p.notes}</span></Info></div>
            <Info label="Cadastrado em">{fmtDate(p.created_at)}</Info>
          </dl>
        )}
      </Card>

      {canRecord && (
        <RecordSheet open={rec.open} onClose={() => setRec(r => ({ ...r, open: false }))} onSaved={() => reload()}
          patient={p} kind={rec.kind} initial={rec.initial} allowedKinds={allowedKinds} records={p.records} />
      )}
      {isVet && <DocumentSheet open={doc} onClose={() => setDoc(false)} patient={p} client={client} />}
      <PatientModal open={edit} onClose={() => setEdit(false)} onSaved={() => reload()} clientId={p.client_id} initial={p} />
      {client && <InviteSheet open={invite} onClose={() => setInvite(false)} patient={p} client={client} />}
      {client && (
        <ApptModal open={appt.open} onClose={() => setAppt({ open: false, initial: null })} onSaved={() => reload()} onDeleted={() => reload()}
          presetClient={client} presetPatientId={p.id} initial={appt.initial} />
      )}
    </div>
  )
}
