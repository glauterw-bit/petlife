'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, History, Lock, LockOpen, Store } from 'lucide-react'
import { crm, type CashSession } from '@/lib/crmApi'
import { emitCrmChange, useCrmChange } from '@/components/crm/CrmShell'
import { Badge, Btn, Card, Field, Input, brl, fmtDateTime, fmtTime, parseMoney } from '@/components/crm/ui'
import { dur } from '@/components/crm/motion'
import { EmptyState, ErrorState, MoneyInput, Sheet, Skeleton, SkeletonRows, useAsync } from '@/components/crm/kit'
import { useToast } from '@/components/ui/ToastContext'
import { CloseCashSheet } from './CloseCashSheet'
import { CashReportDoc } from './CashReportDoc'
import { CASH_METHODS, PAY_ICON, PAY_SHORT, diffTone, errMsg } from './shared'

/** Caixa aberto agora (recarrega quando vendas ou o caixa mudam). */
export function useCashCurrent() {
  const st = useAsync(() => crm.cashCurrent(), [])
  useCrmChange(['cash', 'sale'], st.reload)
  return {
    session: st.data?.session ?? null,
    ready: st.data !== null,
    error: st.error,
    loading: st.loading,
    reload: st.reload,
    setSession: (s: CashSession | null) => st.setData({ session: s }),
  }
}
export type CashState = ReturnType<typeof useCashCurrent>

export function CashBar({ cash }: { cash: CashState }) {
  const { error, success } = useToast()
  const [opening, setOpening] = useState('')
  const [busy, setBusy] = useState(false)
  const [move, setMove] = useState<'sangria' | 'reforco' | null>(null)
  const [closing, setClosing] = useState(false)
  const [history, setHistory] = useState(false)
  const [report, setReport] = useState<CashSession | null>(null)
  const s = cash.session

  async function openCash() {
    const v = opening.trim() ? parseMoney(opening) : 0
    if (v == null || v < 0) { error('Informe o valor inicial em dinheiro (pode ser 0).'); return }
    setBusy(true)
    try {
      const ns = await crm.openCash({ opening_amount: v })
      cash.setSession(ns)
      setOpening('')
      success('Caixa aberto.')
      emitCrmChange('cash')
    } catch (e) {
      error(errMsg(e, 'Não foi possível abrir o caixa.'))
      cash.reload()
    } finally {
      setBusy(false)
    }
  }

  let body
  if (!cash.ready && cash.error) {
    body = <Card><ErrorState message={cash.error} onRetry={cash.reload} compact /></Card>
  } else if (!cash.ready) {
    body = (
      <Card>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-72 max-w-full" /></div>
        </div>
      </Card>
    )
  } else if (!s) {
    body = (
      <Card className="ring-1 ring-amber-300/60 dark:ring-amber-400/25">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="h-10 w-10 shrink-0 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 inline-flex items-center justify-center">
              <Store className="w-5 h-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-extrabold text-ink leading-tight">Caixa fechado</h2>
              <p className="text-sm text-muted mt-0.5">Abra o caixa para receber pagamentos. Vendas a receber (fiado) continuam liberadas.</p>
            </div>
          </div>
          <form className="flex flex-col sm:flex-row sm:items-end gap-2" onSubmit={e => { e.preventDefault(); openCash() }}>
            <Field label="Valor inicial em dinheiro" className="sm:w-52">
              <MoneyInput id="crm-cash-open-amount" value={opening} onChange={setOpening} placeholder="0,00" />
            </Field>
            <Btn type="submit" icon={LockOpen} loading={busy}>Abrir caixa</Btn>
            <Btn variant="ghost" icon={History} onClick={() => setHistory(true)}>Fechamentos</Btn>
          </form>
        </div>
      </Card>
    )
  } else {
    const paid = CASH_METHODS.filter(m => (s.totals_by_method?.[m] ?? 0) > 0)
    const totalPaid = CASH_METHODS.reduce((a, m) => a + (s.totals_by_method?.[m] ?? 0), 0)
    body = (
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0" aria-hidden>
              <span className="absolute inset-0 rounded-full bg-emerald-500 animate-pulse-soft" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                Caixa aberto desde {fmtTime(s.opened_at)}{s.opened_by_name ? ` por ${s.opened_by_name}` : ''}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {paid.length === 0 ? (
                  <span className="text-xs text-muted">Nenhuma venda paga ainda.</span>
                ) : paid.map(m => {
                  const Icon = PAY_ICON[m]
                  return (
                    <span key={m} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-panel-2 text-xs font-medium text-ink">
                      <Icon className="w-3.5 h-3.5 text-muted" strokeWidth={1.75} aria-hidden />
                      {PAY_SHORT[m]} <span className="tabular-nums font-semibold">{brl(s.totals_by_method?.[m] ?? 0)}</span>
                    </span>
                  )
                })}
                {paid.length > 0 && (
                  <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 text-xs font-semibold tabular-nums">
                    {s.sales_count} {s.sales_count === 1 ? 'venda' : 'vendas'} · {brl(totalPaid)}
                  </span>
                )}
                <span className="inline-flex items-center h-7 px-2.5 rounded-full ring-1 ring-line text-xs text-muted">
                  Na gaveta: <span className="ml-1 tabular-nums font-semibold text-ink">{brl(s.expected?.dinheiro ?? 0)}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn variant="outline" size="sm" icon={ArrowUpFromLine} onClick={() => setMove('sangria')}>Sangria</Btn>
            <Btn variant="outline" size="sm" icon={ArrowDownToLine} onClick={() => setMove('reforco')}>Reforço</Btn>
            <Btn variant="ghost" size="sm" icon={History} onClick={() => setHistory(true)}>Fechamentos</Btn>
            <Btn size="sm" icon={Lock} onClick={() => setClosing(true)}>Fechar caixa</Btn>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <section id="crm-cashbar" aria-label="Caixa do dia" className="scroll-mt-20 mb-4">
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={!cash.ready ? 'load' : s ? `open-${s.id}` : 'closed'}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: dur.base }}>
          {body}
        </m.div>
      </AnimatePresence>

      <MoveSheet kind={move} session={s} onClose={() => setMove(null)} onDone={ns => { cash.setSession(ns); setMove(null) }} />
      <CloseCashSheet open={closing} session={s} onClose={() => setClosing(false)}
        onClosed={closed => { setClosing(false); cash.setSession(null); setReport(closed) }} />
      <SessionsSheet open={history} onClose={() => setHistory(false)} onPick={x => setReport(x)} />
      <CashReportDoc session={report} onClose={() => setReport(null)} />
    </section>
  )
}

