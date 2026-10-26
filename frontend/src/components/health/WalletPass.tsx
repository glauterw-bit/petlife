'use client'

/**
 * Carteirinha no estilo Wallet: passe verde em tela cheia.
 *
 * Frente: foto, nome, espécie · raça · idade, selo da antirrábica (a vacina
 * que hotel, creche e viagem pedem), QR do link público e a origem dos dados
 * ("vacinas registradas pelo tutor" — nunca "verificada").
 * Verso: a dose mais recente de cada vacina. Tocar gira o cartão em 3D;
 * com "reduzir movimento", troca com crossfade.
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { AlertCircle, CheckCircle2, CircleDashed, Clock, PawPrint, RotateCw, ShieldAlert, ShieldCheck, ShieldQuestion, type LucideIcon } from 'lucide-react'
import { useT } from '@/contexts/LocaleContext'
import { formatAge, formatDate, formatServerDateTime, cn } from '@/lib/utils'
import { daysUntil, findRabies, latestDoses, sortByUrgency, vaccineState, SOON_DAYS } from '@/lib/care'
import { spring, usePrefersReducedMotion, dur, easeOut } from '@/lib/motion'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { Button } from '@/components/ui/Button'
import type { Vaccine } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

export interface CarteirinhaData {
  pet: {
    id: number
    public_token?: string
    name: string
    species: string
    breed: string | null
    birth_date: string | null
    weight: number | null
    color: string | null
    gender: string | null
    neutered: boolean
    microchip: string | null
    photo: string | null
  }
  owner: { name: string; email: string; phone?: string }
  vaccines: {
    id: number
    name: string
    date_given: string
    next_due: string | null
    lot_number: string | null
    veterinarian: string | null
    notes: string | null
    document_path: string | null
  }[]
  generated_at: string
}

/** Vacinas da carteirinha no formato que lib/care entende. */
export function carteirinhaVaccines(data: CarteirinhaData): Vaccine[] {
  return data.vaccines.map(v => ({
    id: v.id,
    pet_id: data.pet.id,
    name: v.name,
    date_given: v.date_given,
    next_due: v.next_due ?? undefined,
    lot_number: v.lot_number ?? undefined,
    veterinarian: v.veterinarian ?? undefined,
    notes: v.notes ?? undefined,
    document_path: v.document_path ?? undefined,
  }))
}

export function carteirinhaPhoto(photo: string | null): string | null {
  if (!photo) return null
  return /^https?:\/\//.test(photo) ? photo : `${API_URL}${photo}`
}

