'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Play, Activity, Flame, Calendar, ChevronRight, MapPin, Trophy, Heart, Footprints, PawPrint, Medal,
  Map as MapIcon, Globe2, Gem, Camera, Share2, Sunrise, Moon, Check, type LucideIcon,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { walks, type WalkListItem, type WalkStats, type WalkBadge, type WalkBadgesResponse } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { formatDistance, formatDuration } from '@/lib/walk-utils'
import { paceClock } from '@/components/walks/pace'
import { flushFinishQueue, getFinishQueue } from '@/lib/walk-persistence'
import { useT } from '@/contexts/LocaleContext'
import { localeTag, cn } from '@/lib/utils'
import { useCached, invalidate } from '@/lib/cache'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Section } from '@/components/ui/Section'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton'
import { haptic } from '@/lib/feedback'

/** Ícone lucide por conquista (a API manda emoji; aqui é interface, então vira ícone). */
const BADGE_ICONS: Record<string, LucideIcon> = {
  first_walk: PawPrint,
  walks_10: Footprints,
  walks_50: Activity,
  walks_100: Medal,
  distance_10km: MapPin,
  distance_50km: MapIcon,
  distance_100km: Globe2,
  streak_7: Flame,
  streak_30: Gem,
  photographer: Camera,
  social: Share2,
  early_bird: Sunrise,
  night_owl: Moon,
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

/** "Faltam 3 passeios" / "Faltam 4,2 km" — calculado com o progresso real que a API devolve. */
function remainingLabel(t: TFn, b: WalkBadge): string {
  const left = Math.max(0, b.target - b.current)
  if (b.key.startsWith('distance_')) {
    const km = left.toLocaleString(localeTag(), { maximumFractionDigits: 1, minimumFractionDigits: left % 1 ? 1 : 0 })
    return t('wk.badge.leftKm', { n: km })
  }
  const n = Math.ceil(left)
  if (b.key === 'first_walk' || b.key.startsWith('walks_')) return n === 1 ? t('wk.badge.leftWalkOne') : t('wk.badge.leftWalks', { n })
  if (b.key.startsWith('streak_')) return n === 1 ? t('wk.badge.leftDayOne') : t('wk.badge.leftDays', { n })
  if (b.key === 'photographer') return n === 1 ? t('wk.badge.leftPhotoOne') : t('wk.badge.leftPhotos', { n })
  return b.description
}

/** A conquista em andamento mais perto de sair; empate fica com a primeira da lista. */
function nextBadge(badges: WalkBadge[]): WalkBadge | null {
  let best: WalkBadge | null = null
  for (const b of badges) {
    if (b.unlocked) continue
    if (!best || b.progress > best.progress) best = b
  }
  return best
}

export default function WalksPage() {
  const t = useT()
  const { error, success } = useToast()
  const [allOpen, setAllOpen] = useState(false)

  const list = useCached<WalkListItem[]>('walks', () => walks.list({ limit: 50 }))
  const stats = useCached<WalkStats>('walks:stats', () => walks.stats())
  const badgesQ = useCached<WalkBadgesResponse>('walks:badges', () => walks.badges())

  const items = list.data ?? []
  const badges = badgesQ.data?.badges ?? []
  const earnedCount = badgesQ.data?.earned_count ?? 0
  const next = useMemo(() => nextBadge(badges), [badges])

  useEffect(() => {
    if (list.error && !list.data) error(t('pw.walks.loadError'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.error])

  async function refreshAll() {
    await Promise.allSettled([list.refresh(), stats.refresh(), badgesQ.refresh()])
  }

  useEffect(() => {
    // Reenvia passeios finalizados offline (não perde caminhada sem sinal)
    if (getFinishQueue().length > 0) {
      flushFinishQueue((id, payload) => walks.finish(id, payload)).then(sent => {
        if (sent > 0) {
          success(t('pw.walks.offlineSent', { count: sent }))
          invalidate('walks')
        }
      })
    }
    function onOnline() {
      flushFinishQueue((id, payload) => walks.finish(id, payload)).then(sent => {
        if (sent > 0) { success(t('pw.walks.offlineSentShort', { count: sent })); invalidate('walks') }
      })
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loading = list.loading
  const subtitle = loading
    ? undefined
    : items.length === 0
      ? t('pw.walks.subtitleEmpty')
      : items.length > 1
        ? t('walk.registered', { count: items.length })
        : t('pw.walks.registeredOne', { count: items.length })

  const s = stats.data

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title={t('walk.title')}
          subtitle={subtitle}
        />

        {/* Ação principal da tela: texto claro, largura total, 48 px.
            Sem passeios, quem convida é o estado vazio (evita dois botões iguais). */}
        {(loading || items.length > 0) && (
          <Button
            href="/walks/active"
            size="md"
            fullWidth
            leftIcon={Play}
            className="min-h-[48px] mb-5 [&_svg]:fill-current"
          >
            {t('wk2.start')}
          </Button>
        )}

        <PullToRefresh onRefresh={refreshAll}>
          {loading ? (
            <div aria-busy="true" className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-[76px] rounded-2xl" />)}
              </div>
              <Skeleton className="h-[112px] rounded-2xl" />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : (
            <>
              {items.length === 0 && (
                <Card padding="none" className="mb-6">
                  <EmptyState
                    icon={Footprints}
                    title={t('pw.walks.emptyTitle')}
                    text={t('pw.walks.emptyText')}
                    ctaLabel={t('pw.walks.startNow')}
                    ctaHref="/walks/active"
                  />
                </Card>
              )}

              {s && s.total_walks > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
                  <SummaryCard icon={Activity} label={t('pw.walks.statTotal')} value={String(s.total_walks)} sub={s.total_walks === 1 ? t('pw.walks.statTotalSubOne') : t('pw.walks.statTotalSub')} />
                  <SummaryCard icon={MapPin} label={t('walk.distance')} value={formatDistance(s.total_distance_meters)} sub={t('pw.walks.statDistanceSub')} />
                  <SummaryCard icon={Flame} label={t('pw.walks.statStreak')} value={String(s.current_streak_days)} sub={s.current_streak_days === 1 ? t('pw.walks.day') : t('pw.walks.days')} />
                </div>
              )}

              {badges.length > 0 && (
                <Section
                  title={next ? t('wk.badge.nextTitle') : t('pw.walks.achievements')}
                  action={{ label: t('wk.badge.seeAll'), onClick: () => { haptic('tap'); setAllOpen(true) } }}
                >
                  {next ? (
                    <NextBadgeCard badge={next} earned={earnedCount} total={badges.length} />
                  ) : (
                    <Card tone="success" className="flex items-center gap-3">
                      <span className="w-11 h-11 rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-surface-950 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5" aria-hidden />
                      </span>
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">{t('wk.badge.allDone')}</p>
                    </Card>
                  )}
                </Section>
              )}

              {items.length > 0 && (
                <Section title={t('wk.history')}>
                  <Stagger as="ul" className="space-y-3">
                    {items.map(w => (
                      <StaggerItem as="li" key={w.id}>
                        <WalkCard walk={w} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                </Section>
              )}
            </>
          )}
        </PullToRefresh>
      </div>

      <Sheet
        open={allOpen}
        onClose={() => setAllOpen(false)}
        title={t('pw.walks.achievements')}
        description={t('pw.walks.badgeProgress', { done: earnedCount, total: badges.length })}
        size="tall"
      >
        <ul className="grid grid-cols-2 gap-2.5 pb-2">
          {badges.map(b => <BadgeTile key={b.key} badge={b} />)}
        </ul>
      </Sheet>
    </DashboardLayout>
  )
}

function BadgeIcon({ badge, size = 'md' }: { badge: WalkBadge; size?: 'md' | 'lg' }) {
  const Icon = BADGE_ICONS[badge.key] ?? Trophy
  return (
    <span
      className={cn(
        'rounded-full flex items-center justify-center shrink-0',
        size === 'lg' ? 'w-12 h-12' : 'w-10 h-10',
        badge.unlocked
          ? 'bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950'
          : 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300',
      )}
    >
      <Icon className={size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} aria-hidden strokeWidth={2} />
    </span>
  )
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className="h-2 rounded-full bg-surface-200 dark:bg-surface-800 overflow-hidden"
    >
      <div className="h-full rounded-full bg-primary-600 dark:bg-primary-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

function NextBadgeCard({ badge, earned, total }: { badge: WalkBadge; earned: number; total: number }) {
  const t = useT()
  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <BadgeIcon badge={badge} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-surface-900 dark:text-white leading-tight">{badge.name}</p>
          <p className="text-sm text-surface-600 dark:text-surface-400 leading-snug mt-0.5">{badge.description}</p>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar value={badge.progress} label={badge.name} />
        <div className="flex items-center justify-between mt-1.5 text-xs">
          <span className="font-semibold text-primary-800 dark:text-primary-300">{remainingLabel(t, badge)}</span>
          <span className="text-surface-500 dark:text-surface-400">{t('pw.walks.badgeProgress', { done: earned, total })}</span>
        </div>
      </div>
    </Card>
  )
}

function BadgeTile({ badge }: { badge: WalkBadge }) {
  const t = useT()
  return (
    <li
      className={cn(
        'rounded-2xl border p-3 flex flex-col gap-2',
        badge.unlocked
          ? 'tone-brand-bg'
          : 'bg-white dark:bg-surface-900 border-surface-200/70 dark:border-surface-800',
      )}
    >
      <div className="flex items-start justify-between">
        <BadgeIcon badge={badge} />
        {badge.unlocked && (
          <span className="chip chip-success">
            <Check className="w-3.5 h-3.5" aria-hidden strokeWidth={2.6} />
            {t('wk.badge.unlocked')}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-surface-900 dark:text-white leading-tight">{badge.name}</p>
        <p className="text-xs text-surface-600 dark:text-surface-400 leading-snug mt-0.5">{badge.description}</p>
      </div>
      {!badge.unlocked && (
        <div className="mt-auto">
          <ProgressBar value={badge.progress} label={badge.name} />
          <p className="text-[11px] font-medium text-surface-600 dark:text-surface-400 mt-1">{remainingLabel(t, badge)}</p>
        </div>
      )}
    </li>
  )
}

function SummaryCard({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub: string }) {
  return (
    <Card padding="sm">
      <div className="flex items-center gap-1.5 mb-1.5 text-surface-600 dark:text-surface-400 text-[11px] font-medium">
        <Icon className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-lg md:text-xl font-bold text-surface-900 dark:text-white leading-tight tabular-nums">{value}</div>
      <div className="text-[11px] text-surface-500 dark:text-surface-400">{sub}</div>
    </Card>
  )
}

function WalkCard({ walk }: { walk: WalkListItem }) {
  const t = useT()
  const date = new Date(walk.started_at)
  const dateStr = date.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })
  // humor do pet é conteúdo (reação), então o emoji fica
  const pace = paceClock(walk.avg_pace_seconds_per_km)
  const moodEmoji = walk.mood === 'happy' ? '😊' : walk.mood === 'tired' ? '😴' : walk.mood === 'normal' ? '🙂' : null

  return (
    <Card href={`/walks/${walk.id}`} interactive className="group">
      <div className="flex items-center gap-3 mb-3">
        <PetAvatar pet={{ name: walk.pet_name ?? '', photo_url: walk.pet_photo }} size={40} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-surface-900 dark:text-white text-sm truncate">
            {walk.pet_name ?? t('pw.walks.petFallback')} {moodEmoji && <span className="ml-1" role="img" aria-label={t(`pw.mood.${walk.mood}`)}>{moodEmoji}</span>}
          </div>
          <div className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" aria-hidden />
            {dateStr} · {timeStr}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-surface-400 dark:text-surface-500" aria-hidden />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric value={formatDistance(walk.distance_meters)} label={t('walk.distance')} />
        <Metric value={formatDuration(walk.duration_seconds)} label={t('walk.time')} />
        <Metric value={pace ? t('wk2.pace', { pace }) : '—'} label={t('walk.pace')} />
      </div>
      {(walk.kudos_count > 0 || walk.is_shared) && (
        <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center gap-3 text-xs text-surface-600 dark:text-surface-400">
          {walk.kudos_count > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-pink-600 fill-pink-600 dark:text-pink-400 dark:fill-pink-400" aria-hidden /> {walk.kudos_count}
            </span>
          )}
          {walk.is_shared && (
            <span className="flex items-center gap-1 text-primary-700 dark:text-primary-300">
              <Share2 className="w-3.5 h-3.5" aria-hidden /> {t('pw.walks.shared')}
            </span>
          )}
        </div>
      )}
    </Card>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-sm md:text-base font-bold text-surface-900 dark:text-white tabular-nums">{value}</div>
      <div className="text-[11px] text-surface-500 dark:text-surface-400">{label}</div>
    </div>
  )
}
