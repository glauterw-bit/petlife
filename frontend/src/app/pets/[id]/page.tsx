'use client'

import { useCallback, useEffect, useRef, useState, FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Edit2, Camera, PawPrint, Heart, Route, Stethoscope, Sparkles, Plus, AlertTriangle, CheckCircle,
  AlertCircle, Info, Syringe, IdCard, Share2, Ellipsis, History, Image as ImageIcon, GitFork,
  Utensils, Activity, Scissors, GraduationCap, Microscope, Dog, ClipboardList, Dna, Pill, Bug, ChevronDown, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { VaccineTimeline } from '@/components/health/VaccineTimeline'
import { ExamCard } from '@/components/health/ExamCard'
import {
  pets as petsApi, vaccines as vaccinesApi, exams as examsApi,
  anamnesis as anamnesisApi, routines as routinesApi, breeds as breedsApi,
  type Pet, type Vaccine, type Exam, type Anamnesis, type Routine, type CareGuide, type AIAnalysis,
} from '@/lib/api'
import { formatDate, formatAge, getSizeLabel, getEnergyLabel, cn, localeTag } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastContext'
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
import { EditPetModal } from '@/components/pets/EditPetModal'
import { LostPetCard } from '@/components/pets/LostPetCard'
import { PetTimeline } from '@/components/pets/PetTimeline'
import { PetActionsSheet, type PetAction } from '@/components/pets/PetActionsSheet'
import { track } from '@/lib/track'
import { requestSoftUpsell } from '@/lib/softUpsell'
import { HeatCycleCard } from '@/components/health/HeatCycleCard'
import { RecapCard } from '@/components/innovations/RecapCard'
import { EnrichmentCard } from '@/components/innovations/EnrichmentCard'
import { petExport } from '@/lib/api'
import { trackHappyMoment } from '@/lib/review'
import { useT } from '@/contexts/LocaleContext'
import { useCached, invalidate } from '@/lib/cache'
import type { CareItem, CareKind, PetCareSummary } from '@/lib/care'
import { variants, spring } from '@/lib/motion'
import { haptic } from '@/lib/feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { ProtectionRing, useRingCelebrate } from '@/components/ui/ProtectionRing'
import { CareStatusList } from '@/components/ui/CareStatusList'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonHero, SkeletonTile, Skeleton } from '@/components/ui/Skeleton'
import { useConfirm } from '@/components/ui/Confirm'
import { useShell } from '@/components/layout/shell'
import { useCareData } from '../useCareData'
import { ProtectionSheet } from './ProtectionSheet'

type Tab = 'overview' | 'timeline' | 'health' | 'routine' | 'anamnesis' | 'care' | 'stories' | 'family'
const TABS: Tab[] = ['overview', 'timeline', 'health', 'routine', 'anamnesis', 'care', 'stories', 'family']

function readTabFromUrl(): Tab | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('tab')
  if (!raw) return null
  if (raw === 'history') return 'anamnesis' // link antigo: o histórico de anamneses vive na aba Anamnese
  return (TABS as string[]).includes(raw) ? (raw as Tab) : null
}

