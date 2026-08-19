'use client'

import { Suspense, useState, FormEvent, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Lock, Mail, AlertCircle, CheckCircle, KeyRound, Eye, EyeOff, PawPrint } from 'lucide-react'
import { auth } from '@/lib/api'
import { useT } from '@/contexts/LocaleContext'

function ResetPasswordInner() {
  const router = useRouter()
  const search = useSearchParams()
  const t = useT()
  const [email, setEmail] = useState(search.get('email') ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fromQs = search.get('email')
    if (fromQs) setEmail(fromQs)
  }, [search])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError(t('ac.err.passMismatch')); return }
    if (password.length < 6) { setError(t('ac.err.passMin6')); return }
    setLoading(true)
    try {
      await auth.resetPassword(email.trim().toLowerCase(), code.trim(), password)
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 2200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('ac.reset.err'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-primary-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-emerald-100 p-10 animate-slide-up">
          <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-white mb-2">{t('ac.reset.successTitle')}</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">{t('ac.reset.successBody')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
              <PawPrint className="w-9 h-9 text-white" />
            </div>
            <span className="text-2xl font-bold text-surface-900 dark:text-white">PetLife</span>
          </Link>
          <h1 className="text-xl font-semibold text-surface-700 dark:text-surface-200 mt-4">{t('ac.reset.title')}</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">{t('ac.reset.subtitle')}</p>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 p-6 sm:p-8">
          <Link href="/auth/forgot" className="inline-flex items-center gap-1.5 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 mb-6">
            <ArrowLeft className="w-4 h-4" />
            {t('nav.back')}
          </Link>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-6 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.field.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('ac.field.emailPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.reset.codeLabel')}</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="text"
                  required
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-lg font-mono tracking-widest text-surface-900 dark:text-white placeholder-surface-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.field.newPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? t('ac.pass.hide') : t('ac.pass.show')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.field.confirmNewPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="pressable w-full bg-primary-500 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-primary-200 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {loading ? t('ac.reset.submitting') : t('ac.reset.title')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const t = useT()
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-surface-500 dark:text-surface-400 text-sm">{t('common.loading')}</div>}>
      <ResetPasswordInner />
    </Suspense>
  )
}
