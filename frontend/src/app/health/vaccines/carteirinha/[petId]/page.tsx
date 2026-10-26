'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Plane, Plus, Send } from 'lucide-react'
import { petExport } from '@/lib/api'
import { formatAge, formatDate, cn, localeTag } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { trackHappyMoment } from '@/lib/review'
import { requestSoftUpsell } from '@/lib/softUpsell'
import { useCached } from '@/lib/cache'
import { latestDoses, sortByUrgency, vaccineState } from '@/lib/care'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  WalletPass, carteirinhaPublicUrl, carteirinhaVaccines, rabiesInfo, type CarteirinhaData,
} from '@/components/health/WalletPass'
import { SendToSheet } from '@/components/health/SendToSheet'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

class LoadError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`)
  }
}

/** Sessão expirada: o app manda para o login, sem toast nem erro na tela. */
function redirectToLogin() {
  try { localStorage.removeItem('petlife_token') } catch {}
  if (!window.location.pathname.startsWith('/auth/')) window.location.assign('/auth/login?session_expired=1')
}

async function fetchCarteirinha(petId: number): Promise<CarteirinhaData> {
  const token = localStorage.getItem('petlife_token')
  const res = await fetch(`${API_URL}/vaccines/pet/${petId}/carteirinha`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (res.status === 401) {
    redirectToLogin()
    throw new LoadError(401)
  }
  if (!res.ok) throw new LoadError(res.status)
  return res.json()
}

function PassSkeleton() {
  return (
    <div aria-hidden className="w-full max-w-sm mx-auto">
      <Skeleton className="w-full aspect-[0.66] rounded-3xl" />
      <Skeleton className="mx-auto mt-4 h-10 w-32 rounded-xl" />
      <div className="mt-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 p-4">
        <SkeletonText lines={4} />
      </div>
    </div>
  )
}

export default function CarteirinhaPage() {
  const t = useT()
  const params = useParams()
  const { success, error } = useToast()
  const petId = Number(params.petId)
  const q = useCached<CarteirinhaData>(Number.isFinite(petId) ? `carteirinha:${petId}` : null, () => fetchCarteirinha(petId))
  const [sendOpen, setSendOpen] = useState(false)
  const [flyKey, setFlyKey] = useState(0)

  const data = q.data
  const status = q.error instanceof LoadError ? q.error.status : q.error ? 0 : null

  function handlePrint() {
    window.print()
    // Imprimir a carteirinha é quase sempre pra entregar em hotel, creche ou
    // veterinário — é o momento em que o app acabou de resolver um problema real.
    trackHappyMoment('carteirinha_print')
  }

  async function handlePdf() {
    if (!data) return
    try {
      await petExport.sharePdf(data.pet.id, data.pet.name)
      trackHappyMoment('pdf_export')
      requestSoftUpsell('pdf')
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('wallet.loadError'))
      throw e
    }
  }

  const header = (
    <PageHeader
      title={data ? t('care.cardTitle', { pet: data.pet.name }) : t('wallet.title')}
      back
      large={false}
      showBell={false}
      actions={
        data ? (
          <Button size="sm" leftIcon={Send} onClick={() => setSendOpen(true)} aria-label={t('wallet.sendAria')}>
            {t('wallet.send')}
          </Button>
        ) : undefined
      }
    />
  )

  if (!data) {
    return (
      <>
        {header}
        {status === 404 ? (
          <EmptyState title={t('h.card.notFound')} ctaLabel={t('nav.back')} ctaHref="/health/vaccines" />
        ) : status !== null && status !== 401 ? (
          <Card padding="lg" className="max-w-sm mx-auto text-center mt-6">
            <p className="text-[15px] text-surface-700 dark:text-surface-200 mb-4">{t('wallet.loadError')}</p>
            <Button variant="secondary" loading={q.refreshing} onClick={() => void q.refresh()}>
              {t('ui.retry')}
            </Button>
          </Card>
        ) : (
          <div className="pt-2"><PassSkeleton /></div>
        )}
      </>
    )
  }

  const pet = data.pet
  const rabies = rabiesInfo(data)
  const showTravelTip = (rabies.kind === 'soon' || rabies.kind === 'expired') && rabies.daysLeft !== null
  let travelStatus = ''
  if (rabies.kind === 'expired') travelStatus = t('wallet.travelExpired')
  else if (rabies.kind === 'soon' && rabies.daysLeft !== null) {
    travelStatus =
      rabies.daysLeft === 0
        ? t('wallet.travelDueToday')
        : rabies.daysLeft === 1
          ? t('wallet.travelDueOne')
          : t('wallet.travelDueIn', { n: rabies.daysLeft })
  }
  const shareUrl = carteirinhaPublicUrl(data)
  const speciesLabel = pet.species === 'dog' ? t('pet.dog') : pet.species === 'cat' ? t('pet.cat') : t('h.card.speciesOther')
  const details = [
    { label: t('pet.species'), value: speciesLabel },
    { label: t('h.card.age'), value: formatAge(pet.birth_date) },
    { label: t('h.card.birth'), value: formatDate(pet.birth_date) },
    { label: t('h.card.weight'), value: pet.weight ? `${Number(pet.weight).toLocaleString(localeTag())} kg` : '—' },
    { label: t('pet.gender'), value: pet.gender === 'male' ? t('pet.male') : pet.gender === 'female' ? t('pet.female') : '—' },
    { label: t('pet.neutered'), value: pet.neutered ? t('common.yes') : t('common.no') },
    { label: t('pet.color'), value: pet.color ?? '—' },
    { label: t('pet.microchip'), value: pet.microchip ?? '—' },
    { label: t('h.card.tutor'), value: data.owner.name },
  ]
  const doses = sortByUrgency(latestDoses(carteirinhaVaccines(data)))

  return (
    <>
      {header}

      <div id="carteirinha-print" className="pb-8 pt-1">
        <WalletPass data={data} flyKey={flyKey} />

        {showTravelTip && (
          <Card tone={rabies.kind === 'expired' ? 'danger' : 'warning'} className="mt-5 max-w-sm mx-auto print:hidden">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                  rabies.kind === 'expired'
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
                )}
              >
                <Plane className="w-5 h-5" aria-hidden />
              </span>
              <p className="flex-1 text-sm leading-relaxed text-surface-800 dark:text-surface-100">
                {t('wallet.travelTip', { pet: pet.name, status: travelStatus })}
              </p>
            </div>
            <div className="mt-3 pl-[52px]">
              <Button
                size="sm"
                variant={rabies.kind === 'expired' ? 'primary' : 'soft'}
                leftIcon={Plus}
                href={`/health/vaccines?pet=${pet.id}&add=1&name=${encodeURIComponent('Antirrábica')}`}
              >
                {t('wallet.registerDose')}
              </Button>
            </div>
          </Card>
        )}

        <Card className="mt-5 max-w-sm mx-auto" padding="md">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-surface-600 dark:text-surface-300 mb-3">
            {t('wallet.details', { pet: pet.name })}
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {details.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-medium text-surface-500 dark:text-surface-400">{label}</dt>
                <dd className="text-[15px] font-semibold text-surface-900 dark:text-surface-100 truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Só na impressão: o histórico completo, já que o verso do passe não sai no papel */}
        <section className="hidden print:block mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide mb-2">{t('h.card.history')}</h2>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {doses.map(v => (
                <tr key={v.id} className="border-b border-surface-200">
                  <td className="py-1.5 font-semibold">{v.name}</td>
                  <td className="py-1.5">{t('wallet.given', { date: formatDate(v.date_given) })}</td>
                  <td className="py-1.5">{v.next_due ? t('wallet.next', { date: formatDate(v.next_due) }) : '—'}</td>
                  <td className="py-1.5">{t(`ui.status.${vaccineState(v)}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs">{t('wallet.footer', { date: formatDate(data.generated_at.slice(0, 10)) })}</p>
        </section>
      </div>

      <SendToSheet
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        petName={pet.name}
        shareUrl={shareUrl}
        onPdf={handlePdf}
        onPrint={handlePrint}
        onSent={() => {
          setFlyKey(k => k + 1)
          success(t('wallet.sent'))
        }}
      />

      {/* Impressão: só a carteirinha, com as cores do passe */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #carteirinha-print, #carteirinha-print * { visibility: visible !important; }
          #carteirinha-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          #carteirinha-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
    </>
  )
}
