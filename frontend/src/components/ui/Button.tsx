'use client'

import Link from 'next/link'
import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hapticLight } from '@/lib/feedback'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  fullWidth?: boolean
  href?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

/** Contraste AA: primary-700 + branco = 5,5:1 (claro); primary-500 + surface-950 (escuro). */
export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-700 text-white hover:bg-primary-800 dark:bg-primary-500 dark:text-surface-950 dark:hover:bg-primary-400 shadow-sm shadow-primary-900/10',
  secondary:
    'bg-white text-surface-800 border border-surface-200 hover:bg-surface-50 dark:bg-surface-800 dark:text-surface-100 dark:border-surface-700 dark:hover:bg-surface-700',
  soft: 'bg-primary-50 text-primary-800 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-200 dark:hover:bg-primary-500/25',
  danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500',
  ghost: 'bg-transparent text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800',
}

const SIZES: Record<ButtonSize, string> = {
  // sm tem 40 px visíveis e área de toque expandida para 44 px (before:)
  sm: 'h-10 px-3.5 text-sm gap-1.5 relative before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-[""]',
  md: 'min-h-[44px] px-4 text-[15px] gap-2',
  lg: 'min-h-[52px] px-5 text-base gap-2',
}

const ICON: Record<ButtonSize, string> = { sm: 'w-4 h-4', md: 'w-[18px] h-[18px]', lg: 'w-5 h-5' }

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false,
  className?: string,
): string {
  return cn(
    'pressable inline-flex items-center justify-center rounded-xl font-semibold select-none whitespace-nowrap',
    'transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-950',
    BUTTON_VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    fullWidth = false,
    href,
    className,
    children,
    onClick,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  const classes = buttonClasses(variant, size, fullWidth, className)
  const iconCls = cn(ICON[size], 'shrink-0')
  const content = (
    <>
      {loading ? (
        <Loader2 className={cn(iconCls, 'animate-spin')} aria-hidden />
      ) : (
        LeftIcon && <LeftIcon className={iconCls} aria-hidden />
      )}
      {children != null && <span className="truncate">{children}</span>}
      {RightIcon && !loading && <RightIcon className={iconCls} aria-hidden />}
    </>
  )

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className={classes}
        aria-label={rest['aria-label']}
        aria-busy={loading || undefined}
        onClick={e => {
          void hapticLight()
          onClick?.(e as unknown as MouseEvent<HTMLButtonElement>)
        }}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={e => {
        void hapticLight()
        onClick?.(e)
      }}
      {...rest}
    >
      {content}
    </button>
  )
})
