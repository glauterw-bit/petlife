'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Trophy, Star, Medal, Target, ChevronDown, Sparkles, Users, Play, Syringe, Check } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  ChallengeCard, categoryOf, difficultyOf, CATEGORY_ORDER, CATEGORY_ICONS, type CategoryId,
} from '@/components/gamification/ChallengeCard'
import { gamification, vaccines as vaccinesApi, type Challenge, type UserChallenge, type LeaderboardEntry, type UserPoints, type Vaccine } from '@/lib/api'
import { challengeSlug, useChallengeText } from '@/components/gamification/challengeText'
import { useCached } from '@/lib/cache'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/ToastContext'
import { celebrate, haptic } from '@/lib/feedback'
import { getBadgeColor, localeTag, cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton, SkeletonTile } from '@/components/ui/Skeleton'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import { dur, easeOut } from '@/lib/motion'

/** Mesma escada de níveis de getLevelName(), traduzida. */
const LEVEL_KEYS = [
  'g.gam.level1', 'g.gam.level2', 'g.gam.level3', 'g.gam.level4', 'g.gam.level5',
  'g.gam.level6', 'g.gam.level7', 'g.gam.level8', 'g.gam.level9', 'g.gam.level10',
]
const levelKey = (level: number) => LEVEL_KEYS[Math.min(level - 1, LEVEL_KEYS.length - 1)] ?? LEVEL_KEYS[0]

const DIFF_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2, legendary: 3 }

