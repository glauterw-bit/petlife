'use client'

/**
 * Funil de upgrade: escuta o evento global `petlife:quota` (disparado pelo api.ts
 * quando o backend responde 402 — limite do plano atingido) e converte o "erro"
 * em convite pra assinar, com CTA direto pra /plans.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, X } from 'lucide-react'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'

export function QuotaUpsellModal() {
  const router = useRouter()
  const t = useT()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const onQuota = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail
      setMessage(detail?.message || t('ac.quota.defaultMsg'))
      track('paywall_shown')
    }
    window.addEventListener('petlife:quota', onQuota)
    return () => window.removeEventListener('petlife:quota', onQuota)
  }, [t])

  if (!message) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => setMessage(null)}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-surface-800 rounded-3xl border border-surface-100 dark:border-surface-700 p-6 shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center">
            <Crown className="w-6 h-6 text-amber-500" />
          </div>
          <button
            onClick={() => setMessage(null)}
            className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-1">
          {t('ac.quota.title')}
        </h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">{message}</p>

        <button
          onClick={() => { setMessage(null); router.push('/plans') }}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm mb-2"
        >
          {t('ac.quota.cta')}
        </button>
        <button
          onClick={() => setMessage(null)}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-surface-500 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700/40"
        >
          {t('ac.quota.later')}
        </button>
      </div>
    </div>
  )
}
