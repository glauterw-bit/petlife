'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Toast, ToastItem, ToastType } from './Toast'

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type, duration }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const success = useCallback((msg: string) => showToast(msg, 'success'), [showToast])
  const error = useCallback((msg: string) => showToast(msg, 'error'), [showToast])
  const warning = useCallback((msg: string) => showToast(msg, 'warning'), [showToast])
  const info = useCallback((msg: string) => showToast(msg, 'info'), [showToast])

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {/*
        Respeita a safe-area (notch / Dynamic Island) pra o banner NÃO ficar
        cortado no topo, e desce o suficiente pra não colidir com o sininho
        (que também fica no canto superior direito). Insets laterais evitam
        corte nas bordas em telas estreitas.
      */}
      <div
        className="fixed z-50 flex flex-col items-end gap-2 pointer-events-none"
        style={{
          top: 'calc(env(safe-area-inset-top) + 3.5rem)',
          right: 'max(0.75rem, env(safe-area-inset-right))',
          left: 'max(0.75rem, env(safe-area-inset-left))',
        }}
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto w-full max-w-sm">
            <Toast toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
