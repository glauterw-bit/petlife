'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, AlertTriangle, X, Dog, Cat } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { pets as petsApi, breeds as breedsApi, type Pet, type Breed } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { cn, getSpeciesLabel } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { parseWeightKg } from '@/lib/weight'
import { Button } from '@/components/ui/Button'
import { hapticSuccess, hapticWarning, hapticError } from '@/lib/feedback'
import { invalidate } from '@/lib/cache'
import { useShell } from '@/components/layout/shell'

type Species = 'dog' | 'cat'
type BreedPick = { id: number; name: string; species: Species }

interface Props {
  pet: Pet
  open: boolean
  onClose: () => void
  onSaved: (pet: Pet) => void
}

const inputCls = 'w-full px-4 min-h-[44px] py-2.5 border border-surface-200 dark:border-surface-600 rounded-xl text-[15px] text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-surface-900'
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
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => { if (!open) setConfirmDelete(false) }, [open])
  const { success, error } = useToast()
  const shell = useShell()
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
    const weight = form.weight.trim() ? parseWeightKg(form.weight) : null
    if (form.weight.trim() && weight === null) { error(t('pw.editPet.errWeight')); return }
    setSaving(true)
    try {
      // Reenviar a raça intacta de um pet com espécie divergente fazia o servidor recusar (400) qualquer edição.
      const breedChanged = (breed?.id ?? null) !== (pet.breed?.id ?? null)
      const updated = await petsApi.update(pet.id, {
        name: form.name.trim(),
        species: form.species,
        ...(breedChanged ? { breed_id: breed ? breed.id : null } : {}),
        gender: form.gender || null,
        neutered: form.neutered,
        birth_date: form.birth_date || null,
        weight,
        color: form.color.trim() || null,
        microchip: form.microchip.trim() || null,
        bio: form.bio.trim() || null,
      })
      void hapticSuccess()
      success(t('pw.editPet.saved'))
      onSaved(updated)
      onClose()
    } catch (e: unknown) {
      void hapticError()
      error(e instanceof Error ? e.message : t('pw.editPet.errSave'))
    } finally { setSaving(false) }
  }

  async function removePet() {
    if (deleting) return
    setDeleting(true)
    try {
      await petsApi.delete(pet.id)
      invalidate('pets')
      void shell?.refreshPets()
      success(t('pw.editPet.deleted', { name: pet.name }))
      onClose()
      router.push('/pets')
    } catch (e: unknown) {
      void hapticError()
      error(e instanceof Error ? e.message : t('pw.editPet.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('pw.editPet.title', { name: pet.name })} size="lg">
      <div className="space-y-4">
        <div>
          <label htmlFor="ep-name" className={labelCls}>{t('pw.editPet.name')} *</label>
          <input id="ep-name" type="text" value={form.name} maxLength={100}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
        </div>

        <div>
          <span className={labelCls}>{t('pw.editPet.species')}</span>
          <div className="grid grid-cols-2 gap-2">
            {(['dog', 'cat'] as Species[]).map(s => (
              <button key={s} type="button" aria-pressed={form.species === s} onClick={() => pickSpecies(s)}
                className={cn(
                  'pressable flex items-center justify-center gap-2 min-h-[48px] rounded-xl border text-sm font-semibold transition',
                  form.species === s
                    ? 'bg-primary-50 dark:bg-primary-500/15 border-primary-500 text-primary-800 dark:text-primary-200'
                    : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300'
                )}>
                {s === 'dog' ? <Dog className="w-5 h-5" aria-hidden /> : <Cat className="w-5 h-5" aria-hidden />} {t(s === 'dog' ? 'pet.dog' : 'pet.cat')}
              </button>
            ))}
          </div>
          {speciesChanged && (
            <div className="mt-2 flex gap-2 text-xs text-amber-800 dark:text-amber-200 border tone-warning-bg rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <div className="space-y-1">
                <p>{t('pw.editPet.speciesChanged', { species: getSpeciesLabel(form.species) })}</p>
                {removedBreed && <p>{t('pw.editPet.breedRemoved', { breed: removedBreed })}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <label htmlFor="ep-breed" className={labelCls}>{t('pet.breed')}</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 dark:text-surface-400 pointer-events-none" aria-hidden />
            <input id="ep-breed" type="text" value={breedQuery} placeholder={t('pw.editPet.breedPh')}
              onChange={e => { setBreedQuery(e.target.value); if (breed && e.target.value !== breed.name) setBreed(null) }}
              className={`${inputCls} pl-9 pr-10`} />
            {searching
              ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 animate-spin" />
              : breedQuery && (
                <button type="button" onClick={() => { setBreed(null); setBreedQuery('') }} aria-label={t('pw.editPet.clearBreed')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200">
                  <X className="w-4 h-4" aria-hidden />
                </button>
              )}
          </div>
          {options.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-float overflow-hidden">
              {options.map(b => (
                <button key={b.id} type="button"
                  onClick={() => { setBreed({ id: b.id, name: b.name, species: b.species }); setBreedQuery(b.name); setOptions([]) }}
                  className="w-full px-4 min-h-[44px] text-left text-[15px] hover:bg-primary-50 dark:hover:bg-surface-800 flex items-center gap-2 transition">
                  {b.species === 'dog' ? <Dog className="w-4 h-4 text-surface-500" aria-hidden /> : <Cat className="w-4 h-4 text-surface-500" aria-hidden />}
                  <span className="font-medium text-surface-900 dark:text-white">{b.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ep-gender" className={labelCls}>{t('pet.gender')}</label>
            <select id="ep-gender" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value as '' | 'male' | 'female' }))} className={inputCls}>
              <option value="">{t('pw.editPet.genderUnset')}</option>
              <option value="female">{t('pet.female')}</option>
              <option value="male">{t('pet.male')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="ep-birth" className={labelCls}>{t('pw.editPet.birth')}</label>
            <input id="ep-birth" type="date" value={form.birth_date} max={new Date().toISOString().split('T')[0]}
              onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ep-weight" className={labelCls}>{t('pw.editPet.weight')}</label>
            <input id="ep-weight" type="text" inputMode="decimal" value={form.weight}
              onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ep-color" className={labelCls}>{t('pw.editPet.color')}</label>
            <input id="ep-color" type="text" value={form.color} maxLength={100}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <label className="flex items-center gap-3 min-h-[44px] text-[15px] text-surface-800 dark:text-surface-200 cursor-pointer">
          <input type="checkbox" checked={form.neutered} onChange={e => setForm(f => ({ ...f, neutered: e.target.checked }))}
            className="w-5 h-5 rounded border-surface-300 text-primary-500 focus:ring-primary-500" />
          {t('pet.neutered')}
        </label>

        <div>
          <label htmlFor="ep-chip" className={labelCls}>{t('pw.editPet.microchip')}</label>
          <input id="ep-chip" type="text" value={form.microchip} maxLength={50}
            onChange={e => setForm(f => ({ ...f, microchip: e.target.value }))} className={inputCls} />
        </div>

        <div>
          <label htmlFor="ep-bio" className={labelCls}>{t('pw.editPet.bio')}</label>
          <textarea id="ep-bio" rows={3} value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('common.save')}</Button>
        </div>

        {/* Excluir o pet (ex.: cadastro duplicado) — pede confirmação */}
        <div className="pt-3 border-t border-surface-100 dark:border-surface-800">
          {!confirmDelete ? (
            <button type="button" onClick={() => { void hapticWarning(); setConfirmDelete(true) }} className="min-h-[44px] text-sm font-semibold text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200">
              {t('pw.editPet.delete', { name: pet.name })}
            </button>
          ) : (
            <div className="rounded-xl border tone-danger-bg p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{t('pw.editPet.deleteConfirm', { name: pet.name })}</p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
                <Button variant="danger" loading={deleting} onClick={removePet}>{t('pw.editPet.deleteYes')}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
