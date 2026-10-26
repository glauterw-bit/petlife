'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Clock, CheckCircle2, Route, Lightbulb, Dumbbell } from 'lucide-react'
import { motion } from 'framer-motion'
import { routines as routinesApi, pets as petsApi, type Routine, type Pet } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { cn } from '@/lib/utils'
import { hapticSelect, hapticSuccess } from '@/lib/feedback'
import { spring } from '@/lib/motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { SkeletonHero, SkeletonRow } from '@/components/ui/Skeleton'

const DAYS_OF_WEEK = ['g.rt.dow0', 'g.rt.dow1', 'g.rt.dow2', 'g.rt.dow3', 'g.rt.dow4', 'g.rt.dow5', 'g.rt.dow6']

export default function RoutinesPage() {
  const t = useT()
  const { success, error } = useToast()
  const [petList, setPetList] = useState<Pet[]>([])
  const [routinesMap, setRoutinesMap] = useState<Record<number, Routine[]>>({})
  const [loading, setLoading] = useState(true)
  const [generatingFor, setGeneratingFor] = useState<number | null>(null)
  const [activePetId, setActivePetId] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const pets = await petsApi.list()
        setPetList(pets)
        if (pets.length > 0) {
          setActivePetId(pets[0].id)
          const results = await Promise.allSettled(pets.map(p => routinesApi.getByPet(p.id)))
          const map: Record<number, Routine[]> = {}
          pets.forEach((p, i) => {
            const r = results[i]
            map[p.id] = r.status === 'fulfilled' ? r.value : []
          })
          setRoutinesMap(map)
        }
      } finally { setLoading(false) }
    }
    load()
  }, [])

  async function handleGenerate(petId: number) {
    setGeneratingFor(petId)
    try {
      const r = await routinesApi.generate(petId)
      setRoutinesMap(prev => ({ ...prev, [petId]: [r] }))
      void hapticSuccess()
      success(t('g.rt.generated'))
    } catch { error(t('g.rt.errGenerate')) }
    finally { setGeneratingFor(null) }
  }

  const activePet = petList.find(p => p.id === activePetId)
  const activeRoutines = activePetId ? (routinesMap[activePetId] ?? []) : []
  const activeRoutine = activeRoutines[0]
  // Rotinas antigas podem vir sem horários; ler direto estourava a tela toda.
  const walkTimes = activeRoutine?.walk_times ?? []
  const perDay = activeRoutine?.walks_per_day ?? 0
  const perWalk = activeRoutine?.walk_duration_minutes ?? 0

  return (
    <>
      <PageHeader title={t('g.rt.title')} subtitle={t('g.rt.subtitle')} />

      {loading ? (
        <div className="space-y-4" aria-hidden>
          <SkeletonRow />
          <SkeletonHero />
        </div>
      ) : petList.length === 0 ? (
        <EmptyState icon={Route} title={t('g.rt.noPets')} ctaLabel={t('g.rt.registerPet')} ctaHref="/pets/new" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 pb-6">
          {/* Pets */}
          <div>
            <p id="rt-pets" className="text-[13px] font-bold uppercase tracking-wide text-surface-600 dark:text-surface-300 mb-2.5">{t('g.rt.yourPets')}</p>
            <div role="radiogroup" aria-labelledby="rt-pets" className="-mx-4 px-4 flex lg:flex-col gap-2 overflow-x-auto no-scrollbar lg:mx-0 lg:px-0">
              {petList.map(p => {
                const hasRoutine = (routinesMap[p.id] ?? []).length > 0
                const active = activePetId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { if (!active) { void hapticSelect(); setActivePetId(p.id) } }}
                    className={cn(
                      'pressable relative shrink-0 min-w-[160px] lg:w-full flex items-center gap-3 p-2.5 pr-4 rounded-2xl border text-left transition-colors',
                      active
                        ? 'border-primary-600 dark:border-primary-400'
                        : 'bg-white border-surface-200/70 hover:bg-surface-50 dark:bg-surface-900 dark:border-surface-800 dark:hover:bg-surface-800',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="rt-pet-pill"
                        transition={spring.snappy}
                        aria-hidden
                        className="absolute inset-0 rounded-2xl bg-primary-50 dark:bg-primary-500/15"
                      />
                    )}
                    <PetAvatar pet={p} size={40} className="relative" />
                    <span className="relative min-w-0">
                      <span className="block font-semibold text-surface-900 dark:text-white text-sm truncate">{p.name}</span>
                      <span className="block text-xs text-surface-600 dark:text-surface-400">{hasRoutine ? t('g.rt.hasRoutine') : t('g.rt.noRoutine')}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Rotina */}
          <div className="lg:col-span-3">
            {activePet && (
              <Card padding="lg">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <PetAvatar pet={activePet} size={48} />
                    <div className="min-w-0">
                      <h2 className="font-display text-xl font-bold text-surface-900 dark:text-white truncate">{activePet.name}</h2>
                      <p className="text-sm text-surface-600 dark:text-surface-400 truncate">{activePet.breed?.name ?? t('g.rt.noBreed')}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={activeRoutine ? 'secondary' : 'primary'}
                    leftIcon={Sparkles}
                    loading={generatingFor === activePet.id}
                    onClick={() => handleGenerate(activePet.id)}
                  >
                    {activeRoutine ? t('g.rt.regenerate') : t('g.rt.generateAi')}
                  </Button>
                </div>

                {!activeRoutine ? (
                  <div className="rounded-2xl bg-surface-50 dark:bg-surface-950/60">
                    <EmptyState icon={Route} title={t('g.rt.emptyTitle', { name: activePet.name })} text={t('g.rt.emptyText')} />
                  </div>
                ) : (
                  <>
                    {/* Números */}
                    <div className="grid grid-cols-3 gap-2.5 mb-6">
                      {[
                        { v: `${perDay}x`, l: t('g.rt.walksPerDay') },
                        { v: `${perWalk}min`, l: t('g.rt.perWalk') },
                        { v: `${perDay * perWalk}min`, l: t('g.rt.totalPerDay') },
                      ].map(x => (
                        <div key={x.l} className="tone-brand-bg border rounded-2xl p-3 text-center">
                          <div className="text-2xl font-extrabold font-display tabular-nums text-primary-800 dark:text-primary-200">{x.v}</div>
                          <div className="text-xs text-surface-600 dark:text-surface-300 mt-1 leading-tight">{x.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Horários */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-100 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
                        {t('g.rt.recommendedTimes')}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {/* `time`, não `t`: sombrear a função de tradução aqui dentro
                            já foi motivo de bug e some com o t() do escopo. */}
                        {walkTimes.map((time, i) => (
                          <span key={i} className="inline-flex items-center rounded-xl px-4 py-2.5 bg-primary-50 text-primary-800 dark:bg-primary-500/15 dark:text-primary-200 text-base font-bold tabular-nums">
                            {time}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Semana */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-100 mb-3">{t('g.rt.weeklyGrid')}</h3>
                      <div className="grid grid-cols-7 gap-1">
                        {DAYS_OF_WEEK.map((dayKey, i) => (
                          <div key={dayKey} className="text-center">
                            <div className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">{t(dayKey)}</div>
                            <div className="space-y-1">
                              {walkTimes.map((time, j) => (
                                <div
                                  key={j}
                                  className={cn(
                                    'text-[11px] py-1 rounded-lg font-semibold tabular-nums',
                                    i === 0 || i === 6
                                      ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                                      : 'bg-primary-50 text-primary-800 dark:bg-primary-500/15 dark:text-primary-200',
                                  )}
                                >
                                  {time}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {activeRoutine.exercise_type && (
                      <div className="mb-6 p-3 rounded-xl bg-surface-50 dark:bg-surface-950/60 flex items-start gap-2">
                        <Dumbbell className="w-4 h-4 mt-0.5 text-surface-600 dark:text-surface-300 shrink-0" aria-hidden />
                        <p className="text-sm">
                          <span className="font-semibold text-surface-800 dark:text-surface-100">{t('g.rt.exerciseType')} </span>
                          <span className="text-surface-700 dark:text-surface-300">{activeRoutine.exercise_type}</span>
                        </p>
                      </div>
                    )}

                    {activeRoutine.tips && activeRoutine.tips.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-100 mb-3 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />
                          {t('g.rt.aiTips')}
                        </h3>
                        <ul className="space-y-2">
                          {activeRoutine.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-surface-700 dark:text-surface-200 tone-success-bg border rounded-xl px-3 py-2.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5" aria-hidden />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  )
}
