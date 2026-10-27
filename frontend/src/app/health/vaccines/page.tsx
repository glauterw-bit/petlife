'use client'

/**
 * Vacinas — da mais urgente para a em dia.
 *
 * Contrato de URL (usado pelo Início e pela ficha do pet):
 *   ?pet={id}               filtra o pet
 *   &novo=1                 vindo do cadastro: faixa "Vamos registrar as vacinas de {pet}" + quick-start
 *   &scan=1                 abre a leitura da carteirinha por foto, já com o pet escolhido
 *   &add=1[&name={nome}]    abre o formulário com o nome preenchido e a aplicação = hoje
 */
import { useCallback, useEffect, useMemo, useRef, useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { m } from 'framer-motion'
import {
  AlertCircle, Camera, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, CreditCard, HelpCircle, Keyboard, Plus,
  type LucideIcon,
} from 'lucide-react'
import { VaccineTimeline, type UrgencyGroup } from '@/components/health/VaccineTimeline'
import { VaccineQuickStart } from '@/components/health/VaccineQuickStart'
import { vaccineInputCls, vaccineLabelCls } from '@/components/health/EditVaccineModal'
import { ScanReview } from './_components/ScanReview'
import { PetFilter } from '../_components/PetFilter'
import { vaccines as vaccinesApi, pets as petsApi, type Vaccine, type Pet, type ScannedVaccine } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'
import { trackHappyMoment } from '@/lib/review'
import { useCached, invalidate } from '@/lib/cache'
import { latestDoses, normalizeVaccineName, vaccineState } from '@/lib/care'
import { celebrate, haptic } from '@/lib/feedback'
import { getPushPermission } from '@/lib/push'
import { spring, usePrefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useHideAssistant } from '@/components/layout/shell'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { SuccessCheck } from '@/components/ui/SuccessCheck'
import { PushPrimer, pushPrimerSeen } from '@/components/ui/PushPrimer'
import { FADE_IN, Skeleton, SkeletonList, SkeletonTile } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { ScrollHint } from '@/components/ui/ScrollHint'

/**
 * Vacinas mais comuns no Brasil, por espécie. Existem para eliminar a digitação
 * — o formulário longo era o ponto onde a maioria desistia (1 de 110 usuários
 * chegava a registrar uma vacina).
 * `annual` alimenta a sugestão automática da próxima dose.
 */
const COMMON_VACCINES: Record<string, Array<{ name: string; annual: boolean }>> = {
  dog: [
    { name: 'V10 (Polivalente)', annual: true },
    { name: 'Antirrábica', annual: true },
    { name: 'Gripe canina', annual: true },
    { name: 'Giárdia', annual: true },
    { name: 'Vermífugo', annual: false },
    { name: 'Antipulgas', annual: false },
  ],
  cat: [
    { name: 'V4 (Quádrupla felina)', annual: true },
    { name: 'Antirrábica', annual: true },
    { name: 'Leucemia felina (FeLV)', annual: true },
    { name: 'Vermífugo', annual: false },
    { name: 'Antipulgas', annual: false },
  ],
}

/** 'YYYY-MM-DD' no fuso do aparelho (toISOString viraria o dia às 21h no Brasil). */
function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y, m - 1, d + days))
}

function plusOneYear(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  if (!y) return ''
  return localDay(new Date(y + 1, m - 1, d))
}

function isAnnual(name: string): boolean {
  const n = normalizeVaccineName(name)
  if (!n) return false
  return Object.values(COMMON_VACCINES)
    .flat()
    .some(v => v.annual && (normalizeVaccineName(v.name).startsWith(n) || n.startsWith(normalizeVaccineName(v.name).split(' ')[0])))
}

/**
 * Próxima dose sugerida: repete o intervalo que o próprio tutor registrou na
 * dose anterior; sem isso, 1 ano para as vacinas anuais conhecidas.
 */
function suggestNextDue(name: string, given: string, previous?: Vaccine): string {
  if (previous?.next_due && previous.date_given) {
    const a = new Date(previous.date_given.slice(0, 10) + 'T12:00:00').getTime()
    const b = new Date(previous.next_due.slice(0, 10) + 'T12:00:00').getTime()
    const days = Math.round((b - a) / 86_400_000)
    if (days > 0 && days < 3 * 365) return addDays(given, days)
  }
  return isAnnual(name) ? plusOneYear(given) : ''
}

