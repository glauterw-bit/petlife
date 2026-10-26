'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, CircleDashed, Clock, Syringe, Camera, CreditCard, Pill, Bug, type LucideIcon } from 'lucide-react'
import type { CareItem, CareKind, CareState, PetCareSummary } from '@/lib/care'
import { formatAge, cn } from '@/lib/utils'
import { hapticLight } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'
import { ProtectionRing } from '@/components/ui/ProtectionRing'
import { CareStatusList } from '@/components/ui/CareStatusList'
import { buttonClasses } from '@/components/ui/Button'
import { StreakFlame } from '@/components/health/StreakFlame'

type TFn = (key: string, vars?: Record<string, string | number>) => string

export interface NextAction {
  label: string
  icon: LucideIcon
  variant: 'primary' | 'secondary'
  href?: string
  /** Vermífugo/antipulgas: abre a folha de registro do ProtectionCard. */
  register?: { petId: number; kind: 'vermifugo' | 'antipulgas' }
}

const KIND_LABEL: Record<CareKind, string> = {
  vaccines: 'ui.care.vaccines',
  vermifugo: 'ui.care.vermifugo',
  antipulgas: 'ui.care.antipulgas',
}

/** Link de registro de dose — contrato com a tela de vacinas (P3). */
export function vaccineAddHref(petId: number, name?: string): string {
  const q = new URLSearchParams({ pet: String(petId), add: '1' })
  if (name) q.set('name', name)
  return `/health/vaccines?${q.toString()}`
}

/** A única próxima ação do pet. Ordem: item urgente → 1ª vacina → antiparasitário sem registro → carteirinha. */
export function nextActionFor(summary: PetCareSummary, t: TFn): NextAction {
  const { pet, next, items } = summary
  if (next) {
    if (next.kind === 'vaccines') {
      const vaccine = next.vaccineName ?? t('ui.care.vaccines')
      return {
        label: t(next.state === 'overdue' ? 'home.next.vaxOverdue' : 'home.next.vaxSoon', { vaccine, pet: pet.name }),
        icon: Syringe,
        variant: 'primary',
        href: vaccineAddHref(pet.id, next.vaccineName),
      }
    }
    return {
      label: t(next.state === 'overdue' ? 'home.next.protOverdue' : 'home.next.protSoon', { kind: t(KIND_LABEL[next.kind]), pet: pet.name }),
      icon: next.kind === 'vermifugo' ? Pill : Bug,
      variant: 'primary',
      register: { petId: pet.id, kind: next.kind },
    }
  }
  if (items[0].state === 'never') {
    return {
      label: t('home.next.firstVaccine', { pet: pet.name }),
      icon: Camera,
      variant: 'primary',
      href: `/health/vaccines?pet=${pet.id}&scan=1`,
    }
  }
  const neverProt = items.find(i => i.kind !== 'vaccines' && i.state === 'never') as (CareItem & { kind: 'vermifugo' | 'antipulgas' }) | undefined
  if (neverProt) {
    return {
      label: t(neverProt.kind === 'vermifugo' ? 'home.next.vermNever' : 'home.next.fleaNever', { pet: pet.name }),
      icon: neverProt.kind === 'vermifugo' ? Pill : Bug,
      variant: 'primary',
      register: { petId: pet.id, kind: neverProt.kind },
    }
  }
  return {
    label: t('home.next.card'),
    icon: CreditCard,
    variant: 'secondary',
    href: `/health/vaccines/carteirinha/${pet.id}`,
  }
}

const HEADLINE: Record<CareState, { Icon: LucideIcon; chip: string }> = {
  overdue: { Icon: AlertCircle, chip: 'chip-danger' },
  soon: { Icon: Clock, chip: 'chip-warning' },
  never: { Icon: CircleDashed, chip: 'chip-neutral' },
  ok: { Icon: CheckCircle2, chip: 'chip-success' },
}

/**
 * Herói do pet no Início: foto dentro do Anel de proteção, situação item a
 * item (sempre com texto) e UM botão de próxima ação.
 */
export function PetHero({
  summary,
  pulseKind,
  onRegister,
}: {
  summary: PetCareSummary
  pulseKind?: CareKind
  onRegister: (petId: number, kind: 'vermifugo' | 'antipulgas') => void
}) {
  const t = useT()
  const router = useRouter()
  const { pet, worst } = summary
  const age = formatAge(pet.birth_date)
  const meta = [pet.breed?.name, age && age !== '—' ? age : null].filter(Boolean).join(' · ')
  const head = HEADLINE[worst]
  const action = nextActionFor(summary, t)
  const ActionIcon = action.icon
  const actionCls = buttonClasses(action.variant, 'lg', true, 'whitespace-normal text-center leading-snug py-3 [&>span]:whitespace-normal')

  function onItem(item: CareItem) {
    if (item.kind === 'vaccines') {
      void hapticLight()
      router.push(item.state === 'never' ? `/health/vaccines?pet=${pet.id}&scan=1` : `/health/vaccines?pet=${pet.id}`)
    } else {
      onRegister(pet.id, item.kind)
    }
  }

  return (
    <div className="rounded-3xl border bg-white dark:bg-surface-900 border-surface-200/70 dark:border-surface-800 shadow-card p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-center gap-4">
        <Link
          href={`/pets/${pet.id}`}
          aria-label={t('home.hero.openPet', { name: pet.name })}
          className="pressable rounded-full shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          onClick={() => void hapticLight()}
        >
          <ProtectionRing summary={summary} size={148} pulseKind={pulseKind} />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-surface-900 dark:text-white truncate">
            {pet.name}
          </h2>
          {meta && <p className="text-sm text-surface-600 dark:text-surface-400 truncate mt-0.5">{meta}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <span className={cn('chip', head.chip)}>
              <head.Icon className="w-3.5 h-3.5" aria-hidden strokeWidth={2.4} />
              {t(`home.hero.state.${worst}`)}
            </span>
            <StreakFlame pet={pet} variant="chip" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex-1">
        <CareStatusList summary={summary} compact onItemClick={onItem} />
      </div>

      <div className="mt-3">
        {action.href ? (
          <Link href={action.href} className={actionCls} onClick={() => void hapticLight()}>
            <ActionIcon className="w-5 h-5 shrink-0" aria-hidden />
            <span>{action.label}</span>
          </Link>
        ) : (
          <button
            type="button"
            className={actionCls}
            onClick={() => action.register && onRegister(action.register.petId, action.register.kind)}
          >
            <ActionIcon className="w-5 h-5 shrink-0" aria-hidden />
            <span>{action.label}</span>
          </button>
        )}
      </div>
    </div>
  )
}
