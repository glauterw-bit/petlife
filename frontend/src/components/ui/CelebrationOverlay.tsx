'use client'

/**
 * Sistema de celebração: confetti + Vyron pulando + card de share.
 * Dispare de qualquer lugar: window.dispatchEvent(new CustomEvent('petlife:celebrate',
 *   { detail: { title, message, card?: CardSpec, shareText? } }))
 * Share no pico emocional converte muito mais que botão frio.
 *
 * Entrada e saída animadas (cartão com spring.pop, fundo com dur.fast). Uma
 * rajada só de confete, em 120 ms, junto da vibração de marco — e uma
 * vibração só (a trava de 60 ms do haptic() descarta a duplicata).
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Share2, X } from 'lucide-react'
import { haptic } from '@/lib/feedback'
import { spring, dur } from '@/lib/motion'
import { VyronAvatar } from '@/components/ai/VyronAvatar'
import { shareCardImage, type CardSpec } from '@/lib/shareCard'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'

export interface CelebrationDetail {
  title: string
  message?: string
  card?: CardSpec
  shareText?: string
  trackEvent?: string
}

export function celebrate(detail: CelebrationDetail) {
  try { window.dispatchEvent(new CustomEvent('petlife:celebrate', { detail })) } catch {}
}

export function CelebrationOverlay() {
  const t = useT()
  const [detail, setDetail] = useState<CelebrationDetail | null>(null)
  const [sharing, setSharing] = useState(false)

  const burstTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<CelebrationDetail>).detail
      setDetail(d)
      clearTimeout(burstTimer.current)
      burstTimer.current = setTimeout(() => {
        haptic('milestone')
        // confete (respeita reduced-motion)
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        import('canvas-confetti').then(({ default: confetti }) => {
          confetti({ particleCount: 80, spread: 80, startVelocity: 38, origin: { y: 0.55 }, colors: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899'], zIndex: 96 })
        }).catch(() => {})
      }, 120)
    }
    window.addEventListener('petlife:celebrate', on)
    return () => {
      window.removeEventListener('petlife:celebrate', on)
      clearTimeout(burstTimer.current)
    }
  }, [])

  async function doShare() {
    if (!detail?.card) return
    setSharing(true)
    try {
      const ok = await shareCardImage(detail.card, detail.shareText)
      if (ok && detail.trackEvent) track(detail.trackEvent)
    } finally {
      setSharing(false)
      setDetail(null)
    }
  }

  return (
    <AnimatePresence>
    {detail && (
    <m.div
      key="celebration"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 backdrop-blur-sm p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: dur.fast }}
      onClick={() => setDetail(null)}
    >
      <m.div
        role="dialog" aria-modal="true" aria-labelledby="celebration-title"
        className="relative w-full max-w-sm bg-white dark:bg-surface-900 rounded-3xl p-6 pt-8 text-center shadow-2xl border border-transparent dark:border-surface-800"
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8, transition: { duration: dur.fast } }}
        transition={spring.pop}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" onClick={() => setDetail(null)} aria-label={t('common.close')}
          className="pressable absolute top-2 right-2 w-11 h-11 rounded-full flex items-center justify-center text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-700 dark:hover:text-surface-200">
          <X className="w-5 h-5" aria-hidden />
        </button>
        <div className="flex justify-center mb-3"><VyronAvatar size={84} state="celebrating" /></div>
        <h3 id="celebration-title" className="font-display text-xl font-extrabold text-surface-900 dark:text-white">{detail.title}</h3>
        {detail.message && <p className="text-sm text-surface-500 dark:text-surface-400 mt-1.5">{detail.message}</p>}
        {detail.card && (
          <button onClick={doShare} disabled={sharing}
            className="pressable mt-5 w-full min-h-[48px] rounded-xl bg-primary-700 hover:bg-primary-800 text-white dark:bg-primary-500 dark:text-surface-950 dark:hover:bg-primary-400 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            <Share2 className="w-4 h-4" /> {sharing ? t('v.ui.generatingCard') : t('v.ui.shareCta')}
          </button>
        )}
        <button type="button" onClick={() => setDetail(null)} className="mt-2 w-full min-h-[44px] rounded-xl text-sm font-medium text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800">
          {t('common.close')}
        </button>
      </m.div>
    </m.div>
    )}
    </AnimatePresence>
  )
}
