'use client'

import { useEffect, useRef } from 'react'

/** Avisos entre telas do CRM: quem salva emite, quem mostra recarrega. */
export type CrmChangeKind = 'appointment' | 'client' | 'patient' | 'sale' | 'cash' | 'record' | 'waitlist'

export function emitCrmChange(kind: CrmChangeKind): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('crm:change', { detail: kind }))
}

export function useCrmChange(kinds: CrmChangeKind[], cb: () => void): void {
  const cbRef = useRef(cb)
  cbRef.current = cb
  const key = kinds.join(',')
  useEffect(() => {
    const wanted = key.split(',')
    const h = (e: Event) => {
      const k = (e as CustomEvent<CrmChangeKind>).detail
      if (wanted.indexOf(k) >= 0) cbRef.current()
    }
    window.addEventListener('crm:change', h)
    return () => window.removeEventListener('crm:change', h)
  }, [key])
}
