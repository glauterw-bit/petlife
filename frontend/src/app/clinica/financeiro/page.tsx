'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Check, MoreHorizontal, Pencil, Plus, Receipt, Trash2, Wallet } from 'lucide-react'
import { crm, type Expense } from '@/lib/crmApi'
import { can, useCrm, useCrmChange } from '@/components/crm/CrmShell'
import { Badge, Btn, Kpi, PageHead, PAY, brl, catLabel, fmtDate, fmtDay, monthRange, type Tone } from '@/components/crm/ui'
import {
  BarChart, DataList, DateNav, DropdownMenu, EmptyState, ErrorState, HBars, SkeletonKpis, useAsync, useConfirm, type Column,
} from '@/components/crm/kit'
import { AdminOnly, ChartSkeleton, Section } from '@/components/crm/financeiro/shared'
import { CashFlowCard } from '@/components/crm/financeiro/CashFlowCard'
import { ExpenseSheet } from '@/components/crm/financeiro/ExpenseSheet'
import { useToast } from '@/components/ui/ToastContext'

const pad = (n: number) => String(n).padStart(2, '0')
const ymOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

function localDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
function daysFromToday(iso: string) {
  const t = new Date()
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  return Math.round((localDay(iso).getTime() - today.getTime()) / 86400000)
}

/** Situação de uma despesa: paga, a vencer, vencida ou sem vencimento. */
function expenseStatus(e: Expense): { label: string; tone: Tone } {
  if (e.paid_at) return { label: `Paga em ${fmtDate(e.paid_at).slice(0, 5)}`, tone: 'good' }
  if (!e.due_date) return { label: 'Sem vencimento', tone: 'default' }
  const n = daysFromToday(e.due_date)
  if (n < 0) return { label: n === -1 ? 'Vencida ontem' : `Vencida há ${-n} dias`, tone: 'bad' }
  if (n === 0) return { label: 'Vence hoje', tone: 'warn' }
  if (n === 1) return { label: 'Vence amanhã', tone: 'warn' }
  return { label: `Vence em ${n} dias`, tone: n <= 7 ? 'warn' : 'default' }
}

export default function FinanceiroPage() {
  const { me } = useCrm()
  if (!can(me.user.role)) {
    return (
      <div>
        <PageHead title="Financeiro" />
        <AdminOnly />
      </div>
    )
  }
  return <Financeiro />
}

