'use client'

import { useState, useEffect, useCallback, FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  User, Mail, Phone, Lock, KeyRound, Building2, ChevronRight, Check, Sun, Moon, BellRing,
  LifeBuoy, Star, LogOut, Trash2, Languages, Save, Settings as SettingsIcon,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useLocale, useT } from '@/contexts/LocaleContext'
import { LOCALES, LOCALE_LABEL } from '@/lib/i18n/types'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/api'
import { setUser } from '@/lib/auth'
import { useToast } from '@/components/ui/ToastContext'
import { openReviewPage } from '@/lib/review'
import { track } from '@/lib/track'
import { cn } from '@/lib/utils'
import { hapticSuccess, hapticError, hapticLight, hapticSelect } from '@/lib/feedback'
import { getPushPermission, requestPushPermission } from '@/lib/push'
import { PageHeader } from '@/components/ui/PageHeader'
import { openAppSettings } from '@/components/ui/PushPrimer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useConfirm } from '@/components/ui/Confirm'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import { AuthField, PasswordField } from '@/components/auth/AuthUI'

/** Frase de confirmação exigida pelo backend — não traduzir. */
const DELETE_CONFIRM_PHRASE = 'APAGAR MINHA CONTA'

/* ─────────────── peças da lista agrupada (estilo iOS) ─────────────── */

function Group({ title, children, footer, id }: { title: string; children: ReactNode; footer?: ReactNode; id?: string }) {
  return (
    <StaggerItem as="div" className="mb-6">
      <section aria-labelledby={id}>
        <h2 id={id} className="px-1 mb-2 text-[13px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
          {title}
        </h2>
        <Card padding="none" className="overflow-hidden divide-y divide-surface-200/70 dark:divide-surface-800">
          {children}
        </Card>
        {footer && <div className="px-1 mt-2 text-[13px] leading-snug text-surface-600 dark:text-surface-300">{footer}</div>}
      </section>
    </StaggerItem>
  )
}

type RowProps = {
  icon: LucideIcon
  label: string
  sub?: string
  value?: ReactNode
  href?: string
  onClick?: () => void
  tone?: 'default' | 'danger'
  chevron?: boolean
  trailing?: ReactNode
  ariaPressed?: boolean
}

function Row({ icon: Icon, label, sub, value, href, onClick, tone = 'default', chevron, trailing, ariaPressed }: RowProps) {
  const danger = tone === 'danger'
  const showChevron = chevron ?? !!(href || onClick)
  const inner = (
    <>
      <span
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          danger
            ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300'
            : 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
        )}
      >
        <Icon className="w-[18px] h-[18px]" aria-hidden />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className={cn('block text-[15px] font-medium truncate', danger ? 'text-red-700 dark:text-red-300' : 'text-surface-900 dark:text-surface-100')}>
          {label}
        </span>
        {sub && <span className="block text-[13px] text-surface-500 dark:text-surface-400 truncate">{sub}</span>}
      </span>
      {value != null && <span className="text-[15px] text-surface-500 dark:text-surface-400 shrink-0">{value}</span>}
      {trailing}
      {showChevron && <ChevronRight className="w-5 h-5 text-surface-300 dark:text-surface-600 shrink-0" aria-hidden />}
    </>
  )
  const cls =
    'flex items-center gap-3 w-full min-h-[52px] px-4 py-2 transition-colors hover:bg-surface-50 active:bg-surface-100 dark:hover:bg-surface-800/60 dark:active:bg-surface-800 focus-visible:outline-none focus-visible:bg-surface-100 dark:focus-visible:bg-surface-800'
  if (href) {
    return (
      <Link href={href} className={cls} onClick={() => void hapticLight()}>
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={ariaPressed}>
        {inner}
      </button>
    )
  }
  return <div className={cn(cls, 'hover:bg-transparent active:bg-transparent dark:hover:bg-transparent dark:active:bg-transparent')}>{inner}</div>
}

