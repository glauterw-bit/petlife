'use client'

import { useState } from 'react'
import { Ban, HandCoins, MessageCircle, Printer, Receipt, Wallet } from 'lucide-react'
import { crm, type Sale } from '@/lib/crmApi'
import { can, emitCrmChange, useCrm, useCrmChange } from '@/components/crm/CrmShell'
import { Badge, Btn, Card, brl, dayRange, fmtDate, fmtDay, fmtPhone, fmtTime, waLink, ymd } from '@/components/crm/ui'
import { DataList, EmptyState, Segmented, Sheet, Tabs, useAsync, useConfirm, type Column } from '@/components/crm/kit'
import { useToast } from '@/components/ui/ToastContext'
import { CASH_METHODS, PAY_ICON, PAY_SHORT, errMsg, isCashClosed, scrollToCashBar } from './shared'

const STATUS: Record<string, { label: string; tone: 'good' | 'warn' | 'default' }> = {
  paga: { label: 'Paga', tone: 'good' }, aberta: { label: 'A receber', tone: 'warn' }, cancelada: { label: 'Cancelada', tone: 'default' },
}
const isOverdue = (s: Sale) => !!s.due_date && s.due_date.slice(0, 10) < ymd(new Date())

const iconBtn = 'h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-panel-2 transition-colors'

