'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m, useDragControls, useIsPresent, type PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { dur, ease, spring } from '../motion'
import { useFocusTrap, useLayer } from './layers'

/**
 * Gaveta do CRM: à direita no computador, de baixo no celular (arrastar para
 * baixo fecha). Esc fecha só a do topo; Ctrl/Cmd+Enter envia.
 */
export function Sheet({ open, onClose, title, description, children, footer, size = 'md', onSubmit, initialFocus = true }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'; onSubmit?: () => void; initialFocus?: boolean
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <SheetLayer key="sheet" onClose={onClose} title={title} description={description} footer={footer} size={size} onSubmit={onSubmit} initialFocus={initialFocus}>
          {children}
        </SheetLayer>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const WIDTH = { md: 'md:w-[480px]', lg: 'md:w-[640px]', xl: 'md:w-[860px]' }

function SheetLayer({ onClose, title, description, children, footer, size, onSubmit, initialFocus }: {
  onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode
  size: 'md' | 'lg' | 'xl'; onSubmit?: () => void; initialFocus: boolean
}) {
  // decidido na abertura (a gaveta só existe no navegador), para a animação não trocar de eixo no meio
  const [desktop] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(min-width: 768px)').matches)
  const { z, isTop } = useLayer(true, onClose)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const drag = useDragControls()
  const submitRef = useRef(onSubmit)
  submitRef.current = onSubmit
  useFocusTrap(true, panelRef, isTop, initialFocus ? 'field' : 'none')

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isTop() && submitRef.current) {
        e.preventDefault()
        submitRef.current()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isTop])

  // Saindo: a camada não segura cliques enquanto a gaveta some.
  const present = useIsPresent()

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 800) onClose()
  }

  return (
    <div className={`crm-layer fixed inset-0 ${present ? '' : 'pointer-events-none'}`} style={{ zIndex: z }}>
      <m.div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        onClick={onClose} aria-hidden
      />
      <m.div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`absolute flex flex-col bg-panel text-ink shadow-crm-pop outline-none
          inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl
          md:inset-x-auto md:right-3 md:top-3 md:bottom-3 md:max-h-none md:rounded-2xl md:max-w-[calc(100vw-24px)] ${WIDTH[size]}`}
        initial={desktop ? { x: '105%' } : { y: '100%' }}
        animate={desktop ? { x: 0 } : { y: 0 }}
        exit={desktop ? { x: '105%', transition: { duration: dur.base, ease: ease.inOut } } : { y: '100%', transition: { duration: dur.base, ease: ease.inOut } }}
        transition={spring.soft}
        drag={desktop ? false : 'y'}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={onDragEnd}
      >
        <div className="md:hidden flex justify-center pt-2 pb-1 touch-none cursor-grab" onPointerDown={e => drag.start(e)} aria-hidden>
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        <header className="flex items-start gap-3 px-5 pt-2 md:pt-5 pb-3 border-b border-line touch-none md:touch-auto" onPointerDown={e => { if (!desktop) drag.start(e) }}>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-extrabold text-ink leading-tight">{title}</h2>
            {description && <p id={descId} className="text-sm text-muted mt-0.5">{description}</p>}
          </div>
          <button type="button" onClick={onClose} onPointerDown={e => e.stopPropagation()} aria-label="Fechar"
            className="-mr-1.5 -mt-0.5 h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-panel-2 transition-colors">
            <X className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && (
          <footer className="border-t border-line px-5 pt-3 flex items-center justify-end gap-2 flex-wrap"
            style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
            {footer}
          </footer>
        )}
      </m.div>
    </div>
  )
}
