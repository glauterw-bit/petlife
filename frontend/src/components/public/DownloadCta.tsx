'use client'

import Link from 'next/link'
import { Download, PawPrint } from 'lucide-react'

const APP_STORE_BASE = 'https://apps.apple.com/br/app/petlife-sa%C3%BAde-do-pet/id6768136468'

/**
 * Link da App Store com rastreio de campanha.
 *
 * A Apple aceita `ct` (campaign text) sem SDK nenhum e mostra o resultado no
 * App Analytics — de graça. Sem isso temos sete superfícies virais e nenhuma
 * forma de saber qual traz instalação.
 */
export function appStoreUrl(campanha?: string): string {
  return campanha
    ? `${APP_STORE_BASE}?ct=${encodeURIComponent(campanha)}&mt=8`
    : APP_STORE_BASE
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
 * Sem link do Google Play de propósito: o app ainda não está publicado lá.
 * O "usar no navegador" é o caminho pra quem está no Android.
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
  return (
    <div
      className={`bg-white dark:bg-surface-800 rounded-3xl shadow-lg border border-surface-100 dark:border-surface-700 p-5 text-center print:hidden ${className}`}
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className="w-6 h-6 bg-primary-500 rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">P</span>
        </div>
        <span className="text-sm font-bold text-surface-700 dark:text-surface-200">PetLife</span>
      </div>

      <p className="text-sm text-surface-700 dark:text-surface-200 font-medium">{headline}</p>
      {sub && <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">{sub}</p>}

      <div className="flex flex-col gap-2 mt-4">
        <a
          href={appStoreUrl(campanha)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-surface-900 dark:bg-white text-white dark:text-surface-900 px-5 py-3 rounded-2xl text-sm font-semibold hover:opacity-90 transition"
        >
          <Download className="w-4 h-4" /> Baixar na App Store
        </a>
        <Link
          href="/auth/register"
          className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-5 py-3 rounded-2xl text-sm font-semibold transition"
        >
          <PawPrint className="w-4 h-4" /> Usar no navegador (grátis)
        </Link>
      </div>

      <p className="text-[11px] text-surface-400 mt-3">Grátis · Sem anúncios · LGPD</p>
    </div>
  )
}
