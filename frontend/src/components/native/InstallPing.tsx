'use client'

import { useEffect } from 'react'
import { deviceId, APP_VERSION_KEY } from '@/lib/track'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'
const PINGED_KEY = 'petlife_install_pinged'

/**
 * Avisa o servidor na primeira abertura do app neste aparelho (sem login) e
 * guarda a versão nativa instalada (vai junto em cada evento de telemetria).
 * É o "download" que o painel consegue ver na hora — a Apple só publica os
 * números no dia seguinte. Só um id aleatório, nenhum dado pessoal.
 */
export function InstallPing() {
  useEffect(() => {
    try {
      const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }
      if (!w.Capacitor?.isNativePlatform?.()) return

      import('@capacitor/app')
        .then(({ App }) => App.getInfo())
        .then(info => { try { localStorage.setItem(APP_VERSION_KEY, info.version) } catch {} })
        .catch(() => {})

      if (localStorage.getItem(PINGED_KEY)) return
      const id = deviceId()
      if (!id) return
      // Quem já estava logado tinha o app antes do contador existir
      const existing = !!localStorage.getItem('petlife_token')
      fetch(`${API_URL}/events/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: id, platform: w.Capacitor.getPlatform?.(), existing }),
        keepalive: true,
      })
        .then(r => { if (r.ok || r.status === 204) localStorage.setItem(PINGED_KEY, '1') })
        .catch(() => {})
    } catch {}
  }, [])
  return null
}
