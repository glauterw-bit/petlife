'use client'

import { useEffect, useState } from 'react'
import { History, Trash2 } from 'lucide-react'
import { crm, type Item, type StockMove } from '@/lib/crmApi'
import { can, useCrm } from '@/components/crm/CrmShell'
import { Btn, Field, Input, Select, catLabel, fmtDateTime, moneyInput, parseDecimal, parseMoney } from '@/components/crm/ui'
import { DataList, DecimalInput, EmptyState, MoneyInput, Segmented, Sheet, Switch, Tabs, useAsync, useConfirm, type Column } from '@/components/crm/kit'
import { useToast } from '@/components/ui/ToastContext'
import { errMsg, qtyText } from './shared'

export const SERVICE_CATS = ['consulta', 'vacina', 'banho_tosa', 'exame', 'cirurgia', 'outros']
export const PRODUCT_CATS = ['medicamento', 'racao', 'acessorio', 'higiene', 'vacina', 'outros']

const REASON: Record<string, string> = { entrada: 'Entrada', perda: 'Perda', ajuste: 'Ajuste', devolucao: 'Devolução', venda: 'Venda' }

interface Form { kind: 'service' | 'product'; name: string; category: string; sku: string; price: string; cost: string; unit: string; min_stock: string; duration: string; active: boolean }

const toForm = (i: Item | null, kind: 'service' | 'product'): Form => ({
  kind: i?.kind ?? kind, name: i?.name ?? '', category: i?.category ?? '', sku: i?.sku ?? '',
  price: i ? moneyInput(i.price) : '', cost: i?.cost != null ? moneyInput(i.cost) : '', unit: i?.unit ?? 'un',
  min_stock: i?.min_stock != null ? qtyText(i.min_stock) : '', duration: i?.duration_min != null ? String(i.duration_min) : '', active: i?.active ?? true,
})

