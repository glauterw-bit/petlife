'use client'

import { forwardRef, type ReactNode } from 'react'
import { m, type HTMLMotionProps } from 'framer-motion'
import { variants, spring, useFirstVisit } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Revela os filhos (StaggerItem) em cascata curta.
 * Com `once="<nome>"`, a cascata toca só na primeira visita da sessão; nas
 * voltas o conteúdo já aparece no lugar (a tela não "dança" toda vez).
 */
export function Stagger({
  children,
  gap = 0.05,
  className,
  as = 'div',
  once,
}: {
  children: ReactNode
  gap?: number
  className?: string
  as?: 'div' | 'ul'
  once?: string
}) {
  const Comp = as === 'ul' ? m.ul : m.div
  const first = useFirstVisit(once ? `stagger_${once}` : '')
  return (
    <Comp className={className} variants={variants.stagger(gap)} initial={first ? 'hidden' : false} animate="show">
      {children}
    </Comp>
  )
}

export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'li'
}) {
  const Comp = as === 'li' ? m.li : m.div
  return (
    <Comp className={className} variants={variants.fadeUp} transition={spring.soft}>
      {children}
    </Comp>
  )
}

/** Botão com encolhida ao toque (0,97). */
export const Pressable = forwardRef<HTMLButtonElement, HTMLMotionProps<'button'>>(function Pressable(
  { className, type, ...rest },
  ref,
) {
  return (
    <m.button
      ref={ref}
      type={type ?? 'button'}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      className={cn('select-none', className)}
      {...rest}
    />
  )
})
