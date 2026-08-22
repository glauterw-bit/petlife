'use client'

import { useEffect, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  const t = useT()

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }

  return (
    // z-[60]: acima da BottomNav (z-50). Elas empatavam e, como a nav é
    // renderizada depois no DOM, ela ficava POR CIMA — os botões de ação no
    // rodapé do modal (Salvar/Cancelar) não recebiam o toque no celular.
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative bg-white dark:bg-surface-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full animate-slide-up overflow-hidden flex flex-col',
          'max-h-[calc(100dvh-env(safe-area-inset-top))] sm:max-h-[min(85dvh,720px)]',
          'pb-[env(safe-area-inset-bottom)] sm:pb-0',
          sizeClasses[size],
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-200 dark:border-surface-700 shrink-0">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">{title}</h2>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="tap-target -mr-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="tap-target absolute top-2 right-2 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors z-10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 pb-keyboard">{children}</div>
      </div>
    </div>
  )
}
