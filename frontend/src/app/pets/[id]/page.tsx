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
import { PainAssessmentModal } from '@/components/innovations/PainAssessmentModal'
import { StoolAnalysisModal } from '@/components/innovations/StoolAnalysisModal'
import { WeightChart } from '@/components/innovations/WeightChart'
import { BehaviorLogModal } from '@/components/innovations/BehaviorLogModal'
import { SeniorProtocolCard } from '@/components/innovations/SeniorProtocolCard'
import { StoriesFeed } from '@/components/innovations/StoriesFeed'
import { SharePetModal } from '@/components/innovations/SharePetModal'
import { PublicProfileModal } from '@/components/growth/PublicProfileModal'
import { FamilyTreeSection } from '@/components/innovations/FamilyTreeSection'
import { HealthForecast } from '@/components/health/HealthForecast'
import { ExpensesCard } from '@/components/innovations/ExpensesCard'
import { RecapCard } from '@/components/innovations/RecapCard'
import { EnrichmentCard } from '@/components/innovations/EnrichmentCard'
import { petExport } from '@/lib/api'
import { BookOpen, Brain, PartyPopper, Smile, Image as ImageIcon, Users, GitFork } from 'lucide-react'
import { useT } from '@/contexts/LocaleContext'

type Tab = 'overview' | 'health' | 'routine' | 'history' | 'anamnesis' | 'care' | 'stories' | 'family'

