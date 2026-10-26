'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
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

  return (
    <Modal open={open} onClose={later} size="md">
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 bg-gradient-to-br from-amber-100 to-primary-50 dark:from-amber-500/15 dark:to-surface-900 px-7 pb-7 pt-10 text-center">
        <div className="w-16 h-16 mx-auto bg-white dark:bg-surface-800 rounded-3xl shadow-card flex items-center justify-center mb-3">
          <Star className="w-8 h-8 text-amber-500 fill-amber-400" aria-hidden />
        </div>
        <h2 className="font-display text-xl font-extrabold text-surface-900 dark:text-white mb-1.5">{t('si.title')}</h2>
        <p className="text-[15px] text-surface-700 dark:text-surface-300 leading-relaxed">
          {days ? t('si.body', { n: days }) : t('si.bodyNoCount')}
        </p>
      </div>
      <div className="pt-5 space-y-2">
        <Button size="lg" fullWidth leftIcon={Star} onClick={rate}>
          {t('si.cta')}
        </Button>
        <Button variant="ghost" fullWidth onClick={later}>
          {t('si.later')}
        </Button>
      </div>
    </Modal>
  )
}
