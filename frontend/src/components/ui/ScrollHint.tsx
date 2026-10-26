'use client'

/**
 * Faixa de rolagem horizontal (carrossel de cartões) com degradê só na borda
 * em que ainda há conteúdo escondido — o mesmo sinal das <Tabs> roláveis:
 * "tem mais para o lado", sem cortar o primeiro/último cartão à toa.
 *
 * Os filhos ficam lado a lado (flex); passe gap/padding por className.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ScrollHint({
  children,
  className,
  ariaLabel,
  as: Comp = 'div',
}: {
  children: ReactNode
  className?: string
  /** Rótulo da região rolável (opcional; útil quando é uma lista de cartões). */
  ariaLabel?: string
  as?: 'div' | 'ul'
}) {
  const ref = useRef<HTMLDivElement & HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const start = el.scrollLeft > 1
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setEdges(prev => (prev.start === start && prev.end === end ? prev : { start, end }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro?.disconnect()
    }
  }, [])

  return (
    <Comp
      ref={ref}
      data-scroll-x=""
      data-fade-start={edges.start ? 'true' : undefined}
      data-fade-end={edges.end ? 'true' : undefined}
      aria-label={ariaLabel}
      role={ariaLabel && Comp === 'div' ? 'region' : undefined}
      className={cn('scroll-fade flex overflow-x-auto no-scrollbar overscroll-x-contain snap-x', className)}
    >
      {children}
    </Comp>
  )
}
