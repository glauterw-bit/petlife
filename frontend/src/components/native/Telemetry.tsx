'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/track'

/**
 * Registra cada tela aberta e os erros de JavaScript — alimenta o painel admin
 * (telas mais usadas, quem está online, erros em tempo real).
 */
export function Telemetry() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return
    track('page_view', { path: pathname })
    if (pathname === '/auth/register') track('register_view', { path: pathname })
    if (pathname === '/auth/login') track('login_view', { path: pathname })
  }, [pathname])

  useEffect(() => {
    let sent = 0 // teto por sessão: um erro em laço não vira enxurrada
    const report = (msg: string) => {
      if (sent >= 5 || !msg) return
      sent += 1
      track('client_error', { meta: msg.slice(0, 110) })
    }
    const onError = (e: ErrorEvent) => report(e.message)
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason
      report(r instanceof Error ? r.message : typeof r === 'string' ? r : '')
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
