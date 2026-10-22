'use client'

import type { ReactNode } from 'react'
import { Download, Lock } from 'lucide-react'
import { Btn, Card } from '@/components/crm/ui'
import { EmptyState, Skeleton } from '@/components/crm/kit'

/** Bloqueio das telas que só o administrador vê. */
export function AdminOnly() {
  return (
    <Card>
      <EmptyState icon={Lock} title="Área do administrador" hint="Peça a quem administra a clínica para liberar o seu acesso, se precisar destas informações." />
    </Card>
  )
}

/** Card com título de seção, ações à direita e conteúdo. */
export function Section({ title, sub, actions, children, className = '', id }: {
  title: string; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string
}) {
  return (
    <Card className={className}>
      <section id={id} aria-label={title}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-ink leading-tight">{title}</h2>
            {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </div>
        {children}
      </section>
    </Card>
  )
}

export function CsvButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return <Btn variant="ghost" size="sm" icon={Download} onClick={onClick} disabled={disabled}>Exportar CSV</Btn>
}

/** Esqueleto de gráfico de barras, sem texto de "carregando". */
export function ChartSkeleton({ height = 160 }: { height?: number }) {
  const hs = [40, 65, 30, 80, 55, 70, 45, 90, 35, 60, 75, 50, 85, 40, 65, 55]
  return (
    <div role="status" aria-label="Carregando" className="flex items-end gap-1" style={{ height }}>
      {hs.map((h, i) => <div key={i} className="flex-1" style={{ height: `${h}%` }}><Skeleton className="h-full rounded-b-none" /></div>)}
    </div>
  )
}

/** Tabela simples e responsiva para relatórios (rola na horizontal no celular). */
export function ReportTable({ head, rows, align, footer }: {
  head: string[]; rows: ReactNode[][]; align?: Array<'left' | 'right'>; footer?: ReactNode[]
}) {
  return (
    <div className="-mx-4 lg:-mx-5 overflow-x-auto crm-scroll-x">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`h-9 px-4 lg:px-5 text-2xs font-semibold uppercase tracking-wider text-muted whitespace-nowrap ${align?.[i] === 'right' ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="h-11 border-b border-line last:border-b-0 hover:bg-panel-2/60 transition-colors">
              {r.map((c, ci) => (
                <td key={ci} className={`px-4 lg:px-5 py-1.5 text-ink ${align?.[ci] === 'right' ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-line">
              {footer.map((c, ci) => (
                <td key={ci} className={`h-10 px-4 lg:px-5 font-semibold text-ink ${align?.[ci] === 'right' ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>{c}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
