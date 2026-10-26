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
 *
 * @deprecated Re-renderiza o componente a cada quadro. Use
 * `<AnimatedNumber>` (components/ui/AnimatedNumber), que escreve direto no DOM.
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

// ── Tokens de motion (framer-motion) ─────────────────────────────────────
// Curtos e com função: nada passa de ~400 ms. Use com <MotionConfig
// reducedMotion="user"> (o TutorShell já envolve as telas do tutor).

/** Durações em segundos (framer usa segundos). */
export const dur = { micro: 0.12, fast: 0.18, base: 0.22, slow: 0.32 }

/** Desaceleração padrão do app — rápida no começo, assenta suave. */
export const easeOut = [0.2, 0.8, 0.2, 1] as const

export const spring = {
  /** Pílulas, folhas, trocas de aba: chega rápido, sem quicar. */
  snappy: { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.8 },
  /** Anel de proteção, cartões. */
  soft: { type: 'spring' as const, stiffness: 300, damping: 30 },
  /** Selos, check de sucesso: um leve "pop". */
  pop: { type: 'spring' as const, stiffness: 420, damping: 22 },
}

export const variants = {
  fadeUp: { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } },
  scaleIn: { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1 } },
  stagger: (gap = 0.05) => ({ hidden: {}, show: { transition: { staggerChildren: gap } } }),
  sheet: { hidden: { y: '100%' }, show: { y: 0 }, exit: { y: '100%' } },
}

/**
 * Coreografia de entrada do Início em 4 tempos: cabeçalho → cartões de pet
 * (escalonados) → lista → ação principal por último. Use só na primeira
 * visita da sessão (useFirstVisit), senão a tela "dança" a cada volta.
 */
export const homeChoreo = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } } },
  item: { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: spring.soft } },
  cta: { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { ...spring.soft, delay: 0.28 } } },
}

/**
 * True só na primeira vez que a chave é vista nesta sessão (sessionStorage
 * 'pl_seen_<key>'). Decide uma vez por montagem; sem storage, devolve false
 * (melhor não animar do que animar sempre).
 */
export function useFirstVisit(key: string): boolean {
  const [first] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const k = `pl_seen_${key}`
      if (sessionStorage.getItem(k)) return false
      sessionStorage.setItem(k, '1')
      return true
    } catch {
      return false
    }
  })
  return first
}

// ── Direção da navegação (transição de tela) ─────────────────────────────
export type NavDirection = 'forward' | 'back'

let _navDirection: NavDirection = 'forward'

/** Marque 'back' antes de router.back()/push de "voltar" — a próxima tela entra pela esquerda. */
export function setNavDirection(d: NavDirection): void {
  _navDirection = d
}

/** Lê a direção da navegação em curso e volta para 'forward'. */
export function consumeNavDirection(): NavDirection {
  const d = _navDirection
  _navDirection = 'forward'
  return d
}

/** Lê a direção sem consumir (para render; consuma depois num efeito). */
export function peekNavDirection(): NavDirection {
  return _navDirection
}
