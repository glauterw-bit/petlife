'use client'

import { useEffect, useState } from 'react'
import { crm, type Item } from '@/lib/crmApi'
import { Btn, Field, Input, parseDecimal } from '@/components/crm/ui'
import { DecimalInput, Segmented, Sheet } from '@/components/crm/kit'
import { useToast } from '@/components/ui/ToastContext'
import { errMsg, qtyText } from './shared'

type Reason = 'entrada' | 'perda' | 'ajuste' | 'devolucao'
const HINT: Record<Reason, string> = {
  entrada: 'Compra ou recebimento de mercadoria. Soma ao estoque.',
  perda: 'Vencido, quebrado ou extraviado. Sai do estoque.',
  ajuste: 'Correção após contagem. Use + para somar e − para tirar (ex.: -2).',
  devolucao: 'Cliente devolveu o produto. Volta ao estoque.',
}

/** Movimentação manual de estoque de um produto. */
export function StockSheet({ item, onClose, onDone }: { item: Item | null; onClose: () => void; onDone: (i: Item) => void }) {
  const { error, success } = useToast()
  const [reason, setReason] = useState<Reason>('entrada')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (item) { setReason('entrada'); setQty(''); setNote('') } }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const n = parseDecimal(qty)
  const delta = n == null ? null : reason === 'perda' ? -Math.abs(n) : reason === 'ajuste' ? n : Math.abs(n)
  const after = item && delta != null ? Math.round(((item.stock_qty ?? 0) + delta) * 1000) / 1000 : null

  async function submit() {
    if (!item || busy) return
    if (n == null || n === 0) { error('Informe a quantidade.'); return }
    if (reason !== 'ajuste' && n < 0) { error('Informe a quantidade sem sinal.'); return }
    setBusy(true)
    try {
      const it = await crm.moveStock(item.id, { qty: reason === 'perda' ? Math.abs(n) : n, reason, note: note.trim() || undefined })
      success(`Estoque de ${item.name}: ${qtyText(it.stock_qty ?? 0)} ${it.unit ?? 'un'}.`)
      onDone(it)
    } catch (e) {
      error(errMsg(e, 'Não foi possível movimentar o estoque.'))
    } finally {
      setBusy(false)
    }
  }

  const unit = item?.unit ?? 'un'
  return (
    <Sheet open={!!item} onClose={onClose} onSubmit={submit} title="Movimentar estoque"
      description={item ? `${item.name} · estoque atual ${qtyText(item.stock_qty ?? 0)} ${unit}` : undefined}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn loading={busy} onClick={submit}>Confirmar</Btn>
      </>}>
      <div className="space-y-4">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted mb-2">Motivo</p>
          <Segmented id="stock-reason" ariaLabel="Motivo" value={reason} onChange={v => setReason(v)}
            options={[{ value: 'entrada', label: 'Entrada' }, { value: 'perda', label: 'Perda' }, { value: 'ajuste', label: 'Ajuste' }, { value: 'devolucao', label: 'Devolução' }]} />
          <p className="text-xs text-muted mt-2">{HINT[reason]}</p>
        </div>
        <Field label="Quantidade" hint={after != null ? `Estoque depois: ${qtyText(after)} ${unit}` : undefined}>
          <DecimalInput value={qty} onChange={setQty} allowNegative={reason === 'ajuste'} suffix={unit}
            placeholder={reason === 'ajuste' ? 'ex.: -2 ou 5' : 'ex.: 10'} />
        </Field>
        <Field label="Observação">
          <Input value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="Nota fiscal, fornecedor, motivo da perda" />
        </Field>
      </div>
    </Sheet>
  )
}
