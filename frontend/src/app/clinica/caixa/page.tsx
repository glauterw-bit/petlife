'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { crm, type Client, type Item, type Sale, type Patient } from '@/lib/crmApi'
import { useCrm, can } from '@/components/crm/CrmShell'
import { Card, PageHead, Btn, Field, Input, Select, Empty, Badge, brl, fmtTime, fmtDate, PAY } from '@/components/crm/ui'
import { ClientPicker } from '@/components/crm/forms'
import { useToast } from '@/components/ui/ToastContext'

interface Line { key: string; item_id?: number; description: string; qty: number; unit_price: number; kind?: string }

function Caixa() {
  const params = useSearchParams()
  const { me } = useCrm()
  const { error, success } = useToast()
  const [items, setItems] = useState<Item[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientId, setPatientId] = useState('')
  const [apptId, setApptId] = useState<number | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [q, setQ] = useState('')
  const [discount, setDiscount] = useState('')
  const [method, setMethod] = useState('pix')
  const [busy, setBusy] = useState(false)
  const [today, setToday] = useState<Sale[]>([])
  const [open, setOpen] = useState<Sale[]>([])

  const loadSales = () => {
    const s = new Date(); s.setHours(0, 0, 0, 0)
    const e = new Date(s); e.setDate(e.getDate() + 1)
    crm.sales(s, e).then(setToday).catch(() => {})
    const s2 = new Date(); s2.setFullYear(s2.getFullYear() - 1)
    crm.sales(s2, e, 'aberta').then(setOpen).catch(() => {})
  }
  useEffect(() => { crm.items().then(setItems).catch(() => {}); loadSales() }, [])

  // vindo da agenda (?appointment=) ou da ficha do cliente (?client=)
  useEffect(() => {
    const aid = Number(params.get('appointment') || 0)
    const cid = Number(params.get('client') || 0)
    if (cid) crm.client(cid).then(c => setClient(c)).catch(() => {})
    if (aid) {
      const s = new Date(); s.setMonth(s.getMonth() - 1)
      const e = new Date(); e.setMonth(e.getMonth() + 1)
      crm.appointments(s, e).then(list => {
        const a = list.find(x => x.id === aid)
        if (!a) return
        setApptId(a.id)
        crm.client(a.client_id).then(c => { setClient(c); if (a.patient_id) setPatientId(String(a.patient_id)) })
        crm.items().then(all => {
          const it = all.find(i => i.id === a.item_id)
          if (it) setLines([{ key: `i${it.id}`, item_id: it.id, description: it.name, qty: 1, unit_price: a.price ?? it.price, kind: it.kind }])
        })
      }).catch(() => {})
    }
  }, [params])
  useEffect(() => {
    if (!client) { setPatients([]); return }
    crm.client(client.id).then(c => { setPatients(c.patients); if (c.patients.length === 1 && !patientId) setPatientId(String(c.patients[0].id)) }).catch(() => {})
  }, [client]) // eslint-disable-line react-hooks/exhaustive-deps

  const found = useMemo(() => items.filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.sku || '').toLowerCase().includes(q.toLowerCase())).slice(0, 12), [items, q])
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const disc = Math.min(subtotal, Number((discount || '0').replace(',', '.')) || 0)
  const total = subtotal - disc

  const add = (i: Item) => setLines(ls => {
    const ex = ls.find(l => l.item_id === i.id)
    return ex ? ls.map(l => (l === ex ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { key: `i${i.id}`, item_id: i.id, description: i.name, qty: 1, unit_price: i.price, kind: i.kind }]
  })
  const upd = (key: string, patch: Partial<Line>) => setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))

  async function finish() {
    if (!lines.length) { error('Adicione pelo menos um item.'); return }
    if (method === 'fiado' && !client) { error('Para vender fiado, escolha o cliente.'); return }
    setBusy(true)
    try {
      const s = await crm.createSale({
        client_id: client?.id ?? null, patient_id: patientId ? Number(patientId) : null, appointment_id: apptId,
        items: lines.map(l => ({ item_id: l.item_id, description: l.description, qty: l.qty, unit_price: l.unit_price })),
        discount: disc, payment_method: method, status: method === 'fiado' ? 'aberta' : 'paga',
      })
      success(`Venda #${s.id} registrada: ${brl(s.total)}`)
      setLines([]); setDiscount(''); setApptId(null); setClient(null); setPatientId('')
      loadSales()
      crm.items().then(setItems).catch(() => {})
    } catch (e) { error(e instanceof Error ? e.message : 'Não consegui registrar a venda.') } finally { setBusy(false) }
  }
  async function receive(s: Sale, m: string) {
    try { await crm.paySale(s.id, m); success('Recebido.'); loadSales() } catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }
  async function cancel(s: Sale) {
    if (!confirm(`Cancelar a venda #${s.id} de ${brl(s.total)}? O estoque volta.`)) return
    try { await crm.cancelSale(s.id); success('Venda cancelada.'); loadSales() } catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }
  const paidToday = today.filter(s => s.status === 'paga').reduce((a, s) => a + s.total, 0)

  return (
    <div>
      <PageHead title="Caixa e vendas" sub={`Recebido hoje: ${brl(paidToday)} em ${today.filter(s => s.status === 'paga').length} venda(s)`} />
      <div className="grid lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <h2 className="font-bold text-surface-900 dark:text-white mb-3">Nova venda {apptId ? <Badge cls="bg-blue-100 text-blue-700 ml-1">do agendamento #{apptId}</Badge> : null}</h2>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <Field label="Cliente (opcional)"><ClientPicker value={client} onChange={c => { setClient(c); setPatientId('') }} /></Field>
            {client && (
              <Field label="Pet">
                <Select value={patientId} onChange={e => setPatientId(e.target.value)}>
                  <option value="">—</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
            )}
          </div>
          <Field label="Adicionar serviço ou produto"><Input placeholder="Buscar no catálogo…" value={q} onChange={e => setQ(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-1.5 mt-2 mb-4">
            {found.map(i => (
              <button key={i.id} onClick={() => add(i)} className="text-xs px-2.5 py-1.5 rounded-lg border border-surface-200 dark:border-surface-600 hover:border-primary-400 bg-white dark:bg-surface-800">
                {i.name} · <b>{brl(i.price)}</b>{i.kind === 'product' ? <span className={i.low_stock ? 'text-red-600' : 'text-surface-400'}> · {i.stock_qty ?? 0}</span> : null}
              </button>
            ))}
            <button onClick={() => setLines(ls => [...ls, { key: `x${Date.now()}`, description: 'Item avulso', qty: 1, unit_price: 0 }])}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-surface-300 text-surface-500">+ Item avulso</button>
          </div>
          {lines.length === 0 ? <Empty>Nenhum item na venda.</Empty> : (
            <div className="space-y-2">
              {lines.map(l => (
                <div key={l.key} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-6" value={l.description} onChange={e => upd(l.key, { description: e.target.value })} />
                  <Input className="col-span-2" inputMode="decimal" value={l.qty} onChange={e => upd(l.key, { qty: Math.max(0.01, Number(e.target.value.replace(',', '.')) || 1) })} />
                  <Input className="col-span-3" inputMode="decimal" value={l.unit_price} onChange={e => upd(l.key, { unit_price: Number(e.target.value.replace(',', '.')) || 0 })} />
                  <button className="col-span-1 text-red-500 text-lg" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} aria-label="Remover">×</button>
                </div>
              ))}
              <p className="text-[11px] text-surface-400">Descrição · quantidade · preço unitário</p>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-2 h-fit">
          <h2 className="font-bold text-surface-900 dark:text-white mb-3">Pagamento</h2>
          <div className="space-y-1 text-sm mb-3">
            <p className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{brl(subtotal)}</span></p>
            <div className="flex justify-between items-center gap-2"><span>Desconto (R$)</span><Input className="!w-28 text-right" inputMode="decimal" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
            <p className="flex justify-between text-lg font-bold pt-1"><span>Total</span><span className="tabular-nums">{brl(total)}</span></p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {Object.entries(PAY).map(([k, v]) => (
              <button key={k} onClick={() => setMethod(k)} className={`text-xs py-2 rounded-lg font-semibold border ${method === k ? 'bg-primary-500 text-white border-primary-500' : 'border-surface-200 dark:border-surface-600 text-surface-700 dark:text-surface-200'}`}>{v.split(' ')[0]}</button>
            ))}
          </div>
          <Btn className="w-full !py-3" onClick={finish} disabled={busy || !lines.length}>{busy ? 'Registrando…' : method === 'fiado' ? `Lançar a receber · ${brl(total)}` : `Receber ${brl(total)}`}</Btn>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Card>
          <h2 className="font-bold text-surface-900 dark:text-white mb-2">Vendas de hoje</h2>
          {today.length === 0 ? <Empty>Nenhuma venda hoje.</Empty> : today.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-surface-50 dark:border-surface-700/50 last:border-0">
              <span className="text-surface-500 w-12 tabular-nums">{fmtTime(s.created_at)}</span>
              <span className="flex-1 truncate">#{s.id} · {s.client_name ?? 'Balcão'} · {PAY[s.payment_method ?? ''] ?? '—'}</span>
              <span className={`tabular-nums font-semibold ${s.status === 'cancelada' ? 'line-through text-surface-400' : ''}`}>{brl(s.total)}</span>
              {can(me.user.role) && s.status !== 'cancelada' && <button className="text-xs text-red-500" onClick={() => cancel(s)}>cancelar</button>}
            </div>
          ))}
        </Card>
        <Card>
          <h2 className="font-bold text-surface-900 dark:text-white mb-2">A receber (fiado)</h2>
          {open.length === 0 ? <Empty>Nada em aberto.</Empty> : open.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-surface-50 dark:border-surface-700/50 last:border-0">
              <span className="flex-1 truncate">{s.client_name ?? '—'} · {fmtDate(s.created_at)}</span>
              <span className="tabular-nums font-semibold text-red-600">{brl(s.total)}</span>
              <Select className="!w-auto !py-1 text-xs" value="" onChange={e => e.target.value && receive(s, e.target.value)}>
                <option value="">Receber…</option>{Object.entries(PAY).filter(([k]) => k !== 'fiado').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

export default function CaixaPage() {
  return <Suspense fallback={null}><Caixa /></Suspense>
}
