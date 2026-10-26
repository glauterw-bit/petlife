'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { VyronAvatar, type VyronState } from '@/components/ai/VyronAvatar'
import { buttonClasses } from './Button'

/**
 * Empty state padrão: um convite para a ação — nunca uma tela deserta.
 * Com `icon`, mostra o ícone num círculo (mais calmo); sem, o Vyron.
 * Com `mascot`, o Vyron no estado pedido substitui o ícone (ex.: 'sleeping'
 * para "nada por aqui ainda", 'attention' para "falta uma coisa").
 */
export function EmptyState({
  title,
  text,
  ctaLabel,
  ctaHref,
  onCta,
  icon: Icon,
  mascot,
}: {
  title: string
  text?: string
  ctaLabel?: string
  ctaHref?: string
  onCta?: () => void
  icon?: LucideIcon
  mascot?: Extract<VyronState, 'idle' | 'attention' | 'sleeping' | 'celebrating'>
}) {
  const cta = ctaLabel && (ctaHref || onCta)
  const btn = buttonClasses('primary', 'md', false, 'px-5')
  return (
    <div className="text-center py-10 px-4">
      <div className="flex justify-center mb-4">
        {mascot ? (
          <VyronAvatar size={72} state={mascot} />
        ) : Icon ? (
          <span className="w-16 h-16 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 flex items-center justify-center">
            <Icon className="w-7 h-7" aria-hidden strokeWidth={1.9} />
          </span>
        ) : (
          <VyronAvatar size={72} state="idle" />
        )}
      </div>
      <h3 className="font-display text-base font-bold text-surface-900 dark:text-white mb-1">{title}</h3>
      {text && <p className="text-sm text-surface-600 dark:text-surface-400 max-w-xs mx-auto mb-5">{text}</p>}
      {cta &&
        (ctaHref ? (
          <Link href={ctaHref} className={btn}>
            {ctaLabel}
          </Link>
        ) : (
          <button type="button" onClick={onCta} className={btn}>
            {ctaLabel}
          </button>
        ))}
    </div>
  )
}
