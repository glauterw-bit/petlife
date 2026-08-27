'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PawPrint, Building2, Phone, Mail, Lock, MapPin, Stethoscope, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { vet } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'

// O `value` é o que vai pro backend — fica em pt-BR de propósito.
// Só o rótulo exibido é traduzido.
const SPECIALTIES = [
  { value: 'Clínica Geral', labelKey: 'v.vetreg.spec.general' },
  { value: 'Dermatologia', labelKey: 'v.vetreg.spec.dermatology' },
  { value: 'Cardiologia', labelKey: 'v.vetreg.spec.cardiology' },
  { value: 'Ortopedia', labelKey: 'v.vetreg.spec.orthopedics' },
  { value: 'Oncologia', labelKey: 'v.vetreg.spec.oncology' },
  { value: 'Oftalmologia', labelKey: 'v.vetreg.spec.ophthalmology' },
  { value: 'Neurologia', labelKey: 'v.vetreg.spec.neurology' },
  { value: 'Odontologia', labelKey: 'v.vetreg.spec.dentistry' },
  { value: 'Reprodução Animal', labelKey: 'v.vetreg.spec.reproduction' },
  { value: 'Exóticos', labelKey: 'v.vetreg.spec.exotics' },
  { value: 'Outros', labelKey: 'v.vetreg.spec.other' },
]

export default function VetRegisterPage() {
  const router = useRouter()
  const t = useT()
  const { adoptVetSession } = useAuth()

  const [form, setFormState] = useState({
    clinic_name: '',
    cnpj: '',
    phone: '',
    email: '',
    password: '',
    confirm: '',
    address: '',
    specialty: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormState(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError(t('v.vetreg.errMismatch')); return }
    if (form.password.length < 6) { setError(t('v.vetreg.errShort')); return }
    setLoading(true)
    try {
      const res = await vet.registerClinic({
        clinic_name: form.clinic_name,
        cnpj: form.cnpj,
        phone: form.phone,
        email: form.email,
        password: form.password,
        address: form.address,
        specialty: form.specialty || undefined,
      })
      // Grava localStorage E estado do contexto — só o localStorage não basta:
      // o guard do /vet/dashboard lê o contexto e devolvia a clínica recém
      // cadastrada pra tela de login do tutor.
      adoptVetSession(res.access_token, res.clinic ?? { clinic_name: form.clinic_name }, form.email)
      router.push('/vet/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('v.vetreg.errGeneric'))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/vet" className="inline-flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200">
              <PawPrint className="w-9 h-9 text-white" />
            </div>
            <span className="text-2xl font-bold text-surface-900 dark:text-white">{t('v.vetlogin.brand')}</span>
          </Link>
          <h1 className="text-xl font-semibold text-surface-700 dark:text-surface-200 mt-4">{t('v.vetreg.title')}</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">{t('v.vetreg.subtitle')}</p>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 p-8">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-6 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetreg.clinicName')}</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input required type="text" value={form.clinic_name} onChange={set('clinic_name')} placeholder={t('v.vetreg.clinicNamePh')} className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetreg.cnpj')}</label>
                <input required type="text" value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0001-00" className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetreg.phone')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input required type="tel" value={form.phone} onChange={set('phone')} placeholder="(11) 99999-9999" className="w-full pl-9 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetreg.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input required type="email" value={form.email} onChange={set('email')} placeholder={t('v.vetlogin.emailPh')} className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetreg.address')}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input required type="text" value={form.address} onChange={set('address')} placeholder={t('v.vetreg.addressPh')} className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetreg.specialty')}</label>
              <div className="relative">
                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <select value={form.specialty} onChange={set('specialty')} className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800">
                  <option value="">{t('v.vetreg.specialtyPh')}</option>
                  {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetreg.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                  <input required type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••••" className="w-full pl-10 pr-10 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('v.vetreg.confirm')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                  <input required type={showPass ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} placeholder="••••••••" className="w-full pl-10 pr-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-60 transition flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Stethoscope className="w-5 h-5" />}
              {loading ? t('v.vetreg.submitting') : t('v.vetreg.submit')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('v.vetreg.hasAccount')}{' '}
              <Link href="/vet/login" className="text-primary-600 font-semibold hover:underline">
                {t('v.vet.signIn')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
