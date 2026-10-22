'use client'

import { AlertTriangle, RotateCw, WifiOff } from 'lucide-react'
import { Btn } from '../ui'

export function ErrorState({ message, onRetry, compact }: { message?: string | null; onRetry?: () => void; compact?: boolean }) {
  const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || /failed to fetch|network|load failed/i.test(message || '')
  const Icon = offline ? WifiOff : AlertTriangle
  const detail = offline ? 'Confira a sua conexão com a internet.' : message
  return (
    <div role="alert" className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-12'} px-4`}>
      <span className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300 inline-flex items-center justify-center">
        <Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">Não foi possível carregar.</p>
      {detail && <p className="mt-1 text-sm text-muted max-w-sm">{detail}</p>}
      {onRetry && <Btn variant="outline" size="sm" icon={RotateCw} className="mt-4" onClick={onRetry}>Tentar de novo</Btn>}
    </div>
  )
}
