'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { CareKind, PetCareSummary } from '@/lib/care'
import { variants, spring } from '@/lib/motion'
import { hapticSelect } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'
import { cn } from '@/lib/utils'
import { PetHero } from '@/components/pets/PetHero'

/**
 * Herói do Início: um slide por pet (o pior primeiro), em carrossel com
 * scroll-snap. Cada slide traz o Anel de proteção e uma única próxima ação.
 */
export function HomeHero({
  summaries,
  pulse,
  onRegister,
}: {
  summaries: PetCareSummary[]
  /** Arco que acabou de ser registrado — o anel daquele pet "cresce". */
  pulse?: { petId: number; kind: CareKind } | null
  onRegister: (petId: number, kind: 'vermifugo' | 'antipulgas') => void
}) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const slides = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(0)
  const first = useRef(true)
  const multi = summaries.length > 1

  // Slide visível → pontos + vibração leve ao trocar.
  useEffect(() => {
    const root = scroller.current
    if (!multi || !root || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const idx = Number((e.target as HTMLElement).dataset.idx)
          setActive(prev => {
            if (prev !== idx && !first.current) void hapticSelect()
            return idx
          })
        }
        first.current = false
      },
      { root, threshold: 0.6 },
    )
    slides.current.forEach(el => el && io.observe(el))
    return () => io.disconnect()
  }, [multi, summaries.length])

  function goTo(i: number) {
    const el = slides.current[i]
    const root = scroller.current
    if (!el || !root) return
    root.scrollTo({ left: el.offsetLeft - root.offsetLeft - 16, behavior: 'smooth' })
  }

  return (
    <motion.section
      aria-label={t('home.hero.carouselAria')}
      initial="hidden"
      animate="show"
      variants={variants.scaleIn}
      transition={spring.snappy}
      className="mb-5"
    >
      {multi ? (
        <div
          ref={scroller}
          data-scroll-x
          className="no-scrollbar -mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 md:overflow-visible"
        >
          {summaries.map((s, i) => (
            <div
              key={s.pet.id}
              ref={el => { slides.current[i] = el }}
              data-idx={i}
              className="snap-start shrink-0 basis-[88%] md:basis-auto"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${summaries.length}: ${s.pet.name}`}
            >
              <PetHero summary={s} pulseKind={pulse?.petId === s.pet.id ? pulse.kind : undefined} onRegister={onRegister} />
            </div>
          ))}
        </div>
      ) : (
        summaries[0] && (
          <PetHero summary={summaries[0]} pulseKind={pulse?.petId === summaries[0].pet.id ? pulse.kind : undefined} onRegister={onRegister} />
        )
      )}

      {multi && (
        <div className="flex justify-center -mb-2 md:hidden" role="group" aria-label={t('home.hero.dotsAria')}>
          {summaries.map((s, i) => (
            <button
              key={s.pet.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={t('home.hero.dotAria', { name: s.pet.name })}
              aria-current={i === active ? 'true' : undefined}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <span
                className={cn(
                  'block h-2 rounded-full transition-all duration-200',
                  i === active ? 'w-5 bg-primary-700 dark:bg-primary-300' : 'w-2 bg-surface-300 dark:bg-surface-600',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </motion.section>
  )
}
