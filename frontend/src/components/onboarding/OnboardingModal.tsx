'use client'

import { useState, useEffect } from 'react'
import { PawPrint, ShieldCheck, MessageCircle, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'petlife_onboarding_v1_done'

const STEPS = [
  {
    Icon: PawPrint,
    title: 'Bem-vindo ao PetLife!',
    body: 'Cuide da saúde do seu pet com IA, lembretes inteligentes e uma carteirinha digital de verdade.',
    bg: 'from-primary-100 to-emerald-50 dark:from-primary-900/30 dark:to-emerald-900/20',
  },
  {
    Icon: Sparkles,
    title: 'Cadastra teu pet',
    body: 'Não sabe a raça do vira-lata? Tira uma foto e a IA Vyron identifica em segundos. Já cadastra peso, microchip e dados de saúde.',
    bg: 'from-amber-100 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/20',
  },
  {
    Icon: ShieldCheck,
    title: 'Carteirinha digital + plano por idade',
    body: 'Adiciona vacinas e exames. O app sugere vacinas/check-ups automáticos baseado em raça e idade (protocolo WSAVA). Carteirinha verificável por QR pra mandar pro vet via WhatsApp.',
    bg: 'from-emerald-100 to-primary-50 dark:from-emerald-900/30 dark:to-primary-900/20',
  },
  {
    Icon: MessageCircle,
    title: 'Vyron IA 24h',
    body: 'Botão flutuante no canto direito. Tira dúvidas sobre comportamento, sintomas, alimentação. Em português, com contexto do seu pet.',
    bg: 'from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20',
  },
]

interface OnboardingModalProps {
  forceOpen?: boolean
}

export function OnboardingModal({ forceOpen = false }: OnboardingModalProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (forceOpen) { setOpen(true); return }
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
  }, [forceOpen])

  function dismiss() {
    setOpen(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else dismiss()
  }

  if (!open) return null

  const s = STEPS[step]
  const { Icon } = s

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
        <button
          onClick={dismiss}
          aria-label="Pular onboarding"
          className="absolute right-3 top-3 p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 transition z-10"
        >
          <X className="w-4 h-4 text-surface-500 dark:text-surface-400" />
        </button>

        <div className={cn('bg-gradient-to-br p-8 pt-12 text-center', s.bg)}>
          <div className="w-20 h-20 mx-auto bg-white dark:bg-surface-700 rounded-3xl shadow-lg flex items-center justify-center mb-4">
            <Icon className="w-10 h-10 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">{s.title}</h2>
          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">{s.body}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === step ? 'w-8 bg-primary-500' : 'w-2 bg-surface-300 dark:bg-surface-600',
                )}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 transition"
              >
                Voltar
              </button>
            )}
            <button
              onClick={next}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition shadow-md shadow-primary-500/30"
            >
              {step === STEPS.length - 1 ? 'Começar' : 'Próximo'}
            </button>
          </div>

          {step === 0 && (
            <button onClick={dismiss} className="w-full text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300">
              Pular tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
