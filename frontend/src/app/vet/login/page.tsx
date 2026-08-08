'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PawPrint, Mail, Lock, AlertCircle, Eye, EyeOff, Stethoscope } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function VetLoginPage() {
  const router = useRouter()
  const { vetLogin } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await vetLogin(email, password)
      router.push('/vet/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciais inválidas.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/vet" className="inline-flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
              <PawPrint className="w-9 h-9 text-white" />
            </div>
            <span className="text-2xl font-bold text-surface-900 dark:text-white">PetLife Veterinário</span>
          </Link>
          <h1 className="text-xl font-semibold text-surface-700 dark:text-surface-200 mt-4">Portal de Clínicas</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">Acesse o painel veterinário</p>
        </div>

        {/* Vet badge */}
        <div className="flex items-center justify-center gap-2 bg-primary-50 border border-primary-200 rounded-2xl px-5 py-3 mb-6">
          <Stethoscope className="w-5 h-5 text-primary-600" />
          <span className="text-sm font-medium text-primary-700">Acesso exclusivo para veterinários cadastrados</span>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 p-8">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-6 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">E-mail da clínica</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="clinica@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-60 transition flex items-center justify-center gap-2"
            >
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Stethoscope className="w-5 h-5" />}
              {loading ? 'Entrando...' : 'Entrar no Portal'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Não tem cadastro?{' '}
              <Link href="/vet/register" className="text-primary-600 font-semibold hover:underline">
                Cadastrar clínica
              </Link>
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              É tutor?{' '}
              <Link href="/auth/login" className="text-accent-600 font-semibold hover:underline">
                Login de tutores
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
