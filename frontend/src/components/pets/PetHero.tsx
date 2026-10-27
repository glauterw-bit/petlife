'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { m } from 'framer-motion'
import { AlertCircle, CheckCircle2, CircleDashed, Clock, Syringe, Camera, CreditCard, Pill, Bug, Loader2, ExternalLink, type LucideIcon } from 'lucide-react'
import type { CareItem, CareKind, CareState, PetCareSummary } from '@/lib/care'
import { dogHumanAge } from '@/lib/care'
import type { Pet } from '@/lib/api'
import { Sheet } from '@/components/ui/Sheet'
import { pets as petsApi } from '@/lib/api'
import { invalidate } from '@/lib/cache'
import { formatAge, cn } from '@/lib/utils'
import { haptic } from '@/lib/feedback'
import { homeChoreo } from '@/lib/motion'
import { useT } from '@/contexts/LocaleContext'
import { useToast } from '@/components/ui/ToastContext'
import { ProtectionRing } from '@/components/ui/ProtectionRing'
import { careStateLabel, careStateShort } from '@/components/ui/StatusBadge'
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
        // A frase de status já diz o que venceu; o botão diz só a ação.
        label: t('home2.next.vax', { vaccine, pet: pet.name }),
        icon: Syringe,
        variant: 'primary',
        href: vaccineAddHref(pet.id, next.vaccineName),
      }
    }
    return {
      label: t('home2.next.prot', { kind: t(`ntf.kind.${next.kind}`), pet: pet.name }),
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

/** DOI do estudo usado em dogHumanAge (Wang et al., Cell Systems 2020). */
export const DOG_AGE_DOI_URL = 'https://doi.org/10.1016/j.cels.2020.06.006'

/**
 * Chip "≈ N anos humanos" (só cães com 1 ano ou mais — dogHumanAge devolve
 * null nos outros casos e o chip não aparece). O toque abre a explicação
 * com a fonte e a ressalva: é estimativa, feita com Labradores.
 */
export function HumanAgeChip({ pet, className }: { pet: Pick<Pet, 'name' | 'species' | 'birth_date'>; className?: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const n = dogHumanAge(pet)
  if (n == null) return null
  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic('tap')
          setOpen(true)
        }}
        aria-label={t('pet3.age.chipAria', { n })}
        aria-haspopup="dialog"
        className={cn(
          // alvo de 44 px com o chip visual menor
          'pressable relative inline-flex items-center min-h-[44px] -my-2.5 px-0.5',
          className,
        )}
      >
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular-nums bg-primary-50 text-primary-800 dark:bg-primary-500/15 dark:text-primary-200">
          {t('pet3.age.chip', { n })}
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('pet3.age.title')}>
        <div className="space-y-3 pb-2 text-[15px] leading-relaxed text-surface-700 dark:text-surface-200">
          <p className="font-display text-xl font-extrabold text-surface-900 dark:text-white">
            {t('pet3.age.lead', { name: pet.name, n })}
          </p>
          <p>{t('pet3.age.how')}</p>
          <p>{t('pet3.age.caveat')}</p>
          <p className="text-[13px] text-surface-600 dark:text-surface-400">{t('pet3.age.from1')}</p>
          <a
            href={DOG_AGE_DOI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[44px] font-semibold text-primary-700 dark:text-primary-300"
          >
            <ExternalLink className="w-4 h-4" aria-hidden />
            {t('pet3.age.source')}
          </a>
        </div>
      </Sheet>
    </>
  )
}

const HEADLINE: Record<CareState, { Icon: LucideIcon; text: string }> = {
  overdue: { Icon: AlertCircle, text: 'text-red-700 dark:text-red-300' },
  soon: { Icon: Clock, text: 'text-amber-800 dark:text-amber-300' },
  never: { Icon: CircleDashed, text: 'text-surface-600 dark:text-surface-300' },
  ok: { Icon: CheckCircle2, text: 'text-emerald-700 dark:text-emerald-300' },
}

/** A frase de status do cartão: a linha mais grave (o quê + quando). */
function statusLine(summary: PetCareSummary, t: TFn): { what?: string; state: string; short?: string } {
  const worstItem = summary.next ?? summary.items.find(i => i.state === summary.worst) ?? summary.items[0]
  if (summary.worst === 'overdue' || summary.worst === 'soon') {
    return {
      what: worstItem.vaccineName ?? t(KIND_LABEL[worstItem.kind]),
      state: careStateLabel(t, worstItem.state, worstItem.daysLeft),
      // Coluna estreita ao lado do anel: forma curta numa linha só; a frase
      // completa fica para o VoiceOver e na lista logo abaixo.
      short: careStateShort(t, worstItem.state, worstItem.daysLeft),
    }
  }
  return { state: t(`home.hero.state.${summary.worst}`) }
}

/**
 * Herói do pet no Início: foto dentro do Anel de proteção, UMA frase de
 * status (a linha mais grave), a situação item a item e UM botão de ação.
 * Sem foto, um selo de câmera convida a subir a foto ali mesmo.
 */
