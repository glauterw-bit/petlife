'use client'

import { useEffect, useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { Plus, Trash2, Loader2, Check } from 'lucide-react'
import { heatCycles, type HeatCycleOverview } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { formatDate } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

interface Props {
  petId: number
  petName: string
  gender?: 'male' | 'female'
  neutered?: boolean
  onEditProfile: () => void
  /** Muda quando o perfil é editado (espécie/sexo mudam a previsão). */
  refreshKey?: number
}

const todayStr = () => format(new Date(), 'yyyy-MM-dd')
const inputCls = 'w-full px-3 py-2 text-sm border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500'
const btnCls = 'pressable flex items-center gap-1 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl disabled:opacity-60'

export function HeatCycleCard({ petId, petName, gender, neutered, onEditProfile, refreshKey }: Props) {
  const t = useT()
  const { success, error } = useToast()
  const [data, setData] = useState<HeatCycleOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'none' | 'add' | 'end'>('none')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ started_at: todayStr(), ended_at: '', notes: '' })
  const [endDate, setEndDate] = useState(todayStr())

  useEffect(() => {
    if (gender !== 'female') { setLoading(false); return }
    setLoading(true)
    heatCycles.get(petId).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [petId, gender, refreshKey])

  async function run(action: () => Promise<HeatCycleOverview>, okMsg: string) {
    setSaving(true)
    try {
      setData(await action())
      setMode('none')
      success(okMsg)
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('h.heat.errSave'))
    } finally { setSaving(false) }
  }

  function saveNew() {
    run(() => heatCycles.add(petId, {
      started_at: form.started_at,
      ended_at: form.ended_at || undefined,
      notes: form.notes.trim() || undefined,
    }), t('h.heat.saved'))
  }

  function saveEnd() {
    if (!data?.current) return
    const id = data.current.id
    run(() => heatCycles.update(petId, id, { ended_at: endDate }), t('h.heat.ended'))
  }

  async function remove(cycleId: number) {
    if (!confirm(t('h.heat.deleteConfirm'))) return
    try {
      await heatCycles.remove(petId, cycleId)
      setData(await heatCycles.get(petId))
      success(t('h.heat.deleted'))
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('h.heat.errSave'))
    }
  }

  if (gender === 'male') return null

  const card = 'bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5'
  const title = (
    <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2">
      <span aria-hidden>🌸</span> {t('h.heat.title')}
    </h3>
  )

  if (gender !== 'female') {
    return (
      <div className={card}>
        {title}
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-2 mb-3">{t('h.heat.needFemale', { name: petName })}</p>
        <button onClick={onEditProfile} className={btnCls}>{t('h.heat.editProfile')}</button>
      </div>
    )
  }
  if (loading || !data) return null

  const current = data.current
  const pred = data.prediction
  const lastClosed = data.cycles.find(c => c.ended_at)
  const today = new Date()
  const currentDay = current ? differenceInCalendarDays(today, parseISO(current.started_at)) + 1 : 0
  const daysUntil = pred ? differenceInCalendarDays(parseISO(pred.next_start), today) : 0
  const predLabel = daysUntil < 0 ? t('h.heat.late')
    : daysUntil === 0 ? t('h.heat.today')
    : daysUntil === 1 ? t('h.heat.tomorrow')
    : t('h.heat.inDays', { count: daysUntil })

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        {title}
        {current ? (
          <button onClick={() => { setEndDate(todayStr()); setMode(m => (m === 'end' ? 'none' : 'end')) }} className={btnCls}>
            <Check className="w-3.5 h-3.5" /> {t('h.heat.markEnd')}
          </button>
        ) : (
          <button onClick={() => { setForm({ started_at: todayStr(), ended_at: '', notes: '' }); setMode(m => (m === 'add' ? 'none' : 'add')) }} className={btnCls}>
            <Plus className="w-3.5 h-3.5" /> {t('h.heat.register')}
          </button>
        )}
      </div>

      {neutered && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-3">
          {t('h.heat.neutered', { name: petName })}
        </p>
      )}

      {mode === 'add' && (
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 mb-3 space-y-2 animate-slide-up">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-surface-500 dark:text-surface-400">
              {t('h.heat.startLabel')}
              <input type="date" value={form.started_at} max={todayStr()}
                onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-xs text-surface-500 dark:text-surface-400">
              {t('h.heat.endLabel')}
              <input type="date" value={form.ended_at} min={form.started_at} max={todayStr()}
                onChange={e => setForm(f => ({ ...f, ended_at: e.target.value }))} className={`${inputCls} mt-1`} />
            </label>
          </div>
          <input type="text" value={form.notes} maxLength={500} placeholder={t('h.heat.notesPh')}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} />
          <div className="flex justify-end">
            <button onClick={saveNew} disabled={saving || !form.started_at} className={btnCls}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('common.save')}
            </button>
          </div>
        </div>
      )}

      {mode === 'end' && current && (
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 mb-3 flex items-end gap-2 animate-slide-up">
          <label className="flex-1 text-xs text-surface-500 dark:text-surface-400">
            {t('h.heat.endDate')}
            <input type="date" value={endDate} min={current.started_at.slice(0, 10)} max={todayStr()}
              onChange={e => setEndDate(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <button onClick={saveEnd} disabled={saving || !endDate} className={`${btnCls} py-2`}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('common.save')}
          </button>
        </div>
      )}

      {current && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-3 mb-3">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            {t('h.heat.inHeat', { date: formatDate(current.started_at), day: currentDay })}
          </p>
          <p className="text-xs text-rose-600/80 dark:text-rose-300/80 mt-0.5">
            {current.overdue ? t('h.heat.overdue') : t('h.heat.expectedEnd', { date: formatDate(current.expected_end) })}
          </p>
        </div>
      )}

      {!current && lastClosed && lastClosed.ended_at && (
        <p className="text-sm text-surface-600 dark:text-surface-300 mb-3">
          {t('h.heat.last', { start: formatDate(lastClosed.started_at), end: formatDate(lastClosed.ended_at), days: lastClosed.duration_days ?? '—' })}
        </p>
      )}

      {pred ? (
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 p-3 mb-3">
          <div className="text-[10px] uppercase tracking-wide text-surface-400">{t('h.heat.next')}</div>
          <div className="text-base font-bold text-surface-900 dark:text-white">
            {formatDate(pred.next_start)}{' '}
            <span className={`text-sm font-medium ${daysUntil < 0 ? 'text-amber-600' : 'text-primary-600'}`}>· {predLabel}</span>
          </div>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
            {pred.based_on === 'history'
              ? t('h.heat.basedHistory', { interval: pred.interval_days, duration: pred.duration_days })
              : t(data.species === 'cat' ? 'h.heat.basedSpeciesCat' : 'h.heat.basedSpeciesDog')}
          </p>
          {!data.neutered && (
            <p className="text-xs text-surface-400 mt-1">🔔 {t('h.heat.notifyInfo', { count: data.notify_lead_days })}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-surface-400 text-center py-3">{t('h.heat.empty')}</p>
      )}

      {data.cycles.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-surface-500 dark:text-surface-400 mb-1">{t('h.heat.history')}</div>
          <div className="max-h-44 overflow-y-auto">
            {data.cycles.map(c => (
              <div key={c.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-surface-100 dark:border-surface-700 last:border-0">
                <span className="text-surface-700 dark:text-surface-200 tabular-nums whitespace-nowrap">
                  {formatDate(c.started_at)} → {c.ended_at ? formatDate(c.ended_at) : t('h.heat.ongoing')}
                </span>
                {c.duration_days != null && <span className="text-surface-400 whitespace-nowrap">{t('h.heat.days', { count: c.duration_days })}</span>}
                <span className="flex-1 truncate text-surface-400">{c.notes}</span>
                <button onClick={() => remove(c.id)} aria-label={t('common.delete')} className="text-surface-300 hover:text-red-400 p-0.5">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-surface-400 mt-3">💡 {t(data.species === 'cat' ? 'h.heat.tipCat' : 'h.heat.tipDog')}</p>
    </div>
  )
}