type Mode = 'choose' | 'scan' | 'manual' | 'memory'

const EMPTY_FORM = { pet_id: '', name: '', date_given: '', next_due: '', veterinarian: '', lot_number: '', notes: '' }

const TILE: Record<Exclude<UrgencyGroup, 'previous'>, { bg: string; fg: string; Icon: LucideIcon }> = {
  overdue: { bg: 'tone-danger-bg', fg: 'text-red-700 dark:text-red-300', Icon: AlertCircle },
  soon: { bg: 'tone-warning-bg', fg: 'text-amber-800 dark:text-amber-300', Icon: Clock },
  ok: { bg: 'tone-success-bg', fg: 'text-emerald-800 dark:text-emerald-300', Icon: CheckCircle2 },
}

function VaccinesSkeleton() {
  return (
    <div aria-hidden>
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <SkeletonTile />
        <SkeletonTile />
        <SkeletonTile />
      </div>
      <Skeleton className="h-11 w-2/3 rounded-full mb-5" />
      <SkeletonList count={3} />
    </div>
  )
}

/** Atalho para a carteirinha de um pet (no carrossel quando há mais de um). */
function PassLink({ pet, carousel = false }: { pet: Pet; carousel?: boolean }) {
  const t = useT()
  return (
    <Link
      href={`/health/vaccines/carteirinha/${pet.id}`}
      aria-label={t('care.cardTitle', { pet: pet.name })}
      className={cn(
        'pressable-card snap-start flex items-center gap-3 rounded-2xl p-3.5 pr-2 text-white bg-gradient-to-br from-primary-700 to-primary-900 shadow-card',
        carousel ? 'shrink-0 w-[82%] max-w-[320px]' : 'w-full',
      )}
    >
      <span className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0 self-start">
        <CreditCard className="w-5 h-5" aria-hidden />
      </span>
      {/* Nome e subtítulo quebram linha — nunca "Ca… En…" no carrossel */}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug break-words">{t('care.cardTitle', { pet: pet.name })}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-white/85">{t('care.cardText')}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-white/85 shrink-0" aria-hidden />
    </Link>
  )
}

