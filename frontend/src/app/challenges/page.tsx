'use client'

import { useEffect, useState } from 'react'
import { Trophy, Star, Medal } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ChallengeCard } from '@/components/gamification/ChallengeCard'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { gamification, type Challenge, type UserChallenge, type LeaderboardEntry, type UserPoints } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { celebrateBadge, hapticMedium, hapticError } from '@/lib/feedback'
import { getLevelName, getBadgeColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Section = 'available' | 'active' | 'completed' | 'leaderboard'

export default function ChallengesPage() {
  const { success, error } = useToast()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [points, setPoints] = useState<UserPoints | null>(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<Section>('available')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [c, uc, lb, pts] = await Promise.allSettled([
          gamification.getChallenges(),
          gamification.getUserChallenges(),
          gamification.getLeaderboard(),
          gamification.getUserPoints(),
        ])
        if (c.status === 'fulfilled') setChallenges(c.value)
        if (uc.status === 'fulfilled') setUserChallenges(uc.value)
        if (lb.status === 'fulfilled') setLeaderboard(lb.value)
        if (pts.status === 'fulfilled') setPoints(pts.value)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  async function handleStart(challengeId: number) {
    setActionLoading(challengeId)
    try {
      const uc = await gamification.startChallenge(challengeId)
      setUserChallenges(prev => [...prev, uc])
      void hapticMedium()
      success('Desafio iniciado! Boa sorte! 🎯')
    } catch (err: unknown) {
      void hapticError()
      error(err instanceof Error ? err.message : 'Erro ao iniciar desafio.')
    } finally { setActionLoading(null) }
  }

  async function handleComplete(userChallengeId: number) {
    setActionLoading(userChallengeId)
    try {
      const uc = await gamification.completeChallenge(userChallengeId)
      setUserChallenges(prev => prev.map(u => u.id === uc.id ? uc : u))
      const pts = await gamification.getUserPoints()
      setPoints(pts)
      celebrateBadge()
      success('Parabéns! Desafio concluído! 🏆')
    } catch (err: unknown) {
      void hapticError()
      error(err instanceof Error ? err.message : 'Erro ao completar desafio.')
    } finally { setActionLoading(null) }
  }

  const activeUC = userChallenges.filter(uc => uc.status === 'active')
  const completedUC = userChallenges.filter(uc => uc.status === 'completed')
  const activeChallengeIds = new Set(activeUC.map(uc => uc.challenge_id))
  const completedChallengeIds = new Set(completedUC.map(uc => uc.challenge_id))

  const availableChallenges = challenges.filter(c => !activeChallengeIds.has(c.id) && !completedChallengeIds.has(c.id))

  const sections: { id: Section; label: string; count?: number }[] = [
    { id: 'available', label: 'Disponíveis', count: availableChallenges.length },
    { id: 'active', label: 'Ativos', count: activeUC.length },
    { id: 'completed', label: 'Concluídos', count: completedUC.length },
    { id: 'leaderboard', label: '🏆 Ranking' },
  ]

  const progressPct = points ? Math.min(100, ((points.total_points % 1000) / 10)) : 0
  const levelName = points ? getLevelName(points.level) : 'Iniciante'

  return (
    <DashboardLayout>
      <div className="mb-5 md:mb-6 pl-12 md:pl-0">
        <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight">Desafios & Gamificação</h1>
        <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">Complete desafios e acumule pontos!</p>
      </div>

      {/* Points banner */}
      {points && (
        <div className="bg-gradient-to-br from-accent-500 to-accent-700 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-4xl font-bold">{points.total_points}</div>
              <div className="text-accent-100 text-sm">pontos totais</div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-semibold">Nível {points.level} — {levelName}</span>
                <span className="text-accent-100">{points.total_points % 1000}/1000 pts</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div className="bg-white dark:bg-surface-800 h-3 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="text-xs text-accent-100 mt-1">
                Faltam {points.points_to_next_level} pts para o próximo nível
              </div>
            </div>
            {points.badges_earned.length > 0 && (
              <div>
                <p className="text-xs text-accent-100 mb-1.5">Badges:</p>
                <div className="flex flex-wrap gap-1">
                  {points.badges_earned.map((b, i) => (
                    <span key={i} className="text-xs bg-white/20 rounded-full px-2.5 py-1 font-medium">{b}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-1.5 mb-6 overflow-x-auto">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap',
              section === s.id ? 'bg-primary-500 text-white' : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/40'
            )}
          >
            {s.label}
            {s.count !== undefined && s.count > 0 && (
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-bold', section === s.id ? 'bg-white/30 text-white' : 'bg-surface-200 text-surface-600 dark:text-surface-300')}>
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : (
        <>
          {section === 'available' && (
            <div>
              {availableChallenges.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
                  <div className="text-5xl mb-3">🎉</div>
                  <p className="font-semibold text-surface-900 dark:text-white mb-1">Todos os desafios iniciados!</p>
                  <p className="text-surface-500 dark:text-surface-400 text-sm">Continue completando para ganhar mais pontos.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {availableChallenges.map(c => (
                    <ChallengeCard
                      key={c.id}
                      challenge={c}
                      onStart={handleStart}
                      loading={actionLoading === c.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'active' && (
            <div>
              {activeUC.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
                  <div className="text-5xl mb-3">🎯</div>
                  <p className="font-semibold text-surface-900 dark:text-white mb-1">Nenhum desafio ativo</p>
                  <p className="text-surface-500 dark:text-surface-400 text-sm">Inicie um desafio na aba "Disponíveis".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeUC.map(uc => {
                    const ch = challenges.find(c => c.id === uc.challenge_id)
                    if (!ch) return null
                    return (
                      <ChallengeCard
                        key={uc.id}
                        challenge={ch}
                        userChallenge={uc}
                        onComplete={handleComplete}
                        loading={actionLoading === uc.id}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {section === 'completed' && (
            <div>
              {completedUC.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
                  <div className="text-5xl mb-3">🏆</div>
                  <p className="font-semibold text-surface-900 dark:text-white mb-1">Nenhum desafio concluído ainda</p>
                  <p className="text-surface-500 dark:text-surface-400 text-sm">Complete seus desafios ativos para ver aqui!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {completedUC.map(uc => {
                    const ch = challenges.find(c => c.id === uc.challenge_id)
                    if (!ch) return null
                    return <ChallengeCard key={uc.id} challenge={ch} userChallenge={uc} />
                  })}
                </div>
              )}
            </div>
          )}

          {section === 'leaderboard' && (
            <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-surface-100 dark:border-surface-700 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-accent-500" />
                <h2 className="font-bold text-surface-900 dark:text-white">Ranking de Tutores</h2>
              </div>
              {leaderboard.length === 0 ? (
                <div className="text-center py-12 text-surface-400">
                  <p>Ranking não disponível.</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-100">
                  {leaderboard.slice(0, 10).map((entry, i) => (
                    <div key={entry.user_id} className={cn('flex items-center gap-4 px-6 py-4', i < 3 && 'bg-gradient-to-r from-accent-50/50 to-transparent')}>
                      <div className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm',
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-surface-200 text-surface-700 dark:text-surface-200' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300'
                      )}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : entry.rank}
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center font-bold text-primary-700 shrink-0">
                        {entry.user_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-surface-900 dark:text-white">{entry.user_name}</div>
                        <div className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mt-0.5', getBadgeColor(entry.level))}>
                          <Medal className="w-3 h-3" />
                          {getLevelName(entry.level)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-accent-700">
                        <Star className="w-4 h-4" />
                        {entry.points.toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