function Financeiro() {
  const { error: toastError, success } = useToast()
  const { confirm } = useConfirm()
  const now = new Date()
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const ym = ymOf(month)
  const isCurrent = ym === ymOf(now)
  const [tick, setTick] = useState(0)
  const fin = useAsync(() => crm.finance(ym), [ym, tick])
  const exps = useAsync(() => { const [a, b] = monthRange(ym); return crm.expenses(a, b) }, [ym, tick])
  const [sheet, setSheet] = useState<{ open: boolean; initial: Expense | null }>({ open: false, initial: null })
  const [busyId, setBusyId] = useState<number | null>(null)
  const refresh = () => setTick(t => t + 1)
  useCrmChange(['sale', 'cash'], refresh)

  const f = fin.data
  const empty = !!f && f.revenue === 0 && f.expenses === 0 && f.sales_count === 0 && (exps.data?.length ?? 0) === 0

  const byDay = useMemo(() => (f?.by_day ?? []).map(d => ({
    label: String(Number(d.day.slice(8, 10))), value: d.total, hint: fmtDay(d.day),
  })), [f])

  async function pay(e: Expense) {
    const ok = await confirm({ title: 'Marcar como paga?', message: <>A despesa <b>{e.description}</b> de <b>{brl(e.amount)}</b> entra no resultado de hoje.</>, confirmLabel: 'Marcar como paga' })
    if (!ok) return
    setBusyId(e.id)
    try { await crm.payExpense(e.id); success('Despesa paga.'); refresh() }
    catch (err) { toastError(err instanceof Error ? err.message : 'Não foi possível marcar como paga.') }
    finally { setBusyId(null) }
  }
  async function remove(e: Expense) {
    const ok = await confirm({ title: 'Excluir despesa?', message: <><b>{e.description}</b> ({brl(e.amount)}) sai do financeiro. Isso não pode ser desfeito.</>, confirmLabel: 'Excluir', tone: 'danger' })
    if (!ok) return
    setBusyId(e.id)
    try { await crm.deleteExpense(e.id); success('Despesa excluída.'); refresh() }
    catch (err) { toastError(err instanceof Error ? err.message : 'Não foi possível excluir.') }
    finally { setBusyId(null) }
  }

  const actions = (e: Expense) => (
    <>
      {!e.paid_at && <Btn size="sm" variant="soft" icon={Check} loading={busyId === e.id} onClick={() => pay(e)}>Pagar</Btn>}
      <DropdownMenu ariaLabel={`Mais ações para ${e.description}`} align="end"
        triggerClassName="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-panel-2"
        trigger={<MoreHorizontal className="w-4 h-4" strokeWidth={1.75} />}
        items={[
          { label: 'Editar', icon: Pencil, onSelect: () => setSheet({ open: true, initial: e }) },
          'separator',
          { label: 'Excluir', icon: Trash2, danger: true, onSelect: () => remove(e) },
        ]} />
    </>
  )

  const columns: Column<Expense>[] = [
    { key: 'desc', header: 'Descrição', cell: e => <span className="font-medium">{e.description}</span> },
    { key: 'cat', header: 'Categoria', cell: e => <span className="text-muted">{catLabel(e.category)}</span>, hideBelow: 'lg' },
    { key: 'due', header: 'Vencimento', cell: e => <span className="tabular-nums text-muted">{fmtDay(e.due_date)}</span> },
    { key: 'st', header: 'Situação', cell: e => { const s = expenseStatus(e); return <Badge tone={s.tone}>{s.label}</Badge> } },
    { key: 'amount', header: 'Valor', align: 'right', cell: e => <span className="font-semibold">{brl(e.amount)}</span> },
  ]

  const expTotal = (exps.data ?? []).reduce((s, e) => s + e.amount, 0)
  const expOpen = (exps.data ?? []).filter(e => !e.paid_at).reduce((s, e) => s + e.amount, 0)
  const margin = f && f.revenue > 0 ? Math.round((f.profit / f.revenue) * 100) : null

  return (
    <div>
      <PageHead title="Financeiro" sub="Resultado do mês, contas a pagar e o que vem pela frente."
        actions={<>
          <DateNav mode="month" value={month} onChange={d => setMonth(new Date(d.getFullYear(), d.getMonth(), 1))} />
          <Btn icon={Plus} onClick={() => setSheet({ open: true, initial: null })}>Nova despesa</Btn>
        </>} />

      {!f && fin.error ? (
        <ErrorState message={fin.error} onRetry={fin.reload} />
      ) : !f ? (
        <div className="space-y-4">
          <SkeletonKpis count={6} />
          <div className="bg-panel rounded-2xl shadow-crm-card p-4 lg:p-5"><ChartSkeleton /></div>
        </div>
      ) : (
        <div className="space-y-4" aria-busy={fin.loading || undefined}>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Kpi label="Receita" value={f.revenue} format={brl} icon={Wallet} />
            <Kpi label="Despesas" value={f.expenses} format={brl} sub="Pagas no mês" />
            <Kpi label="Lucro" value={f.profit} format={brl} tone={f.profit >= 0 ? 'good' : 'bad'} sub={margin != null ? `Margem de ${margin}%` : undefined} />
            <Kpi label="Ticket médio" value={f.avg_ticket} format={brl} sub={`${f.sales_count} ${f.sales_count === 1 ? 'venda' : 'vendas'}`} />
            <Kpi label="A receber" value={f.receivable_open} format={brl} tone={f.receivable_open > 0 ? 'warn' : 'default'} sub="Vendas em aberto" href="/clinica/caixa" />
            <Kpi label="A pagar" value={f.payable_open} format={brl} tone={f.payable_open > 0 ? 'warn' : 'default'} sub="Contas em aberto" />
          </div>

          {empty ? (
            <Section title="Receita por dia">
              <EmptyState icon={BarChart3} title="Sem movimento neste mês" hint="As vendas pagas e as despesas do mês aparecem aqui." />
            </Section>
          ) : (
            <>
              <Section title="Receita por dia" sub={`${f.sales_count} ${f.sales_count === 1 ? 'venda paga' : 'vendas pagas'} no mês`}>
                {byDay.some(d => d.value > 0)
                  ? <BarChart data={byDay} format={brl} highlightLast={isCurrent} height={170} />
                  : <EmptyState icon={BarChart3} compact title="Nenhuma venda paga neste mês" />}
              </Section>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title="Por forma de pagamento">
                  {f.by_method.length === 0 ? <EmptyState icon={Wallet} compact title="Nenhuma venda paga" />
                    : <HBars format={brl} data={f.by_method.map(m => ({ label: PAY[m.method] ?? m.method, value: m.total, sub: `${m.count} ${m.count === 1 ? 'venda' : 'vendas'}` }))} />}
                </Section>
                <Section title="Receita por categoria">
                  {f.by_category.length === 0 ? <EmptyState icon={BarChart3} compact title="Nenhuma venda paga" />
                    : <HBars format={brl} data={f.by_category.map(c => ({ label: catLabel(c.category), value: c.total }))} />}
                  <div className="mt-6 pt-5 border-t border-line">
                    <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted mb-3">Despesas por categoria</h3>
                    {f.expenses_by_category.length === 0 ? <p className="text-sm text-muted">Nenhuma despesa paga no mês.</p>
                      : <HBars format={brl} data={f.expenses_by_category.map(c => ({ label: catLabel(c.category), value: c.total }))} />}
                  </div>
                </Section>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-4 space-y-4">
        <CashFlowCard refreshKey={tick} />

        <Section title="Despesas do mês"
          sub={exps.data && exps.data.length > 0 ? <>Total <b className="tabular-nums text-ink">{brl(expTotal)}</b>{expOpen > 0 && <> · em aberto <b className="tabular-nums text-ink">{brl(expOpen)}</b></>}</> : undefined}
          actions={<Btn size="sm" variant="soft" icon={Plus} onClick={() => setSheet({ open: true, initial: null })}>Nova despesa</Btn>}>
          <DataList<Expense>
            ariaLabel="Despesas do mês"
            rows={exps.data}
            loading={exps.loading}
            error={exps.error}
            onRetry={exps.reload}
            columns={columns}
            rowKey={e => e.id}
            rowActions={actions}
            onRowClick={e => setSheet({ open: true, initial: e })}
            renderMobile={e => {
              const s = expenseStatus(e)
              return (
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-ink truncate">{e.description}</p>
                    <p className="font-semibold tabular-nums text-ink shrink-0">{brl(e.amount)}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="truncate">{catLabel(e.category)}</span>
                  </div>
                </div>
              )
            }}
            empty={<EmptyState icon={Receipt} compact title="Nenhuma despesa neste mês"
              hint="Lance aluguel, salários e fornecedores para ver o lucro de verdade."
              action={<Btn size="sm" icon={Plus} onClick={() => setSheet({ open: true, initial: null })}>Nova despesa</Btn>} />}
          />
        </Section>
      </div>

      <ExpenseSheet open={sheet.open} initial={sheet.initial} onClose={() => setSheet(s => ({ ...s, open: false }))} onSaved={refresh} />
    </div>
  )
}
