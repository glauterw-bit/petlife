'use client'

import { useEffect } from 'react'

/**
 * Trava a rolagem do fundo de forma compatível com iOS (overflow:hidden no
 * body não segura a WKWebView): fixa o body na posição atual e devolve o
 * scrollY ao destravar. Conta referências — várias folhas abertas ao mesmo
 * tempo destravam só quando a última fecha.
 */
let locks = 0
let savedY = 0
let savedStyle: Partial<CSSStyleDeclaration> = {}

function lock() {
  if (locks++ > 0) return
  const b = document.body
  savedY = window.scrollY
  savedStyle = { position: b.style.position, top: b.style.top, left: b.style.left, right: b.style.right, width: b.style.width, overflow: b.style.overflow }
  b.style.position = 'fixed'
  b.style.top = `-${savedY}px`
  b.style.left = '0'
  b.style.right = '0'
  b.style.width = '100%'
  b.style.overflow = 'hidden'
}

function unlock() {
  if (locks === 0 || --locks > 0) return
  const b = document.body
  b.style.position = savedStyle.position ?? ''
  b.style.top = savedStyle.top ?? ''
  b.style.left = savedStyle.left ?? ''
  b.style.right = savedStyle.right ?? ''
  b.style.width = savedStyle.width ?? ''
  b.style.overflow = savedStyle.overflow ?? ''
  window.scrollTo(0, savedY)
}

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    lock()
    return unlock
  }, [active])
}