/** Vendas de hoje e contas a receber, abaixo do PDV. */
export function SalesPanel({ hasCash, onReceipt }: { hasCash: boolean; onReceipt: (id: number) => void }) {
  const { me } = useCrm()
  const admin = can(me.user.role)
  const { error, success } = useToast()
  const { confirm } = useConfirm()
  const [tab, setTab] = useState<'today' | 'open'>('today')
  const [paying, setPaying] = useState<Sale | null>(null)

  const today = useAsync(() => { const [a, b] = dayRange(new Date()); return crm.sales(a, b) }, [])
  const open = useAsync(() => crm.receivables(), [])
  useCrmChange(['sale', 'cash'], () => { today.reload(); open.reload() })

  async function cancel(s: Sale) {
    const ok = await confirm({
      title: `Cancelar a venda nº ${s.id} de ${brl(s.total)}?`, message: 'Os produtos voltam ao estoque.',
      confirmLabel: 'Cancelar venda', cancelLabel: 'Voltar', tone: 'danger',
    })
    if (!ok) return
    try { await crm.cancelSale(s.id); success('Venda cancelada.'); emitCrmChange('sale') } catch (e) { error(errMsg(e)) }
  }

  const statusBadge = (s: Sale) => <Badge tone={STATUS[s.status]?.tone ?? 'default'}>{STATUS[s.status]?.label ?? s.status}</Badge>
  const who = (s: Sale) => [s.client_name ?? 'Consumidor', s.patient_name].filter(Boolean).join(' · ')

  const todayCols: Column<Sale>[] = [
    { key: 'h', header: 'Hora', className: 'w-16', cell: s => <span className="tabular-nums text-muted">{fmtTime(s.created_at)}</span> },
    { key: 'n', header: 'Nº', className: 'w-14', hideBelow: 'lg', cell: s => <span className="tabular-nums text-muted">{s.id}</span> },
    { key: 'c', header: 'Cliente', cell: s => <span className={`font-medium ${s.status === 'cancelada' ? 'line-through text-muted' : ''}`}>{who(s)}</span> },
    { key: 'u', header: 'Atendente', hideBelow: 'lg', cell: s => <span className="text-muted">{s.user_name ?? '—'}</span> },
    { key: 'f', header: 'Forma', cell: s => <span className="text-muted">{s.status === 'aberta' ? 'Fiado' : PAY_SHORT[s.payment_method ?? ''] ?? '—'}</span> },
    { key: 't', header: 'Total', align: 'right', cell: s => <span className={`font-semibold ${s.status === 'cancelada' ? 'line-through text-muted' : ''}`}>{brl(s.total)}</span> },
    { key: 's', header: 'Situação', cell: statusBadge },
  ]
  const openCols: Column<Sale>[] = [
    { key: 'c', header: 'Cliente', cell: s => (
      <div className="min-w-0">
        <p className="font-medium truncate">{who(s)}</p>
        {s.client_phone && <p className="text-xs text-muted">{fmtPhone(s.client_phone)}</p>}
      </div>
    ) },
    { key: 'l', header: 'Lançada', hideBelow: 'lg', cell: s => <span className="tabular-nums text-muted">{fmtDate(s.created_at)}</span> },
    { key: 'v', header: 'Vencimento', cell: s => (
      <span className="inline-flex items-center gap-2 tabular-nums">
        {s.due_date ? fmtDay(s.due_date) : <span className="text-muted">Sem data</span>}
        {isOverdue(s) && <Badge tone="bad">Vencida</Badge>}
      </span>
    ) },
    { key: 't', header: 'Total', align: 'right', cell: s => <span className="font-semibold text-amber-700 dark:text-amber-300">{brl(s.total)}</span> },
  ]

  const charge = (s: Sale) => {
    const first = (s.client_name || '').split(' ')[0]
    return waLink(s.client_phone,
      `Olá${first ? `, ${first}` : ''}! Tudo bem? Aqui é da ${me.clinic.name}. Passando para lembrar do valor de ${brl(s.total)} em aberto` +
      `${s.due_date ? `, com vencimento em ${fmtDay(s.due_date)}` : ''}. Se já acertou, pode desconsiderar. Obrigado!`)
  }

  const paidToday = (today.data ?? []).filter(s => s.status === 'paga')
  const openTotal = (open.data ?? []).reduce((a, s) => a + s.total, 0)

  return (
    <Card className="mt-4">
      <Tabs id="caixa-vendas" value={tab} onChange={setTab}
        tabs={[
          { value: 'today', label: 'Vendas de hoje', count: today.data ? today.data.length : undefined },
          { value: 'open', label: 'A receber', count: open.data ? open.data.length : undefined },
        ]} />
      <div className="pt-3">
        {tab === 'today' ? (
          <>
            {paidToday.length > 0 && (
              <p className="text-xs text-muted mb-2">Recebido hoje: <span className="font-semibold text-ink tabular-nums">{brl(paidToday.reduce((a, s) => a + s.total, 0))}</span> em {paidToday.length} {paidToday.length === 1 ? 'venda' : 'vendas'}</p>
            )}
            <DataList ariaLabel="Vendas de hoje" rows={today.data} loading={today.loading} error={today.error} onRetry={today.reload}
              columns={todayCols} rowKey={s => s.id} onRowClick={s => onReceipt(s.id)}
              empty={<EmptyState icon={Receipt} title="Nenhuma venda hoje." hint="As vendas registradas no caixa aparecem aqui." compact />}
              rowActions={s => (
                <>
                  <button type="button" className={iconBtn} onClick={() => onReceipt(s.id)} aria-label={`Recibo da venda ${s.id}`} title="Recibo">
                    <Printer className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  {admin && s.status !== 'cancelada' && (
                    <button type="button" className={`${iconBtn} hover:!text-red-600 dark:hover:!text-red-400`} onClick={() => cancel(s)} aria-label={`Cancelar venda ${s.id}`} title="Cancelar venda">
                      <Ban className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  )}
                </>
              )}
              renderMobile={s => (
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold text-ink truncate ${s.status === 'cancelada' ? 'line-through text-muted' : ''}`}>{who(s)}</p>
                    <p className="text-sm font-semibold tabular-nums text-ink">{brl(s.total)}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted tabular-nums">{fmtTime(s.created_at)} · {s.status === 'aberta' ? 'Fiado' : PAY_SHORT[s.payment_method ?? ''] ?? '—'}</span>
                    {s.status !== 'paga' && statusBadge(s)}
                  </div>
                </div>
              )} />
          </>
        ) : (
          <>
            {(open.data?.length ?? 0) > 0 && (
              <p className="text-xs text-muted mb-2">Total em aberto: <span className="font-semibold text-ink tabular-nums">{brl(openTotal)}</span></p>
            )}
            <DataList ariaLabel="Contas a receber" rows={open.data} loading={open.loading} error={open.error} onRetry={open.reload}
              columns={openCols} rowKey={s => s.id}
              empty={<EmptyState icon={Wallet} title="Nada a receber." hint="Vendas lançadas como fiado aparecem aqui." compact />}
              rowActions={s => {
                const wa = charge(s)
                return (
                  <>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer" className={iconBtn} aria-label={`Cobrar ${s.client_name ?? ''} pelo WhatsApp`} title="Cobrar pelo WhatsApp">
                        <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                      </a>
                    )}
                    <Btn size="sm" variant="soft" icon={HandCoins} onClick={() => setPaying(s)}>Receber</Btn>
                  </>
                )
              }}
              renderMobile={s => (
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink truncate">{who(s)}</p>
                    <p className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">{brl(s.total)}</p>
                  </div>
                  <p className="text-xs text-muted mt-0.5 flex items-center gap-2">
                    <span className="tabular-nums">{s.due_date ? `Vence ${fmtDay(s.due_date)}` : 'Sem vencimento'}</span>
                    {isOverdue(s) && <Badge tone="bad">Vencida</Badge>}
                  </p>
                </div>
              )} />
          </>
        )}
      </div>
      <ReceiveSheet sale={paying} hasCash={hasCash} admin={admin} onClose={() => setPaying(null)} />
    </Card>
  )
}

function ReceiveSheet({ sale, hasCash, admin, onClose }: { sale: Sale | null; hasCash: boolean; admin: boolean; onClose: () => void }) {
  const { error, success, warning } = useToast()
  const [method, setMethod] = useState<string>('pix')
  const [busy, setBusy] = useState(false)

  async function pay(withoutCash = false) {
    if (!sale || busy) return
    setBusy(true)
    try {
      await crm.paySale(sale.id, method, withoutCash)
      success(`Recebido: ${brl(sale.total)} em ${PAY_SHORT[method]}.`)
      emitCrmChange('sale')
      onClose()
    } catch (e) {
      if (isCashClosed(e)) { warning('Abra o caixa para receber'); onClose(); scrollToCashBar() } else error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={!!sale} onClose={onClose} onSubmit={() => pay(false)} title="Receber conta"
      description={sale ? `${sale.client_name ?? 'Consumidor'} · ${brl(sale.total)}` : undefined}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn loading={busy} disabled={!hasCash} onClick={() => pay(false)}>Receber {sale ? brl(sale.total) : ''}</Btn>
      </>}>
      <div className="space-y-4">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-2">Forma de pagamento</p>
          <Segmented id="receber" ariaLabel="Forma de pagamento" value={method} onChange={setMethod}
            options={CASH_METHODS.map(m => ({ value: m, label: PAY_SHORT[m], icon: PAY_ICON[m] }))} />
        </div>
        {!hasCash && (
          <div className="rounded-xl bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 px-3 py-2.5 text-sm">
            Abra o caixa para receber.
            {admin && (
              <button type="button" onClick={() => pay(true)} disabled={busy} className="block mt-1 text-xs font-semibold underline underline-offset-2">
                Receber sem caixa (administrador)
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
