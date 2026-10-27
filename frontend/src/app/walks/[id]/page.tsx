'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { m } from 'framer-motion'
import {
  Share2, Trash2, Smile, Frown, Meh, Heart, Download, Instagram, MessageCircle, Camera, Image as ImageIcon,
  Route, Timer, Gauge, PawPrint, Flame, Check,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PaceChart } from '@/components/walks/PaceChart'
import { track } from '@/lib/track'
import { walks, type Walk } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { haptic, hapticMedium, hapticError, hapticLight, hapticSuccess, hapticSelect } from '@/lib/feedback'
import { formatDistance, formatDuration, generateShareCard as generateRouteCard } from '@/lib/walk-utils'
import { paceClock } from '@/components/walks/pace'
import { generateShareCard, shareCardImage, type CardSpec } from '@/lib/shareCard'
import { trackHappyMoment } from '@/lib/review'
import { useT } from '@/contexts/LocaleContext'
import { localeTag, cn } from '@/lib/utils'
import { invalidate } from '@/lib/cache'
import { variants, spring } from '@/lib/motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState } from '@/components/ui/EmptyState'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { useConfirm } from '@/components/ui/Confirm'

const MapLoading = () => <Skeleton className="w-full h-[220px] rounded-none" />

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
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

type ShareNav = Navigator & { canShare?: (d?: { files?: File[] }) => boolean }

function isAbort(e: unknown) {
  const msg = e instanceof Error ? `${e.name} ${e.message}`.toLowerCase() : ''
  return msg.includes('abort') || msg.includes('cancel')
}

