'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Links profundos `petlife://…` (eventos da App Store, campanhas):
 * petlife://health/vaccines → /health/vaccines. Rota fora da lista vai pro
 * início — nunca abre caminho arbitrário vindo de fora.
 */
const ALLOWED = ['/dashboard', '/health', '/pets', '/walks', '/plans', '/suporte', '/start', '/convites']

export function DeepLinks() {
  const router = useRouter()

  useEffect(() => {
    const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }
    if (!w.Capacitor?.isNativePlatform?.()) return
    let remove: (() => void) | undefined
    import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('appUrlOpen', ({ url }) => {
          try {
            const u = new URL(url)
            // petlife://health/vaccines → host "health" + path "/vaccines"
            const path = u.protocol === 'petlife:' ? `/${u.host}${u.pathname}` : u.pathname
            const clean = path.replace(/\/+$/, '') || '/dashboard'
            router.push(ALLOWED.some(p => clean === p || clean.startsWith(p + '/')) ? clean + u.search : '/dashboard')
          } catch {
            router.push('/dashboard')
          }
        }),
      )
      .then(h => { remove = () => { void h.remove() } })
      .catch(() => {})
    return () => remove?.()
  }, [router])

  return null
}
