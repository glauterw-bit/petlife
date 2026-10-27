'use client'

import { requestSoftUpsell } from '@/lib/softUpsell'

import { useState, useEffect, useRef, FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { Camera, Search, ChevronDown, AlertCircle, PawPrint, Sparkles, Dog, Cat, Keyboard } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { pets as petsApi, breeds as breedsApi, type Breed, type Pet } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { celebratePets, hapticError, hapticSuccess, hapticSelect } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { VyronAvatar } from '@/components/ai/VyronAvatar'
import { dogHumanAge } from '@/lib/care'
import { Sheet } from '@/components/ui/Sheet'
import { invalidate } from '@/lib/cache'
import { useShell } from '@/components/layout/shell'
import { variants, dur, easeOut, spring } from '@/lib/motion'
import { formatDate, cn } from '@/lib/utils'

interface BreedCandidate {
  breed: string
  name_en?: string
  confidence: number
  reasoning?: string
  breed_id: number | null
}

type Species = 'dog' | 'cat' | 'other'
type Sex = 'unknown' | 'male' | 'female'

const INPUT =
  'w-full px-4 min-h-[48px] py-3 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl text-[15px] text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500'
const LABEL = 'block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5'

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Data aproximada a partir de anos + meses (dia 1 do mês resultante). */
function approxBirthDate(years: number, months: number): string | null {
  const total = Math.max(0, Math.floor(years) * 12 + Math.floor(months))
  if (total <= 0) return null
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - total)
  return isoDate(d)
}