export function carteirinhaPublicUrl(data: CarteirinhaData): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/public/carteirinha/${data.pet.public_token ?? data.pet.id}`
}

export type RabiesInfo =
  | { kind: 'none' }
  | { kind: 'valid' | 'soon' | 'expired' | 'nodue'; vaccine: Vaccine; daysLeft: number | null }

export function rabiesInfo(data: CarteirinhaData): RabiesInfo {
  const r = findRabies(carteirinhaVaccines(data), data.pet.id)
  if (!r) return { kind: 'none' }
  if (!r.next_due) return { kind: 'nodue', vaccine: r, daysLeft: null }
  const d = daysUntil(r.next_due)
  return { kind: d < 0 ? 'expired' : d <= SOON_DAYS ? 'soon' : 'valid', vaccine: r, daysLeft: d }
}

/** Ícone + cor (nunca só a cor) para a situação de cada dose sobre o verde. */
const DOSE_ICON: Record<'ok' | 'soon' | 'overdue', { Icon: LucideIcon; cls: string }> = {
  ok: { Icon: CheckCircle2, cls: 'text-emerald-200' },
  soon: { Icon: Clock, cls: 'text-amber-200' },
  overdue: { Icon: AlertCircle, cls: 'text-red-200' },
}

function DoseIcon({ state, className }: { state: 'ok' | 'soon' | 'overdue'; className?: string }) {
  const { Icon, cls } = DOSE_ICON[state]
  return <Icon className={cn('w-4 h-4 shrink-0', cls, className)} aria-hidden strokeWidth={2.4} />
}

function speciesLabel(t: (k: string) => string, s: string) {
  return s === 'dog' ? t('pet.dog') : s === 'cat' ? t('pet.cat') : t('h.card.speciesOther')
}

/** Selo sobre o verde do passe: fundo branco sólido em qualquer tema (contraste AA). */
const PILL: Record<'ok' | 'soon' | 'overdue' | 'never', { cls: string; Icon: LucideIcon }> = {
  ok: { cls: 'text-emerald-800', Icon: CheckCircle2 },
  soon: { cls: 'text-amber-800', Icon: Clock },
  overdue: { cls: 'text-red-700', Icon: AlertCircle },
  never: { cls: 'text-surface-700', Icon: CircleDashed },
}

function PassPill({ state, children }: { state: keyof typeof PILL; children: string }) {
  const { cls, Icon } = PILL[state]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold shadow-sm', cls)}>
      <Icon className="w-3.5 h-3.5" aria-hidden strokeWidth={2.4} />
      {children}
    </span>
  )
}

function RabiesSeal({ info }: { info: RabiesInfo }) {
  const t = useT()
  let Icon = ShieldQuestion
  let text = t('wallet.rabiesNone')
  let badge = <PassPill state="never">{t('wallet.stNone')}</PassPill>
  if (info.kind !== 'none') {
    const due = info.vaccine.next_due
    if (info.kind === 'expired') {
      Icon = ShieldAlert
      text = t('wallet.rabiesExpired', { date: formatDate(due) })
      badge = <PassPill state="overdue">{t('wallet.stExpired')}</PassPill>
    } else if (info.kind === 'nodue') {
      Icon = ShieldCheck
      text = t('wallet.rabiesNoDue', { date: formatDate(info.vaccine.date_given) })
      badge = <PassPill state="ok">{t('wallet.stValid')}</PassPill>
    } else {
      Icon = ShieldCheck
      text = t('wallet.rabiesValid', { date: formatDate(due) })
      badge =
        info.kind === 'soon' ? (
          <PassPill state="soon">{t('wallet.stSoon')}</PassPill>
        ) : (
          <PassPill state="ok">{t('wallet.stValid')}</PassPill>
        )
    }
  }
  return (
    <div className="rounded-2xl bg-white/[0.12] border border-white/15 p-3 flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">{t('wallet.rabies')}</p>
        <p className="text-[15px] font-semibold leading-snug">{text}</p>
      </div>
      <div className="shrink-0">{badge}</div>
    </div>
  )
}

function Front({ data }: { data: CarteirinhaData }) {
  const t = useT()
  const pet = data.pet
  const url = carteirinhaPublicUrl(data)
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=022c22&margin=0`
  const doses = sortByUrgency(latestDoses(carteirinhaVaccines(data)))
  const meta = [speciesLabel(t, pet.species), pet.breed ?? t('h.card.mixedBreed'), pet.birth_date ? formatAge(pet.birth_date) : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold">
          <PawPrint className="w-4 h-4" aria-hidden /> PetLife
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/85">{t('wallet.badge')}</span>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <PetAvatar
          pet={{ name: pet.name, species: pet.species, photo_url: carteirinhaPhoto(pet.photo) }}
          size={72}
          priority
          className="ring-[3px] ring-white shadow-float"
        />
        <div className="min-w-0">
          <h2 className="font-display text-[28px] leading-tight font-extrabold truncate">{pet.name}</h2>
          <p className="text-sm text-white/90 truncate">{meta}</p>
        </div>
      </div>

      <div className="mt-5">
        <RabiesSeal info={rabiesInfo(data)} />
      </div>

      {doses.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/80 mb-2">{t('wallet.history')}</p>
          <ul className="flex flex-wrap gap-1.5">
            {doses.slice(0, 5).map(v => {
              const st = vaccineState(v)
              return (
                <li key={v.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] border border-white/15 pl-2 pr-2.5 py-1 text-[13px] font-semibold">
                  <DoseIcon state={st} className="w-3.5 h-3.5" />
                  {v.name}
                  <span className="sr-only">: {t(`ui.status.${st}`)}</span>
                </li>
              )
            })}
            {doses.length > 5 && (
              <li className="inline-flex items-center rounded-full bg-white/[0.12] px-2.5 py-1 text-[13px] font-semibold">+{doses.length - 5}</li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-4 flex items-end gap-4">
        <div className="bg-white rounded-2xl p-2.5 shrink-0 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={t('wallet.qrAlt', { name: pet.name })} width={104} height={104} className="w-[104px] h-[104px]" />
        </div>
        <div className="min-w-0 pb-1">
          <p className="text-[13px] leading-snug text-white/90">{t('wallet.qrHint')}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white/85">
            <RotateCw className="w-3.5 h-3.5" aria-hidden /> {t('wallet.tapFlip')}
          </p>
        </div>
      </div>

      <p className="mt-4 pt-3 border-t border-white/15 text-xs text-white/85">
        {t('wallet.footer', { date: formatServerDateTime(data.generated_at) })}
      </p>
    </div>
  )
}

function Back({ data }: { data: CarteirinhaData }) {
  const t = useT()
  const doses = sortByUrgency(latestDoses(carteirinhaVaccines(data)))
  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{data.pet.name}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/85">{t('wallet.history')}</span>
      </div>
      <div className="mt-4 flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
        {doses.length === 0 ? (
          <p className="text-sm text-white/90">{t('wallet.noVaccines')}</p>
        ) : (
          <ul className="divide-y divide-white/15">
            {doses.map(v => {
              const st = vaccineState(v)
              return (
                <li key={v.id} className="py-2.5 flex items-start gap-3">
                  <DoseIcon state={st} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug">{v.name}</p>
                    <p className="text-xs text-white/85">
                      {t('wallet.given', { date: formatDate(v.date_given) })}
                      {v.next_due ? ` · ${t('wallet.next', { date: formatDate(v.next_due) })}` : ''}
                    </p>
                  </div>
                  <span className="sr-only">{t(`ui.status.${st}`)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="mt-3 pt-3 border-t border-white/15 text-xs font-semibold text-white/85 inline-flex items-center gap-1.5">
        <RotateCw className="w-3.5 h-3.5" aria-hidden /> {t('wallet.tapBack')}
      </p>
    </div>
  )
}

const FACE =
  'absolute inset-0 rounded-3xl overflow-hidden text-white bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 shadow-float ring-1 ring-black/5 dark:ring-white/10'

export function WalletPass({
  data,
  onFlip,
  flyKey,
}: {
  data: CarteirinhaData
  onFlip?: (back: boolean) => void
  /** Mudar este número faz o cartão dar um "voo" curto (ao enviar). */
  flyKey?: number
}) {
  const t = useT()
  const reduced = usePrefersReducedMotion()
  const [back, setBack] = useState(false)
  const fly = useAnimationControls()

  useEffect(() => {
    if (!flyKey || reduced) return
    void fly.start({ y: [0, -16, 0], scale: [1, 0.96, 1], transition: { duration: 0.3, ease: easeOut } })
  }, [flyKey, reduced, fly])

  function toggle() {
    setBack(b => {
      onFlip?.(!b)
      return !b
    })
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <motion.div animate={fly} className="relative w-full aspect-[0.66] [perspective:1200px]">
        {reduced ? (
          <div className="absolute inset-0 cursor-pointer" onClick={toggle}>
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={back ? 'back' : 'front'}
                className={FACE}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur.micro }}
              >
                {back ? <Back data={data} /> : <Front data={data} />}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            className="absolute inset-0 cursor-pointer [transform-style:preserve-3d]"
            animate={{ rotateY: back ? 180 : 0 }}
            transition={spring.soft}
            onClick={toggle}
          >
            <div className={cn(FACE, '[backface-visibility:hidden] [-webkit-backface-visibility:hidden]')} aria-hidden={back}>
              <Front data={data} />
            </div>
            <div
              className={cn(FACE, '[backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)]')}
              aria-hidden={!back}
            >
              <Back data={data} />
            </div>
          </motion.div>
        )}
      </motion.div>
      <div className="mt-3 flex justify-center print:hidden">
        <Button variant="ghost" size="sm" leftIcon={RotateCw} aria-pressed={back} onClick={toggle}>
          {back ? t('wallet.flipFront') : t('wallet.flip')}
        </Button>
      </div>
    </div>
  )
}
