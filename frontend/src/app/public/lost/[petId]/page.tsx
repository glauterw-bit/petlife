'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, MapPin, Phone, PawPrint, ShieldCheck, Heart, Send, Loader2, Clock, Gift, Cpu, MessageCircle } from 'lucide-react'
import { DownloadCta } from '@/components/public/DownloadCta'
import { usePublicColorScheme } from '@/components/public/usePublicColorScheme'
import { SuccessCheck } from '@/components/ui/SuccessCheck'
import { Skeleton } from '@/components/ui/Skeleton'
import { useT } from '@/contexts/LocaleContext'
import { getSpeciesLabel, localeTag, cn } from '@/lib/utils'
import { hapticSuccess, hapticWarning } from '@/lib/feedback'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

interface LostData {
  pet: {
    id: number
    name: string
    species: string
    breed: string | null
    color: string | null
    photo: string | null
    microchip: string | null
  }
  is_lost: boolean
  lost_at: string | null
  last_seen: string | null
  reward: string | null
  owner_contact: { name: string; phone: string | null } | null
}

/** "Encontrei este pet": avisa o tutor (push + e-mail) sem expor o telefone dele. */
function FoundForm({ petId, petName, urgent }: { petId: string; petName: string; urgent: boolean }) {
  const t = useT()
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [invalid, setInvalid] = useState(false)
  const msgRef = useRef<HTMLTextAreaElement>(null)
  const uid = useId()

  async function send() {
    if (state === 'sending') return
    // Botão sempre ativo: ao tocar sem texto, explica o que falta em vez de ficar mudo.
    if (message.trim().length < 3) {
      setInvalid(true)
      void hapticWarning()
      msgRef.current?.focus()
      return
    }
    setState('sending')
    try {
      const r = await fetch(`${API_URL}/public/lost/${encodeURIComponent(petId)}/found`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), contact: contact.trim() || undefined }),
      })
      if (r.ok) { void hapticSuccess(); setState('sent') } else setState('error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/70 dark:border-surface-800 p-6 text-center" role="status">
        <div className="flex justify-center mb-3"><SuccessCheck size={56} /></div>
        <p className="font-bold text-surface-900 dark:text-white">{t('pub.lost.sentTitle', { pet: petName })}</p>
        <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{t('pub.lost.sentText')}</p>
      </div>
    )
  }

  const field =
    'w-full px-3.5 py-3 rounded-xl border bg-white dark:bg-surface-950 text-base text-surface-900 dark:text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <form
      noValidate
      onSubmit={e => { e.preventDefault(); void send() }}
      className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/70 dark:border-surface-800 p-5 text-left"
    >
      <h2 className="font-bold text-surface-900 dark:text-white">
        {urgent ? t('pub.lost.formTitleUrgent', { pet: petName }) : t('pub.lost.formTitle', { pet: petName })}
      </h2>
      <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5 mb-3">{t('pub.lost.formSub')}</p>

      <label htmlFor={`${uid}-msg`} className="block text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5">
        {t('pub.lost.msgLabel')}
      </label>
      <textarea
        id={`${uid}-msg`}
        ref={msgRef}
        value={message}
        onChange={e => { setMessage(e.target.value); if (invalid) setInvalid(false) }}
        rows={3}
        maxLength={500}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${uid}-err` : undefined}
        placeholder={t('pub.lost.msgPh')}
        className={cn(field, 'resize-none', invalid ? 'border-red-600 dark:border-red-400' : 'border-surface-200 dark:border-surface-700')}
      />
      {invalid && (
        <p id={`${uid}-err`} className="flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-300 mt-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
          {t('pub.lost.msgRequired', { pet: petName })}
        </p>
      )}

      <label htmlFor={`${uid}-contact`} className="block text-sm font-semibold text-surface-800 dark:text-surface-100 mt-3 mb-1.5">
        {t('pub.lost.contactLabel')} <span className="font-normal text-surface-500 dark:text-surface-400">{t('pub.optional')}</span>
      </label>
      <input
        id={`${uid}-contact`}
        value={contact}
        onChange={e => setContact(e.target.value)}
        maxLength={120}
        inputMode="tel"
        autoComplete="tel"
        placeholder={t('pub.lost.contactPh')}
        className={cn(field, 'border-surface-200 dark:border-surface-700')}
      />
      {state === 'error' && (
        <p className="text-sm text-red-700 dark:text-red-300 mt-2" role="alert">{t('pub.lost.sendError')}</p>
      )}
      <button
        type="submit"
        aria-busy={state === 'sending' || undefined}
        className="pressable mt-4 w-full min-h-[52px] flex items-center justify-center gap-2 px-4 rounded-xl text-base font-semibold text-white bg-red-700 hover:bg-red-800 transition-colors"
      >
        {state === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : <Send className="w-5 h-5" aria-hidden />}
        {state === 'sending' ? t('pub.lost.sending') : t('pub.lost.notify')}
      </button>
    </form>
  )
}

export default function LostPetPage() {
  usePublicColorScheme()
  const t = useT()
  const params = useParams()
  const petId = String(params.petId)
  const [data, setData] = useState<LostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/public/lost/${encodeURIComponent(petId)}`)
      .then(r => {
        if (r.status === 404) { setErrorKey('pub.lost.notRegistered'); return null }
        if (!r.ok) { setErrorKey('pub.lost.loadError'); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .catch(() => setErrorKey('pub.lost.connError'))
      .finally(() => setLoading(false))
  }, [petId])

  if (loading) {
    return (
      <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 py-6 px-4" aria-busy="true">
        <span className="sr-only">{t('pub.loading')}</span>
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton className="h-20 rounded-3xl" />
          <Skeleton className="aspect-square rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      </main>
    )
  }

  if (errorKey || !data) {
    return (
      <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/70 dark:border-surface-800 p-10">
          <span className="w-14 h-14 mx-auto rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7" aria-hidden />
          </span>
          <h1 className="text-lg font-bold text-surface-900 dark:text-white mb-1">{t('pub.lost.notFoundTitle')}</h1>
          <p className="text-sm text-surface-600 dark:text-surface-400">{t(errorKey ?? 'pub.lost.loadError')}</p>
        </div>
      </main>
    )
  }

  const speciesLine = `${getSpeciesLabel(data.pet.species)} · ${data.pet.breed ?? t('pub.card.mixed')}`

  // Pet está em casa (não foi marcado como perdido)
  if (!data.is_lost) {
    return (
      <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 flex flex-col items-center justify-center gap-4 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md w-full text-center bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/70 dark:border-surface-800 p-8">
          {data.pet.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${API_URL}${data.pet.photo}`} alt={data.pet.name} className="w-24 h-24 mx-auto rounded-full object-cover mb-4 ring-4 ring-emerald-100 dark:ring-emerald-500/20" />
          ) : (
            <span className="w-20 h-20 mx-auto bg-emerald-50 dark:bg-emerald-500/15 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-10 h-10 text-emerald-700 dark:text-emerald-300" aria-hidden />
            </span>
          )}
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-1">{t('pub.lost.homeTitle', { pet: data.pet.name })}</h1>
          <p className="text-sm text-surface-600 dark:text-surface-400">{t('pub.lost.homeText')}</p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-surface-600 dark:text-surface-400">
            <PawPrint className="w-3.5 h-3.5" aria-hidden /> {speciesLine}
          </p>
        </div>

        <div className="max-w-md w-full">
          <FoundForm petId={petId} petName={data.pet.name} urgent={false} />
        </div>

        <div className="max-w-md w-full">
          <DownloadCta campanha="pet_perdido" headline={t('pub.lost.ctaHomeHeadline')} sub={t('pub.lost.ctaHomeSub')} />
        </div>
      </main>
    )
  }

  const phone = data.owner_contact?.phone?.replace(/\D/g, '') ?? ''

  // Pet ESTÁ perdido: tela urgente
  return (
    <main className="min-h-dvh bg-red-50 dark:bg-surface-950 py-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto">
        {/* Banner de urgência (sem piscar: só cor e texto) */}
        <div className="bg-red-700 text-white rounded-3xl p-5 mb-4 shadow-float">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <Heart className="w-7 h-7" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/90">{t('pub.lost.missing')}</p>
              <h1 className="text-xl font-bold leading-tight">{t('pub.lost.helpTitle', { pet: data.pet.name })}</h1>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/70 dark:border-surface-800 overflow-hidden">
          {data.pet.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${API_URL}${data.pet.photo}`} alt={data.pet.name} className="w-full aspect-square object-cover" />
          )}
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-surface-900 dark:text-white">{data.pet.name}</h2>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                {speciesLine}{data.pet.color && ` · ${data.pet.color}`}
              </p>
            </div>

            {data.lost_at && (
              <p className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
                <Clock className="w-4 h-4 shrink-0" aria-hidden />
                <span><strong>{t('pub.lost.since')}</strong>{' '}{new Date(data.lost_at).toLocaleString(localeTag(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            )}

            {data.last_seen && (
              <div className="tone-warning-bg border rounded-2xl p-3 flex items-start gap-2">
                <MapPin className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-0.5">{t('pub.lost.lastSeen')}</p>
                  <p className="text-sm text-surface-900 dark:text-surface-100">{data.last_seen}</p>
                </div>
              </div>
            )}

            {data.reward && (
              <div className="tone-success-bg border rounded-2xl p-3 flex items-center gap-2">
                <Gift className="w-5 h-5 text-emerald-700 dark:text-emerald-300 shrink-0" aria-hidden />
                <div>
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">{t('pub.lost.reward')}</p>
                  <p className="text-base font-bold text-surface-900 dark:text-surface-100">{data.reward}</p>
                </div>
              </div>
            )}

            {data.pet.microchip && (
              <p className="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-400">
                <Cpu className="w-3.5 h-3.5" aria-hidden />
                <span><strong>{t('pub.card.microchip')}:</strong> <span className="font-mono">{data.pet.microchip}</span></span>
              </p>
            )}

            {data.owner_contact && (
              <div className="border-t border-surface-100 dark:border-surface-800 pt-4">
                <p className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 font-semibold mb-1">{t('pub.lost.contactTitle')}</p>
                <p className="text-sm font-semibold text-surface-900 dark:text-white mb-3">{data.owner_contact.name}</p>
                {phone && (
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`tel:${phone}`}
                      className="pressable min-h-[48px] flex items-center justify-center gap-2 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-xl dark:bg-primary-500 dark:text-surface-950"
                    >
                      <Phone className="w-4 h-4" aria-hidden />
                      {t('pub.lost.call')}
                    </a>
                    <a
                      href={`https://wa.me/${phone}?text=${encodeURIComponent(t('pub.lost.waText', { pet: data.pet.name }))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="pressable min-h-[48px] flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl"
                    >
                      <MessageCircle className="w-4 h-4" aria-hidden />
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <FoundForm petId={petId} petName={data.pet.name} urgent />
        </div>

        <div className="text-center mt-6 text-xs text-surface-600 dark:text-surface-400">
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <PawPrint className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
            <span className="font-bold text-surface-800 dark:text-surface-200">PetLife</span>
          </div>
          <p>{t('pub.lost.shareHint', { pet: data.pet.name })}</p>
        </div>

        {/* Abaixo do contato de propósito: achar o pet vem primeiro. */}
        <DownloadCta campanha="pet_perdido" className="mt-5" headline={t('pub.lost.ctaHeadline')} sub={t('pub.lost.ctaSub')} />
      </div>
    </main>
  )
}
