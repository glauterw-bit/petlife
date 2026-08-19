'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { innovations, type Pet } from '@/lib/api'
import { hapticLight, hapticSuccess, celebrate } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'

const MOODS: { value: 'feliz' | 'neutro' | 'apatico'; emoji: string; labelKey: string }[] = [
  { value: 'feliz', emoji: '😺', labelKey: 'h.checkin.moodGreat' },
  { value: 'neutro', emoji: '😐', labelKey: 'h.checkin.moodOk' },
  { value: 'apatico', emoji: '😔', labelKey: 'h.checkin.moodLow' },
]

/**
 * Check-in diário 1-tap: 3 emojis, 5 segundos.
 * Alimenta o Health Score (bem-estar) e a IA de padrões.
 */
export function DailyCheckin({ pet, onDone }: { pet: Pet; onDone?: () => void }) {
  const t = useT()
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)

  async function pick(mood: 'feliz' | 'neutro' | 'apatico') {
    if (saving || done) return
    setSaving(mood)
    void hapticLight()
    try {
      await innovations.addBehaviorLog(pet.id, { mood })
      setDone(true)
      void hapticSuccess()
      if (mood === 'feliz') celebrate('small')
      onDone?.()
    } catch {
      setSaving(null)
    }
  }

  if (done) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-primary-50 dark:from-emerald-950/40 dark:to-primary-950/40 rounded-2xl border border-emerald-100 dark:border-emerald-900 p-4 flex items-center gap-3 animate-slide-up">
        <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
          <Check className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-surface-900 dark:text-white">{t('h.checkin.done')}</div>
          <div className="text-xs text-surface-500 dark:text-surface-400">{t('h.checkin.doneSub', { name: pet.name })}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-4">
      <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
        {t('h.checkin.question', { name: pet.name })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MOODS.map(m => (
          <button
            key={m.value}
            onClick={() => pick(m.value)}
            disabled={!!saving}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition tap-target active:scale-95 ${
              saving === m.value
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40'
                : 'border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700'
            } ${saving && saving !== m.value ? 'opacity-40' : ''}`}
          >
            <span className="text-2xl">{m.emoji}</span>
            <span className="text-xs font-medium text-surface-600 dark:text-surface-300">{t(m.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
