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
import { pets as petsApi, vaccines as vaccinesApi, gamification, reminders as remindersApi, type Pet, type Vaccine, type Reminder, type UserPoints } from '@/lib/api'
import { formatDate, formatAge, getSpeciesEmoji, getVaccineStatus, getLevelName, getBadgeColor } from '@/lib/utils'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { HealthScoreCard } from '@/components/health/HealthScoreCard'
import { DailyCheckin } from '@/components/health/DailyCheckin'
import { StreakFlame } from '@/components/health/StreakFlame'

export default function DashboardPage() {
  const { user } = useAuth()
  const [pets, setPets] = useState<Pet[]>([])
  const [upcomingVaccines, setUpcomingVaccines] = useState<Vaccine[]>([])
  const [upcomingReminders, setUpcomingReminders] = useState<Reminder[]>([])
  const [points, setPoints] = useState<UserPoints | null>(null)
  const [loading, setLoading] = useState(true)
  const [scoreRefresh, setScoreRefresh] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const [p, v, r, pts] = await Promise.allSettled([
          petsApi.list(),
          vaccinesApi.getUpcoming(30),
          remindersApi.getUpcoming(7),
          gamification.getUserPoints(),
        ])
        if (p.status === 'fulfilled') setPets(p.value)
        if (v.status === 'fulfilled') setUpcomingVaccines(v.value)
        if (r.status === 'fulfilled') setUpcomingReminders(r.value)
        if (pts.status === 'fulfilled') setPoints(pts.value)
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
      {/* Welcome */}
      <div className="mb-6 md:mb-8 pl-14 md:pl-0">
        <h1 className="text-2xl md:text-3xl font-bold text-surface-900 leading-tight">
          Olá, {user?.name?.split(' ')[0] ?? 'Tutor'}! 👋
        </h1>
        <p className="text-sm md:text-base text-surface-500 mt-1">
          {pets.length > 0
            ? `Você tem ${pets.length} pet${pets.length > 1 ? 's' : ''} sob seus cuidados.`
            : 'Adicione seu primeiro pet para começar!'}
        </p>
      </div>

      {/* Daily check-in + Health Score + Streak — engajamento diário */}
      {pets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <HealthScoreCard key={scoreRefresh} pet={pets[0]} />
          </div>
          <div className="lg:col-span-1 space-y-4">
            <StreakFlame key={`streak-${scoreRefresh}`} pet={pets[0]} refreshKey={scoreRefresh} />
            <DailyCheckin pet={pets[0]} onDone={() => setScoreRefresh(n => n + 1)} />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {[
          {
            icon: <PawPrint className="w-6 h-6 text-primary-500" />,
            label: 'Total de Pets',
            value: pets.length,
            bg: 'bg-primary-50',
          },
          {
            icon: <Syringe className="w-6 h-6 text-yellow-500" />,
            label: 'Vacinas Próximas',
            value: upcomingVaccines.filter(v => getVaccineStatus(v.next_due_date) === 'upcoming').length,
            bg: 'bg-yellow-50',
            alert: overdueVaccines.length > 0,
          },
          {
            icon: <Bell className="w-6 h-6 text-blue-500" />,
            label: 'Lembretes (7d)',
            value: upcomingReminders.length,
            bg: 'bg-blue-50',
          },
          {
            icon: <Trophy className="w-6 h-6 text-accent-500" />,
            label: 'Pontos',
            value: points?.total_points ?? 0,
            bg: 'bg-accent-50',
          },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-2xl p-3 md:p-4 border border-surface-100 relative`}>
            {s.alert && (
              <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
            {s.icon}
            <div className="text-xl md:text-2xl font-bold text-surface-900 mt-1.5 md:mt-2 leading-tight">{s.value}</div>
            <div className="text-xs md:text-sm text-surface-600 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pet cards */}
          <div className="bg-white rounded-2xl border border-surface-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-surface-900">Meus Pets</h2>
              <Link href="/pets" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {pets.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">🐾</div>
                <p className="text-surface-500 mb-4">Nenhum pet cadastrado ainda</p>
                <Link
                  href="/pets/new"
                  className="inline-flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar pet
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {pets.slice(0, 3).map(pet => (
                  <Link
                    key={pet.id}
                    href={`/pets/${pet.id}`}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-50 transition group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                      {pet.photo_url ? (
                        <Image src={pet.photo_url} alt={pet.name} width={56} height={56} className="object-cover w-full h-full rounded-2xl" />
                      ) : (
                        getSpeciesEmoji(pet.species)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-surface-900 group-hover:text-primary-600 transition">{pet.name}</div>
                      <div className="text-sm text-surface-500">{pet.breed?.name ?? '—'} • {formatAge(pet.birth_date)}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-1 transition" />
                  </Link>
                ))}
                {pets.length > 3 && (
                  <Link href="/pets" className="block text-center text-sm text-primary-600 hover:underline py-2">
                    +{pets.length - 3} outros pets
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Upcoming vaccines */}
          {upcomingVaccines.length > 0 && (
            <div className="bg-white rounded-2xl border border-surface-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                  <Syringe className="w-5 h-5 text-yellow-500" />
                  Vacinas em Atenção
                </h2>
                <Link href="/health/vaccines" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                  Ver todas <ArrowRight className="w-4 h-4" />
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
                        <div className="text-sm font-medium text-surface-900">{v.name}</div>
                        <div className="text-xs text-surface-500">{v.pet?.name ?? ''} • Vence: {formatDate(v.next_due_date)}</div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {isOverdue ? '🔴 Atrasada' : '⚠️ Próxima'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-surface-100 p-5">
            <h2 className="text-lg font-bold text-surface-900 mb-4">Ações Rápidas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { href: '/walks/active', icon: <Footprints className="w-5 h-5" />, label: 'Passear agora', color: 'text-primary-600 bg-primary-50 hover:bg-primary-100' },
                { href: '/health/vaccines', icon: <Syringe className="w-5 h-5" />, label: 'Nova Vacina', color: 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' },
                { href: '/health/exams', icon: <FlaskConical className="w-5 h-5" />, label: 'Novo Exame', color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
                { href: '/challenges', icon: <Trophy className="w-5 h-5" />, label: 'Desafios', color: 'text-accent-600 bg-accent-50 hover:bg-accent-100' },
                { href: '/pets/new', icon: <PawPrint className="w-5 h-5" />, label: 'Novo Pet', color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
                { href: '/nearby', icon: <TrendingUp className="w-5 h-5" />, label: 'Clínicas Próximas', color: 'text-green-600 bg-green-50 hover:bg-green-100' },
              ].map(a => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition text-center ${a.color}`}
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
          {/* Gamification */}
          {points && (
            <div className="bg-gradient-to-br from-accent-500 to-accent-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5" />
                <span className="font-semibold">Gamificação</span>
              </div>
              <div className="text-3xl font-bold mb-0.5">{points.total_points} pts</div>
              <div className="text-accent-100 text-sm mb-4">Nível {points.level} — {levelName}</div>

              <div className="mb-1 flex justify-between text-xs text-accent-100">
                <span>Progresso</span>
                <span>{points.total_points % 1000}/1000 pts</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 mb-4">
                <div
                  className="bg-white h-2 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {points.badges_earned && points.badges_earned.length > 0 && (
                <div>
                  <p className="text-xs text-accent-100 mb-2">Badges conquistados:</p>
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
                Ver desafios <Star className="inline w-4 h-4 ml-1" />
              </Link>
            </div>
          )}

          {/* Reminders */}
          <div className="bg-white rounded-2xl border border-surface-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-surface-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-500" />
                Lembretes
              </h2>
            </div>
            {upcomingReminders.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-4">Nenhum lembrete próximo</p>
            ) : (
              <div className="space-y-2">
                {upcomingReminders.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle className={`w-4 h-4 shrink-0 ${r.completed ? 'text-green-400' : 'text-surface-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${r.completed ? 'line-through text-surface-400' : 'text-surface-800'}`}>
                        {r.title}
                      </div>
                      <div className="text-xs text-surface-500">{formatDate(r.due_date)}</div>
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
