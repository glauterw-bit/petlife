'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PawPrint, Gift, Copy, Check, Loader2 } from 'lucide-react'
import { appStoreUrl } from '@/components/public/DownloadCta'
import { usePublicColorScheme } from '@/components/public/usePublicColorScheme'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'
import { hapticSuccess } from '@/lib/feedback'

/**
 * Link de indicação (/i/PET-XXXXXX).
 *
 * No iPhone, quem recebe vai para a App Store, e a App Store não leva o código
 * junto. Por isso a página mostra o código em destaque para copiar e digitar
 * no cadastro ("Tenho um código de convite"). Fora do iPhone, segue direto
 * para o cadastro web com o código preenchido.
 */
export default function InvitePage() {
  usePublicColorScheme()
  const t = useT()
  const params = useParams()
  const router = useRouter()
  const code = String(params.code || '').toUpperCase()
  const [ios, setIos] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIos(isIos)
    track('public_view', { meta: 'indicacao' })
    if (!isIos) router.replace(`/auth/register?ref=${encodeURIComponent(code)}`)
  }, [code, router])

  async function copyAndGo() {
    try { await navigator.clipboard.writeText(code); setCopied(true); void hapticSuccess() } catch {}
    track('public_cta_click', { meta: 'indicacao:app_store' })
    window.location.href = appStoreUrl('indicacao')
  }

  if (!ios) {
    return (
      <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 flex items-center justify-center gap-2 text-surface-600 dark:text-surface-400" role="status">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> {t('pub.inv.opening')}
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-sm w-full bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/70 dark:border-surface-800 shadow-card p-6 text-center">
        <span className="w-14 h-14 mx-auto bg-primary-700 dark:bg-primary-500 rounded-2xl flex items-center justify-center mb-3">
          <PawPrint className="w-8 h-8 text-white dark:text-surface-950" aria-hidden />
        </span>
        <h1 className="text-xl font-bold text-surface-900 dark:text-white">{t('pub.inv.title')}</h1>
        <p className="text-sm text-surface-600 dark:text-surface-300 mt-2">{t('pub.inv.sub')}</p>
        <div className="mt-5 tone-success-bg border rounded-2xl p-4">
          <p className="text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-center gap-1">
            <Gift className="w-4 h-4" aria-hidden /> {t('pub.inv.codeLabel')}
          </p>
          <p className="text-2xl font-bold tracking-widest text-emerald-800 dark:text-emerald-300 mt-1 select-all">{code}</p>
          <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-1">{t('pub.inv.howTo')}</p>
        </div>
        <button
          type="button"
          onClick={copyAndGo}
          className="pressable mt-5 w-full min-h-[52px] inline-flex items-center justify-center gap-2 bg-surface-900 dark:bg-white text-white dark:text-surface-900 px-5 rounded-2xl text-sm font-semibold"
        >
          {copied ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />} {t('pub.inv.copyAndGo')}
        </button>
        <a
          href={`/auth/register?ref=${encodeURIComponent(code)}`}
          className="mt-2 flex items-center justify-center min-h-[44px] text-sm font-semibold text-primary-700 dark:text-primary-300 underline underline-offset-2"
        >
          {t('pub.inv.useBrowser')}
        </a>
      </div>
    </main>
  )
}
