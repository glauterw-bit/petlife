'use client'

import { useEffect, useState } from 'react'
import { localeTag } from '@/lib/utils'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { ArrowLeft, Share2, Trash2, Smile, Frown, Meh, Trophy, Heart, Download, Instagram, MessageCircle, X, Camera } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PaceChart } from '@/components/walks/PaceChart'
import { track } from '@/lib/track'
import { walks, type Walk } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { celebrate, hapticMedium, hapticError, hapticLight } from '@/lib/feedback'
import { formatDistance, formatDuration, formatPace, generateShareCard } from '@/lib/walk-utils'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useT } from '@/contexts/LocaleContext'

const MapLoading = () => {
  const t = useT()
  return (
    <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 animate-pulse flex items-center justify-center" style={{ height: 320 }}>
      <span className="text-sm text-surface-400">{t('pw.map.loading')}</span>
    </div>
  )
}

const WalkMap = dynamic(() => import('@/components/walks/WalkMap'), {
  ssr: false,
  loading: () => <MapLoading />,
})

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function WalkDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = Number(params?.id)
  const { success, error } = useToast()

  const [walk, setWalk] = useState<Walk | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [mood, setMood] = useState<string | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [kudos, setKudos] = useState<{ count: number; mine: boolean }>({ count: 0, mine: false })
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  // Card pré-gerado: navigator.share precisa ser chamado no MESMO gesto do toque
  // (senão o iOS bloqueia com "erro ao compartilhar"). Geramos ao abrir a tela.
  const [prepared, setPrepared] = useState<{ file: File; blob: Blob; text: string } | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      walks.getById(id),
      walks.listKudos(id).catch(() => null),
    ])
      .then(([w, k]) => {
        setWalk(w)
        setNote(w.note ?? '')
        setMood(w.mood ?? null)
        if (k) setKudos({ count: k.kudos_count, mine: k.given_by_me })
      })
      .catch(e => error(e instanceof Error ? e.message : t('pw.detail.loadError')))
      .finally(() => setLoading(false))
  }, [id, error])

  // Pré-gera o card assim que o passeio carrega (e regenera se mudar humor/nota),
  // pra que o compartilhamento seja instantâneo e preserve o gesto do usuário.
  useEffect(() => {
    if (!walk) return
    let cancelled = false
    buildShareCard().then(built => {
      if (!cancelled && built) setPrepared(built)
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk?.id, walk?.mood])

  async function toggleKudos() {
    if (!walk) return
    void hapticLight()
    const wasMine = kudos.mine
    setKudos(k => ({ count: k.count + (wasMine ? -1 : 1), mine: !wasMine }))
    try {
      const res = wasMine ? await walks.removeKudos(walk.id) : await walks.giveKudos(walk.id)
      setKudos({ count: res.kudos_count, mine: res.given })
      if (!wasMine) celebrate('small')
    } catch (e) {
      setKudos({ count: kudos.count, mine: wasMine })
      error(e instanceof Error ? e.message : t('pw.detail.kudosError'))
    }
  }

  async function handleSaveNote() {
    if (!walk) return
    setSavingNote(true)
    try {
      const updated = await walks.update(walk.id, { note, mood: mood ?? undefined })
      setWalk(updated)
      success(t('pw.detail.saved'))
    } catch (e) {
      error(e instanceof Error ? e.message : t('pw.detail.saveError'))
    } finally {
      setSavingNote(false)
    }
  }

  async function buildShareCard(): Promise<{ blob: Blob; file: File; text: string } | null> {
    if (!walk) return null
    const blob = await generateShareCard({
      petName: walk.pet_name ?? t('pw.detail.myPet'),
      petPhotoUrl: walk.pet_photo,
      distanceMeters: walk.distance_meters,
      durationSeconds: walk.duration_seconds,
      pace: walk.avg_pace_seconds_per_km,
      caloriesEstimated: walk.calories_estimated,
      mood: walk.mood,
      routePoints: walk.route_points ?? [],
      photos: walk.photos ?? [],
    })
    const file = new File([blob], `petlife-passeio-${walk.id}.png`, { type: 'image/png' })
    const text = t('pw.detail.shareText', {
      name: walk.pet_name ?? t('pw.detail.myPet'),
      distance: formatDistance(walk.distance_meters),
      duration: formatDuration(walk.duration_seconds),
    })
    return { blob, file, text }
  }

  async function handleCapturePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite recapturar a mesma foto
    if (!file || !walk) return
    setUploadingPhoto(true)
    void hapticLight()
    try {
      const updated = await walks.uploadPhoto(walk.id, file)
      setWalk(updated) // dispara o useEffect que regenera o card com a foto
      celebrate('small')
      success(t('pw.detail.photoAdded'))
    } catch (err) {
      void hapticError()
      error(err instanceof Error ? err.message : t('pw.detail.photoError'))
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function markShared() {
    if (!walk) return
    try {
      const updated = await walks.update(walk.id, { is_shared: true })
      setWalk(updated)
    } catch { /* não-crítico */ }
  }

  /**
   * Compartilha JÁ, no gesto do toque. navigator.share precisa ser chamado
   * de forma síncrona a partir do clique — por isso usamos o card pré-gerado
   * (`prepared`) e NÃO colocamos await antes de nav.share. Se o card ainda não
   * estiver pronto, gera na hora (pode pedir um segundo toque no iOS).
   */
  function runShare(instruction?: string) {
    if (!walk || sharing) return
    void hapticMedium()
    setShareSheetOpen(false)

    const finishOk = () => { void markShared(); celebrate('medium'); success(instruction ?? t('pw.detail.shared')) }
    const finishErr = (e: unknown) => {
      const msg = e instanceof Error ? e.message.toLowerCase() : ''
      if (msg.includes('abort') || msg.includes('cancel')) return
      void hapticError()
      error(t('pw.detail.shareOpenError'))
    }
    const nav = navigator as Navigator & { canShare?: (d?: { files?: File[] }) => boolean }

    // Caminho ideal: card pronto → share síncrono (gesto preservado).
    if (prepared && nav.share && nav.canShare?.({ files: [prepared.file] })) {
      nav.share({ files: [prepared.file], text: prepared.text }).then(finishOk).catch(finishErr)
      return
    }

    // Card ainda não pronto (ou sem Web Share de arquivos): gera e baixa a imagem.
    setSharing(true)
    buildShareCard()
      .then(built => {
        if (!built) return
        if (nav.share && nav.canShare?.({ files: [built.file] })) {
          // pode falhar por gesto expirado; se falhar, cai no catch e baixa
          return nav.share({ files: [built.file], text: built.text }).then(finishOk)
        }
        downloadBlob(built.blob, built.file.name)
        success(t('pw.detail.imageSavedIg'))
      })
      .catch(built => {
        // gesto expirou no fallback: garante que o usuário tem a imagem
        if (prepared) downloadBlob(prepared.blob, prepared.file.name)
        finishErr(built)
      })
      .finally(() => setSharing(false))
  }

  const handleNativeShare = () => runShare()
  const handleShareWhatsApp = () => runShare(t('pw.detail.pickWhatsApp'))
  const handleShareInstagram = () => runShare(t('pw.detail.pickInstagram'))

  async function handleSaveImage() {
    if (!walk) return
    setSharing(true)
    setShareSheetOpen(false)
    void hapticLight()
    try {
      const built = await buildShareCard()
      if (!built) return
      downloadBlob(built.blob, built.file.name)
      success(t('pw.detail.imageSaved'))
    } catch {
      void hapticError()
      error(t('pw.detail.imageSaveError'))
    } finally {
      setSharing(false)
    }
  }

  async function handleDelete() {
    if (!walk) return
    if (!confirm(t('pw.detail.deleteConfirm'))) return
    try {
      await walks.remove(walk.id)
      success(t('pw.detail.deleted'))
      router.push('/walks')
    } catch (e) {
      error(e instanceof Error ? e.message : t('pw.detail.deleteError'))
    }
  }

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>
  if (!walk) {
    return (
      <DashboardLayout>
        <p className="text-center text-surface-500 dark:text-surface-400 mt-12">{t('pw.detail.notFound')}</p>
      </DashboardLayout>
    )
  }

  const date = new Date(walk.started_at)
  const dateStr = date.toLocaleDateString(localeTag(), { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = date.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 ">
          <button onClick={() => router.back()} aria-label={t('nav.back')} className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition tap-target flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-surface-900 dark:text-white leading-tight truncate">
              {t('pw.detail.title', { name: walk.pet_name ?? t('pw.detail.myPet') })}
            </h1>
            <p className="text-xs md:text-sm text-surface-500 dark:text-surface-400">
              {dateStr} · {timeStr}
            </p>
          </div>
        </div>

        {/* Map */}
        <WalkMap
          points={walk.route_points ?? []}
          height={320}
          follow={false}
        />

        {(walk.route_points?.length ?? 0) >= 4 && <PaceChart points={walk.route_points ?? []} />}

      {/* Foto do momento — vira o herói do card (estilo Strava) */}
      <label
        className={`pressable w-full mt-3 py-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer transition ${
          (walk.photos?.length ?? 0) > 0
            ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30'
            : 'border-primary-300 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/30'
        } ${uploadingPhoto ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <Camera className="w-4 h-4" />
        {uploadingPhoto
          ? t('pw.detail.uploadingPhoto')
          : (walk.photos?.length ?? 0) > 0 ? t('pw.detail.changePhoto') : t('pw.detail.takePhoto')}
        <input type="file" accept="image/*" capture="environment" onChange={handleCapturePhoto} className="hidden" />
      </label>

      <button
        onClick={() => { track('recap_share'); void handleNativeShare() }}
        disabled={sharing}
        className="pressable w-full mt-3 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-semibold text-sm"
      >
        {sharing ? t('pw.detail.preparingCard') : `📸 ${t('walk.share')}`}
      </button>

        {/* Big stats */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard label={t('walk.distance')} value={formatDistance(walk.distance_meters)} />
          <StatCard label={t('walk.time')} value={formatDuration(walk.duration_seconds)} />
          <StatCard label={t('walk.pace')} value={formatPace(walk.avg_pace_seconds_per_km)} />
          <StatCard label={t('walk.calories')} value={walk.calories_estimated ? `${Math.round(walk.calories_estimated)} kcal` : '—'} />
        </div>

        {/* Mood + note */}
        <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl p-5 border border-surface-100 dark:border-surface-700">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3">{t('pw.detail.moodTitle')}</h3>
          <div className="flex gap-2 mb-4">
            <MoodButton value="happy" active={mood === 'happy'} onClick={() => setMood(mood === 'happy' ? null : 'happy')} icon={<Smile className="w-5 h-5" />} label={t('pw.mood.happy')} color="green" />
            <MoodButton value="normal" active={mood === 'normal'} onClick={() => setMood(mood === 'normal' ? null : 'normal')} icon={<Meh className="w-5 h-5" />} label={t('pw.mood.normal')} color="blue" />
            <MoodButton value="tired" active={mood === 'tired'} onClick={() => setMood(mood === 'tired' ? null : 'tired')} icon={<Frown className="w-5 h-5" />} label={t('pw.mood.tired')} color="amber" />
          </div>

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('pw.detail.notePlaceholder')}
            rows={3}
            className="w-full p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:border-primary-400 resize-none"
          />

          {(note !== (walk.note ?? '') || mood !== (walk.mood ?? null)) && (
            <button
              onClick={handleSaveNote}
              disabled={savingNote}
              className="mt-3 w-full bg-primary-500 hover:bg-primary-600 disabled:bg-surface-300 text-white py-2.5 rounded-xl font-medium transition"
            >
              {savingNote ? t('pw.common.saving') : t('common.save')}
            </button>
          )}
        </div>

        {/* Photos */}
        {walk.photos && walk.photos.length > 0 && (
          <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl p-5 border border-surface-100 dark:border-surface-700">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3">{t('pw.detail.photosTitle')}</h3>
            <div className="grid grid-cols-3 gap-2">
              {walk.photos.map((photoUrl, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-900">
                  <Image src={photoUrl} alt={t('pw.detail.photoAlt', { n: i + 1 })} width={300} height={300} className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kudos */}
        <div className="mt-4 flex items-center gap-3 bg-white dark:bg-surface-800 rounded-2xl p-4 border border-surface-100 dark:border-surface-700">
          <button
            onClick={toggleKudos}
            aria-label={kudos.mine ? t('pw.detail.removeKudo') : t('pw.detail.giveKudo')}
            className={`tap-target w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-90 ${
              kudos.mine
                ? 'bg-pink-500 text-white shadow-lg shadow-pink-200 dark:shadow-pink-900/40'
                : 'bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-300'
            }`}
          >
            <Heart className={`w-5 h-5 ${kudos.mine ? 'fill-current' : ''}`} />
          </button>
          <div className="flex-1">
            <div className="text-sm font-semibold text-surface-900 dark:text-white">
              {kudos.count === 0
                ? t('pw.detail.beFirstKudo')
                : kudos.count > 1
                  ? t('pw.detail.kudosMany', { count: kudos.count })
                  : t('pw.detail.kudosOne', { count: kudos.count })}
            </div>
            <div className="text-xs text-surface-500 dark:text-surface-400">
              {kudos.mine ? t('pw.detail.youLiked') : t('pw.detail.tapHeart')}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => setShareSheetOpen(true)}
            disabled={sharing}
            className="tap-target flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-surface-300 text-white py-3.5 rounded-2xl font-semibold transition shadow-lg shadow-primary-200"
          >
            <Share2 className="w-5 h-5" />
            {sharing ? t('pw.detail.preparing') : t('pw.common.share')}
          </button>
          <button
            onClick={handleDelete}
            className="tap-target flex items-center justify-center gap-2 bg-white dark:bg-surface-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 py-3.5 rounded-2xl font-semibold transition"
          >
            <Trash2 className="w-5 h-5" />
            {t('pw.common.delete')}
          </button>
        </div>

        {walk.is_shared && (
          <div className="mt-3 text-xs text-center text-primary-600 dark:text-primary-400 flex items-center justify-center gap-1">
            <Trophy className="w-3.5 h-3.5" /> {t('pw.detail.sharedOnSocial')}
          </div>
        )}

        {/* Share sheet */}
        {shareSheetOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setShareSheetOpen(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-sm bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-slide-up shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">{t('pw.detail.shareSheetTitle')}</h3>
                <button
                  onClick={() => setShareSheetOpen(false)}
                  aria-label={t('common.close')}
                  className="tap-target rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <ShareOption
                  icon={<Instagram className="w-5 h-5" />}
                  label={t('pw.detail.igLabel')}
                  description={t('pw.detail.igDesc')}
                  onClick={handleShareInstagram}
                  color="instagram"
                />
                <ShareOption
                  icon={<MessageCircle className="w-5 h-5" />}
                  label="WhatsApp"
                  description={t('pw.detail.waDesc')}
                  onClick={handleShareWhatsApp}
                  color="whatsapp"
                />
                <ShareOption
                  icon={<Share2 className="w-5 h-5" />}
                  label={t('pw.detail.moreLabel')}
                  description={t('pw.detail.moreDesc')}
                  onClick={handleNativeShare}
                  color="default"
                />
                <ShareOption
                  icon={<Download className="w-5 h-5" />}
                  label={t('pw.detail.saveImgLabel')}
                  description={t('pw.detail.saveImgDesc')}
                  onClick={handleSaveImage}
                  color="default"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

function ShareOption({
  icon, label, description, onClick, color,
}: { icon: React.ReactNode; label: string; description: string; onClick: () => void; color: 'instagram' | 'whatsapp' | 'default' }) {
  const colorClass = {
    instagram: 'bg-gradient-to-br from-pink-500 via-fuchsia-500 to-orange-400 text-white',
    whatsapp: 'bg-green-500 text-white',
    default: 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200',
  }[color]
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl border border-surface-100 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700/40 transition tap-target text-left"
    >
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-surface-900 dark:text-white">{label}</div>
        <div className="text-xs text-surface-500 dark:text-surface-400 truncate">{description}</div>
      </div>
    </button>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl p-4 border border-surface-100 dark:border-surface-700">
      <div className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400 mb-1">{label}</div>
      <div className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white tabular-nums">{value}</div>
    </div>
  )
}

function MoodButton({
  active, onClick, icon, label, color,
}: { value: string; active: boolean; onClick: () => void; icon: React.ReactNode; label: string; color: string }) {
  const colorClass = {
    green: active ? 'bg-green-500 text-white border-green-500' : 'bg-white dark:bg-surface-800 text-green-600 dark:text-green-400 border-surface-200 dark:border-surface-700',
    blue: active ? 'bg-blue-500 text-white border-blue-500' : 'bg-white dark:bg-surface-800 text-blue-600 dark:text-blue-400 border-surface-200 dark:border-surface-700',
    amber: active ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-surface-800 text-amber-600 dark:text-amber-400 border-surface-200 dark:border-surface-700',
  }[color] ?? ''
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-medium transition ${colorClass}`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  )
}
