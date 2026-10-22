'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BellOff, Check, MessageCircle, Smartphone } from 'lucide-react'
import { crm, type Reminder } from '@/lib/crmApi'
import { RECORD_META, Badge, Btn, Card, fmtDay, fmtPhone, relDays, toDate, waLink } from '@/components/crm/ui'
import { Chip, DataList, EmptyState, PetAvatar, useAsync, type Column } from '@/components/crm/kit'
import { useToast } from '@/components/ui/ToastContext'
import { useCrmChange } from '@/components/crm/CrmShell'
import { ddmm, errMsg, firstName, openWa } from './shared'

type Filter = 'atrasadas' | 'semana' | 'mes' | 'avisados' | 'todos'

const FILTERS: Array<{ value: Filter; label: string; test: (r: Reminder) => boolean }> = [
  { value: 'todos', label: 'Todos', test: () => true },
  { value: 'atrasadas', label: 'Atrasadas', test: r => r.days_left < 0 },
  { value: 'semana', label: 'Próximos 7 dias', test: r => r.days_left >= 0 && r.days_left <= 7 },
  { value: 'mes', label: 'Próximos 30 dias', test: r => r.days_left >= 0 && r.days_left <= 30 },
  { value: 'avisados', label: 'Já avisados', test: r => !!r.reminded_at },
]

