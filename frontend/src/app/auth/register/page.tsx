'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, PawPrint, Mail, Lock, User, AlertCircle, Gift } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import { auth } from '@/lib/api'
import { AppleSignInButton } from '@/components/auth/AppleSignInButton'
import { consumePetDraft, loadPetDraft } from '@/lib/petDraft'

export default function RegisterPage() {
  const router = useRouter()
  const { loginWithSession } = useAuth()
  const t = useT()

  // Só 3 campos: telefone vai pro perfil depois; confirmar senha virou o
  // botão de mostrar/ocultar (cada campo a mais derruba a conversão).
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [petName, setPetName] = useState('')
  const [referralCode, setReferralCode] = useState('')
  useEffect(() => { setPetName(loadPetDraft()?.name ?? '') }, [])
  const goNext = () => { void consumePetDraft().then(r => router.push(r)) }

  // Convite de indicação via link (?ref=PET-XXXXXX) — recompensa dupla
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref) setReferralCode(ref.toUpperCase())
    } catch {}
  }, [])
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) {
      setError(t('ac.err.passMin6'))
      return
    }
    setLoading(true)
    try {
      const res = await auth.register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        referral_code: referralCode || undefined,
      })
      // Usa diretamente o token + user do response do register (sem segundo login)
      loginWithSession(res.access_token, res.user)
      goNext()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('ac.register.errGeneric')
      // Mensagens mais amigáveis para erros comuns
      if (msg.toLowerCase().includes('já cadastrado') || msg.toLowerCase().includes('already')) {
        setError(t('ac.register.errEmailTaken'))
      } else if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) {
        setError(t('ac.register.errNetwork'))
      } else {
        setError(msg)
      }
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
          <h1 className="text-xl font-semibold text-surface-700 dark:text-surface-200 mt-4">{petName ? t('ac.register.titlePet', { name: petName }) : t('ac.register.title')}</h1>
          {referralCode && (
            <div className="mt-3 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-2 text-sm font-medium animate-slide-up">
              <Gift className="w-4 h-4 shrink-0" />
              {t('ac.register.referralApplied')}
            </div>
          )}
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">{t('ac.register.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 p-6 sm:p-8">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-6 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <AppleSignInButton onSuccess={goNext} referralCode={referralCode} />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.field.name')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={set('name')}
                  placeholder={t('ac.field.namePlaceholder')}
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.field.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  value={form.email}
                  onChange={set('email')}
                  placeholder={t('ac.field.emailPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>


            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.field.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={set('password')}
                  minLength={6}
                  placeholder={t('ac.register.passHint')}
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



            <button
              type="submit"
              disabled={loading}
              className="pressable w-full bg-primary-500 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-primary-200 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <PawPrint className="w-5 h-5" />
              )}
              {loading ? t('ac.register.submitting') : t('ac.register.submit')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('ac.register.hasAccount')}{' '}
              <Link href="/auth/login" className="text-primary-600 font-semibold hover:underline">
                {t('ac.register.signin')}
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">
          {t('ac.register.terms')}
        </p>
      </div>
    </div>
  )
}
