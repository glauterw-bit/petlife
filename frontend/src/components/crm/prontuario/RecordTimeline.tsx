'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Ban, ChevronDown, Lock, MessageSquarePlus, Pencil, Plus, Smartphone, Stethoscope, Trash2 } from 'lucide-react'
import { crm, isCrmError, type RecordEntry } from '@/lib/crmApi'
import { useToast } from '@/components/ui/ToastContext'
import { Btn, RECORD_META, RECORD_KIND, fmtDate, fmtDateTime, fmtDay } from '@/components/crm/ui'
import { Chip, EmptyState, useConfirm } from '@/components/crm/kit'
import { MotionItem, MotionList, dur } from '@/components/crm/motion'
import { emitCrmChange } from '@/components/crm/CrmShell'

const kg = (n: number) => `${String(n).replace('.', ',')} kg`

function Section({ label, text }: { label: string; text: string | null }) {
  if (!text?.trim()) return null
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed mt-0.5">{text}</p>
    </div>
  )
}

function Vitals({ r }: { r: RecordEntry }) {
  const v: Array<[string, string]> = []
  if (r.weight_kg != null) v.push(['Peso', kg(r.weight_kg)])
  if (r.temperature_c != null) v.push(['T', `${String(r.temperature_c).replace('.', ',')} °C`])
  if (r.heart_rate != null) v.push(['FC', `${r.heart_rate} bpm`])
  if (r.resp_rate != null) v.push(['FR', `${r.resp_rate} mpm`])
  if (r.mucosa) v.push(['Mucosas', r.mucosa])
  if (r.hydration) v.push(['Hidratação', r.hydration])
  if (r.body_score != null) v.push(['ECC', `${r.body_score}/9`])
  if (!v.length) return null
  return (
    <dl className="flex flex-wrap gap-1.5">
      {v.map(([k, val]) => (
        <div key={k} className="inline-flex items-baseline gap-1.5 rounded-lg bg-panel-2 px-2 py-1 text-xs">
          <dt className="text-muted">{k}</dt><dd className="font-semibold text-ink tabular-nums">{val}</dd>
        </div>
      ))}
    </dl>
  )
}

function preview(r: RecordEntry): string {
  if (r.kind === 'vacina') return [r.vaccine_name, r.vaccine_lot ? `lote ${r.vaccine_lot}` : null, r.next_due ? `próxima dose ${fmtDay(r.next_due)}` : null].filter(Boolean).join(' · ')
  const t = r.assessment || r.subjective || r.plan || r.body || ''
  return t.split('\n')[0]
}

