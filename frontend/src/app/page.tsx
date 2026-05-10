'use client'

import Link from 'next/link'
import {
  Heart, Shield, Calendar, Trophy, MapPin, Zap,
  Stethoscope, Bell, Star, ChevronRight, PawPrint
} from 'lucide-react'

const features = [
  {
    icon: <Shield className="w-7 h-7 text-primary-500" />,
    title: 'Saúde em Dia',
    desc: 'Controle de vacinas e exames com alertas automáticos para nunca perder uma data importante.',
  },
  {
    icon: <Calendar className="w-7 h-7 text-accent-500" />,
    title: 'Rotinas Personalizadas',
    desc: 'Rotinas de passeio geradas por IA, adaptadas à raça, idade e energia do seu pet.',
  },
  {
    icon: <Heart className="w-7 h-7 text-red-400" />,
    title: 'Anamnese Inteligente',
    desc: 'Descreva os sintomas e nossa IA avalia a urgência e recomenda os próximos passos.',
  },
  {
    icon: <Trophy className="w-7 h-7 text-yellow-500" />,
    title: 'Gamificação',
    desc: 'Ganhe pontos e badges cuidando do seu pet. Suba no ranking e mostre que você é o melhor tutor!',
  },
  {
    icon: <MapPin className="w-7 h-7 text-blue-500" />,
    title: 'Clínicas Próximas',
    desc: 'Encontre veterinários e pet shops próximos a você em segundos.',
  },
  {
    icon: <Stethoscope className="w-7 h-7 text-purple-500" />,
    title: 'Portal Veterinário',
    desc: 'Clínicas têm acesso ao histórico completo dos pacientes de forma rápida e segura.',
  },
]

