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
import { Camera, Share2, Trash2, Flame, Sparkles, X, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { pets as petsApi, innovations, type Pet, type StoryEntry } from '@/lib/api'
import { appStoreUrl } from '@/components/public/DownloadCta'
import { getSpeciesEmoji, localeTag } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastContext'
import { useT } from '@/contexts/LocaleContext'
import { track } from '@/lib/track'
import { trackHappyMoment } from '@/lib/review'
import { celebrateBadge } from '@/lib/feedback'

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

  useEffect(() => {
    track('momentos_view')
    async function load() {
      try {
        const ps = await petsApi.list()
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
  }, [])

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
      setMomentos(prev => [{ ...s, pet }, ...prev])
      setSheetOpen(false)
      pickFile(null); setCaption('')
      celebrateBadge()
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
    if (!confirm(t('g.mo.deleteConfirm'))) return
    await innovations.deleteStory(id).catch(() => {})
    setMomentos(prev => prev.filter(m => m.id !== id))
  }

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="mb-5 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight">{t('g.mo.title')}</h1>
        <p className="text-sm md:text-base text-surface-500 dark:text-surface-400 mt-1">{t('g.mo.subtitle')}</p>
      </div>

      {/* Hero: foto do dia + streak */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-500 to-emerald-500 p-6 text-white mb-6">
        <div className="absolute -right-4 -top-6 text-[110px] opacity-10 select-none" aria-hidden>📸</div>
        <div className="relative flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5">
            <Flame className={`w-6 h-6 ${dias > 0 ? 'text-amber-300' : 'text-white/50'}`} />
            <div>
              <div className="text-2xl font-extrabold leading-none tabular-nums">{dias}</div>
              <div className="text-[11px] text-white/80">{t('g.mo.streakLabel')}</div>
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <p className="font-bold text-lg leading-snug">
              {hojeFeito ? t('g.mo.doneToday') : dias > 0 ? t('g.mo.keepStreak', { n: dias }) : t('g.mo.startToday')}
            </p>
            <p className="text-white/80 text-sm">{t('g.mo.heroSub')}</p>
          </div>
          {!hojeFeito && petList.length > 0 && (
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-2 bg-white text-primary-700 font-bold px-5 py-3 rounded-2xl shadow-lg hover:scale-[1.02] transition"
            >
              <Camera className="w-5 h-5" /> {t('g.mo.cta')}
            </button>
          )}
        </div>
      </div>

      {petList.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
          <div className="text-5xl mb-3">🐾</div>
          <p className="text-surface-600 dark:text-surface-300 mb-3">{t('g.mo.noPets')}</p>
          <a href="/pets/new" className="text-primary-600 font-semibold hover:underline">{t('g.rt.registerPet')}</a>
        </div>
      ) : momentos.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700">
          <div className="text-5xl mb-3">✨</div>
          <p className="text-surface-700 dark:text-surface-200 font-medium mb-1">{t('g.mo.emptyTitle')}</p>
          <p className="text-sm text-surface-500 dark:text-surface-400">{t('g.mo.emptyText')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {momentos.map(m => (
            <figure key={m.id} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 overflow-hidden group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoUrl(m)} alt={m.user_caption || m.pet.name} className="w-full aspect-square object-cover" loading="lazy" />
              <figcaption className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-xs font-semibold bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full px-2.5 py-0.5">
                    {getSpeciesEmoji(m.pet.species)} {m.pet.name}
                  </span>
                  {m.ai_emotion && (
                    <span className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full px-2.5 py-0.5">
                      <Sparkles className="w-3 h-3 inline -mt-0.5" /> {m.ai_emotion}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-surface-400">
                    {new Date(m.created_at).toLocaleDateString(localeTag(), { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                {(m.user_caption || m.ai_caption) && (
                  <p className="text-sm text-surface-700 dark:text-surface-200 leading-snug">{m.user_caption || m.ai_caption}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => compartilhar(m)}
                    disabled={sharingId === m.id}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold py-2 rounded-xl transition disabled:opacity-60"
                  >
                    {sharingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                    {t('g.mo.share')}
                  </button>
                  <button
                    onClick={() => apagar(m.id)}
                    aria-label={t('g.mo.delete')}
                    className="tap-target text-surface-400 hover:text-red-500 transition flex items-center justify-center rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* Sheet de publicação */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
          <div className="relative bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-surface-900 dark:text-white">{t('g.mo.sheetTitle')}</h2>
              <button onClick={() => setSheetOpen(false)} aria-label={t('common.close')} className="tap-target text-surface-400 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>

            {petList.length > 1 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {petList.map(p => (
                  <button key={p.id} onClick={() => setPetId(p.id)}
                    className={`text-sm font-medium rounded-full px-3.5 py-1.5 border transition ${petId === p.id ? 'bg-primary-500 text-white border-primary-500' : 'border-surface-200 dark:border-surface-600 text-surface-600 dark:text-surface-300'}`}>
                    {getSpeciesEmoji(p.species)} {p.name}
                  </button>
                ))}
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                   onChange={e => pickFile(e.target.files?.[0] ?? null)} />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="w-full aspect-square object-cover rounded-2xl mb-3" onClick={() => fileRef.current?.click()} />
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full aspect-square rounded-2xl border-2 border-dashed border-surface-300 dark:border-surface-600 flex flex-col items-center justify-center gap-2 text-surface-400 mb-3">
                <Camera className="w-10 h-10" />
                <span className="text-sm font-medium">{t('g.mo.pickPhoto')}</span>
              </button>
            )}

            <input value={caption} onChange={e => setCaption(e.target.value)} maxLength={140}
              placeholder={t('g.mo.captionPh')}
              className="w-full px-4 py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-sm mb-3 bg-transparent text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500" />

            <button onClick={publicar} disabled={!file || publishing}
              className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 rounded-2xl transition disabled:opacity-50">
              {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {publishing ? t('g.mo.publishing') : t('g.mo.publish')}
            </button>
            <p className="text-[11px] text-surface-400 text-center mt-2">{t('g.mo.aiNote')}</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
