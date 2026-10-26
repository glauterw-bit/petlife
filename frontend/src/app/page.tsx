'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import {
  Shield, Bell, MapPin, Stethoscope, ChevronRight, PawPrint, Camera,
  QrCode, Send, Syringe, Pill, Bug, CheckCircle2, Clock, CircleDashed, Dog, Heart,
} from 'lucide-react'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import { variants, spring } from '@/lib/motion'

const features = [
  {
    icon: Shield,
    title: 'Carteirinha no celular',
    desc: 'Vacinas, vermífugo e antipulgas num só lugar, com a situação de cada um escrita por extenso.',
  },
  {
    icon: Camera,
    title: 'Cadastro por foto',
    desc: 'Fotografe a carteirinha de papel e a IA preenche os campos. Você confere e confirma.',
  },
  {
    icon: Bell,
    title: 'Lembretes de reforço',
    desc: 'Aviso na véspera e no dia do próximo reforço de vacina.',
  },
  {
    icon: Send,
    title: 'Envio para hotel, creche e vet',
    desc: 'Mande a carteirinha em PDF ou link pelo WhatsApp quando pedirem a comprovação.',
  },
  {
    icon: QrCode,
    title: 'QR para a coleira',
    desc: 'Se o pet se perder, quem achar escaneia o QR e consegue falar com você.',
  },
  {
    icon: MapPin,
    title: 'Clínicas próximas',
    desc: 'Encontre veterinários e pet shops perto de você.',
  },
]

const steps = [
  { title: 'Crie sua conta', desc: 'Grátis, com e-mail ou Apple.' },
  { title: 'Cadastre seu pet', desc: 'Nome, espécie e uma foto. O resto é opcional.' },
  { title: 'Fotografe a carteirinha', desc: 'As vacinas entram no app e os lembretes ficam prontos.' },
]

const mockRows = [
  { icon: Syringe, label: 'Vacinas', status: 'Protegido', chip: 'chip-success', StatusIcon: CheckCircle2 },
  { icon: Pill, label: 'Vermífugo', status: 'Vence em 12 dias', chip: 'chip-warning', StatusIcon: Clock },
  { icon: Bug, label: 'Antipulgas', status: 'Sem registro', chip: 'chip-neutral', StatusIcon: CircleDashed },
]

