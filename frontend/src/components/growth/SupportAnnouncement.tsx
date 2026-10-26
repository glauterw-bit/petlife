'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircleHeart } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'

/**
 * Anúncio único do canal de suporte — "graças aos feedbacks de vocês".
 *
 * Mostra 1x por aparelho e coordena com o FeedbackModal via sessionStorage
 * (nunca dois modais na mesma sessão). O botão de feedback reabre o
 * FeedbackModal via evento, mesmo pra quem já respondeu/dispensou.
 */

const KEY = 'petlife_announce_suporte_v1'
export const ANNOUNCE_ACTIVE_KEY = 'petlife_announce_active'
const DELAY_MS = 1500

export function SupportAnnouncement() {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return
      // reserva a sessão ANTES do delay — o FeedbackModal (4s) respeita isso
      sessionStorage.setItem(ANNOUNCE_ACTIVE_KEY, '1')
    } catch { return }
    const timer = setTimeout(() => {
      setOpen(true)
      track('announce_suporte_shown')
    }, DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1')
      sessionStorage.removeItem(ANNOUNCE_ACTIVE_KEY)
    } catch {}
    setOpen(false)
  }

  function goSupport() {
    track('announce_suporte_cta')
    dismiss()
    router.push('/suporte')
  }

  function giveFeedback() {
    dismiss()
    try { window.dispatchEvent(new CustomEvent('petlife:open-feedback')) } catch {}
  }

  return (
    <Sheet
      open={open}
      onClose={dismiss}
      ariaLabel={t('g.an.title')}
      footer={
        <div className="flex flex-col gap-2">
          <Button fullWidth size="lg" onClick={goSupport} data-autofocus>
            {t('g.an.ctaSupport')}
          </Button>
          <Button fullWidth variant="soft" onClick={giveFeedback}>
            {t('g.an.ctaFeedback')}
          </Button>
          <Button fullWidth variant="ghost" onClick={dismiss}>
            {t('g.an.later')}
          </Button>
        </div>
      }
    >
      <div className="text-center pt-1 pb-2">
        <span className="w-16 h-16 mx-auto rounded-3xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 flex items-center justify-center mb-3">
          <MessageCircleHeart className="w-8 h-8" aria-hidden />
        </span>
        <h2 className="font-display text-xl font-bold text-surface-900 dark:text-white mb-1.5">{t('g.an.title')}</h2>
        <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">{t('g.an.body')}</p>
      </div>
    </Sheet>
  )
}
