'use client'

/**
 * Sistema de celebração: confetti + Vyron pulando + card de share.
 * Dispare de qualquer lugar: window.dispatchEvent(new CustomEvent('petlife:celebrate',
 *   { detail: { title, message, card?: CardSpec, shareText? } }))
 * Share no pico emocional converte muito mais que botão frio.
 */
import { useEffect, useState } from 'react'
import { Share2, X } from 'lucide-react'
import { VyronAvatar } from '@/components/ai/VyronAvatar'
import { shareCardImage, type CardSpec } from '@/lib/shareCard'
import { track } from '@/lib/track'

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
  const [detail, setDetail] = useState<CelebrationDetail | null>(null)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<CelebrationDetail>).detail
      setDetail(d)
      // confetti 🎉 (respeita reduced-motion)
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        import('canvas-confetti').then(({ default: confetti }) => {
          confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899'] })
          setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0 } }), 250)
          setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1 } }), 400)
        }).catch(() => {})
      }
    }
    window.addEventListener('petlife:celebrate', on)
    return () => window.removeEventListener('petlife:celebrate', on)
  }, [])

  if (!detail) return null

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
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 backdrop-blur-sm p-5 animate-fade-in" onClick={() => setDetail(null)}>
      <div
        className="w-full max-w-sm bg-white dark:bg-surface-800 rounded-3xl p-6 text-center shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={() => setDetail(null)} aria-label="Fechar"
          className="absolute-top-right float-right -mt-2 -mr-2 p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700">
          <X className="w-5 h-5" />
        </button>
        <div className="flex justify-center mb-3"><VyronAvatar size={84} state="celebrating" /></div>
        <h3 className="text-xl font-extrabold text-surface-900 dark:text-white">{detail.title}</h3>
        {detail.message && <p className="text-sm text-surface-500 dark:text-surface-400 mt-1.5">{detail.message}</p>}
        {detail.card && (
          <button onClick={doShare} disabled={sharing}
            className="pressable mt-5 w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            <Share2 className="w-4 h-4" /> {sharing ? 'Gerando card…' : 'Compartilhar 🎉'}
          </button>
        )}
        <button onClick={() => setDetail(null)} className="mt-2 w-full py-2.5 text-sm font-medium text-surface-500 dark:text-surface-400">
          Fechar
        </button>
      </div>
    </div>
  )
}
