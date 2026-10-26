'use client'

/**
 * Push do servidor (APNs) — registro do aparelho.
 *
 * Complementa `notifications.ts`, que só faz notificação LOCAL. A local é
 * agendada quando o app abre, então nunca alcança quem parou de abrir — que
 * é exatamente quem precisa ser lembrado. O push do servidor resolve isso.
 *
 * Web e Android: no-op silencioso por enquanto (só iOS tem entitlement).
 */
import { push as pushApi } from './api'

const REGISTERED_KEY = 'petlife_push_token'

function isNativeIos(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }
  return !!(w.Capacitor?.isNativePlatform?.() && w.Capacitor?.getPlatform?.() === 'ios')
}

let listenersAdded = false

/**
 * Registra o token no servidor.
 *
 * Por padrão NÃO pede permissão: só registra se o tutor já tiver permitido.
 * O pedido acontece com contexto (PushPrimer, depois da 1ª vacina), via
 * `requestPushPermission()` ou `initPush({ ask: true })`.
 *
 * Idempotente: se o token não mudou desde a última vez, não repete a chamada.
 * Falha em silêncio — push é melhoria, nunca deve quebrar a tela.
 */
export async function initPush(opts?: { ask?: boolean }): Promise<void> {
  if (!isNativeIos()) return
  const ask = opts?.ask ?? false

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const atual = await PushNotifications.checkPermissions()
    let permissao = atual.receive
    if (ask && (permissao === 'prompt' || permissao === 'prompt-with-rationale')) {
      permissao = (await PushNotifications.requestPermissions()).receive
    }
    if (permissao !== 'granted') return

    if (!listenersAdded) {
      listenersAdded = true
      PushNotifications.addListener('registration', async (t) => {
        const token = t?.value
        if (!token) return
        // Token do APNs muda (reinstalação, restauração de backup); só reenvia
        // quando muda de fato.
        try { if (localStorage.getItem(REGISTERED_KEY) === token) return } catch {}
        try {
          await pushApi.register(token)
          try { localStorage.setItem(REGISTERED_KEY, token) } catch {}
        } catch {}
      })
      PushNotifications.addListener('registrationError', () => {})
    }

    await PushNotifications.register()
  } catch {
    // plugin ausente no build ou permissão negada — segue sem push
  }
}

function isNative(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }
  return !!w.Capacitor?.isNativePlatform?.()
}

/**
 * Situação da permissão de avisos no aparelho.
 * No app nativo usa as notificações locais (os lembretes de vacina são
 * locais; no iOS a permissão é a mesma do push). Na web, a Notification API.
 */
export async function getPushPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (typeof window === 'undefined') return 'unsupported'
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const p = await LocalNotifications.checkPermissions()
      if (p.display === 'granted') return 'granted'
      if (p.display === 'denied') return 'denied'
      return 'prompt'
    }
    if (!('Notification' in window)) return 'unsupported'
    const n = Notification.permission
    return n === 'granted' ? 'granted' : n === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'unsupported'
  }
}

/**
 * Pede a permissão (com contexto — só chamar depois que o tutor tocou em
 * "Ativar avisos"), registra o push e devolve se ficou permitido.
 */
export async function requestPushPermission(): Promise<boolean> {
  let ok = false
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      let p = await LocalNotifications.checkPermissions()
      if (p.display === 'prompt' || p.display === 'prompt-with-rationale') {
        p = await LocalNotifications.requestPermissions()
      }
      ok = p.display === 'granted'
      if (ok) await initPush({ ask: true })
    } else if ('Notification' in window) {
      const r = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
      ok = r === 'granted'
    }
  } catch {
    ok = false
  }
  try {
    const { track } = await import('./track')
    track(ok ? 'push_primer_accept' : 'push_primer_decline')
  } catch {}
  return ok
}
