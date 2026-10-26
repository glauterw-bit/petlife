'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, Lock, User, Gift, Ticket, X, PawPrint, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import { auth } from '@/lib/api'
import { AppleSignInButton } from '@/components/auth/AppleSignInButton'
import { consumePetDraft, loadPetDraft } from '@/lib/petDraft'
import { hapticError, hapticSuccess, hapticLight } from '@/lib/feedback'
import { Button } from '@/components/ui/Button'
import { AuthFrame, AuthField, PasswordField, Notice, TextLink, fieldClasses } from '@/components/auth/AuthUI'
import { spring, dur, easeOut } from '@/lib/motion'

export default function RegisterPage() {
  const router = useRouter()
  const { loginWithSession } = useAuth()
  const t = useT()

  // Só 3 campos: telefone vai pro perfil depois; confirmar senha virou o
  // botão de mostrar/ocultar (cada campo a mais derruba a conversão).
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [petName, setPetName] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [codeOpen, setCodeOpen] = useState(false)
  const [codeDraft, setCodeDraft] = useState('')
  useEffect(() => { setPetName(loadPetDraft()?.name ?? '') }, [])
  const [fromInvite, setFromInvite] = useState(false)
  useEffect(() => { try { setFromInvite(new URLSearchParams(window.location.search).get('convite') === '1') } catch {} }, [])
  const goNext = () => { void consumePetDraft().then(r => router.push(r)) }

  // Convite de indicação via link (?ref=PET-XXXXXX) — recompensa dupla
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref) setReferralCode(ref.toUpperCase())
    } catch {}
  }, [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) {
      void hapticError()
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
      void hapticError()
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


  function applyCode() {
    const v = codeDraft.trim().toUpperCase()
    if (v.length < 4) return
    setReferralCode(v)
    setCodeOpen(false)
    void hapticSuccess()
  }

  function removeCode() {
    void hapticLight()
    setReferralCode('')
    setCodeDraft('')
  }

  return (
    <AuthFrame
      title={petName ? t('ac.register.titlePet', { name: petName }) : t('ac.register.title')}
      subtitle={t('ac.register.subtitle')}
      top={
        fromInvite ? (
          <div className="mt-4">
            <Notice tone="info" icon={Users} className="text-left">{t('ac.register.inviteBanner')}</Notice>
          </div>
        ) : null
      }
      footer={
        <p className="text-center text-xs text-surface-500 dark:text-surface-400 mt-5 px-4 leading-relaxed">
          {t('acct.reg.termsPrefix')}{' '}
          <a href="/privacy" className="inline-block py-3 font-semibold underline underline-offset-2 text-surface-600 dark:text-surface-300">
            {t('acct.reg.termsLink')}
          </a>
        </p>
      }
    >
      {error && <Notice tone="danger" className="mb-5">{error}</Notice>}

      <AppleSignInButton onSuccess={goNext} referralCode={referralCode} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="reg-name"
          label={t('ac.field.name')}
          icon={User}
          type="text"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          required
          value={form.name}
          onChange={set('name')}
          placeholder={t('ac.field.namePlaceholder')}
        />
        <AuthField
          id="reg-email"
          label={t('ac.field.email')}
          icon={Mail}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          required
          value={form.email}
          onChange={set('email')}
          placeholder={t('ac.field.emailPlaceholder')}
        />
        <PasswordField
          id="reg-password"
          label={t('ac.field.password')}
          icon={Lock}
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={form.password}
          onChange={set('password')}
          placeholder="••••••••"
          hint={t('ac.register.passHint')}
        />

        <Button type="submit" size="lg" fullWidth loading={loading} leftIcon={PawPrint} className="!mt-5">
          {loading ? t('ac.register.submitting') : t('ac.register.submit')}
        </Button>
      </form>

      {/* Código de convite: abaixo do botão principal, sem competir com ele */}
      <div className="mt-3">
        <AnimatePresence initial={false} mode="wait">
          {referralCode ? (
            <motion.div
              key="applied"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={spring.pop}
            >
              <Notice tone="success" icon={Gift}>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="font-semibold">{t('acct.reg.codeApplied', { code: referralCode })}</p>
                    <p className="mt-0.5">{t('acct.reg.codeRule')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeCode}
                    aria-label={t('acct.reg.codeRemove')}
                    className="-mr-2 -mt-2 w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-xl text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-500/15"
                  >
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              </Notice>
            </motion.div>
          ) : codeOpen ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: dur.base, ease: easeOut }}
              className="overflow-hidden"
            >
              <label htmlFor="reg-code" className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-1.5 pt-1">
                {t('acct.reg.codeLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  id="reg-code"
                  autoFocus
                  value={codeDraft}
                  onChange={e => setCodeDraft(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCode() } }}
                  placeholder="PET-XXXXXX"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={20}
                  className={`${fieldClasses} px-4 tracking-wider font-mono uppercase`}
                />
                <Button variant="soft" onClick={applyCode} disabled={codeDraft.trim().length < 4}>
                  {t('acct.reg.codeApply')}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="link"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { void hapticLight(); setCodeOpen(true) }}
              className="w-full inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/10"
            >
              <Ticket className="w-4 h-4" aria-hidden />
              {t('ac.register.haveCode')}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 pt-3 border-t border-surface-200/70 dark:border-surface-800 text-center text-sm text-surface-600 dark:text-surface-400">
        {t('ac.register.hasAccount')}{' '}
        <TextLink href="/auth/login">{t('ac.register.signin')}</TextLink>
      </div>
    </AuthFrame>
  )
}
