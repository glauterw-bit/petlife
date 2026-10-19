'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { crm, type Reminder } from '@/lib/crmApi'
import { useCrm } from '@/components/crm/CrmShell'
import { Card, PageHead, Select, Empty, Badge, fmtDate, waLink } from '@/components/crm/ui'

export default function Lembretes() {
  const { me } = useCrm()
  const [days, setDays] = useState(30)
  const [list, setList] = useState<Reminder[]>([])
  const [sent, setSent] = useState<Record<number, boolean>>({})
  useEffect(() => { crm.reminders(days).then(setList).catch(() => {}) }, [days])
  const msg = (r: Reminder) => r.overdue
    ? `Olá, ${r.client_name.split(' ')[0]}! Aqui é da ${me.clinic.name}. A ${r.kind === 'vacina' ? `vacina ${r.what}` : r.what} de ${r.patient_name} venceu em ${fmtDate(r.next_due)}. Vamos agendar? 🐾`
    : `Olá, ${r.client_name.split(' ')[0]}! Aqui é da ${me.clinic.name}. ${r.kind === 'vacina' ? `A vacina ${r.what}` : r.what} de ${r.patient_name} vence em ${fmtDate(r.next_due)}. Quer agendar um horário? 🐾`
  return (
    <div>
      <PageHead title="Lembretes" sub="Vacinas e retornos para avisar — o cliente que volta é o mais barato de conquistar"
        actions={<Select className="!w-auto" value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 15, 30, 60].map(d => <option key={d} value={d}>Próximos {d} dias</option>)}</Select>} />
      <Card className="!p-0">
        {list.length === 0 ? <Empty>Nada para avisar neste período.</Empty> : list.map(r => {
          const wa = waLink(r.client_phone, msg(r))
          return (
            <div key={r.record_id} className="flex items-center gap-3 flex-wrap px-4 py-3 border-b border-surface-50 dark:border-surface-700/50 last:border-0">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-semibold text-surface-900 dark:text-white">
                  <Link href={`/clinica/pacientes/${r.patient_id}`} className="hover:underline">{r.patient_name}</Link> · {r.what}
                </p>
                <p className="text-xs text-surface-500"><Link href={`/clinica/clientes/${r.client_id}`} className="hover:underline">{r.client_name}</Link>{r.client_phone ? ` · ${r.client_phone}` : ''}{r.in_app ? ' · 📱 recebe lembrete no app' : ''}</p>
              </div>
              {r.overdue ? <Badge cls="bg-red-100 text-red-700">venceu {fmtDate(r.next_due)}</Badge> : <Badge cls="bg-amber-100 text-amber-800">vence {fmtDate(r.next_due)}</Badge>}
              {wa ? <a href={wa} target="_blank" rel="noreferrer" onClick={() => setSent(s => ({ ...s, [r.record_id]: true }))}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${sent[r.record_id] ? 'bg-surface-100 text-surface-500' : 'bg-emerald-500 text-white'}`}>{sent[r.record_id] ? 'Enviado ✓' : 'Avisar no WhatsApp'}</a>
                : <span className="text-xs text-surface-400">sem celular</span>}
            </div>
          )
        })}
      </Card>
    </div>
  )
}
