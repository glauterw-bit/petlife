'use client'

import { useEffect, useState } from 'react'
import { crm, type Finance, type Expense } from '@/lib/crmApi'
import { Card, PageHead, Btn, Field, Input, Select, Kpi, Empty, brl, fmtDate, PAY } from '@/components/crm/ui'
import { useToast } from '@/components/ui/ToastContext'

const EXP_CATS = ['aluguel', 'salarios', 'fornecedores', 'impostos', 'energia_agua', 'marketing', 'manutencao', 'outros']

export default function Financeiro() {
  const { error, success } = useToast()
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [f, setF] = useState<Finance | null>(null)
  const [exps, setExps] = useState<Expense[]>([])
  const [n, setN] = useState({ description: '', category: 'fornecedores', amount: '', paid: true, due_date: '' })
  const load = () => {
    crm.finance(month).then(setF).catch(e => error(e.message))
    const [y, m] = month.split('-').map(Number)
    crm.expenses(new Date(y, m - 1, 1), new Date(y, m, 1)).then(setExps).catch(() => {})
  }
  useEffect(() => { load() }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addExpense() {
    const amount = Number(n.amount.replace(',', '.'))
    if (!n.description.trim() || !amount) { error('Informe descrição e valor.'); return }
    try {
      await crm.createExpense({ description: n.description.trim(), category: n.category, amount, paid: n.paid, due_date: n.due_date ? `${n.due_date}T12:00:00` : undefined })
      success('Despesa lançada.'); setN({ ...n, description: '', amount: '', due_date: '' }); load()
    } catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }
  const maxDay = Math.max(1, ...(f?.by_day ?? []).map(d => d.total))

  return (
    <div>
      <PageHead title="Financeiro" actions={<Input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} className="!w-auto" />} />
      {f && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kpi label="Faturamento" value={brl(f.revenue)} sub={`${f.sales_count} vendas · ticket médio ${brl(f.avg_ticket)}`} tone="good" />
            <Kpi label="Despesas pagas" value={brl(f.expenses)} />
            <Kpi label="Resultado" value={brl(f.profit)} tone={f.profit >= 0 ? 'good' : 'bad'} />
            <Kpi label="A receber / a pagar" value={`${brl(f.receivable_open)}`} sub={`a pagar: ${brl(f.payable_open)}`} tone="warn" />
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <Card className="md:col-span-2">
              <h2 className="font-bold text-surface-900 dark:text-white mb-3">Faturamento por dia</h2>
              {f.by_day.length === 0 ? <Empty>Sem vendas no mês.</Empty> : (
                <div className="flex items-end gap-1 h-40">
                  {f.by_day.map(d => (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${d.day.slice(8, 10)}/${d.day.slice(5, 7)}: ${brl(d.total)}`}>
                      <div className="w-full rounded-t bg-primary-500" style={{ height: `${Math.max(3, (100 * d.total) / maxDay)}%` }} />
                      <span className="text-[9px] text-surface-400 mt-1">{d.day.slice(8, 10)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <h2 className="font-bold text-surface-900 dark:text-white mb-2">Por forma de pagamento</h2>
              {f.by_method.length === 0 ? <Empty>—</Empty> : f.by_method.map(m => (
                <p key={m.method} className="flex justify-between text-sm py-0.5"><span>{PAY[m.method] ?? m.method} · {m.count}</span><b className="tabular-nums">{brl(m.total)}</b></p>
              ))}
              <h2 className="font-bold text-surface-900 dark:text-white mt-4 mb-2">Por categoria</h2>
              {f.by_category.length === 0 ? <Empty>—</Empty> : f.by_category.map(c => (
                <p key={c.category} className="flex justify-between text-sm py-0.5"><span>{c.category}</span><b className="tabular-nums">{brl(c.total)}</b></p>
              ))}
            </Card>
          </div>
        </>
      )}
      <Card>
        <h2 className="font-bold text-surface-900 dark:text-white mb-3">Despesas</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end mb-4">
          <Field label="Descrição" className="col-span-2"><Input value={n.description} onChange={e => setN({ ...n, description: e.target.value })} /></Field>
          <Field label="Categoria"><Select value={n.category} onChange={e => setN({ ...n, category: e.target.value })}>{EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}</Select></Field>
          <Field label="Valor (R$)"><Input inputMode="decimal" value={n.amount} onChange={e => setN({ ...n, amount: e.target.value })} /></Field>
          <Field label="Situação"><Select value={n.paid ? 'paga' : 'aberta'} onChange={e => setN({ ...n, paid: e.target.value === 'paga' })}><option value="paga">Paga</option><option value="aberta">A pagar</option></Select></Field>
          <Btn onClick={addExpense}>Lançar</Btn>
        </div>
        {exps.length === 0 ? <Empty>Nenhuma despesa no mês.</Empty> : exps.map(e => (
          <div key={e.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-surface-50 dark:border-surface-700/50 last:border-0">
            <span className="flex-1">{e.description} <span className="text-surface-400">· {e.category}</span></span>
            <span className="text-surface-500 w-28">{e.paid_at ? `paga ${fmtDate(e.paid_at)}` : <span className="text-amber-600">a pagar</span>}</span>
            <b className="tabular-nums w-24 text-right">{brl(e.amount)}</b>
            {!e.paid_at && <button className="text-xs font-semibold text-primary-700" onClick={() => crm.payExpense(e.id).then(load)}>pagar</button>}
            <button className="text-xs text-red-500" onClick={() => confirm('Excluir despesa?') && crm.deleteExpense(e.id).then(load)}>excluir</button>
          </div>
        ))}
      </Card>
    </div>
  )
}
