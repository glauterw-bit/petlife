'use client'

import { AlertTriangle, CalendarClock } from 'lucide-react'
import { crm } from '@/lib/crmApi'
import { brl, fmtDay } from '@/components/crm/ui'
import { AnimatedNumber } from '@/components/crm/motion'
import { DualBarChart, EmptyState, ErrorState, Skeleton, useAsync } from '@/components/crm/kit'
import { useCrmChange } from '@/components/crm/CrmShell'
import { ChartSkeleton, Section } from './shared'

/** Próximos 30 dias: o que entra (vendas a receber) e o que sai (contas a pagar). */
export function CashFlowCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { data, error, loading, reload } = useAsync(() => crm.cashflow(30), [refreshKey])
  useCrmChange(['sale', 'cash'], reload)

  const days = data?.days ?? []
  const totalIn = days.reduce((s, d) => s + d.in, 0)
  const totalOut = days.reduce((s, d) => s + d.out, 0)
  const balance = totalIn - totalOut
  const hasOverdue = !!data && (data.receivable_overdue > 0 || data.payable_overdue > 0)
  const hasNoDue = !!data && (data.no_due_in > 0 || data.no_due_out > 0)

  return (
    <Section title="Próximos 30 dias" sub="Vendas a receber e contas a pagar com vencimento marcado.">
      {!data && error ? <ErrorState message={error} onRetry={reload} compact />
        : !data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-14" />)}</div>
            <ChartSkeleton height={140} />
          </div>
        ) : (
          <div className="space-y-4" aria-busy={loading || undefined}>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Stat label="Entradas previstas" value={totalIn} cls="text-emerald-600 dark:text-emerald-400" />
              <Stat label="Saídas previstas" value={totalOut} cls="text-red-600 dark:text-red-400" />
              <Stat label="Saldo previsto" value={balance} cls={balance >= 0 ? 'text-ink' : 'text-red-600 dark:text-red-400'} />
            </dl>
            {totalIn === 0 && totalOut === 0 ? (
              <EmptyState icon={CalendarClock} compact title="Nada vencendo nos próximos 30 dias"
                hint="Vendas fiado com vencimento e contas a pagar aparecem aqui." />
            ) : (
              <DualBarChart
                data={days.map(d => ({ label: d.day.slice(8, 10), a: d.in, b: d.out }))}
                labels={['Entradas previstas', 'Saídas previstas']} height={140} format={brl}
              />
            )}
            {(hasOverdue || hasNoDue) && (
              <div className="space-y-2">
                {hasOverdue && (
                  <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span>Vencidos: a receber <b className="tabular-nums">{brl(data.receivable_overdue)}</b> · a pagar <b className="tabular-nums">{brl(data.payable_overdue)}</b></span>
                  </p>
                )}
                {hasNoDue && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                    <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span>Sem vencimento: a receber <b className="tabular-nums">{brl(data.no_due_in)}</b> · a pagar <b className="tabular-nums">{brl(data.no_due_out)}</b></span>
                  </p>
                )}
              </div>
            )}
            {days.length > 0 && (
              <p className="text-2xs text-muted">De {fmtDay(days[0].day)} a {fmtDay(days[days.length - 1].day)}.</p>
            )}
          </div>
        )}
    </Section>
  )
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-xl bg-panel-2/60 px-3 py-2.5">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`mt-0.5 text-lg font-bold tabular-nums ${cls}`}><AnimatedNumber value={value} format={brl} /></dd>
    </div>
  )
}
