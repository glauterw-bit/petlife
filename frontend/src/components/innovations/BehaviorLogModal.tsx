'use client'

import { useState } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { innovations, type BehaviorLogEntry } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'

interface Props {
  petId: number
  petName: string
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

const MOOD_OPTIONS = [
  { value: 'feliz', labelKey: 'g.blog.mood.feliz', emoji: '😊' },
  { value: 'neutro', labelKey: 'g.blog.mood.neutro', emoji: '😐' },
  { value: 'apatico', labelKey: 'g.blog.mood.apatico', emoji: '😔' },
  { value: 'ansioso', labelKey: 'g.blog.mood.ansioso', emoji: '😰' },
  { value: 'agitado', labelKey: 'g.blog.mood.agitado', emoji: '😤' },
] as const

const APPETITE_OPTIONS = [
  { value: 'normal', labelKey: 'g.blog.lvl.normal' },
  { value: 'reduzido', labelKey: 'g.blog.lvl.reduced' },
  { value: 'aumentado', labelKey: 'g.blog.lvl.increased' },
  { value: 'recusou', labelKey: 'g.blog.lvl.refused' },
] as const

const WATER_OPTIONS = [
  { value: 'normal', labelKey: 'g.blog.lvl.normal' },
  { value: 'reduzido', labelKey: 'g.blog.lvl.reduced' },
  { value: 'aumentado', labelKey: 'g.blog.lvl.increased' },
] as const

export function BehaviorLogModal({ petId, petName, open, onClose, onSaved }: Props) {
  const t = useT()
  const { success, error } = useToast()
  const [form, setForm] = useState<BehaviorLogEntry>({})
  const [saving, setSaving] = useState(false)

  async function save() {
    if (Object.keys(form).filter(k => form[k as keyof BehaviorLogEntry] != null).length === 0) {
      error(t('g.blog.errEmpty'))
      return
    }
    setSaving(true)
    try {
      await innovations.addBehaviorLog(petId, form)
      success(t('g.blog.saved', { name: petName }))
      setForm({})
      onSaved?.()
      onClose()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('g.misc.error'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 dark:border-surface-700 sticky top-0 bg-white/95 dark:bg-surface-800/95 backdrop-blur z-10">
          <h2 className="font-bold text-surface-900 dark:text-white">{t('g.blog.title', { name: petName })}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Humor */}
          <div>
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">{t('g.blog.mood')}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {MOOD_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setForm(f => ({ ...f, mood: o.value }))}
                  className={`p-2 rounded-xl border text-center transition ${
                    form.mood === o.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/40'
                      : 'border-surface-200 dark:border-surface-700'
                  }`}
                >
                  <div className="text-xl">{o.emoji}</div>
                  <p className="text-[10px] mt-0.5 font-medium">{t(o.labelKey)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Energia */}
          <div>
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">{t('g.blog.energy')}</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setForm(f => ({ ...f, energy: n }))}
                  className={`flex-1 py-2.5 rounded-xl border font-bold transition ${
                    form.energy === n
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                      : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Apetite */}
          <div>
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">{t('g.blog.appetite')}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {APPETITE_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setForm(f => ({ ...f, appetite: o.value }))}
                  className={`py-2 rounded-xl border text-sm font-medium transition ${
                    form.appetite === o.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                      : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300'
                  }`}
                >
                  {t(o.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Água */}
          <div>
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">{t('g.blog.water')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {WATER_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setForm(f => ({ ...f, water_intake: o.value }))}
                  className={`py-2 rounded-xl border text-sm font-medium transition ${
                    form.water_intake === o.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                      : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300'
                  }`}
                >
                  {t(o.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Atividade */}
          <div>
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">{t('g.blog.activity')}</p>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              value={form.activity_minutes ?? ''}
              onChange={e => setForm(f => ({ ...f, activity_minutes: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder={t('g.blog.activityPh')}
              className="w-full p-3 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Notas */}
          <div>
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-2">{t('g.blog.notes')}</p>
            <textarea
              rows={2}
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value || undefined }))}
              placeholder={t('g.blog.notesPh')}
              className="w-full p-3 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 shadow-lg shadow-primary-500/30"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {saving ? t('g.misc.saving') : t('g.blog.save')}
          </button>

          <p className="text-xs text-surface-500 dark:text-surface-400 text-center">
            {t('g.blog.hint')}
          </p>
        </div>
      </div>
    </div>
  )
}
