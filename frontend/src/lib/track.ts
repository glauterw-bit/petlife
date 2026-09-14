'use client'

/** Telemetria própria (fire-and-forget). Nunca quebra a UI. */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

function platform(): string {
  try {
    const w = window as typeof window & { Capacitor?: { getPlatform?: () => string } }
    return w.Capacitor?.getPlatform?.() || 'web'
  } catch {
    return 'web'
  }
}

export function track(event: string): void {
  try {
    const token = localStorage.getItem('petlife_token')
    if (!token) return
    void fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event, platform: platform() }),
      keepalive: true,
    }).catch(() => {})
  } catch {}
}

/** Abertura do app: 1x por sessão do navegador/webview. */
export function trackAppOpenOnce(): void {
  try {
    if (sessionStorage.getItem('petlife_open_tracked')) return
    sessionStorage.setItem('petlife_open_tracked', '1')
    track('app_open')
  } catch {}
}