/* ─────────────────────────────── página ─────────────────────────────── */

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth()
  const router = useRouter()
  const confirm = useConfirm()
  const t = useT()
  // conta criada pela Apple ainda não tem senha: cria a primeira sem pedir a atual
  const hasPassword = user?.has_password !== false
  // o usuário guardado no aparelho pode ser anterior a esse campo — busca o atual
  useEffect(() => { void refreshUser() }, [refreshUser])

  const [sheet, setSheet] = useState<null | 'profile' | 'password' | 'delete'>(null)
  const close = useCallback(() => setSheet(null), [])

  async function handleLogout() {
    const ok = await confirm({
      title: t('acct.set.logoutTitle'),
      message: t('acct.set.logoutMsg'),
      confirmLabel: t('acct.set.logout'),
      tone: 'danger',
    })
    if (!ok) return
    logout()
    router.push('/')
  }

  async function handleDelete() {
    const ok = await confirm({
      title: t('acct.set.deleteTitle'),
      message: t('ac.set.dangerDesc'),
      confirmLabel: t('acct.set.deleteContinue'),
      tone: 'danger',
    })
    if (ok) setSheet('delete')
  }

  const initial = (user?.name ?? user?.email ?? '?').trim().charAt(0).toUpperCase()

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <PageHeader title={t('ac.set.title')} subtitle={t('ac.set.subtitle')} />

        <Stagger gap={0.04}>
          {/* Cartão do perfil */}
          <StaggerItem className="mb-6">
            <Card interactive padding="md" as="div" className="flex items-center gap-4" onClick={() => { void hapticLight(); setSheet('profile') }} role="button" tabIndex={0} aria-label={t('acct.set.profileRow')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSheet('profile') } }}>
              <span className="w-14 h-14 rounded-full bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-200 flex items-center justify-center text-xl font-display font-extrabold shrink-0" aria-hidden>
                {initial}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[17px] font-semibold text-surface-900 dark:text-white truncate">{user?.name || '—'}</span>
                <span className="block text-sm text-surface-500 dark:text-surface-400 truncate">{user?.email}</span>
              </span>
              <ChevronRight className="w-5 h-5 text-surface-300 dark:text-surface-600 shrink-0" aria-hidden />
            </Card>
          </StaggerItem>

          <Group title={t('acct.set.groupAccount')} id="set-account">
            <Row icon={User} label={t('acct.set.profileRow')} sub={user?.phone || t('acct.set.noPhone')} onClick={() => { void hapticLight(); setSheet('profile') }} />
            <Row
              icon={KeyRound}
              label={hasPassword ? t('acct.set.passwordRow') : t('ac.set.createPassword')}
              sub={hasPassword ? t('ac.set.changePasswordDesc') : undefined}
              onClick={() => { void hapticLight(); setSheet('password') }}
            />
            <Row icon={Building2} label={t('ac.clinicAccess.title')} sub={t('ac.clinicAccess.sub')} href="/clinicas-com-acesso" />
          </Group>

          <NotificationsGroup />

          <ThemeGroup />

          <LanguageGroup />

          <Group title={t('acct.set.groupHelp')} id="set-help">
            <Row icon={LifeBuoy} label={t('acct.set.support')} href="/suporte" />
            <Row
              icon={Star}
              label={t('acct.set.rate')}
              sub={t('ac.set.rateDesc')}
              onClick={() => { void hapticLight(); track('rate_settings_cta'); openReviewPage() }}
            />
          </Group>

          <Group title={t('acct.set.groupDanger')} id="set-danger" footer={t('ac.set.petHint')}>
            <Row icon={LogOut} label={t('acct.set.logout')} onClick={handleLogout} chevron={false} />
            <Row icon={Trash2} label={t('acct.set.deleteRow')} onClick={handleDelete} tone="danger" chevron={false} />
          </Group>
        </Stagger>
      </div>

      <ProfileSheet open={sheet === 'profile'} onClose={close} />
      <PasswordSheet open={sheet === 'password'} onClose={close} hasPassword={hasPassword} />
      <DeleteSheet open={sheet === 'delete'} onClose={close} />
    </DashboardLayout>
  )
}

