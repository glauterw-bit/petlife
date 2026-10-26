'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Dog, Cat, PawPrint } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CareState } from '@/lib/care'

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
  pet: { name: string; species?: string; photo_url?: string | null }
  size?: number
  ring?: CareState | null
  className?: string
  priority?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const Icon = pet.species === 'dog' ? Dog : pet.species === 'cat' ? Cat : PawPrint
  const showPhoto = !!pet.photo_url && !broken
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden',
        'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
        ring && cn('ring-[2.5px] ring-offset-2 ring-offset-white dark:ring-offset-surface-900', RING[ring]),
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
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
      ) : (
        <Icon aria-label={pet.name} role="img" style={{ width: size * 0.48, height: size * 0.48 }} strokeWidth={1.9} />
      )}
    </span>
  )
}
