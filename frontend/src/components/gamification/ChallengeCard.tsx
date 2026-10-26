'use client'

import {
  Play, Check, Clock, Star, Syringe, HeartPulse, BellRing, Pill, Scale, Footprints, Salad, Scissors, GraduationCap, Users, ShieldCheck, Camera, Trophy,
  Loader2, type LucideIcon,
} from 'lucide-react'
import { type Challenge, type UserChallenge } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { buttonClasses } from '@/components/ui/Button'
import { useChallengeText } from './challengeText'

interface ChallengeCardProps {
  challenge: Challenge
  userChallenge?: UserChallenge
  onStart?: (challengeId: number) => void
  onComplete?: (userChallengeId: number) => void
  loading?: boolean
}

/** Minúsculas e sem acento: a API manda categoria/dificuldade em pt ("saúde", "fácil") ou en. */
export function normKey(s: string | undefined | null): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export type CategoryId = 'health' | 'walks' | 'nutrition' | 'grooming' | 'training' | 'social' | 'safety' | 'profile' | 'other'

const CATEGORY_ALIASES: Record<string, CategoryId> = {
  saude: 'health', health: 'health', salud: 'health',
  passeio: 'walks', passeios: 'walks', exercise: 'walks', exercicio: 'walks', walk: 'walks', walks: 'walks', paseo: 'walks',
  nutricao: 'nutrition', nutrition: 'nutrition', alimentacao: 'nutrition', nutricion: 'nutrition',
  higiene: 'grooming', grooming: 'grooming', banho: 'grooming', 'banho e tosa': 'grooming',
  treino: 'training', training: 'training', adestramento: 'training', entrenamiento: 'training',
  social: 'social', engajamento: 'social', engagement: 'social', comunidade: 'social',
  seguranca: 'safety', safety: 'safety', seguridad: 'safety',
  perfil: 'profile', profile: 'profile',
}

export const CATEGORY_ORDER: CategoryId[] = ['health', 'walks', 'safety', 'nutrition', 'grooming', 'training', 'profile', 'social', 'other']

/** Um ícone por categoria, para o tutor reconhecer o tipo de desafio sem ler. */
export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  health: Syringe,
  walks: Footprints,
  nutrition: Salad,
  grooming: Scissors,
  training: GraduationCap,
  social: Users,
  safety: ShieldCheck,
  profile: Camera,
  other: Trophy,
}

/** Ícone do desafio: dentro de Saúde, o tema do desafio (vacina, lembrete,
 *  vermífugo, peso) ganha o próprio ícone; o resto usa o da categoria. */
export function challengeIcon(c: Challenge): LucideIcon {
  const cat = categoryOf(c)
  if (cat !== 'health') return CATEGORY_ICONS[cat]
  const k = normKey(`${c.title ?? ''} ${c.description ?? ''}`)
  if (/vacin|vaccin|antirrab|rabies/.test(k)) return Syringe
  if (/lembrete|reminder|recordatorio/.test(k)) return BellRing
  if (/vermif|deworm|desparasit|antipulga|flea|pulga/.test(k)) return Pill
  if (/peso|weight|pesar|pesagem/.test(k)) return Scale
  return HeartPulse
}

export function categoryOf(c: Challenge): CategoryId {
  return CATEGORY_ALIASES[normKey(c.category)] ?? 'other'
}

type Diff = 'easy' | 'medium' | 'hard' | 'legendary'
const DIFF_ALIASES: Record<string, Diff> = {
  easy: 'easy', facil: 'easy',
  medium: 'medium', medio: 'medium',
  hard: 'hard', dificil: 'hard',
  legendary: 'legendary', lendario: 'legendary', legendario: 'legendary',
}
// fácil = verde, médio = âmbar, difícil = vermelho (com par escuro via .chip-*)
const DIFF_CHIP: Record<Diff, string> = {
  easy: 'chip-success',
  medium: 'chip-warning',
  hard: 'chip-danger',
  legendary: 'chip-danger',
}

