'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Clock, Zap, CheckCircle } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { routines as routinesApi, pets as petsApi, type Routine, type Pet } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { getSpeciesEmoji } from '@/lib/utils'

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function RoutinesPage() {
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
      success('Rotina gerada pela IA! 🐾')
    } catch { error('Erro ao gerar rotina.') }
    finally { setGeneratingFor(null) }
  }

  const activePet = petList.find(p => p.id === activePetId)
  const activeRoutines = activePetId ? (routinesMap[activePetId] ?? []) : []
  const activeRoutine = activeRoutines[0]

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-surface-900">Rotinas de Passeio</h1>
        <p className="text-surface-500 mt-1">Rotinas personalizadas por IA para cada pet</p>
      </div>

      {loading ? <PageLoader /> : petList.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-3">🦮</div>
          <p className="text-surface-700 font-medium mb-2">Nenhum pet cadastrado</p>
          <a href="/pets/new" className="text-primary-600 hover:underline text-sm">Cadastrar pet</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Pet list */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-surface-500 mb-3">Seus pets</p>
            {petList.map(p => {
              const hasRoutine = (routinesMap[p.id] ?? []).length > 0
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePetId(p.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left ${activePetId === p.id ? 'bg-primary-50 border-2 border-primary-300' : 'bg-white border border-surface-200 hover:border-primary-200'}`}
                >
                  <span className="text-2xl">{getSpeciesEmoji(p.species)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-surface-900 text-sm">{p.name}</div>
                    <div className="text-xs text-surface-500">{hasRoutine ? '✅ Com rotina' : '⚡ Sem rotina'}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Routine detail */}
          <div className="lg:col-span-3">
            {activePet && (
              <div className="bg-white rounded-2xl border border-surface-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getSpeciesEmoji(activePet.species)}</span>
                    <div>
                      <h2 className="text-xl font-bold text-surface-900">{activePet.name}</h2>
                      <p className="text-sm text-surface-500">{activePet.breed?.name ?? 'Sem raça'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleGenerate(activePet.id)}
                    disabled={generatingFor === activePet.id}
                    className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-60 transition"
                  >
                    {generatingFor === activePet.id ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {activeRoutine ? 'Regenerar' : 'Gerar Rotina IA'}
                  </button>
                </div>

                {!activeRoutine ? (
                  <div className="text-center py-12 bg-surface-50 rounded-2xl">
                    <div className="text-5xl mb-3 animate-paw-bounce">🐾</div>
                    <p className="text-surface-600 mb-4">Nenhuma rotina gerada ainda para {activePet.name}</p>
                    <p className="text-sm text-surface-500">Clique em "Gerar Rotina IA" para criar uma rotina personalizada baseada na raça, idade e nível de energia.</p>
                  </div>
                ) : (
                  <>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-primary-50 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-primary-700">{activeRoutine.walks_per_day}x</div>
                        <div className="text-xs text-primary-600 mt-1">passeios/dia</div>
                      </div>
                      <div className="bg-accent-50 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-accent-700">{activeRoutine.walk_duration_minutes}min</div>
                        <div className="text-xs text-accent-600 mt-1">por passeio</div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4 text-center">
                        <div className="text-3xl font-bold text-green-700">
                          {activeRoutine.walks_per_day * activeRoutine.walk_duration_minutes}min
                        </div>
                        <div className="text-xs text-green-600 mt-1">exercício total/dia</div>
                      </div>
                    </div>

                    {/* Time slots */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-surface-700 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary-500" />
                        Horários Recomendados
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {activeRoutine.walk_times.map((t, i) => (
                          <div key={i} className="flex items-center gap-2 bg-primary-100 rounded-xl px-4 py-2.5">
                            <Zap className="w-4 h-4 text-primary-600" />
                            <span className="text-base font-bold text-primary-700">{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Weekly grid */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-surface-700 mb-3">Grade Semanal</h3>
                      <div className="grid grid-cols-7 gap-1">
                        {DAYS_OF_WEEK.map((day, i) => (
                          <div key={day} className="text-center">
                            <div className="text-xs font-medium text-surface-500 mb-1">{day}</div>
                            <div className="space-y-1">
                              {activeRoutine.walk_times.map((t, j) => (
                                <div
                                  key={j}
                                  className={`text-xs py-1 rounded-lg font-medium ${i === 0 || i === 6 ? 'bg-accent-100 text-accent-700' : 'bg-primary-100 text-primary-700'}`}
                                >
                                  {t}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Exercise type */}
                    {activeRoutine.exercise_type && (
                      <div className="mb-6 p-3 bg-surface-50 rounded-xl">
                        <span className="text-sm font-medium text-surface-700">Tipo de exercício: </span>
                        <span className="text-sm text-surface-600">{activeRoutine.exercise_type}</span>
                      </div>
                    )}

                    {/* Tips */}
                    {activeRoutine.tips && activeRoutine.tips.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-surface-700 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Dicas da IA
                        </h3>
                        <ul className="space-y-2">
                          {activeRoutine.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-surface-600 bg-green-50 rounded-xl px-3 py-2.5">
                              <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
