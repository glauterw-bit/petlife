'use client'

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Info, Plus, X } from 'lucide-react'
import { reminders as remindersApi, type CreateReminderData, type Pet, type Reminder } from '@/lib/api'
import { REMINDER_KINDS, parseReminderDate, toNaiveISO, type ReminderKind } from '@/lib/reminders'
import { useLocale } from '@/contexts/LocaleContext'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { haptic } from '@/lib/feedback'
import { cn } from '@/lib/utils'
import { formatDayShort, repeatLabel } from './ReminderRow'

const inputCls =
  'w-full min-h-[48px] px-4 py-3 border rounded-xl text-[15px] bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500'
const okBorder = 'border-surface-200 dark:border-surface-700'
const errBorder = 'border-red-600 dark:border-red-400'
const labelCls = 'block text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5'
const chipBase =
  'pressable inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
const chipOn = 'bg-primary-700 border-primary-700 text-white dark:bg-primary-500 dark:border-primary-500 dark:text-surface-950'
const chipOff =
  'bg-white border-surface-200 text-surface-700 hover:bg-surface-50 dark:bg-surface-900 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800'

/** Ordem pedida no produto: banho, consulta, remédio, outro. */
const KIND_ORDER: ReminderKind[] = ['grooming', 'vet_appointment', 'medication', 'other']
const REPEAT_PRESETS = ['7', '15', '30'] as const
type RepeatChoice = 'none' | (typeof REPEAT_PRESETS)[number] | 'custom'
/** Horários de exemplo (editáveis): não são recomendação, só ponto de partida. */
const MED_TIME_EXAMPLES = ['08:00', '20:00', '14:00', '02:00']
const MAX_TIMES = 4

const pad = (n: number) => String(n).padStart(2, '0')
const localDayStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** 'YYYY-MM-DD' + 'HH:mm' → Date local. */
function combine(day: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  const h = /^(\d{2}):(\d{2})/.exec(time)
  if (!m || !h) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(h[1]), Number(h[2]))
}

function intIn(v: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(v.trim())) return null
  const n = Number(v)
  return n >= min && n <= max ? n : null
}

type Errors = Partial<Record<string, string>>

export interface ReminderSheetProps {
  open: boolean
  onClose: () => void
  pets: Pet[]
  /** Pet pré-selecionado (filtro da tela ou ?pet=). */
  defaultPetId?: number | null
  /** Com um lembrete, a folha edita; sem, cria. */
  editing?: Reminder | null
  /** Chamado com os lembretes criados (ou o atualizado) e se houve falha parcial. */
  onSaved: (result: { mode: 'create' | 'edit'; items: Reminder[]; failed: number }) => void
}

/**
 * Criar/editar lembrete. Remédio vira 1 lembrete por horário, repetindo todo
 * dia até o último dia do tratamento (ou sem fim, em uso contínuo).
 *
 * Remédio: o PetLife NUNCA sugere remédio nem calcula dose (nem por peso).
 * A dose é texto livre copiado da receita.
 */
