'use client'

import { useState } from 'react'
import { X, BookOpen, Sparkles, RefreshCw, Volume2 } from 'lucide-react'
import { innovations } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

interface BedtimeStoryModalProps {
  petId: number
  petName: string
  open: boolean
  onClose: () => void
}

const MOODS = [
  { value: 'carinhoso', labelKey: 'g.bs.mood.carinhoso', descKey: 'g.bs.mood.carinhosoDesc' },
  { value: 'aventura', labelKey: 'g.bs.mood.aventura', descKey: 'g.bs.mood.aventuraDesc' },
  { value: 'engraçado', labelKey: 'g.bs.mood.engracado', descKey: 'g.bs.mood.engracadoDesc' },
  { value: 'calmo', labelKey: 'g.bs.mood.calmo', descKey: 'g.bs.mood.calmoDesc' },
] as const

export function BedtimeStoryModal({ petId, petName, open, onClose }: BedtimeStoryModalProps) {
  const t = useT()
  const [mood, setMood] = useState<typeof MOODS[number]['value']>('carinhoso')
  const [loading, setLoading] = useState(false)
  const [story, setStory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)

  async function generate() {
    setLoading(true)
    setError(null)
    setStory(null)
    try {
      const res = await innovations.bedtimeStory(petId, mood)
      setStory(res.story)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('g.bs.errGenerate'))
    } finally {
      setLoading(false)
    }
  }

  function speak() {
    if (!story || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const u = new SpeechSynthesisUtterance(story)
    u.lang = 'pt-BR'
    u.rate = 0.9
    u.pitch = 1.0
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
    setSpeaking(true)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={() => { window.speechSynthesis?.cancel(); onClose() }}
    >
      <div
        className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200/50 dark:border-surface-700 sticky top-0 bg-white/70 dark:bg-surface-800/70 backdrop-blur">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            <h2 className="font-bold text-surface-900 dark:text-white">{t('g.bs.title', { name: petName })}</h2>
          </div>
          <button
            onClick={() => { window.speechSynthesis?.cancel(); onClose() }}
            aria-label={t('common.close')}
            className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!story && (
            <>
              <p className="text-sm text-surface-600 dark:text-surface-300">
                {t('g.bs.desc', { name: petName })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMood(m.value)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition',
                      mood === m.value
                        ? 'border-indigo-500 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200'
                        : 'border-surface-200 dark:border-surface-700 hover:border-indigo-300',
                    )}
                  >
                    <p className="font-semibold text-sm">{t(m.labelKey)}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{t(m.descKey)}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={generate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-indigo-500/30 disabled:opacity-60"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                {loading ? t('g.bs.writing') : t('g.bs.create')}
              </button>
              {error && (
                <div className="text-sm text-red-700 bg-red-50 dark:bg-red-900/30 rounded-xl p-3">{error}</div>
              )}
            </>
          )}

          {story && (
            <>
              <div className="bg-white dark:bg-surface-800 rounded-2xl p-5 shadow-sm">
                {story.split('\n').filter(Boolean).map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-surface-800 dark:text-surface-100 mb-3 last:mb-0">
                    {p}
                  </p>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={speak}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition',
                    speaking
                      ? 'bg-rose-500 hover:bg-rose-600 text-white'
                      : 'bg-indigo-500 hover:bg-indigo-600 text-white',
                  )}
                >
                  <Volume2 className="w-4 h-4" />
                  {speaking ? t('g.bs.stopReading') : t('g.bs.readAloud')}
                </button>
                <button
                  onClick={() => { setStory(null); window.speechSynthesis?.cancel(); setSpeaking(false) }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-200"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('g.bs.another')}
                </button>
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400 text-center">
                {t('g.bs.goodnight', { name: petName })}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
