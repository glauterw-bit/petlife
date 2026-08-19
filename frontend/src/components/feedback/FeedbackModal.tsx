'use client'

import { useEffect, useState } from 'react'
import { MessageCircleHeart, X, Send, PartyPopper } from 'lucide-react'
import { feedback as feedbackApi } from '@/lib/api'
import { hapticLight, hapticSuccess } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'

/**
 * Pesquisa de satisfação — aparece UMA vez por usuário.
 *
 * Dupla trava pra não incomodar: o servidor sabe quem já respondeu
 * (fonte da verdade, vale em qualquer aparelho) e o localStorage evita
 * reabrir pra quem dispensou. Aparece alguns segundos depois de abrir o
 * app, nunca em cima de uma ação do usuário.
 */

// Bump da versão = a pesquisa volta a aparecer pra todo mundo (o servidor
// checa "já respondeu?" por origem, então uma origem nova reabre o convite).
const SOURCE = 'popup_2026_08_v2'
const DISMISS_KEY = `petlife_feedback_${SOURCE}_dismissed`
const DELAY_MS = 4000

const FACES = [
  { v: 1, emoji: '😞', labelKey: 'fb.face1' },
  { v: 2, emoji: '😕', labelKey: 'fb.face2' },
  { v: 3, emoji: '🙂', labelKey: 'fb.face3' },
  { v: 4, emoji: '😃', labelKey: 'fb.face4' },
  { v: 5, emoji: '🤩', labelKey: 'fb.face5' },
]

export function FeedbackModal() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [likes, setLikes] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [canContact, setCanContact] = useState(true)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>

    async function maybeOpen() {
      try {
        if (localStorage.getItem(DISMISS_KEY)) return
      } catch { /* sem storage: segue pelo servidor */ }
      try {
        const { answered } = await feedbackApi.status(SOURCE)
        if (answered || !alive) return
        timer = setTimeout(() => { if (alive) setOpen(true) }, DELAY_MS)
      } catch { /* offline/erro: não incomoda */ }
    }
    maybeOpen()

    return () => { alive = false; clearTimeout(timer) }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setOpen(false)
  }

  async function submit() {
    if (sending) return
    if (!rating && !likes.trim() && !suggestion.trim()) return
    setSending(true)
    try {
      await feedbackApi.send({
        rating: rating ?? undefined,
        likes_most: likes.trim() || undefined,
        suggestion: suggestion.trim() || undefined,
        can_contact: canContact,
        source: SOURCE,
      })
      try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
      void hapticSuccess()
      setDone(true)
      setTimeout(() => setOpen(false), 2600)
    } catch {
      // falhou: fecha sem travar o usuário (pode responder depois)
      dismiss()
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  const canSend = !!rating || !!likes.trim() || !!suggestion.trim()

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="relative bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto animate-slide-up shadow-2xl pb-[env(safe-area-inset-bottom)]">
        {done ? (
          <div className="p-8 text-center">
            <div className="w-20 h-20 mx-auto bg-primary-50 dark:bg-primary-900/30 rounded-3xl flex items-center justify-center mb-4">
              <PartyPopper className="w-10 h-10 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="font-display text-xl font-bold text-surface-900 dark:text-white mb-2">
              {t('fb.thanksTitle')}
            </h2>
            <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
              {t('fb.thanksBody')}
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={dismiss}
              aria-label={t('common.close')}
              className="absolute right-3 top-3 p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700 transition z-10"
            >
              <X className="w-4 h-4 text-surface-500 dark:text-surface-400" />
            </button>

            <div className="bg-gradient-to-br from-primary-100 to-accent-50 dark:from-primary-900/30 dark:to-accent-900/20 p-7 pt-10 text-center">
              <div className="w-16 h-16 mx-auto bg-white dark:bg-surface-700 rounded-3xl shadow-lg flex items-center justify-center mb-3">
                <MessageCircleHeart className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h2 className="font-display text-xl font-bold text-surface-900 dark:text-white mb-1.5">
                {t('fb.title')}
              </h2>
              <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
                {t('fb.subtitle')}
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* nota por carinha */}
              <div>
                <label className="block text-sm font-semibold text-surface-800 dark:text-surface-100 mb-2.5">
                  {t('fb.rating')}
                </label>
                <div className="flex items-center justify-between gap-1.5">
                  {FACES.map(f => {
                    const active = rating === f.v
                    return (
                      <button
                        key={f.v}
                        onClick={() => { setRating(f.v); void hapticLight() }}
                        aria-label={t(f.labelKey)}
                        aria-pressed={active}
                        className={`pressable flex-1 flex flex-col items-center gap-1 py-2.5 rounded-2xl border transition ${
                          active
                            ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 scale-105'
                            : 'border-surface-200 dark:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700/50'
                        }`}
                      >
                        <span className="text-2xl leading-none">{f.emoji}</span>
                        <span className={`text-[10px] font-medium ${active ? 'text-primary-700 dark:text-primary-300' : 'text-surface-500 dark:text-surface-400'}`}>
                          {t(f.labelKey)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5">
                  {t('fb.likes')} <span className="font-normal text-surface-400">({t('common.optional')})</span>
                </label>
                <textarea
                  value={likes}
                  onChange={e => setLikes(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder={t('fb.likesPlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5">
                  {t('fb.suggestion')}
                </label>
                <textarea
                  value={suggestion}
                  onChange={e => setSuggestion(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder={t('fb.suggestionPlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canContact}
                  onChange={e => setCanContact(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-primary-500 shrink-0"
                />
                <span className="text-xs text-surface-600 dark:text-surface-300 leading-snug">
                  {t('fb.canContact')}
                </span>
              </label>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={dismiss}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-300 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 transition"
                >
                  {t('fb.later')}
                </button>
                <button
                  onClick={submit}
                  disabled={!canSend || sending}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 transition shadow-md shadow-primary-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {sending ? t('fb.sending') : t('fb.send')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
