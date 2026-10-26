'use client'

import { forwardRef, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { variants, spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Revela os filhos (StaggerItem) em cascata curta. */
export function Stagger({
  children,
  gap = 0.05,
  className,
  as = 'div',
}: {
  children: ReactNode
  gap?: number
  className?: string
  as?: 'div' | 'ul'
}) {
  const Comp = as === 'ul' ? motion.ul : motion.div
  return (
    <Comp className={className} variants={variants.stagger(gap)} initial="hidden" animate="show">
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
  const Comp = as === 'li' ? motion.li : motion.div
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
    <motion.button
      ref={ref}
      type={type ?? 'button'}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      className={cn('select-none', className)}
      {...rest}
    />
  )
})
