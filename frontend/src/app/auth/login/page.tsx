'use client'

import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, LogIn } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import { AppleSignInButton } from '@/components/auth/AppleSignInButton'
import { takePendingInviteRoute } from '@/lib/petDraft'
import { hapticError } from '@/lib/feedback'
import { Button } from '@/components/ui/Button'
import { AuthFrame, AuthField, PasswordField, Notice, TextLink } from '@/components/auth/AuthUI'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, user, isLoading, isVetUser } = useAuth()
  const t = useT()

  const [email, setEmail] = useState('')

  // Entrar mais rápido: lembra o último e-mail usado (a senha fica com o
  // gerenciador do sistema — autoComplete acima — nunca no nosso storage).
  useEffect(() => {
    try {
      const last = localStorage.getItem('petlife_last_email')
      if (last) setEmail(last)
    } catch {}
  }, [])
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    if (searchParams?.get('session_expired') === '1') {
      setSessionExpired(true)
    }
  }, [searchParams])

  // Sessão salva ainda válida não deve ver o formulário de novo.
  useEffect(() => {
    if (searchParams?.get('session_expired') === '1') return
    if (!isLoading && user) router.replace(isVetUser ? '/clinica' : (takePendingInviteRoute() ?? '/dashboard'))
  }, [isLoading, user, isVetUser, router, searchParams])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      try { localStorage.setItem('petlife_last_email', email.trim().toLowerCase()) } catch {}
      await login(email, password, remember)
      router.push(takePendingInviteRoute() ?? '/dashboard')
    } catch (err: unknown) {
      void hapticError()
      setError(err instanceof Error ? err.message : t('ac.login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame
      title={t('ac.login.welcome')}
      subtitle={t('ac.login.subtitle')}
      footer={<p className="text-center text-xs text-surface-500 dark:text-surface-400 mt-6">{t('ac.login.footer')}</p>}
    >
      {sessionExpired && !error && <Notice tone="info" className="mb-5">{t('ac.login.sessionExpired')}</Notice>}
      {error && <Notice tone="danger" className="mb-5">{error}</Notice>}

      <AppleSignInButton onSuccess={() => router.push(takePendingInviteRoute() ?? '/dashboard')} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="login-email"
          label={t('ac.field.email')}
          icon={Mail}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={t('ac.field.emailPlaceholder')}
        />
        <PasswordField
          id="login-password"
          label={t('ac.field.password')}
          icon={Lock}
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <div className="flex items-center justify-between gap-2 -mt-1">
          <label htmlFor="login-remember" className="flex items-center gap-2.5 cursor-pointer min-h-[44px]">
            <input
              id="login-remember"
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="w-5 h-5 rounded accent-primary-700 dark:accent-primary-500 shrink-0"
            />
            <span className="text-sm text-surface-700 dark:text-surface-300">{t('ac.login.remember')}</span>
          </label>
          <TextLink href="/auth/forgot" className="text-sm">{t('ac.login.forgot')}</TextLink>
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading} leftIcon={LogIn}>
          {loading ? t('ac.login.submitting') : t('ac.login.submit')}
        </Button>
      </form>

      <div className="mt-5 pt-4 border-t border-surface-200/70 dark:border-surface-800 text-center text-sm text-surface-600 dark:text-surface-400 space-y-0">
        <p>
          {t('ac.login.noAccount')}{' '}
          <TextLink href="/auth/register">{t('ac.login.signupFree')}</TextLink>
        </p>
        <p>
          {t('ac.login.isVet')}{' '}
          <TextLink href="/vet/login">{t('ac.login.vetAccess')}</TextLink>
        </p>
      </div>
    </AuthFrame>
  )
}
