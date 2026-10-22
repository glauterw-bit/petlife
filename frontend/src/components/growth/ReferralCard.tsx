'use client'

import { useEffect, useState } from 'react'
import { Gift, Copy, Check, Share2 } from 'lucide-react'
import { growth, type ReferralInfo } from '@/lib/api'
import { hapticLight, hapticSuccess } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'

const APP_URL = 'https://petlife-frontend-production.up.railway.app'

/**
 * Convide & Ganhe — recompensa dupla: quando o amigo cadastra a primeira
 * vacina, os dois ganham 30 dias de PetLife+. O link /i/<código> manda iPhone
 * para a App Store mostrando o código, e o resto para o cadastro web.
 */
export function ReferralCard() {
  const t = useT()
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [codeIn, setCodeIn] = useState('')
  const [codeMsg, setCodeMsg] = useState('')

  useEffect(() => {
    growth.myReferral().then(setInfo).catch(() => {})
  }, [])

  if (!info) return null

  const link = `${APP_URL}/i/${info.code}`
  const message = t('g.ref.shareMsg', { days: info.bonus_days, link })

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      void hapticSuccess()
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  async function redeem() {
    try {
      const r = await growth.redeemCode(codeIn)
      setCodeMsg(r.rewarded ? t('g.ref.codeRewarded', { days: info?.bonus_days ?? 30 }) : t('g.ref.codeOk'))
      setInfo(i => (i ? { ...i, can_enter_code: false } : i))
    } catch (e) {
      setCodeMsg(e instanceof Error ? e.message : t('g.ref.codeErr'))
    }
  }

  async function share() {
    void hapticLight()
    void import('@/lib/track').then(m => m.track('share_sent', { meta: 'indicacao' })).catch(() => {})
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

      {info.can_enter_code && (
        <div className="mt-3 pt-3 border-t border-white/20">
          <p className="text-xs text-emerald-50 mb-2">{t('g.ref.haveCode')}</p>
          <div className="flex gap-2">
            <input
              value={codeIn}
              onChange={e => setCodeIn(e.target.value.toUpperCase())}
              placeholder="PET-XXXXXX"
              className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm text-surface-900 bg-white/90"
            />
            <button onClick={redeem} disabled={codeIn.length < 6} className="pressable shrink-0 bg-white/20 hover:bg-white/30 rounded-xl px-3 text-sm font-semibold disabled:opacity-50">
              {t('g.ref.apply')}
            </button>
          </div>
        </div>
      )}
      {codeMsg && <p className="text-xs text-white mt-2">{codeMsg}</p>}

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
