'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Geolocation } from '@capacitor/geolocation'
import { Play, Pause, Square, Camera, MapPin } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { walks, pets as petsApi, type Pet, type RoutePoint } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { hapticMedium, hapticHeavy, hapticSuccess } from '@/lib/feedback'
import { haversineMeters, formatDistance, formatDuration, formatPace, shouldAcceptPoint } from '@/lib/walk-utils'
import { PageLoader } from '@/components/ui/LoadingSpinner'

const WalkMap = dynamic(() => import('@/components/walks/WalkMap'), { ssr: false })

type Phase = 'choose-pet' | 'tracking' | 'paused' | 'saving'

export default function ActiveWalkPage() {
  const router = useRouter()
  const { success, error } = useToast()

  const [phase, setPhase] = useState<Phase>('choose-pet')
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null)
  const [walkId, setWalkId] = useState<number | null>(null)
  const [petsLoading, setPetsLoading] = useState(true)

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

  // Load pets
  useEffect(() => {
    petsApi.list()
      .then(setPets)
      .catch(() => error('Erro ao carregar pets'))
      .finally(() => setPetsLoading(false))
  }, [error])

  // Resume active walk if exists
  useEffect(() => {
    walks.getActive()
      .then(active => {
        if (active) {
          // Já tem um passeio ativo — pergunta se quer continuar
          if (confirm(`Você tem um passeio em andamento com ${active.pet_name}. Continuar?`)) {
            setWalkId(active.id)
            setSelectedPetId(active.pet_id)
            setStartTs(new Date(active.started_at).getTime())
            setPhase('tracking')
          }
        }
      })
      .catch(() => {})
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
        error('Acesso à localização necessário pra registrar o passeio.')
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
      error('Erro ao acessar GPS. Verifica permissões.')
      return false
    }
  }

  function handleGPSUpdate(next: { lat: number; lng: number; ts: number; alt?: number; acc?: number }) {
    setCurrentPos({ lat: next.lat, lng: next.lng })
    if (phase !== 'tracking') return
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
      error('Selecione um pet pra começar.')
      return
    }
    try {
      const walk = await walks.start(selectedPetId)
      setWalkId(walk.id)
      setStartTs(Date.now())
      setPhase('tracking')
      void hapticSuccess()
      const ok = await startWatchingGPS()
      if (!ok) {
        // GPS falhou, mas o walk foi criado — usuário pode finalizar sem rota
      }
    } catch (e) {
      error(e instanceof Error ? e.message : 'Erro ao iniciar passeio.')
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
    if (!confirm('Finalizar passeio?')) return
    setPhase('saving')
    void hapticHeavy()

    // Stop GPS
    if (watchIdRef.current) {
      await Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {})
      watchIdRef.current = null
    }
    if (timerRef.current) clearInterval(timerRef.current)

    try {
      const finished = await walks.finish(walkId, {
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        distance_meters: distance,
        route_points: routePoints,
      })

      // Upload photos sequentially
      for (const p of photos) {
        try {
          await walks.uploadPhoto(walkId, p)
        } catch {}
      }

      success(`Passeio salvo: ${formatDistance(distance)} em ${formatDuration(duration)}! 🎉`)
      router.push(`/walks/${finished.id}`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Erro ao salvar.')
      setPhase('paused')
    }
  }

  function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setPhotos(prev => [...prev, ...files])
    void hapticMedium()
    success(`Foto adicionada (${photos.length + files.length} no total)`)
  }

  if (petsLoading) return <DashboardLayout><PageLoader /></DashboardLayout>

  // ── UI ────────────────────────────────────────────────

  if (phase === 'choose-pet' || pets.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto">
          <div className="mb-6 pl-12 md:pl-0">
            <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white">Novo passeio</h1>
            <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">
              Selecione qual pet vai passear hoje
            </p>
          </div>

          {pets.length === 0 ? (
            <div className="bg-white dark:bg-surface-800 rounded-2xl p-8 text-center border border-surface-100 dark:border-surface-700">
              <div className="text-5xl mb-3">🐾</div>
              <p className="text-surface-600 dark:text-surface-300 mb-4">Você precisa cadastrar um pet primeiro</p>
              <button
                onClick={() => router.push('/pets/new')}
                className="inline-flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary-600 transition"
              >
                Adicionar pet
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 mb-6">
                {pets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPetId(p.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition text-left ${
                      selectedPetId === p.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40'
                        : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:border-primary-300'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-100 to-accent-100 flex items-center justify-center text-2xl overflow-hidden">
                      {p.photo_url ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" /> : (p.species === 'cat' ? '🐱' : '🐶')}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-surface-900 dark:text-white">{p.name}</div>
                      <div className="text-xs text-surface-500">{p.breed?.name ?? '—'}</div>
                    </div>
                    {selectedPetId === p.id && <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm">✓</div>}
                  </button>
                ))}
              </div>

              <button
                onClick={handleStart}
                disabled={!selectedPetId}
                className="w-full flex items-center justify-center gap-2 bg-primary-500 disabled:bg-surface-200 disabled:text-surface-400 text-white px-6 py-4 rounded-2xl font-semibold text-lg shadow-lg shadow-primary-200 hover:bg-primary-600 transition"
              >
                <Play className="w-6 h-6 fill-current" />
                Começar passeio
              </button>
            </>
          )}
        </div>
      </DashboardLayout>
    )
  }

  // Tracking / paused / saving UI
  return (
    <DashboardLayout>
      <div className="max-w-md mx-auto pl-12 md:pl-0">
        {/* Mapa */}
        <WalkMap
          points={routePoints}
          currentLat={currentPos?.lat}
          currentLng={currentPos?.lng}
          height={300}
          follow={phase === 'tracking'}
        />

        {/* Stats */}
        <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl p-5 border border-surface-100 dark:border-surface-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-surface-900 dark:text-white tabular-nums">
                {formatDistance(distance)}
              </div>
              <div className="text-xs uppercase tracking-wide text-surface-500 mt-1">distância</div>
            </div>
            <div>
              <div className={`text-3xl md:text-4xl font-bold tabular-nums ${phase === 'paused' ? 'text-amber-500' : 'text-surface-900 dark:text-white'}`}>
                {formatDuration(duration)}
              </div>
              <div className="text-xs uppercase tracking-wide text-surface-500 mt-1">
                {phase === 'paused' ? 'pausado' : 'tempo'}
              </div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-surface-900 dark:text-white tabular-nums">
                {distance > 0 && duration > 0 ? formatPace(duration / (distance / 1000)).replace('/km', '') : '—'}
              </div>
              <div className="text-xs uppercase tracking-wide text-surface-500 mt-1">ritmo/km</div>
            </div>
          </div>

          {photos.length > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-700 flex items-center justify-center gap-2 text-sm text-surface-600 dark:text-surface-300">
              <Camera className="w-4 h-4" /> {photos.length} foto{photos.length > 1 ? 's' : ''} adicionada{photos.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={phase === 'saving'}
            className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition"
          >
            <Camera className="w-6 h-6" />
            <span className="text-xs font-medium">Foto</span>
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
              onClick={handlePause}
              className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white transition shadow-lg shadow-amber-200"
            >
              <Pause className="w-6 h-6 fill-current" />
              <span className="text-xs font-semibold">Pausar</span>
            </button>
          ) : (
            <button
              onClick={handleResume}
              disabled={phase === 'saving'}
              className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-primary-500 hover:bg-primary-600 disabled:bg-surface-300 text-white transition shadow-lg shadow-primary-200"
            >
              <Play className="w-6 h-6 fill-current" />
              <span className="text-xs font-semibold">Continuar</span>
            </button>
          )}

          <button
            onClick={handleFinish}
            disabled={phase === 'saving'}
            className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl bg-red-500 hover:bg-red-600 disabled:bg-surface-300 text-white transition shadow-lg shadow-red-200"
          >
            <Square className="w-6 h-6 fill-current" />
            <span className="text-xs font-semibold">{phase === 'saving' ? 'Salvando...' : 'Finalizar'}</span>
          </button>
        </div>

        {/* GPS status */}
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-surface-500">
          <MapPin className={`w-3.5 h-3.5 ${currentPos ? 'text-green-500' : 'text-red-500 animate-pulse'}`} />
          {currentPos ? 'GPS ativo' : 'Aguardando GPS...'}
        </div>
      </div>
    </DashboardLayout>
  )
}
