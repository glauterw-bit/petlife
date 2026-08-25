'use client'

import Link from 'next/link'
import { Download, PawPrint } from 'lucide-react'

export const APP_STORE_URL = 'https://apps.apple.com/br/app/petlife-sa%C3%BAde-do-pet/id6768136468'

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
  className = '',
}: {
  headline: string
  sub?: string
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
          href={APP_STORE_URL}
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
