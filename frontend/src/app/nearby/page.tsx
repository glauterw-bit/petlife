'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, Phone, Star, Navigation, ExternalLink, Stethoscope, ShoppingBag, Search, SearchX, Clock } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { search, type NearbyPlace } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton'
import { Stagger, StaggerItem } from '@/components/ui/Motion'

const NearbyMap = dynamic(() => import('@/components/nearby/NearbyMap'), {
  ssr: false,
  loading: () => (
    <Skeleton className="w-full h-[420px] rounded-2xl" />
  ),
})

const RADII = [
  { value: '1', label: '1 km' },
  { value: '5', label: '5 km' },
  { value: '10', label: '10 km' },
  { value: '20', label: '20 km' },
] as const
type RadiusValue = typeof RADII[number]['value']

// `value` vai pro backend — só o rótulo é traduzido.
const TYPES = [
  { value: 'veterinary', labelKey: 'v.nearby.typeVet', icon: Stethoscope },
  { value: 'petshop', labelKey: 'v.nearby.typeShop', icon: ShoppingBag },
] as const
type PlaceType = typeof TYPES[number]['value']

export default function NearbyPage() {
  const { error } = useToast()
  const t = useT()
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [type, setType] = useState<PlaceType>('veterinary')
  const [radiusStr, setRadiusStr] = useState<RadiusValue>('5')
  const radius = Number(radiusStr)
  const [results, setResults] = useState<NearbyPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [searched, setSearched] = useState(false)

  async function getLocation() {
    // No app (iPhone/Android) a permissão é do sistema: usa o plugin nativo,
    // que pede a autorização certa e explica onde liberar se foi negada.
    const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }
    if (w.Capacitor?.isNativePlatform?.()) {
      setLocating(true)
      try {
        const { Geolocation } = await import('@capacitor/geolocation')
        const perm = await Geolocation.requestPermissions({ permissions: ['location'] }).catch(() => null)
        if (perm && perm.location === 'denied') { error(t('v.nearby.geoDeniedApp')); return }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000 })
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      } catch {
        error(t('v.nearby.geoDeniedApp'))
      } finally {
        setLocating(false)
      }
      return
    }
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

  // Pede a localização uma vez só ao abrir (o modo estrito do React roda o
  // efeito duas vezes em desenvolvimento e mostrava o erro em dobro).
  const askedRef = useRef(false)
  useEffect(() => {
    if (askedRef.current) return
    askedRef.current = true
    getLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const TypeIcon = type === 'veterinary' ? Stethoscope : ShoppingBag
  const mapsQuery = encodeURIComponent(type === 'veterinary' ? t('v.nearby.mapsQueryVet') : t('v.nearby.mapsQueryShop'))

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <PageHeader title={t('v.nearby.title')} subtitle={t('v.nearby.subtitle')} />

        {/* Controles */}
        <Card className="mb-5 space-y-4" padding="md">
          <div className="flex items-center justify-between gap-3">
            {coords ? (
              <span className="chip chip-success">
                <MapPin className="w-3.5 h-3.5" aria-hidden />
                {t('v.nearby.located')}
              </span>
            ) : (
              <Button variant="soft" size="sm" leftIcon={Navigation} loading={locating} onClick={getLocation}>
                {locating ? t('v.nearby.locating') : t('v.nearby.useLocation')}
              </Button>
            )}
          </div>

          <SegmentedControl
            ariaLabel={t('wk.nearby.typeAria')}
            value={type}
            onChange={v => setType(v)}
            options={TYPES.map(o => ({ value: o.value, label: t(o.labelKey), icon: o.icon }))}
          />

          <div>
            <p id="radius-label" className="text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1.5">{t('v.nearby.radius')}</p>
            <SegmentedControl
              ariaLabel={t('v.nearby.radius')}
              size="sm"
              value={radiusStr}
              onChange={v => setRadiusStr(v)}
              options={RADII.map(r => ({ value: r.value, label: r.label }))}
            />
          </div>

          <Button fullWidth leftIcon={Search} loading={loading} disabled={!coords} onClick={handleSearch}>
            {loading ? t('v.nearby.searching') : t('v.nearby.search')}
          </Button>
        </Card>

        {/* Mapa */}
        {coords ? (
          <div className="mb-5">
            <NearbyMap userLat={coords.lat} userLon={coords.lon} results={results} type={type} />
          </div>
        ) : (
          <Card tone="muted" className="mb-5 text-center text-sm text-surface-600 dark:text-surface-400 py-8">
            <MapPin className="w-6 h-6 mx-auto mb-2 text-surface-500 dark:text-surface-400" aria-hidden />
            {t('v.nearby.mapPermission')}
          </Card>
        )}

        {/* Sempre disponível: a mesma busca no app de mapas do celular (base de
            clínicas bem mais completa que a do OpenStreetMap no Brasil) */}
        {coords && (
          <Card className="mb-5" padding="md">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">{t('v.nearby.mapsTitle')}</p>
            <p className="text-xs text-surface-600 dark:text-surface-400 mb-3">{t('v.nearby.mapsHint')}</p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://maps.apple.com/?q=${mapsQuery}&sll=${coords.lat},${coords.lon}&z=14`}
                target="_blank" rel="noreferrer"
                onClick={() => track('nearby_maps_apple')}
                className={buttonClasses('secondary', 'md', true)}
              >
                {t('v.nearby.openApple')}
              </a>
              <a
                href={`https://www.google.com/maps/search/${mapsQuery}/@${coords.lat},${coords.lon},14z`}
                target="_blank" rel="noreferrer"
                onClick={() => track('nearby_maps_google')}
                className={buttonClasses('secondary', 'md', true)}
              >
                {t('v.nearby.openGoogle')}
              </a>
            </div>
          </Card>
        )}

        {loading && (
          <div className="space-y-3" aria-busy="true">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {/* Resultados */}
        {searched && !loading && (
          <section aria-labelledby="nearby-results">
            <h2 id="nearby-results" className="text-base font-bold font-display text-surface-900 dark:text-white mb-3" aria-live="polite">
              {results.length === 0
                ? t('v.nearby.noResults')
                : results.length === 1
                  ? t('v.nearby.resultsOne')
                  : t('v.nearby.resultsMany', { count: results.length })}
            </h2>

            {results.length === 0 ? (
              <Card padding="none">
                <EmptyState icon={SearchX} title={t('v.nearby.emptyTitle')} text={t('v.nearby.emptyText')} />
              </Card>
            ) : (
              <Stagger as="ul" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.map((place, i) => (
                  <StaggerItem as="li" key={`${place.name}-${i}`}>
                    <Card padding="md" className="h-full flex flex-col">
                      <div className="flex items-start gap-3">
                        <span className="w-11 h-11 bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 rounded-xl flex items-center justify-center shrink-0">
                          <TypeIcon className="w-5 h-5" aria-hidden />
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-surface-900 dark:text-white leading-tight">{place.name}</h3>
                          {place.address && (
                            <p className="text-sm text-surface-600 dark:text-surface-400 flex items-start gap-1.5 mt-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                              {place.address}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {place.distance_km !== undefined && (
                              <span className="chip chip-info">
                                <Navigation className="w-3 h-3" aria-hidden />
                                {place.distance_km.toFixed(1)} km
                              </span>
                            )}
                            {place.rating && (
                              <span className="chip chip-warning">
                                <Star className="w-3 h-3" aria-hidden />
                                {place.rating.toFixed(1)}
                              </span>
                            )}
                            {place.open_now !== undefined && (
                              <span className={cn('chip', place.open_now ? 'chip-success' : 'chip-danger')}>
                                <Clock className="w-3 h-3" aria-hidden />
                                {place.open_now ? t('v.nearby.open') : t('v.nearby.closed')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-1 flex flex-wrap gap-2 mt-auto">
                        {place.phone && (
                          <a
                            href={`tel:${place.phone}`}
                            className={buttonClasses('secondary', 'md', false, 'flex-1 min-w-[140px]')}
                            aria-label={t('wk.nearby.call', { name: place.name })}
                          >
                            <Phone className="w-4 h-4" aria-hidden />
                            <span className="truncate">{place.phone}</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openGoogleMaps(place)}
                          className={buttonClasses('soft', 'md', false, 'flex-1 min-w-[140px]')}
                        >
                          <ExternalLink className="w-4 h-4" aria-hidden />
                          {t('v.nearby.viewMaps')}
                        </button>
                      </div>
                    </Card>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  )
}
