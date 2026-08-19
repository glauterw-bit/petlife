'use client'

import Link from 'next/link'
import {
  Stethoscope, Users, FileText, Clock, Shield, Star, ChevronRight,
  PawPrint, CheckCircle, BarChart3, Bell
} from 'lucide-react'
import { useT } from '@/contexts/LocaleContext'

const features = [
  {
    icon: <Users className="w-7 h-7 text-primary-500" />,
    titleKey: 'v.vet.f1.title',
    descKey: 'v.vet.f1.desc',
  },
  {
    icon: <FileText className="w-7 h-7 text-accent-500" />,
    titleKey: 'v.vet.f2.title',
    descKey: 'v.vet.f2.desc',
  },
  {
    icon: <BarChart3 className="w-7 h-7 text-blue-500" />,
    titleKey: 'v.vet.f3.title',
    descKey: 'v.vet.f3.desc',
  },
  {
    icon: <Bell className="w-7 h-7 text-yellow-500" />,
    titleKey: 'v.vet.f4.title',
    descKey: 'v.vet.f4.desc',
  },
  {
    icon: <Clock className="w-7 h-7 text-purple-500" />,
    titleKey: 'v.vet.f5.title',
    descKey: 'v.vet.f5.desc',
  },
  {
    icon: <Shield className="w-7 h-7 text-green-500" />,
    titleKey: 'v.vet.f6.title',
    descKey: 'v.vet.f6.desc',
  },
]

// Nome e clínica são nomes próprios — só o depoimento é traduzido.
const testimonials = [
  { name: 'Dr. Carlos Mendes', clinic: 'Clínica VetCare SP', textKey: 'v.vet.t1.text' },
  { name: 'Dra. Ana Ferreira', clinic: 'Hospital Veterinário Central', textKey: 'v.vet.t2.text' },
  { name: 'Dr. Ricardo Lima', clinic: 'PetClinic Belo Horizonte', textKey: 'v.vet.t3.text' },
]

const steps = [
  { icon: '📝', step: '01', titleKey: 'v.vet.s1.title', descKey: 'v.vet.s1.desc' },
  { icon: '👥', step: '02', titleKey: 'v.vet.s2.title', descKey: 'v.vet.s2.desc' },
  { icon: '🔍', step: '03', titleKey: 'v.vet.s3.title', descKey: 'v.vet.s3.desc' },
  { icon: '✍️', step: '04', titleKey: 'v.vet.s4.title', descKey: 'v.vet.s4.desc' },
]

export default function VetLandingPage() {
  const t = useT()

  return (
    <div className="min-h-screen bg-white dark:bg-surface-800">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-surface-100 dark:border-surface-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-surface-900 dark:text-white">PetLife</span>
            <span className="hidden sm:inline text-sm text-surface-400 ml-1">{t('v.vet.forVets')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/vet/login" className="text-sm font-medium text-surface-700 dark:text-surface-200 hover:text-primary-600 px-4 py-2">
              {t('v.vet.signIn')}
            </Link>
            <Link href="/vet/register" className="bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-primary-600 transition">
              {t('v.vet.registerClinic')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 min-h-[80vh] flex items-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="text-[300px] absolute -bottom-20 -right-20">🐾</div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 text-primary-100 text-sm font-medium px-4 py-1.5 rounded-full mb-6 border border-white/20">
              <Stethoscope className="w-4 h-4" />
              {t('v.vet.heroBadge')}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              {t('v.vet.heroTitle')}
            </h1>
            <p className="text-xl text-primary-100 mb-8 leading-relaxed">
              {t('v.vet.heroText')}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/vet/register"
                className="flex items-center gap-2 bg-white dark:bg-surface-800 text-primary-700 font-bold px-8 py-4 rounded-2xl hover:bg-primary-50 transition hover:scale-105 shadow-xl"
              >
                {t('v.vet.heroCta')}
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/vet/login"
                className="flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 hover:bg-white/20 transition"
              >
                {t('v.vet.heroLogin')}
              </Link>
            </div>
            <div className="flex items-center gap-8 mt-10">
              {[
                { value: '500+', labelKey: 'v.vet.statClinics' },
                { value: '50k+', labelKey: 'v.vet.statPatients' },
                { value: '100%', labelKey: 'v.vet.statFree' },
              ].map(s => (
                <div key={s.labelKey}>
                  <div className="text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-primary-200">{t(s.labelKey)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-surface-50 dark:bg-surface-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-surface-900 dark:text-white mb-4">{t('v.vet.featuresTitle')}</h2>
            <p className="text-xl text-surface-600 dark:text-surface-300 max-w-2xl mx-auto">
              {t('v.vet.featuresText')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-100 dark:border-surface-700 hover:border-primary-200 hover:shadow-md transition-all group">
                <div className="w-14 h-14 bg-surface-50 dark:bg-surface-900/60 group-hover:bg-primary-50 rounded-2xl flex items-center justify-center mb-4 transition">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2">{t(f.titleKey)}</h3>
                <p className="text-surface-600 dark:text-surface-300 text-sm leading-relaxed">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white dark:bg-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-surface-900 dark:text-white mb-4">{t('v.vet.howTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map(s => (
              <div key={s.step} className="text-center">
                <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                  {s.icon}
                </div>
                <div className="text-xs font-bold text-primary-600 mb-1">{s.step}</div>
                <h3 className="font-bold text-surface-900 dark:text-white mb-2">{t(s.titleKey)}</h3>
                <p className="text-sm text-surface-600 dark:text-surface-300">{t(s.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-surface-50 dark:bg-surface-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-surface-900 dark:text-white mb-4">{t('v.vet.testimonialsTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item, i) => (
              <div key={i} className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-100 dark:border-surface-700">
                <div className="flex mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-surface-700 dark:text-surface-200 text-sm leading-relaxed mb-4 italic">"{t(item.textKey)}"</p>
                <div>
                  <div className="font-semibold text-surface-900 dark:text-white">{item.name}</div>
                  <div className="text-sm text-surface-500 dark:text-surface-400">{item.clinic}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-primary-500 to-primary-700">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">{t('v.vet.ctaTitle')}</h2>
          <p className="text-primary-100 text-xl mb-10">{t('v.vet.ctaText')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/vet/register" className="bg-white dark:bg-surface-800 text-primary-700 font-bold px-10 py-4 rounded-2xl hover:bg-primary-50 transition hover:scale-105 shadow-xl flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {t('v.vet.ctaButton')}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-900 text-surface-400 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
              <PawPrint className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">PetLife</span>
          </div>
          <p className="text-sm">{t('v.vet.footerNote')}</p>
          <div className="flex gap-6 text-sm">
            <Link href="/vet/login" className="hover:text-white transition">{t('v.vet.signIn')}</Link>
            <Link href="/vet/register" className="hover:text-white transition">{t('v.vet.footerRegister')}</Link>
            <Link href="/" className="hover:text-white transition">{t('v.vet.footerOwners')}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
