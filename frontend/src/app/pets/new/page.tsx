'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Camera, Search, ChevronDown, AlertCircle, PawPrint } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { pets as petsApi, breeds as breedsApi, type Breed } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'

export default function NewPetPage() {
  const router = useRouter()
  const { success, error } = useToast()

  const [form, setForm] = useState({
    name: '',
    species: 'dog' as 'dog' | 'cat' | 'other',
    breed_id: undefined as number | undefined,
    birth_date: '',
    weight: '',
    color: '',
    gender: '' as 'male' | 'female' | '',
    neutered: false,
    microchip: '',
    bio: '',
  })

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [breedSearch, setBreedSearch] = useState('')
  const [breedOptions, setBreedOptions] = useState<Breed[]>([])
  const [selectedBreed, setSelectedBreed] = useState<Breed | null>(null)
  const [breedOpen, setBreedOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingBreeds, setLoadingBreeds] = useState(false)
  const breedRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (breedRef.current && !breedRef.current.contains(e.target as Node)) {
        setBreedOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Search breeds
  useEffect(() => {
    if (breedSearch.length < 2) { setBreedOptions([]); return }
    const timer = setTimeout(async () => {
      setLoadingBreeds(true)
      try {
        const results = await breedsApi.search(breedSearch, form.species !== 'other' ? form.species : undefined)
        setBreedOptions(results.slice(0, 8))
        setBreedOpen(true)
      } catch {
        // ignore
      } finally {
        setLoadingBreeds(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [breedSearch, form.species])

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function selectBreed(b: Breed) {
    setSelectedBreed(b)
    setForm(f => ({ ...f, breed_id: b.id }))
    setBreedSearch(b.name)
    setBreedOpen(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { error('Informe o nome do pet.'); return }
    setLoading(true)
    try {
      const payload = {
        name: form.name,
        species: form.species,
        breed_id: form.breed_id,
        birth_date: form.birth_date || undefined,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        color: form.color || undefined,
        gender: form.gender || undefined,
        neutered: form.neutered,
        microchip: form.microchip || undefined,
        bio: form.bio || undefined,
      }
      const pet = await petsApi.create(payload)
      if (photoFile) {
        await petsApi.uploadPhoto(pet.id, photoFile).catch(() => {})
      }
      success(`${pet.name} foi cadastrado com sucesso! 🐾`)
      router.push(`/pets/${pet.id}`)
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Erro ao cadastrar pet.')
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-surface-900">Cadastrar Novo Pet</h1>
          <p className="text-surface-500 mt-1">Preencha as informações do seu companheiro</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo */}
          <div className="bg-white rounded-2xl border border-surface-100 p-6">
            <h2 className="text-base font-semibold text-surface-900 mb-4">Foto do Pet</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center overflow-hidden border-2 border-surface-200">
                  {photoPreview ? (
                    <Image src={photoPreview} alt="Preview" width={96} height={96} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-4xl">{form.species === 'dog' ? '🐕' : form.species === 'cat' ? '🐈' : '🐾'}</span>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 bg-primary-500 text-white rounded-xl p-1.5 cursor-pointer hover:bg-primary-600 transition">
                  <Camera className="w-4 h-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-surface-700">Foto do seu pet</p>
                <p className="text-xs text-surface-500 mt-0.5">PNG, JPG até 5MB</p>
                <label className="mt-2 inline-block cursor-pointer text-xs text-primary-600 hover:underline font-medium">
                  Escolher arquivo
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </label>
              </div>
            </div>
          </div>

          {/* Basic info */}
          <div className="bg-white rounded-2xl border border-surface-100 p-6">
            <h2 className="text-base font-semibold text-surface-900 mb-4">Informações Básicas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Nome do Pet *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Ex: Thor, Luna, Bob..."
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Espécie *</label>
                <select
                  value={form.species}
                  onChange={e => { set('species')(e); setSelectedBreed(null); setBreedSearch(''); setForm(f => ({ ...f, species: e.target.value as 'dog'|'cat'|'other', breed_id: undefined })) }}
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="dog">🐕 Cachorro</option>
                  <option value="cat">🐈 Gato</option>
                  <option value="other">🐾 Outro</option>
                </select>
              </div>

              {/* Breed selector */}
              {form.species !== 'other' && (
                <div className="relative" ref={breedRef}>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">Raça</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                      type="text"
                      value={breedSearch}
                      onChange={e => { setBreedSearch(e.target.value); if (!e.target.value) { setSelectedBreed(null); setForm(f => ({ ...f, breed_id: undefined })) } }}
                      placeholder="Buscar raça..."
                      className="w-full pl-9 pr-8 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {loadingBreeds && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                    )}
                    {!loadingBreeds && <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />}
                  </div>
                  {breedOpen && breedOptions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden">
                      {breedOptions.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => selectBreed(b)}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary-50 flex items-center gap-2 transition"
                        >
                          <span>{b.species === 'dog' ? '🐕' : '🐈'}</span>
                          <span className="font-medium text-surface-900">{b.name}</span>
                          {b.size && <span className="ml-auto text-xs text-surface-500">{b.size}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Data de Nascimento</label>
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={set('birth_date')}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Peso (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.weight}
                  onChange={set('weight')}
                  placeholder="Ex: 8.5"
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Cor / Pelagem</label>
                <input
                  type="text"
                  value={form.color}
                  onChange={set('color')}
                  placeholder="Ex: Caramelo, Preto e branco..."
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Sexo</label>
                <select
                  value={form.gender}
                  onChange={set('gender')}
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">Não informado</option>
                  <option value="male">♂ Macho</option>
                  <option value="female">♀ Fêmea</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Microchip</label>
                <input
                  type="text"
                  value={form.microchip}
                  onChange={set('microchip')}
                  placeholder="Número do microchip"
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="neutered"
                  checked={form.neutered}
                  onChange={e => setForm(f => ({ ...f, neutered: e.target.checked }))}
                  className="w-5 h-5 rounded accent-primary-500"
                />
                <label htmlFor="neutered" className="text-sm text-surface-700 cursor-pointer">
                  Pet castrado(a) ✂️
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-surface-700 mb-1.5">Bio / Observações</label>
                <textarea
                  value={form.bio}
                  onChange={set('bio')}
                  rows={3}
                  placeholder="Conte um pouco sobre o seu pet..."
                  className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Breed info preview */}
          {selectedBreed && (
            <div className="bg-primary-50 rounded-2xl border border-primary-200 p-5">
              <h3 className="font-semibold text-primary-800 mb-2 flex items-center gap-2">
                <PawPrint className="w-4 h-4" />
                Informações da Raça: {selectedBreed.name}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm text-primary-700">
                {selectedBreed.size && <div><span className="font-medium">Porte:</span> {selectedBreed.size}</div>}
                {selectedBreed.energy_level && <div><span className="font-medium">Energia:</span> {selectedBreed.energy_level}/5</div>}
                {selectedBreed.life_expectancy_min && (
                  <div><span className="font-medium">Expectativa de vida:</span> {selectedBreed.life_expectancy_min}–{selectedBreed.life_expectancy_max} anos</div>
                )}
                {selectedBreed.weight_min && (
                  <div><span className="font-medium">Peso médio:</span> {selectedBreed.weight_min}–{selectedBreed.weight_max} kg</div>
                )}
              </div>
              {selectedBreed.temperament && selectedBreed.temperament.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedBreed.temperament.map((t, i) => (
                    <span key={i} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3.5 border border-surface-200 rounded-xl text-sm font-medium text-surface-700 hover:bg-surface-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-500 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-60 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <PawPrint className="w-5 h-5" />
              )}
              {loading ? 'Cadastrando...' : 'Cadastrar Pet'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
