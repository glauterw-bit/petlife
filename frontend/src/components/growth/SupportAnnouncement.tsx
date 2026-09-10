'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircleHeart, X } from 'lucide-react'
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="relative bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md animate-slide-up shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={dismiss}
          aria-label={t('common.close')}
          className="absolute right-3 top-3 p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 transition z-10"
        >
          <X className="w-4 h-4 text-surface-500 dark:text-surface-400" />
        </button>

        <div className="bg-gradient-to-br from-primary-100 to-accent-50 dark:from-primary-900/30 dark:to-accent-900/20 p-7 pt-10 text-center rounded-t-3xl">
          <div className="w-16 h-16 mx-auto bg-white dark:bg-surface-700 rounded-3xl shadow-lg flex items-center justify-center mb-3">
            <MessageCircleHeart className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="font-display text-xl font-bold text-surface-900 dark:text-white mb-1.5">
            {t('g.an.title')}
          </h2>
          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
            {t('g.an.body')}
          </p>
        </div>

        <div className="p-6 space-y-2.5">
          <button
            onClick={goSupport}
            className="w-full px-4 py-3.5 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition shadow-md shadow-primary-500/30"
          >
            {t('g.an.ctaSupport')}
          </button>
          <button
            onClick={giveFeedback}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition"
          >
            {t('g.an.ctaFeedback')}
          </button>
          <button
            onClick={dismiss}
            className="w-full px-4 py-2 rounded-xl text-xs font-medium text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition"
          >
            {t('g.an.later')}
          </button>
        </div>
      </div>
    </div>
  )
}
