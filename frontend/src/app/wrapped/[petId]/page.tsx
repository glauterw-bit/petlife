'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { X, Share2, Sparkles, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { AnimatePresence, MotionConfig, m } from 'framer-motion'
import { spring } from '@/lib/motion'
import { hapticLight, hapticSuccess } from '@/lib/feedback'
import { innovations, type PetLifeWrapped } from '@/lib/api'
import { useT } from '@/contexts/LocaleContext'

export default function WrappedPage() {
  const t = useT()
  const params = useParams()
  const router = useRouter()
  const petId = Number(params.petId)
  const [data, setData] = useState<PetLifeWrapped | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  function go(delta: 1 | -1, max: number) {
    setDir(delta)
    setStep(s => Math.max(0, Math.min(max, s + delta)))
    void hapticLight()
  }
  const year = new Date().getFullYear()

  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setError(null)
    innovations.petlifeWrapped(petId, year)
      .then(setData)
      // mensagem amigável: "Erro 429" (limite da IA) não diz nada a quem lê
      .catch(() => setError(t('g.wr.errGenerate')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId, year, attempt])

  function shareWhatsApp() {
    if (!data) return
    const text = encodeURIComponent(`${data.share_text}\n\n${window.location.origin}/public/wrapped/${data.public_token ?? petId}`)
    void hapticSuccess()
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-purple-700 via-pink-600 to-amber-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md text-center">
          <p className="text-surface-700">{error}</p>
          <div className="mt-4 flex flex-col gap-1">
            <button type="button" onClick={() => setAttempt(n => n + 1)} className="min-h-[44px] px-4 rounded-xl bg-primary-700 text-white font-semibold">{t('ui.retry')}</button>
            <button type="button" onClick={() => router.back()} className="min-h-[44px] px-4 text-primary-700 font-semibold">{t('nav.back')}</button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-purple-700 via-pink-600 to-amber-500 flex items-center justify-center" role="status">
        <div className="text-white text-center">
          <Sparkles className="w-12 h-12 mx-auto motion-safe:animate-pulse mb-4" aria-hidden />
          <p className="text-lg">{t('g.wr.preparing')}</p>
        </div>
      </div>
    )
  }

  const slides = [
    {
      bg: 'from-purple-600 via-pink-500 to-amber-400',
      content: (
        <>
          <p className="text-sm uppercase tracking-widest opacity-80 font-bold mb-2">{t('g.wr.header', { year: data.year })}</p>
          <h1 className="text-5xl sm:text-6xl font-black mb-4">{data.title}</h1>
          <p className="text-xl opacity-95">{data.subtitle}</p>
        </>
      ),
    },
    ...data.highlights.map(h => ({
      bg: 'from-indigo-600 via-purple-600 to-pink-500',
      content: (
        <>
          <div className="text-8xl mb-4">{h.emoji}</div>
          <div className="text-7xl font-black mb-2">{h.stat}</div>
          <p className="text-xl font-semibold opacity-95 mb-2">{h.label}</p>
          <p className="text-sm opacity-80 max-w-xs">{h.narrative}</p>
        </>
      ),
    })),
    ...(data.personality_tag ? [{
      bg: 'from-rose-500 via-orange-400 to-amber-300',
      content: (
        <>
          <p className="text-sm uppercase tracking-widest opacity-80 font-bold mb-2">{t('g.wr.personality', { name: data.pet_name })}</p>
          <h2 className="text-5xl font-black mb-4">{data.personality_tag}</h2>
        </>
      ),
    }] : []),
    {
      bg: 'from-emerald-500 via-teal-500 to-cyan-500',
      content: (
        <>
          <p className="text-sm uppercase tracking-widest opacity-80 font-bold mb-2">{t('g.wr.yourYear', { name: data.pet_name })}</p>
          <p className="text-xl leading-relaxed mb-6 max-w-md">{data.narrative}</p>
          {data.next_year_wish && <p className="text-base italic opacity-90">{data.next_year_wish}</p>}
        </>
      ),
    },
  ]

  const last = slides.length - 1
  const slide = slides[step]
  const isLast = step === last

  // Tema escuro fixo e intencional: os cartões são fundos de cor saturada com texto branco.
  return (
    <MotionConfig reducedMotion="user">
      <div className={`min-h-dvh bg-gradient-to-br ${slide.bg} text-white relative overflow-hidden flex flex-col transition-[background] duration-300`}>
        {/* Barras de progresso + fechar */}
        <div className="flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] z-10">
          <div className="flex-1 flex gap-1" aria-hidden>
            {slides.map((_, i) => (
              <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div className={`h-full bg-white transition-[width] duration-300 ${i <= step ? 'w-full' : 'w-0'}`} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-11 h-11 -mr-1 flex items-center justify-center rounded-full text-white/90 hover:bg-white/15"
            aria-label={t('common.close')}
          >
            <X className="w-6 h-6" aria-hidden />
          </button>
        </div>
        <p className="sr-only" aria-live="polite">{t('wk.wr.slideOf', { n: step + 1, total: slides.length })}</p>

        {/* Conteúdo: toque à direita avança, à esquerda volta (como stories) */}
        <div className="relative flex-1 flex flex-col items-center justify-center text-center p-8">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <m.div
              key={step}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 40, scale: 0.98 }),
                center: { opacity: 1, x: 0, scale: 1 },
                exit: (d: number) => ({ opacity: 0, x: d * -40, scale: 0.98 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={spring.snappy}
            >
              {slide.content}
            </m.div>
          </AnimatePresence>
          {step > 0 && (
            <button
              type="button"
              onClick={() => go(-1, last)}
              className="absolute left-0 inset-y-0 w-1/3 flex items-center justify-start pl-2 text-white/0 focus-visible:text-white/80"
              aria-label={t('wk.wr.prev')}
            >
              <ChevronLeft className="w-6 h-6" aria-hidden />
            </button>
          )}
          {!isLast && (
            <button
              type="button"
              onClick={() => go(1, last)}
              className="absolute right-0 inset-y-0 w-2/3 flex items-center justify-end pr-2 text-white/0 focus-visible:text-white/80"
              aria-label={t('g.wr.next')}
            >
              <ChevronRight className="w-6 h-6" aria-hidden />
            </button>
          )}
        </div>

        {/* Ações */}
        <div className="px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-2 z-10">
          {isLast ? (
            <>
              <button
                type="button"
                onClick={shareWhatsApp}
                className="pressable w-full min-h-[52px] flex items-center justify-center gap-2 bg-white text-teal-900 font-bold rounded-2xl shadow-float"
              >
                <Share2 className="w-5 h-5" aria-hidden />
                {t('g.wr.share')}
              </button>
              <button
                type="button"
                onClick={() => { setDir(-1); setStep(0); void hapticLight() }}
                className="w-full min-h-[44px] flex items-center justify-center gap-1.5 text-white/90 hover:text-white text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" aria-hidden />
                {t('g.wr.again')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => go(1, last)}
              className="pressable w-full min-h-[52px] flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-2xl border border-white/40"
            >
              {t('g.wr.next')}
            </button>
          )}
        </div>
      </div>
    </MotionConfig>
  )
}