/** Cadastro de produto ou serviço, com histórico de estoque. */
export function ItemSheet({ open, item, defaultKind, onClose, onSaved }: {
  open: boolean; item: Item | null; defaultKind: 'service' | 'product'; onClose: () => void; onSaved: () => void
}) {
  const { me } = useCrm()
  const admin = can(me.user.role)
  const canDelete = can(me.user.role, 'recepcao')
  const { error, success, info } = useToast()
  const { confirm } = useConfirm()
  const [tab, setTab] = useState<'dados' | 'moves'>('dados')
  const [f, setF] = useState<Form>(() => toForm(item, defaultKind))
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!open) return
    setF(toForm(item, defaultKind)); setTab('dados'); setTried(false)
  }, [open, item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const moves = useAsync(() => (open && item && tab === 'moves' ? crm.itemMoves(item.id) : Promise.resolve(null)), [open, item?.id, tab])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(x => ({ ...x, [k]: v }))
  const product = f.kind === 'product'
  const cats = product ? PRODUCT_CATS : SERVICE_CATS
  const price = parseMoney(f.price)
  const cost = parseMoney(f.cost)
  const margin = price && cost != null && price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : null

  async function save() {
    if (busy || !admin) return
    setTried(true)
    if (!f.name.trim()) { error('Informe o nome.'); return }
    if (f.price.trim() && (price == null || price < 0)) { error('Preço inválido.'); return }
    if (f.cost.trim() && (cost == null || cost < 0)) { error('Custo inválido.'); return }
    const minStock = f.min_stock.trim() ? parseDecimal(f.min_stock) : null
    if (f.min_stock.trim() && (minStock == null || minStock < 0)) { error('Estoque mínimo inválido.'); return }
    const duration = f.duration.trim() ? parseDecimal(f.duration) : null
    if (f.duration.trim() && (duration == null || duration < 0 || duration > 1440 || !Number.isInteger(duration))) { error('Duração em minutos inteiros, até 1440.'); return }
    const body: Partial<Item> = {
      kind: f.kind, name: f.name.trim(), category: f.category || null, sku: product ? f.sku.trim() || null : null,
      price: price ?? 0, cost: product && f.cost.trim() ? cost : null, unit: product ? f.unit.trim() || 'un' : 'un',
      min_stock: product ? minStock : null, duration_min: product ? null : duration, active: f.active,
    }
    setBusy(true)
    try {
      if (item) await crm.updateItem(item.id, body); else await crm.createItem(body)
      success(item ? 'Item atualizado.' : product ? 'Produto cadastrado.' : 'Serviço cadastrado.')
      onSaved()
      onClose()
    } catch (e) {
      error(errMsg(e, 'Não foi possível salvar.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!item) return
    const ok = await confirm({
      title: `Excluir ${item.name}?`,
      message: 'Se o item já foi usado em vendas ou agendamentos, ele é desativado em vez de excluído.',
      confirmLabel: 'Excluir', tone: 'danger',
    })
    if (!ok) return
    try {
      const r = await crm.deleteItem(item.id)
      if (r.deactivated) info('Item já usado em vendas: foi desativado em vez de excluído.')
      else success('Item excluído.')
      onSaved()
      onClose()
    } catch (e) {
      error(errMsg(e, 'Não foi possível excluir.'))
    }
  }

  const moveCols: Column<StockMove>[] = [
    { key: 'd', header: 'Data', cell: m => <span className="tabular-nums text-muted">{fmtDateTime(m.at)}</span> },
    { key: 'r', header: 'Motivo', cell: m => REASON[m.reason] ?? m.reason },
    { key: 'q', header: 'Qtd.', align: 'right', cell: m => (
      <span className={`font-semibold ${m.qty >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
        {m.qty > 0 ? '+' : ''}{qtyText(m.qty)}
      </span>
    ) },
    { key: 'u', header: 'Quem', cell: m => <span className="text-muted">{m.user_name ?? '—'}</span> },
    { key: 'n', header: 'Observação', hideBelow: 'lg', cell: m => <span className="text-muted">{m.note ?? '—'}</span> },
  ]

  const title = item ? item.name : product ? 'Novo produto' : 'Novo serviço'
  const ro = !admin

  return (
    <Sheet open={open} onClose={onClose} title={title} size="lg" onSubmit={admin && tab === 'dados' ? save : undefined}
      description={ro ? 'Só o administrador altera preços e dados do catálogo.' : undefined}
      footer={<>
        {item && canDelete && <Btn variant="danger" icon={Trash2} onClick={remove} className="mr-auto">Excluir item</Btn>}
        <Btn variant="ghost" onClick={onClose}>{admin ? 'Cancelar' : 'Fechar'}</Btn>
        {admin && tab === 'dados' && <Btn loading={busy} onClick={save}>Salvar</Btn>}
      </>}>
      {item && item.kind === 'product' && (
        <Tabs id="item-sheet" value={tab} onChange={setTab} className="mb-4"
          tabs={[{ value: 'dados', label: 'Dados' }, { value: 'moves', label: 'Movimentações' }]} />
      )}
      {tab === 'dados' ? (
        <fieldset disabled={ro} className="space-y-4 min-w-0">
          {!item && (
            <Segmented id="item-kind" ariaLabel="Tipo" value={f.kind} onChange={v => setF(x => ({ ...x, kind: v, category: '' }))}
              options={[{ value: 'product', label: 'Produto' }, { value: 'service', label: 'Serviço' }]} />
          )}
          <Field label="Nome" error={tried && !f.name.trim() ? 'Informe o nome.' : undefined}>
            <Input value={f.name} maxLength={200} onChange={e => set('name', e.target.value)} placeholder={product ? 'Ex.: Ração 15 kg' : 'Ex.: Banho porte médio'} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select value={f.category} onChange={e => set('category', e.target.value)}>
                <option value="">Sem categoria</option>
                {cats.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                {f.category && cats.indexOf(f.category) < 0 && <option value={f.category}>{catLabel(f.category)}</option>}
              </Select>
            </Field>
            {product ? (
              <Field label="Código (SKU)"><Input value={f.sku} maxLength={60} onChange={e => set('sku', e.target.value)} placeholder="Opcional" /></Field>
            ) : (
              <Field label="Duração (min)" hint="Usada para ocupar a agenda.">
                <DecimalInput value={f.duration} onChange={v => set('duration', v.replace(/[.,]/g, ''))} suffix="min" placeholder="30" />
              </Field>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Preço de venda"><MoneyInput value={f.price} onChange={v => set('price', v)} placeholder="0,00" /></Field>
            {product && (
              <Field label="Custo" hint={margin != null ? `Margem de ${margin.toLocaleString('pt-BR')}%` : 'Opcional, para ver a margem.'}>
                <MoneyInput value={f.cost} onChange={v => set('cost', v)} placeholder="0,00" />
              </Field>
            )}
          </div>
          {product && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Unidade"><Input value={f.unit} maxLength={10} onChange={e => set('unit', e.target.value)} placeholder="un, kg, ml" /></Field>
              <Field label="Estoque mínimo" hint="Abaixo disso, o item aparece como estoque baixo.">
                <DecimalInput value={f.min_stock} onChange={v => set('min_stock', v)} suffix={f.unit || 'un'} placeholder="0" />
              </Field>
            </div>
          )}
          {product && item && (
            <p className="text-sm text-muted">Estoque atual: <b className="text-ink tabular-nums">{qtyText(item.stock_qty ?? 0)} {item.unit ?? 'un'}</b>. Para mudar, use Movimentar.</p>
          )}
          {!item && product && <p className="text-xs text-muted">O estoque inicial entra depois, em Movimentar › Entrada.</p>}
          <Switch checked={f.active} onChange={v => set('active', v)} label="Ativo" hint="Inativos não aparecem no caixa nem na agenda." />
        </fieldset>
      ) : (
        <DataList ariaLabel="Movimentações de estoque" rows={moves.data} loading={moves.loading} error={moves.error} onRetry={moves.reload}
          columns={moveCols} rowKey={m => m.id}
          empty={<EmptyState icon={History} title="Nenhuma movimentação." hint="Entradas, perdas, ajustes e vendas aparecem aqui." compact />}
          renderMobile={m => (
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{REASON[m.reason] ?? m.reason}</p>
                <span className={`text-sm font-semibold tabular-nums ${m.qty >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{m.qty > 0 ? '+' : ''}{qtyText(m.qty)}</span>
              </div>
              <p className="text-xs text-muted truncate">{[fmtDateTime(m.at), m.user_name, m.note].filter(Boolean).join(' · ')}</p>
            </div>
          )} />
      )}
    </Sheet>
  )
}
