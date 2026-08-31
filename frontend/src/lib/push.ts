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

/**
 * Pede permissão e registra o token no servidor.
 *
 * Idempotente: se o token não mudou desde a última vez, não repete a chamada.
 * Falha em silêncio — push é melhoria, nunca deve quebrar a tela.
 */
export async function initPush(): Promise<void> {
  if (!isNativeIos()) return

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const atual = await PushNotifications.checkPermissions()
    let permissao = atual.receive
    if (permissao === 'prompt' || permissao === 'prompt-with-rationale') {
      permissao = (await PushNotifications.requestPermissions()).receive
    }
    if (permissao !== 'granted') return

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

    await PushNotifications.register()
  } catch {
    // plugin ausente no build ou permissão negada — segue sem push
  }
}
