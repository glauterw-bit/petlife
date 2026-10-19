'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { crm, type ClientFull } from '@/lib/crmApi'
import { useCrm, can } from '@/components/crm/CrmShell'
import { Card, PageHead, Btn, Badge, Empty, brl, fmtDate, fmtDateTime, waLink, SPECIES, APPT_STATUS, APPT_TYPE, PAY } from '@/components/crm/ui'
import { ClientModal, PatientModal, ApptModal } from '@/components/crm/forms'
import { useToast } from '@/components/ui/ToastContext'

export default function ClienteFicha() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { me } = useCrm()
  const { error, success } = useToast()
  const [c, setC] = useState<ClientFull | null>(null)
  const [edit, setEdit] = useState(false)
  const [newPet, setNewPet] = useState(false)
  const [appt, setAppt] = useState(false)
  const load = () => crm.client(Number(id)).then(setC).catch(e => error(e.message))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return <p className="text-surface-500">Carregando…</p>
  const wa = waLink(c.phone, `Olá, ${c.name.split(' ')[0]}! Aqui é da ${me.clinic.name}. 🐾`)

  async function remove() {
    if (!c || !confirm(`Excluir ${c.name} e todos os pets, agendamentos e prontuários? Não dá para desfazer.`)) return
    try { await crm.deleteClient(c.id); success('Cliente excluído.'); router.push('/clinica/clientes') } catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <div>
      <PageHead title={c.name} sub={[c.phone, c.email].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}
        actions={<>
          {wa && <a href={wa} target="_blank" rel="noreferrer"><Btn variant="soft">WhatsApp</Btn></a>}
          <Btn variant="ghost" onClick={() => setAppt(true)}>Agendar</Btn>
          <Btn variant="ghost" onClick={() => router.push(`/clinica/caixa?client=${c.id}`)}>Nova venda</Btn>
          <Btn variant="ghost" onClick={() => setEdit(true)}>Editar</Btn>
          {can(me.user.role) && <Btn variant="danger" onClick={remove}>Excluir</Btn>}
        </>} />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-surface-900 dark:text-white">Pets</h2>
              <Btn variant="soft" onClick={() => setNewPet(true)}>+ Pet</Btn>
            </div>
            {c.patients.length === 0 ? <Empty>Nenhum pet cadastrado.</Empty> : (
              <div className="grid sm:grid-cols-2 gap-2">
                {c.patients.map(p => (
                  <Link key={p.id} href={`/clinica/pacientes/${p.id}`} className="rounded-xl border border-surface-100 dark:border-surface-700 p-3 hover:border-primary-300">
                    <p className="font-semibold text-surface-900 dark:text-white">{SPECIES[p.species]?.split(' ')[0]} {p.name} {p.deceased && <span className="text-xs text-surface-400">(falecido)</span>}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{[p.breed, p.weight_kg ? `${p.weight_kg} kg` : null, p.petlife_linked ? '📱 usa o app' : null].filter(Boolean).join(' · ') || '—'}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <h2 className="font-bold text-surface-900 dark:text-white mb-3">Agendamentos</h2>
            {c.appointments.length === 0 ? <Empty>Nenhum agendamento.</Empty> : c.appointments.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-2 py-1.5 text-sm border-b border-surface-50 dark:border-surface-700/50 last:border-0">
                <span className="tabular-nums text-surface-500 w-32">{fmtDateTime(a.starts_at)}</span>
                <span className="flex-1">{APPT_TYPE[a.type]} · {a.patient_name ?? '—'}</span>
                <Badge cls={APPT_STATUS[a.status]?.cls}>{APPT_STATUS[a.status]?.label}</Badge>
              </div>
            ))}
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <h2 className="font-bold text-surface-900 dark:text-white mb-2">Resumo</h2>
            <div className="text-sm space-y-1">
              <p className="flex justify-between"><span>Total gasto</span><b className="tabular-nums">{brl(c.total_spent)}</b></p>
              <p className="flex justify-between"><span>Em aberto</span><b className={`tabular-nums ${c.open_balance > 0 ? 'text-red-600' : ''}`}>{brl(c.open_balance)}</b></p>
              <p className="flex justify-between"><span>Cliente desde</span><span>{fmtDate(c.created_at)}</span></p>
              {c.petlife_linked && <p className="text-xs text-primary-700 dark:text-primary-300 pt-1">📱 Conectado ao app PetLife</p>}
            </div>
            {(c.document || c.address || c.notes) && (
              <div className="text-xs text-surface-600 dark:text-surface-300 mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 space-y-1">
                {c.document && <p>CPF: {c.document}</p>}{c.address && <p>{c.address}</p>}{c.notes && <p className="whitespace-pre-wrap">{c.notes}</p>}
              </div>
            )}
          </Card>
          <Card>
            <h2 className="font-bold text-surface-900 dark:text-white mb-2">Compras</h2>
            {c.sales.length === 0 ? <Empty>Nenhuma compra.</Empty> : c.sales.map(s => (
              <p key={s.id} className="flex justify-between text-sm py-1">
                <span className="text-surface-500">{fmtDate(s.created_at)} · {PAY[s.payment_method ?? ''] ?? s.payment_method}</span>
                <span className={`tabular-nums font-semibold ${s.status === 'aberta' ? 'text-red-600' : s.status === 'cancelada' ? 'line-through text-surface-400' : ''}`}>{brl(s.total)}</span>
              </p>
            ))}
          </Card>
        </div>
      </div>
      <ClientModal open={edit} onClose={() => setEdit(false)} onSaved={load} initial={c} />
      <PatientModal open={newPet} onClose={() => setNewPet(false)} onSaved={load} clientId={c.id} />
      <ApptModal open={appt} onClose={() => setAppt(false)} onSaved={load} presetClient={c} />
    </div>
  )
}
