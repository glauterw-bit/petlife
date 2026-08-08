'use client'

import { Trophy, Play, CheckCircle, Clock, Star } from 'lucide-react'
import { type Challenge, type UserChallenge } from '@/lib/api'
import { getDifficultyLabel, getDifficultyColor, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ChallengeCardProps {
  challenge: Challenge
  userChallenge?: UserChallenge
  onStart?: (challengeId: number) => void
  onComplete?: (userChallengeId: number) => void
  loading?: boolean
}

const categoryIcons: Record<string, string> = {
  health: '🏥',
  exercise: '🏃',
  nutrition: '🥗',
  grooming: '✂️',
  training: '🎓',
  social: '🤝',
  default: '⭐',
}

export function ChallengeCard({ challenge, userChallenge, onStart, onComplete, loading }: ChallengeCardProps) {
  const catIcon = categoryIcons[challenge.category] ?? categoryIcons.default
  const diffColor = getDifficultyColor(challenge.difficulty)
  const diffLabel = getDifficultyLabel(challenge.difficulty)

  const isActive = userChallenge?.status === 'active'
  const isCompleted = userChallenge?.status === 'completed'
  const progress = userChallenge?.progress ?? 0

  return (
    <div
      className={cn(
        'bg-white dark:bg-surface-800 rounded-2xl border p-5 transition-all hover:shadow-md',
        isCompleted ? 'border-green-200 bg-green-50/30' : 'border-surface-100 dark:border-surface-700 hover:border-primary-200',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-surface-50 dark:bg-surface-900/60 flex items-center justify-center text-2xl shrink-0">
          {catIcon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-surface-900 dark:text-white leading-tight">{challenge.title}</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">{challenge.description}</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full border', diffColor)}>
          {diffLabel}
        </span>
        <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-accent-50 text-accent-700 border border-accent-200">
          <Star className="w-3 h-3" />
          {challenge.points} pts
        </span>
        {challenge.duration_days && (
          <span className="flex items-center gap-1 text-xs text-surface-500 dark:text-surface-400 px-2.5 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700">
            <Clock className="w-3 h-3" />
            {challenge.duration_days} dias
          </span>
        )}
      </div>

      {/* Requirements */}
      {challenge.requirements && challenge.requirements.length > 0 && (
        <ul className="mb-3 space-y-0.5">
          {challenge.requirements.map((req, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-surface-600 dark:text-surface-300">
              <span className="w-1 h-1 rounded-full bg-surface-400" />
              {req}
            </li>
          ))}
        </ul>
      )}

      {/* Progress bar for active */}
      {isActive && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400 mb-1">
            <span>Progresso</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-surface-200 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Completed info */}
      {isCompleted && userChallenge?.completed_at && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 mb-3">
          <CheckCircle className="w-3.5 h-3.5" />
          Concluído em {formatDate(userChallenge.completed_at)}
        </div>
      )}

      {/* Action */}
      {!isCompleted && (
        <button
          disabled={loading}
          onClick={() => {
            if (isActive && userChallenge) {
              onComplete?.(userChallenge.id)
            } else {
              onStart?.(challenge.id)
            }
          }}
          className={cn(
            'w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
            isActive
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-primary-500 text-white hover:bg-primary-600',
            loading && 'opacity-60 cursor-not-allowed'
          )}
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isActive ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Concluir desafio
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              {userChallenge?.status === 'failed' ? 'Tentar novamente' : 'Iniciar desafio'}
            </>
          )}
        </button>
      )}

      {isCompleted && (
        <div className="flex items-center justify-center gap-2 py-2 text-green-600 font-semibold text-sm">
          <Trophy className="w-5 h-5" />
          Desafio concluído! +{challenge.points} pts
        </div>
      )}
    </div>
  )
}
