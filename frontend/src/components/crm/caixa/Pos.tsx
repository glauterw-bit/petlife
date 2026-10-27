'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { CalendarCheck, ChevronRight, Minus, MoreHorizontal, Package, PenLine, Plus, Printer, ShoppingCart, Trash2, X } from 'lucide-react'
import { crm, type Appt, type Client, type Item, type Member, type Patient, type Sale } from '@/lib/crmApi'
import { can, emitCrmChange, useCrm } from '@/components/crm/CrmShell'
import { APPT_TYPE, Btn, Card, Field, Input, Select, brl, catLabel, fmtTime, moneyInput, parseDecimal, parseMoney, ymd } from '@/components/crm/ui'
import { ClientPicker } from '@/components/crm/forms'
import { AnimatedNumber, CheckBurst, dur, pressable } from '@/components/crm/motion'
import {
  Chip, DecimalInput, DropdownMenu, EmptyState, ErrorState, MoneyInput, SearchInput, Segmented, Sheet, Skeleton, useAsync, useMediaQuery,
} from '@/components/crm/kit'
import { useToast } from '@/components/ui/ToastContext'
import type { CashState } from './CashBar'
import { PAY_ICON, PAY_SHORT, errMsg, isCashClosed, qtyText, scrollToCashBar } from './shared'

interface Line { key: string; item_id?: number; kind: 'service' | 'product' | 'custom'; description: string; qty: string; price: string; staff: number | null; unit?: string | null }
type Method = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'boleto' | 'fiado'
type KindFilter = 'service' | 'product' | 'all'

