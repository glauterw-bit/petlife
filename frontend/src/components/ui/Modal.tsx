'use client'

import { useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { DialogFrame } from './Sheet'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_CLASSES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
}

/**
 * Diálogo genérico. No celular se comporta como folha de baixo (entra de
 * baixo, alça, arraste para fechar, saída animada); no desktop, centralizado.
 * Portal no body, role=dialog, foco preso. z-70: acima da BottomNav (z-50).
 */
export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  const t = useT()
  const id = useId()
  const titleId = title ? `${id}-title` : undefined

  const closeBtn = (
    <button
      type="button"
      onClick={onClose}
      aria-label={t('common.close')}
      className="pressable w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-700 transition-colors"
    >
      <X className="w-5 h-5" aria-hidden />
    </button>
  )

  const header = title ? (
    <div className="flex items-center justify-between gap-3 pl-4 pr-2 sm:pl-6 sm:pr-3 pb-2 sm:py-3 border-b border-surface-100 dark:border-surface-800">
      <h2 id={titleId} className="text-lg font-bold font-display text-surface-900 dark:text-white min-w-0 truncate">
        {title}
      </h2>
      {closeBtn}
    </div>
  ) : (
    <div className="absolute top-1.5 right-1.5 z-10">{closeBtn}</div>
  )

  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      header={header}
      labelledBy={titleId}
      ariaLabel={title}
      panelClassName={cn(SIZE_CLASSES[size], className)}
      bodyClassName="p-4 sm:p-6 pb-keyboard"
    >
      {children}
    </DialogFrame>
  )
}