export function ReminderSheet({ open, onClose, pets, defaultPetId, editing, onSaved }: ReminderSheetProps) {
  const { t, locale } = useLocale()
  const uid = useId()
  const fid = (k: string) => `${uid}-${k}`
  const isEdit = !!editing

  const [kind, setKind] = useState<ReminderKind>('grooming')
  const [petId, setPetId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const autoTitle = useRef('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [repeat, setRepeat] = useState<RepeatChoice>('none')
  const [customDays, setCustomDays] = useState('')
  const [notes, setNotes] = useState('')
  // remédio
  const [dose, setDose] = useState('')
  const [times, setTimes] = useState<string[]>(['08:00', '20:00'])
  const [durMode, setDurMode] = useState<'fixed' | 'continuous'>('fixed')
  const [days, setDays] = useState('7')

  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const defaultTitle = (k: ReminderKind) =>
    k === 'grooming' ? t('rem.kind.grooming') : k === 'vet_appointment' ? t('rem.def.vet_appointment') : ''

  // (Re)inicia o formulário a cada abertura.
  useEffect(() => {
    if (!open) return
    setErrors({})
    setSubmitted(false)
    setSaving(false)
    const fallbackPet = defaultPetId ?? (pets.length === 1 ? pets[0].id : pets[0]?.id ?? null)
    if (editing) {
      const k = (KIND_ORDER as string[]).includes(editing.type) ? (editing.type as ReminderKind) : 'other'
      const d = parseReminderDate(editing.due_date)
      const valid = Number.isFinite(d.getTime())
      setKind(editing.type === 'medication' ? 'medication' : k)
      setPetId(editing.pet_id ?? null)
      setTitle(editing.title)
      autoTitle.current = ''
      setDate(valid ? localDayStr(d) : localDayStr(new Date()))
      setTime(valid ? hhmm(d) : '09:00')
      const n = editing.repeat_days ? Math.floor(editing.repeat_days) : 0
      setRepeat(!n ? 'none' : (REPEAT_PRESETS as readonly string[]).includes(String(n)) ? (String(n) as RepeatChoice) : 'custom')
      setCustomDays(n && !(REPEAT_PRESETS as readonly string[]).includes(String(n)) ? String(n) : '')
      setNotes(editing.type === 'medication' ? '' : editing.description ?? '')
      setDose(editing.type === 'medication' ? editing.description ?? '' : '')
    } else {
      setKind('grooming')
      setPetId(fallbackPet)
      const auto = defaultTitle('grooming')
      setTitle(auto)
      autoTitle.current = auto
      setDate(localDayStr(new Date()))
      setTime('09:00')
      setRepeat('none')
      setCustomDays('')
      setNotes('')
      setDose('')
      setTimes(['08:00', '20:00'])
      setDurMode('fixed')
      setDays('7')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id])

  // Pets chegaram depois de abrir (ex.: ?new=1 numa carga fria): pré-seleciona.
  useEffect(() => {
    if (!open || editing || petId != null || !pets.length) return
    setPetId(defaultPetId ?? pets[0].id)
  }, [open, editing, petId, pets, defaultPetId])

  function chooseKind(k: ReminderKind) {
    if (k === kind) return
    haptic('toggle')
    setKind(k)
    // Título automático: só troca se o usuário não escreveu um próprio.
    if (k !== 'medication' && (title.trim() === '' || title === autoTitle.current)) {
      const auto = defaultTitle(k)
      setTitle(auto)
      autoTitle.current = auto
    } else if (k === 'medication' && title === autoTitle.current) {
      setTitle('')
      autoTitle.current = ''
    }
    if (submitted) setErrors({})
  }

  const isMed = kind === 'medication'
  const durationDays = intIn(days, 1, 365)

  /** Último dia do tratamento: início + (N − 1) dias ("por 7 dias" = 7 dias de doses). */
  const lastDay = useMemo(() => {
    if (!isMed || durMode !== 'fixed' || !durationDays) return null
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (!m) return null
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + durationDays - 1, 23, 59)
  }, [isMed, durMode, durationDays, date])

  function validate(): Errors {
    const e: Errors = {}
    if (isMed) {
      if (!title.trim()) e.title = t('rem.f.medNameReq')
    } else if (!title.trim()) e.title = t('rem.f.titleReq')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = t('rem.f.dateReq')
    if (isMed && !isEdit) {
      const filled = times.filter(tm => /^\d{2}:\d{2}/.test(tm))
      if (filled.length !== times.length) e.times = t('rem.f.timeReq')
      else if (new Set(filled).size !== filled.length) e.times = t('rem.f.timeDup')
      if (durMode === 'fixed' && !durationDays) e.days = t('rem.f.rangeErr')
    } else {
      if (!/^\d{2}:\d{2}/.test(time)) e.time = t('rem.f.timeReq')
      if (!isMed && repeat === 'custom' && !intIn(customDays, 1, 365)) e.customDays = t('rem.f.rangeErr')
    }
    return e
  }

  // Revalida ao vivo depois da 1ª tentativa de salvar.
  useEffect(() => {
    if (submitted) setErrors(validate())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, title, date, time, repeat, customDays, times, durMode, days, kind])

  function repeatDays(): number | null {
    if (repeat === 'none') return null
    if (repeat === 'custom') return intIn(customDays, 1, 365)
    return Number(repeat)
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (saving) return
    setSubmitted(true)
    const e = validate()
    setErrors(e)
    const firstKey = Object.keys(e)[0]
    if (firstKey) {
      haptic('error')
      const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${firstKey}"]`)
      el?.focus()
      return
    }
    setSaving(true)
    const pet_id = petId ?? undefined
    try {
      if (isEdit && editing) {
        const due = combine(date, time)
        if (!due) return
        const data: Partial<CreateReminderData> = {
          pet_id,
          title: title.trim(),
          description: (isMed ? dose : notes).trim() || undefined,
          due_date: toNaiveISO(due),
        }
        // Remédio mantém a repetição criada (todo dia até o fim do tratamento).
        if (!isMed) {
          data.repeat_days = repeatDays()
          if (!data.repeat_days) data.repeat_until = null
        }
        const updated = await remindersApi.update(editing.id, data)
        haptic('saved')
        onSaved({ mode: 'edit', items: [{ ...editing, ...data, ...updated } as Reminder], failed: 0 })
        return
      }

      let payloads: CreateReminderData[]
      if (isMed) {
        const until = lastDay ? toNaiveISO(lastDay) : null
        const now = Date.now()
        payloads = times.map(tm => {
          let due = combine(date, tm) as Date
          // Horário de hoje que já passou começa amanhã (como um despertador),
          // desde que amanhã ainda esteja dentro do tratamento.
          if (due.getTime() < now) {
            const next = new Date(due)
            next.setDate(due.getDate() + 1)
            if (!lastDay || next.getTime() <= lastDay.getTime()) due = next
          }
          return {
            pet_id,
            type: 'medication',
            title: title.trim(),
            description: dose.trim() || undefined,
            due_date: toNaiveISO(due),
            repeat_days: 1,
            repeat_until: until,
          }
        })
      } else {
        const due = combine(date, time) as Date
        payloads = [
          {
            pet_id,
            type: kind,
            title: title.trim(),
            description: notes.trim() || undefined,
            due_date: toNaiveISO(due),
            repeat_days: repeatDays(),
            repeat_until: null,
          },
        ]
      }
      const results = await Promise.allSettled(payloads.map(p => remindersApi.create(p)))
      const items = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []))
      const failed = results.length - items.length
      if (!items.length) throw new Error('create failed')
      haptic(failed ? 'warning' : 'saved')
      onSaved({ mode: 'create', items, failed })
    } catch {
      haptic('error')
      setErrors({ form: t('rem.err') })
    } finally {
      setSaving(false)
    }
  }

  const errorList = Object.values(errors).filter(Boolean) as string[]
  const describe = (k: string, extra?: string) =>
    [errors[k] ? fid(`${k}-err`) : null, extra].filter(Boolean).join(' ') || undefined
  const fieldErr = (k: string) =>
    errors[k] ? (
      <p id={fid(`${k}-err`)} className="mt-1.5 text-sm font-medium text-red-700 dark:text-red-400">
        {errors[k]}
      </p>
    ) : null

  const saveLabel = isMed && !isEdit && times.length > 1 ? t('rem.saveN', { n: times.length }) : t('rem.save')
  const editingRule = isEdit && isMed && editing ? repeatLabel(editing, locale, t) : null

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? t('rem.sheet.edit') : t('rem.sheet.new')}
      size="tall"
      footer={
        <Button type="submit" form={fid('form')} size="lg" fullWidth loading={saving}>
          {saveLabel}
        </Button>
      }
    >
      <form id={fid('form')} ref={formRef} onSubmit={submit} noValidate className="space-y-5 pb-4">
        {/* Resumo dos erros para leitores de tela */}
        <div aria-live="assertive" role="status" className={errorList.length && submitted ? '' : 'sr-only'}>
          {submitted && errorList.length > 0 && (
            <p className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-3.5 py-2.5 text-sm font-medium text-red-800 dark:text-red-300">
              {errors.form ?? t('rem.errSummary')}
            </p>
          )}
        </div>

        {/* Tipo */}
        <fieldset>
          <legend className={labelCls}>{t('rem.f.kind')}</legend>
          {isEdit ? (
            <p className="text-[15px] font-semibold text-surface-900 dark:text-white">
              {t(`rem.kind.${editing?.type ?? kind}`)}
            </p>
          ) : (
            <div role="radiogroup" aria-label={t('rem.f.kind')} className="grid grid-cols-2 gap-2">
              {KIND_ORDER.map(k => {
                const Icon = REMINDER_KINDS.find(x => x.kind === k)!.Icon
                const on = kind === k
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => chooseKind(k)}
                    className={cn(chipBase, 'justify-start min-h-[48px]', on ? chipOn : chipOff)}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden />
                    <span className="truncate">{t(`rem.kind.${k}`)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </fieldset>

        {isMed && (
          <p className="flex gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3.5 py-3 text-sm text-amber-900 dark:text-amber-200">
            <Info className="w-[18px] h-[18px] shrink-0 mt-0.5" aria-hidden />
            <span>{t('rem.medNotice')}</span>
          </p>
        )}

        {/* Pet */}
        {pets.length > 1 && (
          <fieldset>
            <legend className={labelCls}>{t('rem.f.pet')}</legend>
            <div role="radiogroup" aria-label={t('rem.f.pet')} className="flex flex-wrap gap-2">
              {pets.map(p => {
                const on = petId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => { haptic('toggle'); setPetId(p.id) }}
                    className={cn(chipBase, on ? chipOn : chipOff)}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {/* Título / nome do remédio */}
        <div>
          <label htmlFor={fid('title')} className={labelCls}>
            {isMed ? t('rem.f.medName') : t('rem.f.title')}
          </label>
          <input
            id={fid('title')}
            data-field="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
            autoComplete="off"
            aria-invalid={!!errors.title}
            aria-describedby={describe('title')}
            className={cn(inputCls, errors.title ? errBorder : okBorder)}
          />
          {fieldErr('title')}
        </div>

        {isMed && (
          <div>
            <label htmlFor={fid('dose')} className={labelCls}>{t('rem.f.dose')}</label>
            <input
              id={fid('dose')}
              value={dose}
              onChange={e => setDose(e.target.value)}
              maxLength={200}
              autoComplete="off"
              placeholder={t('rem.f.dosePh')}
              className={cn(inputCls, okBorder)}
            />
          </div>
        )}

        {/* Data (+ hora quando não é remédio novo) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={fid('date')} className={labelCls}>
              {isMed && !isEdit ? t('rem.f.start') : t('rem.f.date')}
            </label>
            <input
              id={fid('date')}
              data-field="date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              aria-invalid={!!errors.date}
              aria-describedby={describe('date')}
              className={cn(inputCls, 'px-3', errors.date ? errBorder : okBorder)}
            />
            {fieldErr('date')}
          </div>
          {!(isMed && !isEdit) && (
            <div>
              <label htmlFor={fid('time')} className={labelCls}>{t('rem.f.time')}</label>
              <input
                id={fid('time')}
                data-field="time"
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                aria-invalid={!!errors.time}
                aria-describedby={describe('time')}
                className={cn(inputCls, 'px-3', errors.time ? errBorder : okBorder)}
              />
              {fieldErr('time')}
            </div>
          )}
        </div>

        {/* Remédio novo: horários e duração */}
        {isMed && !isEdit && (
          <>
            <fieldset aria-describedby={fid('times-hint')}>
              <legend className={labelCls}>{t('rem.f.times')}</legend>
              <p id={fid('times-hint')} className="-mt-0.5 mb-2 text-[13px] text-surface-600 dark:text-surface-300">
                {t('rem.f.timesHint')}
              </p>
              <ul className="space-y-2">
                {times.map((tm, i) => {
                  const bad = !!errors.times && (!/^\d{2}:\d{2}/.test(tm) || times.indexOf(tm) !== i || times.lastIndexOf(tm) !== i)
                  return (
                  <li key={i} className="flex items-center gap-2">
                    <label htmlFor={fid(`time${i}`)} className="sr-only">{t('rem.f.timeN', { n: i + 1 })}</label>
                    <input
                      id={fid(`time${i}`)}
                      data-field={i === 0 ? 'times' : undefined}
                      type="time"
                      value={tm}
                      onChange={e => setTimes(ts => ts.map((x, j) => (j === i ? e.target.value : x)))}
                      aria-invalid={bad}
                      aria-describedby={bad ? fid('times-err') : undefined}
                      className={cn(inputCls, 'px-3 flex-1', bad ? errBorder : okBorder)}
                    />
                    {times.length > 1 && (
                      <button
                        type="button"
                        onClick={() => { haptic('tap'); setTimes(ts => ts.filter((_, j) => j !== i)) }}
                        aria-label={t('rem.f.removeTime', { n: i + 1 })}
                        className="pressable w-11 h-11 shrink-0 rounded-xl inline-flex items-center justify-center text-surface-500 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        <X className="w-5 h-5" aria-hidden />
                      </button>
                    )}
                  </li>
                  )
                })}
              </ul>
              {errors.times && (
                <p id={fid('times-err')} className="mt-1.5 text-sm font-medium text-red-700 dark:text-red-400">{errors.times}</p>
              )}
              {times.length < MAX_TIMES && (
                <button
                  type="button"
                  onClick={() => {
                    haptic('tap')
                    setTimes(ts => [...ts, MED_TIME_EXAMPLES.find(x => !ts.includes(x)) ?? '12:00'])
                  }}
                  className="pressable mt-2 inline-flex items-center gap-1.5 min-h-[44px] px-2 -ml-2 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <Plus className="w-4 h-4" aria-hidden />
                  {t('rem.f.addTime')}
                </button>
              )}
            </fieldset>

            <fieldset>
              <legend className={labelCls}>{t('rem.f.duration')}</legend>
              <div role="radiogroup" aria-label={t('rem.f.duration')} className="grid grid-cols-2 gap-2">
                {(['fixed', 'continuous'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={durMode === m}
                    onClick={() => { haptic('toggle'); setDurMode(m) }}
                    className={cn(chipBase, durMode === m ? chipOn : chipOff)}
                  >
                    {m === 'fixed' ? t('rem.dur.fixed') : t('rem.dur.continuous')}
                  </button>
                ))}
              </div>
              {durMode === 'fixed' && (
                <div className="mt-3">
                  <label htmlFor={fid('days')} className={labelCls}>{t('rem.f.days')}</label>
                  <input
                    id={fid('days')}
                    data-field="days"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={days}
                    onChange={e => setDays(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    aria-invalid={!!errors.days}
                    aria-describedby={describe('days', lastDay ? fid('lastday') : undefined)}
                    className={cn(inputCls, 'max-w-[140px]', errors.days ? errBorder : okBorder)}
                  />
                  {fieldErr('days')}
                  {lastDay && !errors.days && (
                    <p id={fid('lastday')} className="mt-1.5 text-[13px] text-surface-600 dark:text-surface-300">
                      {t('rem.f.lastDay', { date: formatDayShort(lastDay, locale) })}
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          </>
        )}

        {/* Remédio em edição: só este horário */}
        {isMed && isEdit && (
          <p className="text-[13px] text-surface-600 dark:text-surface-300">
            {t('rem.medEditHint')}
            {editingRule && <> {t('rem.repeatKept', { rule: editingRule })}</>}
          </p>
        )}

        {/* Repetição (não remédio) */}
        {!isMed && (
          <fieldset>
            <legend className={labelCls}>{t('rem.f.repeat')}</legend>
            <div role="radiogroup" aria-label={t('rem.f.repeat')} className="flex flex-wrap gap-2">
              {(['none', ...REPEAT_PRESETS, 'custom'] as RepeatChoice[]).map(r => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={repeat === r}
                  onClick={() => { haptic('toggle'); setRepeat(r) }}
                  className={cn(chipBase, repeat === r ? chipOn : chipOff)}
                >
                  {r === 'none' ? t('rem.rep.none') : r === 'custom' ? t('rem.rep.custom') : t('rem.everyN', { n: r })}
                </button>
              ))}
            </div>
            {repeat === 'custom' && (
              <div className="mt-3">
                <label htmlFor={fid('customDays')} className={labelCls}>{t('rem.f.customDays')}</label>
                <input
                  id={fid('customDays')}
                  data-field="customDays"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={customDays}
                  onChange={e => setCustomDays(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  aria-invalid={!!errors.customDays}
                  aria-describedby={describe('customDays')}
                  className={cn(inputCls, 'max-w-[140px]', errors.customDays ? errBorder : okBorder)}
                />
                {fieldErr('customDays')}
              </div>
            )}
          </fieldset>
        )}

        {!isMed && (
          <Field label={t('rem.f.notes')} htmlFor={fid('notes')}>
            <textarea
              id={fid('notes')}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={300}
              rows={2}
              className={cn(inputCls, okBorder, 'resize-none')}
            />
          </Field>
        )}
      </form>
    </Sheet>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelCls}>{label}</label>
      {children}
    </div>
  )
}
