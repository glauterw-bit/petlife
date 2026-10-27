'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, m, useReducedMotion, type Transition, type Variants } from 'framer-motion'

/**
 * Movimento do PetLife Clínica. Tudo curto (até 320 ms), nada bloqueia o
 * clique, e o CrmShell envolve o app em <MotionConfig reducedMotion="user">.
 */
export const dur = { fast: 0.12, base: 0.2, slow: 0.32 }
export const ease = { out: [0.16, 1, 0.3, 1] as const, inOut: [0.65, 0, 0.35, 1] as const }
export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 } as Transition,
  soft: { type: 'spring', stiffness: 300, damping: 32 } as Transition,
}

const easeOut = ease.out as unknown as [number, number, number, number]

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: easeOut } },
}
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.base, ease: easeOut } },
}
export const listStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
}
export const pressable = { whileTap: { scale: 0.97 }, transition: { duration: 0.12 } }
export const slideDay: Variants = {
  enter: (dir: number) => ({ x: 24 * (dir || 0), opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: dur.base, ease: easeOut } },
  exit: (dir: number) => ({ x: -24 * (dir || 0), opacity: 0, transition: { duration: dur.fast, ease: easeOut } }),
}

export function MotionList({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'ul' | 'div' | 'ol' }) {
  const C = as === 'ul' ? m.ul : as === 'ol' ? m.ol : m.div
  return <C className={className} variants={listStagger} initial="hidden" animate="show">{children}</C>
}

export function MotionItem({ children, className, index = 0, as = 'div', layout, onClick }: {
  children: ReactNode; className?: string; index?: number; as?: 'li' | 'div'; layout?: boolean; onClick?: () => void
}) {
  const C = as === 'li' ? m.li : m.div
  const delay = index > 12 ? 0 : Math.min(index, 12) * 0.03
  return (
    <C
      className={className}
      layout={layout}
      onClick={onClick}
      initial="hidden"
      animate="show"
      variants={{ hidden: fadeUp.hidden, show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: easeOut, delay } } }}
    >
      {children}
    </C>
  )
}

const defaultFmt = (n: number) => Math.round(n).toLocaleString('pt-BR')

export function AnimatedNumber({ value, format = defaultFmt, className }: { value: number; format?: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion()
  const prev = useRef<number | null>(null)
  const [shown, setShown] = useState<number>(reduce ? value : prev.current ?? 0)
  useEffect(() => {
    const from = prev.current ?? 0
    prev.current = value
    if (reduce || !Number.isFinite(value) || from === value) { setShown(value); return }
    const controls = animate(from, value, { duration: 0.6, ease: easeOut, onUpdate: v => setShown(v) })
    return () => controls.stop()
  }, [value, reduce])
  return <span className={`tabular-nums ${className ?? ''}`}>{format(shown)}</span>
}

export function CheckBurst({ size = 56 }: { size?: number }) {
  return (
    <m.svg width={size} height={size} viewBox="0 0 52 52" aria-hidden initial="hidden" animate="show" className="text-primary-500">
      <m.circle
        cx="26" cy="26" r="23" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { duration: dur.slow, ease: easeOut } } }}
      />
      <m.path
        d="M15 27 l7 7 l15 -16" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: dur.base, ease: easeOut, delay: 0.12 } } }}
      />
    </m.svg>
  )
}

export function PageTransition({ children }: { children: ReactNode }) {
  return <m.div variants={fadeUp} initial="hidden" animate="show">{children}</m.div>
}
