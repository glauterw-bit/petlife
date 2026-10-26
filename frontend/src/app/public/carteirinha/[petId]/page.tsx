'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Printer, AlertCircle, Info, Syringe, ShieldCheck, ShieldAlert, Dog, Cat, PawPrint, History, ChevronDown,
} from 'lucide-react'
import { formatAge, getSpeciesLabel, localeTag, cn } from '@/lib/utils'
import { normalizeVaccineName, daysUntil, SOON_DAYS } from '@/lib/care'
import { DownloadCta } from '@/components/public/DownloadCta'
import { usePublicColorScheme } from '@/components/public/usePublicColorScheme'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import { useT } from '@/contexts/LocaleContext'
import { variants, spring } from '@/lib/motion'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

interface CardVaccine {
  id: number
  name: string
  date_given: string
  next_due: string | null
  lot_number: string | null
  veterinarian: string | null
  notes?: string | null
}

interface CardData {
  pet: {
    id: number
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
  owner: { name: string }
  vaccines: CardVaccine[]
  generated_at: string
}

type VState = 'ok' | 'soon' | 'overdue'

function stateOf(v: CardVaccine): VState {
  if (!v.next_due) return 'ok'
  const d = daysUntil(v.next_due)
  if (d < 0) return 'overdue'
  if (d <= SOON_DAYS) return 'soon'
  return 'ok'
}

const SEVERITY: Record<VState, number> = { overdue: 2, soon: 1, ok: 0 }

/**
 * Data sem ambiguidade (mês por extenso) no idioma de quem abre: "25 de out. de 2026".
 * dd/MM vs MM/dd confundia hotel e creche; com o mês escrito não há como errar.
 * Lê 'YYYY-MM-DD' como data local para não voltar um dia por fuso.
 */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(localeTag(), { day: '2-digit', month: 'short', year: 'numeric' })
}

function isRabies(name: string) {
  const n = normalizeVaccineName(name)
  return n.includes('antirrab') || n.includes('antirab') || n.includes('raiva') || n.includes('rabies') || n.includes('rabia')
}

