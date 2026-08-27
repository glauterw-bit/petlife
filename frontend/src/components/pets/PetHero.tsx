'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Flame } from 'lucide-react'
import { innovations, type Pet, type Vaccine } from '@/lib/api'
import { getSpeciesEmoji, getVaccineStatus, formatAge } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

/**
 * Herói do dashboard: a foto do pet DOMINA a tela, com anel de status
 * (verde = tudo em dia, âmbar = vacina chegando, vermelho = atrasada)
 * e a chama do streak presa ao anel — estilo "stories".
 */
export function PetHero({
  pet, vaccines, userName, refreshKey = 0,
}: {
  pet: Pet
  vaccines: Vaccine[]
  userName?: string
  refreshKey?: number
}) {
  const t = useT()
  const [streak, setStreak] = useState<number>(0)

  useEffect(() => {
    innovations
      .careStreak(pet.id)
      .then(r => setStreak(r.current_streak ?? 0))
      .catch(() => {})
  }, [pet.id, refreshKey])

  const petVaccines = vaccines.filter(v => !v.pet || v.pet.id === pet.id || (v as { pet_id?: number }).pet_id === pet.id)
  const hasOverdue = petVaccines.some(v => getVaccineStatus(v.next_due) === 'overdue')
  const hasUpcoming = petVaccines.some(v => getVaccineStatus(v.next_due) === 'upcoming')

  const ring = hasOverdue
    ? 'from-red-400 via-rose-500 to-red-400'
    : hasUpcoming
      ? 'from-amber-300 via-amber-500 to-amber-300'
      : 'from-emerald-300 via-primary-500 to-emerald-300'

  const statusLabel = hasOverdue
    ? t('vaccine.overdue')
    : hasUpcoming
      ? t('vaccine.upcoming')
      : t('vaccine.ok')

  return (
    <div className="flex items-center gap-4 md:gap-5 mb-6 md:mb-8 min-w-0">
      {/* Foto com anel de status */}
      <Link href={`/pets/${pet.id}`} className="pressable relative shrink-0" aria-label={t('pw.pets.openProfile', { name: pet.name })}>
        <div className={`w-24 h-24 md:w-28 md:h-28 rounded-full p-[3.5px] bg-gradient-to-tr ${ring}`}>
          <div className="w-full h-full rounded-full p-[3px] bg-white dark:bg-surface-900">
            <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
              {pet.photo_url ? (
                <Image
                  src={pet.photo_url}
                  alt={pet.name}
                  width={112}
                  height={112}
                  className="object-cover w-full h-full"
                  priority
                />
              ) : (
                <span className="text-5xl">{getSpeciesEmoji(pet.species)}</span>
              )}
            </div>
          </div>
        </div>
        {streak > 0 && (
          <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-white dark:bg-surface-800 border border-orange-200 dark:border-orange-900 text-orange-600 rounded-full pl-1.5 pr-2 py-0.5 text-xs font-bold shadow-sm">
            <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-500" />
            {streak}
          </span>
        )}
      </Link>

      {/* Saudação + status */}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-surface-500 dark:text-surface-400 leading-tight truncate">
          {t('dash.greeting', { name: userName ?? t('pw.pets.ownerFallback') })}
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight truncate">
          {pet.name}
        </h1>
        <p className="text-xs md:text-sm text-surface-500 dark:text-surface-400 truncate">
          {[pet.breed?.name, formatAge(pet.birth_date)].filter(Boolean).join(' · ')}
        </p>
        <p className={`text-xs md:text-sm font-medium mt-1 truncate ${
          hasOverdue ? 'text-red-600' : hasUpcoming ? 'text-amber-600' : 'text-emerald-600'
        }`}>
          {statusLabel}
        </p>
      </div>
    </div>
  )
}
