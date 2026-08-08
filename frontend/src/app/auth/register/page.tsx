'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, PawPrint, Mail, Lock, User, Phone, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { auth } from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const { loginWithSession } = useAuth()

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('As senhas não coincidem.')
      return
    }
    if (form.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setLoading(true)
    try {
      const res = await auth.register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      })
      // Usa diretamente o token + user do response do register (sem segundo login)
      loginWithSession(res.access_token, res.user)
      router.push('/pets/new')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar.'
      // Mensagens mais amigáveis para erros comuns
      if (msg.toLowerCase().includes('já cadastrado') || msg.toLowerCase().includes('already')) {
        setError('Este e-mail já está cadastrado. Tente fazer login.')
      } else if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) {
        setError('Sem conexão com o servidor. Verifique sua internet e tente novamente.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const checks = [
    { label: 'Pelo menos 6 caracteres', ok: form.password.length >= 6 },
    { label: 'Senhas coincidem', ok: form.password.length > 0 && form.password === form.confirm },
  ]

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
          <h1 className="text-xl font-semibold text-surface-700 dark:text-surface-200 mt-4">Crie sua conta gratuita</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">E comece a cuidar do seu pet com IA</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 p-6 sm:p-8">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-6 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">Nome completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Seu nome"
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={set('email')}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">
                Telefone <span className="text-surface-400 font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="(11) 99999-9999"
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={set('password')}
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

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.confirm}
                  onChange={set('confirm')}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password checks */}
            {form.password && (
              <div className="space-y-1">
                {checks.map(c => (
                  <div key={c.label} className="flex items-center gap-2 text-xs">
                    <CheckCircle className={`w-3.5 h-3.5 ${c.ok ? 'text-green-500' : 'text-surface-300'}`} />
                    <span className={c.ok ? 'text-green-600' : 'text-surface-400'}>{c.label}</span>
                  </div>
                ))}
              </div>
            )}

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
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Já tem conta?{' '}
              <Link href="/auth/login" className="text-primary-600 font-semibold hover:underline">
                Entrar
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">
          Ao se cadastrar, você concorda com nossos Termos de Uso.
        </p>
      </div>
    </div>
  )
}
