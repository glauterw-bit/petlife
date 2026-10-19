'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { crm, type Dashboard, type Appt } from '@/lib/crmApi'
import { useCrm, can } from '@/components/crm/CrmShell'
import { Card, Kpi, PageHead, Btn, Badge, Empty, brl, fmtTime, APPT_STATUS, APPT_TYPE } from '@/components/crm/ui'
import { ApptModal } from '@/components/crm/forms'
import { useToast } from '@/components/ui/ToastContext'

export default function ClinicaPainel() {
  const { me } = useCrm()
  const router = useRouter()
  const { error } = useToast()
  const [d, setD] = useState<Dashboard | null>(null)
  const [apptOpen, setApptOpen] = useState(false)
  const load = () => crm.dashboard().then(setD).catch(() => {})
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t) }, [])

  async function setStatus(a: Appt, status: string) {
    try { await crm.patchAppt(a.id, { status }); load() } catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }
  const hello = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div>
      <PageHead title={`${hello}, ${me.user.name.split(' ')[0]}`} sub={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        actions={<><Btn onClick={() => setApptOpen(true)}>+ Agendar</Btn><Btn variant="ghost" onClick={() => router.push('/clinica/caixa')}>Nova venda</Btn></>} />
      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {can(me.user.role) && <Kpi label="Faturamento hoje" value={brl(d.revenue_today)} tone="good" />}
            {can(me.user.role) && <Kpi label="Faturamento do mês" value={brl(d.revenue_month)} />}
            <Kpi label="Atendimentos hoje" value={d.today.length} sub={`${d.today_by_status.concluido ?? 0} concluídos · ${(d.today_by_status.chegou ?? 0) + (d.today_by_status.em_atendimento ?? 0)} na clínica`} />
            <Kpi label="Clientes" value={d.total_clients} sub={`${d.total_patients} pets · +${d.new_clients_month} no mês`} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-surface-900 dark:text-white">Agenda de hoje</h2>
                <Link href="/clinica/agenda" className="text-sm font-semibold text-primary-600">Ver agenda</Link>
              </div>
              {d.today.length === 0 ? <Empty>Nenhum atendimento marcado para hoje.</Empty> : (
                <div className="divide-y divide-surface-100 dark:divide-surface-700">
                  {d.today.map(a => (
                    <div key={a.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                      <span className="w-12 text-sm font-bold tabular-nums text-surface-900 dark:text-white">{fmtTime(a.starts_at)}</span>
                      <div className="flex-1 min-w-[160px]">
                        <p className="text-sm font-semibold text-surface-900 dark:text-white">
                          {a.patient_id ? <Link href={`/clinica/pacientes/${a.patient_id}`} className="hover:underline">{a.patient_name}</Link> : '—'}
                          <span className="font-normal text-surface-500"> · {APPT_TYPE[a.type] ?? a.type}</span>
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">{a.client_name}{a.staff_name ? ` · ${a.staff_name}` : ''}</p>
                      </div>
                      <Badge cls={APPT_STATUS[a.status]?.cls}>{APPT_STATUS[a.status]?.label ?? a.status}</Badge>
                      <div className="flex gap-1.5">
                        {['agendado', 'confirmado'].includes(a.status) && <Btn variant="soft" className="!py-1 !px-2.5 text-xs" onClick={() => setStatus(a, 'chegou')}>Chegou</Btn>}
                        {a.status === 'chegou' && <Btn variant="soft" className="!py-1 !px-2.5 text-xs" onClick={() => setStatus(a, 'em_atendimento')}>Atender</Btn>}
                        {['chegou', 'em_atendimento'].includes(a.status) && <Btn className="!py-1 !px-2.5 text-xs" onClick={() => router.push(`/clinica/caixa?appointment=${a.id}`)}>Finalizar</Btn>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <div className="space-y-4">
              <Card>
                <h2 className="font-bold text-surface-900 dark:text-white mb-2">Para hoje</h2>
                <div className="space-y-2 text-sm">
                  <Link href="/clinica/lembretes" className="flex justify-between hover:underline"><span>🔔 Vacinas e retornos a avisar</span><b className="tabular-nums">{d.reminders_due}</b></Link>
                  <Link href="/clinica/app" className="flex justify-between hover:underline"><span>📱 Pets novos vindos do app</span><b className="tabular-nums">{d.app_patients_pending}</b></Link>
                  <Link href="/clinica/estoque" className="flex justify-between hover:underline"><span>📦 Produtos com estoque baixo</span><b className={`tabular-nums ${d.low_stock.length ? 'text-red-600' : ''}`}>{d.low_stock.length}</b></Link>
                </div>
              </Card>
              {d.low_stock.length > 0 && (
                <Card>
                  <h2 className="font-bold text-surface-900 dark:text-white mb-2">Estoque baixo</h2>
                  {d.low_stock.map(i => (
                    <p key={i.id} className="text-sm flex justify-between"><span className="truncate">{i.name}</span><span className="text-red-600 tabular-nums">{i.stock_qty ?? 0} {i.unit}</span></p>
                  ))}
                </Card>
              )}
            </div>
          </div>
        </>
      )}
      <ApptModal open={apptOpen} onClose={() => setApptOpen(false)} onSaved={load} />
    </div>
  )
}
