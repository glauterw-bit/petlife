'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { variants, spring } from '@/lib/motion'
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

  return (
    <div className="fixed inset-x-0 bottom-nav md:bottom-0 z-[60] p-3 sm:p-4 md:pb-[calc(1rem+env(safe-area-inset-bottom))] flex justify-center pointer-events-none">
      <AnimatePresence>
        {reason && (
          <motion.div
            key={reason}
            role="dialog"
            aria-modal="false"
            aria-labelledby="soft-upsell-title"
            variants={variants.fadeUp}
            initial="hidden"
            animate="show"
            exit="hidden"
            transition={spring.snappy}
            className="pointer-events-auto w-full max-w-md rounded-2xl border border-primary-200 dark:border-primary-500/25 bg-white dark:bg-surface-900 shadow-float p-4"
          >
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary-700 dark:text-primary-300" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p id="soft-upsell-title" className="text-[15px] font-bold text-surface-900 dark:text-white">{t(`ac.soft.title.${reason}`)}</p>
                <p className="text-[13px] text-surface-600 dark:text-surface-300 mt-0.5 leading-relaxed">{t(`ac.soft.body.${reason}`)}</p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => { track('soft_upsell_cta'); setReason(null); router.push('/plans') }}>
                    {t('ac.soft.cta')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReason(null)}>
                    {t('ac.soft.later')}
                  </Button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReason(null)}
                aria-label={t('common.close')}
                className="-mr-2 -mt-2 w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
