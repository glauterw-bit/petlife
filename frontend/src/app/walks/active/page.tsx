'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Geolocation } from '@capacitor/geolocation'
import { Play, Pause, Square, Camera, MapPin, Check, PawPrint } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { walks, pets as petsApi, type Pet, type RoutePoint } from '@/lib/api'
import { useCached, invalidate } from '@/lib/cache'
import { useConfirm } from '@/components/ui/Confirm'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastContext'
import { hapticMedium, hapticSuccess, hapticSelect, celebrate } from '@/lib/feedback'
import { haversineMeters, formatDistance, formatDuration, shouldAcceptPoint } from '@/lib/walk-utils'
import { paceClock } from '@/components/walks/pace'
import { saveActiveWalk, clearActiveWalk, enqueueFinish } from '@/lib/walk-persistence'
import { trackHappyMoment } from '@/lib/review'
import { useT } from '@/contexts/LocaleContext'

const MapLoading = () => {
  const t = useT()
  return (
    <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-100 dark:bg-surface-900 flex items-center justify-center" style={{ height: 300 }}>
      <span className="text-sm text-surface-500 dark:text-surface-400">{t('pw.map.loading')}</span>
    </div>
  )
}

const WalkMap = dynamic(() => import('@/components/walks/WalkMap'), {
  ssr: false,
  loading: () => <MapLoading />,
})

type Phase = 'choose-pet' | 'tracking' | 'paused' | 'saving'

