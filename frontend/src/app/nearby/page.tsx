'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Phone, Star, Navigation, ExternalLink, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { search, type NearbyPlace } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { cn } from '@/lib/utils'

const NearbyMap = dynamic(() => import('@/components/nearby/NearbyMap'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/60 flex items-center justify-center" style={{ height: 420 }}>
      <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
    </div>
  ),
})

const RADII = [
  { value: 1, label: '1 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 20, label: '20 km' },
]

// `value` vai pro backend — só o rótulo é traduzido.
const TYPES = [
  { value: 'veterinary', labelKey: 'v.nearby.typeVet' },
  { value: 'petshop', labelKey: 'v.nearby.typeShop' },
]

export default function NearbyPage() {
  const { error } = useToast()
  const t = useT()
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [type, setType] = useState('veterinary')
  const [radius, setRadius] = useState(5)
  const [results, setResults] = useState<NearbyPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [searched, setSearched] = useState(false)

  async function getLocation() {
    if (!navigator.geolocation) { error(t('v.nearby.geoUnsupported')); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        error(t('v.nearby.geoError'))
        setLocating(false)
      }
    )
  }

  useEffect(() => {
    getLocation()
  }, [])

  async function handleSearch() {
    if (!coords) { error(t('v.nearby.noCoords')); return }
    setLoading(true)
    setSearched(true)
    try {
      const res = await search.nearby(coords.lat, coords.lon, type, radius)
      setResults(res)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('v.nearby.errUnknown')
      if (msg.toLowerCase().includes('timeout') || msg.includes('504')) {
        error(t('v.nearby.errTimeout'))
      } else if (msg.includes('502') || msg.toLowerCase().includes('mapa')) {
        error(t('v.nearby.errMap'))
      } else {
        error(t('v.nearby.errSearch', { msg }))
      }
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
      <div className="mb-5 md:mb-6 ">
        <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight">{t('v.nearby.title')}</h1>
        <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">{t('v.nearby.subtitle')}</p>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Location status */}
          <div className="flex items-center gap-2">
            {coords ? (
              <div className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-xl">
                <MapPin className="w-4 h-4" />
                {t('v.nearby.located')}
              </div>
            ) : (
              <button
                onClick={getLocation}
                disabled={locating}
                className="flex items-center gap-1.5 text-sm text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-2 rounded-xl transition"
              >
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                {locating ? t('v.nearby.locating') : t('v.nearby.useLocation')}
              </button>
            )}
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {TYPES.map(item => (
              <button
                key={item.value}
                onClick={() => setType(item.value)}
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-medium transition',
                  type === item.value ? 'bg-primary-500 text-white' : 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-200'
                )}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>

          {/* Radius */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-surface-600 dark:text-surface-300">{t('v.nearby.radius')}</span>
            <div className="flex gap-1">
              {RADII.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRadius(r.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-sm font-medium transition',
                    radius === r.value ? 'bg-accent-500 text-white' : 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-200'
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
            {loading ? t('v.nearby.searching') : t('v.nearby.search')}
          </button>
        </div>
      </div>

      {/* Map */}
      {coords ? (
        <div className="mb-6">
          <NearbyMap
            userLat={coords.lat}
            userLon={coords.lon}
            results={results}
            type={type}
          />
        </div>
      ) : (
        <div className="bg-surface-50 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-700 rounded-2xl p-8 mb-6 text-center text-sm text-surface-500 dark:text-surface-400">
          {t('v.nearby.mapPermission')}
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <div>
          <h2 className="text-lg font-bold text-surface-900 dark:text-white mb-4">
            {results.length === 0
              ? t('v.nearby.noResults')
              : results.length === 1
                ? t('v.nearby.resultsOne')
                : t('v.nearby.resultsMany', { count: results.length })}
          </h2>

          {results.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
              <div className="text-5xl mb-3">😔</div>
              <p className="text-surface-600 dark:text-surface-300">{t('v.nearby.emptyTitle')}</p>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{t('v.nearby.emptyText')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((place, i) => (
                <div key={i} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5 hover:border-primary-200 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-2xl shrink-0">
                      {type === 'veterinary' ? '🏥' : '🛍'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-surface-900 dark:text-white mb-0.5">{place.name}</h3>
                      {place.address && (
                        <p className="text-sm text-surface-500 dark:text-surface-400 flex items-start gap-1.5 mb-1">
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
                            {place.open_now ? t('v.nearby.open') : t('v.nearby.closed')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    {place.phone && (
                      <a
                        href={`tel:${place.phone}`}
                        className="flex items-center gap-1.5 text-sm text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 px-3 py-2 rounded-xl transition"
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
                      {t('v.nearby.viewMaps')}
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