const BASE_METHODS: Method[] = ['pix', 'dinheiro', 'debito', 'credito', 'fiado']
let seq = 0
const newKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** PDV: catálogo à esquerda, carrinho à direita (no celular, carrinho numa gaveta). */
export function Pos({ cash, appointmentId, clientId, onReceipt }: {
  cash: CashState; appointmentId: number | null; clientId: number | null; onReceipt: (id: number, sale?: Sale) => void
}) {
  const { me } = useCrm()
  const admin = can(me.user.role)
  const { error, success, warning } = useToast()
  const wide = useMediaQuery('(min-width: 1024px)')

  const items = useAsync(() => crm.items(), [])
  const team = useAsync(() => crm.team(), [])

  // filtros do catálogo
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [kind, setKind] = useState<KindFilter>('all')

  // carrinho
  const [lines, setLines] = useState<Line[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [pets, setPets] = useState<Patient[] | null>(null)
  const [patientId, setPatientId] = useState<number | null>(null)
  const [appt, setAppt] = useState<Appt | null>(null)
  const [discount, setDiscount] = useState('')
  const [method, setMethod] = useState<Method>('pix')
  const [received, setReceived] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [burst, setBurst] = useState(false)
  const [last, setLast] = useState<Sale | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [focusKey, setFocusKey] = useState<string | null>(null)

  // pets do cliente escolhido
  const keepPet = useRef<number | null>(null)
  useEffect(() => {
    if (!client) { setPets(null); setPatientId(null); return }
    let alive = true
    setPets(null)
    crm.client(client.id).then(c => {
      if (!alive) return
      const list = c.patients.filter(p => !p.deceased)
      setPets(list)
      const want = keepPet.current
      keepPet.current = null
      setPatientId(want && list.some(p => p.id === want) ? want : list.length === 1 ? list[0].id : null)
    }).catch(() => { if (alive) setPets([]) })
    return () => { alive = false }
  }, [client?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // vindo da ficha do cliente
  useEffect(() => {
    if (!clientId || appointmentId) return
    crm.client(clientId).then(c => setClient(c)).catch(e => error(errMsg(e, 'Cliente não encontrado.')))
  }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  // vindo da agenda: cliente, pet e serviço do atendimento
  useEffect(() => {
    if (!appointmentId) return
    let alive = true
    ;(async () => {
      try {
        const a = await crm.appointment(appointmentId)
        if (!alive) return
        const [c, all] = await Promise.all([crm.client(a.client_id), crm.items('', true).catch(() => [] as Item[])])
        if (!alive) return
        keepPet.current = a.patient_id
        setClient(c)
        setAppt(a)
        const it = a.item_id ? all.find(i => i.id === a.item_id) : undefined
        const key = newKey()
        if (it) {
          setLines([{ key, item_id: it.id, kind: it.kind, description: it.name, qty: '1', price: moneyInput(a.price ?? it.price), staff: a.staff_user_id, unit: it.unit }])
        } else {
          setLines([{ key, kind: 'custom', description: APPT_TYPE[a.type] ?? 'Atendimento', qty: '1', price: a.price != null ? moneyInput(a.price) : '', staff: a.staff_user_id }])
          setFocusKey(key)
        }
      } catch (e) {
        if (alive) error(errMsg(e, 'Agendamento não encontrado.'))
      }
    })()
    return () => { alive = false }
  }, [appointmentId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focusKey) return
    const t = setTimeout(() => {
      const el = document.getElementById(`pos-price-${focusKey}`) as HTMLInputElement | null
      el?.focus(); el?.select()
      setFocusKey(null)
    }, 220)
    return () => clearTimeout(t)
  }, [focusKey, cartOpen])

  // foco inicial na busca do catálogo (só no computador, sem atrapalhar o preço vindo da agenda)
  const didFocus = useRef(false)
  useEffect(() => {
    if (!wide || didFocus.current || appointmentId) return
    didFocus.current = true
    const el = document.querySelector<HTMLInputElement>('input[aria-label="Buscar no catálogo"]')
    if (el && document.activeElement === document.body) el.focus({ preventScroll: true })
  }, [wide, appointmentId])

  /* ───────── catálogo ───────── */
  const all = items.data ?? []
  const byKind = all.filter(i => kind === 'all' || i.kind === kind)
  const cats = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of byKind) if (i.category) m.set(i.category, (m.get(i.category) ?? 0) + 1)
    return Array.from(m.entries())
  }, [byKind])
  const nq = norm(q.trim())
  const shown = byKind.filter(i => (!cat || i.category === cat) && (!nq || norm(i.name).includes(nq) || norm(i.sku || '').includes(nq)))
  const inCart = (id: number) => lines.filter(l => l.item_id === id).reduce((a, l) => a + (parseDecimal(l.qty) ?? 0), 0)

  const add = (i: Item) => {
    setLast(null)
    setLines(ls => {
      const ex = ls.find(l => l.item_id === i.id)
      if (ex) return ls.map(l => (l === ex ? { ...l, qty: qtyText((parseDecimal(l.qty) ?? 0) + 1) } : l))
      return [...ls, { key: newKey(), item_id: i.id, kind: i.kind, description: i.name, qty: '1', price: moneyInput(i.price), staff: null, unit: i.unit }]
    })
  }
  const addCustom = () => {
    const key = newKey()
    setLast(null)
    setLines(ls => [...ls, { key, kind: 'custom', description: '', qty: '1', price: '', staff: null }])
    if (!wide) setCartOpen(true)
    setTimeout(() => (document.getElementById(`pos-desc-${key}`) as HTMLInputElement | null)?.focus(), 240)
  }
  const upd = (key: string, p: Partial<Line>) => setLines(ls => ls.map(l => (l.key === key ? { ...l, ...p } : l)))
  const step = (l: Line, d: number) => {
    const n = (parseDecimal(l.qty) ?? 0) + d
    if (n <= 0) return
    upd(l.key, { qty: qtyText(Math.round(n * 1000) / 1000) })
  }

  /* ───────── totais ───────── */
  const lineTotal = (l: Line) => Math.round((parseDecimal(l.qty) ?? 0) * (parseMoney(l.price) ?? 0) * 100) / 100
  const subtotal = lines.reduce((a, l) => a + lineTotal(l), 0)
  const disc = Math.max(0, Math.min(subtotal, parseMoney(discount) ?? 0))
  const total = Math.round((subtotal - disc) * 100) / 100
  const recv = parseMoney(received)
  const change = recv != null ? Math.round((recv - total) * 100) / 100 : null
  const count = lines.length
  const fiado = method === 'fiado'
  const hasCash = !!cash.session
  const blockedByCash = !fiado && cash.ready && !hasCash

  function reset() {
    setLines([]); setDiscount(''); setReceived(''); setDue(''); setAppt(null); setClient(null); setPatientId(null); setMethod('pix')
  }

  async function finish(withoutCash = false) {
    if (busy) return
    if (!lines.length) { error('Adicione pelo menos um item.'); return }
    const payload: Array<{ item_id?: number; description?: string; qty: number; unit_price?: number; staff_user_id?: number | null }> = []
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const name = l.description.trim() || 'item avulso'
      const qty = parseDecimal(l.qty)
      const price = parseMoney(l.price)
      if (l.kind === 'custom' && !l.description.trim()) { error(`Linha ${i + 1}: informe a descrição do item avulso.`); return }
      if (qty == null || qty <= 0) { error(`Linha ${i + 1} (${name}): informe uma quantidade maior que zero.`); return }
      if (price == null || price < 0) { error(`Linha ${i + 1} (${name}): informe um preço válido.`); return }
      payload.push({ item_id: l.item_id, description: l.description.trim(), qty, unit_price: price, staff_user_id: l.kind !== 'product' ? l.staff : null })
    }
    if (discount.trim() && (parseMoney(discount) == null || (parseMoney(discount) ?? 0) < 0)) { error('Desconto inválido.'); return }
    if ((parseMoney(discount) ?? 0) > subtotal) { error('O desconto não pode passar do subtotal.'); return }
    if (fiado && !client) { error('Para lançar a receber, escolha o cliente.'); return }
    if (method === 'dinheiro' && recv != null && recv < total) { error('O valor recebido é menor que o total.'); return }

    setBusy(true)
    try {
      const s = await crm.createSale({
        client_id: client?.id ?? null, patient_id: patientId, appointment_id: appt?.id ?? null,
        items: payload, discount: disc, payment_method: method, status: fiado ? 'aberta' : 'paga',
        due_date: fiado && due ? `${due}T12:00:00` : null,
        ...(withoutCash ? { allow_without_cash: true } : {}),
      })
      setBurst(true)
      setTimeout(() => setBurst(false), 900)
      success(fiado ? `Venda nº ${s.id} lançada a receber: ${brl(s.total)}.` : `Venda nº ${s.id} registrada: ${brl(s.total)}.`)
      for (const w of s.warnings ?? []) warning(w)
      setLast(s)
      reset()
      emitCrmChange('sale')
      if (appt) emitCrmChange('appointment')
      items.reload()
    } catch (e) {
      if (isCashClosed(e)) {
        warning('Abra o caixa para receber')
        setCartOpen(false)
        cash.reload()
        scrollToCashBar()
      } else error(errMsg(e, 'Não foi possível registrar a venda.'))
    } finally {
      setBusy(false)
    }
  }

  /* ───────── carrinho ───────── */
  const staffOpts = (team.data ?? []) as Member[]
  const methods: Method[] = method === 'boleto' ? [...BASE_METHODS.slice(0, 4), 'boleto', 'fiado'] : BASE_METHODS

  const cart = (
    <div className="space-y-4">
      {appt && (
        <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200 px-3 py-2.5">
          <CalendarCheck className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} aria-hidden />
          <p className="text-sm flex-1 min-w-0">Finalizando o atendimento de <b>{appt.patient_name ?? appt.client_name ?? 'cliente'}</b> às {fmtTime(appt.starts_at)}</p>
          <button type="button" onClick={() => setAppt(null)} aria-label="Desvincular do agendamento" className="h-6 w-6 -mr-1 inline-flex items-center justify-center rounded-md hover:bg-blue-100 dark:hover:bg-blue-500/20">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      <div className="space-y-3">
        <Field label={fiado ? 'Cliente' : 'Cliente (opcional)'}>
          <ClientPicker value={client} onChange={c => { setClient(c); if (!c) setAppt(null) }} locked={!!appt} />
        </Field>
        {client && (
          <Field label="Pet">
            <Select value={patientId ?? ''} onChange={e => setPatientId(e.target.value ? Number(e.target.value) : null)} disabled={!pets}>
              <option value="">{pets && !pets.length ? 'Nenhum pet cadastrado' : 'Sem pet'}</option>
              {(pets ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        )}
      </div>

      <div>
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-1.5">Itens</p>
        {lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
            <ShoppingCart className="w-5 h-5 mx-auto text-muted" strokeWidth={1.75} aria-hidden />
            <p className="text-sm text-muted mt-1.5">Toque nos itens do catálogo para adicionar.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
            <AnimatePresence initial={false}>
              {lines.map((l, i) => (
                <m.li key={l.key} layout="position"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: dur.base }} className="overflow-hidden">
                  <div className="px-3 py-2.5 space-y-2">
                    <div className="flex items-start gap-2">
                      {l.kind === 'custom' ? (
                        <Input id={`pos-desc-${l.key}`} value={l.description} placeholder="Descrição do item" aria-label={`Descrição da linha ${i + 1}`}
                          maxLength={200} onChange={e => upd(l.key, { description: e.target.value })} className="!h-8 flex-1" />
                      ) : (
                        <p className="flex-1 min-w-0 text-sm font-medium text-ink leading-snug pt-1">{l.description}</p>
                      )}
                      <button type="button" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} aria-label={`Remover ${l.description || 'item'}`}
                        className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-muted hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center">
                        <button type="button" onClick={() => step(l, -1)} disabled={(parseDecimal(l.qty) ?? 0) <= 1} aria-label="Diminuir quantidade"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-l-lg border border-line bg-panel-2 text-ink disabled:opacity-40">
                          <Minus className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                        <DecimalInput value={l.qty} onChange={v => upd(l.key, { qty: v })} aria-label={`Quantidade da linha ${i + 1}`}
                          className="!h-8 w-16 !rounded-none -mx-px text-center [&_input]:text-center [&_input]:px-1" />
                        <button type="button" onClick={() => step(l, 1)} aria-label="Aumentar quantidade"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-r-lg border border-line bg-panel-2 text-ink">
                          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                      <span className="text-xs text-muted" aria-hidden>×</span>
                      <MoneyInput id={`pos-price-${l.key}`} value={l.price} onChange={v => upd(l.key, { price: v })} aria-label={`Preço unitário da linha ${i + 1}`}
                        placeholder="0,00" className="!h-8 w-28" />
                      <span className="ml-auto text-sm font-semibold tabular-nums text-ink">{brl(lineTotal(l))}</span>
                    </div>
                    {l.kind !== 'product' && staffOpts.length > 0 && (
                      <Select value={l.staff ?? ''} onChange={e => upd(l.key, { staff: e.target.value ? Number(e.target.value) : null })}
                        aria-label={`Profissional da linha ${i + 1}`} className="!h-8 text-xs">
                        <option value="">Profissional (para comissão)</option>
                        {staffOpts.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                      </Select>
                    )}
                  </div>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between"><span className="text-muted">Subtotal</span><span className="tabular-nums text-ink">{brl(subtotal)}</span></div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="pos-discount" className="text-muted">Desconto</label>
          <MoneyInput id="pos-discount" value={discount} onChange={setDiscount} placeholder="0,00" className="!h-8 w-32" />
        </div>
        <div className="flex items-end justify-between pt-2 border-t border-line">
          <span className="font-semibold text-ink">Total</span>
          <AnimatedNumber value={total} format={brl} className="text-kpi font-bold text-ink" />
        </div>
      </div>

      <div>
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-1.5">Forma de pagamento</p>
        <div className="flex items-center gap-1.5">
          <Segmented id="pay" ariaLabel="Forma de pagamento" size="sm" value={method} onChange={v => setMethod(v)} className="min-w-0"
            options={methods.map(m => ({ value: m, label: PAY_SHORT[m], icon: PAY_ICON[m] }))} />
          <DropdownMenu ariaLabel="Mais formas de pagamento" align="end"
            triggerClassName="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-panel-2"
            trigger={<MoreHorizontal className="w-4 h-4" strokeWidth={1.75} aria-label="Mais formas" />}
            items={[{ label: 'Boleto', icon: PAY_ICON.boleto, onSelect: () => setMethod('boleto') }]} />
        </div>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {method === 'dinheiro' && (
          <m.div key="cash" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: dur.base }} className="overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
              <Field label="Valor recebido"><MoneyInput value={received} onChange={setReceived} placeholder={moneyInput(total)} /></Field>
              <div>
                <span className="block text-xs font-semibold text-ink/80 mb-1">Troco</span>
                <p className={`h-9 flex items-center text-lg font-bold tabular-nums ${change != null && change < 0 ? 'text-red-600 dark:text-red-400' : 'text-ink'}`}>
                  {change == null ? '—' : change < 0 ? `Faltam ${brl(-change)}` : brl(change)}
                </p>
              </div>
            </div>
          </m.div>
        )}
        {fiado && (
          <m.div key="fiado" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: dur.base }} className="overflow-hidden">
            <Field label="Vencimento" hint={!client ? 'Escolha o cliente para lançar a receber.' : undefined}>
              <Input type="date" value={due} min={ymd(new Date())} onChange={e => setDue(e.target.value)} />
            </Field>
          </m.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <Btn size="lg" className="w-full" loading={busy} onClick={() => finish(false)}
          disabled={!lines.length || blockedByCash || (fiado && !client)}>
          {fiado ? `Lançar a receber ${brl(total)}` : `Receber ${brl(total)}`}
        </Btn>
        {blockedByCash && (
          <div className="text-center">
            <button type="button" onClick={() => { setCartOpen(false); scrollToCashBar() }} className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline">
              Abra o caixa para receber
            </button>
            {admin && lines.length > 0 && (
              <button type="button" onClick={() => finish(true)} disabled={busy} className="block mx-auto mt-1 text-2xs text-muted hover:text-ink underline underline-offset-2">
                Receber sem caixa (administrador)
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {last && !lines.length && (
          <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: dur.base }}
            className="flex items-center gap-3 rounded-xl bg-primary-50 dark:bg-primary-500/10 px-3 py-2.5">
            <p className="text-sm text-primary-800 dark:text-primary-200 flex-1 min-w-0">Venda nº {last.id} · <b className="tabular-nums">{brl(last.total)}</b></p>
            <Btn size="sm" variant="soft" icon={Printer} onClick={() => onReceipt(last.id, last)}>Imprimir recibo</Btn>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
        {/* catálogo */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <SearchInput value={q} onChange={setQ} shortcut="/" placeholder="Buscar serviço, produto ou código" className="flex-1" ariaLabel="Buscar no catálogo" />
            <Segmented id="pos-kind" size="sm" ariaLabel="Tipo de item" value={kind} onChange={v => { setKind(v); setCat(null) }}
              options={[{ value: 'service', label: 'Serviços' }, { value: 'product', label: 'Produtos' }, { value: 'all', label: 'Todos' }]} />
          </div>
          {cats.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto crm-scroll-x mt-3 -mx-4 px-4 lg:-mx-5 lg:px-5 pb-0.5">
              <Chip active={!cat} onClick={() => setCat(null)}>Todas</Chip>
              {cats.map(([c, n]) => <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)} count={n}>{catLabel(c)}</Chip>)}
            </div>
          )}

          <div className="mt-4">
            {!items.data && items.error ? (
              <ErrorState message={items.error} onRetry={items.reload} compact />
            ) : !items.data ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
              </div>
            ) : all.length === 0 ? (
              <EmptyState icon={Package} title="Catálogo vazio." hint="Cadastre serviços e produtos em Estoque e serviços." compact />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {shown.slice(0, 60).map(i => {
                  const n = inCart(i.id)
                  return (
                    <m.button key={i.id} type="button" {...pressable} onClick={() => add(i)}
                      aria-label={`Adicionar ${i.name}, ${brl(i.price)}`}
                      className={`relative text-left rounded-xl p-3 min-h-[88px] flex flex-col bg-panel-2/60 hover:bg-panel-2 ring-1 transition-colors outline-none focus-visible:shadow-crm-glow
                        ${n > 0 ? 'ring-primary-400 dark:ring-primary-500/60' : 'ring-transparent'}`}>
                      <span className="text-sm font-medium text-ink leading-snug line-clamp-2 pr-5">{i.name}</span>
                      <span className="mt-auto pt-2 flex items-end justify-between gap-2">
                        <span className="text-sm font-bold tabular-nums text-ink">{brl(i.price)}</span>
                        {i.kind === 'product' ? (
                          <span className={`text-2xs tabular-nums ${i.low_stock ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted'}`}>
                            {qtyText(i.stock_qty ?? 0)} {i.unit ?? 'un'}
                          </span>
                        ) : i.duration_min ? <span className="text-2xs text-muted tabular-nums">{i.duration_min} min</span> : null}
                      </span>
                      <AnimatePresence>
                        {n > 0 && (
                          <m.span key={n} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                            transition={{ duration: dur.fast }}
                            className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-primary-600 text-white dark:bg-primary-500 dark:text-surface-950 text-2xs font-bold tabular-nums inline-flex items-center justify-center">
                            {qtyText(n)}
                          </m.span>
                        )}
                      </AnimatePresence>
                    </m.button>
                  )
                })}
                <m.button type="button" {...pressable} onClick={addCustom}
                  className="rounded-xl p-3 min-h-[88px] flex flex-col items-center justify-center gap-1 border border-dashed border-line text-muted hover:text-ink hover:border-primary-400 transition-colors outline-none focus-visible:shadow-crm-glow">
                  <PenLine className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                  <span className="text-sm font-medium">Item avulso</span>
                </m.button>
              </div>
            )}
            {items.data && all.length > 0 && shown.length === 0 && (
              <p className="text-sm text-muted text-center py-4">Nada encontrado{q ? ` para “${q}”` : ''}.</p>
            )}
            {shown.length > 60 && <p className="text-xs text-muted text-center pt-3">Mostrando 60 de {shown.length}. Refine a busca.</p>}
          </div>
        </Card>

        {/* carrinho */}
        {wide ? (
          <div className="sticky top-[72px]">
            <Card>
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-ink mb-3">
                <ShoppingCart className="w-[18px] h-[18px]" strokeWidth={1.75} aria-hidden /> Venda
                {count > 0 && <span className="text-2xs font-semibold rounded-full px-1.5 bg-panel-2 text-muted tabular-nums">{count}</span>}
              </h2>
              {cart}
            </Card>
          </div>
        ) : (
          <>
            <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title="Venda" initialFocus={false}
              description={count ? `${count} ${count === 1 ? 'item' : 'itens'} · ${brl(total)}` : 'Nenhum item ainda'}>
              {cart}
            </Sheet>
            <m.button type="button" onClick={() => setCartOpen(true)} {...pressable}
              className="fixed z-30 left-4 right-[88px] md:right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-4 h-14 rounded-2xl px-4 flex items-center gap-3 bg-ink text-bg shadow-crm-pop"
              aria-label={`Abrir venda: ${count} ${count === 1 ? 'item' : 'itens'}, ${brl(total)}`}>
              <ShoppingCart className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="flex-1 min-w-0 text-left text-sm font-semibold truncate tabular-nums">
                {count ? `${count} ${count === 1 ? 'item' : 'itens'} · ${brl(total)}` : 'Venda vazia'}
              </span>
              <ChevronRight className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden />
            </m.button>
          </>
        )}
      </div>

      <AnimatePresence>
        {burst && (
          <m.div className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center" aria-hidden
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.base }}>
            <m.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ duration: dur.slow }}
              className="rounded-3xl bg-panel/95 backdrop-blur shadow-crm-pop p-6 flex flex-col items-center gap-2">
              <CheckBurst size={64} />
              <span className="text-sm font-semibold text-ink">Venda registrada</span>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
      {!wide && <div className="h-20" aria-hidden />}
      <span className="sr-only" aria-live="polite">{last ? `Venda ${last.id} registrada.` : ''}</span>
    </>
  )
}
