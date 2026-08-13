'use client'

import Link from 'next/link'
import { VyronAvatar } from '@/components/ai/VyronAvatar'

/**
 * Empty state padrão: Vyron convida pra ação — nunca uma tela deserta.
 */
export function EmptyState({
  title,
  text,
  ctaLabel,
  ctaHref,
  onCta,
}: {
  title: string
  text?: string
  ctaLabel?: string
  ctaHref?: string
  onCta?: () => void
}) {
  const cta = ctaLabel && (ctaHref || onCta)
  return (
    <div className="text-center py-10 px-4">
      <div className="flex justify-center mb-3">
        <VyronAvatar size={72} state="idle" />
      </div>
      <h3 className="font-display text-base font-bold text-surface-900 dark:text-white mb-1">{title}</h3>
      {text && <p className="text-sm text-surface-500 dark:text-surface-400 max-w-xs mx-auto mb-4">{text}</p>}
      {cta && (ctaHref ? (
        <Link
          href={ctaHref}
          className="pressable inline-flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
        >
          {ctaLabel}
        </Link>
      ) : (
        <button
          onClick={onCta}
          className="pressable inline-flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
        >
          {ctaLabel}
        </button>
      ))}
    </div>
  )
}
