'use client'

import { useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'
const KEY = 'petlife_device_id'

/**
 * Avisa o servidor na primeira abertura do app neste aparelho (sem login).
 * É o "download" que o painel consegue ver na hora — a Apple só publica os
 * números no dia seguinte. Só um id aleatório, nenhum dado pessoal.
 */
export function InstallPing() {
  useEffect(() => {
    try {
      const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }
      if (!w.Capacitor?.isNativePlatform?.()) return
      if (localStorage.getItem(KEY)) return
      const id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`)
      // Quem já estava logado tinha o app antes do contador existir
      const existing = !!localStorage.getItem('petlife_token')
      fetch(`${API_URL}/events/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: id, platform: w.Capacitor.getPlatform?.(), existing }),
        keepalive: true,
      })
        .then(r => { if (r.ok || r.status === 204) localStorage.setItem(KEY, id) })
        .catch(() => {})
    } catch {}
  }, [])
  return null
}
