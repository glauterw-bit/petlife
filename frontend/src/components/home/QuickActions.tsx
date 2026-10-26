'use client'

import Link from 'next/link'
import { Syringe, CreditCard, Footprints, Scale, Trophy, type LucideIcon } from 'lucide-react'
import { useT } from '@/contexts/LocaleContext'
import { hapticLight } from '@/lib/feedback'
import { Card } from '@/components/ui/Card'
import { ReferralCard } from '@/components/growth/ReferralCard'
import { vaccineAddHref } from '@/components/pets/PetHero'

/** Quatro atalhos em tom único + linha com Desafios e Convide e ganhe. */
export function QuickActions({ petId }: { petId: number }) {
  const t = useT()
  const items: { href: string; icon: LucideIcon; label: string }[] = [
    { href: vaccineAddHref(petId), icon: Syringe, label: t('home.quick.vaccine') },
    { href: `/health/vaccines/carteirinha/${petId}`, icon: CreditCard, label: t('home.quick.card') },
    { href: '/walks/active', icon: Footprints, label: t('home.quick.walk') },
    { href: `/pets/${petId}?tab=overview`, icon: Scale, label: t('home.quick.weigh') },
  ]
  return (
    <>
      <nav aria-label={t('home.quick.title')} className="grid grid-cols-4 gap-2 mb-5">
        {items.map(({ href, icon: Icon, label }) => (
          <Link
            key={label}
            href={href}
            onClick={() => void hapticLight()}
            className="pressable flex flex-col items-center gap-1.5 rounded-2xl py-2 min-h-[72px] text-center hover:bg-surface-100 dark:hover:bg-surface-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <span className="w-12 h-12 rounded-2xl bg-surface-100 text-primary-700 dark:bg-surface-800 dark:text-primary-300 flex items-center justify-center">
              <Icon className="w-[22px] h-[22px]" aria-hidden />
            </span>
            <span className="text-[11px] font-semibold leading-tight text-surface-700 dark:text-surface-200">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card href="/challenges" padding="md" className="h-full">
          <span className="w-9 h-9 rounded-xl bg-surface-100 text-primary-700 dark:bg-surface-800 dark:text-primary-300 flex items-center justify-center mb-2">
            <Trophy className="w-5 h-5" aria-hidden />
          </span>
          <span className="block text-sm font-bold text-surface-900 dark:text-white">{t('home.more.challenges')}</span>
          <span className="block text-xs text-surface-600 dark:text-surface-400 leading-snug mt-0.5">{t('home.more.challengesSub')}</span>
        </Card>
        <ReferralCard variant="compact" />
      </div>
    </>
  )
}
