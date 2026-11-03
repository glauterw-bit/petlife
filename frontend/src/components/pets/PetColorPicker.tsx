'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { PET_COLORS } from '@/lib/petColor'

/**
 * 8 bolinhas para escolher a cor do pet. Opcional: tocar na escolhida de novo
 * desfaz (volta a `null`, e o app usa a cor automática do pet).
 */
export function PetColorPicker({
  value,
  onChange,
  id,
}: {
  value: string | null
  onChange: (c: string | null) => void
  id?: string
}) {
  const t = useT()
  return (
    <div id={id} role="radiogroup" aria-label={t('pet.themeColor')} className="flex flex-wrap gap-2.5">
      {PET_COLORS.map((c, i) => {
        const on = value?.toLowerCase() === c
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t(`pet.themeColor.${i}`)}
            onClick={() => onChange(on ? null : c)}
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center text-white transition-transform active:scale-95',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:ring-offset-surface-900',
              on && 'ring-2 ring-offset-2 ring-surface-900 dark:ring-white dark:ring-offset-surface-900',
            )}
            style={{ backgroundColor: c }}
          >
            {on && <Check className="w-5 h-5" aria-hidden strokeWidth={3} />}
          </button>
        )
      })}
    </div>
  )
}
