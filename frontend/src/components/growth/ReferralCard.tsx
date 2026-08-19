'use client'

import { useEffect, useState } from 'react'
import { Gift, Copy, Check, Share2 } from 'lucide-react'
import { growth, type ReferralInfo } from '@/lib/api'
import { hapticLight, hapticSuccess } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'

const APP_URL = 'https://petlife-frontend-production.up.railway.app'

/**
 * Convide & Ganhe — recompensa dupla: quem indica e quem entra ganham
 * 30 dias de PetLife+. Compartilha via WhatsApp/Web Share ou copia o link.
 */
export function ReferralCard() {
  const t = useT()
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    growth.myReferral().then(setInfo).catch(() => {})
  }, [])

  if (!info) return null

  const link = `${APP_URL}/auth/register?ref=${info.code}`
  const message = t('g.ref.shareMsg', { days: info.bonus_days, link })

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      void hapticSuccess()
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  async function share() {
    void hapticLight()
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
    if (nav.share) {
      try { await nav.share({ text: message }); return } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  return (
    <div className="bg-gradient-to-br from-primary-500 to-emerald-600 rounded-2xl p-5 text-white overflow-hidden relative max-w-full">
      <div className="absolute top-0 right-0 text-[80px] opacity-15 rotate-12 select-none pointer-events-none" aria-hidden>🎁</div>
      <div className="flex items-center gap-2 mb-1.5">
        <Gift className="w-5 h-5" />
        <span className="font-semibold">{t('g.ref.title')}</span>
      </div>
      <p className="text-sm text-emerald-50 mb-4 leading-snug">
        {t('g.ref.subA')} <strong>{t('g.ref.subB', { days: info.bonus_days })}</strong> {t('g.ref.subC')}
      </p>

      <div className="flex items-center gap-2 mb-3 min-w-0">
        <code className="flex-1 min-w-0 truncate bg-white/15 rounded-xl px-3 py-2 text-sm font-bold tracking-wider text-center">
          {info.code}
        </code>
        <button
          onClick={copy}
          aria-label={t('g.ref.copyAria')}
          className="pressable shrink-0 bg-white/15 hover:bg-white/25 transition rounded-xl p-2.5"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <button
        onClick={share}
        className="pressable w-full flex items-center justify-center gap-2 bg-white text-emerald-700 font-semibold rounded-xl py-2.5 text-sm hover:bg-emerald-50 transition"
      >
        <Share2 className="w-4 h-4" />
        {t('g.ref.inviteWhatsApp')}
      </button>

      {info.referred_count > 0 && (
        <p className="text-xs text-emerald-100 mt-3 text-center">
          {info.referred_count > 1
            ? t('g.ref.joinedMany', { count: info.referred_count })
            : t('g.ref.joinedOne')}
        </p>
      )}
    </div>
  )
}
