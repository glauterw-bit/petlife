'use client'

/**
 * Telemetria própria (fire-and-forget). Nunca quebra a UI.
 *
 * Com login o evento vai com o usuário; sem login (primeira abertura, cadastro)
 * vai só com um id aleatório do aparelho — nenhum dado pessoal. Cada evento
 * leva a tela (ids viram ":id"), a plataforma e a versão nativa do app.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'
const DEVICE_KEY = 'petlife_device_id'
export const APP_VERSION_KEY = 'petlife_app_version'

// Eventos aceitos sem login (espelha ANON_ALLOWED do backend)
const ANON = new Set([
  'page_view', 'ui_error', 'client_error', 'api_error', 'start_shown', 'start_step',
  'start_pet_done', 'register_view', 'login_view', 'apple_signin_start', 'apple_signin_error',
])

function platform(): string {
  try {
    const w = window as typeof window & { Capacitor?: { getPlatform?: () => string } }
    return w.Capacitor?.getPlatform?.() || 'web'
  } catch {
    return 'web'
  }
}

export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

/** /pets/276 → /pets/:id · /p/thor-golden → /p/:slug (nada de id ou nome na telemetria) */
export function normalizePath(p: string): string {
  return (p || '/')
    .split('?')[0]
    .replace(/^\/p\/[^/]+/, '/p/:slug')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .slice(0, 80)
}

export function track(event: string, extra?: { meta?: string; path?: string }): void {
  try {
    const token = localStorage.getItem('petlife_token')
    if (!token && !ANON.has(event)) return
    const body = JSON.stringify({
      event,
      platform: platform(),
      device_id: deviceId() || undefined,
      path: normalizePath(extra?.path ?? window.location.pathname),
      meta: extra?.meta ? extra.meta.slice(0, 120) : undefined,
      app_version: localStorage.getItem(APP_VERSION_KEY) || undefined,
    })
    void fetch(`${API_URL}/events${token ? '' : '/anon'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body,
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
