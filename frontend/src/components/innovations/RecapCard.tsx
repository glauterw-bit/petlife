'use client'

import { useEffect, useState } from 'react'
import { Share2, Footprints, Camera, Syringe, Wallet, Clock } from 'lucide-react'
import { recap, type MonthlyRecap } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { trackHappyMoment } from '@/lib/review'
import { shareCardImage } from '@/lib/shareCard'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Recap do mês — card visual + compartilhamento no WhatsApp (loop viral BR).
 * Sem IA: números agregados direto do banco.
 */
export function RecapCard({ petId }: { petId: number }) {
  const t = useT()
  const { error } = useToast()
  const [data, setData] = useState<MonthlyRecap | null>(null)

  useEffect(() => {
    recap.monthly(petId).then(setData).catch(() => {})
  }, [petId])

  if (!data) return null
  const hasAnything = data.walks > 0 || data.stories > 0 || data.vaccines > 0 || data.expenses_total > 0
  if (!hasAnything) return null

  async function share() {
    if (!data) return
    const stats = [
      data.walks > 0 && { label: t('g.rec.walks'), value: `${data.walks} · ${data.distance_km} km` },
      data.active_minutes > 0 && { label: t('g.rec.activeMin'), value: String(data.active_minutes) },
      data.stories > 0 && { label: t('g.rec.moments'), value: String(data.stories) },
      data.vaccines > 0 && { label: t('g.rec.vaccinesOk'), value: String(data.vaccines) },
    ].filter(Boolean) as Array<{ label: string; value: string }>
    try {
      const ok = await shareCardImage(
        {
          title: t('g.rec.heading', { month: data.month_label.split(' ')[0], name: data.pet_name }),
          subtitle: t('g.rec.shareSubtitle'),
          stats,
        },
        t('g.rec.shareText', { month: data.month_label, name: data.pet_name }),
      )
      if (ok) {
        trackHappyMoment('recap_share')
        track('recap_share')
      }
    } catch {}
  }

  const stats = [
    data.walks > 0 && { Icon: Footprints, label: t('g.rec.walks'), value: `${data.walks} · ${data.distance_km} km` },
    data.active_minutes > 0 && { Icon: Clock, label: t('g.rec.activeMin'), value: String(data.active_minutes) },
    data.stories > 0 && { Icon: Camera, label: t('g.rec.moments'), value: String(data.stories) },
    data.vaccines > 0 && { Icon: Syringe, label: t('g.rec.vaccines'), value: String(data.vaccines) },
    data.expenses_total > 0 && { Icon: Wallet, label: t('g.rec.spent'), value: brl(data.expenses_total) },
  ].filter(Boolean) as Array<{ Icon: typeof Footprints; label: string; value: string }>

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary-200 dark:border-primary-800 bg-gradient-to-br from-primary-500 to-emerald-600 p-5 text-white">
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" aria-hidden />
      <div className="absolute -right-2 top-10 w-14 h-14 rounded-full bg-white/10" aria-hidden />
      <div className="flex items-center justify-between mb-3 relative">
        <div>
          <p className="text-[11px] uppercase tracking-widest font-bold text-primary-100">{t('g.rec.title')}</p>
          <h3 className="font-extrabold text-lg leading-tight">{t('g.rec.heading', { month: data.month_label, name: data.pet_name })}</h3>
        </div>
        <button
          onClick={share}
          className="pressable flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-bold px-3 py-2 rounded-xl"
        >
          <Share2 className="w-3.5 h-3.5" /> {t('g.misc.share')}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 relative">
        {stats.map(({ Icon, label, value }, i) => (
          <div key={label} className="reveal bg-white/15 backdrop-blur rounded-xl p-2.5" style={{ ['--i' as string]: i }}>
            <Icon className="w-4 h-4 text-primary-100 mb-1" />
            <div className="font-bold text-sm tabular-nums leading-tight">{value}</div>
            <div className="text-[10px] text-primary-100">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
