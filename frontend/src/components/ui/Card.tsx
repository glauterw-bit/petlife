'use client'

import Link from 'next/link'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type CardTone = 'default' | 'muted' | 'success' | 'warning' | 'danger' | 'brand'

export type CardProps = {
  as?: 'div' | 'section' | 'article' | 'li'
  href?: string
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  tone?: CardTone
  className?: string
  children: ReactNode
} & HTMLAttributes<HTMLElement>

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5 sm:p-6' }

const TONES: Record<CardTone, string> = {
  default: 'bg-white dark:bg-surface-900 border-surface-200/70 dark:border-surface-800',
  muted: 'bg-surface-100/70 dark:bg-surface-900/60 border-surface-200/60 dark:border-surface-800',
  success: 'tone-success-bg',
  warning: 'tone-warning-bg',
  danger: 'tone-danger-bg',
  brand: 'tone-brand-bg',
}

export function cardClasses(opts: { tone?: CardTone; padding?: CardProps['padding']; interactive?: boolean; className?: string } = {}) {
  const { tone = 'default', padding = 'md', interactive = false, className } = opts
  return cn(
    'block rounded-2xl border',
    TONES[tone],
    PADDING[padding],
    interactive &&
      'pressable cursor-pointer transition-[background-color,border-color,box-shadow] duration-150 hover:border-surface-300 hover:shadow-card dark:hover:border-surface-700 dark:hover:bg-surface-800/70',
    className,
  )
}

export function Card({
  as = 'div',
  href,
  interactive,
  padding = 'md',
  tone = 'default',
  className,
  children,
  ...rest
}: CardProps) {
  const classes = cardClasses({ tone, padding, interactive: interactive ?? !!href, className })
  if (href) {
    const link = (
      <Link href={href} className={classes} {...(rest as HTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    )
    return as === 'li' ? <li className="list-none">{link}</li> : link
  }
  const Tag = as
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  )
}