/* ─────────────────────────────── perfil ─────────────────────────────── */

function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, refreshUser } = useAuth()
  const { success, error } = useToast()
  const t = useT()
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' })
  const [saving, setSaving] = useState(false)

  // O usuário chega depois do primeiro render (e muda após refreshUser): sem
  // isto o campo de nome aparecia vazio e salvar apagava o nome.
  useEffect(() => {
    setForm({ name: user?.name ?? '', phone: user?.phone ?? '' })
  }, [user?.id, user?.name, user?.phone])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await auth.updateProfile({ name: form.name.trim(), phone: form.phone.trim() })
      setUser(updated)
      await refreshUser()
      void hapticSuccess()
      success(t('ac.set.profileSaved'))
      onClose()
    } catch (err: unknown) {
      void hapticError()
      error(err instanceof Error ? err.message : t('ac.set.profileErr'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('ac.set.personal')}
      description={t('ac.set.personalDesc')}
      footer={
        <Button type="submit" form="profile-form" size="lg" fullWidth loading={saving} leftIcon={Save}>
          {saving ? t('ac.set.saving') : t('common.save')}
        </Button>
      }
    >
      <form id="profile-form" onSubmit={submit} className="space-y-4">
        <AuthField
          id="set-name"
          label={t('ac.field.name')}
          icon={User}
          type="text"
          autoComplete="name"
          required
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
        <AuthField
          id="set-email"
          label={t('ac.field.email')}
          icon={Mail}
          type="email"
          value={user?.email ?? ''}
          disabled
          hint={t('ac.set.emailLocked')}
          className="!bg-surface-50 dark:!bg-surface-900 text-surface-500 dark:text-surface-400 cursor-not-allowed"
        />
        <AuthField
          id="set-phone"
          label={t('ac.field.phone')}
          icon={Phone}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder={t('ac.field.phonePlaceholder')}
        />
      </form>
    </Sheet>
  )
}

/* ─────────────────────────────── senha ─────────────────────────────── */

function PasswordSheet({ open, onClose, hasPassword }: { open: boolean; onClose: () => void; hasPassword: boolean }) {
  const { user, refreshUser } = useAuth()
  const { success, error } = useToast()
  const t = useT()
  const [form, setForm] = useState({ current: '', password: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) { setForm({ current: '', password: '', confirm: '' }); setShow(false) }
  }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const fail = (msg: string) => { void hapticError(); error(msg) }
    if (hasPassword && !form.current) return fail(t('ac.set.currentPassRequired'))
    if (form.password !== form.confirm) return fail(t('ac.err.passMismatch'))
    if (form.password.length < 6) return fail(t('ac.err.passMin6'))
    setSaving(true)
    try {
      await auth.changePassword(form.current, form.password)
      void hapticSuccess()
      success(t('ac.set.passChanged'))
      void refreshUser()
      onClose()
    } catch (err: unknown) {
      fail(err instanceof Error ? err.message : t('ac.set.passErr'))
    } finally {
      setSaving(false)
    }
  }

  const toggle = () => setShow(v => !v)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={hasPassword ? t('acct.set.passwordRow') : t('ac.set.createPassword')}
      description={hasPassword ? t('ac.set.changePasswordDesc') : t('ac.set.createPasswordDesc', { email: user?.email ?? '' })}
      footer={
        <Button type="submit" form="password-form" size="lg" fullWidth loading={saving} leftIcon={Lock}>
          {saving ? t('ac.set.saving') : hasPassword ? t('acct.set.passwordRow') : t('ac.set.createPassword')}
        </Button>
      }
    >
      <form id="password-form" onSubmit={submit} className="space-y-4">
        {/* campo oculto de usuário: o gerenciador de senhas do iOS associa a conta certa */}
        <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        {hasPassword && (
          <PasswordField
            id="set-pass-current"
            label={t('ac.field.currentPassword')}
            icon={Lock}
            autoComplete="current-password"
            value={form.current}
            onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
            show={show}
            onToggle={toggle}
          />
        )}
        <PasswordField
          id="set-pass-new"
          label={t('ac.field.newPassword')}
          icon={Lock}
          autoComplete="new-password"
          required
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          placeholder="••••••••"
          hint={t('ac.register.passHint')}
          show={show}
          onToggle={toggle}
        />
        <PasswordField
          id="set-pass-confirm"
          label={t('ac.field.confirmNewPassword')}
          icon={Lock}
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
          placeholder="••••••••"
          show={show}
          onToggle={toggle}
        />
      </form>
    </Sheet>
  )
}

