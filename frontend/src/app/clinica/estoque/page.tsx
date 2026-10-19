'use client'

import { useEffect, useState } from 'react'
import { crm, type Item } from '@/lib/crmApi'
import { useCrm, can } from '@/components/crm/CrmShell'
import { Card, PageHead, Btn, Field, Input, Select, Empty, Badge, brl } from '@/components/crm/ui'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastContext'

const CATS = ['consulta', 'vacina', 'banho_tosa', 'exame', 'cirurgia', 'medicamento', 'racao', 'acessorio', 'higiene', 'outros']

export default function Estoque() {
  const { me } = useCrm()
  const { error, success } = useToast()
  const [tab, setTab] = useState<'service' | 'product'>('product')
  const [items, setItems] = useState<Item[]>([])
  const [edit, setEdit] = useState<Partial<Item> | null>(null)
  const [stock, setStock] = useState<Item | null>(null)
  const [mv, setMv] = useState({ qty: '', reason: 'entrada', note: '' })
  const admin = can(me.user.role)
  const load = () => crm.items(tab, true).then(setItems).catch(() => {})
  useEffect(() => { load() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!edit?.name?.trim()) { error('Informe o nome.'); return }
    try {
      const body = { ...edit, kind: edit.kind ?? tab, price: Number(edit.price) || 0, cost: edit.cost != null && String(edit.cost) !== '' ? Number(edit.cost) : null,
        min_stock: edit.min_stock != null && String(edit.min_stock) !== '' ? Number(edit.min_stock) : null,
        duration_min: edit.duration_min != null && String(edit.duration_min) !== '' ? Number(edit.duration_min) : null, active: edit.active ?? true }
      if (edit.id) await crm.updateItem(edit.id, body); else await crm.createItem(body)
      success('Salvo.'); setEdit(null); load()
    } catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }
  async function move() {
    if (!stock || !Number(mv.qty)) { error('Informe a quantidade.'); return }
    try { await crm.moveStock(stock.id, { qty: Number(mv.qty.replace(',', '.')), reason: mv.reason, note: mv.note || undefined }); success('Estoque atualizado.'); setStock(null); load() }
    catch (e) { error(e instanceof Error ? e.message : 'Erro') }
  }
  const lowCount = items.filter(i => i.low_stock && i.active).length

  return (
    <div>
      <PageHead title="Serviços e estoque" sub={tab === 'product' && lowCount ? `${lowCount} produto(s) com estoque baixo` : 'Catálogo usado na agenda e no caixa'}
        actions={admin ? <Btn onClick={() => setEdit({ kind: tab, unit: 'un', active: true })}>+ {tab === 'product' ? 'Produto' : 'Serviço'}</Btn> : undefined} />
      <div className="flex rounded-xl border border-surface-200 dark:border-surface-600 overflow-hidden w-fit mb-4">
        {(['product', 'service'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-primary-500 text-white' : 'text-surface-600 dark:text-surface-300'}`}>{k === 'product' ? 'Produtos' : 'Serviços'}</button>
        ))}
      </div>
      <Card className="!p-0 overflow-x-auto">
        {items.length === 0 ? <Empty>Nada cadastrado.</Empty> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-500 border-b border-surface-100 dark:border-surface-700">
              <th className="p-3 font-medium">Nome</th><th className="p-3 font-medium">Categoria</th><th className="p-3 font-medium text-right">Preço</th>
              {tab === 'product' ? <><th className="p-3 font-medium text-right">Custo</th><th className="p-3 font-medium text-right">Estoque</th></> : <th className="p-3 font-medium text-right">Duração</th>}
              <th className="p-3" />
            </tr></thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} className={`border-b border-surface-50 dark:border-surface-700/50 ${!i.active ? 'opacity-50' : ''}`}>
                  <td className="p-3 font-medium text-surface-900 dark:text-white">{i.name}{!i.active && ' (inativo)'}{i.sku ? <span className="text-xs text-surface-400"> · {i.sku}</span> : null}</td>
                  <td className="p-3 text-surface-500">{i.category ?? '—'}</td>
                  <td className="p-3 text-right tabular-nums">{brl(i.price)}</td>
                  {tab === 'product' ? <>
                    <td className="p-3 text-right tabular-nums text-surface-500">{i.cost != null ? brl(i.cost) : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{i.low_stock ? <Badge cls="bg-red-100 text-red-700">{i.stock_qty ?? 0} {i.unit}</Badge> : `${i.stock_qty ?? 0} ${i.unit ?? ''}`}</td>
                  </> : <td className="p-3 text-right text-surface-500">{i.duration_min ? `${i.duration_min} min` : '—'}</td>}
                  <td className="p-3 text-right whitespace-nowrap">
                    {tab === 'product' && <button className="text-xs font-semibold text-primary-700 mr-3" onClick={() => { setStock(i); setMv({ qty: '', reason: 'entrada', note: '' }) }}>Movimentar</button>}
                    {admin && <button className="text-xs font-semibold text-surface-600" onClick={() => setEdit(i)}>Editar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar' : tab === 'product' ? 'Novo produto' : 'Novo serviço'} size="lg">
        {edit && (
          <div className="space-y-3">
            <Field label="Nome *"><Input value={edit.name ?? ''} onChange={e => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Categoria"><Select value={edit.category ?? ''} onChange={e => setEdit({ ...edit, category: e.target.value || null })}><option value="">—</option>{CATS.map(c => <option key={c} value={c}>{c}</option>)}</Select></Field>
              <Field label="Preço (R$)"><Input inputMode="decimal" value={edit.price ?? ''} onChange={e => setEdit({ ...edit, price: e.target.value.replace(',', '.') as unknown as number })} /></Field>
              {(edit.kind ?? tab) === 'product'
                ? <Field label="Custo (R$)"><Input inputMode="decimal" value={edit.cost ?? ''} onChange={e => setEdit({ ...edit, cost: e.target.value.replace(',', '.') as unknown as number })} /></Field>
                : <Field label="Duração (min)"><Input inputMode="numeric" value={edit.duration_min ?? ''} onChange={e => setEdit({ ...edit, duration_min: e.target.value as unknown as number })} /></Field>}
            </div>
            {(edit.kind ?? tab) === 'product' && (
              <div className="grid grid-cols-3 gap-3">
                <Field label="Código / SKU"><Input value={edit.sku ?? ''} onChange={e => setEdit({ ...edit, sku: e.target.value || null })} /></Field>
                <Field label="Unidade"><Input value={edit.unit ?? 'un'} onChange={e => setEdit({ ...edit, unit: e.target.value })} /></Field>
                <Field label="Estoque mínimo"><Input inputMode="decimal" value={edit.min_stock ?? ''} onChange={e => setEdit({ ...edit, min_stock: e.target.value as unknown as number })} /></Field>
              </div>
            )}
            {edit.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active ?? true} onChange={e => setEdit({ ...edit, active: e.target.checked })} /> Ativo</label>}
            <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn><Btn onClick={save}>Salvar</Btn></div>
          </div>
        )}
      </Modal>
      <Modal open={!!stock} onClose={() => setStock(null)} title={`Estoque · ${stock?.name ?? ''}`}>
        <div className="space-y-3">
          <p className="text-sm text-surface-500">Estoque atual: <b>{stock?.stock_qty ?? 0} {stock?.unit}</b></p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Movimento"><Select value={mv.reason} onChange={e => setMv({ ...mv, reason: e.target.value })}>
              <option value="entrada">Entrada (compra)</option><option value="perda">Perda / vencido</option><option value="ajuste">Ajuste (+ ou −)</option>
            </Select></Field>
            <Field label="Quantidade"><Input inputMode="decimal" value={mv.qty} onChange={e => setMv({ ...mv, qty: e.target.value })} placeholder={mv.reason === 'ajuste' ? 'ex.: -2 ou 5' : 'ex.: 10'} /></Field>
          </div>
          <Field label="Observação"><Input value={mv.note} onChange={e => setMv({ ...mv, note: e.target.value })} placeholder="Nota fiscal, fornecedor…" /></Field>
          <div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => setStock(null)}>Cancelar</Btn><Btn onClick={move}>Confirmar</Btn></div>
        </div>
      </Modal>
    </div>
  )
}
