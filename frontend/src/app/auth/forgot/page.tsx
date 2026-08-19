'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, AlertCircle, Copy, Check, PawPrint } from 'lucide-react'
import { auth } from '@/lib/api'
import { useT } from '@/contexts/LocaleContext'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const t = useT()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ message: string; code: string | null; emailConfigured: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await auth.forgotPassword(email.trim().toLowerCase())
      setResult({ message: res.message, code: res.code, emailConfigured: res.email_configured !== false })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('ac.forgot.err'))
    } finally {
      setLoading(false)
    }
  }

  function copyCode() {
    if (!result?.code) return
    navigator.clipboard.writeText(result.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function goReset() {
    router.push(`/auth/reset?email=${encodeURIComponent(email.trim().toLowerCase())}`)
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
          <h1 className="text-xl font-semibold text-surface-700 dark:text-surface-200 mt-4">{t('ac.forgot.title')}</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">{t('ac.forgot.subtitle')}</p>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 p-6 sm:p-8">
          <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 mb-6">
            <ArrowLeft className="w-4 h-4" />
            {t('ac.forgot.backToLogin')}
          </Link>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-6 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                  {t('ac.forgot.emailLabel')}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('ac.field.emailPlaceholder')}
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="pressable w-full bg-primary-500 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-primary-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                {loading ? t('ac.forgot.submitting') : t('ac.forgot.submit')}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 text-sm border ${
                result.emailConfigured
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {result.message}
              </div>

              {!result.emailConfigured && (
                <div className="rounded-xl bg-surface-50 dark:bg-surface-700/40 p-4 text-sm text-surface-600 dark:text-surface-300">
                  <p className="font-semibold text-surface-800 dark:text-surface-100 mb-1">{t('ac.forgot.nextTitle')}</p>
                  <p>{t('ac.forgot.nextBody1')}<b>WhatsApp</b>{t('ac.forgot.nextBody2')}</p>
                </div>
              )}

              {result.code && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs uppercase font-semibold tracking-wide text-amber-700 mb-2">
                    {t('ac.forgot.devMode')}
                  </p>
                  <div className="flex items-center justify-between gap-3 bg-white dark:bg-surface-800 rounded-lg border border-amber-200 px-4 py-3">
                    <span className="text-2xl font-mono font-bold text-surface-900 dark:text-white tracking-widest">
                      {result.code}
                    </span>
                    <button
                      onClick={copyCode}
                      className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium"
                    >
                      {copied ? <><Check className="w-4 h-4" /> {t('ac.forgot.copied')}</> : <><Copy className="w-4 h-4" /> {t('ac.forgot.copy')}</>}
                    </button>
                  </div>
                  <p className="text-xs text-amber-700 mt-2">
                    {t('ac.forgot.devNote')}
                  </p>
                </div>
              )}

              <button
                onClick={goReset}
                className="pressable w-full bg-primary-500 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-600 transition-all hover:shadow-lg hover:shadow-primary-200"
              >
                {t('ac.forgot.continue')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