/* ──────────────────────────── notificações ──────────────────────────── */

type PushState = 'granted' | 'denied' | 'prompt' | 'unsupported'

function NotificationsGroup() {
  const t = useT()
  const [perm, setPerm] = useState<PushState | null>(null)
  const [asking, setAsking] = useState(false)
  const [native, setNative] = useState(false)
  useEffect(() => {
    const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }
    setNative(!!w.Capacitor?.isNativePlatform?.())
  }, [])

  const refresh = useCallback(() => {
    void getPushPermission().then(setPerm).catch(() => setPerm('unsupported'))
  }, [])

  useEffect(() => {
    refresh()
    // volta dos Ajustes do iPhone: relê o estado
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  async function enable() {
    setAsking(true)
    try {
      const ok = await requestPushPermission()
      if (ok) void hapticSuccess()
      refresh()
    } finally {
      setAsking(false)
    }
  }

  if (perm === null) {
    return (
      <Group title={t('acct.set.groupNotif')} id="set-notif">
        <Row icon={BellRing} label={t('acct.set.pushRow')} value={<span className="inline-block w-16 h-4 rounded bg-surface-200 dark:bg-surface-800" aria-hidden />} />
      </Group>
    )
  }

  // Negado: o iOS não deixa pedir de novo. Mesmo texto e mesmo botão do
  // PushPrimer da fundação ("Abrir Ajustes" no app nativo + caminho por extenso,
  // porque o esquema app-settings: ainda precisa ser confirmado no aparelho).
  const footer =
    perm === 'denied' ? (
      <>
        <span className="block">{t('ui2.push.deniedShort')}</span>
        <span className="block mt-1">{t('ui2.push.settingsPath')}</span>
      </>
    ) : perm === 'unsupported' ? t('acct.set.pushUnsupported') : t('acct.set.pushHint')

  return (
    <Group title={t('acct.set.groupNotif')} id="set-notif" footer={footer}>
      <Row
        icon={BellRing}
        label={t('acct.set.pushRow')}
        value={
          perm === 'granted' ? (
            <span className="chip chip-success"><Check className="w-3.5 h-3.5" aria-hidden />{t('acct.set.pushOn')}</span>
          ) : perm === 'prompt' || (perm === 'denied' && native) ? undefined : (
            <span className="chip chip-neutral">{t('acct.set.pushOff')}</span>
          )
        }
        trailing={
          perm === 'prompt' ? (
            <Button size="sm" variant="soft" loading={asking} onClick={enable}>
              {t('ui.push.enable')}
            </Button>
          ) : perm === 'denied' && native ? (
            <Button size="sm" variant="secondary" leftIcon={SettingsIcon} onClick={openAppSettings} className="min-h-[44px]">
              {t('ui2.push.openSettings')}
            </Button>
          ) : undefined
        }
        chevron={false}
      />
    </Group>
  )
}

/* ───────────────────────────── aparência ───────────────────────────── */

function ThemeGroup() {
  const { theme, setTheme } = useTheme()
  const t = useT()
  return (
    <Group title={t('ac.set.appearance')} id="set-theme" footer={t('ac.set.appearanceDesc')}>
      <div className="p-3">
        {/* Só claro e escuro: decisão de produto registrada no ThemeContext */}
        <SegmentedControl
          ariaLabel={t('ac.set.appearance')}
          value={theme as 'light' | 'dark'}
          onChange={v => setTheme(v)}
          options={[
            { value: 'light', label: t('ac.set.themeLight'), icon: Sun },
            { value: 'dark', label: t('ac.set.themeDark'), icon: Moon },
          ]}
        />
      </div>
    </Group>
  )
}

/* ─────────────────────────────── idioma ─────────────────────────────── */

function LanguageGroup() {
  const { locale, setLocale, t } = useLocale()
  return (
    <Group title={t('settings.language')} id="set-lang" footer={t('settings.languageDesc')}>
      <div role="radiogroup" aria-label={t('settings.language')} className="divide-y divide-surface-200/70 dark:divide-surface-800">
        {LOCALES.map(l => {
          const active = locale === l
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={active}
              lang={l}
              onClick={() => { if (!active) { void hapticSelect(); setLocale(l) } }}
              className="flex items-center gap-3 w-full min-h-[52px] px-4 text-left transition-colors hover:bg-surface-50 active:bg-surface-100 dark:hover:bg-surface-800/60 dark:active:bg-surface-800"
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                <Languages className="w-[18px] h-[18px]" aria-hidden />
              </span>
              <span className="flex-1 text-[15px] font-medium text-surface-900 dark:text-surface-100">{LOCALE_LABEL[l]}</span>
              {active && <Check className="w-5 h-5 text-primary-700 dark:text-primary-300" aria-hidden strokeWidth={2.5} />}
            </button>
          )
        })}
      </div>
    </Group>
  )
}

