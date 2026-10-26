'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Mail, Copy, Check, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AuthFrame, AuthField, Notice, TextLink } from '@/components/auth/AuthUI'
import { hapticError, hapticSuccess } from '@/lib/feedback'
import { auth } from '@/lib/api'
import { track } from '@/lib/track'
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
      track('forgot_requested')
      void hapticSuccess()
      setResult({ message: res.message, code: res.code, emailConfigured: res.email_configured !== false })
    } catch (err: unknown) {
      void hapticError()
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
    <AuthFrame title={t('ac.forgot.title')} subtitle={t('ac.forgot.subtitle')}>
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-1 min-h-[44px] -ml-1 -mt-2 mb-3 pr-2 rounded-xl text-sm font-semibold text-primary-700 dark:text-primary-300"
      >
        <ChevronLeft className="w-5 h-5" aria-hidden />
        {t('ac.forgot.backToLogin')}
      </Link>

      {error && <Notice tone="danger" className="mb-5">{error}</Notice>}

      {!result ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField
            id="forgot-email"
            label={t('ac.forgot.emailLabel')}
            icon={Mail}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="username"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('ac.field.emailPlaceholder')}
            autoFocus
          />
          <Button type="submit" size="lg" fullWidth loading={loading}>
            {loading ? t('ac.forgot.submitting') : t('ac.forgot.submit')}
          </Button>
          <p className="text-sm text-surface-600 dark:text-surface-400 text-center leading-snug">
            {t('ac.forgot.appleHint')}{' '}
            <TextLink href="/auth/login">{t('ac.forgot.appleHintLink')}</TextLink>
          </p>
        </form>
      ) : (
        <div className="space-y-4">
          <Notice tone={result.emailConfigured ? 'success' : 'warning'}>{result.message}</Notice>

          {!result.emailConfigured && (
            <div className="rounded-xl bg-surface-50 dark:bg-surface-800/70 p-4 text-sm text-surface-700 dark:text-surface-300 flex gap-3">
              <MessageCircle className="w-5 h-5 text-primary-700 dark:text-primary-300 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="font-semibold text-surface-900 dark:text-surface-100 mb-1">{t('ac.forgot.nextTitle')}</p>
                <p>{t('ac.forgot.nextBody1')}<b>WhatsApp</b>{t('ac.forgot.nextBody2')}</p>
              </div>
            </div>
          )}

          {result.code && (
            <div className="tone-warning-bg border rounded-xl p-4">
              <p className="text-xs uppercase font-semibold tracking-wide text-amber-900 dark:text-amber-200 mb-2">
                {t('ac.forgot.devMode')}
              </p>
              <div className="flex items-center justify-between gap-3 bg-white dark:bg-surface-950 rounded-lg border border-amber-200 dark:border-amber-500/25 pl-4 pr-1 py-1">
                <span className="text-2xl font-mono font-bold text-surface-900 dark:text-white tracking-widest">
                  {result.code}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-sm font-semibold text-amber-900 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-500/10"
                >
                  {copied ? <><Check className="w-4 h-4" aria-hidden /> {t('ac.forgot.copied')}</> : <><Copy className="w-4 h-4" aria-hidden /> {t('ac.forgot.copy')}</>}
                </button>
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-200 mt-2">{t('ac.forgot.devNote')}</p>
            </div>
          )}

          <Button size="lg" fullWidth onClick={goReset}>
            {t('ac.forgot.continue')}
          </Button>
        </div>
      )}
    </AuthFrame>
  )
}
