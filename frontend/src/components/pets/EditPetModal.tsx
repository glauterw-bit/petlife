'use client'

import { useEffect, useState } from 'react'
import { Search, Loader2, AlertTriangle, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { pets as petsApi, breeds as breedsApi, type Pet, type Breed } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { cn, getSpeciesLabel } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

type Species = 'dog' | 'cat'
type BreedPick = { id: number; name: string; species: Species }

interface Props {
  pet: Pet
  open: boolean
  onClose: () => void
  onSaved: (pet: Pet) => void
}

const inputCls = 'w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-800'
const labelCls = 'block text-sm font-medium text-surface-700 dark:text-surface-200 mb-1.5'

function formFromPet(pet: Pet) {
  return {
    name: pet.name ?? '',
    species: (pet.species === 'cat' ? 'cat' : 'dog') as Species,
    gender: (pet.gender ?? '') as '' | 'male' | 'female',
    neutered: !!pet.neutered,
    birth_date: pet.birth_date ? pet.birth_date.slice(0, 10) : '',
    weight: pet.weight != null ? String(pet.weight) : '',
    color: pet.color ?? '',
    microchip: pet.microchip ?? '',
    bio: pet.bio ?? '',
  }
}

export function EditPetModal({ pet, open, onClose, onSaved }: Props) {
  const t = useT()
  const { success, error } = useToast()
  const [form, setForm] = useState(() => formFromPet(pet))
  const [breed, setBreed] = useState<BreedPick | null>(null)
  const [breedQuery, setBreedQuery] = useState('')
  const [options, setOptions] = useState<Breed[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reabre sempre com os dados atuais do pet.
  useEffect(() => {
    if (!open) return
    setForm(formFromPet(pet))
    setBreed(pet.breed ? { id: pet.breed.id, name: pet.breed.name, species: pet.breed.species } : null)
    setBreedQuery(pet.breed?.name ?? '')
    setOptions([])
  }, [open, pet])

  useEffect(() => {
    const q = breedQuery.trim()
    if (!open || q.length < 2 || q === breed?.name) { setOptions([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try { setOptions((await breedsApi.search(q, form.species)).slice(0, 8)) }
      catch { setOptions([]) }
      finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [breedQuery, form.species, open, breed?.name])

  function pickSpecies(s: Species) {
    setForm(f => ({ ...f, species: s }))
    if (breed && breed.species !== s) { setBreed(null); setBreedQuery('') }
  }

  const speciesChanged = form.species !== pet.species
  const removedBreed = speciesChanged && pet.breed && pet.breed.species !== form.species ? pet.breed.name : null

  async function save() {
    if (!form.name.trim()) { error(t('pw.newPet.nameRequired')); return }
    const weight = form.weight.trim() ? parseFloat(form.weight.replace(',', '.')) : null
    if (weight !== null && (isNaN(weight) || weight <= 0)) { error(t('pw.editPet.errWeight')); return }
    setSaving(true)
    try {
      const updated = await petsApi.update(pet.id, {
        name: form.name.trim(),
        species: form.species,
        breed_id: breed ? breed.id : null,
        gender: form.gender || null,
        neutered: form.neutered,
        birth_date: form.birth_date || null,
        weight,
        color: form.color.trim() || null,
        microchip: form.microchip.trim() || null,
        bio: form.bio.trim() || null,
      })
      success(t('pw.editPet.saved'))
      onSaved(updated)
      onClose()
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : t('pw.editPet.errSave'))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('pw.editPet.title', { name: pet.name })} size="lg">
      <div className="space-y-4">
        <div>
          <label className={labelCls}>{t('pw.editPet.name')} *</label>
          <input type="text" value={form.name} maxLength={100}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>{t('pw.editPet.species')}</label>
          <div className="grid grid-cols-2 gap-2">
            {(['dog', 'cat'] as Species[]).map(s => (
              <button key={s} type="button" onClick={() => pickSpecies(s)}
                className={cn(
                  'pressable flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition',
                  form.species === s
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-400 text-primary-700 dark:text-primary-300'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300'
                )}>
                <span className="text-xl" aria-hidden>{s === 'dog' ? '🐕' : '🐈'}</span> {t(s === 'dog' ? 'pet.dog' : 'pet.cat')}
              </button>
            ))}
          </div>
          {speciesChanged && (
            <div className="mt-2 flex gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <div className="space-y-1">
                <p>{t('pw.editPet.speciesChanged', { species: getSpeciesLabel(form.species) })}</p>
                {removedBreed && <p>{t('pw.editPet.breedRemoved', { breed: removedBreed })}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <label className={labelCls}>{t('pet.breed')}</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input type="text" value={breedQuery} placeholder={t('pw.editPet.breedPh')}
              onChange={e => { setBreedQuery(e.target.value); if (breed && e.target.value !== breed.name) setBreed(null) }}
              className={`${inputCls} pl-9 pr-10`} />
            {searching
              ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 animate-spin" />
              : breedQuery && (
                <button type="button" onClick={() => { setBreed(null); setBreedQuery('') }} aria-label={t('pw.editPet.clearBreed')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-surface-600">
                  <X className="w-4 h-4" />
                </button>
              )}
          </div>
          {options.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg overflow-hidden">
              {options.map(b => (
                <button key={b.id} type="button"
                  onClick={() => { setBreed({ id: b.id, name: b.name, species: b.species }); setBreedQuery(b.name); setOptions([]) }}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary-50 dark:hover:bg-surface-700 flex items-center gap-2 transition">
                  <span aria-hidden>{b.species === 'dog' ? '🐕' : '🐈'}</span>
                  <span className="font-medium text-surface-900 dark:text-white">{b.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('pet.gender')}</label>
            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value as '' | 'male' | 'female' }))} className={inputCls}>
              <option value="">{t('pw.editPet.genderUnset')}</option>
              <option value="female">♀ {t('pet.female')}</option>
              <option value="male">♂ {t('pet.male')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('pw.editPet.birth')}</label>
            <input type="date" value={form.birth_date} max={new Date().toISOString().split('T')[0]}
              onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('pw.editPet.weight')}</label>
            <input type="text" inputMode="decimal" value={form.weight}
              onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('pw.editPet.color')}</label>
            <input type="text" value={form.color} maxLength={100}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-200 cursor-pointer">
          <input type="checkbox" checked={form.neutered} onChange={e => setForm(f => ({ ...f, neutered: e.target.checked }))}
            className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500" />
          {t('pet.neutered')}
        </label>

        <div>
          <label className={labelCls}>{t('pw.editPet.microchip')}</label>
          <input type="text" value={form.microchip} maxLength={50}
            onChange={e => setForm(f => ({ ...f, microchip: e.target.value }))} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>{t('pw.editPet.bio')}</label>
          <textarea rows={3} value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className={inputCls} />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-semibold text-surface-700 dark:text-surface-200">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
