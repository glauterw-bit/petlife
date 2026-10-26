'use client'

import {
  Sparkles, HeartPulse, ClipboardList, BookOpen, Brain, Smile, PartyPopper, Image as ImageIcon,
  Link as LinkIcon, FileText, GitFork, Siren, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { useT } from '@/contexts/LocaleContext'
import { hapticLight } from '@/lib/feedback'

export type PetAction =
  | 'triage' | 'pain' | 'stool' | 'bedtime' | 'behavior' | 'mood'
  | 'recap' | 'moments' | 'link' | 'pdf' | 'family' | 'lost'

const GROUPS: { titleKey: string; items: { id: PetAction; icon: LucideIcon; key: string }[] }[] = [
  {
    titleKey: 'petx.sheet.groupHealth',
    items: [
      { id: 'triage', icon: Sparkles, key: 'triage' },
      { id: 'pain', icon: HeartPulse, key: 'pain' },
      { id: 'stool', icon: ClipboardList, key: 'stool' },
      { id: 'mood', icon: Smile, key: 'mood' },
      { id: 'behavior', icon: Brain, key: 'behavior' },
      { id: 'bedtime', icon: BookOpen, key: 'bedtime' },
    ],
  },
  {
    titleKey: 'petx.sheet.groupShare',
    items: [
      { id: 'moments', icon: ImageIcon, key: 'moments' },
      { id: 'recap', icon: PartyPopper, key: 'recap' },
      { id: 'link', icon: LinkIcon, key: 'link' },
      { id: 'pdf', icon: FileText, key: 'pdf' },
      { id: 'family', icon: GitFork, key: 'family' },
      { id: 'lost', icon: Siren, key: 'lost' },
    ],
  },
]

/** Folha "Mais" da ficha do pet: todas as ferramentas, com ícone em tom único e rótulo em texto. */
export function PetActionsSheet({
  open,
  onClose,
  petName,
  onAction,
}: {
  open: boolean
  onClose: () => void
  petName: string
  onAction: (a: PetAction) => void
}) {
  const t = useT()
  return (
    <Sheet open={open} onClose={onClose} title={t('petx.sheet.title', { name: petName })} size="tall">
      <div className="space-y-5 pb-2">
        {GROUPS.map(g => (
          <section key={g.titleKey}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-400 mb-1.5">
              {t(g.titleKey)}
            </h3>
            <ul className="divide-y divide-surface-100 dark:divide-surface-800">
              {g.items.map(({ id, icon: Icon, key }) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      void hapticLight()
                      onClose()
                      onAction(id)
                    }}
                    className="pressable w-full flex items-center gap-3 py-2.5 min-h-[56px] text-left rounded-xl"
                  >
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                      <Icon className="w-5 h-5" aria-hidden />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold text-surface-900 dark:text-white">{t(`petx.sheet.${key}`)}</span>
                      <span className="block text-[13px] text-surface-600 dark:text-surface-400 truncate">
                        {t(`petx.sheet.${key}Hint`, { name: petName })}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-surface-400 shrink-0" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  )
}
