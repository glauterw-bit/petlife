'use client'

import { useEffect, useState } from 'react'
import { Star, X } from 'lucide-react'
import { feedback as feedbackApi } from '@/lib/api'
import { openReviewPage } from '@/lib/review'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'

/**
 * Convite pra avaliar na App Store — só no iPhone e só pros usuários mais
 * constantes (o servidor decide: dias distintos com o app aberto).
 *
 * Quem toca em "avaliar" nunca mais vê (o servidor lembra, vale em qualquer
 * aparelho). Quem dispensa só volta a ver depois de COOLDOWN_DAYS. Reserva a
 * sessão antes do delay, então o FeedbackModal não abre por cima.
 */

const KEY = 'petlife_store_invite_v1_dismissed_at'
const ANNOUNCE_ACTIVE_KEY = 'petlife_announce_active'
const COOLDOWN_DAYS = 21
const DELAY_MS = 2500

function isIOS(): boolean {
  try {
    const w = window as typeof window & { Capacitor?: { getPlatform?: () => string } }
    return w.Capacitor?.getPlatform?.() === 'ios'
  } catch {
    return false
  }
}

export function StoreInvite() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState<number | null>(null)

  useEffect(() => {
    if (!isIOS()) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>

    async function maybeOpen() {
      try {
        const last = Number(localStorage.getItem(KEY) || 0)
        if (last && Date.now() - last < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return
        if (sessionStorage.getItem(ANNOUNCE_ACTIVE_KEY)) return
      } catch { return }
      try {
        const { eligible, active_days } = await feedbackApi.storeInvite()
        if (!eligible || !alive) return
        try { sessionStorage.setItem(ANNOUNCE_ACTIVE_KEY, '1') } catch {}
        setDays(active_days)
        timer = setTimeout(() => {
          if (!alive) return
          setOpen(true)
          track('store_invite_shown')
        }, DELAY_MS)
      } catch { /* offline/erro: não incomoda */ }
    }
    maybeOpen()

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  function close() {
    try {
      localStorage.setItem(KEY, String(Date.now()))
      sessionStorage.removeItem(ANNOUNCE_ACTIVE_KEY)
    } catch {}
    setOpen(false)
  }

  function later() {
    track('store_invite_later')
    close()
  }

  function rate() {
    track('store_invite_cta')
    openReviewPage()
    close()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="relative bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md animate-slide-up shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={later}
          aria-label={t('common.close')}
          className="absolute right-3 top-3 p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 transition z-10"
        >
          <X className="w-4 h-4 text-surface-500 dark:text-surface-400" />
        </button>

        <div className="bg-gradient-to-br from-amber-100 to-primary-50 dark:from-amber-900/30 dark:to-primary-900/20 p-7 pt-10 text-center rounded-t-3xl">
          <div className="w-16 h-16 mx-auto bg-white dark:bg-surface-700 rounded-3xl shadow-lg flex items-center justify-center mb-3">
            <Star className="w-8 h-8 text-amber-500 fill-amber-400" />
          </div>
          <h2 className="font-display text-xl font-bold text-surface-900 dark:text-white mb-1.5">
            {t('si.title')}
          </h2>
          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
            {days ? t('si.body', { n: days }) : t('si.bodyNoCount')}
          </p>
        </div>

        <div className="p-6 space-y-2.5">
          <button
            onClick={rate}
            className="w-full px-4 py-3.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition shadow-md shadow-primary-500/30"
          >
            {t('si.cta')}
          </button>
          <button
            onClick={later}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition"
          >
            {t('si.later')}
          </button>
        </div>
      </div>
    </div>
  )
}
