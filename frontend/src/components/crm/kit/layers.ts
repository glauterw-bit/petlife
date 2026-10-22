'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Pilha global de camadas (gavetas, diálogos, menus). Só a do topo responde
 * ao Esc e prende o foco. z-index começa em 60 e sobe de 2 em 2.
 */
const stack: number[] = []
let seq = 0
let locks = 0
let savedOverflow = ''

export function useLayer(open: boolean, onEscape?: () => void, opts?: { lockScroll?: boolean }) {
  const idRef = useRef(0)
  const [z, setZ] = useState(60)
  const escRef = useRef(onEscape)
  escRef.current = onEscape
  const lock = opts?.lockScroll ?? true

  useEffect(() => {
    if (!open) return
    const id = ++seq
    idRef.current = id
    stack.push(id)
    setZ(60 + (stack.length - 1) * 2)
    if (lock) {
      if (locks === 0) {
        savedOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      }
      locks++
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== id) return
      if (!escRef.current) return
      e.preventDefault()
      escRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const i = stack.indexOf(id)
      if (i >= 0) stack.splice(i, 1)
      if (lock) {
        locks = Math.max(0, locks - 1)
        if (locks === 0) document.body.style.overflow = savedOverflow
      }
    }
  }, [open, lock])

  const isTop = () => stack.length > 0 && stack[stack.length - 1] === idRef.current
  return { z, isTop }
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.prototype.slice.call(root.querySelectorAll(FOCUSABLE)).filter((el: HTMLElement) => el.offsetParent !== null || el === document.activeElement)
}

/** Prende o Tab dentro de `root` enquanto a camada for a do topo; devolve o foco ao fechar. */
export function useFocusTrap(open: boolean, rootRef: React.RefObject<HTMLElement>, isTop: () => boolean, initial: 'field' | 'first' | 'none' = 'first') {
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      const root = rootRef.current
      if (!root || initial === 'none') { root?.focus(); return }
      const els = focusables(root)
      const field = initial === 'field'
        ? els.find(el => el.matches('[data-autofocus]')) || els.find(el => el.matches('input:not([type=checkbox]):not([type=radio]),textarea,select'))
        : els.find(el => el.matches('[data-autofocus]')) || els[0]
      ;(field || root).focus({ preventScroll: true })
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !isTop()) return
      const root = rootRef.current
      if (!root) return
      const els = focusables(root)
      if (!els.length) { e.preventDefault(); root.focus(); return }
      const first = els[0], last = els[els.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!active || !root.contains(active)) { e.preventDefault(); first.focus(); return }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        window.setTimeout(() => opener.focus({ preventScroll: true }), 0)
      }
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
}