export default function ChallengesPage() {
  const t = useT()
  const text = useChallengeText()
  const { success, error } = useToast()
  // Mesma chave/formato de app/health/vaccines e pets/useCareData (lista inteira).
  const vaccinesQ = useCached<Vaccine[]>('vaccines', () => vaccinesApi.list())
  const hasVaccine = (vaccinesQ.data?.length ?? 0) > 0
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null)
  const [points, setPoints] = useState<UserPoints | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [rankingLoading, setRankingLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const [event, setEvent] = useState<Awaited<ReturnType<typeof gamification.getEvent>> | null>(null)
  useEffect(() => { gamification.getEvent().then(setEvent).catch(() => {}) }, [])
  useEffect(() => {
    async function load() {
      try {
        const [c, uc, pts] = await Promise.allSettled([
          gamification.getChallenges(),
          gamification.getUserChallenges(),
          gamification.getUserPoints(),
        ])
        if (c.status === 'fulfilled') setChallenges(c.value)
        if (uc.status === 'fulfilled') setUserChallenges(uc.value)
        if (pts.status === 'fulfilled') setPoints(pts.value)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  // Ranking é opt-in: só busca quando a pessoa abre.
  async function toggleRanking() {
    haptic('tap')
    const next = !rankingOpen
    setRankingOpen(next)
    if (next && leaderboard === null) {
      setRankingLoading(true)
      try { setLeaderboard(await gamification.getLeaderboard()) }
      catch { setLeaderboard([]) }
      finally { setRankingLoading(false) }
    }
  }

  async function handleStart(challengeId: number) {
    haptic('tap')
    setActionLoading(challengeId)
    try {
      const uc = await gamification.startChallenge(challengeId)
      setUserChallenges(prev => [...prev.filter(u => u.challenge_id !== uc.challenge_id), uc])
      success(t('g.gam.started'))
    } catch (err: unknown) {
      haptic('error')
      error(err instanceof Error ? err.message : t('g.gam.errStart'))
    } finally { setActionLoading(null) }
  }

  async function handleComplete(userChallengeId: number) {
    setActionLoading(userChallengeId)
    try {
      // a API conclui pelo id do DESAFIO, não pelo id do progresso do usuário
      const mine = userChallenges.find(u => u.id === userChallengeId)
      if (!mine) throw new Error(t('g.gam.errComplete'))
      const uc = await gamification.completeChallenge(mine.challenge_id)
      setUserChallenges(prev => prev.map(u => u.id === uc.id ? uc : u))
      gamification.getUserPoints().then(setPoints).catch(() => {})
      // Concluir desafio é marco (confirmado pela API): vibração de marco + confete pequeno.
      haptic('milestone')
      celebrate('small')
      success(t('g.gam.completed'))
    } catch (err: unknown) {
      haptic('error')
      error(err instanceof Error ? err.message : t('g.gam.errComplete'))
    } finally { setActionLoading(null) }
  }

  const ucByChallenge = useMemo(() => {
    const m = new Map<number, UserChallenge>()
    userChallenges.forEach(uc => m.set(uc.challenge_id, uc))
    return m
  }, [userChallenges])

  /** "Primeira vacina registrada" não faz sentido para quem já registrou vacina
   *  (a não ser que já apareça como concluído — aí fica como conquista). */
  const isRedundant = (c: Challenge) =>
    hasVaccine && challengeSlug(c.title) === 'firstVaccine' && ucByChallenge.get(c.id)?.status !== 'completed'

  const activeUC = userChallenges.filter(uc => uc.status === 'in_progress')
  const completedCount = userChallenges.filter(uc => uc.status === 'completed').length

  /** 3 sugestões: não iniciados e não concluídos; saúde primeiro, depois os mais fáceis. */
  const suggestions = useMemo(() => {
    const open = challenges.filter(c => {
      const st = ucByChallenge.get(c.id)?.status
      return st !== 'in_progress' && st !== 'completed' && !isRedundant(c)
    })
    return [...open]
      .sort((a, b) => {
        const ha = categoryOf(a) === 'health' ? 0 : 1
        const hb = categoryOf(b) === 'health' ? 0 : 1
        if (ha !== hb) return ha - hb
        const da = DIFF_RANK[difficultyOf(a) ?? 'medium']
        const db = DIFF_RANK[difficultyOf(b) ?? 'medium']
        return da - db
      })
      .slice(0, 3)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenges, ucByChallenge, hasVaccine])

  const groups = useMemo(() => {
    const m = new Map<CategoryId, Challenge[]>()
    challenges.forEach(c => {
      if (isRedundant(c)) return
      const k = categoryOf(c)
      m.set(k, [...(m.get(k) ?? []), c])
    })
    return CATEGORY_ORDER.filter(k => m.has(k)).map(k => ({ id: k, items: m.get(k)! }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenges, ucByChallenge, hasVaccine])

  const visibleCount = groups.reduce((n, g) => n + g.items.length, 0)

  // O backend sobe de nível a cada 100 pontos (POINTS_PER_LEVEL).
  const perLevel = points?.points_per_level ?? 100
  const inLevel = points?.points_in_level ?? ((points?.total_points ?? 0) % perLevel)
  const progressPct = points ? Math.min(100, Math.round((inLevel / perLevel) * 100)) : 0
  const levelName = t(levelKey(points ? points.level : 1))

  function card(c: Challenge) {
    const uc = ucByChallenge.get(c.id)
    return (
      <ChallengeCard
        challenge={c}
        userChallenge={uc}
        onStart={handleStart}
        onComplete={handleComplete}
        loading={actionLoading === c.id || (!!uc && actionLoading === uc.id)}
      />
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <PageHeader title={t('g.gam.title')} subtitle={t('g.gam.subtitle')} />

        {/* Evento com prazo: cartão neutro + uma ação clara (participar / ver vacinas) */}
        {event?.active && (
          <EventCard
            event={event}
            userChallenge={event.challenge_id ? ucByChallenge.get(event.challenge_id) : undefined}
            challengeTitle={text.titleOf(event.challenge_title)}
            busy={!!event.challenge_id && actionLoading === event.challenge_id}
            onJoin={() => { if (event.challenge_id) void handleStart(event.challenge_id) }}
          />
        )}

        {loading ? (
          <div aria-busy="true" className="space-y-4">
            <Skeleton className="h-[104px] rounded-2xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
            </div>
          </div>
        ) : (
          <>
            {/* Pontos e nível: discreto, sem pressão */}
            {points && (
              <Card className="mb-6" padding="md">
                <div className="flex items-center gap-4">
                  <span className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 flex items-center justify-center shrink-0">
                    <Star className="w-6 h-6" aria-hidden />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                        {t('g.gam.levelLine', { level: points.level, name: levelName })}
                      </p>
                      <p className="text-sm font-bold text-surface-900 dark:text-white tabular-nums shrink-0">
                        {t('wk.ch.pts', { n: points.total_points.toLocaleString(localeTag()) })}
                      </p>
                    </div>
                    <div
                      className="mt-2 w-full bg-surface-200 dark:bg-surface-800 rounded-full h-2"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={perLevel}
                      aria-valuenow={inLevel}
                      aria-label={t('g.gam.levelLine', { level: points.level, name: levelName })}
                    >
                      <div className="bg-primary-600 dark:bg-primary-400 h-2 rounded-full transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                      {t('g.gam.toNextLevel', { n: points.points_to_next_level ?? (perLevel - inLevel) })}
                      {completedCount > 0 && ` · ${t('wk.ch.completedCount', { n: completedCount })}`}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {challenges.length === 0 ? (
              <EmptyState icon={Target} title={t('g.gam.emptyAvailTitle')} text={t('g.gam.emptyAvailText')} />
            ) : (
              <>
                {activeUC.length > 0 && (
                  <Section title={t('wk.ch.inProgress')}>
                    <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeUC.map(uc => {
                        const ch = challenges.find(c => c.id === uc.challenge_id)
                        if (!ch) return null
                        return <StaggerItem key={uc.id}>{card(ch)}</StaggerItem>
                      })}
                    </Stagger>
                  </Section>
                )}

                <Section title={t('wk.ch.forYou')}>
                  {suggestions.length === 0 ? (
                    <Card tone="success" className="flex items-center gap-3">
                      <span className="w-11 h-11 rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-surface-950 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5" aria-hidden />
                      </span>
                      <div>
                        <p className="font-semibold text-surface-900 dark:text-white">{t('g.gam.emptyAvailTitle')}</p>
                        <p className="text-sm text-surface-600 dark:text-surface-400">{t('g.gam.emptyAvailText')}</p>
                      </div>
                    </Card>
                  ) : (
                    <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {suggestions.map(c => <StaggerItem key={c.id}>{card(c)}</StaggerItem>)}
                    </Stagger>
                  )}
                </Section>

                <Section
                  id="all-challenges"
                  title={t('wk.ch.allTitle', { n: visibleCount })}
                  action={{
                    label: showAll ? t('wk.ch.collapse') : t('wk.ch.seeAll'),
                    onClick: () => { haptic('tap'); setShowAll(v => !v) },
                  }}
                >
                  {showAll ? (
                    <div className="space-y-5">
                      {groups.map(g => {
                        const Icon = CATEGORY_ICONS[g.id]
                        const done = g.items.filter(c => ucByChallenge.get(c.id)?.status === 'completed').length
                        return (
                          <section key={g.id} aria-labelledby={`cat-${g.id}`}>
                            <h3 id={`cat-${g.id}`} className="flex items-center gap-2 text-sm font-semibold text-surface-800 dark:text-surface-100 mb-2">
                              <Icon className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
                              {g.id === 'other' ? t('wk.cat.other') : t(`wk.cat.${g.id}`)}
                              <span className="text-xs font-medium text-surface-500 dark:text-surface-400">
                                {t('wk.ch.groupProgress', { done, total: g.items.length })}
                              </span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {g.items.map(c => <div key={c.id}>{card(c)}</div>)}
                            </div>
                          </section>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-surface-600 dark:text-surface-400">{t('wk.ch.allHint')}</p>
                  )}
                </Section>
              </>
            )}

            {/* Ranking: fechado por padrão, aberto só se a pessoa quiser */}
            <section className="mb-6">
              <button
                type="button"
                onClick={toggleRanking}
                aria-expanded={rankingOpen}
                aria-controls="ranking-panel"
                className="pressable w-full flex items-center gap-3 min-h-[56px] px-4 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 text-left"
              >
                <Users className="w-5 h-5 text-primary-700 dark:text-primary-300 shrink-0" aria-hidden />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-surface-900 dark:text-white">
                    {rankingOpen ? t('wk.rank.hide') : t('wk.rank.show')}
                  </span>
                  <span className="block text-xs text-surface-500 dark:text-surface-400">{t('wk.rank.hint')}</span>
                </span>
                <ChevronDown
                  className={cn('w-5 h-5 text-surface-500 dark:text-surface-400 transition-transform duration-200', rankingOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>

              <AnimatePresence initial={false}>
                {rankingOpen && (
                  <motion.div
                    id="ranking-panel"
                    key="ranking"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: dur.base, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 overflow-hidden">
                      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
                        <h2 className="text-sm font-bold text-surface-900 dark:text-white">{t('g.gam.leaderboardTitle')}</h2>
                      </div>
                      {rankingLoading ? (
                        <div className="p-4 space-y-3" aria-busy="true">
                          {[0, 1, 2].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}
                        </div>
                      ) : !leaderboard || leaderboard.length === 0 ? (
                        <p className="text-center py-10 text-sm text-surface-500 dark:text-surface-400">{t('g.gam.leaderboardEmpty')}</p>
                      ) : (
                        <ol className="divide-y divide-surface-100 dark:divide-surface-800">
                          {leaderboard.slice(0, 10).map((entry, i) => (
                            <li key={entry.user_id} className="flex items-center gap-3 px-4 py-3">
                              <span
                                className={cn(
                                  'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0',
                                  i < 3 ? 'bg-amber-50 dark:bg-amber-500/15' : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300',
                                )}
                              >
                                {/* medalhas aqui são conteúdo do ranking */}
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : entry.rank}
                              </span>
                              <span className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-500/15 flex items-center justify-center font-bold text-primary-800 dark:text-primary-200 shrink-0" aria-hidden>
                                {entry.user_name.charAt(0).toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-surface-900 dark:text-white truncate">{entry.user_name}</div>
                                <div className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border mt-0.5', getBadgeColor(entry.level))}>
                                  <Medal className="w-3 h-3" aria-hidden />
                                  {t(levelKey(entry.level))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-sm font-bold text-surface-800 dark:text-surface-100 tabular-nums">
                                <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden />
                                {entry.total_points.toLocaleString(localeTag())}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <p className="flex items-start gap-2 text-xs text-surface-500 dark:text-surface-400 mb-4">
              <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
              {t('wk.ch.noPressure')}
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

type EventInfo = Awaited<ReturnType<typeof gamification.getEvent>>

function EventCard({ event, userChallenge, challengeTitle, busy, onJoin }: {
  event: EventInfo
  userChallenge?: UserChallenge
  challengeTitle: string
  busy: boolean
  onJoin: () => void
}) {
  const t = useT()
  const date = event.ends_at
    ? new Date(event.ends_at + (/[zZ]|[+-]\d\d:?\d\d$/.test(event.ends_at) ? '' : 'Z'))
        .toLocaleDateString(localeTag(), { day: '2-digit', month: '2-digit' })
    : ''
  const status = userChallenge?.status
  return (
    <Card className="mb-6" padding="md">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            {date ? t('wk2.event.tagUntil', { date }) : t('wk2.event.tag')}
          </p>
          <h2 className="font-display text-base font-bold text-surface-900 dark:text-white leading-tight mt-0.5">
            {t('wk2.event.title')}
          </h2>
          <p className="text-sm text-surface-600 dark:text-surface-300 mt-1 leading-snug">
            {t('wk2.event.body', { challenge: challengeTitle, points: event.points ?? 0 })}
          </p>
        </div>
      </div>
      <div className="mt-3">
        {status === 'completed' ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300 min-h-[44px]">
            <Check className="w-4 h-4" strokeWidth={2.6} aria-hidden />
            {t('wk.ch.done')}
          </p>
        ) : status === 'in_progress' ? (
          <Button href="/health/vaccines" variant="soft" fullWidth leftIcon={Syringe}>
            {t('wk2.event.openVaccines')}
          </Button>
        ) : (
          <Button onClick={onJoin} loading={busy} fullWidth leftIcon={Play}>
            {t('wk2.event.join')}
          </Button>
        )}
      </div>
    </Card>
  )
}