/** Linha do tempo do prontuário com edição (até 24 h), adendo e anulação. */
export function RecordTimeline({ records, canAct, meId, isAdmin, onEdit, onNew, onChanged }: {
  records: RecordEntry[]
  /** pode lançar registros deste tipo (papel) */
  canAct: (kind: string) => boolean
  meId: number; isAdmin: boolean
  onEdit: (r: RecordEntry) => void; onNew?: () => void
  onChanged: (r: RecordEntry | null, removedId?: number) => void
}) {
  const { success, error } = useToast()
  const { confirm, prompt } = useConfirm()
  const [filter, setFilter] = useState<string>('all')
  const [openId, setOpenId] = useState<number | null>(records[0]?.id ?? null)

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    records.forEach(r => { c[r.kind] = (c[r.kind] ?? 0) + 1 })
    return c
  }, [records])
  const list = filter === 'all' ? records : records.filter(r => r.kind === filter)

  const fail = (e: unknown, f: string) => {
    error(e instanceof Error && e.message ? e.message : f)
    if (isCrmError(e) && e.status === 409) emitCrmChange('record')
  }
  async function addendum(r: RecordEntry) {
    const body = await prompt({ title: 'Adendo', message: 'O adendo fica junto do registro, com seu nome e a data.', label: 'Texto do adendo', multiline: true, confirmLabel: 'Adicionar' })
    if (!body) return
    try { const x = await crm.addAddendum(r.id, body); onChanged(x); success('Adendo adicionado.') } catch (e) { fail(e, 'Não foi possível adicionar o adendo.') }
  }
  async function annul(r: RecordEntry) {
    const reason = await prompt({
      title: 'Anular registro', message: 'O registro continua no prontuário, riscado, com o motivo.' + (r.sent_to_app ? ' A vacina sai da carteirinha do tutor no app.' : ''),
      label: 'Motivo', minLength: 3, tone: 'danger', confirmLabel: 'Anular',
    })
    if (!reason) return
    try { const x = await crm.voidRecord(r.id, reason); onChanged(x); success('Registro anulado.') } catch (e) { fail(e, 'Não foi possível anular.') }
  }
  async function remove(r: RecordEntry) {
    const ok = await confirm({
      title: 'Excluir este registro?', tone: 'danger', confirmLabel: 'Excluir',
      message: r.sent_to_app ? 'A vacina também sai da carteirinha do tutor no app.' : 'Não dá para desfazer.',
    })
    if (!ok) return
    try { await crm.deleteRecord(r.id); onChanged(null, r.id); success('Registro excluído.'); emitCrmChange('record') } catch (e) { fail(e, 'Não foi possível excluir.') }
  }

  if (!records.length) {
    return <EmptyState icon={Stethoscope} title="Nenhum registro ainda" hint="Consultas, vacinas e anotações aparecem aqui em ordem."
      action={onNew ? <Btn icon={Plus} onClick={onNew}>Novo registro</Btn> : undefined} />
  }

  const kinds = Object.keys(counts)
  return (
    <div>
      {kinds.length > 1 && (
        <div className="flex gap-2 overflow-x-auto crm-scroll-x -mx-1 px-1 pb-3" role="group" aria-label="Filtrar por tipo">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')} count={records.length}>Todos</Chip>
          {kinds.map(k => (
            <Chip key={k} active={filter === k} onClick={() => setFilter(k)} count={counts[k]} icon={RECORD_META[k]?.Icon}>{RECORD_KIND[k] ?? k}</Chip>
          ))}
        </div>
      )}
      <MotionList as="ol" className="relative">
        {list.map((r, i) => {
          const meta = RECORD_META[r.kind] ?? RECORD_META.observacao
          const Icon = meta.Icon
          const open = openId === r.id
          const voided = !!r.voided_at
          const mine = r.staff_user_id === meId || isAdmin
          const act = canAct(r.kind)
          const last = i === list.length - 1
          return (
            <MotionItem as="li" key={r.id} index={i} layout className="relative pl-12 pb-3">
              {!last && <span aria-hidden className="absolute left-[19px] top-10 bottom-0 w-px bg-line" />}
              <span aria-hidden className={`absolute left-0 top-1 h-10 w-10 rounded-full inline-flex items-center justify-center ring-4 ring-panel ${voided ? 'bg-panel-2 text-muted' : meta.cls}`}>
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </span>
              <m.div layout transition={{ duration: dur.base }} className={`rounded-xl transition-colors ${open ? 'bg-panel-2/60' : 'hover:bg-panel-2/40'}`}>
                <button type="button" onClick={() => setOpenId(open ? null : r.id)} aria-expanded={open}
                  className="w-full text-left px-3 py-2.5 flex items-start gap-2 rounded-xl">
                  <span className="min-w-0 flex-1">
                    <span className={`flex items-center gap-1.5 text-sm font-semibold ${voided ? 'text-muted line-through' : 'text-ink'}`}>
                      <span className="truncate">{r.title}</span>
                      {r.locked && !voided && <Lock className="w-3.5 h-3.5 shrink-0 text-muted" strokeWidth={1.75} aria-label="Travado" />}
                      {r.sent_to_app && !voided && <Smartphone className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-label="Na carteirinha do tutor" />}
                    </span>
                    <span className="block text-xs text-muted tabular-nums truncate">
                      {RECORD_KIND[r.kind] ?? r.kind} · {fmtDate(r.performed_at)}{r.staff_name ? ` · ${r.staff_name}` : ''}
                      {r.addenda.length ? ` · ${r.addenda.length} adendo${r.addenda.length > 1 ? 's' : ''}` : ''}
                    </span>
                    {voided && <span className="block text-xs text-red-600 dark:text-red-400 mt-0.5">Anulado: {r.void_reason}</span>}
                    {!open && !voided && preview(r) && <span className="block text-xs text-muted/90 truncate mt-0.5">{preview(r)}</span>}
                  </span>
                  <m.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: dur.base }} className="mt-0.5 text-muted">
                    <ChevronDown className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                  </m.span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: dur.base }} className="overflow-hidden">
                      <div className={`px-3 pb-3 space-y-3 ${voided ? 'opacity-60' : ''}`}>
                        {r.kind === 'vacina' && (
                          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                            <div><dt className="text-2xs font-semibold uppercase tracking-wider text-muted">Vacina</dt><dd className="text-ink">{r.vaccine_name || '—'}</dd></div>
                            <div><dt className="text-2xs font-semibold uppercase tracking-wider text-muted">Lote</dt><dd className="text-ink">{r.vaccine_lot || '—'}</dd></div>
                            <div><dt className="text-2xs font-semibold uppercase tracking-wider text-muted">Próxima dose</dt><dd className="text-ink tabular-nums">{fmtDay(r.next_due)}</dd></div>
                          </dl>
                        )}
                        <Section label="Queixa / Subjetivo" text={r.subjective} />
                        <Section label="Exame físico / Objetivo" text={r.objective} />
                        <Vitals r={r} />
                        <Section label="Avaliação / Diagnóstico" text={r.assessment} />
                        <Section label="Plano / Conduta" text={r.plan} />
                        <Section label={r.kind === 'vacina' ? 'Observações' : 'Anotação'} text={r.body} />
                        {r.kind !== 'vacina' && r.next_due && <p className="text-xs text-muted tabular-nums">Retorno: {fmtDay(r.next_due)}</p>}
                        {r.addenda.length > 0 && (
                          <div className="space-y-2 border-l-2 border-primary-200 dark:border-primary-500/30 pl-3">
                            {r.addenda.map(a => (
                              <div key={a.id}>
                                <p className="text-2xs text-muted tabular-nums">Adendo · {fmtDateTime(a.created_at)}{a.staff_name ? ` · ${a.staff_name}` : ''}</p>
                                <p className="text-sm text-ink whitespace-pre-wrap">{a.body}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {voided && r.voided_by_name && <p className="text-2xs text-muted">Anulado por {r.voided_by_name} em {fmtDateTime(r.voided_at)}</p>}
                        {act && !voided && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {!r.locked && mine && <Btn size="sm" variant="outline" icon={Pencil} onClick={() => onEdit(r)}>Editar</Btn>}
                            <Btn size="sm" variant="outline" icon={MessageSquarePlus} onClick={() => { void addendum(r) }}>Adendo</Btn>
                            {r.locked && <Btn size="sm" variant="ghost" icon={Ban} onClick={() => { void annul(r) }}>Anular</Btn>}
                            {!r.locked && mine && <Btn size="sm" variant="danger" icon={Trash2} onClick={() => { void remove(r) }}>Excluir</Btn>}
                          </div>
                        )}
                        {!r.locked && !voided && <p className="text-2xs text-muted">Pode ser editado até 24 horas depois de criado.</p>}
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </m.div>
            </MotionItem>
          )
        })}
      </MotionList>
    </div>
  )
}