export default function WalkDetailPage() {
  const t = useT()
  const router = useRouter()
  const confirm = useConfirm()
  const params = useParams<{ id: string }>()
  const id = Number(params?.id)
  const { success, error } = useToast()

  const [walk, setWalk] = useState<Walk | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [mood, setMood] = useState<string | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [sharingReport, setSharingReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  const [kudos, setKudos] = useState<{ count: number; mine: boolean }>({ count: 0, mine: false })
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  // Cards pré-gerados: navigator.share precisa ser chamado no MESMO gesto do toque
  // (senão o iOS bloqueia com "erro ao compartilhar"). Geramos ao abrir a tela.
  const [prepared, setPrepared] = useState<{ file: File; blob: Blob; text: string } | null>(null)
  const [preparedReport, setPreparedReport] = useState<File | null>(null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, error])

  const petName = walk?.pet_name ?? t('pw.detail.myPet')
  const started = walk ? new Date(walk.started_at) : null
  const dateStr = started ? started.toLocaleDateString(localeTag(), { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  const timeStr = started ? started.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' }) : ''
  const shortDate = started ? started.toLocaleDateString(localeTag(), { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const savedMood = walk?.mood ?? null
  const moodLabel = savedMood && ['happy', 'normal', 'tired'].includes(savedMood) ? t(`pw.mood.${savedMood}`) : null
  const heroPhoto = walk?.photos?.[0] ?? null

  /** Boletim do passeio: só dados que o passeio já guarda. */
  const reportSpec = useMemo<CardSpec | null>(() => {
    if (!walk) return null
    return {
      title: t('wk.report.cardTitle', { pet: petName }),
      subtitle: shortDate,
      emoji: '🐾',
      petPhotoUrl: heroPhoto ?? walk.pet_photo ?? null,
      stats: [
        { label: t('walk.distance'), value: formatDistance(walk.distance_meters) },
        { label: t('walk.time'), value: formatDuration(walk.duration_seconds) },
        { label: t('walk.pace'), value: paceClock(walk.avg_pace_seconds_per_km) ? t('wk2.pace', { pace: paceClock(walk.avg_pace_seconds_per_km)! }) : '—' },
        { label: t('wk.report.mood'), value: moodLabel ?? '—' },
      ],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk, petName, shortDate, heroPhoto, moodLabel])

  const reportText = walk
    ? t('wk.report.shareText', { pet: petName, distance: formatDistance(walk.distance_meters), duration: formatDuration(walk.duration_seconds) })
    : ''

  // Pré-gera os dois cards assim que o passeio carrega (e se mudar humor/foto).
  useEffect(() => {
    if (!walk || !reportSpec) return
    let cancelled = false
    generateShareCard(reportSpec)
      .then(file => { if (!cancelled) setPreparedReport(file) })
      .catch(() => {})
    buildRouteCard()
      .then(built => { if (!cancelled && built) setPrepared(built) })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportSpec])

  async function toggleKudos() {
    if (!walk) return
    void hapticLight()
    const wasMine = kudos.mine
    const prevCount = kudos.count
    setKudos(k => ({ count: k.count + (wasMine ? -1 : 1), mine: !wasMine }))
    try {
      const res = wasMine ? await walks.removeKudos(walk.id) : await walks.giveKudos(walk.id)
      setKudos({ count: res.kudos_count, mine: res.given })
    } catch (e) {
      setKudos({ count: prevCount, mine: wasMine })
      error(e instanceof Error ? e.message : t('pw.detail.kudosError'))
    }
  }

  async function handleSaveNote() {
    if (!walk) return
    setSavingNote(true)
    try {
      const updated = await walks.update(walk.id, { note, mood: mood ?? undefined })
      setWalk(updated)
      void hapticSuccess()
      invalidate('walks')
      success(t('pw.detail.saved'))
    } catch (e) {
      void hapticError()
      error(e instanceof Error ? e.message : t('pw.detail.saveError'))
    } finally {
      setSavingNote(false)
    }
  }

  async function buildRouteCard(): Promise<{ blob: Blob; file: File; text: string } | null> {
    if (!walk) return null
    const blob = await generateRouteCard({
      petName,
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
      name: petName,
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
      setWalk(updated) // regenera os cards com a foto
      void hapticSuccess()
      invalidate('walks')
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
      invalidate('walks')
    } catch { /* não-crítico */ }
  }

  function reportDone() {
    void hapticSuccess()
    trackHappyMoment('walk_report')
    void markShared()
    setReportSent(true)
    setTimeout(() => setReportSent(false), 2200)
  }

  /** Compartilhar boletim: share síncrono com o card pronto; senão, shareCardImage. */
  function handleShareReport() {
    if (!walk || !reportSpec || sharingReport) return
    void hapticMedium()
    track('walk_report_share')
    const nav = navigator as ShareNav
    if (preparedReport && nav.share && nav.canShare?.({ files: [preparedReport] })) {
      nav.share({ files: [preparedReport], text: reportText })
        .then(reportDone)
        .catch(e => { if (!isAbort(e)) { void hapticError(); error(t('pw.detail.shareOpenError')) } })
      return
    }
    setSharingReport(true)
    shareCardImage(reportSpec, reportText)
      .then(ok => { if (ok) reportDone() })
      .catch(() => { void hapticError(); error(t('pw.detail.shareOpenError')) })
      .finally(() => setSharingReport(false))
  }

  /**
   * Card com o trajeto (formato Stories). navigator.share é chamado de forma
   * síncrona a partir do toque, com o card pré-gerado.
   */
  function runShare(instruction?: string) {
    if (!walk || sharing) return
    void hapticMedium()
    setShareSheetOpen(false)

    // Compartilhar é rotina: vibração de "salvo", sem confete (confete só em marcos).
    const finishOk = () => { void markShared(); haptic('saved'); success(instruction ?? t('pw.detail.shared')) }
    const finishErr = (e: unknown) => {
      if (isAbort(e)) return
      void hapticError()
      error(t('pw.detail.shareOpenError'))
    }
    const nav = navigator as ShareNav

    if (prepared && nav.share && nav.canShare?.({ files: [prepared.file] })) {
      nav.share({ files: [prepared.file], text: prepared.text }).then(finishOk).catch(finishErr)
      return
    }

    setSharing(true)
    buildRouteCard()
      .then(built => {
        if (!built) return
        if (nav.share && nav.canShare?.({ files: [built.file] })) {
          return nav.share({ files: [built.file], text: built.text }).then(finishOk)
        }
        downloadBlob(built.blob, built.file.name)
        success(t('pw.detail.imageSavedIg'))
      })
      .catch(e => {
        if (prepared) downloadBlob(prepared.blob, prepared.file.name)
        finishErr(e)
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
      const built = prepared ?? (await buildRouteCard())
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
    const ok = await confirm({
      title: t('wk.report.deleteTitle'),
      message: t('pw.detail.deleteConfirm'),
      confirmLabel: t('pw.common.delete'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await walks.remove(walk.id)
      invalidate('walks')
      void hapticSuccess()
      success(t('pw.detail.deleted'))
      router.push('/walks')
    } catch (e) {
      void hapticError()
      error(e instanceof Error ? e.message : t('pw.detail.deleteError'))
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto" aria-busy="true">
          <PageHeader title={t('walk.title')} back="/walks" />
          <div className="rounded-3xl overflow-hidden bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800">
            <Skeleton className="h-[220px] w-full rounded-none" />
            <div className="p-5 space-y-4">
              <Skeleton className="h-5 w-1/2 rounded-md" />
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }
  if (!walk) {
    return (
      <DashboardLayout>
        <PageHeader title={t('walk.title')} back="/walks" />
        <EmptyState icon={Route} title={t('pw.detail.notFound')} ctaLabel={t('wk.report.backToWalks')} ctaHref="/walks" />
      </DashboardLayout>
    )
  }

  const dirty = note !== (walk.note ?? '') || mood !== (walk.mood ?? null)
  const hasRoute = (walk.route_points?.length ?? 0) >= 2

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title={t('pw.detail.title', { name: petName })}
          subtitle={`${dateStr} · ${timeStr}`}
          back="/walks"
        />

        {/* ── Boletim do passeio ─────────────────────────── */}
        <m.article
          aria-labelledby="walk-report-title"
          className="rounded-3xl overflow-hidden bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 shadow-card"
          initial="hidden"
          animate="show"
          variants={variants.fadeUp}
          transition={spring.soft}
        >
          {hasRoute ? (
            <WalkMap points={walk.route_points ?? []} height={220} follow={false} bare />
          ) : (
            <div className="h-24 bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center gap-2 text-sm font-medium text-primary-800 dark:text-primary-200">
              <Route className="w-4 h-4" aria-hidden /> {t('wk.report.noRoute')}
            </div>
          )}

          <div className="p-5">
            <div className="flex items-center gap-3">
              {heroPhoto ? (
                <span className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-card bg-surface-100 dark:bg-surface-800">
                  <Image src={heroPhoto} alt={t('wk.report.photoAlt', { pet: petName })} fill sizes="56px" className="object-cover" />
                </span>
              ) : (
                <span className="shrink-0">
                  <PetAvatar pet={{ name: petName, photo_url: walk.pet_photo }} size={56} />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                  {t('wk.report.eyebrow')}
                </p>
                <h2 id="walk-report-title" className="font-display text-lg font-extrabold text-surface-900 dark:text-white leading-tight truncate">
                  {petName}
                </h2>
                <p className="text-xs text-surface-500 dark:text-surface-400">{shortDate} · {timeStr}</p>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2.5">
              <ReportStat icon={Route} label={t('walk.distance')} value={formatDistance(walk.distance_meters)} />
              <ReportStat icon={Timer} label={t('walk.time')} value={formatDuration(walk.duration_seconds)} />
              <ReportStat icon={Gauge} label={t('walk.pace')} value={paceClock(walk.avg_pace_seconds_per_km) ? t('wk2.pace', { pace: paceClock(walk.avg_pace_seconds_per_km)! }) : '—'} />
              <ReportStat icon={PawPrint} label={t('wk.report.mood')} value={moodLabel ?? '—'} />
            </dl>

            {walk.calories_estimated ? (
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-surface-500 dark:text-surface-400">
                <Flame className="w-3.5 h-3.5" aria-hidden />
                {t('wk.report.calories', { n: Math.round(walk.calories_estimated) })}
              </p>
            ) : null}

            {walk.note && (
              <blockquote className="mt-4 rounded-xl bg-surface-50 dark:bg-surface-800/70 border-l-4 border-primary-500 px-3.5 py-2.5 text-sm text-surface-700 dark:text-surface-200 leading-snug">
                {walk.note}
              </blockquote>
            )}

            <Button
              fullWidth
              size="lg"
              className="mt-4"
              leftIcon={reportSent ? Check : Share2}
              loading={sharingReport}
              onClick={handleShareReport}
            >
              {reportSent ? t('wk.report.shared') : t('wk.report.share')}
            </Button>
          </div>
        </m.article>

        {(walk.route_points?.length ?? 0) >= 4 && (
          <div className="mt-4">
            <PaceChart points={walk.route_points ?? []} />
          </div>
        )}

        {/* Foto do momento: vira o herói do boletim e do card */}
        <label
          className={cn(
            'pressable w-full mt-4 min-h-[48px] py-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer transition-colors',
            heroPhoto
              ? 'border-emerald-300 text-emerald-800 bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:bg-emerald-500/10'
              : 'border-primary-300 text-primary-800 hover:bg-primary-50 dark:border-primary-500/40 dark:text-primary-300 dark:hover:bg-primary-500/10',
            uploadingPhoto && 'opacity-60 pointer-events-none',
          )}
        >
          <Camera className="w-4 h-4" aria-hidden />
          {uploadingPhoto
            ? t('pw.detail.uploadingPhoto')
            : heroPhoto ? t('pw.detail.changePhoto') : t('pw.detail.takePhoto')}
          <input type="file" accept="image/*" capture="environment" onChange={handleCapturePhoto} className="sr-only" />
        </label>

        {/* Humor + nota */}
        <Card className="mt-4" padding="lg">
          <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-100 mb-3">{t('pw.detail.moodTitle')}</h3>
          <div role="radiogroup" aria-label={t('pw.detail.moodTitle')} className="flex gap-2 mb-4">
            <MoodButton active={mood === 'happy'} onClick={() => setMood(mood === 'happy' ? null : 'happy')} icon={Smile} label={t('pw.mood.happy')} />
            <MoodButton active={mood === 'normal'} onClick={() => setMood(mood === 'normal' ? null : 'normal')} icon={Meh} label={t('pw.mood.normal')} />
            <MoodButton active={mood === 'tired'} onClick={() => setMood(mood === 'tired' ? null : 'tired')} icon={Frown} label={t('pw.mood.tired')} />
          </div>

          <label htmlFor="walk-note" className="block text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5">
            {t('wk.report.noteLabel')}
          </label>
          <textarea
            id="walk-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('pw.detail.notePlaceholder')}
            rows={3}
            className="w-full p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />

          {dirty && (
            <Button fullWidth className="mt-3" loading={savingNote} onClick={handleSaveNote}>
              {savingNote ? t('pw.common.saving') : t('common.save')}
            </Button>
          )}
        </Card>

        {/* Fotos */}
        {walk.photos && walk.photos.length > 1 && (
          <Card className="mt-4" padding="lg">
            <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-100 mb-3">{t('pw.detail.photosTitle')}</h3>
            <div className="grid grid-cols-3 gap-2">
              {walk.photos.map((photoUrl, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-800">
                  <Image src={photoUrl} alt={t('pw.detail.photoAlt', { n: i + 1 })} width={300} height={300} className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Kudos */}
        <Card className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleKudos}
            aria-pressed={kudos.mine}
            aria-label={kudos.mine ? t('pw.detail.removeKudo') : t('pw.detail.giveKudo')}
            className={cn(
              'pressable w-12 h-12 rounded-full flex items-center justify-center transition-colors shrink-0',
              kudos.mine
                ? 'bg-pink-600 text-white dark:bg-pink-500'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300',
            )}
          >
            <Heart className={cn('w-5 h-5', kudos.mine && 'fill-current')} aria-hidden />
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
        </Card>

        {/* Ações secundárias */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" leftIcon={ImageIcon} loading={sharing} onClick={() => { void hapticLight(); setShareSheetOpen(true) }}>
            {t('wk.report.routeImage')}
          </Button>
          <Button
            variant="secondary"
            leftIcon={Trash2}
            onClick={handleDelete}
            className="text-red-700 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-500/30 dark:hover:bg-red-500/10"
          >
            {t('pw.common.delete')}
          </Button>
        </div>

        {walk.is_shared && (
          <p className="mt-3 text-xs text-center text-primary-700 dark:text-primary-300 flex items-center justify-center gap-1">
            <Share2 className="w-3.5 h-3.5" aria-hidden /> {t('pw.detail.sharedOnSocial')}
          </p>
        )}
      </div>

      <Sheet
        open={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        title={t('pw.detail.shareSheetTitle')}
        description={t('wk.report.routeImageHint')}
      >
        <div className="space-y-2 pb-1">
          <ShareOption icon={Instagram} label={t('pw.detail.igLabel')} description={t('pw.detail.igDesc')} onClick={handleShareInstagram} tone="instagram" />
          <ShareOption icon={MessageCircle} label="WhatsApp" description={t('pw.detail.waDesc')} onClick={handleShareWhatsApp} tone="whatsapp" />
          <ShareOption icon={Share2} label={t('pw.detail.moreLabel')} description={t('pw.detail.moreDesc')} onClick={handleNativeShare} tone="default" />
          <ShareOption icon={Download} label={t('pw.detail.saveImgLabel')} description={t('pw.detail.saveImgDesc')} onClick={handleSaveImage} tone="default" />
        </div>
      </Sheet>
    </DashboardLayout>
  )
}

function ReportStat({ icon: Icon, label, value }: { icon: typeof Route; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-50 dark:bg-surface-800/70 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-surface-600 dark:text-surface-400">
        <Icon className="w-3.5 h-3.5 text-primary-700 dark:text-primary-300" aria-hidden />
        {label}
      </dt>
      <dd className="text-lg font-bold text-surface-900 dark:text-white tabular-nums leading-tight mt-0.5">{value}</dd>
    </div>
  )
}

function ShareOption({
  icon: Icon, label, description, onClick, tone,
}: { icon: typeof Route; label: string; description: string; onClick: () => void; tone: 'instagram' | 'whatsapp' | 'default' }) {
  const toneClass = {
    instagram: 'bg-gradient-to-br from-pink-600 via-fuchsia-600 to-orange-500 text-white',
    whatsapp: 'bg-green-600 text-white',
    default: 'bg-surface-100 dark:bg-surface-800 text-primary-700 dark:text-primary-300',
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable w-full flex items-center gap-3 p-3 min-h-[60px] rounded-2xl border border-surface-200/70 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/60 transition-colors text-left"
    >
      <span className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', toneClass)}>
        <Icon className="w-5 h-5" aria-hidden />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-surface-900 dark:text-white">{label}</div>
        <div className="text-xs text-surface-500 dark:text-surface-400 truncate">{description}</div>
      </div>
    </button>
  )
}

function MoodButton({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: typeof Smile; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => { void hapticSelect(); onClick() }}
      className={cn(
        'pressable flex-1 flex items-center justify-center gap-1.5 min-h-[44px] py-2 rounded-xl border-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary-700 border-primary-700 text-white dark:bg-primary-500 dark:border-primary-500 dark:text-surface-950'
          : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200',
      )}
    >
      <Icon className="w-5 h-5" aria-hidden />
      <span>{label}</span>
    </button>
  )
}
