'use client'

/**
 * Motion system base do PetLife.
 * Hooks e helpers de animação que respeitam prefers-reduced-motion.
 * Durações seguindo Apple HIG: micro 150-250ms, transição 300-400ms.
 */
import { useEffect, useRef, useState } from 'react'

/** True se o usuário pediu menos movimento (acessibilidade). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

// easing "ease-out-expo" — sensação premium de desaceleração
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

/**
 * Anima um número de 0 (ou `from`) até `to`. Retorna o valor corrente.
 * Usado em peso, distância, score, kcal — nunca aparecem prontos.
 */
export function useCountUp(
  to: number,
  opts: { durationMs?: number; from?: number; decimals?: number; startWhen?: boolean } = {},
): number {
  const { durationMs = 900, from = 0, decimals = 0, startWhen = true } = opts
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(reduced ? to : from)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (reduced || !startWhen) {
      setValue(to)
      return
    }
    startRef.current = null
    const factor = Math.pow(10, decimals)

    function tick(ts: number) {
      if (startRef.current == null) startRef.current = ts
      const elapsed = ts - startRef.current
      const p = Math.min(1, elapsed / durationMs)
      const eased = easeOutExpo(p)
      const current = from + (to - from) * eased
      setValue(Math.round(current * factor) / factor)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, durationMs, from, decimals, startWhen, reduced])

  return value
}

/**
 * Dispara `true` uma vez quando o elemento entra na viewport.
 * Pra animar quando aparece (scroll reveal, count-up on view).
 */
export function useInView<T extends Element>(opts: IntersectionObserverInit = { threshold: 0.3 }): {
  ref: React.RefObject<T>
  inView: boolean
} {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        obs.disconnect()
      }
    }, opts)
    obs.observe(el)
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { ref, inView }
}

/** Cor/label semânticos por status de dimensão (consistência visual). */
export const STATUS_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  great: { ring: '#10b981', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  good: { ring: '#22c55e', text: 'text-green-600', bg: 'bg-green-50' },
  warn: { ring: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50' },
  bad: { ring: '#ef4444', text: 'text-red-600', bg: 'bg-red-50' },
}

/** Cor do anel do score por tier. */
export function scoreColor(score: number): string {
  if (score >= 80) return '#10b981' // verde
  if (score >= 60) return '#22c55e'
  if (score >= 40) return '#f59e0b' // amber
  return '#ef4444' // vermelho
}
