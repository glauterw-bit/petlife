'use client'

import { useState } from 'react'
import { ArrowLeftRight, Package, Pencil, Plus, Scissors } from 'lucide-react'
import { crm, type Item } from '@/lib/crmApi'
import { can, useCrm } from '@/components/crm/CrmShell'
import { Badge, Btn, Card, PageHead, brl, catLabel } from '@/components/crm/ui'
import { Chip, DataList, EmptyState, Meter, SearchInput, Segmented, Switch, useAsync, type Column } from '@/components/crm/kit'
import { ItemSheet } from '@/components/crm/caixa/ItemSheet'
import { StockSheet } from '@/components/crm/caixa/StockSheet'
import { qtyText } from '@/components/crm/caixa/shared'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const iconBtn = 'h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-panel-2 transition-colors'

export default function Estoque() {
  const { me } = useCrm()
  const admin = can(me.user.role)
  const canMove = can(me.user.role, 'recepcao')
  const [tab, setTab] = useState<'product' | 'service'>('product')
  const [q, setQ] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [inactive, setInactive] = useState(false)
  const [edit, setEdit] = useState<{ item: Item | null } | null>(null)
  const [stock, setStock] = useState<Item | null>(null)

  const st = useAsync(() => crm.items('', inactive), [inactive])
  const all = st.data
  const ofKind = (all ?? []).filter(i => i.kind === tab)
  const lowCount = (all ?? []).filter(i => i.kind === 'product' && i.active && i.low_stock).length
  const nq = norm(q.trim())
  const rows = all
    ? ofKind.filter(i => (!nq || norm(i.name).includes(nq) || norm(i.sku || '').includes(nq) || norm(catLabel(i.category)).includes(nq))
        && (!lowOnly || tab !== 'product' || i.low_stock))
    : null

  const name = (i: Item) => (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span className={`font-medium truncate ${i.active ? 'text-ink' : 'text-muted'}`}>{i.name}</span>
      {!i.active && <Badge>Inativo</Badge>}
    </span>
  )
  const margin = (i: Item) => (i.cost != null && i.price > 0 ? Math.round(((i.price - i.cost) / i.price) * 1000) / 10 : null)
  const stockCell = (i: Item) => {
    const v = i.stock_qty ?? 0
    return (
      <div className="flex items-center justify-end gap-2.5">
        <Meter value={Math.max(0, v)} max={Math.max((i.min_stock ?? 0) * 3, v, 1)} danger={i.low_stock} className="w-16 hidden lg:block" />
        <span className={`tabular-nums whitespace-nowrap ${i.low_stock ? 'font-semibold text-red-600 dark:text-red-400' : 'text-ink'}`}>{qtyText(v)} {i.unit ?? 'un'}</span>
      </div>
    )
  }

  const productCols: Column<Item>[] = [
    { key: 'n', header: 'Nome', cell: name },
    { key: 'sku', header: 'SKU', hideBelow: 'lg', cell: i => <span className="text-muted">{i.sku ?? '—'}</span> },
    { key: 'c', header: 'Categoria', cell: i => <span className="text-muted">{catLabel(i.category)}</span> },
    { key: 'p', header: 'Preço', align: 'right', cell: i => brl(i.price) },
    { key: 'cost', header: 'Custo', align: 'right', hideBelow: 'lg', cell: i => <span className="text-muted">{i.cost != null ? brl(i.cost) : '—'}</span> },
    { key: 'm', header: 'Margem', align: 'right', hideBelow: 'lg', cell: i => { const m = margin(i); return <span className="text-muted">{m != null ? `${m.toLocaleString('pt-BR')}%` : '—'}</span> } },
    { key: 's', header: 'Estoque', align: 'right', cell: stockCell },
  ]
  const serviceCols: Column<Item>[] = [
    { key: 'n', header: 'Nome', cell: name },
    { key: 'c', header: 'Categoria', cell: i => <span className="text-muted">{catLabel(i.category)}</span> },
    { key: 'p', header: 'Preço', align: 'right', cell: i => brl(i.price) },
    { key: 'd', header: 'Duração', align: 'right', cell: i => <span className="text-muted">{i.duration_min ? `${i.duration_min} min` : '—'}</span> },
  ]

  return (
    <div>
      <PageHead title="Estoque e serviços"
        sub={lowCount ? `${lowCount} ${lowCount === 1 ? 'produto' : 'produtos'} com estoque baixo` : 'Catálogo usado na agenda e no caixa'}
        actions={admin ? <Btn icon={Plus} onClick={() => setEdit({ item: null })}>Novo item</Btn> : undefined} />

      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <Segmented id="estoque" ariaLabel="Tipo de item" value={tab} onChange={v => setTab(v)}
            options={[
              { value: 'product', label: 'Produtos', icon: Package, count: all ? all.filter(i => i.kind === 'product').length : undefined },
              { value: 'service', label: 'Serviços', icon: Scissors, count: all ? all.filter(i => i.kind === 'service').length : undefined },
            ]} />
          <SearchInput value={q} onChange={setQ} shortcut="/" placeholder="Buscar por nome, código ou categoria" className="flex-1" />
          <div className="flex items-center gap-3 flex-wrap">
            {tab === 'product' && <Chip active={lowOnly} onClick={() => setLowOnly(v => !v)} count={lowCount}>Só estoque baixo</Chip>}
            <Switch checked={inactive} onChange={setInactive} label="Mostrar inativos" />
          </div>
        </div>

        <div className="mt-4">
          <DataList ariaLabel={tab === 'product' ? 'Produtos' : 'Serviços'} rows={rows} loading={st.loading} error={st.error} onRetry={st.reload}
            columns={tab === 'product' ? productCols : serviceCols} rowKey={i => i.id}
            onRowClick={i => setEdit({ item: i })}
            empty={all && all.length === 0 ? (
              <EmptyState icon={Package} title="Cadastre seus produtos e serviços"
                hint="Eles aparecem no caixa e na agenda, com preço e estoque."
                action={admin ? <Btn icon={Plus} onClick={() => setEdit({ item: null })}>Novo item</Btn> : undefined} />
            ) : (
              <EmptyState icon={Package} compact
                title={lowOnly ? 'Nenhum produto com estoque baixo.' : q ? 'Nada encontrado.' : tab === 'product' ? 'Nenhum produto cadastrado.' : 'Nenhum serviço cadastrado.'} />
            )}
            rowActions={i => (
              <>
                {i.kind === 'product' && canMove && (
                  <button type="button" className={iconBtn} onClick={() => setStock(i)} aria-label={`Movimentar estoque de ${i.name}`} title="Movimentar">
                    <ArrowLeftRight className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                )}
                {admin && (
                  <button type="button" className={`${iconBtn} hidden md:inline-flex`} onClick={() => setEdit({ item: i })} aria-label={`Editar ${i.name}`} title="Editar">
                    <Pencil className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                )}
              </>
            )}
            renderMobile={i => (
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  {name(i)}
                  <span className="text-sm font-semibold tabular-nums text-ink">{brl(i.price)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5 text-xs">
                  <span className="text-muted truncate">{catLabel(i.category)}{i.kind === 'service' && i.duration_min ? ` · ${i.duration_min} min` : ''}</span>
                  {i.kind === 'product' && (
                    <span className={`tabular-nums ${i.low_stock ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted'}`}>{qtyText(i.stock_qty ?? 0)} {i.unit ?? 'un'}</span>
                  )}
                </div>
              </div>
            )} />
        </div>
      </Card>

      <ItemSheet open={!!edit} item={edit?.item ?? null} defaultKind={tab} onClose={() => setEdit(null)} onSaved={st.reload} />
      <StockSheet item={stock} onClose={() => setStock(null)} onDone={it => {
        setStock(null)
        if (all) st.setData(all.map(x => (x.id === it.id ? it : x)))
        st.reload()
      }} />
    </div>
  )
}
