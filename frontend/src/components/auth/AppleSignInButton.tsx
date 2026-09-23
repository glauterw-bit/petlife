'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import { track } from '@/lib/track'

/**
 * "Continuar com a Apple" — só no app do iPhone e só quando o build instalado
 * já tem o plugin nativo (builds antigos não mostram o botão).
 */
function appleAvailable(): boolean {
  try {
    const w = window as typeof window & {
      Capacitor?: { getPlatform?: () => string; isPluginAvailable?: (n: string) => boolean }
    }
    return w.Capacitor?.getPlatform?.() === 'ios' && !!w.Capacitor?.isPluginAvailable?.('SignInWithApple')
  } catch {
    return false
  }
}

export function AppleSignInButton({ onSuccess, referralCode }: {
  onSuccess: () => void
  referralCode?: string
}) {
  const t = useT()
  const { loginWithSession } = useAuth()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { setShow(appleAvailable()) }, [])

  async function go() {
    if (busy) return
    setBusy(true)
    setErr('')
    track('apple_signin_start')
    try {
      const { SignInWithApple } = await import('@capacitor-community/apple-sign-in')
      const { response } = await SignInWithApple.authorize({
        clientId: 'app.petlife',
        redirectURI: 'https://petlife-frontend-production.up.railway.app',
        scopes: 'email name',
      })
      const name = [response.givenName, response.familyName].filter(Boolean).join(' ')
      const res = await auth.apple({
        identity_token: response.identityToken,
        name: name || undefined,
        referral_code: referralCode || undefined,
      })
      loginWithSession(res.access_token, res.user)
      track('apple_signin_ok')
      onSuccess()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      // cancelou a folha da Apple: silencioso
      if (!/cancel|1001/i.test(msg)) setErr(msg || t('ac.apple.error'))
    } finally {
      setBusy(false)
    }
  }

  if (!show) return null

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="pressable w-full flex items-center justify-center gap-2 bg-black text-white font-semibold py-3.5 rounded-xl hover:bg-surface-900 disabled:opacity-60 transition"
      >
        {busy ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
            <path d="M16.365 1.43c0 1.14-.46 2.23-1.2 3.03-.8.86-2.1 1.52-3.17 1.43-.14-1.1.41-2.26 1.14-3.03.8-.85 2.18-1.49 3.23-1.43zM20.5 17.1c-.56 1.3-.83 1.88-1.55 3.03-1 1.6-2.42 3.6-4.18 3.61-1.56.02-1.96-1.01-4.08-1-2.12.01-2.56 1.02-4.12 1-1.76-.02-3.1-1.82-4.1-3.42C-.33 15.9-.62 10.66 1.4 7.83c1.44-2.01 3.7-3.19 5.83-3.19 2.17 0 3.53 1.19 5.33 1.19 1.74 0 2.8-1.19 5.31-1.19 1.9 0 3.9 1.03 5.33 2.82-4.68 2.56-3.92 9.25-2.7 9.64z" />
          </svg>
        )}
        {t('ac.apple.continue')}
      </button>
      {err && <p className="text-xs text-red-600 mt-2 text-center">{err}</p>}
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
        <span className="text-xs text-surface-400">{t('ac.apple.or')}</span>
        <div className="flex-1 h-px bg-surface-200 dark:bg-surface-700" />
      </div>
    </div>
  )
}