/** Cor + palavra da prioridade (nunca só cor). Contraste AA nos dois temas. */
const URGENCY_TONE: Record<'alta' | 'media' | 'baixa', { chip: string; dot: string }> = {
  alta: { chip: 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-200', dot: 'bg-red-600 dark:bg-red-400' },
  media: { chip: 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200', dot: 'bg-amber-500 dark:bg-amber-400' },
  baixa: { chip: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200', dot: 'bg-emerald-600 dark:bg-emerald-400' },
}

const URGENCY_RANK = { alta: 0, media: 1, baixa: 2 } as const
const SUGGESTIONS_PREVIEW = 3

const INPUT =
  'w-full px-4 py-3 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl text-[15px] text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500'
const LABEL = 'block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5'

export default function PetProfilePage() {
  const t = useT()
  const { id } = useParams()
  const router = useRouter()
  const shell = useShell()
  const confirm = useConfirm()
  const { success, error: showError } = useToast()
  const petId = Number(id)

  const petQ = useCached<Pet>(Number.isFinite(petId) ? `pet:${petId}` : null, () => petsApi.getById(petId))
  const pet = petQ.data ?? null
  const vacQ = useCached<Vaccine[]>(`vaccines:pet:${petId}`, () => vaccinesApi.list(petId))
  const vaccines = vacQ.data ?? []
  const care = useCareData()
  const ring = useRingCelebrate()

  const [exams, setExams] = useState<Exam[]>([])
  const [anamnesisHistory, setAnamnesisHistory] = useState<Anamnesis[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [careGuide, setCareGuide] = useState<CareGuide | null>(null)
  const [tab, setTabState] = useState<Tab>('overview')
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
  const [editOpen, setEditOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [protKind, setProtKind] = useState<'vermifugo' | 'antipulgas' | null>(null)
  const [fixingSpecies, setFixingSpecies] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [lostHighlight, setLostHighlight] = useState(0)
  // 3ª camada da visão geral ("Mais sobre {nome}"): fechada por padrão
  const [extraOpen, setExtraOpen] = useState(false)
  const [allSuggestions, setAllSuggestions] = useState(false)
  // incrementa a cada edição do perfil — cards que dependem de espécie/sexo recarregam
  const [profileVersion, setProfileVersion] = useState(0)
  const photoInput = useRef<HTMLInputElement>(null)

  // Anamnesis form
  const [anamForm, setAnamForm] = useState({ symptoms: '', duration: '', behavior_changes: '', appetite: '', water_intake: '', medications: '', notes: '' })
  const [submitingAnam, setSubmitingAnam] = useState(false)
  const [anamAnalysis, setAnamAnalysis] = useState<AIAnalysis | null>(null)

  useEffect(() => {
    const fromUrl = readTabFromUrl()
    if (fromUrl) setTabState(fromUrl)
  }, [petId])

  const setTab = useCallback((next: Tab) => {
    setTabState(next)
    try {
      const url = new URL(window.location.href)
      if (next === 'overview') url.searchParams.delete('tab')
      else url.searchParams.set('tab', next)
      window.history.replaceState(window.history.state, '', url.toString())
    } catch {
      /* sem history (prévia) */
    }
  }, [])

  // pet inexistente ou sem acesso → volta para a lista
  useEffect(() => {
    if (petQ.error && !petQ.data) router.replace('/pets')
  }, [petQ.error, petQ.data, router])

  useEffect(() => {
    let alive = true
    Promise.allSettled([examsApi.list(petId), anamnesisApi.getByPet(petId), routinesApi.getByPet(petId)]).then(([e, a, r]) => {
      if (!alive) return
      if (e.status === 'fulfilled') setExams(e.value)
      if (a.status === 'fulfilled') setAnamnesisHistory(a.value)
      if (r.status === 'fulfilled') setRoutines(r.value)
    })
    breedsApi.petHealthSuggestions(petId).then(s => alive && setSuggestions(s)).catch(() => {})
    return () => {
      alive = false
    }
  }, [petId])

  // situação de cuidados, com os dados frescos do pet (nome/foto podem ter mudado)
  const baseSummary = care.byPetId.get(petId) ?? null
  const summary: PetCareSummary | null = baseSummary && pet ? { ...baseSummary, pet } : null
  const protEntry = care.protections?.find(p => p.pet_id === petId)

  async function handleGenerateRoutine() {
    setGeneratingRoutine(true)
    try {
      const r = await routinesApi.generate(petId)
      setRoutines([r])
      haptic('saved')
      success(t('pw.pet.routineGenerated'))
    } catch { showError(t('pw.pet.routineError')) }
    finally { setGeneratingRoutine(false) }
  }

  async function handleLoadCareGuide() {
    if (!pet?.breed_id) return
    setGeneratingCare(true)
    try {
      setCareGuide(await breedsApi.getCareGuide(pet.breed_id))
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
      haptic('saved')
      success(t('pw.pet.anamSaved'))
      setAnamForm({ symptoms: '', duration: '', behavior_changes: '', appetite: '', water_intake: '', medications: '', notes: '' })
    } catch { showError(t('pw.pet.anamError')) }
    finally { setSubmitingAnam(false) }
  }

  async function handleDeleteVaccine(vid: number) {
    const ok = await confirm({ title: t('pw.pet.deleteVaccineConfirm'), tone: 'danger', confirmLabel: t('ui.confirm.delete') })
    if (!ok) return
    try {
      await vaccinesApi.delete(vid)
      vacQ.mutate(prev => (prev ?? []).filter(v => v.id !== vid))
      invalidate('vaccines')
      invalidate(`pet:${petId}:timeline`)
      success(t('pw.pet.vaccineDeleted'))
    } catch {
      haptic('error')
      showError(t('pw.editPet.deleteError'))
    }
  }

  async function handleDeleteExam(eid: number) {
    const ok = await confirm({ title: t('pw.pet.deleteExamConfirm'), tone: 'danger', confirmLabel: t('ui.confirm.delete') })
    if (!ok) return
    try {
      await examsApi.delete(eid)
      setExams(prev => prev.filter(e => e.id !== eid))
      success(t('pw.pet.examDeleted'))
    } catch {
      haptic('error')
      showError(t('pw.editPet.deleteError'))
    }
  }

  function handlePetSaved(updated: Pet) {
    petQ.mutate(updated)
    invalidate('pets')
    void shell?.refreshPets()
    setCareGuide(null) // o guia era da raça antiga
    setProfileVersion(v => v + 1)
    breedsApi.petHealthSuggestions(petId).then(setSuggestions).catch(() => {})
  }

  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !pet) return
    setUploadingPhoto(true)
    try {
      const r = await petsApi.uploadPhoto(pet.id, f)
      petQ.mutate(prev => (prev ? { ...prev, photo_url: r.photo_url } : prev!))
      invalidate('pets')
      void shell?.refreshPets()
      haptic('saved')
      success(t('pw.pet.photoUpdated'))
    } catch (err) {
      haptic('error')
      const m = err instanceof Error && err.message && !/fetch|network|load failed/i.test(err.message) ? err.message : ''
      showError(m ? `${t('pw.pet.photoError')} ${m}` : t('pw.pet.photoError'))
    } finally {
      setUploadingPhoto(false)
    }
  }

  function onProtectionSaved(kind: 'vermifugo' | 'antipulgas') {
    invalidate('protections')
    invalidate(`pet:${petId}:timeline`)
    void care.refreshProtections().then(() => ring.celebrate(kind))
    trackHappyMoment('protection')
    success(t('petx.prot.saved', { kind: t(kind === 'vermifugo' ? 'ui.care.vermifugo' : 'ui.care.antipulgas') }))
  }

  function openCareItem(kind: CareKind) {
    if (kind === 'vaccines') router.push(`/health/vaccines?pet=${petId}`)
    else setProtKind(kind)
  }

  function goToLost() {
    setTab('overview')
    // o cartão de pet perdido mora em "Mais sobre": abre e só então rola
    setExtraOpen(true)
    setLostHighlight(n => n + 1)
  }

  // ao pedir "pet perdido" pela folha de ações: espera a 3ª camada montar e rola até o cartão
  useEffect(() => {
    if (lostHighlight === 0) return
    const id = window.setTimeout(() => {
      document.getElementById('lost-pet')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 160)
    return () => window.clearTimeout(id)
  }, [lostHighlight])

  function onAction(a: PetAction) {
    if (!pet) return
    switch (a) {
      case 'triage': return setSnapshotOpen(true)
      case 'pain': return setPainOpen(true)
      case 'stool': return setStoolOpen(true)
      case 'bedtime': return setStoryOpen(true)
      case 'behavior': return router.push('/behavior')
      case 'mood': return setBehaviorLogOpen(true)
      case 'recap': return router.push(`/wrapped/${petId}`)
      case 'moments': return setTab('stories')
      case 'link': return setPublicOpen(true)
      case 'family': return setTab('family')
      case 'lost': return goToLost()
      case 'pdf':
        petExport
          .sharePdf(petId, pet.name)
          .then(() => {
            trackHappyMoment('pdf_export')
            requestSoftUpsell('pdf')
          })
          .catch(() => showError(t('petx.sheet.pdfError')))
        return
    }
  }

  if (!pet) {
    return (
      <DashboardLayout>
        <PageHeader title="" back="/pets" large={false} />
        <div className="space-y-4" aria-busy="true" aria-label={t('ui.loading')}>
          <SkeletonHero />
          <div className="grid grid-cols-4 gap-2">
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'overview', label: t('pw.pet.tabOverview'), icon: PawPrint },
    { id: 'timeline', label: t('petx.tab.timeline'), icon: History },
    { id: 'health', label: t('nav.health'), icon: Heart },
    { id: 'routine', label: t('pw.pet.tabRoutine'), icon: Route },
    { id: 'anamnesis', label: t('pw.pet.tabAnamnesis'), icon: Stethoscope },
    { id: 'care', label: t('pw.pet.tabCare'), icon: Sparkles },
    { id: 'stories', label: t('pw.pet.tabStories'), icon: ImageIcon },
    { id: 'family', label: t('pw.pet.tabFamily'), icon: GitFork },
  ]

  const urgencyConfig = {
    low: { icon: <Info className="w-5 h-5" aria-hidden />, bg: 'border bg-sky-50/70 border-sky-200/80 dark:bg-sky-500/10 dark:border-sky-500/25', label: t('pw.pet.urgencyLow'), text: 'text-sky-800 dark:text-sky-200' },
    medium: { icon: <AlertCircle className="w-5 h-5" aria-hidden />, bg: 'border tone-warning-bg', label: t('pw.pet.urgencyMedium'), text: 'text-amber-800 dark:text-amber-200' },
    high: { icon: <AlertTriangle className="w-5 h-5" aria-hidden />, bg: 'border bg-orange-50/70 border-orange-200/80 dark:bg-orange-500/10 dark:border-orange-500/25', label: t('pw.pet.urgencyHigh'), text: 'text-orange-800 dark:text-orange-200' },
    emergency: { icon: <AlertTriangle className="w-5 h-5" aria-hidden />, bg: 'border tone-danger-bg', label: t('pw.pet.urgencyEmergency'), text: 'text-red-800 dark:text-red-200' },
  }

  const subtitle = [pet.breed?.name, pet.birth_date ? formatAge(pet.birth_date) : null].filter(Boolean).join(' · ')

  // prioridade alta primeiro; mostra 3 e o resto sob demanda
  const rankedSuggestions = (suggestions?.suggestions ?? [])
    .map((s, idx) => {
      const u: 'alta' | 'media' | 'baixa' = s.urgency === 'alta' || s.urgency === 'media' ? s.urgency : 'baixa'
      return { s, u, idx }
    })
    .sort((a, b) => URGENCY_RANK[a.u] - URGENCY_RANK[b.u] || a.idx - b.idx)
  const visibleSuggestions = allSuggestions ? rankedSuggestions : rankedSuggestions.slice(0, SUGGESTIONS_PREVIEW)

  const profileFacts: { label: string; value: string; mono?: boolean }[] = [
    { label: t('pet.breed'), value: pet.breed?.name ?? '—' },
    { label: t('pw.pet.age'), value: pet.birth_date ? formatAge(pet.birth_date) : '—' },
    { label: t('pw.pet.weight'), value: pet.weight ? `${Number(pet.weight).toLocaleString(localeTag())} kg` : '—' },
    { label: t('pet.gender'), value: pet.gender === 'male' ? t('pet.male') : pet.gender === 'female' ? t('pet.female') : '—' },
    { label: t('pet.neutered'), value: pet.neutered ? t('common.yes') : pet.neutered === false ? t('common.no') : '—' },
    ...(pet.microchip ? [{ label: t('pet.microchip'), value: pet.microchip, mono: true }] : []),
  ]

  return (
    <DashboardLayout>
      <PageHeader
        title={pet.name}
        back="/pets"
        large={false}
        hideLargeTitle
        actions={<IconButton icon={Edit2} variant="header" label={t('petx.edit')} onClick={() => setEditOpen(true)} />}
      />

      <BedtimeStoryModal petId={petId} petName={pet.name} open={storyOpen} onClose={() => setStoryOpen(false)} />
      <SnapshotTriageModal petId={petId} petName={pet.name} open={snapshotOpen} onClose={() => setSnapshotOpen(false)} />
      <PainAssessmentModal petId={petId} petName={pet.name} open={painOpen} onClose={() => setPainOpen(false)} />
      <StoolAnalysisModal petId={petId} petName={pet.name} open={stoolOpen} onClose={() => setStoolOpen(false)} />
      <BehaviorLogModal petId={petId} petName={pet.name} open={behaviorLogOpen} onClose={() => setBehaviorLogOpen(false)} />
      <SharePetModal petId={petId} petName={pet.name} open={shareOpen} onClose={() => setShareOpen(false)} />
      <PublicProfileModal pet={pet} open={publicOpen} onClose={() => setPublicOpen(false)} />
      <EditPetModal pet={pet} open={editOpen} onClose={() => setEditOpen(false)} onSaved={handlePetSaved} />
      <PetActionsSheet open={moreOpen} onClose={() => setMoreOpen(false)} petName={pet.name} onAction={onAction} />
      <ProtectionSheet
        open={!!protKind}
        onClose={() => setProtKind(null)}
        petId={petId}
        kind={protKind ?? 'vermifugo'}
        defaultInterval={protEntry?.kinds.find(k => k.kind === protKind)?.interval_days}
        defaultProduct={protEntry?.kinds.find(k => k.kind === protKind)?.product}
        onSaved={() => protKind && onProtectionSaved(protKind)}
      />

      {/* Espécie e raça divergentes: 1 toque resolve (e destrava a edição do perfil) */}
      {pet.breed && pet.species !== 'other' && pet.breed.species !== pet.species && (
        <Card tone="warning" className="mb-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">{t('pw.pet.speciesMismatchTitle')}</p>
          <p className="text-[13px] text-amber-900 dark:text-amber-200/90 mb-3">
            {t('pw.pet.speciesMismatchBody', { name: pet.name, breed: pet.breed.name })}
          </p>
          <div className="flex gap-2">
            {(['dog', 'cat'] as const).map(s => (
              <button
                key={s}
                disabled={fixingSpecies}
                onClick={async () => {
                  setFixingSpecies(true)
                  try {
                    const updated = await petsApi.update(petId, { species: s })
                    track('species_fix')
                    handlePetSaved(updated)
                  } catch {} finally { setFixingSpecies(false) }
                }}
                className="pressable flex-1 min-h-[44px] px-3 rounded-xl bg-white dark:bg-surface-900 border border-amber-300 dark:border-amber-500/40 text-sm font-semibold text-surface-800 dark:text-surface-100 hover:bg-amber-100 dark:hover:bg-amber-500/15 transition disabled:opacity-50"
              >
                {s === 'dog' ? `🐕 ${t('pet.dog')}` : `🐈 ${t('pet.cat')}`}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ── Herói: anel de proteção + próxima ação ───────────────────── */}
      <motion.section
        variants={variants.scaleIn}
        initial="hidden"
        animate="show"
        transition={spring.soft}
        className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 shadow-card p-5 mb-3"
        aria-labelledby="pet-hero-name"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            {summary ? (
              <ProtectionRing summary={summary} size={156} pulseKind={ring.pulseKind} onSegmentClick={openCareItem}>
                <PetAvatar pet={pet} size={118} priority />
              </ProtectionRing>
            ) : (
              <div className="w-[156px] h-[156px] flex items-center justify-center">
                <PetAvatar pet={pet} size={118} priority />
              </div>
            )}
            <button
              type="button"
              aria-label={t('petx.changePhoto')}
              title={t('petx.changePhoto')}
              disabled={uploadingPhoto}
              onClick={() => photoInput.current?.click()}
              className="pressable absolute bottom-[8px] right-[8px] w-11 h-11 flex items-center justify-center rounded-full disabled:opacity-60"
            >
              <span className="w-9 h-9 rounded-full flex items-center justify-center bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950 ring-[3px] ring-white dark:ring-surface-900 shadow-card">
                <Camera className="w-[18px] h-[18px]" aria-hidden />
              </span>
            </button>
            <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={onPhotoPicked} aria-hidden tabIndex={-1} />
          </div>
          <h2 id="pet-hero-name" className="mt-3 text-[26px] leading-tight font-display font-extrabold tracking-tight text-surface-900 dark:text-white">
            {pet.name}
          </h2>
          {(subtitle || !pet.breed) && (
            <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 text-[15px] text-surface-600 dark:text-surface-400">
              {subtitle && <span>{subtitle}</span>}
              {subtitle && !pet.breed && <span aria-hidden>·</span>}
              {!pet.breed && (
                // sem raça: convite curto em vez de um cartão vazio "Raça não informada"
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="pressable inline-flex items-center gap-1 min-h-[44px] -my-2.5 px-1 font-semibold text-primary-700 dark:text-primary-300"
                >
                  <Plus className="w-4 h-4" aria-hidden />
                  {t('pet2.addBreed', { name: pet.name })}
                </button>
              )}
            </div>
          )}
          {uploadingPhoto && <p role="status" className="mt-1 text-xs text-surface-600 dark:text-surface-400">{t('petx.photoUploading')}</p>}
        </div>

        <div className="mt-4">
          {summary ? (
            <CareStatusList summary={summary} onItemClick={(i: CareItem) => openCareItem(i.kind)} />
          ) : (
            <div className="space-y-3 py-1" aria-hidden>
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3 rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {summary && <NextAction summary={summary} petId={petId} onProtection={k => setProtKind(k)} />}
      </motion.section>

      {/* Ações principais */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <ActionTile icon={Syringe} label={t('petx.act.vaccines')} href={`/health/vaccines?pet=${petId}`} />
        <ActionTile icon={IdCard} label={t('petx.act.wallet')} href={`/health/vaccines/carteirinha/${petId}`} />
        <ActionTile icon={Share2} label={t('petx.act.share')} onClick={() => setShareOpen(true)} />
        <ActionTile icon={Ellipsis} label={t('petx.act.more')} ariaLabel={t('petx.act.moreAria', { name: pet.name })} onClick={() => setMoreOpen(true)} />
      </div>

      {/* Abas */}
      <div className="mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <Tabs
          items={tabs}
          value={tab}
          onChange={setTab}
          ariaLabel={t('petx.tabs.aria', { name: pet.name })}
          variant="pill"
          scrollable
          layoutId="petTabs"
        />
      </div>

      {tab === 'overview' && (
        <div className="space-y-4 animate-fade-in">
          {pet.bio && (
            <p className="text-[15px] text-surface-700 dark:text-surface-300 italic leading-relaxed">{pet.bio}</p>
          )}

          {/* Cuidados recomendados pela fase de vida + vacinas já aplicadas */}
          {suggestions && suggestions.suggestions.length > 0 && (
            <Card padding="none" className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <span className="w-10 h-10 shrink-0 bg-primary-50 dark:bg-primary-500/15 rounded-xl flex items-center justify-center text-primary-700 dark:text-primary-300">
                  <Dna className="w-5 h-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-surface-900 dark:text-white">{t('pw.pet.suggestedPlan')}</h3>
                  <p className="text-[13px] text-surface-600 dark:text-surface-300">
                    {t('pw.pet.phase')}: <span className="font-semibold text-surface-800 dark:text-surface-100">{suggestions.phase_label}</span>
                    {suggestions.age_months !== null && ` · ${t('pw.pet.months', { count: suggestions.age_months })}`}
                  </p>
                </div>
              </div>
              <ul className="divide-y divide-surface-100 dark:divide-surface-800 border-t border-surface-100 dark:border-surface-800">
                {visibleSuggestions.map(({ s, u }, i) => {
                  return (
                    <li key={i} className="px-4 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-[15px] text-surface-900 dark:text-white">{s.title}</span>
                        <span className={cn('shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', URGENCY_TONE[u].chip)}>
                          <span className={cn('w-2 h-2 rounded-full', URGENCY_TONE[u].dot)} aria-hidden />
                          {t(`pet2.urg.${u}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-surface-600 dark:text-surface-300 leading-relaxed">{s.description}</p>
                    </li>
                  )
                })}
              </ul>
              {rankedSuggestions.length > SUGGESTIONS_PREVIEW && (
                <button
                  type="button"
                  aria-expanded={allSuggestions}
                  onClick={() => setAllSuggestions(v => !v)}
                  className="pressable-row w-full min-h-[44px] px-4 py-2.5 border-t border-surface-100 dark:border-surface-800 text-left text-sm font-semibold text-primary-700 dark:text-primary-300"
                >
                  {allSuggestions ? t('pet2.seeFewer') : t('pet2.seeAll', { n: rankedSuggestions.length })}
                </button>
              )}
              <p className="px-4 py-3 text-xs text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-900/60 border-t border-surface-100 dark:border-surface-800">
                {t('pw.pet.basedOn')}
              </p>
            </Card>
          )}

          <WeightChart petId={petId} />

          <Card href={`/health/vaccines/carteirinha/${petId}`} padding="none" className="pressable-card flex items-center gap-3 px-4 py-3 min-h-[64px]">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center text-primary-700 dark:text-primary-300">
              <IdCard className="w-5 h-5" aria-hidden />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[15px] text-surface-900 dark:text-white">{t('pet2.walletLink')}</span>
              <span className="block text-[13px] text-surface-600 dark:text-surface-300 truncate">{t('pet2.walletLinkSub')}</span>
            </span>
            <ChevronRight className="w-5 h-5 text-surface-400 dark:text-surface-500 shrink-0" aria-hidden />
          </Card>

          {/* 3ª camada: o que é bom ter, mas não é o motivo de abrir a ficha */}
          <button
            type="button"
            aria-expanded={extraOpen}
            aria-controls="pet-more"
            onClick={() => {
              haptic('toggle')
              setExtraOpen(v => !v)
            }}
            className="pressable-row w-full flex items-center gap-3 min-h-[44px] px-4 py-3 rounded-2xl border border-surface-200/70 dark:border-surface-800 bg-white dark:bg-surface-900 text-left"
          >
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[15px] text-surface-900 dark:text-white">{t('pet2.more', { name: pet.name })}</span>
              {!extraOpen && <span className="block text-[13px] text-surface-600 dark:text-surface-300 truncate">{t('pet2.moreHint')}</span>}
            </span>
            <ChevronDown
              className={cn('w-5 h-5 shrink-0 text-surface-500 dark:text-surface-400 transition-transform duration-200', extraOpen && 'rotate-180')}
              aria-hidden
            />
          </button>

          <AnimatePresence initial={false}>
            {extraOpen && (
              <motion.div
                id="pet-more"
                key="pet-more"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: spring.soft }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                className="space-y-4"
              >
                <HealthForecast pet={pet} />
                <RecapCard petId={petId} />
                <EnrichmentCard petId={petId} petName={pet.name} />
                <ExpensesCard petId={petId} />
                <SeniorProtocolCard petId={petId} />
                <div
                  id="lost-pet"
                  key={lostHighlight}
                  className={cn('scroll-mt-24 rounded-2xl', lostHighlight > 0 && 'motion-safe:animate-[pulse_0.9s_ease-out_1] ring-2 ring-primary-500/60')}
                >
                  <LostPetCard petId={petId} petName={pet.name} petPhoto={pet.photo_url} />
                </div>

                <Card>
                  <h3 className="font-display font-bold text-surface-900 dark:text-white mb-3">{t('pet2.profile')}</h3>
                  <div className="space-y-2.5">
                    {profileFacts.map(f => (
                      <BreedRow key={f.label} label={f.label} value={f.value} spread mono={f.mono} />
                    ))}
                  </div>
                  {pet.breed && (
                    <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800 space-y-2.5">
                      <h4 className="text-sm font-semibold text-surface-800 dark:text-surface-100">{t('pw.pet.breedData')}</h4>
                      {pet.breed.size && <BreedRow label={t('pw.breed.size')} value={getSizeLabel(pet.breed.size)} spread />}
                      {pet.breed.energy_level && <BreedRow label={t('pw.breed.energy')} value={getEnergyLabel(pet.breed.energy_level)} spread />}
                      {pet.breed.life_expectancy_min && (
                        <BreedRow
                          label={t('pw.breed.lifeExpectancy')}
                          value={`${pet.breed.life_expectancy_min}–${pet.breed.life_expectancy_max} ${t('pw.breed.years')}`}
                          spread
                        />
                      )}
                      {pet.breed.temperament && pet.breed.temperament.length > 0 && (
                        <div>
                          <div className="text-sm text-surface-600 dark:text-surface-300 mb-1.5">{t('pw.breed.temperament')}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {pet.breed.temperament.map((temp, i) => (
                              <span key={i} className="chip chip-success">{temp}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {pet.breed.description && (
                        <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">{pet.breed.description}</p>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="animate-fade-in">
          <PetTimeline pet={pet} />
        </div>
      )}

      {tab === 'health' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-surface-900 dark:text-white">{t('pw.pet.vaccines')}</h2>
            <Button variant="ghost" size="sm" leftIcon={Plus} href={`/health/vaccines?pet=${petId}&add=1`} className="text-primary-700 dark:text-primary-300">
              {t('common.add')}
            </Button>
          </div>
          <VaccineTimeline
            vaccines={vaccines}
            onDelete={handleDeleteVaccine}
            onUpdated={v => {
              vacQ.mutate(prev => (prev ?? []).map(x => (x.id === v.id ? { ...x, ...v } : x)))
              invalidate('vaccines')
            }}
          />

          <div className="border-t border-surface-200 dark:border-surface-800 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-display font-bold text-surface-900 dark:text-white">{t('pw.pet.exams')}</h2>
              <Button variant="ghost" size="sm" leftIcon={Plus} href="/health/exams" className="text-primary-700 dark:text-primary-300">
                {t('common.add')}
              </Button>
            </div>
            {exams.length === 0 ? (
              <EmptyState icon={Microscope} title={t('pw.pet.noExams')} />
            ) : (
              <div className="space-y-3">
                {exams.map(e => <ExamCard key={e.id} exam={e} onDelete={handleDeleteExam} />)}
              </div>
            )}
          </div>

          {pet.gender !== 'male' && (
            <div className="border-t border-surface-200 dark:border-surface-800 pt-6">
              <HeatCycleCard
                petId={petId}
                petName={pet.name}
                gender={pet.gender}
                neutered={pet.neutered}
                onEditProfile={() => setEditOpen(true)}
                refreshKey={profileVersion}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'routine' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-xl font-display font-bold text-surface-900 dark:text-white">{t('pw.pet.walkRoutines')}</h2>
            <Button size="sm" leftIcon={Sparkles} loading={generatingRoutine} onClick={handleGenerateRoutine}>
              {routines.length > 0 ? t('pw.pet.regenAI') : t('pw.pet.genRoutineAI')}
            </Button>
          </div>
          {routines.length === 0 ? (
            <Card>
              <EmptyState icon={Dog} title={t('pw.pet.noRoutineTitle')} text={t('pw.pet.noRoutineText')} />
            </Card>
          ) : (
            routines.map(r => (
              <Card key={r.id} padding="lg">
                <div className="grid grid-cols-3 gap-3 mb-6 text-center">
                  {[
                    { v: `${r.walks_per_day ?? 0}x`, l: t('pw.pet.perDay') },
                    { v: `${r.walk_duration_minutes ?? 0}min`, l: t('pw.pet.perWalk') },
                    { v: `${(r.walks_per_day ?? 0) * (r.walk_duration_minutes ?? 0)}min`, l: t('pw.pet.totalPerDay') },
                  ].map(s => (
                    <div key={s.l} className="rounded-xl p-3 bg-primary-50 dark:bg-primary-500/10">
                      <div className="text-2xl font-bold text-primary-800 dark:text-primary-200">{s.v}</div>
                      <div className="text-xs text-primary-800/80 dark:text-primary-300">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="mb-4">
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-200 mb-2">{t('pw.pet.suggestedTimes')}</p>
                  <div className="flex flex-wrap gap-2">
                    {(r.walk_times ?? []).map((time, i) => (
                      <span key={i} className="chip chip-success text-sm">{time}</span>
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
                    <ul className="space-y-1.5">
                      {r.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-300">
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'anamnesis' && (
        <div className="animate-fade-in">
          <h2 className="text-xl font-display font-bold text-surface-900 dark:text-white mb-1">{t('pw.pet.newAnam')}</h2>
          <p className="text-surface-600 dark:text-surface-400 text-sm mb-5">{t('pw.pet.newAnamSubtitle')}</p>

          {anamAnalysis && (
            <div className={cn('mb-6 rounded-2xl p-5', urgencyConfig[anamAnalysis.urgency_level].bg)}>
              <div className={cn('flex items-center gap-2 font-bold mb-3', urgencyConfig[anamAnalysis.urgency_level].text)}>
                {urgencyConfig[anamAnalysis.urgency_level].icon}
                {t('pw.pet.aiAnalysis')} — {urgencyConfig[anamAnalysis.urgency_level].label}
              </div>
              <p className="text-sm text-surface-800 dark:text-surface-100 mb-3">{anamAnalysis.analysis}</p>
              {anamAnalysis.seek_vet_immediately && (
                <div className="chip-danger text-sm font-semibold p-3 rounded-xl mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
                  {t('pw.pet.seekVet')}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold mb-2 text-surface-900 dark:text-white">{t('pw.pet.recommendations')}</p>
                <ul className="space-y-1">
                  {anamAnalysis.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-200">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <form onSubmit={handleAnamSubmit} className="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 p-5 space-y-4">
            <div>
              <label htmlFor="anam-symptoms" className={LABEL}>{t('pw.pet.symptomsObserved')} *</label>
              <textarea
                id="anam-symptoms"
                required
                value={anamForm.symptoms}
                onChange={e => setAnamForm(f => ({ ...f, symptoms: e.target.value }))}
                rows={3}
                placeholder={t('pw.pet.symptomsPlaceholder')}
                className={cn(INPUT, 'resize-none')}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="anam-duration" className={LABEL}>{t('pw.pet.howLong')}</label>
                <input id="anam-duration" type="text" value={anamForm.duration} onChange={e => setAnamForm(f => ({ ...f, duration: e.target.value }))} placeholder={t('pw.pet.howLongPlaceholder')} className={INPUT} />
              </div>
              <div>
                <label htmlFor="anam-appetite" className={LABEL}>{t('pw.pet.appetite')}</label>
                <select id="anam-appetite" value={anamForm.appetite} onChange={e => setAnamForm(f => ({ ...f, appetite: e.target.value }))} className={INPUT}>
                  <option value="">{t('pw.pet.select')}</option>
                  <option value="normal">{t('pw.pet.normal')}</option>
                  <option value="reduced">{t('pw.pet.reduced')}</option>
                  <option value="absent">{t('pw.pet.absent')}</option>
                  <option value="increased">{t('pw.pet.increased')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="anam-water" className={LABEL}>{t('pw.pet.waterIntake')}</label>
                <select id="anam-water" value={anamForm.water_intake} onChange={e => setAnamForm(f => ({ ...f, water_intake: e.target.value }))} className={INPUT}>
                  <option value="">{t('pw.pet.select')}</option>
                  <option value="normal">{t('pw.pet.normal')}</option>
                  <option value="reduced">{t('pw.pet.reducedFem')}</option>
                  <option value="increased">{t('pw.pet.increasedPolydipsia')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="anam-behavior" className={LABEL}>{t('pw.pet.behaviorChanges')}</label>
                <input id="anam-behavior" type="text" value={anamForm.behavior_changes} onChange={e => setAnamForm(f => ({ ...f, behavior_changes: e.target.value }))} placeholder={t('pw.pet.behaviorPlaceholder')} className={INPUT} />
              </div>
              <div>
                <label htmlFor="anam-meds" className={LABEL}>{t('pw.pet.medications')}</label>
                <input id="anam-meds" type="text" value={anamForm.medications} onChange={e => setAnamForm(f => ({ ...f, medications: e.target.value }))} placeholder={t('pw.pet.medicationsPlaceholder')} className={INPUT} />
              </div>
            </div>
            <div>
              <label htmlFor="anam-notes" className={LABEL}>{t('pw.pet.additionalNotes')}</label>
              <textarea id="anam-notes" value={anamForm.notes} onChange={e => setAnamForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={t('pw.pet.notesPlaceholder')} className={cn(INPUT, 'resize-none')} />
            </div>
            <Button type="submit" fullWidth size="lg" loading={submitingAnam} leftIcon={Sparkles}>
              {submitingAnam ? t('pw.pet.analyzingAI') : t('pw.pet.submitAnam')}
            </Button>
          </form>

          {/* Histórico de anamneses */}
          <h2 className="text-lg font-display font-bold text-surface-900 dark:text-white mt-8 mb-4">{t('pw.pet.anamHistory')}</h2>
          {anamnesisHistory.length === 0 ? (
            <Card>
              <EmptyState icon={ClipboardList} title={t('pw.pet.noAnam')} />
            </Card>
          ) : (
            <div className="space-y-3">
              {anamnesisHistory.map(a => {
                const u = a.ai_analysis?.urgency_level
                const cfg = u ? urgencyConfig[u] : null
                return (
                  <Card key={a.id}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-sm text-surface-600 dark:text-surface-400">{formatDate(a.created_at, 'dd/MM/yyyy HH:mm')}</span>
                      {cfg && (
                        <span className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', cfg.bg, cfg.text)}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-surface-900 dark:text-surface-100 font-medium mb-1">{t('pw.pet.symptomsLabel')}</div>
                    <p className="text-sm text-surface-700 dark:text-surface-300 mb-3">{a.symptoms}</p>
                    {a.ai_analysis && (
                      <div className={cn('rounded-xl p-3', cfg?.bg ?? 'border border-surface-200 dark:border-surface-800')}>
                        <p className={cn('text-sm font-semibold mb-1.5', cfg?.text ?? 'text-surface-900 dark:text-white')}>{t('pw.pet.aiAnalysisLabel')}</p>
                        <p className="text-sm text-surface-800 dark:text-surface-200 mb-2">{a.ai_analysis.analysis}</p>
                        {a.ai_analysis.recommendations.length > 0 && (
                          <ul className="space-y-1 list-disc pl-4">
                            {a.ai_analysis.recommendations.map((rec, i) => (
                              <li key={i} className="text-xs text-surface-700 dark:text-surface-300">{rec}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'stories' && (
        <div className="animate-fade-in">
          <div className="mb-5">
            <h2 className="text-xl font-display font-bold text-surface-900 dark:text-white">{t('pw.pet.storiesOf', { name: pet.name })}</h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm mt-0.5">{t('pw.pet.storiesSubtitle')}</p>
          </div>
          <StoriesFeed petId={petId} petName={pet.name} />
        </div>
      )}

      {tab === 'family' && (
        <div className="animate-fade-in">
          <div className="mb-5">
            <h2 className="text-xl font-display font-bold text-surface-900 dark:text-white">{t('pw.pet.familyOf', { name: pet.name })}</h2>
            <p className="text-surface-600 dark:text-surface-400 text-sm mt-0.5">{t('pw.pet.familySubtitle')}</p>
          </div>
          <FamilyTreeSection petId={petId} petName={pet.name} />
        </div>
      )}

      {tab === 'care' && (
        <div className="animate-fade-in">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-display font-bold text-surface-900 dark:text-white">{t('pw.pet.careGuideTitle')}</h2>
              <p className="text-surface-600 dark:text-surface-400 text-sm mt-0.5">{t('pw.pet.careGuideSubtitle', { name: pet.name })}</p>
            </div>
            {pet.breed_id && !careGuide && (
              <Button size="sm" leftIcon={Sparkles} loading={generatingCare} onClick={handleLoadCareGuide}>
                {t('pw.pet.genCareGuide')}
              </Button>
            )}
          </div>
          {!pet.breed_id && (
            <Card>
              <EmptyState icon={Dna} title={t('pw.pet.noBreed')} text={t('pw.pet.noBreedCareText')} ctaLabel={t('petx.edit')} onCta={() => setEditOpen(true)} />
            </Card>
          )}
          {pet.breed_id && !careGuide && !generatingCare && (
            <Card>
              <EmptyState icon={Sparkles} title={t('pw.pet.careNotGenerated')} text={t('pw.pet.careNotGeneratedText')} />
            </Card>
          )}
          {careGuide && (
            <div className="space-y-3">
              {[
                { icon: Utensils, title: t('pw.pet.careFeeding'), content: careGuide.feeding_tips },
                { icon: Activity, title: t('pw.pet.careExercise'), content: careGuide.exercise_recommendations },
                { icon: Scissors, title: t('pw.pet.careGrooming'), content: careGuide.grooming_guide },
                { icon: Stethoscope, title: t('pw.pet.careHealth'), content: careGuide.health_alerts },
                { icon: GraduationCap, title: t('pw.pet.careTraining'), content: careGuide.training_tips },
              ].map(s => (
                <Card key={s.title}>
                  <h3 className="flex items-center gap-2 font-display font-bold text-surface-900 dark:text-white mb-2">
                    <span className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 flex items-center justify-center">
                      <s.icon className="w-4 h-4" aria-hidden />
                    </span>
                    {s.title}
                  </h3>
                  <p className="text-sm text-surface-700 dark:text-surface-200 leading-relaxed whitespace-pre-line">{s.content}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}

/** A única próxima ação do pet, pela situação mais urgente. */
function NextAction({
  summary,
  petId,
  onProtection,
}: {
  summary: PetCareSummary
  petId: number
  onProtection: (k: 'vermifugo' | 'antipulgas') => void
}) {
  const t = useT()
  const next = summary.next
  const vacc = summary.items[0]
  const protNever = summary.items.find(i => i.kind !== 'vaccines' && i.state === 'never')

  let content: { label: string; icon: LucideIcon; href?: string; onClick?: () => void; variant: 'primary' | 'secondary' }
  if (next?.kind === 'vaccines') {
    content = {
      label: next.vaccineName ? t('petx.next.booster', { vaccine: next.vaccineName }) : t('petx.next.scan'),
      icon: Syringe,
      href: next.vaccineName
        ? `/health/vaccines?pet=${petId}&add=1&name=${encodeURIComponent(next.vaccineName)}`
        : `/health/vaccines?pet=${petId}&scan=1`,
      variant: 'primary',
    }
  } else if (next) {
    const k = next.kind as 'vermifugo' | 'antipulgas'
    content = { label: t(`petx.next.${k}`), icon: k === 'vermifugo' ? Pill : Bug, onClick: () => onProtection(k), variant: 'primary' }
  } else if (vacc.state === 'never') {
    content = { label: t('petx.next.scan'), icon: Camera, href: `/health/vaccines?pet=${petId}&scan=1`, variant: 'primary' }
  } else if (protNever) {
    const k = protNever.kind as 'vermifugo' | 'antipulgas'
    content = { label: t(`petx.next.${k}`), icon: k === 'vermifugo' ? Pill : Bug, onClick: () => onProtection(k), variant: 'primary' }
  } else {
    content = { label: t('petx.next.wallet'), icon: IdCard, href: `/health/vaccines/carteirinha/${petId}`, variant: 'secondary' }
  }

  return (
    <div className="mt-4">
      {summary.worst === 'ok' && (
        <p className="mb-2 text-center text-sm font-medium text-emerald-800 dark:text-emerald-300">{t('petx.next.allOk')}</p>
      )}
      <Button fullWidth size="lg" variant={content.variant} leftIcon={content.icon} href={content.href} onClick={content.onClick}>
        {content.label}
      </Button>
    </div>
  )
}

function ActionTile({
  icon: Icon,
  label,
  href,
  onClick,
  ariaLabel,
}: {
  icon: LucideIcon
  label: string
  href?: string
  onClick?: () => void
  ariaLabel?: string
}) {
  const cls =
    'pressable flex flex-col items-center justify-center gap-1.5 min-h-[76px] px-1 rounded-2xl bg-primary-50 text-primary-800 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-200 dark:hover:bg-primary-500/25 transition-colors'
  const inner = (
    <>
      <Icon className="w-[22px] h-[22px]" aria-hidden />
      <span className="text-[13px] font-semibold leading-tight text-center line-clamp-1">{label}</span>
    </>
  )
  return href ? (
    <Link href={href} className={cls} aria-label={ariaLabel}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} aria-label={ariaLabel}>
      {inner}
    </button>
  )
}

function BreedRow({ label, value, spread, mono }: { label: string; value: string; spread?: boolean; mono?: boolean }) {
  return (
    <div className={cn('text-sm', spread && 'flex justify-between items-center gap-3')}>
      <span className={cn(spread ? 'text-surface-600 dark:text-surface-300' : 'font-medium text-surface-700 dark:text-surface-200')}>
        {label}
        {spread ? '' : ':'}
      </span>{' '}
      <span className={cn(spread ? 'font-semibold text-surface-900 dark:text-white' : 'text-surface-600 dark:text-surface-300', mono && 'font-mono text-xs')}>
        {value}
      </span>
    </div>
  )
}
