'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hapticLight } from '@/lib/feedback'

export type IconButtonProps = {
  icon: LucideIcon
  /** Vira aria-label (botão só com ícone precisa de nome acessível). */
  label: string
  variant?: 'ghost' | 'soft' | 'solid' | 'glass'
  size?: 44 | 48
  badge?: number
} & ButtonHTMLAttributes<HTMLButtonElement>

const VARIANTS = {
  ghost: 'text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800',
  soft: 'bg-surface-100 text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-200 dark:hover:bg-surface-700',
  solid: 'bg-primary-700 text-white hover:bg-primary-800 dark:bg-primary-500 dark:text-surface-950 dark:hover:bg-primary-400',
  glass:
    'bg-white/80 text-surface-700 border border-surface-200/80 shadow-sm backdrop-blur-xl hover:bg-white dark:bg-surface-900/80 dark:text-surface-200 dark:border-surface-700/80 dark:hover:bg-surface-800',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 44, badge, className, onClick, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={rest.title ?? label}
      onClick={e => {
        void hapticLight()
        onClick?.(e)
      }}
      className={cn(
        'pressable relative inline-flex items-center justify-center rounded-xl shrink-0 transition-colors',
        'disabled:opacity-50 disabled:pointer-events-none',
        size === 48 ? 'w-12 h-12' : 'w-11 h-11',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      <Icon className="w-5 h-5" aria-hidden />
      {badge != null && badge > 0 && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-surface-50 dark:ring-surface-950"
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
})
