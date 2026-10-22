'use client'

import type { CashSession } from '@/lib/crmApi'
import { useCrm } from '@/components/crm/CrmShell'
import { brl, fmtDateTime, fmtTime } from '@/components/crm/ui'
import { PrintDoc, Letterhead, SignatureLine } from '@/components/crm/kit'
import { CASH_METHODS, PAY_SHORT, diffLabel } from './shared'

/** Relatório de fechamento de caixa, pronto para imprimir. */
export function CashReportDoc({ session, onClose }: { session: CashSession | null; onClose: () => void }) {
  const { me } = useCrm()
  const s = session
  const rows = s
    ? CASH_METHODS.map(m => ({
        m,
        expected: s.expected?.[m] ?? 0,
        counted: s.counted ? s.counted[m] ?? 0 : null,
        diff: s.difference ? s.difference[m] ?? 0 : null,
      }))
    : []
  const totExpected = rows.reduce((a, r) => a + r.expected, 0)
  const totCounted = s?.counted ? rows.reduce((a, r) => a + (r.counted ?? 0), 0) : null

  return (
    <PrintDoc open={!!s} onClose={onClose} title={s ? `Fechamento de caixa nº ${s.id}` : 'Fechamento de caixa'}>
      {s && (
        <div className="text-[13px] leading-relaxed">
          <Letterhead clinic={me.clinic} />
          <h2 className="text-base font-bold mb-3">Fechamento de caixa nº {s.id}</h2>

          <table className="w-full mb-5">
            <tbody>
              <tr>
                <td className="py-0.5 pr-4 font-semibold w-40">Abertura</td>
                <td className="py-0.5">{fmtDateTime(s.opened_at)}{s.opened_by_name ? ` · ${s.opened_by_name}` : ''}</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-4 font-semibold">Fechamento</td>
                <td className="py-0.5">{s.closed_at ? `${fmtDateTime(s.closed_at)}${s.closed_by_name ? ` · ${s.closed_by_name}` : ''}` : 'Caixa ainda aberto'}</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-4 font-semibold">Valor inicial</td>
                <td className="py-0.5 tabular-nums">{brl(s.opening_amount)}</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-4 font-semibold">Vendas pagas</td>
                <td className="py-0.5 tabular-nums">{s.sales_count}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border-collapse mb-5">
            <thead>
              <tr className="border-b-2 border-black/70 text-left">
                <th className="py-1.5 pr-2">Forma</th>
                <th className="py-1.5 px-2 text-right">Vendas</th>
                <th className="py-1.5 px-2 text-right">Esperado</th>
                <th className="py-1.5 px-2 text-right">Contado</th>
                <th className="py-1.5 pl-2 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.m} className="border-b border-black/15">
                  <td className="py-1.5 pr-2">{PAY_SHORT[r.m]}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{brl(s.totals_by_method?.[r.m] ?? 0)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{brl(r.expected)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.counted == null ? '—' : brl(r.counted)}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{r.diff == null ? '—' : `${brl(r.diff)} (${diffLabel(r.diff).toLowerCase()})`}</td>
                </tr>
              ))}
              <tr className="font-bold border-t-2 border-black/70">
                <td className="py-1.5 pr-2">Total</td>
                <td className="py-1.5 px-2" />
                <td className="py-1.5 px-2 text-right tabular-nums">{brl(totExpected)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{totCounted == null ? '—' : brl(totCounted)}</td>
                <td className="py-1.5 pl-2 text-right tabular-nums">{s.difference_total == null ? '—' : brl(s.difference_total)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs mb-5">
            Dinheiro esperado = valor inicial + vendas em dinheiro + reforços − sangrias.
          </p>

          <h3 className="font-bold mb-1.5">Sangrias e reforços</h3>
          {s.moves.length === 0 ? (
            <p className="mb-5">Nenhuma movimentação.</p>
          ) : (
            <table className="w-full border-collapse mb-2">
              <tbody>
                {s.moves.map(m => (
                  <tr key={m.id} className="border-b border-black/15">
                    <td className="py-1 pr-2 tabular-nums w-14">{fmtTime(m.created_at)}</td>
                    <td className="py-1 px-2 w-24">{m.kind === 'sangria' ? 'Sangria' : 'Reforço'}</td>
                    <td className="py-1 px-2">{[m.note, m.user_name].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="py-1 pl-2 text-right tabular-nums">{m.kind === 'sangria' ? '−' : '+'}{brl(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {s.moves.length > 0 && (
            <p className="mb-5 tabular-nums">Total de sangrias: {brl(s.sangrias)} · Total de reforços: {brl(s.reforcos)}</p>
          )}

          {s.notes && (
            <>
              <h3 className="font-bold mb-1">Observação</h3>
              <p className="mb-5 whitespace-pre-wrap">{s.notes}</p>
            </>
          )}

          <SignatureLine label={s.closed_by_name || 'Responsável pelo caixa'} sub="Responsável pelo fechamento" />
        </div>
      )}
    </PrintDoc>
  )
}
