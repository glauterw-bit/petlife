'use client'

import { useState, useEffect } from 'react'
import { PawPrint, ShieldCheck, MessageCircle, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { dur, easeOut } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

const STORAGE_KEY = 'petlife_onboarding_v1_done'

const STEPS = [
  {
    Icon: PawPrint,
    titleKey: 'ac.tour.s1title',
    bodyKey: 'ac.tour.s1body',
    bg: 'from-primary-100 to-emerald-50 dark:from-primary-500/15 dark:to-surface-900',
  },
  {
    Icon: Sparkles,
    titleKey: 'ac.tour.s2title',
    bodyKey: 'ac.tour.s2body',
    bg: 'from-amber-100 to-yellow-50 dark:from-amber-500/15 dark:to-surface-900',
  },
  {
    Icon: ShieldCheck,
    titleKey: 'ac.tour.s3title',
    bodyKey: 'ac.tour.s3body',
    bg: 'from-emerald-100 to-primary-50 dark:from-emerald-500/15 dark:to-surface-900',
  },
  {
    Icon: MessageCircle,
    titleKey: 'ac.tour.s4title',
    bodyKey: 'ac.tour.s4body',
    bg: 'from-primary-50 to-accent-50 dark:from-primary-500/10 dark:to-surface-900',
  },
]

interface OnboardingModalProps {
  forceOpen?: boolean
}

export function OnboardingModal({ forceOpen = false }: OnboardingModalProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)

  useEffect(() => {
    if (forceOpen) { setOpen(true); return }
    if (typeof window === 'undefined') return
    // No convite da clínica a pessoa veio decidir o consentimento: o tour fica para a próxima tela.
    if (window.location.pathname.startsWith('/clinica-convite')) return
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
  }, [forceOpen])

  function dismiss() {
    setOpen(false)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
  }

  function next() {
    setDir(1)
    if (step < STEPS.length - 1) setStep(step + 1)
    else dismiss()
  }

  function back() {
    setDir(-1)
    setStep(s => Math.max(0, s - 1))
  }

  const s = STEPS[step]
  const { Icon } = s

  return (
    <Modal open={open} onClose={dismiss} size="md">
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: 14 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 * dir }}
            transition={{ duration: dur.base, ease: easeOut }}
            className={cn('bg-gradient-to-br px-8 pb-8 pt-10 text-center', s.bg)}
          >
            <div className="w-20 h-20 mx-auto bg-white dark:bg-surface-800 rounded-3xl shadow-card flex items-center justify-center mb-4">
              <Icon className="w-10 h-10 text-primary-700 dark:text-primary-300" aria-hidden />
            </div>
            <h2 className="text-xl font-display font-extrabold text-surface-900 dark:text-white mb-2">{t(s.titleKey)}</h2>
            <p className="text-[15px] text-surface-700 dark:text-surface-300 leading-relaxed">{t(s.bodyKey)}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pt-5 space-y-4">
        <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 rounded-full transition-all duration-200',
                i === step ? 'w-8 bg-primary-700 dark:bg-primary-400' : 'w-2 bg-surface-300 dark:bg-surface-700',
              )}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="secondary" size="lg" className="flex-1" onClick={back}>
              {t('nav.back')}
            </Button>
          )}
          <Button size="lg" className="flex-1" onClick={next}>
            {step === STEPS.length - 1 ? t('ac.tour.start') : t('ac.tour.next')}
          </Button>
        </div>

        {step === 0 && (
          <Button variant="ghost" fullWidth onClick={dismiss} className="text-surface-600 dark:text-surface-400">
            {t('ac.tour.skip')}
          </Button>
        )}
      </div>
    </Modal>
  )
}