function whatOf(r: Reminder) {
  return r.kind === 'vacina' ? `a vacina ${r.what}` : r.what
}
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export function RemindersTab({ clinicName }: { clinicName: string }) {
  const router = useRouter()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('todos')
  const q = useAsync(() => crm.reminders(60), [])
  useCrmChange(['record', 'patient'], q.reload)
  const dataRef = useRef(q.data)
  dataRef.current = q.data

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { todos: 0, atrasadas: 0, semana: 0, mes: 0, avisados: 0 }
    for (const r of q.data ?? []) for (const f of FILTERS) if (f.test(r)) c[f.value]++
    return c
  }, [q.data])

  const rows = useMemo(() => {
    if (!q.data) return null
    const t = FILTERS.find(f => f.value === filter)!.test
    return q.data.filter(t).sort((a, b) => a.days_left - b.days_left)
  }, [q.data, filter])

  const setReminded = (id: number, at: string | null) =>
    q.setData((dataRef.current ?? []).map(x => (x.record_id === id ? { ...x, reminded_at: at } : x)))

  function notify(r: Reminder) {
    const overdue = r.days_left < 0
    const text = `Olá, ${firstName(r.client_name)}! Aqui é da ${clinicName}. ${cap(whatOf(r))} de ${r.patient_name} ${overdue ? 'venceu em' : 'vence em'} ${fmtDay(r.next_due)}. Quer agendar?`
    const url = waLink(r.client_phone, text)
    if (!url) { toast.error('Este cliente não tem celular cadastrado.'); return }
    openWa(url)
    const before = r.reminded_at
    setReminded(r.record_id, new Date().toISOString())
    crm.markReminded(r.record_id).catch(e => {
      setReminded(r.record_id, before)
      toast.error(errMsg(e, 'Não foi possível marcar como avisado.'))
    })
  }

  const dueBadge = (r: Reminder) =>
    r.days_left < 0 ? <Badge tone="bad">Atrasada</Badge>
    : r.days_left === 0 ? <Badge tone="warn">Vence hoje</Badge>
    : <Badge tone={r.days_left <= 7 ? 'warn' : 'default'}>Em {r.days_left} {r.days_left === 1 ? 'dia' : 'dias'}</Badge>

  const extraBadges = (r: Reminder) => (
    <>
      {r.in_app && <Badge tone="brand"><Smartphone className="w-3 h-3" strokeWidth={1.75} aria-hidden />Recebe no app</Badge>}
      {r.reminded_at && <Badge tone="good"><Check className="w-3 h-3" strokeWidth={2} aria-hidden />Avisado em {ddmm(toDate(r.reminded_at))}</Badge>}
    </>
  )

  const waBtn = (r: Reminder) => (
    <Btn size="sm" variant={r.reminded_at ? 'ghost' : 'soft'} icon={MessageCircle} disabled={!r.client_phone}
      title={r.client_phone ? 'Avisar no WhatsApp' : 'Sem celular cadastrado'}
      onClick={e => { e.stopPropagation(); notify(r) }}>
      {r.client_phone ? (r.reminded_at ? 'Avisar de novo' : 'WhatsApp') : 'Sem celular'}
    </Btn>
  )

  const whatCell = (r: Reminder) => {
    const m = RECORD_META[r.kind] ?? RECORD_META.observacao
    return (
      <span className="inline-flex items-center gap-2 min-w-0">
        <span className={`h-6 w-6 shrink-0 rounded-full inline-flex items-center justify-center ${m.cls}`}>
          <m.Icon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="truncate">{r.what}</span>
      </span>
    )
  }

  const columns: Column<Reminder>[] = [
    {
      key: 'pet', header: 'Pet', cell: r => (
        <span className="inline-flex items-center gap-2.5 min-w-0">
          <PetAvatar name={r.patient_name} size="sm" />
          <span className="font-semibold truncate">{r.patient_name}</span>
        </span>
      ),
    },
    {
      key: 'tutor', header: 'Tutor', cell: r => (
        <span className="block min-w-0">
          <Link href={`/clinica/clientes/${r.client_id}`} onClick={e => e.stopPropagation()} className="block truncate hover:underline">{r.client_name}</Link>
          {r.client_phone && <span className="block text-xs text-muted tabular-nums">{fmtPhone(r.client_phone)}</span>}
        </span>
      ),
    },
    { key: 'what', header: 'O quê', cell: whatCell },
    {
      key: 'due', header: 'Próxima data', cell: r => (
        <span className="block tabular-nums">
          {fmtDay(r.next_due)}
          <span className="block text-xs text-muted">{relDays(r.next_due)}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Situação', hideBelow: 'lg', cell: r => <span className="flex flex-wrap gap-1">{dueBadge(r)}{extraBadges(r)}</span> },
    { key: 'wa', header: 'Avisar', align: 'right', cell: waBtn },
  ]

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto crm-scroll-x -mx-4 px-4 md:mx-0 md:px-0 pb-1 mb-3" role="group" aria-label="Filtrar lembretes">
        {FILTERS.map(f => (
          <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)} count={q.data ? counts[f.value] : undefined}>{f.label}</Chip>
        ))}
      </div>
      <Card>
        <DataList
          ariaLabel="Lembretes de vacinas e retornos"
          rows={rows}
          loading={q.loading}
          error={q.error}
          onRetry={q.reload}
          columns={columns}
          rowKey={r => r.record_id}
          onRowClick={r => router.push(`/clinica/pacientes/${r.patient_id}`)}
          renderMobile={r => (
            <div className="flex items-start gap-3">
              <PetAvatar name={r.patient_name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">{r.patient_name} <span className="font-normal text-muted">· {r.what}</span></p>
                <p className="text-xs text-muted truncate">{r.client_name} · <span className="tabular-nums">{fmtDay(r.next_due)}</span> ({relDays(r.next_due)})</p>
                <div className="flex flex-wrap gap-1 mt-1.5">{dueBadge(r)}{extraBadges(r)}</div>
                <div className="mt-2">{waBtn(r)}</div>
              </div>
            </div>
          )}
          empty={
            <EmptyState icon={BellOff} compact
              title={filter === 'todos' ? 'Nenhuma vacina ou retorno para avisar' : 'Nada neste filtro'}
              hint={filter === 'todos' ? 'Ao registrar uma vacina ou retorno com próxima data, ele aparece aqui na hora de avisar.' : 'Escolha outro filtro para ver os demais lembretes.'} />
          }
        />
      </Card>
    </div>
  )
}
