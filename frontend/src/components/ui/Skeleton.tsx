import { cn } from '@/lib/utils'

/**
 * Classe para a troca esqueleto → conteúdo: fade de 180 ms (sem movimento;
 * desligada com "reduzir movimento"). Ex.: <div className={FADE_IN}>…</div>
 */
export const FADE_IN = 'animate-fade-in'

interface SkeletonProps {
  className?: string
}

/**
 * Bloco de carregamento com brilho suave (shimmer). O brilho é um ::after
 * movido por transform (compositor). Com "reduzir movimento", o brilho some e
 * fica só o bloco (regra global em globals.css).
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={cn('skeleton rounded-xl', className)} />
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/70 dark:border-surface-800 p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <SkeletonHero />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
      <div className="space-y-2">
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  )
}

/** Linhas de texto; a última é mais curta. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3 rounded-md', i === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  )
}

/** Avatar + 2 linhas — formato de item de lista. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800" aria-hidden>
      <Skeleton className="w-11 h-11 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/2 rounded-md" />
        <Skeleton className="h-3 w-1/3 rounded-md" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}

/** Herói: círculo de 132 px (anel) + 3 linhas + botão. */
export function SkeletonHero() {
  return (
    <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 p-5" aria-hidden>
      <div className="flex flex-col items-center text-center gap-4">
        <Skeleton className="w-[132px] h-[132px] rounded-full" />
        <div className="w-full flex flex-col items-center gap-2">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-3 w-48 rounded-md" />
          <Skeleton className="h-3 w-40 rounded-md" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  )
}

/** Bloco quadrado de atalho/estatística. */
export function SkeletonTile() {
  return (
    <div className="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 p-4 space-y-3" aria-hidden>
      <Skeleton className="w-9 h-9 rounded-xl" />
      <Skeleton className="h-3.5 w-2/3 rounded-md" />
      <Skeleton className="h-3 w-1/2 rounded-md" />
    </div>
  )
}

/** Esqueleto do shell enquanto a sessão carrega: cabeçalho + herói + 3 linhas. */
export function ShellSkeleton({ label }: { label?: string }) {
  return (
    <div className="min-h-dvh bg-surface-50 dark:bg-surface-950" role="status" aria-busy="true">
      {label && <span className="sr-only">{label}</span>}
      <div className="w-full max-w-7xl mx-auto px-4 pt-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] md:p-8 md:ml-64 md:max-w-[calc(100%-16rem)]">
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-7 w-44 rounded-lg" />
          </div>
          <Skeleton className="w-11 h-11 rounded-xl" />
        </div>
        <SkeletonHero />
        <div className="mt-5 space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    </div>
  )
}
