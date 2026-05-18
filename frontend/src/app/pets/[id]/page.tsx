'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft, Edit2, Camera, PawPrint, Heart, Route, History,
  Stethoscope, Sparkles, Calendar, Weight, Trash2, Plus,
  AlertTriangle, CheckCircle, AlertCircle, Info
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { VaccineTimeline } from '@/components/health/VaccineTimeline'
import { ExamCard } from '@/components/health/ExamCard'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import {
  pets as petsApi, vaccines as vaccinesApi, exams as examsApi,
  anamnesis as anamnesisApi, routines as routinesApi, breeds as breedsApi,
  type Pet, type Vaccine, type Exam, type Anamnesis, type Routine, type CareGuide, type AIAnalysis
} from '@/lib/api'
import { formatDate, formatAge, getSpeciesEmoji, getSizeLabel, getEnergyLabel } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastContext'
import { cn } from '@/lib/utils'
import { BedtimeStoryModal } from '@/components/innovations/BedtimeStoryModal'
import { SnapshotTriageModal } from '@/components/innovations/SnapshotTriageModal'
import { BookOpen } from 'lucide-react'

type Tab = 'overview' | 'health' | 'routine' | 'history' | 'anamnesis' | 'care'

export default function PetProfilePage() {
  const { id } = useParams()
  const router = useRouter()
  const { success, error: showError } = useToast()

  const [pet, setPet] = useState<Pet | null>(null)
  const [vaccines, setVaccines] = useState<Vaccine[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [anamnesisHistory, setAnamnesisHistory] = useState<Anamnesis[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [careGuide, setCareGuide] = useState<CareGuide | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [generatingRoutine, setGeneratingRoutine] = useState(false)
  const [generatingCare, setGeneratingCare] = useState(false)
  const [suggestions, setSuggestions] = useState<Awaited<ReturnType<typeof breedsApi.petHealthSuggestions>> | null>(null)
  const [storyOpen, setStoryOpen] = useState(false)
  const [snapshotOpen, setSnapshotOpen] = useState(false)

  // Anamnesis form
  const [anamForm, setAnamForm] = useState({ symptoms: '', duration: '', behavior_changes: '', appetite: '', water_intake: '', medications: '', notes: '' })
  const [submitingAnam, setSubmitingAnam] = useState(false)
  const [anamAnalysis, setAnamAnalysis] = useState<AIAnalysis | null>(null)

  const petId = Number(id)

  useEffect(() => {
    async function load() {
      try {
        const [p, v, e, a, r] = await Promise.allSettled([
          petsApi.getById(petId),
          vaccinesApi.list(petId),
          examsApi.list(petId),
          anamnesisApi.getByPet(petId),
          routinesApi.getByPet(petId),
        ])
        if (p.status === 'fulfilled') setPet(p.value)
        else { router.push('/pets'); return }

        breedsApi.petHealthSuggestions(petId).then(setSuggestions).catch(() => {})
        if (v.status === 'fulfilled') setVaccines(v.value)
        if (e.status === 'fulfilled') setExams(e.value)
        if (a.status === 'fulfilled') setAnamnesisHistory(a.value)
        if (r.status === 'fulfilled') setRoutines(r.value)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [petId, router])

  async function handleGenerateRoutine() {
    setGeneratingRoutine(true)
    try {
      const r = await routinesApi.generate(petId)
      setRoutines([r])
      success('Rotina gerada pela IA! 🐾')
    } catch { showError('Erro ao gerar rotina.') }
    finally { setGeneratingRoutine(false) }
  }

  async function handleLoadCareGuide() {
    if (!pet?.breed_id) return
    setGeneratingCare(true)
    try {
      const g = await breedsApi.getCareGuide(pet.breed_id)
      setCareGuide(g)
    } catch { showError('Erro ao carregar guia de cuidados.') }
    finally { setGeneratingCare(false) }
  }

  async function handleAnamSubmit(e: FormEvent) {
    e.preventDefault()
    if (!anamForm.symptoms.trim()) { showError('Descreva os sintomas.'); return }
    setSubmitingAnam(true)
    setAnamAnalysis(null)
    try {
      const result = await anamnesisApi.create({ pet_id: petId, ...anamForm })
      setAnamnesisHistory(prev => [result, ...prev])
      if (result.ai_analysis) setAnamAnalysis(result.ai_analysis)
      success('Anamnese registrada com análise IA!')
      setAnamForm({ symptoms: '', duration: '', behavior_changes: '', appetite: '', water_intake: '', medications: '', notes: '' })
    } catch { showError('Erro ao registrar anamnese.') }
    finally { setSubmitingAnam(false) }
  }

  async function handleDeleteVaccine(vid: number) {
    if (!confirm('Excluir esta vacina?')) return
    await vaccinesApi.delete(vid).catch(() => {})
    setVaccines(prev => prev.filter(v => v.id !== vid))
    success('Vacina excluída.')
  }

  async function handleDeleteExam(eid: number) {
    if (!confirm('Excluir este exame?')) return
    await examsApi.delete(eid).catch(() => {})
    setExams(prev => prev.filter(e => e.id !== eid))
    success('Exame excluído.')
  }

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>
  if (!pet) return null

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Visão Geral', icon: <PawPrint className="w-4 h-4" /> },
    { id: 'health', label: 'Saúde', icon: <Heart className="w-4 h-4" /> },
    { id: 'routine', label: 'Rotina', icon: <Route className="w-4 h-4" /> },
    { id: 'history', label: 'Histórico', icon: <History className="w-4 h-4" /> },
    { id: 'anamnesis', label: 'Anamnese', icon: <Stethoscope className="w-4 h-4" /> },
    { id: 'care', label: 'Cuidados IA', icon: <Sparkles className="w-4 h-4" /> },
  ]

  const urgencyConfig = {
    low: { icon: <Info className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50 border-blue-200', label: 'Baixa urgência', text: 'text-blue-700' },
    medium: { icon: <AlertCircle className="w-5 h-5 text-yellow-500" />, bg: 'bg-yellow-50 border-yellow-200', label: 'Urgência moderada', text: 'text-yellow-700' },
    high: { icon: <AlertTriangle className="w-5 h-5 text-orange-500" />, bg: 'bg-orange-50 border-orange-200', label: 'Alta urgência', text: 'text-orange-700' },
    emergency: { icon: <AlertTriangle className="w-5 h-5 text-red-500" />, bg: 'bg-red-50 border-red-200', label: '🚨 EMERGÊNCIA', text: 'text-red-700' },
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-surface-100 transition">
          <ArrowLeft className="w-5 h-5 text-surface-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-surface-900">{pet.name}</h1>
          <p className="text-surface-500 text-sm">{pet.breed?.name ?? ''} {pet.birth_date ? `• ${formatAge(pet.birth_date)}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSnapshotOpen(true)}
            aria-label="Triagem por foto"
            className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold px-3 py-2 rounded-xl transition shadow-md shadow-primary-500/30"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Triagem</span>
          </button>
          <button
            onClick={() => setStoryOpen(true)}
            aria-label="História de boa noite"
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-3 py-2 rounded-xl transition shadow-md shadow-indigo-500/30"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">História</span>
          </button>
        </div>
      </div>

      <BedtimeStoryModal petId={petId} petName={pet.name} open={storyOpen} onClose={() => setStoryOpen(false)} />
      <SnapshotTriageModal petId={petId} petName={pet.name} open={snapshotOpen} onClose={() => setSnapshotOpen(false)} />

      {/* Pet card summary */}
      <div className="bg-white rounded-2xl border border-surface-100 p-6 mb-6">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
              {pet.photo_url ? (
                <Image src={pet.photo_url} alt={pet.name} width={96} height={96} className="object-cover w-full h-full" />
              ) : (
                <span className="text-5xl">{getSpeciesEmoji(pet.species)}</span>
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 bg-primary-500 text-white rounded-xl p-1.5 cursor-pointer hover:bg-primary-600 transition">
              <Camera className="w-3.5 h-3.5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try { await petsApi.uploadPhoto(pet.id, f); success('Foto atualizada!') }
                  catch { showError('Erro ao atualizar foto.') }
                }}
              />
            </label>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Idade', value: formatAge(pet.birth_date), icon: <Calendar className="w-4 h-4 text-primary-500" /> },
              { label: 'Peso', value: pet.weight ? `${pet.weight} kg` : '—', icon: <Weight className="w-4 h-4 text-primary-500" /> },
              { label: 'Sexo', value: pet.gender === 'male' ? '♂ Macho' : pet.gender === 'female' ? '♀ Fêmea' : '—', icon: null },
              { label: 'Castrado', value: pet.neutered ? 'Sim ✂' : pet.neutered === false ? 'Não' : '—', icon: null },
            ].map(i => (
              <div key={i.label}>
                <div className="text-xs text-surface-400 mb-0.5">{i.label}</div>
                <div className="text-sm font-semibold text-surface-800">{i.value}</div>
              </div>
            ))}
          </div>
        </div>
        {pet.bio && <p className="mt-4 text-sm text-surface-600 italic border-t border-surface-100 pt-4">{pet.bio}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-6 bg-white rounded-2xl border border-surface-100 p-1.5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap',
              tab === t.id ? 'bg-primary-500 text-white' : 'text-surface-600 hover:bg-surface-50'
            )}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-surface-100 p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Dados da Raça</h3>
              {pet.breed ? (
                <div className="space-y-3">
                  <div className="text-sm"><span className="font-medium text-surface-700">Raça:</span> <span className="text-surface-600">{pet.breed.name}</span></div>
                  {pet.breed.size && <div className="text-sm"><span className="font-medium text-surface-700">Porte:</span> <span className="text-surface-600">{getSizeLabel(pet.breed.size)}</span></div>}
                  {pet.breed.energy_level && <div className="text-sm"><span className="font-medium text-surface-700">Energia:</span> <span className="text-surface-600">{getEnergyLabel(pet.breed.energy_level)}</span></div>}
                  {pet.breed.life_expectancy_min && (
                    <div className="text-sm"><span className="font-medium text-surface-700">Expectativa de vida:</span> <span className="text-surface-600">{pet.breed.life_expectancy_min}–{pet.breed.life_expectancy_max} anos</span></div>
                  )}
                  {pet.breed.temperament && pet.breed.temperament.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-surface-700 mb-1.5">Temperamento:</div>
                      <div className="flex flex-wrap gap-1">
                        {pet.breed.temperament.map((t, i) => (
                          <span key={i} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {pet.breed.description && (
                    <p className="text-sm text-surface-600 leading-relaxed">{pet.breed.description}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-surface-400">Raça não informada</p>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-surface-100 p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Resumo de Saúde</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-600">Total de vacinas</span>
                  <span className="font-semibold text-surface-900">{vaccines.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-600">Total de exames</span>
                  <span className="font-semibold text-surface-900">{exams.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-600">Anamneses</span>
                  <span className="font-semibold text-surface-900">{anamnesisHistory.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-600">Rotinas</span>
                  <span className="font-semibold text-surface-900">{routines.length}</span>
                </div>
                {pet.microchip && (
                  <div className="flex justify-between items-center text-sm border-t border-surface-100 pt-3">
                    <span className="text-surface-600">Microchip</span>
                    <span className="font-mono text-xs text-surface-700">{pet.microchip}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sugestões inteligentes baseadas em fase de vida + vacinas já aplicadas */}
          {suggestions && suggestions.suggestions.length > 0 && (
            <div className="bg-gradient-to-br from-primary-50 via-white to-emerald-50 rounded-2xl border border-primary-200 p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-base">🧬</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-surface-900">Plano de saúde sugerido</h3>
                    <p className="text-xs text-surface-500">
                      Fase: <span className="font-semibold text-primary-700">{suggestions.phase_label}</span>
                      {suggestions.age_months !== null && ` · ${suggestions.age_months} meses`}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-surface-400">Baseado em WSAVA / CRMV</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {suggestions.suggestions.map((s, i) => {
                  const urgencyClasses = s.urgency === 'alta'
                    ? 'border-red-200 bg-red-50/40'
                    : s.urgency === 'media'
                    ? 'border-amber-200 bg-amber-50/40'
                    : 'border-emerald-200 bg-emerald-50/40'
                  const urgencyDot = s.urgency === 'alta' ? 'bg-red-500' : s.urgency === 'media' ? 'bg-amber-500' : 'bg-emerald-500'
                  return (
                    <div key={i} className={cn('rounded-xl border p-3', urgencyClasses)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', urgencyDot)} />
                        <span className="font-semibold text-sm text-surface-900">{s.title}</span>
                      </div>
                      <p className="text-xs text-surface-600 leading-relaxed">{s.description}</p>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-surface-500 mt-3 italic">
                Estas sugestões são orientativas e não substituem consulta veterinária.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'health' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-surface-900">Vacinas</h2>
            <a href="/health/vaccines" className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
              <Plus className="w-4 h-4" /> Adicionar
            </a>
          </div>
          <VaccineTimeline vaccines={vaccines} onDelete={handleDeleteVaccine} />

          <div className="border-t border-surface-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-surface-900">Exames</h2>
              <a href="/health/exams" className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
                <Plus className="w-4 h-4" /> Adicionar
              </a>
            </div>
            {exams.length === 0 ? (
              <div className="text-center py-8 text-surface-400">
                <div className="text-4xl mb-2">🔬</div>
                <p>Nenhum exame registrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {exams.map(e => <ExamCard key={e.id} exam={e} onDelete={handleDeleteExam} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'routine' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-surface-900">Rotinas de Passeio</h2>
            <button
              onClick={handleGenerateRoutine}
              disabled={generatingRoutine}
              className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-60 transition"
            >
              {generatingRoutine ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {routines.length > 0 ? 'Regenerar com IA' : 'Gerar Rotina com IA'}
            </button>
          </div>
          {routines.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-surface-100">
              <div className="text-5xl mb-3">🦮</div>
              <h3 className="font-semibold text-surface-900 mb-1">Nenhuma rotina criada</h3>
              <p className="text-surface-500 text-sm mb-4">Clique em "Gerar Rotina com IA" para criar uma rotina personalizada</p>
            </div>
          ) : (
            routines.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-surface-100 p-6">
                <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                  <div className="bg-primary-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-primary-700">{r.walks_per_day}x</div>
                    <div className="text-xs text-primary-600">por dia</div>
                  </div>
                  <div className="bg-accent-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-accent-700">{r.walk_duration_minutes}min</div>
                    <div className="text-xs text-accent-600">por passeio</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-green-700">{r.walks_per_day * r.walk_duration_minutes}min</div>
                    <div className="text-xs text-green-600">total/dia</div>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-sm font-medium text-surface-700 mb-2">Horários sugeridos:</p>
                  <div className="flex flex-wrap gap-2">
                    {r.walk_times.map((t, i) => (
                      <span key={i} className="bg-primary-100 text-primary-700 text-sm font-semibold px-3 py-1.5 rounded-xl">{t}</span>
                    ))}
                  </div>
                </div>
                {r.exercise_type && (
                  <div className="mb-4 text-sm">
                    <span className="font-medium text-surface-700">Tipo de exercício:</span>{' '}
                    <span className="text-surface-600">{r.exercise_type}</span>
                  </div>
                )}
                {r.tips && r.tips.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-surface-700 mb-2">Dicas:</p>
                    <ul className="space-y-1">
                      {r.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-surface-600">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="animate-fade-in">
          <h2 className="text-xl font-bold text-surface-900 mb-6">Histórico de Anamneses</h2>
          {anamnesisHistory.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-surface-100">
              <div className="text-5xl mb-3">📋</div>
              <p className="text-surface-500">Nenhuma anamnese registrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {anamnesisHistory.map(a => {
                const u = a.ai_analysis?.urgency_level
                const cfg = u ? urgencyConfig[u] : null
                return (
                  <div key={a.id} className="bg-white rounded-2xl border border-surface-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-surface-500">{formatDate(a.created_at, 'dd/MM/yyyy HH:mm')}</span>
                      {cfg && (
                        <span className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border', cfg.bg, cfg.text)}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-surface-800 font-medium mb-2">Sintomas:</div>
                    <p className="text-sm text-surface-600 mb-3">{a.symptoms}</p>
                    {a.ai_analysis && (
                      <div className={cn('rounded-xl p-3 border', cfg?.bg)}>
                        <p className="text-sm font-medium mb-2">Análise IA:</p>
                        <p className="text-sm text-surface-700 mb-2">{a.ai_analysis.summary}</p>
                        {a.ai_analysis.recommendations.length > 0 && (
                          <ul className="space-y-1">
                            {a.ai_analysis.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-surface-600">
                                <span className="mt-0.5">•</span> {rec}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'anamnesis' && (
        <div className="animate-fade-in">
          <h2 className="text-xl font-bold text-surface-900 mb-2">Nova Anamnese</h2>
          <p className="text-surface-500 text-sm mb-6">Descreva os sintomas e nossa IA irá analisar e recomendar os próximos passos.</p>

          {anamAnalysis && (
            <div className={cn('mb-6 rounded-2xl p-5 border', urgencyConfig[anamAnalysis.urgency_level].bg)}>
              <div className={cn('flex items-center gap-2 font-bold mb-3', urgencyConfig[anamAnalysis.urgency_level].text)}>
                {urgencyConfig[anamAnalysis.urgency_level].icon}
                Análise IA — {urgencyConfig[anamAnalysis.urgency_level].label}
              </div>
              <p className="text-sm text-surface-800 mb-3">{anamAnalysis.summary}</p>
              {anamAnalysis.seek_vet_immediately && (
                <div className="bg-red-100 text-red-800 text-sm font-semibold p-3 rounded-xl mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Procure um veterinário IMEDIATAMENTE!
                </div>
              )}
              <div>
                <p className="text-sm font-semibold mb-2">Recomendações:</p>
                <ul className="space-y-1">
                  {anamAnalysis.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-surface-700">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <form onSubmit={handleAnamSubmit} className="bg-white rounded-2xl border border-surface-100 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Sintomas observados *</label>
              <textarea
                required
                value={anamForm.symptoms}
                onChange={e => setAnamForm(f => ({ ...f, symptoms: e.target.value }))}
                rows={3}
                placeholder="Ex: Tosse frequente, perda de apetite, letargia..."
                className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Há quanto tempo?</label>
                <input type="text" value={anamForm.duration} onChange={e => setAnamForm(f => ({ ...f, duration: e.target.value }))} placeholder="Ex: 2 dias, 1 semana..." className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Apetite</label>
                <select value={anamForm.appetite} onChange={e => setAnamForm(f => ({ ...f, appetite: e.target.value }))} className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                  <option value="">Selecionar</option>
                  <option value="normal">Normal</option>
                  <option value="reduced">Reduzido</option>
                  <option value="absent">Ausente</option>
                  <option value="increased">Aumentado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Ingestão de água</label>
                <select value={anamForm.water_intake} onChange={e => setAnamForm(f => ({ ...f, water_intake: e.target.value }))} className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                  <option value="">Selecionar</option>
                  <option value="normal">Normal</option>
                  <option value="reduced">Reduzida</option>
                  <option value="increased">Aumentada (polidipsia)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Mudanças de comportamento</label>
                <input type="text" value={anamForm.behavior_changes} onChange={e => setAnamForm(f => ({ ...f, behavior_changes: e.target.value }))} placeholder="Ex: Mais quieto, agressivo..." className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Medicamentos em uso</label>
                <input type="text" value={anamForm.medications} onChange={e => setAnamForm(f => ({ ...f, medications: e.target.value }))} placeholder="Ex: Nenhum / nome do remédio" className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Observações adicionais</label>
              <textarea value={anamForm.notes} onChange={e => setAnamForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Qualquer informação relevante..." className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            </div>
            <button
              type="submit"
              disabled={submitingAnam}
              className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-60 transition flex items-center justify-center gap-2"
            >
              {submitingAnam ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {submitingAnam ? 'Analisando com IA...' : 'Registrar e Analisar com IA'}
            </button>
          </form>
        </div>
      )}

      {tab === 'care' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-surface-900">Guia de Cuidados IA</h2>
              <p className="text-surface-500 text-sm mt-0.5">Cuidados personalizados para a raça e idade de {pet.name}</p>
            </div>
            {pet.breed_id && !careGuide && (
              <button
                onClick={handleLoadCareGuide}
                disabled={generatingCare}
                className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-60 transition"
              >
                {generatingCare ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar Guia IA
              </button>
            )}
          </div>
          {!pet.breed_id && (
            <div className="text-center py-16 bg-white rounded-2xl border border-surface-100">
              <div className="text-5xl mb-3">🧬</div>
              <p className="text-surface-700 font-medium">Raça não informada</p>
              <p className="text-surface-500 text-sm mt-1">Cadastre a raça do seu pet para receber um guia de cuidados personalizado.</p>
            </div>
          )}
          {pet.breed_id && !careGuide && !generatingCare && (
            <div className="text-center py-16 bg-white rounded-2xl border border-surface-100">
              <div className="text-5xl mb-3">✨</div>
              <p className="text-surface-700 font-medium mb-2">Guia de cuidados não gerado ainda</p>
              <p className="text-surface-500 text-sm">Clique em "Gerar Guia IA" para receber dicas personalizadas.</p>
            </div>
          )}
          {careGuide && (
            <div className="space-y-4">
              {[
                { title: '🍽 Alimentação', content: careGuide.feeding_tips },
                { title: '🏃 Exercícios', content: careGuide.exercise_recommendations },
                { title: '✂️ Grooming', content: careGuide.grooming_guide },
                { title: '🏥 Alertas de Saúde', content: careGuide.health_alerts },
                { title: '🎓 Treinamento', content: careGuide.training_tips },
              ].map(s => (
                <div key={s.title} className="bg-white rounded-2xl border border-surface-100 p-5">
                  <h3 className="font-semibold text-surface-900 mb-3">{s.title}</h3>
                  <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-line">{s.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
