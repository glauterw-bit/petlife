'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PawPrint, Camera, Syringe, Footprints, Check, ArrowRight, X, Sparkles } from 'lucide-react'
import type { Pet } from '@/lib/api'

/**
 * Guia de primeiros passos — ativação do usuário novo.
 *
 * Aparece SÓ enquanto há passos pendentes (e some sozinho quando tudo é feito
 * ou o usuário fecha). Cada passo leva direto pra ação de maior valor, que é
 * o que revela o "aha" do app e cria o hábito cedo (retenção).
 */

const DISMISS_KEY = 'petlife_onboarding_v1_dismissed'

interface Step {
  key: string
  done: boolean
  label: string
  desc: string
  href: string | null
  icon: React.ReactNode
}

export function OnboardingChecklist({
  pet,
  hasVaccine,
  hasWalk,
  firstName,
}: {
  pet: Pet
  hasVaccine: boolean
  hasWalk: boolean
  firstName?: string
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null) // null = ainda não hidratou

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  const steps: Step[] = [
    {
      key: 'pet',
      done: true,
      label: 'Cadastrar seu pet',
      desc: 'Feito! 🎉',
      href: null,
      icon: <PawPrint className="w-4 h-4" />,
    },
    {
      key: 'photo',
      done: !!pet.photo_url,
      label: `Adicionar a foto ${pet.name ? `de ${pet.name}` : 'do pet'}`,
      desc: 'Deixe o perfil com a cara dele',
      href: `/pets/${pet.id}`,
      icon: <Camera className="w-4 h-4" />,
    },
    {
      key: 'vaccine',
      done: hasVaccine,
      label: 'Registrar a 1ª vacina',
      desc: 'A carteirinha digital sai pronta pra compartilhar',
      href: '/health/vaccines',
      icon: <Syringe className="w-4 h-4" />,
    },
    {
      key: 'walk',
      done: hasWalk,
      label: 'Fazer o 1º passeio',
      desc: 'Com mapa do percurso e card pra postar',
      href: '/walks/active',
      icon: <Footprints className="w-4 h-4" />,
    },
  ]

  const doneCount = steps.filter(s => s.done).length
  const total = steps.length
  const pct = Math.round((doneCount / total) * 100)
  const allDone = doneCount === total

  // Ainda hidratando, já concluiu tudo, ou usuário fechou → não mostra.
  if (dismissed === null || dismissed || allDone) return null

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setDismissed(true)
  }

  return (
    <div className="relative rounded-3xl border border-primary-100 dark:border-primary-900/40 bg-gradient-to-br from-primary-50 to-accent-50 dark:from-surface-800 dark:to-surface-800 p-5 mb-6 overflow-hidden">
      <div
        className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 rounded-full bg-primary-400 opacity-[0.10] blur-3xl"
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary-500 shrink-0" />
            <h2 className="font-display text-base font-bold text-surface-900 dark:text-white truncate">
              Bora começar{firstName ? `, ${firstName}` : ''}! 🚀
            </h2>
          </div>
          <p className="text-xs text-surface-600 dark:text-surface-300 mt-0.5">
            {doneCount} de {total} — complete pra tirar o máximo do PetLife
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dispensar guia"
          className="tap-target -mt-1 -mr-1 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-white/60 dark:hover:bg-surface-700/60 flex items-center justify-center shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* barra de progresso */}
      <div className="relative h-1.5 bg-white/70 dark:bg-surface-700 rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-primary-500 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* passos */}
      <div className="relative space-y-2">
        {steps.map(step => {
          const inner = (
            <>
              <span
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                  step.done
                    ? 'bg-primary-500 text-white'
                    : 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-300 border border-primary-100 dark:border-surface-600'
                }`}
              >
                {step.done ? <Check className="w-4 h-4" /> : step.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-semibold leading-snug ${
                    step.done
                      ? 'text-surface-400 dark:text-surface-500 line-through'
                      : 'text-surface-900 dark:text-white'
                  }`}
                >
                  {step.label}
                </div>
                {!step.done && (
                  <div className="text-xs text-surface-500 dark:text-surface-400 leading-snug">{step.desc}</div>
                )}
              </div>
              {!step.done && step.href && (
                <ArrowRight className="w-4 h-4 text-primary-400 shrink-0 group-hover:translate-x-0.5 transition" />
              )}
            </>
          )

          const base = 'flex items-center gap-3 rounded-2xl p-2.5'

          if (step.done || !step.href) {
            return (
              <div key={step.key} className={base}>
                {inner}
              </div>
            )
          }
          return (
            <Link
              key={step.key}
              href={step.href}
              className={`group pressable ${base} bg-white/60 dark:bg-surface-700/40 hover:bg-white dark:hover:bg-surface-700 transition`}
            >
              {inner}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
