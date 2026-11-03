'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { CareState } from '@/lib/care'
import { petColor } from '@/lib/petColor'

const RING: Record<CareState, string> = {
  ok: 'ring-emerald-500',
  soon: 'ring-amber-500',
  overdue: 'ring-red-500',
  never: 'ring-surface-300 dark:ring-surface-600',
}

export function PetAvatar({
  pet,
  size = 48,
  ring = null,
  className,
  priority = false,
}: {
  pet: { id?: number; name: string; species?: string; photo_url?: string | null; theme_color?: string | null }
  size?: number
  ring?: CareState | null
  className?: string
  priority?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const color = petColor(pet)
  const showPhoto = !!pet.photo_url && !broken
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden',
        'text-white',
        ring && cn('ring-[2.5px] ring-offset-2 ring-offset-white dark:ring-offset-surface-900', RING[ring]),
        className,
      )}
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {showPhoto ? (
        <>
        <Image
          src={pet.photo_url as string}
          alt={pet.name}
          fill
          sizes={`${size}px`}
          unoptimized
          priority={priority}
          className="object-cover"
          onError={() => setBroken(true)}
        />
        {/* borda fina na cor do pet, por cima da foto */}
        <span aria-hidden className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${color}` }} />
        </>
      ) : (
        <span aria-label={pet.name} role="img" className="font-display font-extrabold leading-none" style={{ fontSize: size * 0.46 }}>
          {Array.from(pet.name.trim())[0]?.toUpperCase() ?? '?'}
        </span>
      )}
    </span>
  )
}
