'use client'

/**
 * Número que conta até o valor ao entrar na tela (peso, distância, contagens).
 *
 * Escreve direto em ref.textContent via animate() do framer — sem setState a
 * cada quadro, então o componente pai não re-renderiza durante a animação.
 * Com "reduzir movimento" mostra o valor final na hora. Formatação no idioma
 * ativo (localeTag) com algarismos tabulares, para o número não "tremer".
 */
import { useEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'framer-motion'
import { cn, localeTag } from '@/lib/utils'
import { easeOut } from '@/lib/motion'

export interface AnimatedNumberProps {
  value: number
  decimals?: number
  suffix?: string
  className?: string
}

function fmt(n: number, decimals: number, suffix?: string): string {
  let s: string
  try {
    s = n.toLocaleString(localeTag(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  } catch {
    s = n.toFixed(decimals)
  }
  return suffix ? `${s}${suffix}` : s
}

export function AnimatedNumber({ value, decimals = 0, suffix, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const reduced = useReducedMotion()
  const shown = useRef<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = Number.isFinite(value) ? value : 0
    if (reduced || !inView) {
      // Fora da tela ainda: deixa o valor final no DOM (leitor de tela e
      // capturas leem certo) mas só marca como "mostrado" quando animar.
      el.textContent = fmt(target, decimals, suffix)
      if (reduced) shown.current = target
      return
    }
    const from = shown.current ?? 0
    if (from === target) {
      el.textContent = fmt(target, decimals, suffix)
      return
    }
    el.textContent = fmt(from, decimals, suffix)
    const controls = animate(from, target, {
      duration: 0.6,
      ease: easeOut as unknown as [number, number, number, number],
      onUpdate: v => {
        el.textContent = fmt(v, decimals, suffix)
      },
      onComplete: () => {
        shown.current = target
      },
    })
    return () => {
      controls.stop()
      shown.current = target
    }
  }, [value, decimals, suffix, reduced, inView])

  return (
    <span ref={ref} className={cn('tabular-nums', className)} aria-live="off">
      {fmt(Number.isFinite(value) ? value : 0, decimals, suffix)}
    </span>
  )
}

export default AnimatedNumber
