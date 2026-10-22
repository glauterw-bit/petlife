'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CalendarCheck, Package, PawPrint, Plus, ShoppingCart, Smartphone, Users } from 'lucide-react'
import { crm, type Appt, type ApptStatus, type Dashboard } from '@/lib/crmApi'
import { can, useCrm, useCrmChange } from '@/components/crm/CrmShell'
import { APPT_STATUS, Btn, Card, Kpi, PageHead, brl, dayRange } from '@/components/crm/ui'
import { ErrorState, Meter, Skeleton, SkeletonKpis, SkeletonRows, StackBar, useAsync, useNow } from '@/components/crm/kit'
import { AnimatedNumber } from '@/components/crm/motion'
import { ApptModal } from '@/components/crm/forms'
import { useToast } from '@/components/ui/ToastContext'
import { CounterLink, TodayFlow } from '@/components/crm/painel/TodayFlow'
import { errMsg, firstName } from '@/components/crm/painel/shared'

const STATUS_ORDER = ['agendado', 'confirmado', 'chegou', 'em_atendimento', 'pronto', 'concluido', 'faltou', 'cancelado']

export default function ClinicaPainel() {
  const { me } = useCrm()
  const router = useRouter()
  const toast = useToast()
  const now = useNow(30_000)
  const [apptOpen, setApptOpen] = useState(false)
  const role = me.user.role
  const money = can(role, 'recepcao')

  const dash = useAsync(() => crm.dashboard(), [])
  const tomorrow = useAsync(() => {
    const t = new Date()
    const [a, b] = dayRange(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1))
    return crm.appointments(a, b)
  }, [])

  const reloadAll = () => { dash.reload(); tomorrow.reload() }
  useEffect(() => {
    const t = setInterval(reloadAll, 60_000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useCrmChange(['appointment', 'sale'], reloadAll)

  const d = dash.data
  const dataRef = useRef(dash.data)
  dataRef.current = dash.data
  const toConfirm = useMemo(
    () => (tomorrow.data ?? []).filter(a => a.status === 'agendado').length,
    [tomorrow.data],
  )

  async function setStatus(a: Appt, status: ApptStatus) {
    const prev = dash.data
    if (prev) dash.setData({ ...prev, today: prev.today.map(x => (x.id === a.id ? { ...x, status } : x)) })
    try {
      const saved = await crm.patchAppt(a.id, { status })
      const cur = dataRef.current ?? prev
      if (cur) dash.setData({ ...cur, today: cur.today.map(x => (x.id === a.id ? saved : x)) })
      dash.reload()
    } catch (e) {
      if (prev) dash.setData(prev)
      toast.error(errMsg(e, 'Não foi possível mudar a situação.'))
      throw e
    }
  }

  const h = now.getHours()
  const hello = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const dateLong = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <PageHead
        title={`${hello}, ${firstName(me.user.name)}`}
        sub={<span className="first-letter:uppercase inline-block">{dateLong}</span>}
        actions={<>
          <Btn icon={Plus} onClick={() => setApptOpen(true)}>Agendar</Btn>
          <Btn variant="outline" icon={ShoppingCart} onClick={() => router.push('/clinica/caixa')}>Nova venda</Btn>
        </>}
      />

      {!d && dash.error ? (
        <Card><ErrorState message={dash.error} onRetry={dash.reload} /></Card>
      ) : !d ? (
        <div className="space-y-4">
          <SkeletonKpis count={4} />
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2"><Skeleton className="h-4 w-32 mb-4" /><SkeletonRows rows={5} /></Card>
            <Card><Skeleton className="h-4 w-24 mb-4" /><SkeletonRows rows={3} /></Card>
          </div>
        </div>
      ) : (
        <DashboardBody d={d} money={money} showStock={can(role, 'recepcao')} toConfirm={toConfirm} now={now}
          onStatus={setStatus} onSchedule={() => setApptOpen(true)} />
      )}

      <ApptModal open={apptOpen} onClose={() => setApptOpen(false)} onSaved={() => reloadAll()} />
    </div>
  )
}

function DashboardBody({ d, money, showStock, toConfirm, now, onStatus, onSchedule }: {
  d: Dashboard; money: boolean; showStock: boolean; toConfirm: number; now: Date
  onStatus: (a: Appt, s: ApptStatus) => Promise<void>; onSchedule: () => void
}) {
  const series = d.revenue_by_day.map(x => x.total)
  const parts = STATUS_ORDER.map(s => ({ value: d.today_by_status[s] ?? 0, className: APPT_STATUS[s].dot, label: APPT_STATUS[s].label }))
  const done = d.today_by_status.concluido ?? 0

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 lg:mb-5">
        {money ? (
          <>
            <Kpi label="Faturamento hoje" value={d.revenue_today} format={brl} tone="good" />
            <Kpi label="Faturamento do mês" value={d.revenue_month} format={brl} series={series.length >= 2 ? series : undefined} />
          </>
        ) : (
          <>
            <Kpi label="Clientes" icon={Users} value={d.total_clients} sub={d.new_clients_month ? `${d.new_clients_month} novos no mês` : undefined} href="/clinica/clientes" />
            <Kpi label="Pacientes" icon={PawPrint} value={d.total_patients} href="/clinica/clientes" />
          </>
        )}
        <Card className="h-full">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted">Atendimentos hoje</p>
          <p className="text-kpi font-bold tabular-nums mt-1.5 text-ink"><AnimatedNumber value={d.today.length} /></p>
          <div className="mt-2"><StackBar parts={parts} height={6} /></div>
          <p className="text-xs text-muted mt-1.5 tabular-nums">{done} {done === 1 ? 'concluído' : 'concluídos'}</p>
        </Card>
        <Kpi label="Na clínica agora" value={d.in_clinic} href="/clinica/recepcao" tone={d.in_clinic ? 'brand' : 'default'} sub="Ver a recepção" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-bold text-ink">Fluxo de hoje</h2>
            <Link href="/clinica/agenda" className="text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline">Ver agenda</Link>
          </div>
          <TodayFlow appts={d.today} now={now} onStatus={onStatus} onSchedule={onSchedule} />
        </Card>

        <div className="space-y-4 min-w-0">
          <Card>
            <h2 className="font-bold text-ink mb-1">Para hoje</h2>
            <div className="divide-y divide-line">
              <CounterLink href="/clinica/lembretes" icon={Bell} label="Lembretes de vacina" count={d.reminders_due} tone="warn" />
              <CounterLink href="/clinica/lembretes?aba=confirmar" icon={CalendarCheck} label="Confirmar amanhã" count={toConfirm} />
              <CounterLink href="/clinica/app" icon={Smartphone} label="Pets do app para importar" count={d.app_patients_pending} />
            </div>
          </Card>

          {showStock && (
            <Card>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="font-bold text-ink">Estoque baixo</h2>
                <Link href="/clinica/estoque" className="text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline">Ver estoque</Link>
              </div>
              {d.low_stock.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted py-1">
                  <Package className="w-4 h-4" strokeWidth={1.75} aria-hidden /> Estoque em dia
                </p>
              ) : (
                <ul className="space-y-3">
                  {d.low_stock.slice(0, 6).map(i => {
                    const qty = i.stock_qty ?? 0
                    const min = i.min_stock ?? 0
                    return (
                      <li key={i.id}>
                        <Link href="/clinica/estoque" className="block rounded-lg -mx-1 px-1 py-0.5 hover:bg-panel-2">
                          <span className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate text-ink">{i.name}</span>
                            <span className="shrink-0 tabular-nums text-red-600 dark:text-red-400 font-semibold">
                              {qty.toLocaleString('pt-BR')}{i.unit ? ` ${i.unit}` : ''}
                              {min ? <span className="text-muted font-normal"> / mín. {min.toLocaleString('pt-BR')}</span> : null}
                            </span>
                          </span>
                          <Meter value={qty} max={Math.max(min * 2, qty, 1)} danger className="mt-1.5" />
                        </Link>
                      </li>
                    )
                  })}
                  {d.low_stock.length > 6 && (
                    <li className="text-xs text-muted">E mais {d.low_stock.length - 6} {d.low_stock.length - 6 === 1 ? 'item' : 'itens'}.</li>
                  )}
                </ul>
              )}
            </Card>
          )}

        </div>
      </div>
    </>
  )
}
