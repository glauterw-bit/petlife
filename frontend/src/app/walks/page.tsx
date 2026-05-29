'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Play, Activity, Flame, Calendar, ChevronRight, MapPin, Trophy, Heart } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { walks, type WalkListItem, type WalkStats, type WalkBadge } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { formatDistance, formatDuration, formatPace } from '@/lib/walk-utils'
import { PageLoader } from '@/components/ui/LoadingSpinner'

export default function WalksPage() {
  const { error } = useToast()
  const [items, setItems] = useState<WalkListItem[]>([])
  const [stats, setStats] = useState<WalkStats | null>(null)
  const [badges, setBadges] = useState<WalkBadge[]>([])
  const [earnedCount, setEarnedCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([walks.list({ limit: 50 }), walks.stats(), walks.badges()])
      .then(([listR, statsR, badgesR]) => {
        if (listR.status === 'fulfilled') setItems(listR.value)
        if (statsR.status === 'fulfilled') setStats(statsR.value)
        if (badgesR.status === 'fulfilled') {
          setBadges(badgesR.value.badges)
          setEarnedCount(badgesR.value.earned_count)
        }
        if (listR.status === 'rejected') {
          error('Erro ao carregar passeios.')
        }
      })
      .finally(() => setLoading(false))
  }, [error])

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5 md:mb-6 pl-12 md:pl-0">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight">Passeios</h1>
            <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">
              {items.length === 0 ? 'Cronometre e compartilhe as aventuras' : `${items.length} passeio${items.length > 1 ? 's' : ''} registrado${items.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <Link
            href="/walks/active"
            aria-label="Iniciar passeio"
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-2xl font-semibold shadow-lg shadow-primary-200 transition shrink-0"
          >
            <Play className="w-5 h-5 fill-current" />
            <span className="hidden xs:inline">Novo</span>
          </Link>
        </div>

        {/* Stats summary */}
        {stats && stats.total_walks > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            <SummaryCard icon={<Activity className="w-5 h-5 text-primary-500" />} label="Total" value={String(stats.total_walks)} sub="passeios" />
            <SummaryCard icon={<MapPin className="w-5 h-5 text-blue-500" />} label="Distância" value={formatDistance(stats.total_distance_meters)} sub="acumulada" />
            <SummaryCard icon={<Flame className="w-5 h-5 text-orange-500" />} label="Streak" value={String(stats.current_streak_days)} sub={stats.current_streak_days === 1 ? 'dia' : 'dias'} />
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-200">Conquistas</h2>
              </div>
              <span className="text-xs text-surface-500">{earnedCount} de {badges.length}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2 snap-x">
              {badges.map(b => (
                <BadgeChip key={b.key} badge={b} />
              ))}
            </div>
          </div>
        )}

        {/* List */}
        {items.length === 0 ? (
          <div className="bg-white dark:bg-surface-800 rounded-3xl p-10 text-center border border-surface-100 dark:border-surface-700">
            <div className="text-6xl mb-3">🦮</div>
            <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-2">Primeiro passeio chegando!</h2>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">
              Cronometre o passeio do seu pet, capture o trajeto no mapa e compartilhe com a galera.
            </p>
            <Link
              href="/walks/active"
              className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-primary-600 transition shadow-lg shadow-primary-200"
            >
              <Play className="w-5 h-5 fill-current" />
              Começar agora
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(w => (
              <WalkCard key={w.id} walk={w} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

function BadgeChip({ badge }: { badge: WalkBadge }) {
  const pct = Math.round(badge.progress * 100)
  return (
    <div
      title={`${badge.name} — ${badge.description}`}
      className={`snap-start shrink-0 w-28 sm:w-32 rounded-2xl p-3 border text-center transition ${
        badge.unlocked
          ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 border-amber-300 dark:border-amber-700 shadow-sm'
          : 'bg-white dark:bg-surface-800 border-surface-100 dark:border-surface-700 opacity-70'
      }`}
    >
      <div className={`text-2xl mb-1 ${badge.unlocked ? '' : 'grayscale opacity-50'}`}>{badge.emoji}</div>
      <div className="text-[11px] font-semibold text-surface-900 dark:text-white leading-tight line-clamp-2 min-h-[28px]">{badge.name}</div>
      {!badge.unlocked && (
        <div className="mt-1.5">
          <div className="h-1 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[10px] text-surface-500 mt-0.5">{pct}%</div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl p-3 border border-surface-100 dark:border-surface-700">
      <div className="flex items-center gap-1.5 mb-1.5 text-surface-500 dark:text-surface-400 text-[10px] uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-lg md:text-xl font-bold text-surface-900 dark:text-white leading-tight">{value}</div>
      <div className="text-[10px] text-surface-500">{sub}</div>
    </div>
  )
}

function WalkCard({ walk }: { walk: WalkListItem }) {
  const date = new Date(walk.started_at)
  const dateStr = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const moodEmoji = walk.mood === 'happy' ? '😊' : walk.mood === 'tired' ? '😴' : walk.mood === 'normal' ? '🙂' : null

  return (
    <Link
      href={`/walks/${walk.id}`}
      className="block bg-white dark:bg-surface-800 rounded-2xl p-4 border border-surface-100 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 transition group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900 dark:to-accent-900 flex items-center justify-center overflow-hidden shrink-0">
          {walk.pet_photo ? (
            <Image src={walk.pet_photo} alt={walk.pet_name ?? ''} width={40} height={40} className="object-cover w-full h-full" />
          ) : (
            <span className="text-lg">🐾</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-surface-900 dark:text-white text-sm truncate group-hover:text-primary-600 transition">
            {walk.pet_name ?? 'Pet'} {moodEmoji && <span className="ml-1">{moodEmoji}</span>}
          </div>
          <div className="text-xs text-surface-500 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            {dateStr} · {timeStr}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-sm md:text-base font-bold text-surface-800 dark:text-white tabular-nums">{formatDistance(walk.distance_meters)}</div>
          <div className="text-[10px] text-surface-500 uppercase tracking-wide">distância</div>
        </div>
        <div>
          <div className="text-sm md:text-base font-bold text-surface-800 dark:text-white tabular-nums">{formatDuration(walk.duration_seconds)}</div>
          <div className="text-[10px] text-surface-500 uppercase tracking-wide">tempo</div>
        </div>
        <div>
          <div className="text-sm md:text-base font-bold text-surface-800 dark:text-white tabular-nums">{walk.avg_pace_seconds_per_km ? formatPace(walk.avg_pace_seconds_per_km).replace('/km', '') : '—'}</div>
          <div className="text-[10px] text-surface-500 uppercase tracking-wide">ritmo</div>
        </div>
      </div>
      {(walk.kudos_count > 0 || walk.is_shared) && (
        <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700 flex items-center gap-3 text-xs text-surface-500">
          {walk.kudos_count > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" /> {walk.kudos_count}
            </span>
          )}
          {walk.is_shared && (
            <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
              <Trophy className="w-3.5 h-3.5" /> compartilhado
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