function MoveSheet({ kind, session, onClose, onDone }: {
  kind: 'sangria' | 'reforco' | null; session: CashSession | null; onClose: () => void; onDone: (s: CashSession) => void
}) {
  const { error, success } = useToast()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const lastKind = useRef<'sangria' | 'reforco'>('sangria')
  if (kind) lastKind.current = kind
  const k = kind ?? lastKind.current
  const drawer = session?.expected?.dinheiro ?? 0

  async function submit() {
    if (busy) return
    const v = parseMoney(amount)
    if (v == null || v <= 0) { error('Informe um valor maior que zero.'); return }
    setBusy(true)
    try {
      const ns = await crm.cashMove({ kind: k, amount: v, note: note.trim() || undefined })
      success(k === 'sangria' ? `Sangria de ${brl(v)} registrada.` : `Reforço de ${brl(v)} registrado.`)
      emitCrmChange('cash')
      setAmount(''); setNote('')
      onDone(ns)
    } catch (e) {
      error(errMsg(e, 'Não foi possível registrar.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={!!kind} onClose={onClose} onSubmit={submit}
      title={k === 'sangria' ? 'Sangria' : 'Reforço'}
      description={k === 'sangria' ? 'Retirada de dinheiro da gaveta.' : 'Entrada de dinheiro na gaveta (troco).'}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn loading={busy} onClick={submit}>{k === 'sangria' ? 'Registrar sangria' : 'Registrar reforço'}</Btn>
      </>}>
      <div className="space-y-4">
        <Field label="Valor" hint={`Dinheiro esperado na gaveta agora: ${brl(drawer)}`}>
          <MoneyInput value={amount} onChange={setAmount} placeholder="0,00" />
        </Field>
        <Field label="Motivo">
          <Input value={note} maxLength={200} onChange={e => setNote(e.target.value)}
            placeholder={k === 'sangria' ? 'Ex.: depósito no banco' : 'Ex.: troco do dia'} />
        </Field>
      </div>
    </Sheet>
  )
}

function SessionsSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (s: CashSession) => void }) {
  const { error } = useToast()
  const [tick, setTick] = useState(0)
  const st = useAsync(() => (open ? crm.cashSessions(30) : Promise.resolve(null)), [open, tick])
  const [loadingId, setLoadingId] = useState<number | null>(null)

  async function pick(id: number) {
    setLoadingId(id)
    try { onPick(await crm.cashSession(id)) } catch (e) { error(errMsg(e, 'Não foi possível abrir o fechamento.')) } finally { setLoadingId(null) }
  }

  const list = st.data
  return (
    <Sheet open={open} onClose={onClose} title="Fechamentos" description="Os últimos 30 caixas da clínica." initialFocus={false}>
      {!list && st.error ? <ErrorState message={st.error} onRetry={() => setTick(t => t + 1)} compact />
        : !list ? <SkeletonRows rows={5} />
        : list.length === 0 ? <EmptyState icon={History} title="Nenhum caixa ainda." hint="Os fechamentos aparecem aqui." compact />
        : (
          <ul className="divide-y divide-line -mx-1">
            {list.map(x => (
              <li key={x.id}>
                <button type="button" onClick={() => pick(x.id)} disabled={loadingId === x.id}
                  className="w-full flex items-center gap-3 min-h-14 px-1 py-2 text-left rounded-lg hover:bg-panel-2 focus-visible:bg-panel-2 outline-none disabled:opacity-60">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink flex items-center gap-2">
                      <span className="tabular-nums">{fmtDateTime(x.opened_at)}</span>
                      {x.status === 'aberto' ? <Badge tone="good">Aberto</Badge> : null}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {[x.opened_by_name, `${x.sales_count} ${x.sales_count === 1 ? 'venda' : 'vendas'}`, x.closed_at ? `fechado às ${fmtTime(x.closed_at)}` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {x.difference_total != null && (
                    <span className={`text-sm font-semibold tabular-nums ${diffTone(x.difference_total)}`}>{brl(x.difference_total)}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted shrink-0" strokeWidth={1.75} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
    </Sheet>
  )
}
