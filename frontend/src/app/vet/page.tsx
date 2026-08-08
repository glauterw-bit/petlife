'use client'

import Link from 'next/link'
import {
  Stethoscope, Users, FileText, Clock, Shield, Star, ChevronRight,
  PawPrint, CheckCircle, BarChart3, Bell
} from 'lucide-react'

const features = [
  {
    icon: <Users className="w-7 h-7 text-primary-500" />,
    title: 'Gestão de Pacientes',
    desc: 'Acesse o histórico completo de todos os seus pacientes em segundos.',
  },
  {
    icon: <FileText className="w-7 h-7 text-accent-500" />,
    title: 'Prontuários Digitais',
    desc: 'Vacinas, exames e consultas organizados digitalmente.',
  },
  {
    icon: <BarChart3 className="w-7 h-7 text-blue-500" />,
    title: 'Anamneses com IA',
    desc: 'Visualize anamneses com análise de urgência feita por Inteligência Artificial.',
  },
  {
    icon: <Bell className="w-7 h-7 text-yellow-500" />,
    title: 'Alertas Automáticos',
    desc: 'Veja quais pacientes têm vacinas atrasadas ou exames pendentes.',
  },
  {
    icon: <Clock className="w-7 h-7 text-purple-500" />,
    title: 'Acesso Rápido',
    desc: 'Busque qualquer paciente por nome ou tutor em segundos.',
  },
  {
    icon: <Shield className="w-7 h-7 text-green-500" />,
    title: 'Segurança Total',
    desc: 'Dados dos seus pacientes protegidos com criptografia e controle de acesso.',
  },
]

const testimonials = [
  { name: 'Dr. Carlos Mendes', clinic: 'Clínica VetCare SP', text: 'A PetLife revolucionou como atendo meus pacientes. Acesso o histórico completo em segundos!' },
  { name: 'Dra. Ana Ferreira', clinic: 'Hospital Veterinário Central', text: 'As anamneses com análise de IA me ajudam a priorizar casos urgentes antes mesmo da consulta.' },
  { name: 'Dr. Ricardo Lima', clinic: 'PetClinic Belo Horizonte', text: 'Minha equipe economiza horas por dia. O prontuário digital é excelente!' },
]

export default function VetLandingPage() {
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
            <span className="hidden sm:inline text-sm text-surface-400 ml-1">para Veterinários</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/vet/login" className="text-sm font-medium text-surface-700 dark:text-surface-200 hover:text-primary-600 px-4 py-2">
              Entrar
            </Link>
            <Link href="/vet/register" className="bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-primary-600 transition">
              Cadastrar clínica
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
              Portal exclusivo para profissionais veterinários
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              Transforme o cuidado dos seus pacientes
            </h1>
            <p className="text-xl text-primary-100 mb-8 leading-relaxed">
              Acesse históricos completos, visualize anamneses com análise de IA, e gerencie todos os seus pacientes em uma plataforma moderna e intuitiva.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/vet/register"
                className="flex items-center gap-2 bg-white dark:bg-surface-800 text-primary-700 font-bold px-8 py-4 rounded-2xl hover:bg-primary-50 transition hover:scale-105 shadow-xl"
              >
                Cadastrar minha clínica
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/vet/login"
                className="flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 hover:bg-white/20 transition"
              >
                Já tenho cadastro — Entrar
              </Link>
            </div>
            <div className="flex items-center gap-8 mt-10">
              {[
                { value: '500+', label: 'Clínicas parceiras' },
                { value: '50k+', label: 'Pacientes na plataforma' },
                { value: '100%', label: 'Gratuito para clínicas' },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-primary-200">{s.label}</div>
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
            <h2 className="text-4xl font-bold text-surface-900 dark:text-white mb-4">Tudo que sua clínica precisa</h2>
            <p className="text-xl text-surface-600 dark:text-surface-300 max-w-2xl mx-auto">
              Uma plataforma completa para oferecer o melhor atendimento veterinário.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-100 dark:border-surface-700 hover:border-primary-200 hover:shadow-md transition-all group">
                <div className="w-14 h-14 bg-surface-50 dark:bg-surface-900/60 group-hover:bg-primary-50 rounded-2xl flex items-center justify-center mb-4 transition">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-surface-600 dark:text-surface-300 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white dark:bg-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-surface-900 dark:text-white mb-4">Como funciona para veterinários</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { icon: '📝', step: '01', title: 'Cadastre sua clínica', desc: 'Registro rápido com CNPJ e dados básicos.' },
              { icon: '👥', step: '02', title: 'Seus pacientes chegam', desc: 'Tutores autorizam acesso ao histórico do pet.' },
              { icon: '🔍', step: '03', title: 'Acesse o histórico', desc: 'Vacinas, exames e anamneses completos.' },
              { icon: '✍️', step: '04', title: 'Adicione consultas', desc: 'Registre diagnósticos e retornos programados.' },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                  {s.icon}
                </div>
                <div className="text-xs font-bold text-primary-600 mb-1">{s.step}</div>
                <h3 className="font-bold text-surface-900 dark:text-white mb-2">{s.title}</h3>
                <p className="text-sm text-surface-600 dark:text-surface-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-surface-50 dark:bg-surface-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-surface-900 dark:text-white mb-4">O que os veterinários dizem</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white dark:bg-surface-800 rounded-2xl p-6 border border-surface-100 dark:border-surface-700">
                <div className="flex mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-surface-700 dark:text-surface-200 text-sm leading-relaxed mb-4 italic">"{t.text}"</p>
                <div>
                  <div className="font-semibold text-surface-900 dark:text-white">{t.name}</div>
                  <div className="text-sm text-surface-500 dark:text-surface-400">{t.clinic}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-primary-500 to-primary-700">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Pronto para revolucionar sua clínica?</h2>
          <p className="text-primary-100 text-xl mb-10">Cadastro gratuito. Sem mensalidade. Comece hoje mesmo.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/vet/register" className="bg-white dark:bg-surface-800 text-primary-700 font-bold px-10 py-4 rounded-2xl hover:bg-primary-50 transition hover:scale-105 shadow-xl flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Cadastrar minha clínica gratuitamente
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
          <p className="text-sm">© 2026 PetLife — Para veterinários que se importam.</p>
          <div className="flex gap-6 text-sm">
            <Link href="/vet/login" className="hover:text-white transition">Entrar</Link>
            <Link href="/vet/register" className="hover:text-white transition">Cadastrar</Link>
            <Link href="/" className="hover:text-white transition">Para tutores</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