export default function ActiveWalkPage() {
  const t = useT()
  const router = useRouter()
  const { success, error } = useToast()
  const confirm = useConfirm()

  const [phase, setPhase] = useState<Phase>('choose-pet')
  // Mesma chave do shell: a lista de pets aparece na hora.
  const petsQ = useCached<Pet[]>('pets', () => petsApi.list())
  const pets = petsQ.data ?? []
  const petsLoading = petsQ.loading
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null)
  const [walkId, setWalkId] = useState<number | null>(null)
  // O callback do GPS é criado uma vez só; sem a ref ele lia a fase antiga
  // ('choose-pet') para sempre e descartava todos os pontos da rota.
  const phaseRef = useRef<Phase>('choose-pet')
  useEffect(() => { phaseRef.current = phase }, [phase])

  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null)
  const [distance, setDistance] = useState(0) // metros
  const [duration, setDuration] = useState(0) // segundos
  const [startTs, setStartTs] = useState<number | null>(null)
  const [pausedAccum, setPausedAccum] = useState(0)
  const [pausedAt, setPausedAt] = useState<number | null>(null)

  const watchIdRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<File[]>([])

  useEffect(() => {
    if (petsQ.error && !petsQ.data) error(t('pw.active.loadPetsError'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petsQ.error])

  // Um pet só: já vem escolhido.
  useEffect(() => {
    if (pets.length === 1 && selectedPetId == null) setSelectedPetId(pets[0].id)
  }, [pets, selectedPetId])

  // Resume active walk if exists
  useEffect(() => {
    let alive = true
    walks.getActive()
      .then(async active => {
        if (!active || !alive) return
        // Já tem um passeio ativo — pergunta se quer continuar
        const ok = await confirm({
          title: t('pw.active.resumeConfirm', { name: active.pet_name ?? '' }),
          confirmLabel: t('pw.active.resume'),
        })
        if (!ok || !alive) return
        setWalkId(active.id)
        setSelectedPetId(active.pet_id)
        setStartTs(new Date(active.started_at).getTime())
        setPhase('tracking')
        phaseRef.current = 'tracking'
        // retomar sem religar o GPS deixava o passeio sem rota
        void startWatchingGPS()
      })
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (watchIdRef.current) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {})
      }
    }
  }, [])

  // Persiste snapshot do passeio ativo (resiliência: app fecha/recarrega/sem net)
  useEffect(() => {
    if ((phase === 'tracking' || phase === 'paused') && walkId != null) {
      saveActiveWalk({
        walkId, petId: selectedPetId, startTs, pausedAccum,
        routePoints, distance, duration, savedAt: Date.now(),
      })
    }
  }, [phase, walkId, selectedPetId, startTs, pausedAccum, routePoints, distance, duration])

  // Timer
  useEffect(() => {
    if (phase === 'tracking' && startTs != null) {
      timerRef.current = setInterval(() => {
        const now = Date.now()
        const elapsedMs = now - startTs - pausedAccum
        setDuration(Math.floor(elapsedMs / 1000))
      }, 1000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }
  }, [phase, startTs, pausedAccum])

  async function startWatchingGPS() {
    try {
      const perms = await Geolocation.requestPermissions()
      if (perms.location !== 'granted' && perms.coarseLocation !== 'granted') {
        error(t('pw.active.needLocation'))
        return false
      }
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000 },
        (pos, err) => {
          if (err || !pos) return
          handleGPSUpdate({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            ts: Date.now(),
            alt: pos.coords.altitude ?? undefined,
            acc: pos.coords.accuracy ?? undefined,
          })
        },
      )
      watchIdRef.current = id
      return true
    } catch (e) {
      error(t('pw.active.gpsError'))
      return false
    }
  }

  function handleGPSUpdate(next: { lat: number; lng: number; ts: number; alt?: number; acc?: number }) {
    setCurrentPos({ lat: next.lat, lng: next.lng })
    if (phaseRef.current !== 'tracking') return
    setRoutePoints(prev => {
      const last = prev.length > 0 ? prev[prev.length - 1] : null
      if (!shouldAcceptPoint(last, next)) return prev
      const newPoints = [...prev, next as RoutePoint]
      if (last) {
        const d = haversineMeters(last, next)
        setDistance(prevD => prevD + d)
      }
      return newPoints
    })
  }

  async function handleStart() {
    if (!selectedPetId) {
      error(t('pw.active.selectPetFirst'))
      return
    }
    try {
      const walk = await walks.start(selectedPetId)
      setWalkId(walk.id)
      setStartTs(Date.now())
      setPhase('tracking')
      phaseRef.current = 'tracking'
      void hapticMedium()
      const ok = await startWatchingGPS()
      if (!ok) {
        // GPS falhou, mas o walk foi criado — usuário pode finalizar sem rota
      }
    } catch (e) {
      error(e instanceof Error ? e.message : t('pw.active.startError'))
    }
  }

  function handlePause() {
    setPhase('paused')
    setPausedAt(Date.now())
    void hapticMedium()
  }

  function handleResume() {
    if (pausedAt) {
      setPausedAccum(prev => prev + (Date.now() - pausedAt))
      setPausedAt(null)
    }
    setPhase('tracking')
    void hapticMedium()
  }

  async function handleFinish() {
    if (!walkId) return
    const ok = await confirm({ title: t('pw.active.finishConfirm'), confirmLabel: t('walk.finish') })
    if (!ok) return
    setPhase('saving')
    void hapticMedium()

    // Stop GPS
    if (watchIdRef.current) {
      await Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {})
      watchIdRef.current = null
    }
    if (timerRef.current) clearInterval(timerRef.current)

    const payload = {
      ended_at: new Date().toISOString(),
      duration_seconds: duration,
      distance_meters: distance,
      route_points: routePoints,
    }

    try {
      const finished = await walks.finish(walkId, payload)

      // Upload photos sequentially
      for (const p of photos) {
        try {
          await walks.uploadPhoto(walkId, p)
        } catch {}
      }

      clearActiveWalk()
      invalidate('walks')
      void hapticSuccess()
      success(t('pw.active.savedToast', { distance: formatDistance(distance), duration: formatDuration(duration) }))
      trackHappyMoment('walk')
      // Confete só no PRIMEIRO passeio do tutor (marco). Os seguintes ficam com a vibração.
      walks.stats().then(st => { if (st.total_walks === 1) celebrate('medium') }).catch(() => {})
      router.push(`/walks/${finished.id}`)
    } catch (e) {
      // Sem internet / erro de rede: enfileira pra reenviar depois — NÃO perde o passeio
      enqueueFinish({ walkId, payload, queuedAt: Date.now() })
      clearActiveWalk()
      invalidate('walks')
      success(t('pw.active.offlineSaved'))
      router.push('/walks')
    }
  }

  function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setPhotos(prev => [...prev, ...files])
    void hapticMedium()
    success(t('pw.active.photoAdded', { count: photos.length + files.length }))
  }

  const header = <PageHeader title={t('pw.active.title')} back="/walks" large={phase === 'choose-pet'} showBell={false} />

  if (petsLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto" aria-busy="true">
          {header}
          <Skeleton className="h-4 w-2/3 rounded-md mb-5" />
          <div className="space-y-3 mb-6">
            <SkeletonRow />
            <SkeletonRow />
          </div>
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </DashboardLayout>
    )
  }

  // ── UI ────────────────────────────────────────────────

  if (phase === 'choose-pet' || pets.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto">
          {header}
          {pets.length === 0 ? (
            <EmptyState
              icon={PawPrint}
              title={t('pw.active.noPets')}
              ctaLabel={t('pw.pets.add')}
              ctaHref="/pets/new"
            />
          ) : (
            <>
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-4">{t('pw.active.subtitle')}</p>
              <div role="radiogroup" aria-label={t('pw.active.subtitle')} className="grid grid-cols-1 gap-3 mb-6">
                {pets.map(p => {
                  const selected = selectedPetId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => { void hapticSelect(); setSelectedPetId(p.id) }}
                      className={cn(
                        'pressable flex items-center gap-4 p-4 min-h-[72px] rounded-2xl border-2 transition-colors text-left',
                        selected
                          ? 'border-primary-600 bg-primary-50 dark:border-primary-400 dark:bg-primary-500/15'
                          : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 hover:border-surface-300 dark:hover:border-surface-700',
                      )}
                    >
                      <PetAvatar pet={p} size={52} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-surface-900 dark:text-white truncate">{p.name}</div>
                        {p.breed?.name && <div className="text-xs text-surface-500 dark:text-surface-400 truncate">{p.breed.name}</div>}
                      </div>
                      <span
                        aria-hidden
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors',
                          selected
                            ? 'bg-primary-700 border-primary-700 text-white dark:bg-primary-400 dark:border-primary-400 dark:text-surface-950'
                            : 'border-surface-300 dark:border-surface-600',
                        )}
                      >
                        {selected && <Check className="w-4 h-4" strokeWidth={3} />}
                      </span>
                    </button>
                  )
                })}
              </div>

              <Button
                size="lg"
                fullWidth
                leftIcon={Play}
                onClick={handleStart}
                disabled={!selectedPetId}
                className="min-h-[56px] text-lg rounded-2xl [&_svg]:fill-current"
              >
                {t('pw.active.startWalk')}
              </Button>
            </>
          )}
        </div>
      </DashboardLayout>
    )
  }

  const ctrl =
    'pressable flex flex-col items-center justify-center gap-1 min-h-[56px] py-3 rounded-2xl font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none'

  // Tracking / paused / saving UI
  return (
    <DashboardLayout>
      <div className="max-w-md mx-auto">
        {header}
        {/* Mapa */}
        <WalkMap
          points={routePoints}
          currentLat={currentPos?.lat}
          currentLng={currentPos?.lng}
          height={300}
          follow={phase === 'tracking'}
        />

        {/* Stats */}
        <div className="mt-4 bg-white dark:bg-surface-900 rounded-2xl p-5 border border-surface-200/70 dark:border-surface-800" aria-live="off">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-surface-900 dark:text-white tabular-nums">
                {formatDistance(distance)}
              </div>
              <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">{t('walk.distance')}</div>
            </div>
            <div>
              <div className={cn('text-3xl md:text-4xl font-bold tabular-nums', phase === 'paused' ? 'text-amber-700 dark:text-amber-300' : 'text-surface-900 dark:text-white')}>
                {formatDuration(duration)}
              </div>
              <div className={cn('text-xs mt-1', phase === 'paused' ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-surface-500 dark:text-surface-400')}>
                {phase === 'paused' ? t('pw.active.paused') : t('walk.time')}
              </div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-surface-900 dark:text-white tabular-nums">
                {(distance > 0 && duration > 0 && paceClock(duration / (distance / 1000))) || '—'}
              </div>
              <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">{t('wk2.paceLabel')}</div>
            </div>
          </div>

          {photos.length > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800 flex items-center justify-center gap-2 text-sm text-surface-600 dark:text-surface-300">
              <Camera className="w-4 h-4" aria-hidden /> {photos.length > 1
                ? t('pw.active.photosCountMany', { count: photos.length })
                : t('pw.active.photosCountOne', { count: photos.length })}
            </div>
          )}
        </div>

        {/* Controles: 56 px, alvos grandes para usar andando */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={phase === 'saving'}
            className={cn(ctrl, 'bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-800 dark:text-surface-100 hover:bg-surface-50 dark:hover:bg-surface-800')}
          >
            <Camera className="w-6 h-6" aria-hidden />
            <span className="text-xs">{t('pw.active.photo')}</span>
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleAddPhoto}
            className="hidden"
          />

          {phase === 'tracking' ? (
            <button
              type="button"
              onClick={handlePause}
              className={cn(ctrl, 'bg-amber-400 text-surface-950 hover:bg-amber-500 dark:bg-amber-400 dark:hover:bg-amber-300')}
            >
              <Pause className="w-6 h-6 fill-current" aria-hidden />
              <span className="text-xs">{t('pw.active.pause')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResume}
              disabled={phase === 'saving'}
              className={cn(ctrl, 'bg-primary-700 text-white hover:bg-primary-800 dark:bg-primary-500 dark:text-surface-950 dark:hover:bg-primary-400')}
            >
              <Play className="w-6 h-6 fill-current" aria-hidden />
              <span className="text-xs">{t('pw.active.resume')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleFinish}
            disabled={phase === 'saving'}
            className={cn(ctrl, 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500')}
          >
            <Square className="w-6 h-6 fill-current" aria-hidden />
            <span className="text-xs">{phase === 'saving' ? t('pw.common.saving') : t('walk.finish')}</span>
          </button>
        </div>

        {/* GPS status (texto + ícone, nunca só cor) */}
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-surface-600 dark:text-surface-400" role="status">
          <MapPin className={cn('w-3.5 h-3.5', currentPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400 motion-safe:animate-pulse')} aria-hidden />
          {currentPos ? t('pw.active.gpsOn') : t('pw.active.gpsWaiting')}
        </div>
      </div>
    </DashboardLayout>
  )
}
