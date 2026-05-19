'use client'

import { useEffect, useState } from 'react'
import { Camera, Trash2, Loader2, Sparkles } from 'lucide-react'
import { innovations, type StoryEntry } from '@/lib/api'
import { useToast } from '@/components/ui/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8030'

const EMOTION_EMOJI: Record<string, string> = {
  alegre: '😄', curioso: '🤔', sonolento: '😴', travesso: '😈',
  observador: '👀', relaxado: '😌', atento: '👂', brincalhao: '🤸',
}

export function StoriesFeed({ petId, petName }: { petId: number; petName: string }) {
  const { success, error } = useToast()
  const [stories, setStories] = useState<StoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')

  async function load() {
    try { setStories(await innovations.listStories(petId)) }
    catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [petId])

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const s = await innovations.addStory(petId, f, caption || undefined)
      setStories([s, ...stories])
      setCaption('')
      success('Story publicada! IA já criou a legenda 🎉')
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro ao publicar.')
    } finally {
      setUploading(false)
    }
  }

  async function del(id: number) {
    if (!confirm('Apagar esta story?')) return
    try {
      await innovations.deleteStory(id)
      setStories(stories.filter(s => s.id !== id))
      success('Story apagada')
    } catch (e: unknown) {
      error(e instanceof Error ? e.message : 'Erro.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-4">
        <input
          type="text"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Sua legenda (opcional — IA gera uma)"
          className="w-full p-2.5 mb-2 text-sm border border-surface-200 dark:border-surface-700 dark:bg-surface-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <label className="block">
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={upload} disabled={uploading} />
          <div className="flex items-center justify-center gap-2 border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl py-3 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 transition">
            {uploading ? <Loader2 className="w-5 h-5 text-primary-500 animate-spin" /> : <Camera className="w-5 h-5 text-primary-500" />}
            <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
              {uploading ? 'Publicando…' : `Publicar foto de ${petName}`}
            </span>
          </div>
        </label>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-surface-400" /></div>
      ) : stories.length === 0 ? (
        <div className="text-center py-12 bg-surface-50 dark:bg-surface-800/50 rounded-2xl">
          <Camera className="w-10 h-10 text-surface-300 mx-auto mb-2" />
          <p className="text-sm text-surface-500 dark:text-surface-400">Nenhuma story ainda. Publique a primeira!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {stories.map(s => (
            <div key={s.id} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 overflow-hidden group">
              <div className="relative aspect-square">
                <img
                  src={`${API_URL}${s.photo_url}`}
                  alt={s.user_caption ?? s.ai_caption ?? ''}
                  className="w-full h-full object-cover"
                />
                {s.ai_emotion && (
                  <span className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    {EMOTION_EMOJI[s.ai_emotion] || '🐾'} {s.ai_emotion}
                  </span>
                )}
                <button
                  onClick={() => del(s.id)}
                  aria-label="Apagar"
                  className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3">
                {s.user_caption && <p className="text-sm font-medium text-surface-900 dark:text-white mb-1">{s.user_caption}</p>}
                {s.ai_caption && (
                  <p className="text-xs text-surface-500 dark:text-surface-400 italic flex items-start gap-1">
                    <Sparkles className="w-3 h-3 shrink-0 mt-0.5 text-primary-500" />
                    <span>{s.ai_caption}</span>
                  </p>
                )}
                <p className="text-[10px] text-surface-400 mt-1">{new Date(s.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
