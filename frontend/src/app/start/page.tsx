'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PawPrint, Syringe, IdCard, ArrowRight, ChevronLeft, Dog, Cat, QrCode, CircleDashed } from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LocaleContext'
import { savePetDraft, loadPetDraft } from '@/lib/petDraft'
import { track } from '@/lib/track'
import { hapticLight } from '@/lib/feedback'
import { Button } from '@/components/ui/Button'
import { VyronAvatar } from '@/components/ai/VyronAvatar'
import { spring, dur, easeOut, usePrefersReducedMotion } from '@/lib/motion'

/**
 * Primeira abertura do app nativo: o pet vem antes da conta.
 *
 * Antes o app abria na página de apresentação do site (só em português) e
 * depois num formulário de 5 campos — 55% de quem baixava não chegava a criar
 * a conta. Aqui: boas-vindas → nome do pet → cão ou gato → conta (Apple em um
 * toque ou e-mail). O pet é criado sozinho logo depois do cadastro.
 */
export default function StartPage() {
  const t = useT()
  const reduced = usePrefersReducedMotion()
  const router = useRouter()
  const { user, isLoading, isVetUser } = useAuth()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [hoverSpecies, setHoverSpecies] = useState<'dog' | 'cat' | null>(null)
  // Vyron comemora no toque do botão principal das boas-vindas.
  const [cheering, setCheering] = useState(false)
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isLoading && user) router.replace(isVetUser ? '/clinica' : '/dashboard')
  }, [isLoading, user, isVetUser, router])

  useEffect(() => {
    setName(loadPetDraft()?.name ?? '')
    track('start_shown')
  }, [])

  function next() {
    void hapticLight()
    track('start_step', { meta: `passo ${step + 1}` })
    setStep(s => s + 1)
  }

  useEffect(() => () => { if (cheerTimer.current) clearTimeout(cheerTimer.current) }, [])
  // Voltou para as boas-vindas: o Vyron volta ao normal e o botão destrava.
  useEffect(() => { if (step === 0) setCheering(false) }, [step])

  /** Boas-vindas → nome: o Vyron pula antes de a tela trocar (sem atraso com reduced motion). */
  function startFlow() {
    if (cheering) return
    setCheering(true)
    if (reduced) { next(); return }
    void hapticLight()
    cheerTimer.current = setTimeout(() => {
      track('start_step', { meta: 'passo 1' })
      setStep(1)
    }, 320)
  }

  function choose(species: 'dog' | 'cat') {
    void hapticLight()
    savePetDraft({ name: name.trim(), species })
    track('start_pet_done')
    const ref = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null
    router.push(`/auth/register${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`)
  }

  const petName = name.trim()

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 flex flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between h-11">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => { void hapticLight(); setStep(s => s - 1) }}
            aria-label={t('nav.back')}
            className="pressable inline-flex items-center justify-center w-11 h-11 -ml-2 rounded-xl text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ChevronLeft className="w-6 h-6" aria-hidden />
          </button>
        ) : <span className="w-11" />}
        <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-label={t('acct.start.progress', { n: step + 1 })}>
          {[0, 1, 2].map(i => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-200 ${i === step ? 'w-6 bg-primary-700 dark:bg-primary-400' : i < step ? 'w-1.5 bg-primary-300 dark:bg-primary-700' : 'w-1.5 bg-surface-300 dark:bg-surface-700'}`} />
          ))}
        </div>
        <span className="w-11" />
      </div>

      <div className={`flex-1 flex flex-col max-w-md w-full mx-auto ${step === 0 ? 'justify-start pt-2 pb-4' : 'justify-center py-4'}`}>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={step}
            initial={{ opacity: 0, x: reduced ? 0 : 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduced ? 0 : -14 }}
            transition={{ duration: reduced ? 0.12 : dur.base, ease: easeOut }}
          >
            {step === 0 && <Welcome cheering={cheering} reduced={reduced} />}

            {step === 1 && (
              <>
                <PreviewCard name={petName} species={null} />
                <h1 className="font-display text-2xl font-extrabold text-surface-900 dark:text-white mb-1.5 mt-7">
                  <label htmlFor="start-pet-name">{t('st.nameTitle')}</label>
                </h1>
                <p className="text-sm text-surface-600 dark:text-surface-300 mb-4">{t('st.nameHint')}</p>
                <input
                  id="start-pet-name"
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && petName) next() }}
                  maxLength={60}
                  autoComplete="off"
                  enterKeyHint="next"
                  placeholder={t('st.namePh')}
                  className="w-full px-4 py-3.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-lg text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </>
            )}

            {step === 2 && (
              <>
                <PreviewCard name={petName} species={hoverSpecies} />
                <h1 className="font-display text-2xl font-extrabold text-surface-900 dark:text-white mb-4 mt-7">
                  {t('st.speciesTitle', { name: petName })}
                </h1>
                <div className="grid grid-cols-2 gap-3">
                  {([['dog', Dog, t('pet.dog')], ['cat', Cat, t('pet.cat')]] as const).map(([sp, Icon, label]) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => choose(sp)}
                      onPointerEnter={() => setHoverSpecies(sp)}
                      onFocus={() => setHoverSpecies(sp)}
                      className="pressable flex flex-col items-center gap-2.5 py-6 rounded-2xl bg-white dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-700 hover:border-primary-500 focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-950 transition-colors"
                    >
                      <span className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center">
                        <Icon className="w-8 h-8 text-primary-700 dark:text-primary-300" aria-hidden strokeWidth={1.8} />
                      </span>
                      <span className="font-semibold text-surface-800 dark:text-surface-100">{label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </m.div>
        </AnimatePresence>
      </div>

      <div className="max-w-md w-full mx-auto space-y-2">
        {step === 0 && (
          <>
            <Button onClick={startFlow} size="lg" fullWidth rightIcon={ArrowRight}>
              {t('st.cta')}
            </Button>
            <Link
              href="/auth/login"
              className="flex items-center justify-center min-h-[44px] rounded-xl text-sm font-semibold text-primary-700 dark:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {t('st.hasAccount')}
            </Link>
          </>
        )}
        {step === 1 && (
          <Button onClick={next} disabled={!petName} size="lg" fullWidth rightIcon={ArrowRight}>
            {t('st.continue')}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Boas-vindas: o Vyron recebe o tutor e os 3 passos reais do começo
 * (cadastrar o pet, registrar a 1ª vacina, ter carteirinha e lembretes).
 * Entrada escalonada só com motion permitido; com reduced motion, aparece
 * tudo de uma vez.
 */
function Welcome({ cheering, reduced }: { cheering: boolean; reduced: boolean }) {
  const t = useT()
  const steps = [
    { Icon: PawPrint, title: t('st.s1t'), desc: t('st.s1d') },
    { Icon: Syringe, title: t('st.s2t'), desc: t('st.s2d') },
    { Icon: IdCard, title: t('st.s3t'), desc: t('st.s3d') },
  ]
  const item = reduced
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: easeOut } } }
  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: reduced ? {} : { staggerChildren: 0.06, delayChildren: 0.04 } } }}
    >
      <m.div variants={item} className="flex justify-start mb-4">
        <span className="relative inline-flex items-center justify-center w-[104px] h-[104px] rounded-full bg-primary-100/70 dark:bg-primary-500/15">
          <VyronAvatar size={88} state={cheering ? 'celebrating' : 'idle'} />
        </span>
      </m.div>
      <m.h1 variants={item} className="font-display text-[30px] font-extrabold tracking-tight text-surface-900 dark:text-white leading-tight mb-2">
        {t('st.welcomeTitle')}
      </m.h1>
      <m.p variants={item} className="text-[15px] leading-relaxed text-surface-600 dark:text-surface-300 mb-6">
        {t('st.welcomeBody')}
      </m.p>
      <ol aria-label={t('st.howAria')} className="relative">
        {steps.map(({ Icon, title, desc }, i) => (
          <m.li key={title} variants={item} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span aria-hidden className="absolute left-[21px] top-12 bottom-1 w-0.5 rounded-full bg-primary-200 dark:bg-primary-500/25" />
            )}
            <span className="relative w-11 h-11 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/80 dark:border-surface-700 shadow-sm flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary-700 dark:text-primary-300" aria-hidden />
              <span aria-hidden className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-primary-700 dark:bg-primary-400 text-white dark:text-surface-950 text-[11px] font-bold tabular-nums flex items-center justify-center ring-2 ring-white dark:ring-surface-950">
                {i + 1}
              </span>
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[15px] font-bold text-surface-900 dark:text-white leading-snug">{title}</p>
              <p className="text-sm text-surface-600 dark:text-surface-300 leading-snug mt-0.5">{desc}</p>
            </div>
          </m.li>
        ))}
      </ol>
    </m.div>
  )
}

/**
 * Prévia ilustrativa da carteirinha (CSS puro, nenhum dado inventado):
 * mostra só o que o próprio usuário digitou, preenchendo ao vivo.
 */
function PreviewCard({ name, species }: { name: string; species: 'dog' | 'cat' | null }) {
  const t = useT()
  const Icon = species === 'dog' ? Dog : species === 'cat' ? Cat : PawPrint
  return (
    <m.div
      initial={{ opacity: 0, y: 12, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: -1.5 }}
      transition={spring.soft}
      className="relative mx-auto w-full max-w-[320px] aspect-[1.6/1] rounded-3xl p-5 overflow-hidden text-white shadow-float bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 dark:from-primary-700 dark:via-primary-800 dark:to-primary-950"
      aria-label={t('acct.start.previewAria', { name: name || t('acct.start.previewName') })}
      role="img"
    >
      <PawPrint aria-hidden className="absolute -right-6 -bottom-8 w-40 h-40 text-white/10 rotate-12" />
      <div className="relative flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">{t('acct.start.previewTitle')}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 rounded-full px-2 py-0.5">{t('acct.start.preview')}</span>
      </div>
      <div className="relative flex items-center gap-3 mt-4">
        <span className="w-14 h-14 rounded-full bg-white/20 ring-2 ring-white/40 flex items-center justify-center shrink-0">
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={species ?? 'none'}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={spring.pop}
              className="flex"
            >
              <Icon className="w-7 h-7" aria-hidden />
            </m.span>
          </AnimatePresence>
        </span>
        <div className="min-w-0">
          <div className={`font-display text-2xl font-extrabold truncate ${name ? '' : 'text-white/50'}`}>
            {name || t('acct.start.previewName')}
          </div>
          <div className="text-xs text-white/80">
            {species === 'dog' ? t('pet.dog') : species === 'cat' ? t('pet.cat') : ' '}
          </div>
        </div>
      </div>
      <div className="relative flex items-end justify-between mt-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 rounded-full px-2.5 py-1">
          <CircleDashed className="w-3.5 h-3.5" aria-hidden />
          {t('acct.start.previewStatus')}
        </span>
        <QrCode className="w-8 h-8 text-white/70" aria-hidden />
      </div>
    </m.div>
  )
}
