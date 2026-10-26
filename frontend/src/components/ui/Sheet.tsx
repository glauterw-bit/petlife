'use client'

/**
 * Folha de baixo (bottom sheet) — o padrão de diálogo do app no celular.
 *
 * - Portal no body (z-70, acima da barra inferior e do Vyron).
 * - Entra de baixo com mola, sai animada; a alça e o cabeçalho seguem o dedo
 *   e fecham ao arrastar > 120 px ou soltar rápido (> 500 px/s).
 * - role="dialog", foco preso dentro e devolvido ao fechar, Esc fecha.
 * - Trava a rolagem do fundo do jeito que funciona no iOS.
 * - No desktop (≥ 640 px) vira um diálogo centralizado.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, MotionConfig, motion, useDragControls, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { spring, variants, dur, easeOut } from '@/lib/motion'
import { useScrollLock } from './useScrollLock'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    setDesktop(mq.matches)
    const h = (e: MediaQueryListEvent) => setDesktop(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return desktop
}

/** Monta o portal só no cliente. */
function usePortalReady(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return ready
}

export interface DialogFrameProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Conteúdo do cabeçalho (título etc.). A alça é desenhada pelo frame. */
  header?: ReactNode
  footer?: ReactNode
  labelledBy?: string
  describedBy?: string
  ariaLabel?: string
  dismissible?: boolean
  /** Classes do painel (largura no desktop, altura). */
  panelClassName?: string
  bodyClassName?: string
}

/**
 * Moldura compartilhada por Sheet e Modal. Exportada para os componentes de
 * ui/; telas devem usar <Sheet> ou <Modal>.
 */
export function DialogFrame({
  open,
  onClose,
  children,
  header,
  footer,
  labelledBy,
  describedBy,
  ariaLabel,
  dismissible = true,
  panelClassName,
  bodyClassName,
}: DialogFrameProps) {
  const ready = usePortalReady()
  const desktop = useIsDesktop()
  useScrollLock(open)
  if (!ready) return null
  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <FramePanel
            key="dialog"
            onClose={onClose}
            header={header}
            footer={footer}
            labelledBy={labelledBy}
            describedBy={describedBy}
            ariaLabel={ariaLabel}
            dismissible={dismissible}
            desktop={desktop}
            panelClassName={panelClassName}
            bodyClassName={bodyClassName}
          >
            {children}
          </FramePanel>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  )
}

function FramePanel({
  onClose,
  children,
  header,
  footer,
  labelledBy,
  describedBy,
  ariaLabel,
  dismissible,
  desktop,
  panelClassName,
  bodyClassName,
}: Omit<DialogFrameProps, 'open'> & { desktop: boolean }) {
  const t = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  // Arraste para baixo: o fundo escurecido clareia junto (1 → .15 em 360 px).
  const dragY = useMotionValue(0)
  const dimOpacity = useTransform(dragY, [0, 360], [1, 0.15])
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const requestClose = useCallback(() => {
    if (dismissible) onCloseRef.current()
  }, [dismissible])

  // Foco: entra no painel, fica preso, volta para quem abriu.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? null
    // Não roubar o foco para um campo (abriria o teclado sem pedido): foca o painel.
    ;(first ?? panel)?.focus({ preventScroll: true })

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        requestClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetParent !== null || el === document.activeElement,
      )
      if (!items.length) {
        e.preventDefault()
        panel.focus()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === firstEl || document.activeElement === panel)) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus({ preventScroll: true })
      }
    }
  }, [requestClose])

  function startDrag(e: ReactPointerEvent) {
    if (desktop || !dismissible) return
    // não iniciar arraste a partir de botões do cabeçalho
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return
    controls.start(e)
  }

  function onDrag(_: unknown, info: PanInfo) {
    dragY.set(Math.max(0, info.offset.y))
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      requestClose()
      return
    }
    animate(dragY, 0, spring.snappy)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <motion.div
        aria-hidden
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: dur.fast, ease: easeOut }}
        onClick={requestClose}
      >
        <motion.div className="absolute inset-0 bg-black/45 dark:bg-black/60" style={{ opacity: dimOpacity }} />
      </motion.div>
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        tabIndex={-1}
        className={cn(
          'relative w-full flex flex-col outline-none overflow-hidden',
          'bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100',
          'rounded-t-3xl sm:rounded-3xl shadow-float',
          'border-t border-surface-200/60 dark:border-surface-800 sm:border',
          'max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] sm:max-h-[min(88dvh,760px)]',
          panelClassName,
        )}
        variants={desktop ? variants.scaleIn : variants.sheet}
        initial="hidden"
        animate="show"
        exit={desktop ? 'hidden' : 'exit'}
        transition={desktop ? { duration: dur.base, ease: easeOut } : spring.snappy}
        drag={desktop || !dismissible ? false : 'y'}
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        // Leve resistência para cima (folha "elástica"), solta para baixo.
        dragElastic={{ top: 0.06, bottom: 0.7 }}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
      >
        <div onPointerDown={startDrag} className="shrink-0 touch-none sm:touch-auto">
          <div className="sm:hidden flex justify-center pt-2.5 pb-1" aria-hidden={!dismissible}>
            <span
              className="block w-10 h-1.5 rounded-full bg-surface-300 dark:bg-surface-700"
              title={dismissible ? t('ui.sheet.handle') : undefined}
            />
          </div>
          {header}
        </div>
        <div
          className={cn(
            'flex-1 min-h-0 overflow-y-auto overscroll-contain',
            footer ? 'pb-3' : 'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5',
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-surface-100 dark:border-surface-800 px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4 bg-white dark:bg-surface-900">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  )
}

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'auto' | 'tall' | 'full'
  ariaLabel?: string
  dismissible?: boolean
}

const SIZES = {
  auto: '',
  tall: 'h-[85dvh] sm:h-auto',
  full: 'h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] sm:h-auto',
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'auto',
  ariaLabel,
  dismissible = true,
}: SheetProps) {
  const t = useT()
  const id = useId()
  const titleId = title ? `${id}-title` : undefined
  const descId = description ? `${id}-desc` : undefined

  const header =
    title || description || dismissible ? (
      <div className={cn('flex items-start gap-3 px-5 sm:px-6', title || description ? 'pt-1.5 sm:pt-5 pb-3' : 'pt-0 pb-1 sm:pt-3')}>
        <div className="flex-1 min-w-0">
          {title && (
            <h2 id={titleId} className="font-display text-lg font-extrabold leading-snug text-surface-900 dark:text-white">
              {title}
            </h2>
          )}
          {description && (
            <p id={descId} className="mt-1 text-sm text-surface-600 dark:text-surface-400">
              {description}
            </p>
          )}
        </div>
        {dismissible && (title || description) && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('ui.sheet.close')}
            className="pressable -mr-2 -mt-1 w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        )}
      </div>
    ) : null

  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      header={header}
      footer={footer}
      labelledBy={titleId}
      describedBy={descId}
      ariaLabel={ariaLabel ?? title}
      dismissible={dismissible}
      panelClassName={cn('sm:max-w-md', SIZES[size])}
      bodyClassName="px-5 sm:px-6"
    >
      {children}
    </DialogFrame>
  )
}
