'use client'

import { useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import type { CareKind, PetCareSummary } from '@/lib/care'
import { homeChoreo } from '@/lib/motion'
import { haptic } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'
import { cn } from '@/lib/utils'
import { PetHero } from '@/components/pets/PetHero'

/**
 * Herói do Início: um slide por pet (o pior primeiro), em carrossel com
 * scroll-snap. Cada slide traz o Anel de proteção e uma única próxima ação.
 *
 * `choreo` (só na 1ª visita da sessão): entrada em 4 tempos — a saudação já
 * está no cabeçalho, o cartão sobe 8 px, os arcos se desenham e o botão chega
 * por último. Nas visitas seguintes nada anima (nem os arcos).
 */
export function HomeHero({
  summaries,
  pulse,
  onRegister,
  choreo = false,
  onStreak,
  onPhotoChanged,
}: {
  choreo?: boolean
  onStreak?: (petId: number, streak: number) => void
  onPhotoChanged?: () => void
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

  // "Anel completo": quando um pet passa de alguma pendência para os 3 itens
  // em dia (no mesmo pet montado, nunca na 1ª renderização), anuncia por texto
  // — o brilho e a vibração ficam no ProtectionRing. Mesma regra do anel.
  const [announce, setAnnounce] = useState('')
  const prevStates = useRef<Map<number, string> | null>(null)
  const stateKey = summaries.map(s => `${s.pet.id}:${s.items.map(i => i.state).join('|')}`).join(',')
  useEffect(() => {
    const next = new Map(summaries.map(s => [s.pet.id, s.items.map(i => i.state).join('|')]))
    const prev = prevStates.current
    prevStates.current = next
    if (!prev) return
    const done = summaries.find(s => {
      const before = prev.get(s.pet.id)
      return before != null && before.split('|').some(x => x !== 'ok') && s.items.every(i => i.state === 'ok')
    })
    if (!done) return
    setAnnounce(t('home2.ringDone', { name: done.pet.name }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey])
  useEffect(() => {
    if (!announce) return
    const id = setTimeout(() => setAnnounce(''), 4000)
    return () => clearTimeout(id)
  }, [announce])

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
            if (prev !== idx && !first.current) haptic('toggle')
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

  const heroProps = (s: PetCareSummary) => ({
    summary: s,
    pulseKind: pulse?.petId === s.pet.id ? pulse.kind : undefined,
    onRegister,
    animateRing: choreo,
    choreo,
    onStreak,
    onPhotoChanged,
  })

  return (
    <m.section
      aria-label={t('home.hero.carouselAria')}
      initial={choreo ? 'hidden' : false}
      animate="show"
      variants={homeChoreo.container}
      className="mb-5"
    >
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {multi ? (
        <div
          ref={scroller}
          data-scroll-x
          className="no-scrollbar -mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 md:overflow-visible"
        >
          {summaries.map((s, i) => (
            <m.div
              key={s.pet.id}
              variants={homeChoreo.item}
              ref={el => { slides.current[i] = el }}
              data-idx={i}
              className="snap-start shrink-0 basis-[88%] md:basis-auto"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${summaries.length}: ${s.pet.name}`}
            >
              <PetHero {...heroProps(s)} />
            </m.div>
          ))}
        </div>
      ) : (
        summaries[0] && (
          <m.div variants={homeChoreo.item}>
            <PetHero {...heroProps(summaries[0])} />
          </m.div>
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
              {/* Só transform e cor animam (scaleX), nunca a largura. */}
              <span
                className={cn(
                  'block w-2 h-2 rounded-full transition-[transform,background-color] duration-200 ease-out motion-reduce:transition-none',
                  i === active ? 'scale-x-[2.5] bg-primary-700 dark:bg-primary-300' : 'scale-x-100 bg-surface-300 dark:bg-surface-600',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </m.section>
  )
}
