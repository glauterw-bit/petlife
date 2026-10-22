'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart3, MessageCircle, Percent, Receipt, UserX, Wallet } from 'lucide-react'
import { crm } from '@/lib/crmApi'
import { can, useCrm, useCrmChange } from '@/components/crm/CrmShell'
import { Badge, Field, Input, Kpi, PageHead, PAY, brl, catLabel, fmtDate, fmtPhone, waLink, ymd } from '@/components/crm/ui'
import { EmptyState, ErrorState, HBars, Segmented, SkeletonCard, SkeletonKpis, useAsync } from '@/components/crm/kit'
import { AdminOnly, CsvButton, ReportTable, Section } from '@/components/crm/financeiro/shared'
import { downloadCsv } from '@/components/crm/financeiro/csv'

type Period = 'mes' | 'mes_passado' | '90d' | 'custom'
const KIND: Record<string, string> = { service: 'Serviço', product: 'Produto', avulso: 'Avulso' }
const qty = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function dayFromInput(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

function rangeOf(p: Period, from: string, to: string): [Date, Date] | null {
  const t = new Date()
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  if (p === 'mes') return [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 1)]
  if (p === 'mes_passado') return [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 1)]
  if (p === '90d') return [new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89), tomorrow]
  const a = dayFromInput(from), b = dayFromInput(to)
  if (!a || !b || b < a) return null
  return [a, new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1)]
}

export default function RelatoriosPage() {
  const { me } = useCrm()
  if (!can(me.user.role)) {
    return (
      <div>
        <PageHead title="Relatórios" />
        <AdminOnly />
      </div>
    )
  }
  return <Relatorios />
}