/* ─────────────────────────── excluir conta ─────────────────────────── */

function DeleteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout, user } = useAuth()
  const { success, error } = useToast()
  const router = useRouter()
  const t = useT()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const needsPassword = user?.has_password !== false
  const passwordOptional = !!user?.has_apple

  useEffect(() => {
    if (!open) { setPassword(''); setConfirmation('') }
  }, [open])

  async function handleDelete(e?: FormEvent) {
    e?.preventDefault()
    if (confirmation !== DELETE_CONFIRM_PHRASE) {
      void hapticError()
      error(t('ac.set.confirmErr', { phrase: DELETE_CONFIRM_PHRASE }))
      return
    }
    if (!password && needsPassword && !passwordOptional) {
      void hapticError()
      error(t('ac.set.passRequired'))
      return
    }
    setDeleting(true)
    try {
      await auth.deleteAccount(password, confirmation)
      success(t('ac.set.deleted'))
      logout()
      router.push('/')
    } catch (err: unknown) {
      void hapticError()
      error(err instanceof Error ? err.message : t('ac.set.deleteErr'))
    } finally {
      setDeleting(false)
    }
  }

  const canSubmit = confirmation === DELETE_CONFIRM_PHRASE && (!needsPassword || passwordOptional || !!password)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('acct.set.deleteRow')}
      description={t('ac.set.dangerDesc')}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="delete-form"
            variant="danger"
            size="lg"
            className="flex-1"
            loading={deleting}
            disabled={!canSubmit}
            leftIcon={Trash2}
          >
            {deleting ? t('ac.set.deleting') : t('ac.set.deletePermanently')}
          </Button>
        </div>
      }
    >
      <form id="delete-form" onSubmit={handleDelete} className="space-y-4">
        {needsPassword && (
          <PasswordField
            id="del-pass"
            label={passwordOptional ? `${t('ac.set.currentPassLabel')} (${t('ac.set.applePassOptional')})` : t('ac.set.currentPassLabel')}
            icon={Lock}
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        )}
        <div>
          <label htmlFor="del-phrase" className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-1.5">
            {t('ac.set.confirmTypeLabel')}{' '}
            <code className="bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200 px-1.5 py-0.5 rounded text-xs">{DELETE_CONFIRM_PHRASE}</code>
          </label>
          <input
            id="del-phrase"
            type="text"
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
            placeholder={DELETE_CONFIRM_PHRASE}
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-950 text-surface-900 dark:text-white rounded-xl text-[15px] font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </form>
    </Sheet>
  )
}