export default function PublicCarteirinhaPage() {
  usePublicColorScheme()
  const t = useT()
  const params = useParams()
  const petId = String(params.petId)
  const [data, setData] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [showOld, setShowOld] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/public/carteirinha/${encodeURIComponent(petId)}`)
        if (res.status === 404) { setErrorKey('pub.card.notFound'); return }
        if (!res.ok) { setErrorKey('pub.card.loadError'); return }
        setData(await res.json())
      } catch {
        setErrorKey('pub.card.connError')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [petId])

  /** Só a dose mais recente de cada vacina conta para a situação; as antigas viram histórico. */
  const { current, previous } = useMemo(() => {
    const latest = new Map<string, CardVaccine>()
    const prev: CardVaccine[] = []
    const byDate = [...(data?.vaccines ?? [])].sort((a, b) => b.date_given.localeCompare(a.date_given))
    for (const v of byDate) {
      const k = normalizeVaccineName(v.name)
      if (latest.has(k)) prev.push(v)
      else latest.set(k, v)
    }
    const cur = Array.from(latest.values()).sort((a, b) => {
      const s = SEVERITY[stateOf(b)] - SEVERITY[stateOf(a)]
      if (s) return s
      return (a.next_due ?? '9999').localeCompare(b.next_due ?? '9999')
    })
    return { current: cur, previous: prev }
  }, [data])

  if (loading) {
    return (
      <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 py-8 px-4" aria-busy="true">
        <span className="sr-only">{t('pub.card.loading')}</span>
        <div className="max-w-xl mx-auto space-y-4">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </main>
    )
  }

  if (errorKey || !data) {
    return (
      <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/70 dark:border-surface-800 p-10">
          <span className="w-14 h-14 mx-auto rounded-full bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7" aria-hidden />
          </span>
          <h1 className="text-lg font-bold text-surface-900 dark:text-white mb-1">{t('pub.card.errorTitle')}</h1>
          <p className="text-sm text-surface-600 dark:text-surface-400">{t(errorKey ?? 'pub.card.loadError')}</p>
        </div>
      </main>
    )
  }

  const pet = data.pet
  const SpeciesIcon = pet.species === 'dog' ? Dog : pet.species === 'cat' ? Cat : PawPrint
  const overdue = current.filter(v => stateOf(v) === 'overdue').length
  const soon = current.filter(v => stateOf(v) === 'soon').length
  const okCount = current.length - overdue - soon
  const rabies = current.find(v => isRabies(v.name)) ?? null
  const rabiesState = rabies ? stateOf(rabies) : null

  const details: { label: string; value: string }[] = [
    { label: t('pub.card.species'), value: getSpeciesLabel(pet.species) },
    { label: t('pub.card.age'), value: formatAge(pet.birth_date) },
    { label: t('pub.card.birth'), value: fmtDate(pet.birth_date) },
    { label: t('pub.card.weight'), value: pet.weight ? `${pet.weight.toLocaleString(localeTag())} kg` : '—' },
    { label: t('pub.card.sex'), value: pet.gender === 'male' ? t('pub.card.male') : pet.gender === 'female' ? t('pub.card.female') : '—' },
    { label: t('pub.card.neutered'), value: pet.neutered ? t('pub.yes') : t('pub.no') },
    { label: t('pub.card.color'), value: pet.color ?? '—' },
    { label: t('pub.card.microchip'), value: pet.microchip ?? '—' },
  ]

  return (
    <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 py-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] print:bg-white print:py-0">
      <div className="max-w-xl mx-auto">
        {/* Aviso honesto: quem lançou as vacinas foi o tutor */}
        <div className="flex items-start gap-3 rounded-2xl px-4 py-3 mb-4 bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 print:border-surface-300">
          <Info className="w-5 h-5 text-sky-700 dark:text-sky-300 shrink-0 mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-surface-900 dark:text-white leading-snug">{t('pub.card.trustTitle')}</p>
            <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">
              {t('pub.card.updatedAt', { date: fmtDate(data.generated_at) })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="print:hidden shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 -my-1 -mr-1 rounded-xl text-sm font-semibold text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
            aria-label={t('pub.card.print')}
          >
            <Printer className="w-4 h-4" aria-hidden />
            <span className="hidden sm:inline">{t('pub.card.print')}</span>
          </button>
        </div>

        {/* Passe: cartão verde no estilo Wallet */}
        <motion.section
          aria-labelledby="pass-name"
          initial="hidden"
          animate="show"
          variants={variants.scaleIn}
          transition={spring.soft}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-700 to-emerald-800 text-white p-5 shadow-float print:shadow-none"
        >
          <SpeciesIcon className="absolute -right-6 -bottom-6 w-40 h-40 text-white/10" aria-hidden strokeWidth={1.4} />
          <div className="relative flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-white/85">
            <span className="inline-flex items-center gap-1.5"><Syringe className="w-3.5 h-3.5" aria-hidden />{t('pub.card.eyebrow')}</span>
            <span className="inline-flex items-center gap-1"><PawPrint className="w-3.5 h-3.5" aria-hidden />PetLife</span>
          </div>

          <div className="relative flex items-center gap-4 mt-4">
            {pet.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API_URL}${pet.photo}`}
                alt={pet.name}
                className="w-20 h-20 rounded-2xl object-cover ring-2 ring-white/40 shadow-lg shrink-0"
              />
            ) : (
              <span className="w-20 h-20 rounded-2xl bg-white/15 ring-2 ring-white/30 flex items-center justify-center shrink-0">
                <SpeciesIcon className="w-10 h-10" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <h1 id="pass-name" className="font-display text-3xl font-extrabold leading-tight truncate">{pet.name}</h1>
              <p className="text-sm text-white/90 truncate">
                {getSpeciesLabel(pet.species)} · {pet.breed ?? t('pub.card.mixed')}
              </p>
              <p className="text-xs text-white/80 mt-0.5">{t('pub.card.tutor', { name: data.owner.name })}</p>
            </div>
          </div>

          {/* Selo da antirrábica */}
          {rabies && (
            <div
              className={cn(
                'relative mt-4 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5',
                rabiesState === 'overdue' ? 'bg-red-950/40 ring-1 ring-red-200/40' : 'bg-white/15 ring-1 ring-white/25',
              )}
            >
              {rabiesState === 'overdue'
                ? <ShieldAlert className="w-5 h-5 shrink-0" aria-hidden />
                : <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden />}
              <p className="text-sm font-semibold leading-tight">
                {rabiesState === 'overdue'
                  ? t('pub.card.rabiesOverdue', { date: fmtDate(rabies.next_due) })
                  : rabies.next_due
                    ? t('pub.card.rabiesOk', { date: fmtDate(rabies.next_due) })
                    : t('pub.card.rabiesGiven', { date: fmtDate(rabies.date_given) })}
              </p>
            </div>
          )}

          <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-3 py-1">
              {current.length === 1 ? t('pub.card.vaccinesOne') : t('pub.card.vaccinesMany', { n: current.length })}
            </span>
            {okCount > 0 && <span className="rounded-full bg-white/15 px-3 py-1">{t('pub.card.okCount', { n: okCount })}</span>}
            {soon > 0 && <span className="rounded-full bg-amber-300 text-amber-950 px-3 py-1">{soon === 1 ? t('pub.card.soonOne') : t('pub.card.soonCount', { n: soon })}</span>}
            {overdue > 0 && <span className="rounded-full bg-white text-red-800 px-3 py-1">{overdue === 1 ? t('pub.card.overdueOne') : t('pub.card.overdueCount', { n: overdue })}</span>}
          </div>
        </motion.section>

        {/* Dados do pet */}
        <section aria-labelledby="pet-data" className="mt-4 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 p-5">
          <h2 id="pet-data" className="sr-only">{t('pub.card.dataTitle')}</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {details.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</dt>
                <dd className="text-sm font-semibold text-surface-900 dark:text-surface-100 mt-0.5 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Vacinas */}
        <section aria-labelledby="vax-title" className="mt-4 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 p-5">
          <h2 id="vax-title" className="text-base font-bold font-display text-surface-900 dark:text-white mb-3">{t('pub.card.vaccinesTitle')}</h2>

          {current.length === 0 ? (
            <p className="text-center py-6 text-sm text-surface-600 dark:text-surface-400">{t('pub.card.noVaccines')}</p>
          ) : (
            <ul className="space-y-2.5">
              {current.map(v => <VaccineRow key={v.id} v={v} state={stateOf(v)} />)}
            </ul>
          )}

          {previous.length > 0 && (
            <div className="mt-4 border-t border-surface-100 dark:border-surface-800 pt-3">
              <button
                type="button"
                onClick={() => setShowOld(s => !s)}
                aria-expanded={showOld}
                className="print:hidden w-full flex items-center justify-between min-h-[44px] text-sm font-semibold text-surface-700 dark:text-surface-200"
              >
                <span className="inline-flex items-center gap-2">
                  <History className="w-4 h-4" aria-hidden />
                  {t('pub.card.previous', { n: previous.length })}
                </span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', showOld && 'rotate-180')} aria-hidden />
              </button>
              <ul className={cn('space-y-2.5 mt-2', !showOld && 'hidden print:block')}>
                {previous.map(v => <VaccineRow key={v.id} v={v} state="superseded" />)}
              </ul>
            </div>
          )}
        </section>

        <footer className="mt-4 px-1 text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
          <p>{t('pub.card.footer')}</p>
        </footer>

        <DownloadCta
          campanha="carteirinha"
          className="mt-6"
          headline={t('pub.card.ctaHeadline', { name: pet.name })}
          sub={t('pub.card.ctaSub')}
        />
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
    </main>
  )
}

