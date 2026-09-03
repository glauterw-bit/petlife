'use client'

import { useState, useEffect, FormEvent, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, PawPrint, Mail, Lock, AlertCircle, Info } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'

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
  const { login } = useAuth()
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
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    if (searchParams?.get('session_expired') === '1') {
      setSessionExpired(true)
    }
  }, [searchParams])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      try { localStorage.setItem('petlife_last_email', email.trim().toLowerCase()) } catch {}
      await login(email, password, remember)
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('ac.login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
              <PawPrint className="w-9 h-9 text-white" />
            </div>
            <span className="text-2xl font-bold text-surface-900 dark:text-white">PetLife</span>
          </Link>
          <h1 className="text-xl font-semibold text-surface-700 dark:text-surface-200 mt-4">{t('ac.login.welcome')}</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">{t('ac.login.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 p-6 sm:p-8">
          {sessionExpired && !error && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl p-3 mb-6 text-sm">
              <Info className="w-4 h-4 shrink-0" />
              {t('ac.login.sessionExpired')}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-6 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                {t('ac.field.email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('ac.field.emailPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                {t('ac.field.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none -mt-1">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500 shrink-0"
              />
              <span className="text-sm text-surface-600 dark:text-surface-300">
                {t('ac.login.remember')}
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="pressable w-full bg-primary-500 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-primary-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <PawPrint className="w-5 h-5" />
              )}
              {loading ? t('ac.login.submitting') : t('ac.login.submit')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/auth/forgot" className="text-sm text-primary-600 hover:underline">
              {t('ac.login.forgot')}
            </Link>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('ac.login.noAccount')}{' '}
              <Link href="/auth/register" className="text-primary-600 font-semibold hover:underline">
                {t('ac.login.signupFree')}
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('ac.login.isVet')}{' '}
              <Link href="/vet/login" className="text-accent-600 font-semibold hover:underline">
                {t('ac.login.vetAccess')}
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">
          {t('ac.login.footer')}
        </p>
      </div>
    </div>
  )
}
