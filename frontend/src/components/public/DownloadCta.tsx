'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, PawPrint } from 'lucide-react'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'
import { buttonClasses } from '@/components/ui/Button'

const APP_STORE_BASE = 'https://apps.apple.com/br/app/petlife-sa%C3%BAde-do-pet/id6768136468'

/**
 * Link da App Store com rastreio de campanha.
 *
 * A Apple aceita `ct` (campaign text) sem SDK nenhum e mostra o resultado no
 * App Analytics — de graça. Sem isso temos sete superfícies virais e nenhuma
 * forma de saber qual traz instalação.
 */
export function appStoreUrl(campanha?: string): string {
  if (!campanha) return APP_STORE_BASE
  // `pt` (provider token) é o que faz o `ct` aparecer no App Analytics.
  const pt = process.env.NEXT_PUBLIC_ASC_PROVIDER_TOKEN
  return `${APP_STORE_BASE}?${pt ? `pt=${encodeURIComponent(pt)}&` : ''}ct=${encodeURIComponent(campanha)}&mt=8`
}

/** Link do Google Play, com a origem no referrer. Vazio até o app sair do teste fechado. */
export function playStoreUrl(campanha?: string): string | null {
  if (process.env.NEXT_PUBLIC_PLAY_LIVE !== '1') return null
  const base = 'https://play.google.com/store/apps/details?id=app.petlife'
  return campanha ? `${base}&referrer=${encodeURIComponent(`utm_source=${campanha}`)}` : base
}

type Os = 'ios' | 'android' | 'other'
function detectOs(): Os {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && 'ontouchend' in document)) return 'ios'
  return 'other'
}

/** @deprecated use appStoreUrl(campanha) — sem campanha não dá pra medir. */
export const APP_STORE_URL = APP_STORE_BASE

/**
 * CTA de download nas páginas públicas.
 *
 * Estas páginas são o loop de aquisição do app: a carteirinha é o que o tutor
 * manda no WhatsApp pro hotel/creche, e a página de pet perdido roda em grupo
 * de bairro. Quem recebe precisa ter como baixar — sem isso o loop vaza inteiro.
 *
 * Cada sistema vê o botão que funciona para ele: iPhone vê a App Store;
 * Android vê o Google Play quando o app sair do teste fechado
 * (NEXT_PUBLIC_PLAY_LIVE=1) e, até lá, o convite para o teste
 * (NEXT_PUBLIC_PLAY_TEST_URL) e o "usar no navegador".
 */
export function DownloadCta({
  headline,
  sub,
  campanha,
  className = '',
}: {
  headline: string
  sub?: string
  /** Identifica a origem no App Analytics: 'carteirinha', 'pet_perdido'… */
  campanha?: string
  className?: string
}) {
  const t = useT()
  const [os, setOs] = useState<Os>('other')
  useEffect(() => {
    setOs(detectOs())
    track('public_view', { meta: campanha || 'publico' })
  }, [campanha])

  const play = playStoreUrl(campanha)
  const playTest = process.env.NEXT_PUBLIC_PLAY_TEST_URL
  const showApple = os !== 'android'
  const showPlay = os !== 'ios' && !!play
  const showPlayTest = os === 'android' && !play && !!playTest
  const click = (destino: string) => track('public_cta_click', { meta: `${campanha || 'publico'}:${destino}` })

  const storeBtn =
    'pressable inline-flex items-center justify-center gap-2 min-h-[48px] bg-surface-900 dark:bg-white text-white dark:text-surface-900 px-5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity'

  return (
    <div
      className={`bg-white dark:bg-surface-900 rounded-3xl border border-surface-200/70 dark:border-surface-800 shadow-card p-5 text-center print:hidden ${className}`}
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="w-7 h-7 bg-primary-700 dark:bg-primary-500 rounded-lg flex items-center justify-center">
          <PawPrint className="w-4 h-4 text-white dark:text-surface-950" aria-hidden />
        </span>
        <span className="text-sm font-bold text-surface-800 dark:text-surface-100">PetLife</span>
      </div>

      <p className="text-sm text-surface-800 dark:text-surface-100 font-semibold">{headline}</p>
      {sub && <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">{sub}</p>}

      <div className="flex flex-col gap-2 mt-4">
        {showApple && (
          <a href={appStoreUrl(campanha)} target="_blank" rel="noreferrer" onClick={() => click('app_store')} className={storeBtn}>
            <Download className="w-4 h-4" aria-hidden /> {t('pub.cta.appStore')}
          </a>
        )}
        {showPlay && play && (
          <a href={play} target="_blank" rel="noreferrer" onClick={() => click('google_play')} className={storeBtn}>
            <Download className="w-4 h-4" aria-hidden /> {t('pub.cta.googlePlay')}
          </a>
        )}
        <Link
          href="/auth/register"
          onClick={() => click('navegador')}
          className={buttonClasses('primary', 'md', true, 'min-h-[48px]')}
        >
          <PawPrint className="w-4 h-4" aria-hidden /> {t('pub.cta.browser')}
        </Link>
        {showPlayTest && (
          <a
            href={playTest}
            target="_blank"
            rel="noreferrer"
            onClick={() => track('android_tester_cta', { meta: campanha || 'publico' })}
            className="flex items-center justify-center min-h-[44px] text-xs font-medium text-primary-700 dark:text-primary-300 underline underline-offset-2"
          >
            {t('pub.cta.androidTest')}
          </a>
        )}
      </div>

      <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-3">{t('pub.cta.footer')}</p>
    </div>
  )
}