function VaccineRow({ v, state }: { v: CardVaccine; state: VState | 'superseded' }) {
  const t = useT()
  return (
    <li className="rounded-xl border border-surface-200/70 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-800/40 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm text-surface-900 dark:text-white">{v.name}</span>
        <StatusBadge state={state} />
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-surface-600 dark:text-surface-400">
        <div className="flex gap-1">
          <dt className="font-medium text-surface-700 dark:text-surface-300">{t('pub.card.given')}</dt>
          <dd>{fmtDate(v.date_given)}</dd>
        </div>
        {v.next_due && state !== 'superseded' && (
          <div className="flex gap-1">
            <dt className="font-medium text-surface-700 dark:text-surface-300">{t('pub.card.next')}</dt>
            <dd>{fmtDate(v.next_due)}</dd>
          </div>
        )}
        {v.veterinarian && (
          <div className="flex gap-1">
            <dt className="font-medium text-surface-700 dark:text-surface-300">{t('pub.card.vet')}</dt>
            <dd>{v.veterinarian}</dd>
          </div>
        )}
        {v.lot_number && (
          <div className="flex gap-1">
            <dt className="font-medium text-surface-700 dark:text-surface-300">{t('pub.card.lot')}</dt>
            <dd>{v.lot_number}</dd>
          </div>
        )}
      </dl>
      {v.notes && <p className="text-xs text-surface-500 dark:text-surface-400 italic mt-1">{v.notes}</p>}
    </li>
  )
}
