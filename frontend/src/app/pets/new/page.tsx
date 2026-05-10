'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Camera, Search, ChevronDown, AlertCircle, PawPrint, Sparkles, X } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { pets as petsApi, breeds as breedsApi, type Breed } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'

interface BreedCandidate {
  breed: string
  name_en?: string
  confidence: number
  reasoning?: string
  breed_id: number | null
}

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

  // Breed-from-photo (IA Vision)
  const [identifyOpen, setIdentifyOpen] = useState(false)
  const [identifyFile, setIdentifyFile] = useState<File | null>(null)
  const [identifyPreview, setIdentifyPreview] = useState<string | null>(null)
  const [identifyLoading, setIdentifyLoading] = useState(false)
  const [identifyResult, setIdentifyResult] = useState<{
    candidates: BreedCandidate[]
    notes: string
    is_mixed_likely: boolean
  } | null>(null)
  const [identifyError, setIdentifyError] = useState<string | null>(null)
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

  async function pickIdentifyFile(e: React.ChangeEvent<HTMLInputElement>) {
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
      const res = await breedsApi.identifyFromPhoto(identifyFile)
      setIdentifyResult(res)
    } catch (e: unknown) {
      setIdentifyError(e instanceof Error ? e.message : 'Erro ao identificar.')
    } finally {
      setIdentifyLoading(false)
    }
  }

  async function pickCandidate(c: BreedCandidate) {
    if (c.breed_id) {
      // Já existe no catálogo — busca o registro completo e seleciona
      try {
        const breed = await breedsApi.getById(c.breed_id)
        selectBreed(breed)
      } catch {
        setBreedSearch(c.breed)
        setForm(f => ({ ...f, breed_id: c.breed_id ?? undefined }))
      }
    } else {
      // Sem match no catálogo — só preenche o nome
      setBreedSearch(c.breed)
    }
    // Reusa a foto da identificação como foto do pet (se ainda não tem)
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-surface-700">Raça</label>
                    <button
                      type="button"
                      onClick={() => setIdentifyOpen(true)}
                      className="flex items-center gap-1 text-xs text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-full font-semibold transition"
                    >
                      <Sparkles className="w-3 h-3" />
                      Não sei a raça? Identificar por foto
                    </button>
                  </div>
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

      {/* Modal: identificar raça por foto */}
      {identifyOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={closeIdentify}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 sticky top-0 bg-white">
              <h2 className="font-bold text-surface-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-600" />
                Identificar raça por foto
              </h2>
              <button
                type="button"
                onClick={closeIdentify}
                aria-label="Fechar"
                className="p-1.5 rounded-lg hover:bg-surface-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-surface-600">
                A IA Vyron analisa a foto e sugere as 3 raças mais prováveis.
                Funciona melhor com foto de corpo inteiro do pet com boa iluminação.
              </p>

              {!identifyPreview ? (
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={pickIdentifyFile}
                  />
                  <div className="border-2 border-dashed border-primary-200 hover:border-primary-400 hover:bg-primary-50 rounded-2xl p-8 text-center cursor-pointer transition">
                    <Camera className="w-10 h-10 mx-auto text-primary-500 mb-2" />
                    <p className="text-sm font-semibold text-surface-800">Tirar foto ou escolher</p>
                    <p className="text-xs text-surface-500 mt-1">JPG, PNG ou WEBP até 5 MB</p>
                  </div>
                </label>
              ) : (
                <div className="space-y-3">
                  <img
                    src={identifyPreview}
                    alt="Pet"
                    className="w-full rounded-2xl object-cover max-h-64 border border-surface-200"
                  />
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer text-center text-sm text-surface-700 bg-surface-100 hover:bg-surface-200 px-3 py-2 rounded-xl transition">
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickIdentifyFile} />
                      Trocar foto
                    </label>
                    <button
                      type="button"
                      onClick={runIdentify}
                      disabled={identifyLoading || !!identifyResult}
                      className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-primary-500 text-white px-3 py-2 rounded-xl hover:bg-primary-600 disabled:opacity-60 transition"
                    >
                      {identifyLoading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {identifyLoading ? 'Analisando…' : identifyResult ? 'Analisado' : 'Identificar'}
                    </button>
                  </div>
                </div>
              )}

              {identifyError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {identifyError}
                </div>
              )}

              {identifyResult && identifyResult.candidates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">
                    Candidatos {identifyResult.is_mixed_likely && <span className="ml-1 text-amber-600">(possível mistura)</span>}
                  </p>
                  {identifyResult.candidates.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickCandidate(c)}
                      className="w-full text-left bg-white border border-surface-200 hover:border-primary-300 hover:bg-primary-50 rounded-xl p-3 transition group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-surface-900 group-hover:text-primary-700">{c.breed}</span>
                        <span className="text-xs font-bold text-primary-600 bg-primary-50 group-hover:bg-white px-2 py-0.5 rounded-full">
                          {Math.round((c.confidence ?? 0) * 100)}%
                        </span>
                      </div>
                      {c.reasoning && <p className="text-xs text-surface-500 mt-1">{c.reasoning}</p>}
                      {!c.breed_id && <p className="text-[10px] text-amber-600 mt-1">⚠ Não está no catálogo — apenas preenche o nome.</p>}
                    </button>
                  ))}
                  {identifyResult.notes && (
                    <p className="text-xs text-surface-500 italic mt-2">{identifyResult.notes}</p>
                  )}
                </div>
              )}

              {identifyResult && identifyResult.candidates.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">
                  Não foi possível identificar uma raça nesta foto. {identifyResult.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