export function PetHero({
  summary,
  pulseKind,
  onRegister,
  animateRing = true,
  choreo = false,
  onStreak,
  onPhotoChanged,
}: {
  summary: PetCareSummary
  pulseKind?: CareKind
  onRegister: (petId: number, kind: 'vermifugo' | 'antipulgas') => void
  /** false = arcos já desenhados (visitas seguintes do Início). */
  animateRing?: boolean
  /** true = participa da entrada em 4 tempos (o botão chega por último). */
  choreo?: boolean
  onStreak?: (petId: number, streak: number) => void
  /** Depois de subir a foto (o Início recarrega a lista de pets). */
  onPhotoChanged?: () => void
}) {
  const t = useT()
  const router = useRouter()
  const { success, error: showError } = useToast()
  const { pet, worst } = summary
  const age = formatAge(pet.birth_date)
  const meta = [pet.breed?.name, age && age !== '—' ? age : null].filter(Boolean).join(' · ')
  const head = HEADLINE[worst]
  const status = statusLine(summary, t)
  const action = nextActionFor(summary, t)
  const ActionIcon = action.icon
  const actionCls = buttonClasses(action.variant, 'lg', true, 'whitespace-normal text-center leading-snug py-3 [&>span]:whitespace-normal')
  const photoInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  function onItem(item: CareItem) {
    if (item.kind === 'vaccines') {
      haptic('tap')
      router.push(item.state === 'never' ? `/health/vaccines?pet=${pet.id}&scan=1` : `/health/vaccines?pet=${pet.id}`)
    } else {
      onRegister(pet.id, item.kind)
    }
  }

  // Mesmo fluxo do botão de câmera da ficha do pet.
  async function onPhotoPicked(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setUploading(true)
    try {
      await petsApi.uploadPhoto(pet.id, f)
      invalidate('pets')
      onPhotoChanged?.()
      haptic('saved')
      success(t('pw.pet.photoUpdated'))
    } catch (err) {
      haptic('error')
      const m = err instanceof Error && err.message && !/fetch|network|load failed/i.test(err.message) ? err.message : ''
      showError(m ? `${t('pw.pet.photoError')} ${m}` : t('pw.pet.photoError'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-3xl border bg-white dark:bg-surface-900 border-surface-200/70 dark:border-surface-800 shadow-card p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Link
            href={`/pets/${pet.id}`}
            aria-label={t('home.hero.openPet', { name: pet.name })}
            className="pressable block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            onClick={() => haptic('tap')}
          >
            <ProtectionRing summary={summary} size={148} pulseKind={pulseKind} animate={animateRing} />
          </Link>
          {!pet.photo_url && (
            <>
              <button
                type="button"
                aria-label={t('home2.addPhoto', { name: pet.name })}
                title={t('home2.addPhoto', { name: pet.name })}
                disabled={uploading}
                aria-busy={uploading || undefined}
                onClick={() => { haptic('tap'); photoInput.current?.click() }}
                className="pressable absolute bottom-0.5 right-0.5 w-11 h-11 flex items-center justify-center rounded-full disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <span className="w-9 h-9 rounded-full flex items-center justify-center bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950 ring-[3px] ring-white dark:ring-surface-900 shadow-card">
                  {uploading ? <Loader2 className="w-[18px] h-[18px] animate-spin" aria-hidden /> : <Camera className="w-[18px] h-[18px]" aria-hidden />}
                </span>
              </button>
              <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={onPhotoPicked} aria-hidden tabIndex={-1} />
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-surface-900 dark:text-white truncate">
            {pet.name}
          </h2>
          {meta && <p className="text-sm text-surface-600 dark:text-surface-400 truncate mt-0.5">{meta}</p>}
          <p className={cn('mt-2 flex items-start gap-1.5 text-sm font-semibold leading-snug', head.text)}>
            <head.Icon className="w-4 h-4 mt-[2px] shrink-0" aria-hidden strokeWidth={2.4} />
            <span>
              {status.what && <span className="block">{status.what}</span>}
              {status.short ? (
                <>
                  <span className="block font-medium whitespace-nowrap" aria-hidden>{status.short}</span>
                  <span className="sr-only">{status.state}</span>
                </>
              ) : (
                <span className="block">{status.state}</span>
              )}
            </span>
          </p>
          <div className="mt-2 empty:hidden flex">
            <StreakFlame pet={pet} variant="chip" onLoaded={onStreak} />
          </div>
          {uploading && <p role="status" className="mt-1 text-xs text-surface-600 dark:text-surface-400">{t('petx.photoUploading')}</p>}
        </div>
      </div>

      <div className="mt-3 flex-1">
        <CareStatusList summary={summary} compact onItemClick={onItem} />
      </div>

      <m.div className="mt-3" variants={choreo ? homeChoreo.cta : undefined}>
        {action.href ? (
          <Link href={action.href} className={actionCls} onClick={() => haptic('tap')}>
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
      </m.div>
    </div>
  )
}
