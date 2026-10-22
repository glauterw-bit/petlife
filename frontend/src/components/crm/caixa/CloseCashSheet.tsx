'use client'

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { crm, type CashSession, type PayMethod } from '@/lib/crmApi'
import { emitCrmChange } from '@/components/crm/CrmShell'
import { Btn, Field, TextArea, brl, moneyInput, parseMoney } from '@/components/crm/ui'
import { Sheet, MoneyInput, useConfirm } from '@/components/crm/kit'
import { useToast } from '@/components/ui/ToastContext'
import { CASH_METHODS, PAY_ICON, PAY_SHORT, diffLabel, diffTone, errMsg } from './shared'

/** Fechamento com conferência: esperado × contado, diferença ao vivo. */
export function CloseCashSheet({ open, session, onClose, onClosed }: {
  open: boolean; session: CashSession | null; onClose: () => void; onClosed: (s: CashSession) => void
}) {
  const { error, success } = useToast()
  const { confirm } = useConfirm()
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!open || !session) return
    const init: Record<string, string> = {}
    for (const m of CASH_METHODS) init[m] = m === 'dinheiro' ? '' : moneyInput(session.expected?.[m] ?? 0)
    setCounted(init)
    setNotes('')
    setTried(false)
  }, [open, session?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = CASH_METHODS.map(m => {
    const expected = session?.expected?.[m] ?? 0
    const raw = counted[m] ?? ''
    const val = parseMoney(raw)
    return { m, expected, raw, val, diff: val == null ? null : Math.round((val - expected) * 100) / 100 }
  })
  const missing = rows.filter(r => r.val == null || r.val < 0)
  const totalDiff = Math.round(rows.reduce((a, r) => a + (r.diff ?? 0), 0) * 100) / 100

  async function submit() {
    if (!session || busy) return
    setTried(true)
    if (missing.length) {
      error(missing[0].m === 'dinheiro' ? 'Conte o dinheiro da gaveta e informe o valor.' : `Informe o valor contado em ${PAY_SHORT[missing[0].m]}.`)
      return
    }
    if (Math.abs(totalDiff) >= 0.005) {
      const ok = await confirm({
        title: totalDiff < 0 ? `Fechar com falta de ${brl(-totalDiff)}?` : `Fechar com sobra de ${brl(totalDiff)}?`,
        message: 'A diferença fica registrada no relatório de fechamento.',
        confirmLabel: 'Fechar caixa',
        tone: totalDiff < 0 ? 'danger' : 'primary',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const c: Partial<Record<PayMethod, number>> = {}
      for (const r of rows) c[r.m] = r.val ?? 0
      const s = await crm.closeCash({ counted: c, notes: notes.trim() || undefined })
      success('Caixa fechado.')
      emitCrmChange('cash')
      onClosed(s)
    } catch (e) {
      error(errMsg(e, 'Não foi possível fechar o caixa.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Fechar caixa" size="lg" onSubmit={submit}
      description="Conte o que entrou em cada forma de pagamento e confira com o esperado."
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn icon={Lock} loading={busy} onClick={submit}>Fechar caixa</Btn>
      </>}>
      {session && (
        <div className="space-y-4">
          <div className="hidden sm:grid grid-cols-[1fr_120px_150px_120px] gap-3 px-1 text-2xs font-semibold uppercase tracking-wider text-muted">
            <span>Forma</span><span className="text-right">Esperado</span><span>Contado</span><span className="text-right">Diferença</span>
          </div>
          <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
            {rows.map(r => {
              const Icon = PAY_ICON[r.m]
              const bad = tried && (r.val == null || r.val < 0)
              return (
                <li key={r.m} className="grid grid-cols-2 sm:grid-cols-[1fr_120px_150px_120px] items-center gap-x-3 gap-y-2 px-3 py-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Icon className="w-4 h-4 text-muted" strokeWidth={1.75} aria-hidden />
                    {PAY_SHORT[r.m]}
                  </span>
                  <span className="text-right text-sm tabular-nums text-muted">
                    <span className="sm:hidden text-2xs uppercase tracking-wider mr-1">Esperado</span>{brl(r.expected)}
                  </span>
                  <div className="col-span-1">
                    <MoneyInput value={r.raw} onChange={v => setCounted(c => ({ ...c, [r.m]: v }))}
                      aria-label={`Contado em ${PAY_SHORT[r.m]}`} placeholder={r.m === 'dinheiro' ? 'Contar' : '0,00'}
                      aria-invalid={bad || undefined} className={bad ? '!border-red-400' : ''} />
                  </div>
                  <span className={`text-right text-sm font-semibold tabular-nums ${r.diff == null ? 'text-muted' : diffTone(r.diff)}`}>
                    {r.diff == null ? '—' : <>{brl(r.diff)}<span className="block text-2xs font-medium">{diffLabel(r.diff)}</span></>}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="flex items-center justify-between gap-3 rounded-xl bg-panel-2 px-4 py-3">
            <span className="text-sm font-semibold text-ink">Diferença total</span>
            <span className={`text-lg font-bold tabular-nums ${missing.length ? 'text-muted' : diffTone(totalDiff)}`}>
              {missing.length ? '—' : `${brl(totalDiff)} · ${diffLabel(totalDiff)}`}
            </span>
          </div>
          <p className="text-xs text-muted">
            Dinheiro esperado: {brl(session.opening_amount)} de abertura + vendas em dinheiro + reforços ({brl(session.reforcos)}) − sangrias ({brl(session.sangrias)}).
          </p>

          <Field label="Observação">
            <TextArea rows={2} maxLength={300} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: troco separado para amanhã" />
          </Field>
        </div>
      )}
    </Sheet>
  )
}
