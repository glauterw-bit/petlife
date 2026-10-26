'use client'

/**
 * Momentos — o ritual da foto do dia.
 *
 * POR QUE ISTO E NÃO UMA "REDE SOCIAL":
 * A pesquisa de ~9 mil reviews do nicho não achou UMA menção a feed/comunidade
 * como motivo de retorno — e feed de estranhos com 154 usuários é restaurante
 * vazio (BranchOut: 14M→2M). O que a evidência sustenta é (a) ritual diário
 * leve com streak, (b) artefato bonito compartilhado em PRIVADO — WhatsApp é
 * >90% do compartilhamento direto no Brasil. Então: o feed é dos SEUS pets,
 * o compartilhar sai do app com link rastreado (ct=momentos), e comunidade
 * global fica para quando houver densidade.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Share2, Trash2, Flame, Sparkles, PawPrint, ImagePlus } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { pets as petsApi, innovations, type Pet, type StoryEntry } from '@/lib/api'
import { appStoreUrl } from '@/components/public/DownloadCta'
import { localeTag, cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PetAvatar } from '@/components/ui/PetAvatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import { useConfirm } from '@/components/ui/Confirm'
import { haptic, hapticLight, hapticSelect } from '@/lib/feedback'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { track } from '@/lib/track'
import { trackHappyMoment } from '@/lib/review'
import { celebrateBadge } from '@/lib/feedback'
import { useCached } from '@/lib/cache'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

type Momento = StoryEntry & { pet: Pet }

/** Dias consecutivos com pelo menos 1 momento, contando de hoje (ou ontem). */
function calcStreak(momentos: Momento[]): { dias: number; hojeFeito: boolean } {
  const datas = new Set(momentos.map(m => new Date(m.created_at).toDateString()))
  const hoje = new Date()
  const hojeFeito = datas.has(hoje.toDateString())
  let dias = 0
  const cursor = new Date(hoje)
  if (!hojeFeito) cursor.setDate(cursor.getDate() - 1) // streak "em risco" ainda vale
  while (datas.has(cursor.toDateString())) {
    dias += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return { dias, hojeFeito }
}

function fotoUrl(m: StoryEntry): string {
  const u = m.photo_url || ''
  return u.startsWith('http') ? u : `${API_URL}${u}`
}

export default function MomentosPage() {
  const t = useT()
  const { success, error } = useToast()
  const confirm = useConfirm()
  const [petList, setPetList] = useState<Pet[]>([])
  const [momentos, setMomentos] = useState<Momento[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [petId, setPetId] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [sharingId, setSharingId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Mesma chave do shell: a lista de pets chega na hora.
  const petsQ = useCached<Pet[]>('pets', () => petsApi.list())
  const petsReady = petsQ.data !== undefined || !!petsQ.error
  useEffect(() => { track('momentos_view') }, [])
  useEffect(() => {
    if (!petsReady) return
    async function load() {
      try {
        const ps = petsQ.data ?? []
        setPetList(ps)
        if (ps.length) setPetId(ps[0].id)
        const feeds = await Promise.allSettled(ps.map(p => innovations.listStories(p.id)))
        const all: Momento[] = []
        ps.forEach((p, i) => {
          const r = feeds[i]
          if (r.status === 'fulfilled') r.value.forEach(s => all.push({ ...s, pet: p }))
        })
        all.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        setMomentos(all)
      } finally { setLoading(false) }
    }
    load()
    // recarrega só quando a lista de pets chega/muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petsReady, petsQ.data])

  const { dias, hojeFeito } = useMemo(() => calcStreak(momentos), [momentos])

  function pickFile(f: File | null) {
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  async function publicar() {
    if (!file || !petId || publishing) return
    setPublishing(true)
    try {
      const s = await innovations.addStory(petId, file, caption.trim() || undefined)
      const pet = petList.find(p => p.id === petId)!
      const isFirst = momentos.length === 0
      setMomentos(prev => [{ ...s, pet }, ...prev])
      setSheetOpen(false)
      pickFile(null); setCaption('')
      // Confete só no primeiro momento (marco); os do dia a dia ficam com a vibração.
      if (isFirst) { haptic('milestone'); celebrateBadge() } else haptic('saved')
      trackHappyMoment('momento_publicado')
      success(t('g.mo.published'))
    } catch (e) {
      error(e instanceof Error ? e.message : t('g.misc.errorShort'))
    } finally { setPublishing(false) }
  }

  /** Compartilha a FOTO (nativo → WhatsApp etc.); texto leva o link rastreado. */
  async function compartilhar(m: Momento) {
    setSharingId(m.id)
    try {
      const texto = `${m.user_caption || m.ai_caption || m.pet.name} 🐾\n${appStoreUrl('momentos')}`
      const nav = navigator as Navigator & { canShare?: (d?: { files?: File[] }) => boolean }
      try {
        const blob = await (await fetch(fotoUrl(m))).blob()
        const f = new File([blob], `petlife-${m.pet.name.toLowerCase()}.jpg`, { type: blob.type || 'image/jpeg' })
        if (nav.share && nav.canShare?.({ files: [f] })) {
          await nav.share({ files: [f], text: texto })
          trackHappyMoment('momento_compartilhado')
          return
        }
      } catch { /* cai pro texto */ }
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
      trackHappyMoment('momento_compartilhado')
    } finally { setSharingId(null) }
  }

  async function apagar(id: number) {
    const ok = await confirm({ title: t('g.mo.deleteConfirm'), confirmLabel: t('g.mo.delete'), tone: 'danger' })
    if (!ok) return
    await innovations.deleteStory(id).catch(() => {})
    setMomentos(prev => prev.filter(m => m.id !== id))
  }

  const header = <PageHeader title={t('g.mo.title')} subtitle={t('g.mo.subtitle')} />

  if (loading) {
    return (
      <DashboardLayout>
        {header}
        <div aria-busy="true">
          <Skeleton className="h-[132px] rounded-3xl mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1].map(i => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  function openSheet() {
    void hapticLight()
    setSheetOpen(true)
  }

  return (
    <DashboardLayout>
      {header}

      {/* Hero: foto do dia + sequência */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-700 to-emerald-700 p-5 text-white mb-6 shadow-card">
        <Camera className="absolute -right-5 -top-5 w-36 h-36 opacity-10" aria-hidden strokeWidth={1.5} />
        <div className="relative flex items-center gap-4 flex-wrap">
          {/* Sequência só aparece quando existe: "0 dias seguidos" é cobrança, não informação. */}
          {dias > 0 && (
            <div className="flex items-center gap-2 bg-white/15 rounded-2xl px-4 py-2.5">
              <Flame className="w-6 h-6 text-amber-300" aria-hidden />
              <div>
                <div className="text-2xl font-extrabold leading-none tabular-nums">{dias}</div>
                <div className="text-[11px] text-white/90">{t('g.mo.streakLabel')}</div>
              </div>
            </div>
          )}
          <div className="flex-1 min-w-[180px]">
            <p className="font-bold text-lg leading-snug">
              {hojeFeito ? t('g.mo.doneToday') : dias > 0 ? t('g.mo.keepStreak', { n: dias }) : t('g.mo.startToday')}
            </p>
            <p className="text-white/85 text-sm">{t('g.mo.heroSub')}</p>
          </div>
          {!hojeFeito && petList.length > 0 && (
            <button
              type="button"
              onClick={openSheet}
              className="pressable flex items-center gap-2 min-h-[48px] bg-white text-primary-800 font-bold px-5 rounded-xl shadow-sm"
            >
              <Camera className="w-5 h-5" aria-hidden /> {t('g.mo.cta')}
            </button>
          )}
        </div>
      </div>

      {petList.length === 0 ? (
        <EmptyState icon={PawPrint} title={t('g.mo.noPets')} ctaLabel={t('g.rt.registerPet')} ctaHref="/pets/new" />
      ) : momentos.length === 0 ? (
        // O botão "Foto do dia" já está no topo: aqui só explica, sem repetir a ação.
        <EmptyState
          icon={Camera}
          title={t('g.mo.emptyTitle')}
          text={t('wk2.mo.emptyText')}
        />
      ) : (
        <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {momentos.map(m => (
            <StaggerItem key={m.id}>
              <figure className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/70 dark:border-surface-800 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoUrl(m)} alt={m.user_caption || m.pet.name} className="w-full aspect-square object-cover bg-surface-100 dark:bg-surface-800" loading="lazy" />
                <figcaption className="p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary-50 dark:bg-primary-500/15 text-primary-800 dark:text-primary-200 rounded-full pl-0.5 pr-2.5 py-0.5">
                      <PetAvatar pet={m.pet} size={20} />
                      {m.pet.name}
                    </span>
                    {m.ai_emotion && (
                      <span className="chip chip-warning">
                        <Sparkles className="w-3 h-3" aria-hidden /> {m.ai_emotion}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-surface-500 dark:text-surface-400">
                      {new Date(m.created_at).toLocaleDateString(localeTag(), { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  {(m.user_caption || m.ai_caption) && (
                    <p className="text-sm text-surface-700 dark:text-surface-200 leading-snug">{m.user_caption || m.ai_caption}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="soft"
                      className="flex-1"
                      leftIcon={Share2}
                      loading={sharingId === m.id}
                      onClick={() => compartilhar(m)}
                    >
                      {t('g.mo.share')}
                    </Button>
                    <IconButton
                      icon={Trash2}
                      label={t('g.mo.delete')}
                      onClick={() => apagar(m.id)}
                      className="hover:text-red-700 dark:hover:text-red-300"
                    />
                  </div>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {/* Folha de publicação */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('g.mo.sheetTitle')}
        footer={
          <div>
            <Button fullWidth size="lg" leftIcon={Sparkles} loading={publishing} disabled={!file || publishing} onClick={publicar}>
              {publishing ? t('g.mo.publishing') : t('g.mo.publish')}
            </Button>
            <p className="text-[11px] text-surface-500 dark:text-surface-400 text-center mt-2">{t('g.mo.aiNote')}</p>
          </div>
        }
      >
        {petList.length > 1 && (
          <div role="radiogroup" aria-label={t('wk.mo.whichPet')} className="flex gap-2 flex-wrap mb-3">
            {petList.map(p => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={petId === p.id}
                onClick={() => { void hapticSelect(); setPetId(p.id) }}
                className={cn(
                  'pressable inline-flex items-center gap-2 min-h-[44px] text-sm font-medium rounded-full pl-1.5 pr-4 border transition-colors',
                  petId === p.id
                    ? 'bg-primary-700 text-white border-primary-700 dark:bg-primary-500 dark:text-surface-950 dark:border-primary-500'
                    : 'border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200',
                )}
              >
                <PetAvatar pet={p} size={30} />
                {p.name}
              </button>
            ))}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
               onChange={e => pickFile(e.target.files?.[0] ?? null)} />
        {preview ? (
          <button type="button" onClick={() => fileRef.current?.click()} className="block w-full mb-3" aria-label={t('wk.mo.changePhoto')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="w-full aspect-square object-cover rounded-2xl" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="pressable w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-surface-300 dark:border-surface-700 flex flex-col items-center justify-center gap-2 text-surface-600 dark:text-surface-400 mb-3"
          >
            <ImagePlus className="w-10 h-10" aria-hidden />
            <span className="text-sm font-medium">{t('g.mo.pickPhoto')}</span>
          </button>
        )}

        <label htmlFor="momento-caption" className="block text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5">
          {t('wk.mo.captionLabel')}
        </label>
        <input
          id="momento-caption"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          maxLength={140}
          placeholder={t('g.mo.captionPh')}
          className="w-full min-h-[48px] px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-base bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </Sheet>
    </DashboardLayout>
  )
}
