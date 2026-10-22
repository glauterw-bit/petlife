'use client'

import { useEffect, useState } from 'react'
import { crm, type Expense } from '@/lib/crmApi'
import { Btn, Field, Input, Select, catLabel, moneyInput, parseMoney, ymd } from '@/components/crm/ui'
import { MoneyInput, Sheet, Switch } from '@/components/crm/kit'
import { useToast } from '@/components/ui/ToastContext'

export const EXPENSE_CATS = ['aluguel', 'salarios', 'fornecedores', 'impostos', 'energia_agua', 'marketing', 'manutencao', 'outros']
const REPEAT = [
  { n: 1, label: 'Não repetir' },
  { n: 2, label: '2 meses' },
  { n: 3, label: '3 meses' },
  { n: 6, label: '6 meses' },
  { n: 12, label: '12 meses' },
]

/** Nova despesa ou edição de uma existente. */
export function ExpenseSheet({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void; initial?: Expense | null; onSaved: () => void
}) {
  const { error, success } = useToast()
  const editing = !!initial
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('fornecedores')
  const [amount, setAmount] = useState('')
  const [paid, setPaid] = useState(true)
  const [due, setDue] = useState('')
  const [repeat, setRepeat] = useState(1)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrs({})
    if (initial) {
      setDescription(initial.description)
      setCategory(initial.category || 'outros')
      setAmount(moneyInput(initial.amount))
      setPaid(!!initial.paid_at)
      setDue(initial.due_date ? initial.due_date.slice(0, 10) : '')
      setRepeat(1)
    } else {
      setDescription(''); setCategory('fornecedores'); setAmount(''); setPaid(true); setRepeat(1)
      setDue(ymd(new Date()))
    }
  }, [open, initial])

  async function save() {
    if (busy) return
    const e: Record<string, string> = {}
    const value = parseMoney(amount)
    if (!description.trim()) e.description = 'Informe a descrição.'
    if (value == null || value <= 0) e.amount = 'Informe um valor maior que zero.'
    if (!paid && repeat > 1 && !due) e.due = 'Informe o vencimento para repetir.'
    setErrs(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      if (editing && initial) {
        await crm.updateExpense(initial.id, {
          description: description.trim(), category, amount: value as number,
          ...(initial.paid_at ? {} : { due_date: due ? `${due}T12:00:00` : null }),
        })
        success('Despesa atualizada.')
      } else {
        await crm.createExpense({
          description: description.trim(), category, amount: value as number, paid,
          due_date: !paid && due ? `${due}T12:00:00` : undefined,
          repeat_months: !paid && due && repeat > 1 ? repeat - 1 : undefined,
        })
        success(!paid && due && repeat > 1 ? `Despesa lançada para ${repeat} meses.` : 'Despesa lançada.')
      }
      onSaved()
      onClose()
    } catch (err) {
      error(err instanceof Error ? err.message : 'Não foi possível salvar a despesa.')
    } finally {
      setBusy(false)
    }
  }

  const showDue = editing ? !initial?.paid_at : !paid

  return (
    <Sheet open={open} onClose={onClose} onSubmit={save}
      title={editing ? 'Editar despesa' : 'Nova despesa'}
      description={editing ? undefined : 'Contas pagas entram no resultado do mês. As a pagar aparecem no fluxo de caixa.'}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} loading={busy}>Salvar</Btn></>}>
      <div className="space-y-4">
        <Field label="Descrição" error={errs.description}>
          <Input value={description} onChange={ev => setDescription(ev.target.value)} placeholder="Ex.: aluguel da sala" maxLength={200} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Categoria">
            <Select value={category} onChange={ev => setCategory(ev.target.value)}>
              {EXPENSE_CATS.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
            </Select>
          </Field>
          <Field label="Valor" error={errs.amount}>
            <MoneyInput value={amount} onChange={setAmount} placeholder="0,00" aria-label="Valor" />
          </Field>
        </div>
        {!editing && (
          <Switch checked={paid} onChange={setPaid} label="Já está paga" hint="Desligue para lançar uma conta a pagar com vencimento." />
        )}
        {showDue && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Vencimento" error={errs.due}>
              <Input type="date" value={due} onChange={ev => setDue(ev.target.value)} />
            </Field>
            {!editing && (
              <Field label="Repetir por" hint={repeat > 1 ? 'Cria uma conta por mês, com o mesmo valor.' : undefined}>
                <Select value={repeat} onChange={ev => setRepeat(Number(ev.target.value))}>
                  {REPEAT.map(r => <option key={r.n} value={r.n}>{r.label}</option>)}
                </Select>
              </Field>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
