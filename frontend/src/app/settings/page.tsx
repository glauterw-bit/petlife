'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { useLocale, useT } from '@/contexts/LocaleContext'
import { LOCALES, LOCALE_FLAG, LOCALE_LABEL } from '@/lib/i18n/types'

import { useState, FormEvent } from 'react'
import { User, Mail, Phone, Lock, Save, Eye, EyeOff, AlertTriangle, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/api'
import { setUser } from '@/lib/auth'
import { useToast } from '@/components/ui/ToastContext'

/** Frase de confirmação exigida pelo backend — não traduzir. */
const DELETE_CONFIRM_PHRASE = 'APAGAR MINHA CONTA'

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const { success, error } = useToast()
  const t = useT()

  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
  })
  const [passForm, setPassForm] = useState({ current: '', password: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPass, setSavingPass] = useState(false)

  const setP = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfileForm(f => ({ ...f, [field]: e.target.value }))
  const setPw = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPassForm(f => ({ ...f, [field]: e.target.value }))

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const updated = await auth.updateProfile({ name: profileForm.name, phone: profileForm.phone })
      setUser(updated)
      await refreshUser()
      success(t('ac.set.profileSaved'))
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : t('ac.set.profileErr'))
    } finally { setSavingProfile(false) }
  }

  async function handlePassSubmit(e: FormEvent) {
    e.preventDefault()
    if (!passForm.current) { error(t('ac.set.currentPassRequired')); return }
    if (passForm.password !== passForm.confirm) { error(t('ac.err.passMismatch')); return }
    if (passForm.password.length < 6) { error(t('ac.err.passMin6')); return }
    setSavingPass(true)
    try {
      await auth.changePassword(passForm.current, passForm.password)
      success(t('ac.set.passChanged'))
      setPassForm({ current: '', password: '', confirm: '' })
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : t('ac.set.passErr'))
    } finally { setSavingPass(false) }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-5 md:mb-6 ">
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight">{t('ac.set.title')}</h1>
          <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">{t('ac.set.subtitle')}</p>
        </div>

        {/* Profile */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-surface-900 dark:text-white">{t('ac.set.personal')}</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400">{t('ac.set.personalDesc')}</p>
            </div>
          </div>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.field.name')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={setP('name')}
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.field.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm bg-surface-50 dark:bg-surface-900/60 text-surface-500 dark:text-surface-400 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-surface-400 mt-1">{t('ac.set.emailLocked')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.field.phone')}</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={setP('phone')}
                  placeholder={t('ac.field.phonePlaceholder')}
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center gap-2 bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-60 transition"
            >
              {savingProfile ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {savingProfile ? t('ac.set.saving') : t('ac.set.saveProfile')}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-accent-600" />
            </div>
            <div>
              <h2 className="font-semibold text-surface-900 dark:text-white">{t('ac.set.changePassword')}</h2>
              <p className="text-sm text-surface-500 dark:text-surface-400">{t('ac.set.changePasswordDesc')}</p>
            </div>
          </div>
          <form onSubmit={handlePassSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.field.newPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={passForm.password}
                  onChange={setPw('password')}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} aria-label={showPass ? t('ac.pass.hide') : t('ac.pass.show')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                  value={passForm.confirm}
                  onChange={setPw('confirm')}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingPass}
              className="flex items-center gap-2 bg-accent-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent-600 disabled:opacity-60 transition"
            >
              {savingPass ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-4 h-4" />}
              {savingPass ? t('ac.set.saving') : t('ac.set.changePassword')}
            </button>
          </form>
        </div>

        <LanguageSection />
        <ThemeSection />

        <DangerZone />
      </div>
    </DashboardLayout>
  )
}

function DangerZone() {
  const { logout } = useAuth()
  const { success, error } = useToast()
  const router = useRouter()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (confirmation !== DELETE_CONFIRM_PHRASE) {
      error(t('ac.set.confirmErr', { phrase: DELETE_CONFIRM_PHRASE }))
      return
    }
    if (!password) {
      error(t('ac.set.passRequired'))
      return
    }
    setDeleting(true)
    try {
      await auth.deleteAccount(password, confirmation)
      success(t('ac.set.deleted'))
      logout()
      router.push('/')
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('ac.set.deleteErr'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border-2 border-red-200 dark:border-red-900/50 p-6">
      <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-1 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        {t('ac.set.dangerTitle')}
      </h2>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
        {t('ac.set.dangerDesc')}
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 text-red-700 dark:text-red-300 px-4 py-2.5 rounded-xl text-sm font-semibold transition border border-red-200 dark:border-red-700/50"
        >
          <Trash2 className="w-4 h-4" />
          {t('ac.set.deleteBtn')}
        </button>
      ) : (
        <div className="space-y-3 bg-red-50/50 dark:bg-red-900/10 rounded-xl p-4 border border-red-200 dark:border-red-700/30">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
              {t('ac.set.currentPassLabel')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
              {t('ac.set.confirmTypeLabel')} <code className="bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded text-xs">{DELETE_CONFIRM_PHRASE}</code>
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              placeholder={DELETE_CONFIRM_PHRASE}
              className="w-full px-3 py-2.5 border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); setPassword(''); setConfirmation('') }}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || confirmation !== DELETE_CONFIRM_PHRASE || !password}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition"
            >
              {deleting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? t('ac.set.deleting') : t('ac.set.deletePermanently')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LanguageSection() {
  const { locale, setLocale, t } = useLocale()
  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6">
      <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-1">{t('settings.language')}</h2>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">{t('settings.languageDesc')}</p>
      <div className="grid grid-cols-3 gap-2">
        {LOCALES.map(l => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            aria-pressed={locale === l}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition ${
              locale === l
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-surface-300 dark:hover:border-surface-600'
            }`}
          >
            <span className="text-2xl">{LOCALE_FLAG[l]}</span>
            <span className="text-xs font-medium">{LOCALE_LABEL[l]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ThemeSection() {
  const { theme, setTheme } = useTheme()
  const t = useT()
  const opts: Array<{ value: 'light' | 'dark'; label: string; icon: string }> = [
    { value: 'light', label: t('ac.set.themeLight'), icon: '☀️' },
    { value: 'dark', label: t('ac.set.themeDark'), icon: '🌙' },
  ]
  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6">
      <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-1">{t('ac.set.appearance')}</h2>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">{t('ac.set.appearanceDesc')}</p>
      <div className="grid grid-cols-2 gap-2">
        {opts.map(o => (
          <button
            key={o.value}
            onClick={() => setTheme(o.value)}
            aria-pressed={theme === o.value}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition ${
              theme === o.value
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-surface-300 dark:hover:border-surface-600'
            }`}
          >
            <span className="text-2xl">{o.icon}</span>
            <span className="text-xs font-medium">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
