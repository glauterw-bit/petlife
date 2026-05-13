'use client'

import { useTheme } from '@/contexts/ThemeContext'

import { useState, FormEvent } from 'react'
import { User, Mail, Phone, Lock, Save, Eye, EyeOff } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/api'
import { setUser } from '@/lib/auth'
import { useToast } from '@/components/ui/ToastContext'

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const { success, error } = useToast()

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
      success('Perfil atualizado com sucesso!')
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Erro ao atualizar perfil.')
    } finally { setSavingProfile(false) }
  }

  async function handlePassSubmit(e: FormEvent) {
    e.preventDefault()
    if (passForm.password !== passForm.confirm) { error('As senhas não coincidem.'); return }
    if (passForm.password.length < 6) { error('A senha deve ter pelo menos 6 caracteres.'); return }
    setSavingPass(true)
    try {
      await auth.updateProfile({ password: passForm.password } as Parameters<typeof auth.updateProfile>[0])
      success('Senha alterada com sucesso!')
      setPassForm({ current: '', password: '', confirm: '' })
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Erro ao alterar senha.')
    } finally { setSavingPass(false) }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-surface-900">Configurações</h1>
          <p className="text-surface-500 mt-1">Gerencie as informações da sua conta</p>
        </div>

        {/* Profile */}
        <div className="bg-white rounded-2xl border border-surface-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-surface-900">Informações Pessoais</h2>
              <p className="text-sm text-surface-500">Atualize seus dados de perfil</p>
            </div>
          </div>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Nome completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={setP('name')}
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 rounded-xl text-sm bg-surface-50 text-surface-500 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-surface-400 mt-1">O e-mail não pode ser alterado.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={setP('phone')}
                  placeholder="(11) 99999-9999"
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center gap-2 bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-60 transition"
            >
              {savingProfile ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="bg-white rounded-2xl border border-surface-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-accent-600" />
            </div>
            <div>
              <h2 className="font-semibold text-surface-900">Alterar Senha</h2>
              <p className="text-sm text-surface-500">Mantenha sua conta segura</p>
            </div>
          </div>
          <form onSubmit={handlePassSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={passForm.password}
                  onChange={setPw('password')}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Confirmar nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={passForm.confirm}
                  onChange={setPw('confirm')}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingPass}
              className="flex items-center gap-2 bg-accent-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent-600 disabled:opacity-60 transition"
            >
              {savingPass ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-4 h-4" />}
              {savingPass ? 'Salvando...' : 'Alterar Senha'}
            </button>
          </form>
        </div>

        <ThemeSection />
      </div>
    </DashboardLayout>
  )
}

function ThemeSection() {
  const { theme, setTheme } = useTheme()
  const opts: Array<{ value: 'light' | 'dark' | 'system'; label: string; icon: string }> = [
    { value: 'light', label: 'Claro', icon: '☀️' },
    { value: 'dark', label: 'Escuro', icon: '🌙' },
    { value: 'system', label: 'Sistema', icon: '🖥️' },
  ]
  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6">
      <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-1">Aparência</h2>
      <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">Escolha como o PetLife aparece pra você.</p>
      <div className="grid grid-cols-3 gap-2">
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
