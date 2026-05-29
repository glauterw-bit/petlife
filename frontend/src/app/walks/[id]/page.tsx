'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { ArrowLeft, Share2, Trash2, Smile, Frown, Meh, Trophy, Heart, Download, Instagram, MessageCircle, X } from 'lucide-react'
import { Share } from '@capacitor/share'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { walks, type Walk } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'
import { celebrate, hapticMedium, hapticError, hapticLight } from '@/lib/feedback'
import { formatDistance, formatDuration, formatPace, generateShareCard } from '@/lib/walk-utils'
import { PageLoader } from '@/components/ui/LoadingSpinner'

const WalkMap = dynamic(() => import('@/components/walks/WalkMap'), { ssr: false })

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function WalkDetailPage() {
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
      .catch(e => error(e instanceof Error ? e.message : 'Erro ao carregar passeio.'))
      .finally(() => setLoading(false))
  }, [id, error])

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
      error(e instanceof Error ? e.message : 'Erro ao curtir.')
    }
  }

  async function handleSaveNote() {
    if (!walk) return
    setSavingNote(true)
    try {
      const updated = await walks.update(walk.id, { note, mood: mood ?? undefined })
      setWalk(updated)
      success('Salvo!')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSavingNote(false)
    }
  }

  async function buildShareCard(): Promise<{ blob: Blob; file: File; text: string } | null> {
    if (!walk) return null
    const blob = await generateShareCard({
      petName: walk.pet_name ?? 'meu pet',
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
    const text = `Passeio com ${walk.pet_name ?? 'meu pet'} 🐾\n${formatDistance(walk.distance_meters)} em ${formatDuration(walk.duration_seconds)}\n\nfeito no @petlife.app`
    return { blob, file, text }
  }

  async function markShared() {
    if (!walk) return
    try {
      const updated = await walks.update(walk.id, { is_shared: true })
      setWalk(updated)
    } catch { /* não-crítico */ }
  }

  async function handleNativeShare() {
    if (!walk) return
    setSharing(true)
    setShareSheetOpen(false)
    void hapticMedium()
    try {
      const built = await buildShareCard()
      if (!built) return
      const { blob, file, text } = built
      const canCapacitor = await Share.canShare().then(r => r.value).catch(() => false)
      if (canCapacitor) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.onerror = reject
          r.readAsDataURL(blob)
        })
        await Share.share({ title: 'Passeio PetLife', text, url: dataUrl, dialogTitle: 'Compartilhar passeio' })
      } else if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Passeio PetLife', text, files: [file] })
      } else {
        downloadBlob(blob, file.name)
      }
      await markShared()
      celebrate('medium')
      success('Compartilhado!')
    } catch (e) {
      void hapticError()
      const msg = e instanceof Error ? e.message : ''
      if (!msg.toLowerCase().includes('abort') && !msg.toLowerCase().includes('cancel')) {
        error('Erro ao compartilhar.')
      }
    } finally {
      setSharing(false)
    }
  }

  async function handleShareWhatsApp() {
    if (!walk) return
    setSharing(true)
    setShareSheetOpen(false)
    void hapticMedium()
    try {
      const built = await buildShareCard()
      if (!built) return
      const { blob, file, text } = built
      // iOS/Android: tenta share nativo com arquivo (Whatsapp aparece no sheet)
      const canCapacitor = await Share.canShare().then(r => r.value).catch(() => false)
      if (canCapacitor || (navigator.share && navigator.canShare?.({ files: [file] }))) {
        if (canCapacitor) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader()
            r.onload = () => resolve(r.result as string)
            r.onerror = reject
            r.readAsDataURL(blob)
          })
          await Share.share({ text, url: dataUrl, dialogTitle: 'Compartilhar no WhatsApp' })
        } else {
          await navigator.share({ text, files: [file] })
        }
      } else {
        // Web: baixa imagem + abre wa.me com texto (sem imagem, limitação do WhatsApp Web)
        downloadBlob(blob, file.name)
        const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
        window.open(waUrl, '_blank')
      }
      await markShared()
      success('Compartilhado no WhatsApp!')
    } catch (e) {
      void hapticError()
      const msg = e instanceof Error ? e.message : ''
      if (!msg.toLowerCase().includes('abort') && !msg.toLowerCase().includes('cancel')) {
        error('Erro ao compartilhar.')
      }
    } finally {
      setSharing(false)
    }
  }

  async function handleShareInstagram() {
    if (!walk) return
    setSharing(true)
    setShareSheetOpen(false)
    void hapticMedium()
    try {
      const built = await buildShareCard()
      if (!built) return
      const { blob, file } = built
      // Mobile: share nativo (Instagram aparece como opção)
      const canCapacitor = await Share.canShare().then(r => r.value).catch(() => false)
      if (canCapacitor) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.onerror = reject
          r.readAsDataURL(blob)
        })
        await Share.share({ url: dataUrl, dialogTitle: 'Stories no Instagram' })
        success('Selecione Instagram no menu de compartilhamento!')
      } else if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        success('Selecione Instagram no menu de compartilhamento!')
      } else {
        // Web: baixa imagem e instrui usuário
        downloadBlob(blob, file.name)
        success('Imagem baixada — abra o Instagram pra postar nos Stories!')
      }
      await markShared()
    } catch (e) {
      void hapticError()
      const msg = e instanceof Error ? e.message : ''
      if (!msg.toLowerCase().includes('abort') && !msg.toLowerCase().includes('cancel')) {
        error('Erro ao compartilhar.')
      }
    } finally {
      setSharing(false)
    }
  }

  async function handleSaveImage() {
    if (!walk) return
    setSharing(true)
    setShareSheetOpen(false)
    void hapticLight()
    try {
      const built = await buildShareCard()
      if (!built) return
      downloadBlob(built.blob, built.file.name)
      success('Imagem salva!')
    } catch {
      void hapticError()
      error('Erro ao salvar imagem.')
    } finally {
      setSharing(false)
    }
  }

  async function handleDelete() {
    if (!walk) return
    if (!confirm('Apagar este passeio? Esta ação não pode ser desfeita.')) return
    try {
      await walks.remove(walk.id)
      success('Passeio apagado.')
      router.push('/walks')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Erro ao apagar.')
    }
  }

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>
  if (!walk) {
    return (
      <DashboardLayout>
        <p className="text-center text-surface-500 mt-12">Passeio não encontrado.</p>
      </DashboardLayout>
    )
  }

  const date = new Date(walk.started_at)
  const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 pl-12 md:pl-0">
          <button onClick={() => router.back()} aria-label="Voltar" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition tap-target flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-surface-900 dark:text-white leading-tight truncate">
              Passeio com {walk.pet_name ?? 'pet'}
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

        {/* Big stats */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard label="Distância" value={formatDistance(walk.distance_meters)} />
          <StatCard label="Tempo" value={formatDuration(walk.duration_seconds)} />
          <StatCard label="Ritmo" value={formatPace(walk.avg_pace_seconds_per_km)} />
          <StatCard label="Calorias" value={walk.calories_estimated ? `${Math.round(walk.calories_estimated)} kcal` : '—'} />
        </div>

        {/* Mood + note */}
        <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl p-5 border border-surface-100 dark:border-surface-700">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3">Como o pet ficou?</h3>
          <div className="flex gap-2 mb-4">
            <MoodButton value="happy" active={mood === 'happy'} onClick={() => setMood(mood === 'happy' ? null : 'happy')} icon={<Smile className="w-5 h-5" />} label="Feliz" color="green" />
            <MoodButton value="normal" active={mood === 'normal'} onClick={() => setMood(mood === 'normal' ? null : 'normal')} icon={<Meh className="w-5 h-5" />} label="Normal" color="blue" />
            <MoodButton value="tired" active={mood === 'tired'} onClick={() => setMood(mood === 'tired' ? null : 'tired')} icon={<Frown className="w-5 h-5" />} label="Cansado" color="amber" />
          </div>

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Anote como foi o passeio…"
            rows={3}
            className="w-full p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:border-primary-400 resize-none"
          />

          {(note !== (walk.note ?? '') || mood !== (walk.mood ?? null)) && (
            <button
              onClick={handleSaveNote}
              disabled={savingNote}
              className="mt-3 w-full bg-primary-500 hover:bg-primary-600 disabled:bg-surface-300 text-white py-2.5 rounded-xl font-medium transition"
            >
              {savingNote ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>

        {/* Photos */}
        {walk.photos && walk.photos.length > 0 && (
          <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl p-5 border border-surface-100 dark:border-surface-700">
            <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200 mb-3">Fotos do passeio</h3>
            <div className="grid grid-cols-3 gap-2">
              {walk.photos.map((photoUrl, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-900">
                  <Image src={photoUrl} alt={`Foto ${i + 1}`} width={300} height={300} className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kudos */}
        <div className="mt-4 flex items-center gap-3 bg-white dark:bg-surface-800 rounded-2xl p-4 border border-surface-100 dark:border-surface-700">
          <button
            onClick={toggleKudos}
            aria-label={kudos.mine ? 'Remover kudo' : 'Dar kudo'}
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
              {kudos.count === 0 ? 'Seja o primeiro a curtir' : `${kudos.count} kudo${kudos.count > 1 ? 's' : ''}`}
            </div>
            <div className="text-xs text-surface-500 dark:text-surface-400">
              {kudos.mine ? 'Você curtiu este passeio' : 'Toque no coração pra reagir'}
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
            {sharing ? 'Preparando...' : 'Compartilhar'}
          </button>
          <button
            onClick={handleDelete}
            className="tap-target flex items-center justify-center gap-2 bg-white dark:bg-surface-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 py-3.5 rounded-2xl font-semibold transition"
          >
            <Trash2 className="w-5 h-5" />
            Apagar
          </button>
        </div>

        {walk.is_shared && (
          <div className="mt-3 text-xs text-center text-primary-600 dark:text-primary-400 flex items-center justify-center gap-1">
            <Trophy className="w-3.5 h-3.5" /> Compartilhado nas redes
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
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">Compartilhar passeio</h3>
                <button
                  onClick={() => setShareSheetOpen(false)}
                  aria-label="Fechar"
                  className="tap-target rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <ShareOption
                  icon={<Instagram className="w-5 h-5" />}
                  label="Stories no Instagram"
                  description="Card 1080×1920 pronto"
                  onClick={handleShareInstagram}
                  color="instagram"
                />
                <ShareOption
                  icon={<MessageCircle className="w-5 h-5" />}
                  label="WhatsApp"
                  description="Manda pra família e amigos"
                  onClick={handleShareWhatsApp}
                  color="whatsapp"
                />
                <ShareOption
                  icon={<Share2 className="w-5 h-5" />}
                  label="Mais opções"
                  description="Sistema nativo (todos os apps)"
                  onClick={handleNativeShare}
                  color="default"
                />
                <ShareOption
                  icon={<Download className="w-5 h-5" />}
                  label="Salvar imagem"
                  description="Baixa no rolo de câmera"
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
      <div className="text-xs uppercase tracking-wide text-surface-500 mb-1">{label}</div>
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
