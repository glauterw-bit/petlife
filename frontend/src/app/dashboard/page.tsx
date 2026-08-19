'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  PawPrint, Syringe, FlaskConical, Trophy, Plus, ArrowRight,
  Bell, Shield, Star, TrendingUp, Clock, CheckCircle, Footprints
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { pets as petsApi, vaccines as vaccinesApi, walks as walksApi, gamification, reminders as remindersApi, type Pet, type Vaccine, type Reminder, type UserPoints } from '@/lib/api'
import { formatDate, formatAge, getSpeciesEmoji, getVaccineStatus, getLevelName, getBadgeColor } from '@/lib/utils'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { HealthScoreCard } from '@/components/health/HealthScoreCard'
import { DailyCheckin } from '@/components/health/DailyCheckin'
import { StreakFlame } from '@/components/health/StreakFlame'
import { syncHealthNotifications } from '@/lib/notifications'
import { trackHappyMoment } from '@/lib/review'
import { PetHero } from '@/components/pets/PetHero'
import { ReferralCard } from '@/components/growth/ReferralCard'
import { OnboardingChecklist } from '@/components/growth/OnboardingChecklist'
import { EmptyState } from '@/components/ui/EmptyState'
import { useT } from '@/contexts/LocaleContext'

export default function DashboardPage() {
  const { user } = useAuth()
  const t = useT()
  const [pets, setPets] = useState<Pet[]>([])
  const [upcomingVaccines, setUpcomingVaccines] = useState<Vaccine[]>([])
  const [upcomingReminders, setUpcomingReminders] = useState<Reminder[]>([])
  const [points, setPoints] = useState<UserPoints | null>(null)
  const [loading, setLoading] = useState(true)
  const [scoreRefresh, setScoreRefresh] = useState(0)
  const [hasVaccine, setHasVaccine] = useState(false)
  const [hasWalk, setHasWalk] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [p, v, r, pts, allVax, recentWalks] = await Promise.allSettled([
          petsApi.list(),
          vaccinesApi.getUpcoming(30),
          remindersApi.getUpcoming(7),
          gamification.getUserPoints(),
          vaccinesApi.list(),
          walksApi.list({ limit: 1 }),
        ])
        if (p.status === 'fulfilled') setPets(p.value)
        if (v.status === 'fulfilled') setUpcomingVaccines(v.value)
        if (r.status === 'fulfilled') setUpcomingReminders(r.value)
        if (pts.status === 'fulfilled') setPoints(pts.value)
        if (allVax.status === 'fulfilled') setHasVaccine((allVax.value?.length ?? 0) > 0)
        if (recentWalks.status === 'fulfilled') setHasWalk((recentWalks.value?.length ?? 0) > 0)
        // Agenda notificações locais de vacinas/lembretes (no-op fora do app nativo)
        void syncHealthNotifications(
          v.status === 'fulfilled' ? v.value : [],
          r.status === 'fulfilled' ? r.value : [],
          p.status === 'fulfilled' ? p.value : [],
          allVax.status === 'fulfilled' ? (allVax.value?.length ?? 0) > 0 : true,
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>

  const overdueVaccines = upcomingVaccines.filter(v => getVaccineStatus(v.next_due_date) === 'overdue')
  const levelName = points ? getLevelName(points.level) : 'Iniciante'
  const progressPct = points
    ? Math.min(100, ((points.total_points % 1000) / 10))
    : 0

  return (
    <DashboardLayout>
      {/* Herói: o pet domina a tela (anel de status + streak). Sem pets, saudação simples. */}
      {pets.length > 0 ? (
        <PetHero
          pet={pets[0]}
          vaccines={upcomingVaccines}
          userName={user?.name?.split(' ')[0]}
          refreshKey={scoreRefresh}
        />
      ) : (
        <div className="mb-6 md:mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight">
            {t('dash.greeting', { name: user?.name?.split(' ')[0] ?? t('v.dash.defaultUser') })}
          </h1>
          <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">
            {t('dash.addFirstPet')}
          </p>
        </div>
      )}

      {/* Primeiros passos — guia de ativação (some sozinho quando concluído/dispensado) */}
      {pets.length > 0 && (
        <OnboardingChecklist
          pet={pets[0]}
          hasVaccine={hasVaccine}
          hasWalk={hasWalk}
          firstName={user?.name?.split(' ')[0]}
        />
      )}

      {/* Daily check-in + Health Score + Streak — engajamento diário */}
      {pets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 reveal">
            <HealthScoreCard key={scoreRefresh} pet={pets[0]} />
          </div>
          <div className="lg:col-span-1 space-y-4 reveal" style={{ ['--i' as string]: 1 }}>
            <StreakFlame key={`streak-${scoreRefresh}`} pet={pets[0]} refreshKey={scoreRefresh} />
            <DailyCheckin pet={pets[0]} onDone={() => { setScoreRefresh(n => n + 1); trackHappyMoment('checkin') }} />
          </div>
        </div>
      )}

      {/* Stats — cartões unificados (superfície neutra + chip de ícone colorido) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {[
          {
            icon: <PawPrint className="w-5 h-5" />,
            label: t('dash.totalPets'),
            value: pets.length,
            tint: 'text-primary-600 bg-primary-50 dark:text-primary-300 dark:bg-primary-500/15',
          },
          {
            icon: <Syringe className="w-5 h-5" />,
            label: t('dash.upcomingVaccines'),
            value: upcomingVaccines.filter(v => getVaccineStatus(v.next_due_date) === 'upcoming').length,
            tint: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15',
            alert: overdueVaccines.length > 0,
          },
          {
            icon: <Bell className="w-5 h-5" />,
            label: t('dash.reminders7d'),
            value: upcomingReminders.length,
            tint: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15',
          },
          {
            icon: <Trophy className="w-5 h-5" />,
            label: t('dash.points'),
            value: points?.total_points ?? 0,
            tint: 'text-accent-600 bg-accent-50 dark:text-accent-300 dark:bg-accent-500/15',
          },
        ].map((s, i) => (
          <div key={i} className="reveal pressable bg-white dark:bg-surface-800 rounded-2xl p-3 md:p-4 border border-surface-100 dark:border-surface-700 relative" style={{ ['--i' as string]: i }}>
            {s.alert && (
              <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            )}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.tint}`}>{s.icon}</div>
            <div className="text-xl md:text-2xl font-bold text-surface-900 dark:text-white mt-2 leading-tight tabular-nums">{s.value}</div>
            <div className="text-xs md:text-sm text-surface-500 dark:text-surface-400 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pet cards */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">{t('dash.myPets')}</h2>
              <Link href="/pets" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                {t('common.seeAll')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {pets.length === 0 ? (
              <EmptyState
                title={t('dash.emptyPetsTitle')}
                text={t('dash.emptyPetsText')}
                ctaLabel={t('dash.emptyPetsCta')}
                ctaHref="/pets/new"
              />
            ) : (
              <div className="space-y-3">
                {pets.slice(0, 3).map(pet => (
                  <Link
                    key={pet.id}
                    href={`/pets/${pet.id}`}
                    className="pressable flex items-center gap-4 p-3 rounded-xl dark:hover:bg-surface-700/40 hover:bg-surface-50 transition group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                      {pet.photo_url ? (
                        <Image src={pet.photo_url} alt={pet.name} width={56} height={56} className="object-cover w-full h-full rounded-2xl" />
                      ) : (
                        getSpeciesEmoji(pet.species)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-surface-900 dark:text-white group-hover:text-primary-600 transition">{pet.name}</div>
                      <div className="text-sm text-surface-500 dark:text-surface-400">{pet.breed?.name ?? '—'} • {formatAge(pet.birth_date)}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-1 transition" />
                  </Link>
                ))}
                {pets.length > 3 && (
                  <Link href="/pets" className="block text-center text-sm text-primary-600 hover:underline py-2">
                    {t('v.dash.morePets', { count: pets.length - 3 })}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Upcoming vaccines */}
          {upcomingVaccines.length > 0 && (
            <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-surface-900 dark:text-white flex items-center gap-2">
                  <Syringe className="w-5 h-5 text-yellow-500" />
                  {t('dash.vaccinesAttention')}
                </h2>
                <Link href="/health/vaccines" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                  {t('v.dash.seeAllF')} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-2">
                {upcomingVaccines.slice(0, 4).map(v => {
                  const status = getVaccineStatus(v.next_due_date)
                  const isOverdue = status === 'overdue'
                  return (
                    <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl ${isOverdue ? 'bg-red-50 border border-red-100' : 'bg-yellow-50 border border-yellow-100'}`}>
                      <Shield className={`w-5 h-5 ${isOverdue ? 'text-red-500' : 'text-yellow-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-surface-900 dark:text-white">{v.name}</div>
                        <div className="text-xs text-surface-500 dark:text-surface-400">{v.pet?.name ?? ''} • {t('vaccine.due')}: {formatDate(v.next_due_date)}</div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {isOverdue ? t('vaccine.badgeOverdue') : t('vaccine.badgeUpcoming')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
            <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-4">{t('dash.quickActions')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { href: '/walks/active', icon: <Footprints className="w-5 h-5" />, label: t('dash.walkNow'), color: 'text-primary-600 bg-primary-50 hover:bg-primary-100' },
                { href: '/health/vaccines', icon: <Syringe className="w-5 h-5" />, label: t('dash.newVaccine'), color: 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' },
                { href: '/health/exams', icon: <FlaskConical className="w-5 h-5" />, label: t('dash.newExam'), color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
                { href: '/challenges', icon: <Trophy className="w-5 h-5" />, label: t('dash.challenges'), color: 'text-accent-600 bg-accent-50 hover:bg-accent-100' },
                { href: '/pets/new', icon: <PawPrint className="w-5 h-5" />, label: t('dash.newPet'), color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
                { href: '/nearby', icon: <TrendingUp className="w-5 h-5" />, label: t('dash.nearbyClinics'), color: 'text-green-600 bg-green-50 hover:bg-green-100' },
              ].map(a => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={`pressable flex flex-col items-center gap-2 p-3 rounded-xl transition text-center ${a.color}`}
                >
                  {a.icon}
                  <span className="text-xs font-medium">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Convide & Ganhe — recompensa dupla */}
          <ReferralCard />
          {/* Gamification */}
          {points && (
            <div className="bg-gradient-to-br from-accent-500 to-accent-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5" />
                <span className="font-semibold">{t('v.dash.gamification')}</span>
              </div>
              <div className="text-3xl font-bold mb-0.5">{points.total_points} pts</div>
              <div className="text-accent-100 text-sm mb-4">{t('v.dash.level', { level: points.level, name: levelName })}</div>

              <div className="mb-1 flex justify-between text-xs text-accent-100">
                <span>{t('v.dash.progress')}</span>
                <span>{points.total_points % 1000}/1000 pts</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 mb-4">
                <div
                  className="bg-white dark:bg-surface-800 h-2 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {points.badges_earned && points.badges_earned.length > 0 && (
                <div>
                  <p className="text-xs text-accent-100 mb-2">{t('v.dash.badges')}</p>
                  <div className="flex flex-wrap gap-1">
                    {points.badges_earned.map((b, i) => (
                      <span key={i} className="text-xs bg-white/20 rounded-full px-2.5 py-0.5">{b}</span>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href="/challenges"
                className="mt-4 block text-center text-sm font-semibold bg-white/20 hover:bg-white/30 transition rounded-xl py-2"
              >
                {t('v.dash.seeChallenges')} <Star className="inline w-4 h-4 ml-1" />
              </Link>
            </div>
          )}

          {/* Reminders */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-500" />
                {t('v.dash.reminders')}
              </h2>
            </div>
            {upcomingReminders.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-4">{t('dash.noReminders')}</p>
            ) : (
              <div className="space-y-2">
                {upcomingReminders.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle className={`w-4 h-4 shrink-0 ${r.completed ? 'text-green-400' : 'text-surface-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${r.completed ? 'line-through text-surface-400' : 'text-surface-800 dark:text-surface-100'}`}>
                        {r.title}
                      </div>
                      <div className="text-xs text-surface-500 dark:text-surface-400">{formatDate(r.due_date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
