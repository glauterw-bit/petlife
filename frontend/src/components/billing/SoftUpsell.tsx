'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sparkles, X } from 'lucide-react'
import { billing } from '@/lib/api'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'
import { SOFT_UPSELL_EVENT, clearSoftUpsell, peekSoftUpsell, type SoftUpsellReason } from '@/lib/softUpsell'

/**
 * Convite de plano, sem bloquear nada. Os dois assinantes pagantes nunca
 * usaram a IA: pagaram depois de exportar a carteirinha, abrir a retrospectiva
 * e passar do limite de pets. É nesses momentos que o convite aparece.
 *
 * Freio: cada motivo no máximo a cada 14 dias, e qualquer convite no máximo a
 * cada 3 dias. Nunca para quem já assina.
 */
const PER_REASON_DAYS = 14
const GLOBAL_DAYS = 3
const DAY = 24 * 60 * 60 * 1000

function recentlyShown(key: string, days: number): boolean {
  try {
    const at = Number(localStorage.getItem(key) || 0)
    return at > 0 && Date.now() - at < days * DAY
  } catch {
    return true
  }
}

function markShown(reason: SoftUpsellReason) {
  try {
    const now = String(Date.now())
    localStorage.setItem(`petlife_soft_upsell_${reason}`, now)
    localStorage.setItem('petlife_soft_upsell_last', now)
  } catch {}
}

export function SoftUpsell() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const [reason, setReason] = useState<SoftUpsellReason | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    async function consider() {
      const pending = peekSoftUpsell()
      if (!pending || busy.current) return
      // O convite do terceiro pet espera a home: logo após o cadastro o app abre
      // o quick-start de vacinas, e dois modais empilhados irritam.
      if (pending === 'pet3' && pathname !== '/dashboard') return
      busy.current = true
      clearSoftUpsell()
      try {
        if (recentlyShown(`petlife_soft_upsell_${pending}`, PER_REASON_DAYS)) return
        if (recentlyShown('petlife_soft_upsell_last', GLOBAL_DAYS)) return
        const me = await billing.me().catch(() => null)
        if (!me || me.tier !== 'free') return
        await new Promise(r => setTimeout(r, 1500))
        markShown(pending)
        setReason(pending)
        track('soft_upsell_shown')
      } finally {
        busy.current = false
      }
    }
    void consider()
    const onEvent = () => { void consider() }
    window.addEventListener(SOFT_UPSELL_EVENT, onEvent)
    return () => window.removeEventListener(SOFT_UPSELL_EVENT, onEvent)
  }, [pathname])

  if (!reason) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-surface-800 shadow-2xl p-4 animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-surface-900 dark:text-white">{t(`ac.soft.title.${reason}`)}</p>
            <p className="text-xs text-surface-600 dark:text-surface-300 mt-0.5 leading-relaxed">{t(`ac.soft.body.${reason}`)}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { track('soft_upsell_cta'); setReason(null); router.push('/plans') }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition"
              >
                {t('ac.soft.cta')}
              </button>
              <button
                onClick={() => setReason(null)}
                className="px-3 py-2 rounded-xl text-xs font-medium text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition"
              >
                {t('ac.soft.later')}
              </button>
            </div>
          </div>
          <button
            onClick={() => setReason(null)}
            aria-label={t('common.close')}
            className="p-1 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
