'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { innovations, type Pet } from '@/lib/api'
import { hapticLight, hapticSuccess, hapticError } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

// O emoji aqui é conteúdo (a reação de humor), não ícone de interface.
const MOODS: { value: 'feliz' | 'neutro' | 'apatico'; emoji: string; labelKey: string }[] = [
  { value: 'feliz', emoji: '😺', labelKey: 'h.checkin.moodGreat' },
  { value: 'neutro', emoji: '😐', labelKey: 'h.checkin.moodOk' },
  { value: 'apatico', emoji: '😔', labelKey: 'h.checkin.moodLow' },
]

/**
 * Check-in diário 1 toque: como o pet está hoje. Compacto — uma linha de
 * pergunta e três reações. Alimenta o histórico de comportamento.
 */
export function DailyCheckin({ pet, onDone }: { pet: Pet; onDone?: () => void }) {
  const t = useT()
  const [done, setDone] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  async function pick(mood: 'feliz' | 'neutro' | 'apatico') {
    if (saving || done) return
    setSaving(mood)
    void hapticLight()
    try {
      await innovations.addBehaviorLog(pet.id, { mood })
      setDone(mood)
      void hapticSuccess()
      onDone?.()
    } catch {
      void hapticError()
    } finally {
      setSaving(null)
    }
  }

  const picked = MOODS.find(m => m.value === done)

  return (
    <div className="rounded-2xl border bg-white dark:bg-surface-900 border-surface-200/70 dark:border-surface-800 px-4 py-3">
      <AnimatePresence mode="wait" initial={false}>
        {picked ? (
          <motion.div
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
              <div className="text-xs text-surface-600 dark:text-surface-400 truncate">
                {picked.emoji} {t(picked.labelKey)} · {pet.name}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="ask" exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <div className="text-sm font-semibold text-surface-800 dark:text-surface-100 mb-2">
              {t('h.checkin.question', { name: pet.name })}
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('h.checkin.question', { name: pet.name })}>
              {MOODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => pick(m.value)}
                  disabled={!!saving}
                  aria-busy={saving === m.value || undefined}
                  className={cn(
                    'pressable flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border transition-colors',
                    saving === m.value
                      ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/15'
                      : 'border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800',
                    saving && saving !== m.value && 'opacity-40',
                  )}
                >
                  <span className="text-xl leading-none" aria-hidden>{m.emoji}</span>
                  <span className="text-xs font-medium text-surface-700 dark:text-surface-200">{t(m.labelKey)}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
