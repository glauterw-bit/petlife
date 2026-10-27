'use client'

import { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Check, Smile, Meh, Frown, type LucideIcon } from 'lucide-react'
import { innovations, type Pet } from '@/lib/api'
import { haptic } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

type Mood = 'feliz' | 'neutro' | 'apatico'

// Ícone + texto sempre (nunca só cor nem só emoji). Tons suaves: verde,
// neutro e âmbar — "pra baixo" não é alarme, então nada de vermelho.
const MOODS: { value: Mood; labelKey: string; Icon: LucideIcon; tone: string; iconTone: string }[] = [
  {
    value: 'feliz',
    labelKey: 'h.checkin.moodGreat',
    Icon: Smile,
    tone: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30',
    iconTone: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    value: 'neutro',
    labelKey: 'h.checkin.moodOk',
    Icon: Meh,
    tone: 'bg-surface-50 border-surface-200 dark:bg-surface-800/60 dark:border-surface-700',
    iconTone: 'text-surface-600 dark:text-surface-300',
  },
  {
    value: 'apatico',
    labelKey: 'h.checkin.moodLow',
    Icon: Frown,
    tone: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
    iconTone: 'text-amber-800 dark:text-amber-300',
  },
]

/**
 * Check-in diário 1 toque: como o pet está hoje. Compacto — uma linha de
 * pergunta e três reações. Alimenta o histórico de comportamento.
 */
export function DailyCheckin({ pet, onDone }: { pet: Pet; onDone?: () => void }) {
  const t = useT()
  const [done, setDone] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  async function pick(mood: Mood) {
    if (saving || done) return
    setSaving(mood)
    haptic('tap')
    try {
      await innovations.addBehaviorLog(pet.id, { mood })
      setDone(mood)
      haptic('saved')
      onDone?.()
    } catch {
      haptic('error')
    } finally {
      setSaving(null)
    }
  }

  const picked = MOODS.find(m => m.value === done)

  return (
    <div className="rounded-2xl border bg-white dark:bg-surface-900 border-surface-200/70 dark:border-surface-800 px-4 py-3">
      <AnimatePresence mode="wait" initial={false}>
        {picked ? (
          <m.div
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring.snappy}
            className="flex items-center gap-3 min-h-[44px]"
            role="status"
          >
            <span className="w-9 h-9 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white dark:text-surface-950 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5" aria-hidden strokeWidth={2.6} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-surface-900 dark:text-white">{t('home.checkin.done')}</div>
              <div className="flex items-center gap-1.5 text-xs text-surface-600 dark:text-surface-400 min-w-0">
                <picked.Icon className={cn('w-4 h-4 shrink-0', picked.iconTone)} aria-hidden />
                <span className="truncate">{t(picked.labelKey)} · {pet.name}</span>
              </div>
            </div>
          </m.div>
        ) : (
          <m.div key="ask" exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <div id={`checkin-q-${pet.id}`} className="text-sm font-semibold text-surface-800 dark:text-surface-100 mb-2">
              {t('home2.checkin.q', { name: pet.name })}
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby={`checkin-q-${pet.id}`}>
              {MOODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => pick(m.value)}
                  disabled={!!saving}
                  aria-busy={saving === m.value || undefined}
                  className={cn(
                    'pressable min-w-0 flex flex-col items-center justify-center gap-1 min-h-[60px] px-1.5 py-2 rounded-2xl border transition-[opacity,box-shadow] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    m.tone,
                    saving === m.value && 'ring-2 ring-primary-600 dark:ring-primary-400',
                    saving && saving !== m.value && 'opacity-40',
                  )}
                >
                  <m.Icon className={cn('w-6 h-6 shrink-0', m.iconTone)} aria-hidden strokeWidth={2.2} />
                  <span className="max-w-full truncate text-[13px] font-semibold leading-tight text-surface-800 dark:text-surface-100">{t(m.labelKey)}</span>
                </button>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
