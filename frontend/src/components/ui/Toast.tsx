'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration?: number
  action?: ToastAction
}

interface ToastProps {
  toast: ToastItem
  onRemove: (id: string) => void
}

export function Toast({ toast, onRemove }: ToastProps) {
  const [leaving, setLeaving] = useState(false)
  const [dragX, setDragX] = useState(0)
  const startX = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function dismiss() {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => onRemove(toast.id), 200)
  }

  function startTimer() {
    const duration = toast.duration ?? (toast.action ? 6000 : 4000)
    timerRef.current = setTimeout(dismiss, duration)
  }

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    startTimer()
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    clearTimer()
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    if (dx > 0) setDragX(dx)
  }

  function onPointerUp() {
    if (startX.current === null) return
    if (dragX > 80) {
      dismiss()
    } else {
      setDragX(0)
      startTimer()
    }
    startX.current = null
  }

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400 shrink-0" aria-hidden />,
    error: <XCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" aria-hidden />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-500 dark:text-yellow-400 shrink-0" aria-hidden />,
    info: <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0" aria-hidden />,
  }

  const styles = {
    success: 'bg-white dark:bg-surface-800 border-green-200 dark:border-green-900',
    error: 'bg-white dark:bg-surface-800 border-red-200 dark:border-red-900',
    warning: 'bg-white dark:bg-surface-800 border-yellow-200 dark:border-yellow-900',
    info: 'bg-white dark:bg-surface-800 border-blue-200 dark:border-blue-900',
  }

  const actionStyles = {
    success: 'text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950',
    error: 'text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950',
    warning: 'text-yellow-700 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-950',
    info: 'text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950',
  }

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border shadow-lg max-w-sm w-full touch-pan-y select-none',
        styles[toast.type],
        leaving ? 'animate-fade-out' : 'animate-slide-up',
      )}
      style={{
        transform: `translateX(${dragX}px)`,
        opacity: leaving ? 0 : 1 - Math.min(dragX / 200, 0.5),
        transition: dragX === 0 ? 'transform 0.2s ease, opacity 0.2s ease' : undefined,
      }}
    >
      {icons[toast.type]}
      <p className="text-sm text-surface-700 dark:text-surface-200 flex-1 leading-snug">{toast.message}</p>
      {toast.action && (
        <button
          onClick={() => { toast.action!.onClick(); dismiss() }}
          className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-lg transition shrink-0',
            actionStyles[toast.type],
          )}
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Fechar"
        className="text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
