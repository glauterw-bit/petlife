'use client'

import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastProps {
  toast: ToastItem
  onRemove: (id: string) => void
}

export function Toast({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [toast, onRemove])

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  }

  const styles = {
    success: 'bg-white border-green-200',
    error: 'bg-white border-red-200',
    warning: 'bg-white border-yellow-200',
    info: 'bg-white border-blue-200',
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border shadow-lg max-w-sm w-full animate-slide-up',
        styles[toast.type]
      )}
    >
      {icons[toast.type]}
      <p className="text-sm text-surface-700 flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-surface-400 hover:text-surface-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