export default function PetProfilePage() {
  const t = useT()
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
  const [painOpen, setPainOpen] = useState(false)
  const [stoolOpen, setStoolOpen] = useState(false)
  const [behaviorLogOpen, setBehaviorLogOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [publicOpen, setPublicOpen] = useState(false)

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
      success(t('pw.pet.routineGenerated'))
    } catch { showError(t('pw.pet.routineError')) }
    finally { setGeneratingRoutine(false) }
  }

  async function handleLoadCareGuide() {
    if (!pet?.breed_id) return
    setGeneratingCare(true)
    try {
      const g = await breedsApi.getCareGuide(pet.breed_id)
      setCareGuide(g)
    } catch { showError(t('pw.pet.careLoadError')) }
    finally { setGeneratingCare(false) }
  }

  async function handleAnamSubmit(e: FormEvent) {
    e.preventDefault()
    if (!anamForm.symptoms.trim()) { showError(t('pw.pet.symptomsRequired')); return }
    setSubmitingAnam(true)
    setAnamAnalysis(null)
    try {
      const result = await anamnesisApi.create({ pet_id: petId, ...anamForm })
      setAnamnesisHistory(prev => [result, ...prev])
      if (result.ai_analysis) setAnamAnalysis(result.ai_analysis)
      success(t('pw.pet.anamSaved'))
      setAnamForm({ symptoms: '', duration: '', behavior_changes: '', appetite: '', water_intake: '', medications: '', notes: '' })
    } catch { showError(t('pw.pet.anamError')) }
    finally { setSubmitingAnam(false) }
  }

  async function handleDeleteVaccine(vid: number) {
    if (!confirm(t('pw.pet.deleteVaccineConfirm'))) return
    await vaccinesApi.delete(vid).catch(() => {})
    setVaccines(prev => prev.filter(v => v.id !== vid))
    success(t('pw.pet.vaccineDeleted'))
  }

  async function handleDeleteExam(eid: number) {
    if (!confirm(t('pw.pet.deleteExamConfirm'))) return
    await examsApi.delete(eid).catch(() => {})
    setExams(prev => prev.filter(e => e.id !== eid))
    success(t('pw.pet.examDeleted'))
  }

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>
  if (!pet) return null

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('pw.pet.tabOverview'), icon: <PawPrint className="w-4 h-4" /> },
    { id: 'health', label: t('nav.health'), icon: <Heart className="w-4 h-4" /> },
    { id: 'routine', label: t('pw.pet.tabRoutine'), icon: <Route className="w-4 h-4" /> },
    { id: 'history', label: t('pw.pet.tabHistory'), icon: <History className="w-4 h-4" /> },
    { id: 'anamnesis', label: t('pw.pet.tabAnamnesis'), icon: <Stethoscope className="w-4 h-4" /> },
    { id: 'care', label: t('pw.pet.tabCare'), icon: <Sparkles className="w-4 h-4" /> },
    { id: 'stories', label: t('pw.pet.tabStories'), icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'family', label: t('pw.pet.tabFamily'), icon: <GitFork className="w-4 h-4" /> },
  ]

  const urgencyConfig = {
    low: { icon: <Info className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50 border-blue-200', label: t('pw.pet.urgencyLow'), text: 'text-blue-700' },
    medium: { icon: <AlertCircle className="w-5 h-5 text-yellow-500" />, bg: 'bg-yellow-50 border-yellow-200', label: t('pw.pet.urgencyMedium'), text: 'text-yellow-700' },
    high: { icon: <AlertTriangle className="w-5 h-5 text-orange-500" />, bg: 'bg-orange-50 border-orange-200', label: t('pw.pet.urgencyHigh'), text: 'text-orange-700' },
    emergency: { icon: <AlertTriangle className="w-5 h-5 text-red-500" />, bg: 'bg-red-50 border-red-200', label: t('pw.pet.urgencyEmergency'), text: 'text-red-700' },
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 md:mb-6 ">
        <button onClick={() => router.back()} aria-label={t('nav.back')} className="p-2 rounded-xl hover:bg-surface-100 transition tap-target flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-surface-900 dark:text-white leading-tight truncate">{pet.name}</h1>
          <p className="text-surface-500 dark:text-surface-400 text-xs md:text-sm truncate">{pet.breed?.name ?? ''} {pet.birth_date ? `• ${formatAge(pet.birth_date)}` : ''}</p>
        </div>
      </div>

      <BedtimeStoryModal petId={petId} petName={pet.name} open={storyOpen} onClose={() => setStoryOpen(false)} />
      <SnapshotTriageModal petId={petId} petName={pet.name} open={snapshotOpen} onClose={() => setSnapshotOpen(false)} />
      <PainAssessmentModal petId={petId} petName={pet.name} open={painOpen} onClose={() => setPainOpen(false)} />
      <StoolAnalysisModal petId={petId} petName={pet.name} open={stoolOpen} onClose={() => setStoolOpen(false)} />
      <BehaviorLogModal petId={petId} petName={pet.name} open={behaviorLogOpen} onClose={() => setBehaviorLogOpen(false)} />
      <SharePetModal petId={petId} petName={pet.name} open={shareOpen} onClose={() => setShareOpen(false)} />
      <PublicProfileModal pet={pet} open={publicOpen} onClose={() => setPublicOpen(false)} />

      {/* Quick actions IA — grade uniforme (bordas alinhadas, sem sobras irregulares) */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4 items-stretch">
        <QuickAction icon={<Sparkles className="w-4 h-4" />} label={t('pw.pet.qaTriage')} onClick={() => setSnapshotOpen(true)} color="primary" />
        <QuickAction icon={<Heart className="w-4 h-4" />} label={t('pw.pet.qaPain')} onClick={() => setPainOpen(true)} color="rose" />
        <QuickAction icon={<span className="text-base">💩</span>} label={t('pw.pet.qaStool')} onClick={() => setStoolOpen(true)} color="amber" />
        <QuickAction icon={<BookOpen className="w-4 h-4" />} label={t('pw.pet.qaBedtime')} onClick={() => setStoryOpen(true)} color="indigo" />
        <QuickAction icon={<Brain className="w-4 h-4" />} label={t('pw.pet.qaBehavior')} onClick={() => router.push('/behavior')} color="purple" />
        <QuickAction icon={<Smile className="w-4 h-4" />} label={t('pw.pet.qaCheckin')} onClick={() => setBehaviorLogOpen(true)} color="emerald" />
        <QuickAction icon={<PartyPopper className="w-4 h-4" />} label="Wrapped" onClick={() => router.push(`/wrapped/${petId}`)} color="pink" />
        <QuickAction icon={<ImageIcon className="w-4 h-4" />} label={t('pw.pet.tabStories')} onClick={() => setTab('stories' as Tab)} color="teal" />
        <QuickAction icon={<Users className="w-4 h-4" />} label={t('pw.common.share')} onClick={() => setShareOpen(true)} color="cyan" />
        <QuickAction icon={<span className="text-base">🔗</span>} label={t('pw.pet.qaLink')} onClick={() => setPublicOpen(true)} color="primary" />
        <QuickAction icon={<span className="text-base">📄</span>} label={t('pw.pet.qaPdf')} onClick={() => { petExport.sharePdf(petId, pet.name).catch(() => {}) }} color="emerald" />
        <QuickAction icon={<GitFork className="w-4 h-4" />} label={t('pw.pet.tabFamily')} onClick={() => setTab('family' as Tab)} color="fuchsia" />
      </div>

      {/* Pet card summary */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-4 md:p-6 mb-5 md:mb-6">
        <div className="flex items-start gap-4 md:gap-6 flex-wrap md:flex-nowrap">
          <div className="relative shrink-0">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
              {pet.photo_url ? (
                <Image src={pet.photo_url} alt={pet.name} width={96} height={96} className="object-cover w-full h-full" />
              ) : (
                <span className="text-4xl md:text-5xl">{getSpeciesEmoji(pet.species)}</span>
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
                  try { await petsApi.uploadPhoto(pet.id, f); success(t('pw.pet.photoUpdated')) }
                  catch { showError(t('pw.pet.photoError')) }
                }}
              />
            </label>
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: t('pw.pet.age'), value: formatAge(pet.birth_date), icon: <Calendar className="w-4 h-4 text-primary-500" /> },
              { label: t('pw.pet.weight'), value: pet.weight ? `${pet.weight} kg` : '—', icon: <Weight className="w-4 h-4 text-primary-500" /> },
              { label: t('pet.gender'), value: pet.gender === 'male' ? `♂ ${t('pet.male')}` : pet.gender === 'female' ? `♀ ${t('pet.female')}` : '—', icon: null },
              { label: t('pet.neutered'), value: pet.neutered ? `${t('common.yes')} ✂` : pet.neutered === false ? t('common.no') : '—', icon: null },
            ].map(i => (
              <div key={i.label}>
                <div className="text-[10px] md:text-xs text-surface-400 mb-0.5 uppercase tracking-wide">{i.label}</div>
                <div className="text-sm font-semibold text-surface-800 dark:text-surface-100">{i.value}</div>
              </div>
            ))}
          </div>
        </div>
        {pet.bio && <p className="mt-4 text-sm text-surface-600 dark:text-surface-300 italic border-t border-surface-100 dark:border-surface-700 pt-4 line-clamp-3">{pet.bio}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-6 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-1.5">
        {tabs.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap',
              tab === tb.id ? 'bg-primary-500 text-white' : 'text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/40'
            )}
          >
            {tb.icon}
            <span className="hidden sm:inline">{tb.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
              <h3 className="font-semibold text-surface-900 dark:text-white mb-4">{t('pw.pet.breedData')}</h3>
              {pet.breed ? (
                <div className="space-y-3">
                  <div className="text-sm"><span className="font-medium text-surface-700 dark:text-surface-200">{t('pet.breed')}:</span> <span className="text-surface-600">{pet.breed.name}</span></div>
                  {pet.breed.size && <div className="text-sm"><span className="font-medium text-surface-700 dark:text-surface-200">{t('pw.breed.size')}:</span> <span className="text-surface-600">{getSizeLabel(pet.breed.size)}</span></div>}
                  {pet.breed.energy_level && <div className="text-sm"><span className="font-medium text-surface-700 dark:text-surface-200">{t('pw.breed.energy')}:</span> <span className="text-surface-600">{getEnergyLabel(pet.breed.energy_level)}</span></div>}
                  {pet.breed.life_expectancy_min && (
                    <div className="text-sm"><span className="font-medium text-surface-700 dark:text-surface-200">{t('pw.breed.lifeExpectancy')}:</span> <span className="text-surface-600">{pet.breed.life_expectancy_min}–{pet.breed.life_expectancy_max} {t('pw.breed.years')}</span></div>
                  )}
                  {pet.breed.temperament && pet.breed.temperament.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('pw.breed.temperament')}:</div>
                      <div className="flex flex-wrap gap-1">
                        {pet.breed.temperament.map((temp, i) => (
                          <span key={i} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-0.5 rounded-full">{temp}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {pet.breed.description && (
                    <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">{pet.breed.description}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-surface-400">{t('pw.pet.noBreed')}</p>
              )}
            </div>
            <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
              <h3 className="font-semibold text-surface-900 dark:text-white mb-4">{t('pw.pet.healthSummary')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-600 dark:text-surface-300">{t('pw.pet.totalVaccines')}</span>
                  <span className="font-semibold text-surface-900 dark:text-white">{vaccines.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-600 dark:text-surface-300">{t('pw.pet.totalExams')}</span>
                  <span className="font-semibold text-surface-900 dark:text-white">{exams.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-600 dark:text-surface-300">{t('pw.pet.anamnesesCount')}</span>
                  <span className="font-semibold text-surface-900 dark:text-white">{anamnesisHistory.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-600 dark:text-surface-300">{t('pw.pet.routinesCount')}</span>
                  <span className="font-semibold text-surface-900 dark:text-white">{routines.length}</span>
                </div>
                {pet.microchip && (
                  <div className="flex justify-between items-center text-sm border-t border-surface-100 dark:border-surface-700 pt-3">
                    <span className="text-surface-600 dark:text-surface-300">{t('pet.microchip')}</span>
                    <span className="font-mono text-xs text-surface-700 dark:text-surface-200">{pet.microchip}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <HealthForecast pet={pet} />

          <WeightChart petId={petId} />

          <RecapCard petId={petId} />

          <EnrichmentCard petId={petId} petName={pet.name} />

          <ExpensesCard petId={petId} />

          <SeniorProtocolCard petId={petId} />

          {/* Sugestões inteligentes baseadas em fase de vida + vacinas já aplicadas */}
          {suggestions && suggestions.suggestions.length > 0 && (
            <div className="bg-gradient-to-br from-primary-50 via-white to-emerald-50 rounded-2xl border border-primary-200 p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-base">🧬</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-surface-900 dark:text-white">{t('pw.pet.suggestedPlan')}</h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {t('pw.pet.phase')}: <span className="font-semibold text-primary-700">{suggestions.phase_label}</span>
                      {suggestions.age_months !== null && ` · ${t('pw.pet.months', { count: suggestions.age_months })}`}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-surface-400">{t('pw.pet.basedOn')}</span>
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
                        <span className="font-semibold text-sm text-surface-900 dark:text-white">{s.title}</span>
                      </div>
                      <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">{s.description}</p>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-3 italic">
                {t('pw.pet.suggestionsDisclaimer')}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'health' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-surface-900 dark:text-white">{t('pw.pet.vaccines')}</h2>
            <a href="/health/vaccines" className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
              <Plus className="w-4 h-4" /> {t('common.add')}
            </a>
          </div>
          <VaccineTimeline vaccines={vaccines} onDelete={handleDeleteVaccine} />

          <div className="border-t border-surface-200 dark:border-surface-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-surface-900 dark:text-white">{t('pw.pet.exams')}</h2>
              <a href="/health/exams" className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
                <Plus className="w-4 h-4" /> {t('common.add')}
              </a>
            </div>
            {exams.length === 0 ? (
              <div className="text-center py-8 text-surface-400">
                <div className="text-4xl mb-2">🔬</div>
                <p>{t('pw.pet.noExams')}</p>
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
            <h2 className="text-xl font-bold text-surface-900 dark:text-white">{t('pw.pet.walkRoutines')}</h2>
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
              {routines.length > 0 ? t('pw.pet.regenAI') : t('pw.pet.genRoutineAI')}
            </button>
          </div>
          {routines.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
              <div className="text-5xl mb-3">🦮</div>
              <h3 className="font-semibold text-surface-900 dark:text-white mb-1">{t('pw.pet.noRoutineTitle')}</h3>
              <p className="text-surface-500 dark:text-surface-400 text-sm mb-4">{t('pw.pet.noRoutineText')}</p>
            </div>
          ) : (
            routines.map(r => (
              <div key={r.id} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6">
                <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                  <div className="bg-primary-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-primary-700">{r.walks_per_day}x</div>
                    <div className="text-xs text-primary-600">{t('pw.pet.perDay')}</div>
                  </div>
                  <div className="bg-accent-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-accent-700">{r.walk_duration_minutes}min</div>
                    <div className="text-xs text-accent-600">{t('pw.pet.perWalk')}</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-green-700">{r.walks_per_day * r.walk_duration_minutes}min</div>
                    <div className="text-xs text-green-600">{t('pw.pet.totalPerDay')}</div>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-200 mb-2">{t('pw.pet.suggestedTimes')}</p>
                  <div className="flex flex-wrap gap-2">
                    {r.walk_times.map((time, i) => (
                      <span key={i} className="bg-primary-100 text-primary-700 text-sm font-semibold px-3 py-1.5 rounded-xl">{time}</span>
                    ))}
                  </div>
                </div>
                {r.exercise_type && (
                  <div className="mb-4 text-sm">
                    <span className="font-medium text-surface-700 dark:text-surface-200">{t('pw.pet.exerciseType')}</span>{' '}
                    <span className="text-surface-600 dark:text-surface-300">{r.exercise_type}</span>
                  </div>
                )}
                {r.tips && r.tips.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-200 mb-2">{t('pw.pet.tips')}</p>
                    <ul className="space-y-1">
                      {r.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-surface-600 dark:text-surface-300">
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
          <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-6">{t('pw.pet.anamHistory')}</h2>
          {anamnesisHistory.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
              <div className="text-5xl mb-3">📋</div>
              <p className="text-surface-500 dark:text-surface-400">{t('pw.pet.noAnam')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {anamnesisHistory.map(a => {
                const u = a.ai_analysis?.urgency_level
                const cfg = u ? urgencyConfig[u] : null
                return (
                  <div key={a.id} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-surface-500 dark:text-surface-400">{formatDate(a.created_at, 'dd/MM/yyyy HH:mm')}</span>
                      {cfg && (
                        <span className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border', cfg.bg, cfg.text)}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-surface-800 dark:text-surface-100 font-medium mb-2">{t('pw.pet.symptomsLabel')}</div>
                    <p className="text-sm text-surface-600 dark:text-surface-300 mb-3">{a.symptoms}</p>
                    {a.ai_analysis && (
                      <div className={cn('rounded-xl p-3 border', cfg?.bg)}>
                        <p className="text-sm font-medium mb-2">{t('pw.pet.aiAnalysisLabel')}</p>
                        <p className="text-sm text-surface-700 dark:text-surface-200 mb-2">{a.ai_analysis.summary}</p>
                        {a.ai_analysis.recommendations.length > 0 && (
                          <ul className="space-y-1">
                            {a.ai_analysis.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-surface-600 dark:text-surface-300">
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
          <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">{t('pw.pet.newAnam')}</h2>
          <p className="text-surface-500 dark:text-surface-400 text-sm mb-6">{t('pw.pet.newAnamSubtitle')}</p>

          {anamAnalysis && (
            <div className={cn('mb-6 rounded-2xl p-5 border', urgencyConfig[anamAnalysis.urgency_level].bg)}>
              <div className={cn('flex items-center gap-2 font-bold mb-3', urgencyConfig[anamAnalysis.urgency_level].text)}>
                {urgencyConfig[anamAnalysis.urgency_level].icon}
                {t('pw.pet.aiAnalysis')} — {urgencyConfig[anamAnalysis.urgency_level].label}
              </div>
              <p className="text-sm text-surface-800 dark:text-surface-100 mb-3">{anamAnalysis.summary}</p>
              {anamAnalysis.seek_vet_immediately && (
                <div className="bg-red-100 text-red-800 text-sm font-semibold p-3 rounded-xl mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {t('pw.pet.seekVet')}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold mb-2">{t('pw.pet.recommendations')}</p>
                <ul className="space-y-1">
                  {anamAnalysis.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-200">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <form onSubmit={handleAnamSubmit} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('pw.pet.symptomsObserved')} *</label>
              <textarea
                required
                value={anamForm.symptoms}
                onChange={e => setAnamForm(f => ({ ...f, symptoms: e.target.value }))}
                rows={3}
                placeholder={t('pw.pet.symptomsPlaceholder')}
                className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('pw.pet.howLong')}</label>
                <input type="text" value={anamForm.duration} onChange={e => setAnamForm(f => ({ ...f, duration: e.target.value }))} placeholder={t('pw.pet.howLongPlaceholder')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('pw.pet.appetite')}</label>
                <select value={anamForm.appetite} onChange={e => setAnamForm(f => ({ ...f, appetite: e.target.value }))} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800">
                  <option value="">{t('pw.pet.select')}</option>
                  <option value="normal">{t('pw.pet.normal')}</option>
                  <option value="reduced">{t('pw.pet.reduced')}</option>
                  <option value="absent">{t('pw.pet.absent')}</option>
                  <option value="increased">{t('pw.pet.increased')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('pw.pet.waterIntake')}</label>
                <select value={anamForm.water_intake} onChange={e => setAnamForm(f => ({ ...f, water_intake: e.target.value }))} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800">
                  <option value="">{t('pw.pet.select')}</option>
                  <option value="normal">{t('pw.pet.normal')}</option>
                  <option value="reduced">{t('pw.pet.reducedFem')}</option>
                  <option value="increased">{t('pw.pet.increasedPolydipsia')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('pw.pet.behaviorChanges')}</label>
                <input type="text" value={anamForm.behavior_changes} onChange={e => setAnamForm(f => ({ ...f, behavior_changes: e.target.value }))} placeholder={t('pw.pet.behaviorPlaceholder')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('pw.pet.medications')}</label>
                <input type="text" value={anamForm.medications} onChange={e => setAnamForm(f => ({ ...f, medications: e.target.value }))} placeholder={t('pw.pet.medicationsPlaceholder')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5">{t('pw.pet.additionalNotes')}</label>
              <textarea value={anamForm.notes} onChange={e => setAnamForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={t('pw.pet.notesPlaceholder')} className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            </div>
            <button
              type="submit"
              disabled={submitingAnam}
              className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-60 transition flex items-center justify-center gap-2"
            >
              {submitingAnam ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {submitingAnam ? t('pw.pet.analyzingAI') : t('pw.pet.submitAnam')}
            </button>
          </form>
        </div>
      )}

      {tab === 'stories' && (
        <div className="animate-fade-in">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-teal-500" />
              {t('pw.pet.storiesOf', { name: pet.name })}
            </h2>
            <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">{t('pw.pet.storiesSubtitle')}</p>
          </div>
          <StoriesFeed petId={petId} petName={pet.name} />
        </div>
      )}

      {tab === 'family' && (
        <div className="animate-fade-in">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <GitFork className="w-6 h-6 text-fuchsia-500" />
              {t('pw.pet.familyOf', { name: pet.name })}
            </h2>
            <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">{t('pw.pet.familySubtitle')}</p>
          </div>
          <FamilyTreeSection petId={petId} petName={pet.name} />
        </div>
      )}

      {tab === 'care' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-surface-900 dark:text-white">{t('pw.pet.careGuideTitle')}</h2>
              <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">{t('pw.pet.careGuideSubtitle', { name: pet.name })}</p>
            </div>
            {pet.breed_id && !careGuide && (
              <button
                onClick={handleLoadCareGuide}
                disabled={generatingCare}
                className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-60 transition"
              >
                {generatingCare ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {t('pw.pet.genCareGuide')}
              </button>
            )}
          </div>
          {!pet.breed_id && (
            <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
              <div className="text-5xl mb-3">🧬</div>
              <p className="text-surface-700 dark:text-surface-200 font-medium">{t('pw.pet.noBreed')}</p>
              <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">{t('pw.pet.noBreedCareText')}</p>
            </div>
          )}
          {pet.breed_id && !careGuide && !generatingCare && (
            <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
              <div className="text-5xl mb-3">✨</div>
              <p className="text-surface-700 dark:text-surface-200 font-medium mb-2">{t('pw.pet.careNotGenerated')}</p>
              <p className="text-surface-500 dark:text-surface-400 text-sm">{t('pw.pet.careNotGeneratedText')}</p>
            </div>
          )}
          {careGuide && (
            <div className="space-y-4">
              {[
                { title: `🍽 ${t('pw.pet.careFeeding')}`, content: careGuide.feeding_tips },
                { title: `🏃 ${t('pw.pet.careExercise')}`, content: careGuide.exercise_recommendations },
                { title: `✂️ ${t('pw.pet.careGrooming')}`, content: careGuide.grooming_guide },
                { title: `🏥 ${t('pw.pet.careHealth')}`, content: careGuide.health_alerts },
                { title: `🎓 ${t('pw.pet.careTraining')}`, content: careGuide.training_tips },
              ].map(s => (
                <div key={s.title} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
                  <h3 className="font-semibold text-surface-900 dark:text-white mb-3">{s.title}</h3>
                  <p className="text-sm text-surface-700 dark:text-surface-200 leading-relaxed whitespace-pre-line">{s.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}

function QuickAction({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: 'primary' | 'rose' | 'amber' | 'indigo' | 'purple' | 'pink' | 'emerald' | 'teal' | 'cyan' | 'fuchsia' }) {
  const cls = {
    primary: 'bg-primary-500 hover:bg-primary-600 shadow-primary-500/30',
    rose: 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30',
    amber: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30',
    indigo: 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/30',
    purple: 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/30',
    pink: 'bg-pink-500 hover:bg-pink-600 shadow-pink-500/30',
    emerald: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30',
    teal: 'bg-teal-500 hover:bg-teal-600 shadow-teal-500/30',
    cyan: 'bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/30',
    fuchsia: 'bg-fuchsia-500 hover:bg-fuchsia-600 shadow-fuchsia-500/30',
  }[color]
  return (
    <button
      onClick={onClick}
      className={`pressable flex flex-col items-center justify-start gap-1.5 ${cls} text-white rounded-2xl px-1.5 py-2.5 transition shadow-sm w-full h-full min-h-[72px]`}
    >
      <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">{icon}</span>
      <span className="text-[10px] leading-tight font-semibold text-center line-clamp-2">{label}</span>
    </button>
  )
}