function VaccinesPageInner() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const reduced = usePrefersReducedMotion()
  const { success, error } = useToast()

  const vaccinesQ = useCached<Vaccine[]>('vaccines', () => vaccinesApi.list())
  const petsQ = useCached<Pet[]>('pets', () => petsApi.list())
  const vaccineList = useMemo(() => vaccinesQ.data ?? [], [vaccinesQ.data])
  const petList = useMemo(() => petsQ.data ?? [], [petsQ.data])
  const ready = vaccinesQ.data !== undefined && petsQ.data !== undefined

  const [filterPet, setFilterPet] = useState<number | 'all'>(() => {
    const p = Number(params?.get('pet'))
    return Number.isFinite(p) && p > 0 ? p : 'all'
  })
  const [banner, setBanner] = useState<Pet | null>(null)
  const [revealPrev, setRevealPrev] = useState(0)

  // Folha de nova vacina
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('choose')
  const [form, setForm] = useState(EMPTY_FORM)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedLabel, setSavedLabel] = useState<string | null>(null)
  // Leitura por foto
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<ScannedVaccine[] | null>(null)
  const [include, setInclude] = useState<boolean[]>([])
  const [scanNote, setScanNote] = useState('')
  // Quick-start pós-cadastro: 2 vacinas em 30s, no lugar do formulário completo
  const [quickStartPet, setQuickStartPet] = useState<Pet | null>(null)
  const quickStartBefore = useRef(0)
  // Pedido de notificação com contexto (depois da 1ª vacina)
  const [primer, setPrimer] = useState<{ petName: string; vaccineName?: string } | null>(null)

  useHideAssistant(sheetOpen)

  // Filtro de pet que não existe mais (ex.: pet excluído) volta para "Todos"
  useEffect(() => {
    if (ready && filterPet !== 'all' && !petList.some(p => p.id === filterPet)) setFilterPet('all')
  }, [ready, filterPet, petList])

  const defaultPetId = useCallback(
    (preferred?: number) => {
      if (preferred && petList.some(p => p.id === preferred)) return String(preferred)
      if (filterPet !== 'all') return String(filterPet)
      return petList[0] ? String(petList[0].id) : ''
    },
    [petList, filterPet],
  )

  const openSheet = useCallback(
    (opts: { mode?: Mode; petId?: number; name?: string } = {}) => {
      const pet_id = defaultPetId(opts.petId)
      const today = localDay()
      const name = opts.name ?? ''
      const previous = name
        ? latestDoses(vaccineList).find(
            v => String(v.pet_id) === pet_id && normalizeVaccineName(v.name) === normalizeVaccineName(name),
          )
        : undefined
      setForm({ ...EMPTY_FORM, pet_id, name, date_given: today, next_due: name ? suggestNextDue(name, today, previous) : '' })
      setMode(opts.mode ?? (name ? 'manual' : 'choose'))
      setScanned(null)
      setInclude([])
      setScanNote('')
      setShowDetails(false)
      setDocFile(null)
      setSavedLabel(null)
      setSheetOpen(true)
    },
    [defaultPetId, vaccineList],
  )

  // Contrato de URL — processado uma vez por combinação de parâmetros
  const handledParams = useRef<string | null>(null)
  useEffect(() => {
    if (!ready) return
    const key = params?.toString() ?? ''
    if (handledParams.current === key) return
    handledParams.current = key
    const petParam = Number(params?.get('pet'))
    const pet = petList.find(p => p.id === petParam) ?? (petParam ? undefined : petList[0])
    const novo = params?.get('novo') === '1'
    const scan = params?.get('scan') === '1'
    const add = params?.get('add') === '1'
    if (!novo && !scan && !add) return
    if (pet) {
      if (novo) {
        setBanner(pet)
        quickStartBefore.current = vaccineList.length
        if (!scan && !add) setQuickStartPet(pet)
      }
      if (scan) openSheet({ mode: 'scan', petId: pet.id })
      else if (add) openSheet({ mode: 'manual', petId: pet.id, name: params?.get('name') ?? '' })
    }
    // limpa a URL para que recarregar a tela não abra tudo de novo
    router.replace(pet ? `/health/vaccines?pet=${pet.id}` : '/health/vaccines', { scroll: false })
  }, [ready, params, petList, vaccineList.length, openSheet, router])

  const selectedPet = petList.find(p => String(p.id) === String(form.pet_id))
  const selectedSpecies = selectedPet?.species ?? ''

  const filtered = filterPet === 'all' ? vaccineList : vaccineList.filter(v => v.pet_id === filterPet)
  const latest = latestDoses(filtered)
  const counts = {
    overdue: latest.filter(v => vaccineState(v) === 'overdue').length,
    soon: latest.filter(v => vaccineState(v) === 'soon').length,
    ok: latest.filter(v => vaccineState(v) === 'ok').length,
  }
  // Carteirinhas: o pet com a pior situação vem primeiro (mesma regra do Início)
  const petRank = (id: number) => {
    const doses = latest.filter(v => v.pet_id === id)
    if (doses.some(v => vaccineState(v) === 'overdue')) return 0
    if (doses.some(v => vaccineState(v) === 'soon')) return 1
    return 2
  }
  const cardPets = (filterPet === 'all' ? petList : petList.filter(p => p.id === filterPet))
    .slice()
    .sort((a, b) => petRank(a.id) - petRank(b.id))
  const bannerVisible = !!banner && !vaccineList.some(v => v.pet_id === banner.id)

  /**
   * Depois de registrar: o registro de rotina fica só no check + haptic('saved').
   * Confete apenas no marco real — a PRIMEIRA vacina do tutor — seguido do
   * pedido de aviso com contexto.
   */
  async function afterCreate(before: number, petName: string, vaccineName?: string) {
    if (before > 0) return
    // celebrate() já vibra (haptic 'milestone'); chamar aqui também vibrava 2x.
    celebrate('small')
    if (pushPrimerSeen()) return
    try {
      if ((await getPushPermission()) === 'prompt') setPrimer({ petName, vaccineName })
    } catch {}
  }

  function syncAfterChange(petId: number) {
    invalidate('vaccines')
    invalidate(`carteirinha:${petId}`)
    invalidate('reminders')
  }

  function closeSheet() {
    setSheetOpen(false)
  }

  /** Mostra o check na própria folha e fecha logo depois. */
  function finishWithSuccess(label: string) {
    setSavedLabel(label)
    window.setTimeout(() => setSheetOpen(false), reduced ? 700 : 1000)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.pet_id) { error(t('h.form.selectPetError')); return }
    const petId = Number(form.pet_id)
    const before = vaccineList.length
    const previous = latestDoses(vaccineList).find(
      v => v.pet_id === petId && normalizeVaccineName(v.name) === normalizeVaccineName(form.name),
    )
    setSubmitting(true)
    try {
      const v = await vaccinesApi.create({
        pet_id: petId,
        name: form.name.trim(),
        date_given: form.date_given,
        next_due: form.next_due || undefined,
        veterinarian: form.veterinarian || undefined,
        lot_number: form.lot_number || undefined,
        notes: form.notes || undefined,
      })
      if (docFile) await vaccinesApi.uploadDocument(v.id, docFile).catch(() => {})
      vaccinesQ.mutate(prev => [v, ...(prev ?? [])])
      syncAfterChange(petId)
      haptic('saved')
      // Ação central do app — é aqui que o tutor resolve o problema dele.
      trackHappyMoment('vacina_cadastrada')
      // Reforço de uma dose atrasada/vencendo: a antiga desliza para "Doses anteriores".
      if (previous && vaccineState(previous) !== 'ok') setRevealPrev(k => k + 1)
      finishWithSuccess(t('care.saved'))
      void afterCreate(before, selectedPet?.name ?? '', v.name)
    } catch (err: unknown) {
      haptic('error')
      error(err instanceof Error ? err.message : t('h.vaccines.createError'))
    } finally { setSubmitting(false) }
  }

  async function handleDelete(id: number) {
    const v = vaccineList.find(x => x.id === id)
    try {
      await vaccinesApi.delete(id)
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : t('g.misc.error'))
      return
    }
    vaccinesQ.mutate(prev => (prev ?? []).filter(x => x.id !== id))
    if (v) syncAfterChange(v.pet_id)
    success(t('h.vaccines.deleted'))
  }

  async function handleScan(file: File) {
    if (!form.pet_id) { error(t('h.form.selectPetError')); return }
    setScanning(true); setScanned(null); setScanNote('')
    try {
      const r = await vaccinesApi.scanCard(Number(form.pet_id), file)
      track('vaccine_scan_ok', { meta: `${r.vaccines?.length ?? 0} vacinas` })
      if (r.image_quality === 'ruim' || !r.vaccines.length) {
        setScanNote(r.image_quality_notes || t('h.scan.nothingFound'))
      } else {
        setScanned(r.vaccines)
        setInclude(r.vaccines.map(() => true))
        setScanNote(r.notes || '')
      }
    } catch (e: unknown) {
      setScanNote(e instanceof Error ? e.message : t('h.scan.error'))
    } finally { setScanning(false) }
  }

  const toSave = (scanned ?? []).filter((_, i) => include[i] !== false)

  async function saveScanned() {
    if (!toSave.length) { error(t('care.scanNone')); return }
    const petId = Number(form.pet_id)
    const before = vaccineList.length
    setSubmitting(true)
    const hoje = localDay()
    const criadas: Vaccine[] = []
    try {
      for (const v of toSave) {
        const created = await vaccinesApi.create({
          pet_id: petId,
          name: v.name.trim(),
          date_given: v.date_given || hoje,
          next_due: v.next_due || undefined,
          lot_number: v.lot || undefined,
          veterinarian: v.vet || undefined,
        })
        criadas.push(created)
      }
      haptic('saved')
      trackHappyMoment('vacina_scan')
      finishWithSuccess(criadas.length === 1 ? t('care.saved') : t('care.savedMany', { n: criadas.length }))
      void afterCreate(before, selectedPet?.name ?? '', criadas[0]?.name)
    } catch (err: unknown) {
      haptic('error')
      error(err instanceof Error ? err.message : t('h.vaccines.createError'))
    } finally {
      if (criadas.length) {
        vaccinesQ.mutate(prev => [...criadas, ...(prev ?? [])])
        syncAfterChange(petId)
      }
      setSubmitting(false)
    }
  }

  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  function scrollToGroup(g: UrgencyGroup) {
    document.getElementById(`sec-${g}`)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  const refreshAll = () => Promise.all([vaccinesQ.refresh(), petsQ.refresh()])

  const backBtn = (
    <Button
      variant="ghost"
      size="sm"
      leftIcon={ChevronLeft}
      className="-ml-2"
      onClick={() => { setMode('choose'); setScanned(null); setScanNote('') }}
    >
      {t('nav.back')}
    </Button>
  )

  const petChooser = petList.length > 1 && (
    <fieldset>
      <legend className={vaccineLabelCls}>{mode === 'scan' ? t('care.scanFor') : t('h.form.pet')}</legend>
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {petList.map(p => {
          const active = String(p.id) === String(form.pet_id)
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setForm(f => ({ ...f, pet_id: String(p.id) }))}
              className={cn(
                'pressable min-h-[44px] inline-flex items-center gap-2 rounded-full pl-1.5 pr-4 border text-sm font-semibold transition-colors',
                active
                  ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-500/15 dark:text-primary-200'
                  : 'border-surface-200 text-surface-700 dark:border-surface-700 dark:text-surface-200',
              )}
            >
              <PetAvatar pet={p} size={32} />
              {p.name}
            </button>
          )
        })}
      </div>
    </fieldset>
  )

  let sheetFooter: React.ReactNode = undefined
  if (!savedLabel) {
    if (mode === 'manual' || mode === 'memory') {
      sheetFooter = (
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={closeSheet}>{t('common.cancel')}</Button>
          <Button type="submit" form="vaccine-form" fullWidth loading={submitting}>
            {submitting ? t('h.form.saving') : t('h.vaccines.submit')}
          </Button>
        </div>
      )
    } else if (mode === 'scan' && scanned) {
      sheetFooter = (
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => { setScanned(null); setScanNote('') }}>
            {t('h.scan.retake')}
          </Button>
          <Button fullWidth loading={submitting} disabled={!toSave.length} onClick={saveScanned}>
            {toSave.length === 1 ? t('care.scanSaveOne') : t('care.scanSave', { n: toSave.length })}
          </Button>
        </div>
      )
    }
  }

  return (
    <>
      <PageHeader
        title={t('h.vaccines.title')}
        subtitle={t('care.subtitle')}
        actions={
          <>
            {/* Hierarquia: "+" é a ação principal (cheio); câmera é secundária (fantasma). */}
            <IconButton icon={Camera} label={t('care.scanAria')} variant="ghost" className="rounded-full text-surface-800 dark:text-surface-100" onClick={() => openSheet({ mode: 'scan' })} disabled={!ready || !petList.length} />
            <IconButton icon={Plus} label={t('care.addAria')} variant="header-primary" onClick={() => openSheet()} disabled={!ready || !petList.length} />
          </>
        }
      />

      <PullToRefresh onRefresh={refreshAll}>
        {!ready ? (
          vaccinesQ.error && !vaccinesQ.data ? (
            <Card className="text-center" padding="lg">
              <p className="text-sm text-surface-700 dark:text-surface-200 mb-3">{t('care.loadError')}</p>
              <Button variant="secondary" onClick={() => void refreshAll()}>{t('ui.retry')}</Button>
            </Card>
          ) : (
            <VaccinesSkeleton />
          )
        ) : (
          <div className={cn('pb-6', FADE_IN)}>
            {bannerVisible && banner && (
              <Card tone="brand" padding="md" className="mb-5">
                <div className="flex items-start gap-3">
                  <PetAvatar pet={banner} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold text-surface-900 dark:text-white leading-snug">
                      {t('care.newPetTitle', { pet: banner.name })}
                    </p>
                    <p className="mt-0.5 text-sm text-surface-600 dark:text-surface-300">{t('care.newPetText')}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" leftIcon={Camera} onClick={() => openSheet({ mode: 'scan', petId: banner.id })}>
                    {t('care.newPetPhoto')}
                  </Button>
                  <Button size="sm" variant="secondary" leftIcon={Keyboard} onClick={() => openSheet({ mode: 'manual', petId: banner.id })}>
                    {t('care.newPetType')}
                  </Button>
                </div>
              </Card>
            )}

            {/* Resumo: só as doses mais recentes contam */}
            {latest.length > 0 && (
              <div role="group" aria-label={t('care.summaryAria')} className="grid grid-cols-3 gap-2.5 mb-5">
                {(['overdue', 'soon', 'ok'] as const).map(k => {
                  const tile = TILE[k]
                  const label = k === 'overdue' ? t('care.tileOverdue') : k === 'soon' ? t('care.tileSoon') : t('care.tileOk')
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={counts[k] === 0}
                      onClick={() => scrollToGroup(k)}
                      className={cn(
                        'pressable text-left rounded-2xl border p-3 min-h-[88px] flex flex-col gap-2 disabled:opacity-100 disabled:cursor-default',
                        counts[k] > 0 ? tile.bg : 'bg-white border-surface-200/70 dark:bg-surface-900 dark:border-surface-800',
                      )}
                    >
                      <tile.Icon className={cn('w-5 h-5', counts[k] > 0 ? tile.fg : 'text-surface-400 dark:text-surface-500')} aria-hidden />
                      <span>
                        <AnimatedNumber
                          value={counts[k]}
                          className={cn('num-hero block text-[28px] leading-none', counts[k] > 0 ? tile.fg : 'text-surface-500 dark:text-surface-400')}
                        />
                        <span className="mt-1 block text-xs font-medium leading-tight text-surface-600 dark:text-surface-300">{label}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {petList.length > 1 && (
              <div className="mb-5">
                <PetFilter pets={petList} value={filterPet} onChange={setFilterPet} />
              </div>
            )}

            {/* Carteirinha — o documento que o tutor envia */}
            {cardPets.length > 0 &&
              (cardPets.length > 1 ? (
                <ScrollHint className="mb-6 -mx-4 px-4 scroll-px-4 gap-3 snap-mandatory">
                  {cardPets.map(p => (
                    <PassLink key={p.id} pet={p} carousel />
                  ))}
                </ScrollHint>
              ) : (
                <div className="mb-6">
                  <PassLink pet={cardPets[0]} />
                </div>
              ))}

            <VaccineTimeline
              vaccines={filtered}
              pets={petList}
              showPet={filterPet === 'all' && petList.length > 1}
              groupByUrgency
              confirmDelete
              onDelete={handleDelete}
              onUpdated={v => vaccinesQ.mutate(list => (list ?? []).map(x => (x.id === v.id ? { ...x, ...v } : x)))}
              onRegisterDose={v => openSheet({ mode: 'manual', petId: v.pet_id, name: v.name })}
              revealPreviousKey={revealPrev}
              emptyCta={petList.length ? { label: t('care.emptyCta'), onClick: () => openSheet() } : undefined}
            />
          </div>
        )}
      </PullToRefresh>

      {quickStartPet && (
        <VaccineQuickStart
          pet={{ id: quickStartPet.id, name: quickStartPet.name, species: String(quickStartPet.species), birth_date: quickStartPet.birth_date }}
          onCreated={v => vaccinesQ.mutate(prev => [v, ...(prev ?? [])])}
          onDone={created => {
            syncAfterChange(quickStartPet.id)
            void afterCreate(quickStartBefore.current, quickStartPet.name, created[0]?.name)
          }}
          onClose={() => setQuickStartPet(null)}
          onPhoto={() => { const p = quickStartPet; setQuickStartPet(null); openSheet({ mode: 'scan', petId: p.id }) }}
        />
      )}

      <PushPrimer
        open={!!primer && !sheetOpen && !quickStartPet}
        onClose={() => setPrimer(null)}
        petName={primer?.petName ?? ''}
        vaccineName={primer?.vaccineName}
      />

      <Sheet
        open={sheetOpen}
        onClose={closeSheet}
        title={savedLabel ? undefined : t('dash.newVaccine')}
        ariaLabel={t('dash.newVaccine')}
        size={mode === 'scan' && scanned ? 'tall' : 'auto'}
        footer={sheetFooter}
      >
        {savedLabel ? (
          <div className="py-10 flex justify-center">
            <SuccessCheck size={76} label={savedLabel} />
          </div>
        ) : (
          <>
            {/* Passo 1: o tutor tem a carteirinha em mãos? Perguntar isso primeiro
                evita travar quem não tem — que era a maioria. */}
            {mode === 'choose' && (
              <div className="space-y-2.5 pb-1">
                <p className="text-sm text-surface-600 dark:text-surface-300 mb-1">{t('h.scan.chooseTitle')}</p>
                {([
                  { m: 'scan' as Mode, Icon: Camera, title: t('h.scan.optPhoto'), desc: t('h.scan.optPhotoDesc'), strong: true },
                  { m: 'manual' as Mode, Icon: Keyboard, title: t('h.scan.optManual'), desc: t('h.scan.optManualDesc') },
                  { m: 'memory' as Mode, Icon: HelpCircle, title: t('h.scan.optMemory'), desc: t('h.scan.optMemoryDesc') },
                ]).map(o => (
                  <button
                    key={o.m}
                    type="button"
                    onClick={() => setMode(o.m)}
                    className={cn(
                      'pressable w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-colors',
                      o.strong
                        ? 'border-primary-200 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10'
                        : 'border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800',
                    )}
                  >
                    <span
                      className={cn(
                        'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                        o.strong
                          ? 'bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950'
                          : 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-200',
                      )}
                    >
                      <o.Icon className="w-5 h-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-surface-900 dark:text-white">{o.title}</span>
                      <span className="block text-[13px] text-surface-600 dark:text-surface-300">{o.desc}</span>
                    </span>
                    <ChevronRight className="w-5 h-5 text-surface-400 shrink-0" aria-hidden />
                  </button>
                ))}
              </div>
            )}

            {/* Caminho A: foto da carteirinha */}
            {mode === 'scan' && (
              <div className="space-y-4 pb-1">
                {backBtn}
                {!scanned && petChooser}
                {!scanned && (
                  <label className={cn('block', scanning ? 'cursor-wait' : 'cursor-pointer')}>
                    <div className="border-2 border-dashed border-primary-300 dark:border-primary-500/40 rounded-2xl p-8 text-center hover:bg-primary-50/50 dark:hover:bg-primary-500/10 transition-colors">
                      {scanning ? (
                        <div role="status">
                          <span className="inline-block w-8 h-8 border-2 border-primary-200 border-t-primary-700 dark:border-primary-500/30 dark:border-t-primary-400 rounded-full animate-spin mb-3" />
                          <p className="text-sm font-medium text-surface-700 dark:text-surface-200">{t('h.scan.reading')}</p>
                        </div>
                      ) : (
                        <>
                          <Camera className="w-9 h-9 mx-auto text-primary-700 dark:text-primary-300 mb-2" aria-hidden />
                          <p className="text-[15px] font-semibold text-surface-800 dark:text-surface-100">{t('h.scan.tapToPhoto')}</p>
                          <p className="text-[13px] text-surface-600 dark:text-surface-400 mt-1">{t('h.scan.tapHint')}</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      disabled={scanning || !form.pet_id}
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleScan(f) }}
                    />
                  </label>
                )}

                {scanNote && (
                  <p className="text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 rounded-xl p-3">
                    {scanNote}
                  </p>
                )}

                {scanned && (
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-surface-900 dark:text-white">
                        {scanned.length === 1 ? t('care.scanFoundOne') : t('care.scanFound', { n: scanned.length })}
                      </p>
                      <p className="text-[13px] text-surface-600 dark:text-surface-400">{t('care.scanReview')}</p>
                    </div>
                    <ScanReview
                      items={scanned}
                      include={include}
                      onToggle={i => setInclude(arr => arr.map((x, j) => (j === i ? !x : x)))}
                      onChange={(i, patch) => setScanned(prev => (prev ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)))}
                    />
                  </div>
                )}
              </div>
            )}

            {(mode === 'manual' || mode === 'memory') && (
              <form id="vaccine-form" onSubmit={handleSubmit} className="space-y-4 pb-1">
                {backBtn}
                {mode === 'memory' && (
                  <p className="text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 rounded-xl p-3">
                    {t('h.scan.memoryHint')}
                  </p>
                )}
                {petChooser}
                {/* Atalhos: um toque preenche nome e já sugere a próxima dose */}
                {selectedSpecies && COMMON_VACCINES[selectedSpecies] && (
                  <fieldset>
                    <legend className={vaccineLabelCls}>{t('h.vaccines.quickPick')}</legend>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_VACCINES[selectedSpecies].map(v => {
                        const active = form.name === v.name
                        return (
                          <button
                            key={v.name}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setForm(f => ({
                              ...f,
                              name: v.name,
                              next_due: v.annual ? plusOneYear(f.date_given) : f.next_due,
                            }))}
                            className={cn(
                              'pressable min-h-[44px] text-sm font-medium px-3.5 rounded-xl border transition-colors',
                              active
                                ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-500/15 dark:text-primary-200'
                                : 'border-surface-200 text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800',
                            )}
                          >
                            {v.name}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                )}

                <div>
                  <label htmlFor="vf-name" className={vaccineLabelCls}>{t('h.vaccines.fName')}</label>
                  <input id="vf-name" required type="text" value={form.name} onChange={set('name')} placeholder={t('h.vaccines.fNamePh')} className={vaccineInputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="vf-given" className={vaccineLabelCls}>
                      {mode === 'memory' ? t('h.scan.approxDate') : t('h.vaccines.fApplied')}
                    </label>
                    <input id="vf-given" required type="date" max={localDay()} value={form.date_given} onChange={set('date_given')} className={vaccineInputCls} />
                  </div>
                  <div>
                    <label htmlFor="vf-next" className={vaccineLabelCls}>{t('h.vaccines.fNextDose')}</label>
                    <input id="vf-next" type="date" value={form.next_due} onChange={set('next_due')} className={vaccineInputCls} />
                  </div>
                </div>

                {/* O resto é opcional e fica escondido: era o que fazia a maioria
                    desistir no meio do cadastro. */}
                <button
                  type="button"
                  onClick={() => setShowDetails(v => !v)}
                  aria-expanded={showDetails}
                  className="w-full min-h-[44px] flex items-center justify-center gap-1 text-[13px] font-semibold text-surface-600 dark:text-surface-300 hover:text-surface-800 dark:hover:text-surface-100 transition-colors"
                >
                  {showDetails ? t('h.vaccines.hideDetails') : t('h.vaccines.moreDetails')}
                  <ChevronDown className={cn('w-4 h-4 transition-transform', showDetails && 'rotate-180')} aria-hidden />
                </button>

                {showDetails && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="vf-vet" className={vaccineLabelCls}>{t('h.form.vet')}</label>
                        <input id="vf-vet" type="text" value={form.veterinarian} onChange={set('veterinarian')} placeholder={t('h.form.vetPh')} className={vaccineInputCls} />
                      </div>
                      <div>
                        <label htmlFor="vf-lot" className={vaccineLabelCls}>{t('h.vaccines.fLot')}</label>
                        <input id="vf-lot" type="text" value={form.lot_number} onChange={set('lot_number')} placeholder={t('h.vaccines.fLotPh')} className={vaccineInputCls} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="vf-notes" className={vaccineLabelCls}>{t('h.form.notes')}</label>
                      <textarea id="vf-notes" value={form.notes} onChange={set('notes')} rows={2} className={cn(vaccineInputCls, 'resize-none')} />
                    </div>
                    <div>
                      <label htmlFor="vf-doc" className={vaccineLabelCls}>{t('h.vaccines.fDoc')}</label>
                      <input
                        id="vf-doc"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                        className="w-full text-sm text-surface-600 dark:text-surface-300 file:mr-3 file:min-h-[44px] file:px-4 file:rounded-xl file:border-0 file:bg-primary-50 file:text-primary-800 dark:file:bg-primary-500/15 dark:file:text-primary-200 file:font-semibold"
                      />
                    </div>
                  </div>
                )}
              </form>
            )}
          </>
        )}
      </Sheet>
    </>
  )
}

/** useSearchParams exige Suspense no App Router (prerender bailout). */
export default function VaccinesPage() {
  return (
    <Suspense fallback={<VaccinesSkeleton />}>
      <VaccinesPageInner />
    </Suspense>
  )
}