export default function NewPetPage() {
  const t = useT()
  const router = useRouter()
  const shell = useShell()
  const { error } = useToast()

  const [form, setForm] = useState({
    name: '',
    species: 'dog' as Species,
    breed_id: undefined as number | undefined,
    birth_date: '',
    weight: '',
    color: '',
    gender: 'unknown' as Sex,
    neutered: false,
    microchip: '',
    bio: '',
  })
  const [moreOpen, setMoreOpen] = useState(false)
  const [unknownBirth, setUnknownBirth] = useState(false)
  const [ageYears, setAgeYears] = useState('')
  const [ageMonths, setAgeMonths] = useState('')

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Raça pela foto (IA Vision)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [identifyFile, setIdentifyFile] = useState<File | null>(null)
  const [identifyPreview, setIdentifyPreview] = useState<string | null>(null)
  const [identifyLoading, setIdentifyLoading] = useState(false)
  const [identifyResult, setIdentifyResult] = useState<{ candidates: BreedCandidate[]; notes: string; is_mixed_likely: boolean } | null>(null)
  const [identifyError, setIdentifyError] = useState<string | null>(null)
  const [breedSearch, setBreedSearch] = useState('')
  const [breedOptions, setBreedOptions] = useState<Breed[]>([])
  const [selectedBreed, setSelectedBreed] = useState<Breed | null>(null)
  const [breedOpen, setBreedOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingBreeds, setLoadingBreeds] = useState(false)
  const [created, setCreated] = useState<Pet | null>(null)
  const breedRef = useRef<HTMLDivElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (breedRef.current && !breedRef.current.contains(e.target as Node)) setBreedOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (breedSearch.length < 2 || selectedBreed?.name === breedSearch) { setBreedOptions([]); return }
    const timer = setTimeout(async () => {
      setLoadingBreeds(true)
      try {
        const results = await breedsApi.search(breedSearch, form.species !== 'other' ? form.species : undefined)
        setBreedOptions(results.slice(0, 8))
        setBreedOpen(true)
      } catch {
        /* busca é opcional */
      } finally {
        setLoadingBreeds(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [breedSearch, form.species, selectedBreed])

  const approx = unknownBirth ? approxBirthDate(Number(ageYears) || 0, Number(ageMonths) || 0) : null

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function setSpecies(s: Species) {
    setSelectedBreed(null)
    setBreedSearch('')
    setForm(f => ({ ...f, species: s, breed_id: undefined }))
  }

  function selectBreed(b: Breed) {
    setSelectedBreed(b)
    // candidato da identificação por foto pode ser de outra espécie que a marcada
    setForm(f => ({ ...f, breed_id: b.id, species: b.species === 'dog' || b.species === 'cat' ? b.species : f.species }))
    setBreedSearch(b.name)
    setBreedOpen(false)
  }

  function pickIdentifyFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIdentifyFile(file)
    setIdentifyPreview(URL.createObjectURL(file))
    setIdentifyResult(null)
    setIdentifyError(null)
  }

  async function runIdentify() {
    if (!identifyFile) return
    setIdentifyLoading(true)
    setIdentifyError(null)
    try {
      setIdentifyResult(await breedsApi.identifyFromPhoto(identifyFile))
    } catch (e: unknown) {
      setIdentifyError(e instanceof Error ? e.message : t('pw.newPet.identifyError'))
    } finally {
      setIdentifyLoading(false)
    }
  }

  async function pickCandidate(c: BreedCandidate) {
    if (c.breed_id) {
      try {
        selectBreed(await breedsApi.getById(c.breed_id))
      } catch {
        setBreedSearch(c.breed)
        setForm(f => ({ ...f, breed_id: c.breed_id ?? undefined }))
      }
    } else {
      setBreedSearch(c.breed)
    }
    // reaproveita a foto da identificação como foto do pet
    if (identifyFile && !photoFile) {
      setPhotoFile(identifyFile)
      setPhotoPreview(identifyPreview)
    }
    closeIdentify()
  }

  function closeIdentify() {
    setIdentifyOpen(false)
    setIdentifyFile(null)
    setIdentifyPreview(null)
    setIdentifyResult(null)
    setIdentifyError(null)
    setIdentifyLoading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { void hapticError(); error(t('pw.newPet.nameRequired')); return }
    setLoading(true)
    try {
      const birth = unknownBirth ? approx : form.birth_date || null
      const pet = await petsApi.create({
        name: form.name.trim(),
        species: form.species,
        breed_id: form.breed_id,
        birth_date: birth || undefined,
        weight: form.weight ? parseFloat(form.weight.replace(',', '.')) : undefined,
        color: form.color || undefined,
        gender: form.gender === 'unknown' ? undefined : form.gender,
        neutered: form.neutered,
        microchip: form.microchip || undefined,
        bio: form.bio || undefined,
      })
      let withPhoto = pet
      if (photoFile) {
        const r = await petsApi.uploadPhoto(pet.id, photoFile).catch(() => null)
        if (r) withPhoto = { ...pet, photo_url: r.photo_url }
      }
      invalidate('pets')
      void shell?.refreshPets()
      petsApi
        .list()
        .then(l => {
          if (l.length >= 3) requestSoftUpsell('pet3')
          // confete só no 1º pet: é um marco real
          if (l.length === 1) celebratePets()
        })
        .catch(() => {})
      void hapticSuccess()
      setCreated(withPhoto)
      window.scrollTo({ top: 0 })
    } catch (err: unknown) {
      void hapticError()
      error(err instanceof Error ? err.message : t('pw.newPet.createError'))
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  // ── Tela de sucesso: o próximo passo é a carteirinha ────────────────
  if (created) {
    const female = created.gender === 'female'
    // Wang et al. 2020 — só cães com 1 ano ou mais (null nos outros casos)
    const humanAge = dogHumanAge(created)
    return (
      <DashboardLayout>
        <m.div
          variants={variants.scaleIn}
          initial="hidden"
          animate="show"
          transition={spring.soft}
          className="max-w-md mx-auto min-h-[70dvh] flex flex-col items-center justify-center text-center pt-6"
        >
          <VyronAvatar size={96} state="celebrating" />
          <h1 className="mt-5 text-[28px] leading-tight font-display font-extrabold tracking-tight text-surface-900 dark:text-white">
            {t(female ? 'petx.new.doneF' : 'petx.new.doneM', { name: created.name })}
          </h1>
          <p className="mt-1 text-[17px] text-surface-600 dark:text-surface-400">{t(female ? 'petx.new.doneSubF' : 'petx.new.doneSubM')}</p>
          {humanAge != null && (
            <div className="mt-5 w-full rounded-2xl border border-surface-200/70 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-3 text-left">
              <p className="font-semibold text-[15px] text-surface-900 dark:text-white">
                {t('pet3.age.newDone', { name: created.name, n: humanAge })}
              </p>
              <p className="mt-0.5 text-[13px] text-surface-600 dark:text-surface-300">{t('pet3.age.short')}</p>
            </div>
          )}

          <div className="w-full mt-8 space-y-3">
            <Button
              fullWidth
              size="lg"
              leftIcon={Camera}
              href={`/health/vaccines?novo=1&pet=${created.id}&scan=1`}
            >
              {t('petx.new.scan')}
            </Button>
            <p className="text-[13px] text-surface-600 dark:text-surface-400">{t('petx.new.scanHint')}</p>
            <Button fullWidth variant="secondary" leftIcon={Keyboard} href={`/health/vaccines?novo=1&pet=${created.id}&add=1`}>
              {t('petx.new.type')}
            </Button>
          </div>
          <Link
            href={`/pets/${created.id}`}
            className="mt-4 inline-flex items-center min-h-[44px] px-4 text-[15px] font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white"
          >
            {t('petx.new.later')}
          </Link>
        </m.div>
      </DashboardLayout>
    )
  }

  const SpeciesIcon = form.species === 'dog' ? Dog : form.species === 'cat' ? Cat : PawPrint
  const submitLabel = form.name.trim() ? t('petx.new.submit', { name: form.name.trim() }) : t('petx.new.submitEmpty')

  return (
    <DashboardLayout>
      <PageHeader title={t('petx.new.title')} back showBell={false} />

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-5" noValidate>
        {/* Vyron apresenta o formulário (vira "comemorando" ao salvar) */}
        <div className="flex items-end gap-3">
          <VyronAvatar size={56} state={loading ? 'celebrating' : 'idle'} className="shrink-0" />
          <p className="relative flex-1 rounded-2xl rounded-bl-md bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 px-4 py-2.5 text-[14px] leading-snug text-surface-700 dark:text-surface-200">
            {t('petx.new.subtitle')}
          </p>
        </div>

        {/* Foto (opcional) */}
        <div className="flex flex-col items-center">
          <div className="relative">
            {/* Um só ponto de foco: o botão. O input fica fora da ordem do Tab. */}
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              aria-label={photoPreview ? t('petx.new.photoChange') : t('petx.new.photoAdd')}
              className="pressable relative w-28 h-28 rounded-full overflow-hidden flex items-center justify-center bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border-2 border-dashed border-primary-300 dark:border-primary-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-950"
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <SpeciesIcon className="w-11 h-11" aria-hidden strokeWidth={1.7} />
              )}
            </button>
            <input id="pet-photo" ref={photoInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={handlePhoto} />
            <span aria-hidden className="pointer-events-none absolute -bottom-0.5 -right-0.5 w-9 h-9 rounded-full bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950 flex items-center justify-center ring-4 ring-surface-50 dark:ring-surface-950">
              <Camera className="w-4 h-4" />
            </span>
          </div>
          {/* o rótulo visível também abre a escolha da foto */}
          <label htmlFor="pet-photo" className="mt-1 inline-flex items-center min-h-[44px] px-2 cursor-pointer text-[13px] font-medium text-surface-600 dark:text-surface-400">
            {t('petx.new.photoOptional')}
          </label>
        </div>

        {/* Nome */}
        <div>
          <label htmlFor="pet-name" className={LABEL}>
            {t('pet.name')} <span className="text-surface-500 dark:text-surface-400 font-normal">({t('petx.new.required')})</span>
          </label>
          <input
            id="pet-name"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={60}
            value={form.name}
            onChange={set('name')}
            placeholder={t('pw.newPet.namePlaceholder')}
            className={cn(INPUT, 'text-[17px]')}
          />
        </div>

        {/* Espécie */}
        <div>
          <span id="species-label" className={LABEL}>
            {t('pet.species')} <span className="text-surface-500 dark:text-surface-400 font-normal">({t('petx.new.required')})</span>
          </span>
          <SpeciesRadio
            labelledBy="species-label"
            value={form.species}
            onChange={setSpecies}
            options={[
              { value: 'dog', label: t('pet.dog'), icon: Dog },
              { value: 'cat', label: t('pet.cat'), icon: Cat },
              { value: 'other', label: t('pw.newPet.speciesOther'), icon: PawPrint },
            ]}
          />
        </div>

        {/* Mais detalhes (opcional) */}
        <div className="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="more-details"
            onClick={() => setMoreOpen(o => !o)}
            className="pressable w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left rounded-2xl"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-surface-900 dark:text-white">{t('petx.new.more')}</span>
              <span className="block text-[13px] text-surface-600 dark:text-surface-400 truncate">{t('petx.new.moreHint')}</span>
            </span>
            <ChevronDown className={cn('w-5 h-5 text-surface-500 transition-transform duration-200', moreOpen && 'rotate-180')} aria-hidden />
          </button>
          <AnimatePresence initial={false}>
            {moreOpen && (
              <m.div
                id="more-details"
                key="more"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: dur.base, ease: easeOut }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Raça */}
                  {form.species !== 'other' && (
                    <div className="relative sm:col-span-2" ref={breedRef}>
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <label htmlFor="pet-breed" className="block text-sm font-medium text-surface-700 dark:text-surface-200">{t('pet.breed')}</label>
                        <button
                          type="button"
                          onClick={() => setIdentifyOpen(true)}
                          className="pressable inline-flex items-center gap-1.5 min-h-[36px] text-[13px] text-primary-800 bg-primary-50 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-200 dark:hover:bg-primary-500/25 px-3 rounded-full font-semibold transition relative before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
                        >
                          <Sparkles className="w-3.5 h-3.5" aria-hidden />
                          {t('pw.newPet.identifyCta')}
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 dark:text-surface-400 pointer-events-none" aria-hidden />
                        <input
                          id="pet-breed"
                          type="text"
                          role="combobox"
                          aria-expanded={breedOpen && breedOptions.length > 0}
                          aria-controls="breed-options"
                          autoComplete="off"
                          value={breedSearch}
                          onChange={e => {
                            setBreedSearch(e.target.value)
                            if (selectedBreed && e.target.value !== selectedBreed.name) {
                              setSelectedBreed(null)
                              setForm(f => ({ ...f, breed_id: undefined }))
                            }
                          }}
                          placeholder={t('pw.newPet.breedSearchPlaceholder')}
                          className={cn(INPUT, 'pl-10 pr-10')}
                        />
                        {loadingBreeds ? (
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-300 border-t-primary-700 rounded-full animate-spin" aria-hidden />
                        ) : (
                          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 dark:text-surface-400 pointer-events-none" aria-hidden />
                        )}
                      </div>
                      {breedOpen && breedOptions.length > 0 && (
                        <ul id="breed-options" role="listbox" className="absolute z-20 left-0 right-0 top-full mt-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-float overflow-hidden">
                          {breedOptions.map(b => (
                            <li key={b.id} role="option" aria-selected={selectedBreed?.id === b.id}>
                              <button
                                type="button"
                                onClick={() => selectBreed(b)}
                                className="w-full px-4 min-h-[44px] text-left text-[15px] hover:bg-primary-50 dark:hover:bg-primary-500/10 flex items-center gap-2 transition"
                              >
                                {b.species === 'dog' ? <Dog className="w-4 h-4 text-surface-500" aria-hidden /> : <Cat className="w-4 h-4 text-surface-500" aria-hidden />}
                                <span className="font-medium text-surface-900 dark:text-white">{b.name}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Nascimento ou idade aproximada */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <label htmlFor={unknownBirth ? 'pet-age-years' : 'pet-birth'} className="block text-sm font-medium text-surface-700 dark:text-surface-200">
                        {unknownBirth ? t('petx.new.approxAge') : t('pet.birth')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setUnknownBirth(u => !u)}
                        className="min-h-[36px] px-2 text-[13px] font-semibold text-primary-700 dark:text-primary-300 relative before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
                      >
                        {unknownBirth ? t('petx.new.knownBirth') : t('petx.new.unknownBirth')}
                      </button>
                    </div>
                    {unknownBirth ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="pet-age-years" className="sr-only">{t('petx.new.ageYears')}</label>
                            <div className="relative">
                              <input id="pet-age-years" type="number" inputMode="numeric" min={0} max={30} value={ageYears} onChange={e => setAgeYears(e.target.value)} className={cn(INPUT, 'pr-16')} />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-surface-500 dark:text-surface-400 pointer-events-none">{t('petx.new.ageYears')}</span>
                            </div>
                          </div>
                          <div>
                            <label htmlFor="pet-age-months" className="sr-only">{t('petx.new.ageMonths')}</label>
                            <div className="relative">
                              <input id="pet-age-months" type="number" inputMode="numeric" min={0} max={11} value={ageMonths} onChange={e => setAgeMonths(e.target.value)} className={cn(INPUT, 'pr-16')} />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-surface-500 dark:text-surface-400 pointer-events-none">{t('petx.new.ageMonths')}</span>
                            </div>
                          </div>
                        </div>
                        {approx && (
                          <p className="mt-1.5 text-[13px] text-surface-600 dark:text-surface-400" aria-live="polite">
                            {t('petx.new.approxNote', { date: formatDate(approx, 'MM/yyyy') })}
                          </p>
                        )}
                      </>
                    ) : (
                      <input id="pet-birth" type="date" value={form.birth_date} onChange={set('birth_date')} max={isoDate(new Date())} className={INPUT} />
                    )}
                  </div>

                  <div>
                    <label htmlFor="pet-weight" className={LABEL}>{t('pet.weight')}</label>
                    <input id="pet-weight" type="text" inputMode="decimal" value={form.weight} onChange={set('weight')} placeholder={t('pw.newPet.weightPlaceholder')} className={INPUT} />
                  </div>
                  <div>
                    <label htmlFor="pet-color" className={LABEL}>{t('pet.color')}</label>
                    <input id="pet-color" type="text" value={form.color} onChange={set('color')} placeholder={t('pw.newPet.colorPlaceholder')} className={INPUT} />
                  </div>

                  <div className="sm:col-span-2">
                    <span className={LABEL}>{t('pet.gender')}</span>
                    <SegmentedControl<Sex>
                      ariaLabel={t('pet.gender')}
                      value={form.gender}
                      onChange={g => setForm(f => ({ ...f, gender: g }))}
                      options={[
                        { value: 'unknown', label: t('petx.new.sexUnknown') },
                        { value: 'male', label: t('pet.male') },
                        { value: 'female', label: t('pet.female') },
                      ]}
                    />
                  </div>

                  <label htmlFor="neutered" className="sm:col-span-2 flex items-center gap-3 min-h-[44px] cursor-pointer">
                    <input
                      type="checkbox"
                      id="neutered"
                      checked={form.neutered}
                      onChange={e => setForm(f => ({ ...f, neutered: e.target.checked }))}
                      className="w-5 h-5 rounded accent-primary-600"
                    />
                    <span className="text-[15px] text-surface-800 dark:text-surface-200">{t('pw.newPet.neuteredLabel')}</span>
                  </label>

                  <div className="sm:col-span-2">
                    <label htmlFor="pet-microchip" className={LABEL}>{t('pet.microchip')}</label>
                    <input id="pet-microchip" type="text" inputMode="numeric" value={form.microchip} onChange={set('microchip')} placeholder={t('pw.newPet.microchipPlaceholder')} className={INPUT} />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="pet-bio" className={LABEL}>{t('pet.bio')}</label>
                    <textarea id="pet-bio" value={form.bio} onChange={set('bio')} rows={3} placeholder={t('pw.newPet.bioPlaceholder')} className={cn(INPUT, 'resize-none')} />
                  </div>

                  {selectedBreed && (
                    <div className="sm:col-span-2 rounded-2xl border tone-brand-bg p-4">
                      <h3 className="font-semibold text-primary-900 dark:text-primary-200 mb-2 flex items-center gap-2">
                        <PawPrint className="w-4 h-4" aria-hidden />
                        {t('pw.newPet.breedInfo', { name: selectedBreed.name })}
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-sm text-primary-900 dark:text-primary-200">
                        {selectedBreed.energy_level && <div><span className="font-medium">{t('pw.breed.energy')}:</span> {selectedBreed.energy_level}/5</div>}
                        {selectedBreed.life_expectancy_min && (
                          <div><span className="font-medium">{t('pw.breed.lifeExpectancy')}:</span> {selectedBreed.life_expectancy_min}–{selectedBreed.life_expectancy_max} {t('pw.breed.years')}</div>
                        )}
                        {selectedBreed.weight_min && (
                          <div><span className="font-medium">{t('pw.breed.avgWeight')}:</span> {selectedBreed.weight_min}–{selectedBreed.weight_max} kg</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <Button type="submit" fullWidth size="lg" loading={loading} leftIcon={PawPrint}>
          {loading ? t('pet.submitting') : submitLabel}
        </Button>
      </form>

      {/* Identificar raça por foto */}
      <Sheet open={identifyOpen} onClose={closeIdentify} title={t('pw.newPet.identifyTitle')} description={t('pw.newPet.identifyIntro')}>
        <div className="space-y-4 pb-1">
          {!identifyPreview ? (
            <label className="block cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pickIdentifyFile} />
              <div className="border-2 border-dashed border-primary-300 dark:border-primary-500/40 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-2xl p-8 text-center transition">
                <Camera className="w-10 h-10 mx-auto text-primary-700 dark:text-primary-300 mb-2" aria-hidden />
                <p className="text-[15px] font-semibold text-surface-900 dark:text-surface-100">{t('pw.newPet.takeOrChoose')}</p>
                <p className="text-[13px] text-surface-600 dark:text-surface-400 mt-1">{t('pw.newPet.identifyHint')}</p>
              </div>
            </label>
          ) : (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={identifyPreview} alt={t('pw.newPet.petAlt')} className="w-full rounded-2xl object-cover max-h-64 border border-surface-200 dark:border-surface-700" />
              <div className="grid grid-cols-2 gap-2">
                <label className="pressable cursor-pointer inline-flex items-center justify-center min-h-[44px] text-sm font-semibold text-surface-800 dark:text-surface-200 bg-surface-100 dark:bg-surface-800 rounded-xl">
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pickIdentifyFile} />
                  {t('pw.newPet.changePhoto')}
                </label>
                <Button leftIcon={Sparkles} loading={identifyLoading} disabled={!!identifyResult} onClick={runIdentify}>
                  {identifyResult ? t('pw.newPet.analyzed') : t('pw.newPet.identify')}
                </Button>
              </div>
            </div>
          )}

          {identifyError && (
            <div role="alert" className="flex items-center gap-2 border tone-danger-bg text-red-800 dark:text-red-200 rounded-xl p-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
              {identifyError}
            </div>
          )}

          {identifyResult && identifyResult.candidates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-400">
                {t('pw.newPet.candidates')}{' '}
                {identifyResult.is_mixed_likely && <span className="ml-1 text-amber-800 dark:text-amber-300 normal-case">{t('pw.newPet.mixedLikely')}</span>}
              </p>
              {identifyResult.candidates.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickCandidate(c)}
                  className="pressable w-full text-left bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 hover:border-primary-300 rounded-xl p-3 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-surface-900 dark:text-white">{c.breed}</span>
                    <span className="chip chip-success">{Math.round((c.confidence ?? 0) * 100)}%</span>
                  </div>
                  {c.reasoning && <p className="text-[13px] text-surface-600 dark:text-surface-400 mt-1">{c.reasoning}</p>}
                  {!c.breed_id && <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">{t('pw.newPet.notInCatalog')}</p>}
                </button>
              ))}
              {identifyResult.notes && <p className="text-[13px] text-surface-600 dark:text-surface-400 italic mt-2">{identifyResult.notes}</p>}
            </div>
          )}

          {identifyResult && identifyResult.candidates.length === 0 && (
            <div className="border tone-warning-bg text-amber-900 dark:text-amber-200 rounded-xl p-3 text-sm">
              {t('pw.newPet.noBreedFound')} {identifyResult.notes}
            </div>
          )}
        </div>
      </Sheet>
    </DashboardLayout>
  )
}

/**
 * Espécie como radiogroup de verdade (padrão WAI-ARIA): um só ponto de Tab
 * (o selecionado), setas mudam e selecionam, Home/End vão às pontas.
 */
function SpeciesRadio({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: { value: Species; label: string; icon: typeof Dog }[]
  value: Species
  onChange: (v: Species) => void
  labelledBy: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function select(i: number) {
    const o = options[(i + options.length) % options.length]
    refs.current[(i + options.length) % options.length]?.focus()
    if (o.value !== value) {
      void hapticSelect()
      onChange(o.value)
    }
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        return select(i + 1)
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        return select(i - 1)
      case 'Home':
        e.preventDefault()
        return select(0)
      case 'End':
        e.preventDefault()
        return select(options.length - 1)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-required="true"
      className="grid grid-cols-3 gap-2"
    >
      {options.map((o, i) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            ref={el => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => select(i)}
            onKeyDown={e => onKey(e, i)}
            className={cn(
              'pressable flex flex-col items-center justify-center gap-1 min-h-[72px] rounded-2xl border-2 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-950',
              active
                ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-500/15 dark:text-primary-100'
                : 'border-surface-200 bg-white text-surface-700 hover:border-surface-300 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200',
            )}
          >
            <Icon className="w-6 h-6" aria-hidden strokeWidth={active ? 2.2 : 1.8} />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
