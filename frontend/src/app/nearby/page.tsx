'use client'

import { useState, useEffect } from 'react'
import { MapPin, Phone, Star, Navigation, ExternalLink, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { search, type NearbyPlace } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { cn } from '@/lib/utils'

const RADII = [
  { value: 1, label: '1 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 20, label: '20 km' },
]

const TYPES = [
  { value: 'veterinary', label: '🏥 Clínicas Veterinárias' },
  { value: 'petshop', label: '🛍 Pet Shops' },
]

export default function NearbyPage() {
  const { error } = useToast()
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [type, setType] = useState('veterinary')
  const [radius, setRadius] = useState(5)
  const [results, setResults] = useState<NearbyPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [searched, setSearched] = useState(false)

  async function getLocation() {
    if (!navigator.geolocation) { error('Geolocalização não suportada pelo seu navegador.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        error('Não foi possível obter sua localização. Verifique as permissões do navegador.')
        setLocating(false)
      }
    )
  }

  useEffect(() => {
    getLocation()
  }, [])

  async function handleSearch() {
    if (!coords) { error('Localização não disponível. Clique em "Usar minha localização".'); return }
    setLoading(true)
    setSearched(true)
    try {
      const res = await search.nearby(coords.lat, coords.lon, type, radius)
      setResults(res)
    } catch {
      error('Erro ao buscar locais próximos.')
      setResults([])
    } finally { setLoading(false) }
  }

  function openGoogleMaps(place: NearbyPlace) {
    const q = place.lat && place.lon
      ? `${place.lat},${place.lon}`
      : encodeURIComponent(place.name + ' ' + (place.address ?? ''))
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank')
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-surface-900">Buscar Clínicas e Pet Shops</h1>
        <p className="text-surface-500 mt-1">Encontre estabelecimentos próximos a você</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-surface-100 p-5 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Location status */}
          <div className="flex items-center gap-2">
            {coords ? (
              <div className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-xl">
                <MapPin className="w-4 h-4" />
                Localização obtida
              </div>
            ) : (
              <button
                onClick={getLocation}
                disabled={locating}
                className="flex items-center gap-1.5 text-sm text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-2 rounded-xl transition"
              >
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                {locating ? 'Localizando...' : 'Usar minha localização'}
              </button>
            )}
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-medium transition',
                  type === t.value ? 'bg-primary-500 text-white' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Radius */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-surface-600">Raio:</span>
            <div className="flex gap-1">
              {RADII.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRadius(r.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-sm font-medium transition',
                    radius === r.value ? 'bg-accent-500 text-white' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !coords}
            className="ml-auto flex items-center gap-2 bg-primary-500 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-600 disabled:opacity-60 transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Map placeholder */}
      <div className="bg-surface-100 rounded-2xl border border-surface-200 p-8 mb-6 text-center">
        <div className="text-5xl mb-3">🗺️</div>
        <h3 className="font-semibold text-surface-700 mb-2">Mapa Interativo</h3>
        <p className="text-sm text-surface-500 max-w-md mx-auto">
          Para visualizar os resultados no mapa, clique em "Abrir no Google Maps" em cada resultado abaixo.
          Em breve integraremos um mapa interativo diretamente aqui.
        </p>
        {coords && (
          <a
            href={`https://www.google.com/maps/search/${encodeURIComponent(TYPES.find(t2 => t2.value === type)?.label.replace(/[^a-zA-Z\s]/g, '') ?? 'veterinario')}/@${coords.lat},${coords.lon},14z`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-primary-600 hover:underline font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir busca no Google Maps
          </a>
        )}
      </div>

      {/* Results */}
      {searched && !loading && (
        <div>
          <h2 className="text-lg font-bold text-surface-900 mb-4">
            {results.length > 0 ? `${results.length} resultado${results.length > 1 ? 's' : ''} encontrado${results.length > 1 ? 's' : ''}` : 'Nenhum resultado encontrado'}
          </h2>

          {results.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-surface-100">
              <div className="text-5xl mb-3">😔</div>
              <p className="text-surface-600">Nenhum local encontrado nesse raio.</p>
              <p className="text-sm text-surface-500 mt-1">Tente aumentar o raio de busca.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((place, i) => (
                <div key={i} className="bg-white rounded-2xl border border-surface-100 p-5 hover:border-primary-200 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-2xl shrink-0">
                      {type === 'veterinary' ? '🏥' : '🛍'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-surface-900 mb-0.5">{place.name}</h3>
                      {place.address && (
                        <p className="text-sm text-surface-500 flex items-start gap-1.5 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-surface-400 shrink-0 mt-0.5" />
                          {place.address}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {place.distance_km !== undefined && (
                          <span className="text-xs bg-primary-50 text-primary-700 font-medium px-2.5 py-0.5 rounded-full">
                            📍 {place.distance_km.toFixed(1)} km
                          </span>
                        )}
                        {place.rating && (
                          <span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2.5 py-0.5 rounded-full font-medium">
                            <Star className="w-3 h-3" />
                            {place.rating.toFixed(1)}
                          </span>
                        )}
                        {place.open_now !== undefined && (
                          <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full', place.open_now ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                            {place.open_now ? '🟢 Aberto' : '🔴 Fechado'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    {place.phone && (
                      <a
                        href={`tel:${place.phone}`}
                        className="flex items-center gap-1.5 text-sm text-surface-700 bg-surface-100 hover:bg-surface-200 px-3 py-2 rounded-xl transition"
                      >
                        <Phone className="w-4 h-4" />
                        {place.phone}
                      </a>
                    )}
                    <button
                      onClick={() => openGoogleMaps(place)}
                      className="flex items-center gap-1.5 text-sm text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-2 rounded-xl transition ml-auto"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ver no Maps
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
