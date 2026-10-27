'use client'

import { m } from 'framer-motion'
import { spring } from '@/lib/motion'

/** Círculo verde com o check sendo desenhado (≈ 320 ms). */
export function SuccessCheck({ size = 72, label }: { size?: number; label?: string }) {
  return (
    <div className="inline-flex flex-col items-center gap-2" role={label ? 'status' : undefined}>
      <m.svg
        width={size}
        height={size}
        viewBox="0 0 52 52"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.pop}
        aria-hidden
      >
        <circle cx="26" cy="26" r="25" className="fill-emerald-500 dark:fill-emerald-400" />
        <m.path
          d="M15 27 l7.5 7.5 L37.5 18.5"
          fill="none"
          stroke="white"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:stroke-surface-950"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1], delay: 0.08 }}
        />
      </m.svg>
      {label && <span className="text-sm font-semibold text-surface-800 dark:text-surface-100">{label}</span>}
    </div>
  )
}
