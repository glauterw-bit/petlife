'use client'

import { useEffect, useState } from 'react'
import { Share2, Footprints, Camera, Syringe, Wallet, Clock } from 'lucide-react'
import { recap, type MonthlyRecap } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { trackHappyMoment } from '@/lib/review'

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Recap do mês — card visual + compartilhamento no WhatsApp (loop viral BR).
 * Sem IA: números agregados direto do banco.
 */
export function RecapCard({ petId }: { petId: number }) {
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
    const lines = [
      `🐾 ${data.month_label} do ${data.pet_name} no PetLife:`,
      data.walks > 0 ? `🚶 ${data.walks} passeio${data.walks > 1 ? 's' : ''} — ${data.distance_km} km (${data.active_minutes} min ativos)` : null,
      data.stories > 0 ? `📸 ${data.stories} momento${data.stories > 1 ? 's' : ''} registrado${data.stories > 1 ? 's' : ''}` : null,
      data.vaccines > 0 ? `💉 ${data.vaccines} vacina${data.vaccines > 1 ? 's' : ''} em dia` : null,
      data.weight_delta_kg != null ? `⚖️ peso: ${data.weight_delta_kg > 0 ? '+' : ''}${data.weight_delta_kg} kg no mês` : null,
      '',
      'Cuido do meu pet com o PetLife 💚 apps.apple.com/br/app/id6768136468',
    ].filter(l => l !== null)
    try {
      const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
      if (nav.share) {
        await nav.share({ text: lines.join('\n') })
        trackHappyMoment('recap_share')
      } else {
        await navigator.clipboard.writeText(lines.join('\n'))
        error('Resumo copiado! Cole no WhatsApp 📋')
      }
    } catch {}
  }

  const stats = [
    data.walks > 0 && { Icon: Footprints, label: 'passeios', value: `${data.walks} · ${data.distance_km} km` },
    data.active_minutes > 0 && { Icon: Clock, label: 'min ativos', value: String(data.active_minutes) },
    data.stories > 0 && { Icon: Camera, label: 'momentos', value: String(data.stories) },
    data.vaccines > 0 && { Icon: Syringe, label: 'vacinas', value: String(data.vaccines) },
    data.expenses_total > 0 && { Icon: Wallet, label: 'investido', value: brl(data.expenses_total) },
  ].filter(Boolean) as Array<{ Icon: typeof Footprints; label: string; value: string }>

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary-200 dark:border-primary-800 bg-gradient-to-br from-primary-500 to-emerald-600 p-5 text-white">
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" aria-hidden />
      <div className="absolute -right-2 top-10 w-14 h-14 rounded-full bg-white/10" aria-hidden />
      <div className="flex items-center justify-between mb-3 relative">
        <div>
          <p className="text-[11px] uppercase tracking-widest font-bold text-primary-100">Recap do mês</p>
          <h3 className="font-extrabold text-lg leading-tight">{data.month_label} do {data.pet_name}</h3>
        </div>
        <button
          onClick={share}
          className="pressable flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-bold px-3 py-2 rounded-xl"
        >
          <Share2 className="w-3.5 h-3.5" /> Compartilhar
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
