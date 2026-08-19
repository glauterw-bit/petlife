'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Share2, CheckCircle, AlertCircle, Clock, QrCode, Shield } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { pets as petsApi } from '@/lib/api'
import { formatDate, formatAge, getSpeciesEmoji } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

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

function vaccineStatus(next_due: string | null): 'up_to_date' | 'upcoming' | 'overdue' {
  if (!next_due) return 'up_to_date'
  const diff = (new Date(next_due).getTime() - Date.now()) / 86400000
  if (diff < 0) return 'overdue'
  if (diff <= 30) return 'upcoming'
  return 'up_to_date'
}

const statusConfig = {
  up_to_date: { labelKey: 'h.status.upToDate', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', Icon: CheckCircle, iconColor: 'text-emerald-500' },
  upcoming: { labelKey: 'h.status.upcoming', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', Icon: Clock, iconColor: 'text-amber-500' },
  overdue: { labelKey: 'h.status.overdue', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', Icon: AlertCircle, iconColor: 'text-red-500' },
}

export default function CarteirinhaPage() {
  const t = useT()
  const params = useParams()
  const router = useRouter()
  const { error } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)

  const petId = Number(params.petId)
  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/public/carteirinha/${petId}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(publicUrl)}&bgcolor=ffffff&color=1a1a2e&margin=10`

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('petlife_token')
        const res = await fetch(`${API_URL}/vaccines/pet/${petId}/carteirinha`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(t('h.card.loadError'))
        setData(await res.json())
      } catch (e: unknown) {
        error(e instanceof Error ? e.message : t('h.card.loadErrorGeneric'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [petId])

  function handlePrint() {
    window.print()
  }

  function handleShare() {
    // Compartilhamos o link público (acessível sem login), não a página privada.
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const shareUrl = `${origin}/public/carteirinha/${petId}`
    const text = t('h.card.shareText', { name: data?.pet.name ?? '', url: shareUrl })
    if (navigator.share) {
      navigator.share({ title: t('h.card.shareTitle', { name: data?.pet.name ?? '' }), text, url: shareUrl })
        .catch(() => {})
    } else {
      navigator.clipboard.writeText(shareUrl)
        .then(() => alert(t('h.card.linkCopied')))
    }
  }

  function shareWhatsApp() {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const shareUrl = `${origin}/public/carteirinha/${petId}`
    const text = encodeURIComponent(t('h.card.shareWhatsAppText', { name: data?.pet.name ?? '', url: shareUrl }))
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const totalVaccines = data?.vaccines.length ?? 0
  const upToDate = data?.vaccines.filter(v => vaccineStatus(v.next_due) === 'up_to_date').length ?? 0
  const overdue = data?.vaccines.filter(v => vaccineStatus(v.next_due) === 'overdue').length ?? 0

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>
  if (!data) return <DashboardLayout><div className="text-center py-20 text-surface-500 dark:text-surface-400">{t('h.card.notFound')}</div></DashboardLayout>

  const pet = data.pet
  const speciesLabel = pet.species === 'dog' ? t('pet.dog') : pet.species === 'cat' ? t('pet.cat') : t('h.card.speciesOther')

  return (
    <DashboardLayout>
      {/* Toolbar — hidden on print */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-surface-600 dark:text-surface-300 hover:text-surface-900 transition">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{t('nav.back')}</span>
        </button>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={shareWhatsApp}
            aria-label={t('h.card.ariaWhatsApp')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition"
          >
            <Share2 className="w-4 h-4" />
            WhatsApp
          </button>
          <button
            onClick={handleShare}
            aria-label={t('h.card.ariaShare')}
            className="flex items-center gap-2 px-4 py-2 border border-surface-200 dark:border-surface-700 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-200 hover:border-primary-300 hover:text-primary-700 transition"
          >
            <Share2 className="w-4 h-4" />
            {t('h.card.share')}
          </button>
          <button
            onClick={handlePrint}
            aria-label={t('h.card.ariaPrint')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition"
          >
            <Printer className="w-4 h-4" />
            {t('h.card.print')}
          </button>
        </div>
      </div>

      {/* CARD */}
      <div ref={cardRef} className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 overflow-hidden print:shadow-none print:border-0">

          {/* Header gradient */}
          <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-emerald-500 px-8 py-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 right-8 text-[120px] leading-none select-none">
                {getSpeciesEmoji(pet.species)}
              </div>
            </div>
            <div className="relative flex items-start gap-5">
              {/* Pet avatar */}
              <div className="shrink-0">
                {pet.photo ? (
                  <img
                    src={`${API_URL}${pet.photo}`}
                    alt={pet.name}
                    className="w-20 h-20 rounded-2xl object-cover border-4 border-white/30 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-5xl border-4 border-white/30">
                    {getSpeciesEmoji(pet.species)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-white/80" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/80">{t('h.card.badge')}</span>
                </div>
                <h1 className="text-3xl font-bold text-white truncate">{pet.name}</h1>
                <p className="text-white/80 text-sm mt-0.5">
                  {speciesLabel} • {pet.breed ?? t('h.card.mixedBreed')}
                </p>
                <p className="text-white/70 text-xs mt-1">{t('h.card.owner', { name: data.owner.name })}</p>
              </div>
            </div>

            {/* Stats pills */}
            <div className="relative flex gap-3 mt-5 flex-wrap">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs font-semibold text-white">
                {t('h.card.statsTotal', { count: totalVaccines })}
              </div>
              <div className="bg-emerald-400/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs font-semibold text-white">
                {t('h.card.statsUpToDate', { count: upToDate })}
              </div>
              {overdue > 0 && (
                <div className="bg-red-400/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs font-semibold text-white">
                  {overdue > 1 ? t('h.card.statsOverdueMany', { count: overdue }) : t('h.card.statsOverdueOne', { count: overdue })}
                </div>
              )}
            </div>
          </div>

          {/* Pet details */}
          <div className="px-8 py-5 border-b border-surface-100 dark:border-surface-700 bg-surface-50/50">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              {[
                { label: t('pet.species'), value: speciesLabel },
                { label: t('h.card.age'), value: formatAge(pet.birth_date) },
                { label: t('h.card.birth'), value: formatDate(pet.birth_date) },
                { label: t('h.card.weight'), value: pet.weight ? `${pet.weight} kg` : '—' },
                { label: t('pet.gender'), value: pet.gender === 'male' ? t('pet.male') : pet.gender === 'female' ? t('pet.female') : '—' },
                { label: t('pet.neutered'), value: pet.neutered ? t('common.yes') : t('common.no') },
                { label: t('pet.color'), value: pet.color ?? '—' },
                { label: t('pet.microchip'), value: pet.microchip ?? '—' },
                { label: t('h.card.tutor'), value: data.owner.name },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-surface-400 font-medium uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-surface-800 dark:text-surface-100 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Vaccines list */}
          <div className="px-8 py-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-4">{t('h.card.history')}</h2>

            {data.vaccines.length === 0 ? (
              <div className="text-center py-8 text-surface-400 text-sm">{t('h.card.noVaccines')}</div>
            ) : (
              <div className="space-y-3">
                {data.vaccines.map((v, i) => {
                  const st = vaccineStatus(v.next_due)
                  const cfg = statusConfig[st]
                  const { Icon } = cfg
                  return (
                    <div key={v.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-surface-100 dark:border-surface-700 hover:border-surface-200 transition bg-white dark:bg-surface-800">
                      <div className="mt-0.5">
                        <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-surface-900 dark:text-white">{v.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>{t(cfg.labelKey)}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-0.5 mt-1.5">
                          <span className="text-xs text-surface-500 dark:text-surface-400">
                            <span className="font-medium text-surface-700 dark:text-surface-200">{t('h.vac.applied')}</span> {formatDate(v.date_given)}
                          </span>
                          {v.next_due && (
                            <span className="text-xs text-surface-500 dark:text-surface-400">
                              <span className="font-medium text-surface-700 dark:text-surface-200">{t('h.vac.next')}</span> {formatDate(v.next_due)}
                            </span>
                          )}
                          {v.veterinarian && (
                            <span className="text-xs text-surface-500 dark:text-surface-400">
                              <span className="font-medium text-surface-700 dark:text-surface-200">{t('h.vac.vet')}</span> {v.veterinarian}
                            </span>
                          )}
                          {v.lot_number && (
                            <span className="text-xs text-surface-500 dark:text-surface-400">
                              <span className="font-medium text-surface-700 dark:text-surface-200">{t('h.vac.lot')}</span> {v.lot_number}
                            </span>
                          )}
                        </div>
                        {v.notes && <p className="text-xs text-surface-400 italic mt-1">{v.notes}</p>}
                      </div>
                      <span className="text-xs text-surface-400 font-medium shrink-0">#{String(i + 1).padStart(2, '0')}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer with QR code */}
          <div className="px-8 py-6 border-t border-surface-100 dark:border-surface-700 bg-surface-50/50 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <QrCode className="w-4 h-4 text-surface-400" />
                <span className="text-xs text-surface-400 font-medium uppercase tracking-wide">{t('h.card.verifyCode')}</span>
              </div>
              <img
                src={qrUrl}
                alt={t('h.card.qrAlt')}
                className="w-28 h-28 rounded-xl border border-surface-200 dark:border-surface-700"
              />
              <p className="text-xs text-surface-400 mt-1.5 max-w-[160px]">{t('h.card.scanHint')}</p>
            </div>

            <div className="text-right">
              <div className="text-xs text-surface-400 mb-1">{t('h.card.issuedOn')}</div>
              <div className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                {formatDate(data.generated_at.split('T')[0])}
              </div>
              <div className="mt-4 flex items-center gap-1.5 justify-end">
                <div className="w-6 h-6 bg-primary-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">P</span>
                </div>
                <span className="text-sm font-bold text-surface-700 dark:text-surface-200">PetLife</span>
              </div>
              <p className="text-xs text-surface-400 mt-0.5">{t('h.card.tagline')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #__next, #__next * { visibility: visible; }
          .print\\:hidden { display: none !important; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
    </DashboardLayout>
  )
}
