'use client'

import { useEffect } from 'react'

/**
 * Páginas públicas (carteirinha, pet perdido, retrospectiva, convite) abrem
 * fora do app, no navegador de quem recebeu o link. Aqui seguimos o tema do
 * aparelho (prefers-color-scheme); o app em si continua claro por padrão.
 *
 * O ThemeProvider aplica o tema do app no efeito dele, que roda DEPOIS do
 * efeito da página (filhos primeiro). Por isso aplicamos no próximo quadro e
 * de novo logo depois, e devolvemos o tema do app ao sair da página.
 */
export function usePublicColorScheme(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    let stored: string | null = null
    try { stored = localStorage.getItem('petlife_theme') } catch { /* sem storage */ }
    const apply = () => document.documentElement.classList.toggle('dark', stored === 'dark' || mq.matches)
    const raf = requestAnimationFrame(apply)
    const timer = setTimeout(apply, 60)
    mq.addEventListener?.('change', apply)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      mq.removeEventListener?.('change', apply)
      document.documentElement.classList.toggle('dark', stored === 'dark')
    }
  }, [])
}
