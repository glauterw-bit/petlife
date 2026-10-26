'use client'

import { ChevronRight } from 'lucide-react'
import { type Pet } from '@/lib/api'
import type { PetCareSummary } from '@/lib/care'
import { formatAge, cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { Card } from '@/components/ui/Card'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { StatusBadge, careStateLabel } from '@/components/ui/StatusBadge'

interface PetCardProps {
  pet: Pet
  /** Situação de cuidados (vacinas, vermífugo, antipulgas). Sem ela, o cartão mostra só os dados do pet. */
  summary?: PetCareSummary | null
  className?: string
}

/** "raça · idade" juntando só as partes que existem. */
export function petSubtitle(pet: Pet): string {
  return [pet.breed?.name, pet.birth_date ? formatAge(pet.birth_date) : null].filter(Boolean).join(' · ')
}

/** Item da lista de pets: foto com o anel da pior situação, nome, raça · idade e a situação em texto. */
export function PetCard({ pet, summary, className }: PetCardProps) {
  const t = useT()
  const subtitle = petSubtitle(pet)
  const worstItem = summary
    ? summary.next ?? summary.items.find(i => i.state === summary.worst) ?? null
    : null

  return (
    <Card
      href={`/pets/${pet.id}`}
      interactive
      padding="none"
      className={cn('flex items-center gap-4 p-4 min-h-[96px]', className)}
      aria-label={t('petx.list.open', { name: pet.name })}
    >
      <PetAvatar pet={pet} size={64} ring={summary?.worst ?? null} />
      <div className="flex-1 min-w-0">
        <h3 className="text-[17px] font-bold font-display text-surface-900 dark:text-white truncate">{pet.name}</h3>
        {subtitle && <p className="text-sm text-surface-600 dark:text-surface-400 truncate">{subtitle}</p>}
        {worstItem && summary && (
          <div className="mt-1.5">
            <StatusBadge state={summary.worst} size="sm">
              {summary.worst === 'ok'
                ? careStateLabel(t, 'ok', null)
                : `${t(`ui.care.${worstItem.kind}`)}: ${careStateLabel(t, worstItem.state, worstItem.daysLeft).toLowerCase()}`}
            </StatusBadge>
          </div>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-surface-400 dark:text-surface-500 shrink-0" aria-hidden />
    </Card>
  )
}
