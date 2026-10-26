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
 * Freios (todos valem juntos):
 * - cada motivo no máximo a cada 14 dias, e qualquer convite no máximo a cada 3 dias;
 * - no máximo 1 por sessão;
 * - espera 700 ms depois do evento (o share sheet do iOS fecha antes);
 * - nunca em /auth, /start ou /plans, nem com uma folha (Sheet) ou modal aberto:
 *   o pedido fica guardado e é reconsiderado quando a tela libera;
 * - nunca para quem já assina.
 */
const PER_REASON_DAYS = 14
const GLOBAL_DAYS = 3
const DAY = 24 * 60 * 60 * 1000
const DELAY_MS = 700
const SESSION_KEY = 'petlife_soft_upsell_session'
const BLOCKED_PREFIXES = ['/auth', '/start', '/plans']
const RETRY_MS = 2000
const MAX_RETRIES = 15

function blockedRoute(pathname: string): boolean {
  return BLOCKED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

/** Há uma folha/modal aberto? (Sheet e Confirm usam role="dialog" + aria-modal="true".) */
function modalOpen(): boolean {
  try {
    return !!document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')
  } catch {
    return false
  }
}

function shownThisSession(): boolean {
  try {
    return !!sessionStorage.getItem(SESSION_KEY)
  } catch {
    return true
  }
}

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
  try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
}

export function SoftUpsell() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const [reason, setReason] = useState<SoftUpsellReason | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    let alive = true
    let retry: ReturnType<typeof setTimeout> | null = null
    let tries = 0

    // Folha aberta: tenta de novo daqui a pouco, sem perder o pedido.
    function later() {
      if (retry || tries >= MAX_RETRIES) return
      tries += 1
      retry = setTimeout(() => { retry = null; void consider() }, RETRY_MS)
    }

    async function consider() {
      if (!alive) return
      const pending = peekSoftUpsell()
      if (!pending || busy.current) return
      if (shownThisSession()) { clearSoftUpsell(); return }
      // Rotas de entrada e a própria tela de planos: espera a próxima tela.
      if (blockedRoute(pathname)) return
      // O convite do terceiro pet espera a home: logo após o cadastro o app abre
      // o quick-start de vacinas, e dois modais empilhados irritam.
      if (pending === 'pet3' && pathname !== '/dashboard') return
      if (modalOpen()) { later(); return }
      busy.current = true
      try {
        if (recentlyShown(`petlife_soft_upsell_${pending}`, PER_REASON_DAYS) || recentlyShown('petlife_soft_upsell_last', GLOBAL_DAYS)) {
          clearSoftUpsell()
          return
        }
        await new Promise(r => setTimeout(r, DELAY_MS))
        if (!alive) return
        // Reconfere depois da espera: a pessoa pode ter aberto uma folha ou trocado de tela.
        if (modalOpen()) { later(); return }
        const me = await billing.me().catch(() => null)
        if (!alive) return
        clearSoftUpsell()
        if (!me || me.tier !== 'free') return
        markShown(pending)
        setReason(pending)
        track('soft_upsell_shown')
      } finally {
        busy.current = false
      }
    }
    void consider()
    const onEvent = () => { tries = 0; void consider() }
    window.addEventListener(SOFT_UPSELL_EVENT, onEvent)
    return () => {
      alive = false
      if (retry) clearTimeout(retry)
      window.removeEventListener(SOFT_UPSELL_EVENT, onEvent)
    }
  }, [pathname])

  // Trocou para uma rota bloqueada com o convite aberto: some.
  useEffect(() => {
    if (reason && blockedRoute(pathname)) setReason(null)
  }, [pathname, reason])

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-0 bottom-nav md:bottom-0 z-[60] p-3 sm:p-4 md:pb-[calc(1rem+env(safe-area-inset-bottom))] flex justify-center pointer-events-none"
    >
      <AnimatePresence>
        {reason && (
          <motion.div
            key={reason}
            role="region"
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
                className="pressable -mr-2 -mt-2 w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 inline-flex items-center justify-center rounded-xl text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
