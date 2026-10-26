'use client'

import Link from 'next/link'
import { Camera, CreditCard, Footprints, Scale, BellPlus, Trophy, Gift, ChevronRight, type LucideIcon } from 'lucide-react'
import { useT } from '@/contexts/LocaleContext'
import { haptic } from '@/lib/feedback'
import { cn } from '@/lib/utils'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'

/**
 * Atalhos em bento, com hierarquia: um cartão grande (Carteirinha quando o pet
 * já tem vacina; senão, a 1ª vacina — o passo que ativa o app), três médios
 * (Passeio, Pesar, Lembrete) e, no fim, uma faixa menor com Desafios e
 * Convide e ganhe — escondida enquanto o guia de primeiros passos estiver ativo.
 */
export function QuickActions({
  petId,
  petName,
  hasVaccine,
  showExtras = true,
}: {
  petId: number
  petName: string
  /** O pet tem ao menos uma vacina registrada. */
  hasVaccine: boolean
  /** false enquanto o OnboardingChecklist está na tela. */
  showExtras?: boolean
}) {
  const t = useT()
  const hero = hasVaccine
    ? { href: `/health/vaccines/carteirinha/${petId}`, icon: CreditCard, label: t('home.quick.card'), sub: t('home2.bento.cardSub', { name: petName }) }
    : { href: `/health/vaccines?pet=${petId}&scan=1`, icon: Camera, label: t('home2.bento.first'), sub: t('home2.bento.firstSub') }
  const HeroIcon = hero.icon
  const items: { href: string; icon: LucideIcon; label: string }[] = [
    { href: '/walks/active', icon: Footprints, label: t('home.quick.walk') },
    { href: `/pets/${petId}?tab=overview`, icon: Scale, label: t('home.quick.weigh') },
    { href: `/reminders?new=1&pet=${petId}`, icon: BellPlus, label: t('home2.bento.reminder') },
  ]

  return (
    <>
      <nav aria-label={t('home.quick.title')} className="grid grid-cols-3 gap-2.5 mb-5">
        <Link
          href={hero.href}
          onClick={() => haptic('tap')}
          className={cn(
            'pressable col-span-3 flex items-center gap-3.5 rounded-3xl p-4 min-h-[84px] border',
            hasVaccine
              ? 'bg-white border-surface-200/70 dark:bg-surface-900 dark:border-surface-800 shadow-card'
              : 'tone-brand-bg',
            FOCUS,
          )}
        >
          <span
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
              hasVaccine
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
                : 'bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950',
            )}
          >
            <HeroIcon className="w-6 h-6" aria-hidden />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-base font-extrabold leading-tight text-surface-900 dark:text-white">{hero.label}</span>
            <span className="block text-[13px] leading-snug mt-0.5 text-surface-600 dark:text-surface-300">{hero.sub}</span>
          </span>
          <ChevronRight className="w-5 h-5 shrink-0 text-surface-500 dark:text-surface-400" aria-hidden />
        </Link>

        {items.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            onClick={() => haptic('tap')}
            className={cn(
              'pressable flex flex-col items-start justify-between gap-3 rounded-2xl p-3 min-h-[92px] border bg-white border-surface-200/70 dark:bg-surface-900 dark:border-surface-800',
              FOCUS,
            )}
          >
            <span className="w-10 h-10 rounded-xl bg-surface-100 text-primary-700 dark:bg-surface-800 dark:text-primary-300 flex items-center justify-center">
              <Icon className="w-5 h-5" aria-hidden />
            </span>
            <span className="text-[13px] font-bold leading-tight text-surface-800 dark:text-surface-100">{label}</span>
          </Link>
        ))}
      </nav>

      {showExtras && (
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          {[
            { href: '/challenges', icon: Trophy, label: t('home.more.challenges'), sub: t('home.more.challengesSub') },
            { href: '/plans#indicacao', icon: Gift, label: t('home.ref.title'), sub: t('home.ref.subFallback') },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link
              key={href}
              href={href}
              onClick={() => haptic('tap')}
              className={cn(
                'pressable flex items-center gap-2.5 rounded-2xl px-3 py-2.5 min-h-[56px] bg-surface-100 dark:bg-surface-900',
                FOCUS,
              )}
            >
              <Icon className="w-5 h-5 shrink-0 text-primary-700 dark:text-primary-300" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight text-surface-900 dark:text-white">{label}</span>
                <span className="block text-xs text-surface-600 dark:text-surface-400 leading-snug">{sub}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