export function difficultyOf(c: Challenge): Diff | null {
  return DIFF_ALIASES[normKey(c.difficulty)] ?? null
}

export function ChallengeCard({ challenge, userChallenge, onStart, onComplete, loading }: ChallengeCardProps) {
  const t = useT()
  const text = useChallengeText()
  const title = text.title(challenge)
  const cat = categoryOf(challenge)
  const Icon = challengeIcon(challenge)
  const diff = difficultyOf(challenge)

  const isActive = userChallenge?.status === 'in_progress'
  const isCompleted = userChallenge?.status === 'completed'
  const progress = userChallenge?.progress ?? 0
  // Só mostra barra quando a API traz progresso parcial de verdade.
  const showProgress = isActive && progress > 0 && progress < 100

  return (
    <article
      className={cn(
        'h-full rounded-2xl border p-4 flex flex-col',
        isCompleted
          ? 'tone-success-bg'
          : 'bg-white dark:bg-surface-900 border-surface-200/70 dark:border-surface-800',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
            isCompleted
              ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-surface-950'
              : 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
          )}
        >
          {isCompleted ? <Check className="w-5 h-5" strokeWidth={2.6} aria-hidden /> : <Icon className="w-5 h-5" aria-hidden />}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-surface-900 dark:text-white leading-tight">{title}</h3>
          <p className="text-sm text-surface-600 dark:text-surface-400 mt-0.5 line-clamp-2">{text.desc(challenge)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {diff ? (
          <span className={cn('chip', DIFF_CHIP[diff])}>{t(`wk.diff.${diff}`)}</span>
        ) : challenge.difficulty ? (
          <span className="chip chip-neutral">{challenge.difficulty}</span>
        ) : null}
        <span className="chip chip-neutral">
          <Star className="w-3 h-3" aria-hidden />
          {t('wk.ch.pts', { n: challenge.points })}
        </span>
        {challenge.duration_days ? (
          <span className="chip chip-neutral">
            <Clock className="w-3 h-3" aria-hidden />
            {challenge.duration_days === 1 ? t('wk.ch.dayOne') : t('wk.ch.days', { n: challenge.duration_days })}
          </span>
        ) : null}
      </div>

      {challenge.requirements && challenge.requirements.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {challenge.requirements.map((req, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-surface-600 dark:text-surface-300">
              <span className="w-1 h-1 rounded-full bg-surface-400" aria-hidden />
              {req}
            </li>
          ))}
        </ul>
      )}

      {showProgress && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-surface-600 dark:text-surface-400 mb-1">
            <span>{t('g.gam.cardProgress')}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div
            className="w-full bg-surface-200 dark:bg-surface-800 rounded-full h-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={title}
          >
            <div className="bg-primary-600 dark:bg-primary-400 h-2 rounded-full transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="mt-auto pt-3">
        {isCompleted ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            <Check className="w-4 h-4" strokeWidth={2.6} aria-hidden />
            {userChallenge?.completed_at
              ? t('wk.ch.doneOn', { date: formatDate(userChallenge.completed_at) })
              : t('wk.ch.done')}
          </p>
        ) : (
          <button
            type="button"
            disabled={loading}
            aria-busy={loading || undefined}
            onClick={() => {
              if (isActive && userChallenge) onComplete?.(userChallenge.id)
              else onStart?.(challenge.id)
            }}
            className={buttonClasses(isActive ? 'primary' : 'soft', 'md', true)}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : isActive ? (
              <Check className="w-4 h-4" strokeWidth={2.6} aria-hidden />
            ) : (
              <Play className="w-4 h-4" aria-hidden />
            )}
            {isActive
              ? t('g.gam.cardComplete')
              : userChallenge?.status === 'not_started' ? t('g.gam.cardRetry') : t('g.gam.cardStart')}
          </button>
        )}
      </div>
    </article>
  )
}
