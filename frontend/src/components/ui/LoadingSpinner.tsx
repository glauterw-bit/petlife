'use client'

import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
}

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizes = { sm: 'w-6 h-6', md: 'w-10 h-10', lg: 'w-16 h-16' }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn('relative', sizes[size])}>
        {/* Paw print loader */}
        <svg
          viewBox="0 0 100 100"
          className={cn('animate-paw-bounce', sizes[size])}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main pad */}
          <ellipse cx="50" cy="65" rx="20" ry="18" fill="#10b981" opacity="0.9" />
          {/* Toe pads */}
          <ellipse cx="28" cy="45" rx="10" ry="12" fill="#10b981" opacity="0.8" />
          <ellipse cx="72" cy="45" rx="10" ry="12" fill="#10b981" opacity="0.8" />
          <ellipse cx="38" cy="32" rx="9" ry="11" fill="#10b981" opacity="0.7" />
          <ellipse cx="62" cy="32" rx="9" ry="11" fill="#10b981" opacity="0.7" />
        </svg>
        {/* Spinner ring */}
        <div className={cn('absolute inset-0 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin', sizes[size])} />
      </div>
      {text && <p className="text-sm text-surface-500 animate-pulse-soft">{text}</p>}
    </div>
  )
}

export function PageLoader({ text = 'Carregando...' }: { text?: string }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <LoadingSpinner size="lg" text={text} />
    </div>
  )
}
