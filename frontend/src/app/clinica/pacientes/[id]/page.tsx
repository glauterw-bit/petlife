'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { crm, type PatientFull } from '@/lib/crmApi'
import { useCrm, can } from '@/components/crm/CrmShell'
import { Card, PageHead, Btn, Badge, Empty, fmtDate, fmtDateTime, SPECIES, RECORD_KIND, APPT_STATUS, APPT_TYPE } from '@/components/crm/ui'
import { PatientModal, RecordModal } from '@/components/crm/forms'
import { useToast } from '@/components/ui/ToastContext'

function age(iso: string | null) {
  if (!iso) return null
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 86400000))
  return m < 12 ? `${m} meses` : `${Math.floor(m / 12)} ano${m >= 24 ? 's' : ''}`
}

export default function PacienteFicha() {
  const { id } = useParams<{ id: string }>()
  const { me } = useCrm()
  const { error, success } = useToast()
  const [p, setP] = useState<PatientFull | null>(null)
  const [edit, setEdit] = useState(false)
  const [rec, setRec] = useState<string | null>(null)
  const load = () => crm.patient(Number(id)).then(setP).catch(e => error(e.message))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <p className="text-surface-500">Carregando…</p>
  const role = me.user.role
  const kinds = can(role, 'vet') ? undefined : ['banho_tosa']
  const canRecord = can(role, 'vet', 'banho_tosa')

  async function delRecord(rid: number) {
    if (!confirm('Excluir este registro do prontuário?')) return
    try { await crm.deleteRecord(rid); success('Registro excluído.'); load() } catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <div>
      <PageHead title={`${SPECIES[p.species]?.split(' ')[0] ?? ''} ${p.name}`}
        sub={[p.breed, age(p.birth_date), p.weight_kg ? `${p.weight_kg} kg` : null, p.sex === 'male' ? 'Macho' : p.sex === 'female' ? 'Fêmea' : null, p.neutered ? 'Castrado' : null].filter(Boolean).join(' · ')}
        actions={<>
          {canRecord && can(role, 'vet') && <Btn onClick={() => setRec('consulta')}>+ Consulta</Btn>}
          {canRecord && can(role, 'vet') && <Btn variant="soft" onClick={() => setRec('vacina')}>+ Vacina</Btn>}
          {canRecord && !can(role, 'vet') && <Btn onClick={() => setRec('banho_tosa')}>+ Banho e tosa</Btn>}
          {canRecord && can(role, 'vet') && <Btn variant="ghost" onClick={() => setRec('observacao')}>+ Outro registro</Btn>}
          <Btn variant="ghost" onClick={() => setEdit(true)}>Editar</Btn>
        </>} />
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <h2 className="font-bold text-surface-900 dark:text-white mb-3">Prontuário</h2>
          {p.records.length === 0 ? <Empty>Nenhum registro ainda.</Empty> : (
            <div className="space-y-3">
              {p.records.map(r => (
                <div key={r.id} className="rounded-xl border border-surface-100 dark:border-surface-700 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">{RECORD_KIND[r.kind] ?? r.kind} · {r.title}</p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">{fmtDateTime(r.created_at)}{r.staff_name ? ` · ${r.staff_name}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.sent_to_app && <Badge cls="bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">📱 no app do tutor</Badge>}
                      {can(role, 'vet') && <button className="text-xs text-red-500" onClick={() => delRecord(r.id)}>excluir</button>}
                    </div>
                  </div>
                  {(r.vaccine_name || r.weight_kg || r.temperature_c || r.next_due) && (
                    <p className="text-xs text-surface-600 dark:text-surface-300 mt-1.5">
                      {[r.vaccine_name && `Vacina: ${r.vaccine_name}${r.vaccine_lot ? ` (lote ${r.vaccine_lot})` : ''}`, r.weight_kg && `Peso ${r.weight_kg} kg`, r.temperature_c && `Temp. ${r.temperature_c} °C`, r.next_due && `${r.kind === 'vacina' ? 'Próxima dose' : 'Retorno'}: ${fmtDate(r.next_due)}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {r.body && <p className="text-sm text-surface-700 dark:text-surface-200 mt-2 whitespace-pre-wrap">{r.body}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="font-bold text-surface-900 dark:text-white mb-2">Tutor</h2>
            {p.client && (
              <Link href={`/clinica/clientes/${p.client.id}`} className="block text-sm hover:underline">
                <b>{p.client.name}</b><br /><span className="text-surface-500">{p.client.phone || p.client.email || ''}</span>
              </Link>
            )}
            {(p.microchip || p.color || p.notes) && (
              <div className="text-xs text-surface-600 dark:text-surface-300 mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 space-y-1">
                {p.microchip && <p>Microchip: {p.microchip}</p>}{p.color && <p>Pelagem: {p.color}</p>}
                {p.notes && <p className="whitespace-pre-wrap text-amber-700 dark:text-amber-300">⚠️ {p.notes}</p>}
              </div>
            )}
          </Card>
          {p.petlife_linked && (
            <Card>
              <h2 className="font-bold text-surface-900 dark:text-white mb-1">Vacinas no app PetLife</h2>
              <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">Registradas pelo tutor ou por outras clínicas.</p>
              {p.app_vaccines.length === 0 ? <Empty>Nenhuma.</Empty> : p.app_vaccines.map((v, i) => (
                <p key={i} className="text-sm flex justify-between gap-2 py-0.5"><span className="truncate">{v.name}</span><span className="text-surface-500 tabular-nums">{fmtDate(v.date_given)}</span></p>
              ))}
            </Card>
          )}
          <Card>
            <h2 className="font-bold text-surface-900 dark:text-white mb-2">Agendamentos</h2>
            {p.appointments.length === 0 ? <Empty>Nenhum.</Empty> : p.appointments.map(a => (
              <p key={a.id} className="text-sm flex justify-between gap-2 py-0.5">
                <span>{fmtDate(a.starts_at)} · {APPT_TYPE[a.type]}</span><Badge cls={APPT_STATUS[a.status]?.cls}>{APPT_STATUS[a.status]?.label}</Badge>
              </p>
            ))}
          </Card>
        </div>
      </div>
      <PatientModal open={edit} onClose={() => setEdit(false)} onSaved={load} clientId={p.client_id} initial={p} />
      {rec && <RecordModal open onClose={() => setRec(null)} onSaved={load} patient={p} defaultKind={rec} allowedKinds={kinds} />}
    </div>
  )
}