function Relatorios() {
  const { me } = useCrm()
  const now = new Date()
  const [period, setPeriod] = useState<Period>('mes')
  const [from, setFrom] = useState(() => ymd(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(() => ymd(now))
  const range = useMemo(() => rangeOf(period, from, to), [period, from, to])
  const key = range ? `${range[0].getTime()}-${range[1].getTime()}` : 'x'
  const sum = useAsync(() => (range ? crm.reportSummary(range[0], range[1]) : Promise.reject(new Error('Escolha um período válido.'))), [key])
  const com = useAsync(() => (range ? crm.commissionReport(range[0], range[1]) : Promise.resolve([])), [key])
  useCrmChange(['sale'], () => { sum.reload(); com.reload() })

  const tag = range ? `${ymd(range[0])}_a_${ymd(new Date(range[1].getTime() - 86400000))}` : 'periodo'
  const s = sum.data
  const rows = com.data ?? []

  return (
    <div>
      <PageHead title="Relatórios" sub="Números reais das vendas e dos atendimentos do período." />

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-5">
        <Segmented<Period> id="rel-periodo" ariaLabel="Período" value={period} onChange={setPeriod}
          options={[
            { value: 'mes', label: 'Este mês' },
            { value: 'mes_passado', label: 'Mês passado' },
            { value: '90d', label: 'Últimos 90 dias' },
            { value: 'custom', label: 'Personalizado' },
          ]} />
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2 sm:w-[320px]">
            <Field label="De"><Input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></Field>
            <Field label="Até"><Input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></Field>
          </div>
        )}
      </div>

      {!range ? (
        <Section title="Período"><EmptyState icon={BarChart3} title="Escolha um período válido" hint="A data final precisa ser igual ou depois da inicial." /></Section>
      ) : !s && sum.error ? (
        <ErrorState message={sum.error} onRetry={sum.reload} />
      ) : !s ? (
        <div className="space-y-4"><SkeletonKpis count={4} /><SkeletonCard lines={6} /><SkeletonCard lines={4} /></div>
      ) : (
        <div className="space-y-4" aria-busy={sum.loading || undefined}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Receita" value={s.revenue} format={brl} icon={Wallet} />
            <Kpi label="Vendas" value={s.sales_count} icon={Receipt} />
            <Kpi label="Ticket médio" value={s.avg_ticket} format={brl} />
            <Kpi label="Taxa de falta" value={s.appointments.no_show_rate * 100} format={n => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
              tone={s.appointments.no_show_rate > 0.15 ? 'bad' : 'default'} icon={Percent}
              sub={`${s.appointments.no_show} ${s.appointments.no_show === 1 ? 'falta' : 'faltas'} de ${s.appointments.done + s.appointments.no_show}`} />
          </div>

          {s.sales_count === 0 ? (
            <Section title="Vendas">
              <EmptyState icon={BarChart3} title="Sem vendas no período" hint="Quando houver vendas pagas, os relatórios aparecem aqui." />
            </Section>
          ) : (
            <>
              <Section title="Serviços e produtos" sub="Os 20 itens que mais faturaram."
                actions={<CsvButton onClick={() => downloadCsv(`servicos-e-produtos_${tag}`, ['Item', 'Tipo', 'Quantidade', 'Total (R$)'],
                  s.by_item.map(i => [i.name, KIND[i.kind] ?? i.kind, i.qty, i.total]))} />}>
                <ReportTable head={['Item', 'Tipo', 'Qtd.', 'Total']} align={['left', 'left', 'right', 'right']}
                  rows={s.by_item.map(i => [<span key="n" className="font-medium">{i.name}</span>, <span key="k" className="text-muted">{KIND[i.kind] ?? i.kind}</span>, qty(i.qty), brl(i.total)])} />
              </Section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title="Por categoria"
                  actions={<CsvButton onClick={() => downloadCsv(`por-categoria_${tag}`, ['Categoria', 'Total (R$)'], s.by_category.map(c => [catLabel(c.category), c.total]))} />}>
                  <HBars format={brl} data={s.by_category.map(c => ({ label: catLabel(c.category), value: c.total }))} />
                </Section>
                <Section title="Por forma de pagamento"
                  actions={<CsvButton onClick={() => downloadCsv(`por-pagamento_${tag}`, ['Forma', 'Vendas', 'Total (R$)'], s.by_method.map(m => [PAY[m.method] ?? m.method, m.count, m.total]))} />}>
                  <HBars format={brl} data={s.by_method.map(m => ({ label: PAY[m.method] ?? m.method, value: m.total, sub: `${m.count} ${m.count === 1 ? 'venda' : 'vendas'}` }))} />
                </Section>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title="Por profissional" sub="Pelo profissional de cada item da venda."
                  actions={<CsvButton onClick={() => downloadCsv(`por-profissional_${tag}`, ['Profissional', 'Itens', 'Total (R$)'], s.by_staff.map(r => [r.name, r.count, r.total]))} />}>
                  <ReportTable head={['Profissional', 'Itens', 'Total']} align={['left', 'right', 'right']}
                    rows={s.by_staff.map(r => [<span key="n" className={r.user_id ? 'font-medium' : 'text-muted'}>{r.name}</span>, r.count, brl(r.total)])} />
                </Section>
                <Section title="Produtos mais vendidos"
                  actions={<CsvButton disabled={!s.top_products.length} onClick={() => downloadCsv(`produtos-mais-vendidos_${tag}`, ['Produto', 'Quantidade', 'Total (R$)'], s.top_products.map(p => [p.name, p.qty, p.total]))} />}>
                  {s.top_products.length === 0 ? <EmptyState icon={Receipt} compact title="Nenhum produto vendido no período" />
                    : <ReportTable head={['Produto', 'Qtd.', 'Total']} align={['left', 'right', 'right']}
                        rows={s.top_products.map(p => [<span key="n" className="font-medium">{p.name}</span>, qty(p.qty), brl(p.total)])} />}
                </Section>
              </div>
            </>
          )}

          <Section title="Comissões" sub="Calculadas sobre os itens pagos com profissional definido."
            actions={<>
              <Link href="/clinica/equipe#comissoes" className="text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline px-1">Definir percentuais</Link>
              <CsvButton disabled={!rows.length} onClick={() => downloadCsv(`comissoes_${tag}`, ['Profissional', 'Itens', 'Serviços (R$)', 'Produtos (R$)', 'Base (R$)', 'Comissão (R$)'],
                rows.map(r => [r.name, r.items_count, r.services_total, r.products_total, r.base_total, r.commission]))} />
            </>}>
            {!com.data && com.error ? <ErrorState compact message={com.error} onRetry={com.reload} />
              : !com.data ? <SkeletonCard lines={3} />
              : rows.length === 0 ? <EmptyState icon={Percent} compact title="Sem comissões no período" hint="Escolha o profissional nos itens da venda e defina os percentuais na equipe." />
              : <ReportTable head={['Profissional', 'Itens', 'Serviços', 'Produtos', 'Base', 'Comissão']} align={['left', 'right', 'right', 'right', 'right', 'right']}
                  rows={rows.map(r => [<span key="n" className="font-medium">{r.name}</span>, r.items_count, brl(r.services_total), brl(r.products_total), brl(r.base_total), <b key="c">{brl(r.commission)}</b>])}
                  footer={['Total', rows.reduce((a, r) => a + r.items_count, 0), brl(rows.reduce((a, r) => a + r.services_total, 0)), brl(rows.reduce((a, r) => a + r.products_total, 0)), brl(rows.reduce((a, r) => a + r.base_total, 0)), brl(rows.reduce((a, r) => a + r.commission, 0))]} />}
          </Section>

          <Section title="Clientes sumidos" sub="Sem visita há 90 dias ou mais, contando até o fim do período."
            actions={<>
              {s.lapsed_clients.count > 0 && <Badge tone="warn">{s.lapsed_clients.count}</Badge>}
              <CsvButton disabled={!s.lapsed_clients.items.length} onClick={() => downloadCsv(`clientes-sumidos_${tag}`, ['Cliente', 'Último atendimento', 'Telefone'],
                s.lapsed_clients.items.map(c => [c.name, fmtDate(c.last_visit), fmtPhone(c.phone)]))} />
            </>}>
            {s.lapsed_clients.items.length === 0 ? <EmptyState icon={UserX} compact title="Nenhum cliente sumido" hint="Todos os clientes com visita voltaram nos últimos 90 dias." />
              : (
                <>
                  <ReportTable head={['Cliente', 'Último atendimento', 'Telefone', '']} align={['left', 'left', 'left', 'right']}
                    rows={s.lapsed_clients.items.map(c => {
                      const wa = waLink(c.phone, `Olá, ${c.name}! Sentimos sua falta na ${me.clinic.name}. Quer agendar um horário para o seu pet?`)
                      return [
                        <Link key="n" href={`/clinica/clientes/${c.client_id}`} className="font-medium hover:underline">{c.name}</Link>,
                        <span key="d" className="tabular-nums text-muted">{fmtDate(c.last_visit)}</span>,
                        <span key="p" className="tabular-nums text-muted">{fmtPhone(c.phone) || '—'}</span>,
                        wa ? (
                          <a key="w" href={wa} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25">
                            <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />WhatsApp
                          </a>
                        ) : <span key="w" />,
                      ]
                    })} />
                  {s.lapsed_clients.count > s.lapsed_clients.items.length && (
                    <p className="text-xs text-muted mt-3">Mostrando os {s.lapsed_clients.items.length} há mais tempo sem visita, de {s.lapsed_clients.count}.</p>
                  )}
                </>
              )}
          </Section>

          <p className="text-2xs text-muted">Atendimentos no período: {s.appointments.total} · concluídos {s.appointments.done} · faltas {s.appointments.no_show} ({pct(s.appointments.no_show_rate)}) · cancelados {s.appointments.cancelled}.</p>
        </div>
      )}
    </div>
  )
}
