'use client'

import { useMemo, useState } from 'react'
import { Printer, Syringe } from 'lucide-react'
import type { PatientFull } from '@/lib/crmApi'
import { Badge, Btn, SPECIES, ageFrom, fmtDate, fmtDay, relDays, ymd } from '@/components/crm/ui'
import { EmptyState, PrintDoc, Letterhead } from '@/components/crm/kit'
import { MotionItem, MotionList } from '@/components/crm/motion'
import { useCrm } from '@/components/crm/CrmShell'
import { toDate } from '@/components/crm/ui'

type Row = { key: string; name: string; given: string; givenFmt: string; lot: string | null; next: string | null; fromApp: boolean; who: string | null; latest: boolean }

function NextBadge({ next }: { next: string }) {
  const today = ymd(new Date())
  const d = next.slice(0, 10)
  if (d < today) return <Badge tone="bad">Atrasada</Badge>
  const rel = relDays(d)
  return <Badge tone={rel === 'hoje' || rel === 'amanhã' ? 'warn' : 'info'}>{rel === 'hoje' ? 'Hoje' : rel === 'amanhã' ? 'Amanhã' : rel.replace(/^em/, 'Em')}</Badge>
}

/** Vacinas da clínica e as registradas pelo tutor no app, com carteirinha para imprimir. */
export function VaccinesPanel({ p, onNew }: { p: PatientFull; onNew?: () => void }) {
  const { me } = useCrm()
  const [print, setPrint] = useState(false)

  const rows = useMemo<Row[]>(() => {
    const r: Row[] = []
    p.records.filter(x => x.kind === 'vacina' && !x.voided_at).forEach(x => r.push({
      key: `c${x.id}`, name: x.vaccine_name || x.title, given: ymd(toDate(x.performed_at)), givenFmt: fmtDate(x.performed_at),
      lot: x.vaccine_lot, next: x.next_due, fromApp: false, who: x.staff_name, latest: false,
    }))
    p.app_vaccines.forEach((v, i) => r.push({
      key: `a${i}`, name: v.name, given: (v.date_given || '').slice(0, 10), givenFmt: fmtDay(v.date_given),
      lot: null, next: v.next_due, fromApp: true, who: v.veterinarian, latest: false,
    }))
    r.sort((a, b) => (a.given < b.given ? 1 : a.given > b.given ? -1 : 0))
    const seen = new Set<string>()
    r.forEach(x => {
      const k = x.name.trim().toLowerCase()
      if (!seen.has(k)) { seen.add(k); x.latest = true }
    })
    return r
  }, [p.records, p.app_vaccines])

  if (!rows.length) {
    return <EmptyState icon={Syringe} title="Nenhuma vacina registrada" hint="Lance as vacinas aplicadas, mesmo as antigas, para gerar os lembretes."
      action={onNew ? <Btn icon={Syringe} onClick={onNew}>Registrar vacina</Btn> : undefined} />
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs text-muted">{rows.length} {rows.length === 1 ? 'dose' : 'doses'}</p>
        <Btn size="sm" variant="outline" icon={Printer} onClick={() => setPrint(true)}>Carteirinha</Btn>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {['Vacina', 'Aplicada em', 'Lote', 'Próxima dose'].map(h => (
                <th key={h} scope="col" className="h-9 px-3 first:pl-1 text-2xs font-semibold uppercase tracking-wider text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className="h-11 border-b border-line last:border-0">
                <td className="px-3 pl-1 py-1.5">
                  <span className="font-medium text-ink">{r.name}</span>
                  {r.fromApp && <span className="block text-2xs text-muted">Registrada pelo tutor no app</span>}
                </td>
                <td className="px-3 tabular-nums text-ink">{r.givenFmt}</td>
                <td className="px-3 text-muted">{r.lot || '—'}</td>
                <td className="px-3">
                  {r.next ? <span className="inline-flex items-center gap-2 tabular-nums text-ink">{fmtDay(r.next)}{r.latest && <NextBadge next={r.next} />}</span> : <span className="text-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MotionList as="ul" className="md:hidden divide-y divide-line">
        {rows.map((r, i) => (
          <MotionItem as="li" key={r.key} index={i} className="py-2.5 min-h-14">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{r.name}</p>
                <p className="text-xs text-muted tabular-nums">Aplicada em {r.givenFmt}{r.lot ? ` · lote ${r.lot}` : ''}</p>
                {r.fromApp && <p className="text-2xs text-muted">Registrada pelo tutor no app</p>}
              </div>
              {r.next && r.latest && <NextBadge next={r.next} />}
            </div>
            {r.next && <p className="text-xs text-muted tabular-nums mt-0.5">Próxima dose: {fmtDay(r.next)}</p>}
          </MotionItem>
        ))}
      </MotionList>

      <PrintDoc open={print} onClose={() => setPrint(false)} title="Carteira de vacinação">
        <section className="text-black">
          <Letterhead clinic={me.clinic} />
          <h2 className="text-base font-bold uppercase tracking-wide mb-3">Carteira de vacinação</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[13px] mb-5">
            <p><strong>Animal:</strong> {p.name}</p>
            <p><strong>Espécie:</strong> {SPECIES[p.species] ?? p.species}{p.breed ? ` · ${p.breed}` : ''}</p>
            <p><strong>Tutor(a):</strong> {p.client?.name ?? '—'}</p>
            <p><strong>Idade:</strong> {ageFrom(p.birth_date) || 'Não informada'}</p>
            {p.microchip && <p><strong>Microchip:</strong> {p.microchip}</p>}
          </div>
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                {['Vacina', 'Aplicada em', 'Lote', 'Próxima dose', 'Responsável'].map(h => (
                  <th key={h} className="border border-black/60 px-2 py-1 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key}>
                  <td className="border border-black/60 px-2 py-1">{r.name}</td>
                  <td className="border border-black/60 px-2 py-1 tabular-nums">{r.givenFmt}</td>
                  <td className="border border-black/60 px-2 py-1">{r.lot || ''}</td>
                  <td className="border border-black/60 px-2 py-1 tabular-nums">{r.next ? fmtDay(r.next) : ''}</td>
                  <td className="border border-black/60 px-2 py-1">{r.fromApp ? `Tutor (app)${r.who ? ` · ${r.who}` : ''}` : r.who || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] mt-4">Emitida em {new Date().toLocaleDateString('pt-BR')}.</p>
        </section>
      </PrintDoc>
    </div>
  )
}
