'use client'

import { crm, type Sale } from '@/lib/crmApi'
import { useCrm } from '@/components/crm/CrmShell'
import { brl, fmtDateTime, fmtDay, PAY } from '@/components/crm/ui'
import { ErrorState, PrintDoc, Letterhead, SkeletonCard, useAsync } from '@/components/crm/kit'
import { qtyText } from './shared'

/** Recibo de venda (sem valor fiscal). Recebe a venda pronta ou o número dela. */
export function ReceiptDoc({ saleId, initial, onClose }: { saleId: number | null; initial?: Sale | null; onClose: () => void }) {
  const { me } = useCrm()
  const ready = initial && initial.id === saleId && initial.items ? initial : null
  const st = useAsync(() => (saleId && !ready ? crm.sale(saleId) : Promise.resolve(null)), [saleId, !!ready])
  const sale = ready ?? (st.data && st.data.id === saleId ? st.data : null)

  return (
    <PrintDoc open={saleId != null} onClose={onClose} title={saleId ? `Recibo da venda nº ${saleId}` : 'Recibo'}>
      {!sale && st.error ? (
        <ErrorState message={st.error} onRetry={st.reload} compact />
      ) : !sale ? (
        <SkeletonCard lines={6} />
      ) : (
        <div className="text-[13px] leading-relaxed">
          <Letterhead clinic={me.clinic} />
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 className="text-base font-bold">Recibo nº {sale.id}</h2>
            <p className="tabular-nums">{fmtDateTime(sale.paid_at ?? sale.created_at)}</p>
          </div>

          <table className="w-full mb-4">
            <tbody>
              <tr><td className="py-0.5 pr-4 font-semibold w-28">Cliente</td><td className="py-0.5">{sale.client_name ?? 'Consumidor'}</td></tr>
              {sale.patient_name && <tr><td className="py-0.5 pr-4 font-semibold">Pet</td><td className="py-0.5">{sale.patient_name}</td></tr>}
              {sale.user_name && <tr><td className="py-0.5 pr-4 font-semibold">Atendente</td><td className="py-0.5">{sale.user_name}</td></tr>}
            </tbody>
          </table>

          <table className="w-full border-collapse mb-4">
            <thead>
              <tr className="border-b-2 border-black/70 text-left">
                <th className="py-1.5 pr-2">Descrição</th>
                <th className="py-1.5 px-2 text-right w-16">Qtd.</th>
                <th className="py-1.5 px-2 text-right w-24">Unitário</th>
                <th className="py-1.5 pl-2 text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {(sale.items ?? []).map(it => (
                <tr key={it.id} className="border-b border-black/15 align-top">
                  <td className="py-1.5 pr-2">
                    {it.description}
                    {it.staff_name && <span className="block text-xs">Profissional: {it.staff_name}</span>}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{qtyText(it.qty)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{brl(it.unit_price)}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{brl(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto w-full max-w-[260px] space-y-0.5 mb-4">
            <p className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{brl(sale.subtotal)}</span></p>
            {sale.discount > 0 && <p className="flex justify-between"><span>Desconto</span><span className="tabular-nums">−{brl(sale.discount)}</span></p>}
            <p className="flex justify-between text-base font-bold border-t border-black/70 pt-1"><span>Total</span><span className="tabular-nums">{brl(sale.total)}</span></p>
          </div>

          <p className="mb-1">
            <span className="font-semibold">Forma de pagamento: </span>
            {sale.status === 'aberta'
              ? `A receber${sale.due_date ? `, vencimento em ${fmtDay(sale.due_date)}` : ''}`
              : PAY[sale.payment_method ?? ''] ?? '—'}
          </p>
          {sale.status === 'cancelada' && <p className="font-bold mb-1">Venda cancelada.</p>}
          {sale.notes && <p className="mb-1 whitespace-pre-wrap">{sale.notes}</p>}

          <p className="mt-8 text-xs text-center">Recibo sem valor fiscal.</p>
        </div>
      )}
    </PrintDoc>
  )
}