export default function LandingPage() {
  const router = useRouter()
  const { user, isLoading, isVetUser } = useAuth()
  const [native, setNative] = useState(false)
  useEffect(() => {
    try {
      const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }
      setNative(!!w.Capacitor?.isNativePlatform?.())
    } catch {}
  }, [])

  // O app nativo abre nesta página: sem isto, quem tinha sessão salva ("manter
  // conectado") caía na apresentação e digitava a senha de novo a cada abertura.
  useEffect(() => {
    if (!isLoading && user) router.replace(isVetUser ? '/clinica' : '/dashboard')
    // App nativo sem sessão: nada de página de apresentação do site (só em
    // português e longa) — vai direto pra primeira abertura guiada.
    else if (!isLoading && native) router.replace('/start')
  }, [isLoading, user, isVetUser, router, native])

  if (native) return <div className="min-h-screen bg-surface-50 dark:bg-surface-950" />

  return (
    <div className="min-h-screen bg-white dark:bg-surface-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] bg-white/90 dark:bg-surface-950/90 backdrop-blur-xl border-b border-surface-200/70 dark:border-surface-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 gap-2">
          <Link href="/" className="flex items-center gap-2 min-h-[44px]">
            <span className="w-8 h-8 bg-primary-700 dark:bg-primary-500 rounded-xl flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white dark:text-surface-950" aria-hidden />
            </span>
            <span className="text-xl font-display font-extrabold text-surface-900 dark:text-white">PetLife</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8" aria-label="Seções">
            <a href="#features" className="text-sm text-surface-600 dark:text-surface-300 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">Funcionalidades</a>
            <a href="#how" className="text-sm text-surface-600 dark:text-surface-300 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">Como funciona</a>
            <Link href="/vet" className="text-sm text-surface-600 dark:text-surface-300 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">Para clínicas</Link>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/auth/login"
              className="inline-flex items-center min-h-[44px] text-sm font-semibold text-surface-700 dark:text-surface-200 hover:text-primary-700 dark:hover:text-primary-300 px-3 rounded-xl"
            >
              Entrar
            </Link>
            <Button href="/auth/register" size="sm">Criar conta grátis</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 md:min-h-screen flex items-center relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 grid md:grid-cols-2 gap-12 items-center w-full">
          <Stagger gap={0.07}>
            <StaggerItem>
              <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-200 text-sm font-semibold px-3.5 py-1.5 rounded-full mb-6">
                <Syringe className="w-4 h-4" aria-hidden />
                Carteirinha de vacinação do pet no celular
              </div>
            </StaggerItem>
            <StaggerItem>
              <h1 className="text-[40px] md:text-6xl font-display font-extrabold tracking-tight text-surface-900 dark:text-white leading-[1.08] mb-5">
                Seu pet está protegido?{' '}
                <span className="text-primary-700 dark:text-primary-400">Veja num relance.</span>
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="text-lg md:text-xl text-surface-600 dark:text-surface-300 mb-8 leading-relaxed">
                Vacinas, vermífugo e antipulgas num lugar só, com lembrete antes de cada reforço de vacina. Cadastre a carteirinha de papel por foto
                e mande a comprovação para o hotel, a creche ou o veterinário em segundos.
              </p>
            </StaggerItem>
            <StaggerItem>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button href="/auth/register" size="lg" rightIcon={ChevronRight}>
                  Criar conta grátis
                </Button>
                <Button href="/vet" size="lg" variant="secondary" leftIcon={Stethoscope}>
                  Para clínicas veterinárias
                </Button>
              </div>
            </StaggerItem>
            <StaggerItem>
              <dl className="grid grid-cols-3 gap-4 mt-10 max-w-md">
                {[
                  { label: 'pets na conta grátis', value: 'Até 3' },
                  { label: 'antes de cada dose', value: 'Lembrete' },
                  { label: 'para a coleira', value: 'QR' },
                ].map(s => (
                  <div key={s.label}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd className="text-2xl font-display font-extrabold text-primary-700 dark:text-primary-400">{s.value}</dd>
                    <dd className="text-xs text-surface-600 dark:text-surface-400">{s.label}</dd>
                  </div>
                ))}
              </dl>
            </StaggerItem>
          </Stagger>

          {/* Ilustração da tela (exemplo) */}
          <motion.div
            className="relative max-w-sm mx-auto w-full md:max-w-md"
            variants={variants.scaleIn}
            initial="hidden"
            animate="show"
            transition={{ ...spring.soft, delay: 0.15 }}
            aria-label="Exemplo da tela do app"
            role="img"
          >
            <div className="bg-white dark:bg-surface-900 rounded-3xl shadow-float p-5 sm:p-6 border border-surface-200/70 dark:border-surface-800">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-500/15 ring-[3px] ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-surface-900 flex items-center justify-center">
                  <Dog className="w-7 h-7 text-primary-700 dark:text-primary-300" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="font-display font-bold text-surface-900 dark:text-white">Thor</div>
                  <div className="text-sm text-surface-500 dark:text-surface-400">Cão · exemplo</div>
                </div>
                <span className="ml-auto chip chip-success">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                  Protegido
                </span>
              </div>
              <ul className="space-y-2.5">
                {mockRows.map(r => (
                  <li key={r.label} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/70">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <r.icon className="w-4 h-4 text-surface-500 dark:text-surface-400 shrink-0" aria-hidden />
                      <span className="text-sm font-medium text-surface-800 dark:text-surface-100">{r.label}</span>
                    </span>
                    <span className={`chip ${r.chip}`}>
                      <r.StatusIcon className="w-3.5 h-3.5" aria-hidden />
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-3 p-3 rounded-xl border tone-brand-bg">
                <Bell className="w-5 h-5 text-primary-700 dark:text-primary-300 shrink-0" aria-hidden />
                <div className="text-sm text-surface-800 dark:text-surface-100">
                  Lembrete na véspera do reforço da V10
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-2 sm:-right-6 bg-white dark:bg-surface-800 rounded-2xl shadow-card p-3 border border-surface-200/70 dark:border-surface-700 flex items-center gap-2">
              <QrCode className="w-6 h-6 text-primary-700 dark:text-primary-300" aria-hidden />
              <div className="text-xs">
                <div className="font-bold text-surface-900 dark:text-white">Carteirinha</div>
                <div className="text-surface-500 dark:text-surface-400">PDF e link</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-24 bg-surface-50 dark:bg-surface-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-extrabold text-surface-900 dark:text-white mb-4">O que o PetLife faz</h2>
            <p className="text-lg md:text-xl text-surface-600 dark:text-surface-300 max-w-2xl mx-auto">
              O essencial da saúde do seu pet, sem planilha e sem papel perdido.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {features.map(f => (
              <div
                key={f.title}
                className="bg-white dark:bg-surface-950 rounded-2xl p-6 border border-surface-200/70 dark:border-surface-800"
              >
                <span className="w-12 h-12 bg-primary-50 dark:bg-primary-500/15 rounded-xl flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-primary-700 dark:text-primary-300" aria-hidden />
                </span>
                <h3 className="text-lg font-display font-bold text-surface-900 dark:text-white mb-1.5">{f.title}</h3>
                <p className="text-surface-600 dark:text-surface-300 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 md:py-24 bg-white dark:bg-surface-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-extrabold text-surface-900 dark:text-white mb-4">Como funciona</h2>
            <p className="text-lg md:text-xl text-surface-600 dark:text-surface-300">Três passos e a carteirinha está no celular.</p>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <li key={s.title} className="text-center">
                <span className="w-14 h-14 bg-primary-700 dark:bg-primary-500 rounded-2xl flex items-center justify-center text-white dark:text-surface-950 text-xl font-display font-extrabold mx-auto mb-4">
                  {i + 1}
                </span>
                <h3 className="text-xl font-display font-bold text-surface-900 dark:text-white mb-1.5">{s.title}</h3>
                <p className="text-surface-600 dark:text-surface-300">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-24 bg-gradient-to-br from-primary-700 to-primary-900 dark:from-primary-900 dark:to-surface-950 relative overflow-hidden">
        <PawPrint aria-hidden className="absolute -top-10 -left-10 w-64 h-64 text-white/5 -rotate-12" />
        <PawPrint aria-hidden className="absolute -bottom-12 -right-10 w-72 h-72 text-white/5 rotate-12" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-white mb-4">
            Comece pela carteirinha
          </h2>
          <p className="text-primary-50 text-lg md:text-xl mb-10">
            Cadastre seu pet, registre as vacinas e receba o aviso antes do próximo reforço. A conta é grátis.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/register"
              className={buttonClasses('secondary', 'lg', false, 'px-8 border-transparent text-primary-800 dark:bg-white dark:text-primary-800 dark:hover:bg-primary-50')}
            >
              <PawPrint className="w-5 h-5" aria-hidden />
              Criar conta grátis
            </Link>
            <Link
              href="/vet"
              className="inline-flex items-center justify-center min-h-[52px] px-8 rounded-xl font-semibold text-white border border-white/40 hover:bg-white/10 transition-colors"
            >
              Sou veterinário
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-900 dark:bg-black text-surface-300 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
              <PawPrint className="w-4 h-4 text-surface-950" aria-hidden />
            </span>
            <span className="text-white font-bold">PetLife</span>
          </div>
          <p className="text-sm inline-flex items-center gap-1.5">
            © 2026 PetLife. Feito com
            <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400" aria-label="carinho" />
            para os pets brasileiros.
          </p>
          <nav className="flex gap-2 text-sm" aria-label="Rodapé">
            <Link href="/auth/login" className="inline-flex items-center min-h-[44px] px-2 hover:text-white transition-colors">Entrar</Link>
            <Link href="/auth/register" className="inline-flex items-center min-h-[44px] px-2 hover:text-white transition-colors">Cadastrar</Link>
            <Link href="/vet" className="inline-flex items-center min-h-[44px] px-2 hover:text-white transition-colors">Veterinários</Link>
            <Link href="/privacy" className="inline-flex items-center min-h-[44px] px-2 hover:text-white transition-colors">Privacidade</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
