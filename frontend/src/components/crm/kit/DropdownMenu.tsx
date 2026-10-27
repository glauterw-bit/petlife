'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { useLayer } from './layers'

export interface MenuItem { label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string }

/** Menu suspenso acessível: setas, Esc, clique fora e posição dentro da tela. */
export function DropdownMenu({ trigger, items, align = 'start', ariaLabel, triggerClassName = '' }: {
  trigger: ReactNode; items: Array<MenuItem | 'separator'>; align?: 'start' | 'end'; ariaLabel: string; triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  useEffect(() => setMounted(true), [])

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) setTimeout(() => btnRef.current?.focus({ preventScroll: true }), 0)
  }
  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true) }
  }

  return (
    <>
      <button ref={btnRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)} onKeyDown={onTriggerKey} className={triggerClassName}>
        {trigger}
      </button>
      {mounted && createPortal(
        <AnimatePresence>
          {open && <Menu key="m" id={menuId} anchor={btnRef} items={items} align={align} ariaLabel={ariaLabel} onClose={close} />}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

function Menu({ id, anchor, items, align, ariaLabel, onClose }: {
  id: string; anchor: React.RefObject<HTMLButtonElement>; items: Array<MenuItem | 'separator'>; align: 'start' | 'end'; ariaLabel: string
  onClose: (refocus?: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { z } = useLayer(true, () => onClose(true), { lockScroll: false })
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null)
  const [active, setActive] = useState(-1)
  const enabled = items.map((it, i) => (it !== 'separator' && !it.disabled ? i : -1)).filter(i => i >= 0)

  const place = () => {
    const a = anchor.current, m = ref.current
    if (!a || !m) return
    const r = a.getBoundingClientRect()
    const mw = m.offsetWidth, mh = m.offsetHeight
    const vw = window.innerWidth, vh = window.innerHeight
    let left = align === 'end' ? r.right - mw : r.left
    left = Math.max(8, Math.min(left, vw - mw - 8))
    const below = r.bottom + 6
    const up = below + mh > vh - 8 && r.top - mh - 6 > 8
    const top = up ? r.top - mh - 6 : Math.min(below, Math.max(8, vh - mh - 8))
    setPos(p => (p && p.top === top && p.left === left && p.up === up ? p : { top, left, up }))
  }
  useLayoutEffect(place, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onWin = () => place()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return
      onClose(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    const t = setTimeout(() => {
      setActive(enabled[0] ?? -1)
      ref.current?.querySelector<HTMLElement>('[role=menuitem]:not([disabled])')?.focus({ preventScroll: true })
    }, 10)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const focusAt = (i: number) => {
    setActive(i)
    ref.current?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.focus({ preventScroll: true })
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled.length) return
    const cur = enabled.indexOf(active)
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(enabled[(cur + 1) % enabled.length]) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(enabled[(cur - 1 + enabled.length) % enabled.length]) }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(enabled[0]) }
    else if (e.key === 'End') { e.preventDefault(); focusAt(enabled[enabled.length - 1]) }
    else if (e.key === 'Tab') { onClose(false) }
  }
  const pick = (it: MenuItem) => {
    if (it.disabled) return
    onClose(true)
    it.onSelect()
  }

  return (
    <m.div
      ref={ref} id={id} role="menu" aria-label={ariaLabel} onKeyDown={onKey}
      className="fixed min-w-[200px] max-w-[min(320px,calc(100vw-16px))] rounded-xl bg-panel p-1 shadow-crm-pop text-ink"
      style={{ zIndex: z + 1, top: pos?.top ?? -9999, left: pos?.left ?? -9999, transformOrigin: pos?.up ? 'bottom' : 'top' }}
      initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
    >
      {items.map((it, i) => it === 'separator'
        ? <div key={`s${i}`} role="separator" className="my-1 h-px bg-line" />
        : (
          <button key={`${it.label}-${i}`} type="button" role="menuitem" data-idx={i} disabled={it.disabled} tabIndex={active === i ? 0 : -1}
            onClick={() => pick(it)} onMouseEnter={() => !it.disabled && setActive(i)}
            className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm text-left outline-none transition-colors disabled:opacity-40
              ${it.danger ? 'text-red-600 dark:text-red-400' : ''} ${active === i ? (it.danger ? 'bg-red-50 dark:bg-red-500/15' : 'bg-panel-2') : ''}`}>
            {it.icon && <it.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden />}
            <span className="flex-1 truncate">{it.label}</span>
            {it.hint && <span className="text-2xs text-muted shrink-0">{it.hint}</span>}
          </button>
        ))}
    </m.div>
  )
}
