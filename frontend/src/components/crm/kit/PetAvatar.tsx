'use client'

import { SpeciesIcon } from '../ui'

const TONES = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
]
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function initials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const a = parts[0][0] || ''
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || ''
  return (a + b).toUpperCase()
}

const PET = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm', xl: 'h-14 w-14 text-base' }
const BADGE = { sm: 'h-3.5 w-3.5 [&>svg]:w-2.5 [&>svg]:h-2.5', md: 'h-4 w-4 [&>svg]:w-2.5 [&>svg]:h-2.5', lg: 'h-5 w-5 [&>svg]:w-3 [&>svg]:h-3', xl: 'h-6 w-6 [&>svg]:w-3.5 [&>svg]:h-3.5' }

export function PetAvatar({ name, species, size = 'md' }: { name: string; species?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-bold ${PET[size]} ${TONES[hash(name || '') % TONES.length]}`} aria-hidden>
      {initials(name)}
      {species && (
        <span className={`absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-panel text-muted ring-2 ring-panel ${BADGE[size]}`}>
          <SpeciesIcon species={species} />
        </span>
      )}
    </span>
  )
}

const PERSON = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' }
export function PersonAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-panel-2 text-ink/80 font-semibold ring-1 ring-line ${PERSON[size]}`}>
      {initials(name)}
    </span>
  )
}