const steps = [
  { num: '01', title: 'Cadastre-se', desc: 'Crie sua conta gratuitamente em menos de 1 minuto.' },
  { num: '02', title: 'Adicione seu Pet', desc: 'Informe a raça, idade e dados básicos do seu companheiro.' },
  { num: '03', title: 'Cuide com IA', desc: 'Nossa IA cria rotinas, analisa sintomas e mantém tudo organizado.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-surface-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-surface-900">PetLife</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-surface-600 hover:text-primary-600 transition-colors">Funcionalidades</a>
            <a href="#how" className="text-sm text-surface-600 hover:text-primary-600 transition-colors">Como funciona</a>
            <Link href="/vet" className="text-sm text-surface-600 hover:text-primary-600 transition-colors">Para Clínicas</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-surface-700 hover:text-primary-600 transition-colors px-4 py-2">
              Entrar
            </Link>
            <Link href="/auth/register" className="bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-primary-600 transition-colors">
              Cadastrar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 min-h-screen flex items-center relative overflow-hidden paw-pattern">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-accent-50" />

        {/* Decorative paws */}
        <div className="absolute top-24 right-10 text-8xl opacity-10 animate-paw-bounce">🐾</div>
        <div className="absolute bottom-32 left-10 text-6xl opacity-10 animate-paw-bounce" style={{ animationDelay: '0.3s' }}>🐾</div>
        <div className="absolute top-1/2 right-1/4 text-4xl opacity-10 animate-paw-bounce" style={{ animationDelay: '0.6s' }}>🐾</div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <Star className="w-4 h-4" />
              Plataforma #1 para tutores de pets no Brasil
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-surface-900 leading-tight mb-6">
              PetLife —{' '}
              <span className="text-primary-500">o cuidado</span>{' '}
              que seu pet merece
            </h1>
            <p className="text-xl text-surface-600 mb-8 leading-relaxed">
              Gerencie vacinas, exames, rotinas de passeio e muito mais com o poder da Inteligência Artificial.
              Tudo num só lugar, de graça.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/auth/register"
                className="flex items-center gap-2 bg-primary-500 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-primary-600 transition-all hover:scale-105 shadow-lg shadow-primary-200"
              >
                Cadastrar grátis
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/vet"
                className="flex items-center gap-2 bg-white text-surface-700 font-semibold px-8 py-4 rounded-2xl border-2 border-surface-200 hover:border-primary-300 transition-all hover:scale-105"
              >
                <Stethoscope className="w-5 h-5 text-primary-500" />
                Para clínicas veterinárias
              </Link>
            </div>
            <div className="flex items-center gap-6 mt-10">
              {[
                { label: 'Pets cadastrados', value: '50k+' },
                { label: 'Vacinas controladas', value: '200k+' },
                { label: 'Tutores felizes', value: '30k+' },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-primary-600">{s.value}</div>
                  <div className="text-xs text-surface-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Illustration / Mock UI */}
          <div className="hidden md:block animate-slide-up">
            <div className="relative">
              <div className="bg-white rounded-3xl shadow-2xl p-6 border border-surface-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-2xl">🐕</div>
                  <div>
                    <div className="font-bold text-surface-900">Thor</div>
                    <div className="text-sm text-surface-500">Golden Retriever • 3 anos</div>
                  </div>
                  <div className="ml-auto bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                    Saúde ótima ✅
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-surface-700">Antirrábica</span>
                    </div>
                    <span className="text-xs text-green-600 font-medium">Em dia</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-medium text-surface-700">V10 — vence em 15 dias</span>
                    </div>
                    <span className="text-xs text-yellow-600 font-medium">Atenção ⚠️</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-primary-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary-600" />
                      <span className="text-sm font-medium text-surface-700">Passeio: 7h, 12h, 18h</span>
                    </div>
                    <span className="text-xs text-primary-600 font-medium">Rotina IA</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 p-3 bg-accent-50 rounded-xl">
                  <Trophy className="w-5 h-5 text-accent-500" />
                  <div>
                    <div className="text-sm font-bold text-surface-900">Nível 4 — Protetor</div>
                    <div className="w-full bg-surface-200 rounded-full h-1.5 mt-1">
                      <div className="bg-accent-500 h-1.5 rounded-full" style={{ width: '65%' }} />
                    </div>
                  </div>
                  <span className="ml-auto text-xs text-surface-500">650/1000 pts</span>
                </div>
              </div>
              {/* Floating cards */}
              <div className="absolute -top-6 -right-6 bg-white rounded-2xl shadow-lg p-3 border border-surface-100 flex items-center gap-2">
                <span className="text-2xl">🐈</span>
                <div>
                  <div className="text-xs font-bold text-surface-900">Luna</div>
                  <div className="text-xs text-green-600">Exames ok</div>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-lg p-3 border border-surface-100">
                <div className="text-xs font-medium text-surface-700">🏆 Novo badge!</div>
                <div className="text-xs text-accent-600 font-semibold">Tutor Exemplar</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-surface-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-surface-900 mb-4">Tudo que seu pet precisa</h2>
            <p className="text-xl text-surface-600 max-w-2xl mx-auto">
              Uma plataforma completa para garantir a saúde, felicidade e bem-estar do seu melhor amigo.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 border border-surface-100 hover:border-primary-200 hover:shadow-lg transition-all group"
              >
                <div className="w-14 h-14 bg-surface-50 group-hover:bg-primary-50 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-surface-900 mb-2">{f.title}</h3>
                <p className="text-surface-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-surface-900 mb-4">Como funciona?</h2>
            <p className="text-xl text-surface-600">Simples, rápido e eficiente.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                  {s.num}
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute translate-x-full -translate-y-8 text-surface-300">
                    <ChevronRight className="w-8 h-8" />
                  </div>
                )}
                <h3 className="text-xl font-bold text-surface-900 mb-2">{s.title}</h3>
                <p className="text-surface-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-primary-500 to-primary-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="text-[200px] absolute -top-10 -left-10">🐾</div>
          <div className="text-[200px] absolute -bottom-10 -right-10">🐾</div>
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Seu pet merece o melhor cuidado
          </h2>
          <p className="text-primary-100 text-xl mb-10">
            Junte-se a mais de 30.000 tutores que já confiam na PetLife para cuidar dos seus companheiros.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="bg-white text-primary-600 font-bold px-10 py-4 rounded-2xl hover:bg-primary-50 transition-all hover:scale-105 shadow-xl"
            >
              Começar gratuitamente 🐾
            </Link>
            <Link
              href="/vet"
              className="bg-primary-600/50 text-white font-semibold px-10 py-4 rounded-2xl border border-primary-400 hover:bg-primary-600 transition-all"
            >
              Sou veterinário
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-900 text-surface-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
              <PawPrint className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">PetLife</span>
          </div>
          <p className="text-sm">© 2026 PetLife. Feito com ❤️ para os pets brasileiros.</p>
          <div className="flex gap-6 text-sm">
            <Link href="/auth/login" className="hover:text-white transition-colors">Entrar</Link>
            <Link href="/auth/register" className="hover:text-white transition-colors">Cadastrar</Link>
            <Link href="/vet" className="hover:text-white transition-colors">Veterinários</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
