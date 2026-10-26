'use client'

import { Suspense, useState, FormEvent, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Lock, Mail, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SuccessCheck } from '@/components/ui/SuccessCheck'
import { AuthFrame, AuthField, PasswordField, Notice } from '@/components/auth/AuthUI'
import { hapticError, hapticSuccess } from '@/lib/feedback'
import { auth } from '@/lib/api'
import { track } from '@/lib/track'
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
    if (password !== confirm) { void hapticError(); setError(t('ac.err.passMismatch')); return }
    if (password.length < 6) { void hapticError(); setError(t('ac.err.passMin6')); return }
    setLoading(true)
    try {
      await auth.resetPassword(email.trim().toLowerCase(), code.trim(), password)
      track('password_reset_done')
      void hapticSuccess()
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 2200)
    } catch (err: unknown) {
      void hapticError()
      setError(err instanceof Error ? err.message : t('ac.reset.err'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthFrame title={t('ac.reset.successTitle')} subtitle={t('ac.reset.successBody')}>
        <div className="flex justify-center py-4" role="status">
          <SuccessCheck size={72} label={t('ac.reset.successTitle')} />
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame title={t('ac.reset.title')} subtitle={t('ac.reset.subtitle')}>
      <Link
        href="/auth/forgot"
        className="inline-flex items-center gap-1 min-h-[44px] -ml-1 -mt-2 mb-3 pr-2 rounded-xl text-sm font-semibold text-primary-700 dark:text-primary-300"
      >
        <ChevronLeft className="w-5 h-5" aria-hidden />
        {t('nav.back')}
      </Link>

      {error && <Notice tone="danger" className="mb-5">{error}</Notice>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="reset-email"
          label={t('ac.field.email')}
          icon={Mail}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="username"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={t('ac.field.emailPlaceholder')}
        />
        <AuthField
          id="reset-code"
          label={t('ac.reset.codeLabel')}
          icon={KeyRound}
          type="text"
          required
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="!text-lg font-mono tracking-widest"
        />
        <PasswordField
          id="reset-password"
          label={t('ac.field.newPassword')}
          icon={Lock}
          autoComplete="new-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          hint={t('ac.register.passHint')}
          show={showPass}
          onToggle={() => setShowPass(v => !v)}
        />
        <PasswordField
          id="reset-confirm"
          label={t('ac.field.confirmNewPassword')}
          icon={Lock}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••"
          show={showPass}
          onToggle={() => setShowPass(v => !v)}
        />
        <Button type="submit" size="lg" fullWidth loading={loading} disabled={code.length !== 6} className="!mt-5">
          {loading ? t('ac.reset.submitting') : t('ac.reset.title')}
        </Button>
      </form>
    </AuthFrame>
  )
}

export default function ResetPasswordPage() {
  const t = useT()
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 text-surface-500 dark:text-surface-400 text-sm">{t('common.loading')}</div>}>
      <ResetPasswordInner />
    </Suspense>
  )
}
