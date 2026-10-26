'use client'

import { useEffect, useState } from 'react'
import { MessageCircleHeart, Send, PartyPopper, Star } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SuccessCheck } from '@/components/ui/SuccessCheck'
import { feedback as feedbackApi } from '@/lib/api'
import { hapticLight, hapticSuccess } from '@/lib/feedback'
import { openReviewPage, requestNativeReview, lastReviewAskAt } from '@/lib/review'
import { track } from '@/lib/track'
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
const SOURCE = 'popup_2026_09_b'
const DISMISS_KEY = `petlife_feedback_${SOURCE}_dismissed`
const DELAY_MS = 4000
const MIN_ACCOUNT_AGE_DAYS = 7

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
  // nota 4-5 → convite pra levar a nota pra loja (só quem está feliz)
  const [askStore, setAskStore] = useState(false)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>

    async function maybeOpen() {
      try {
        if (localStorage.getItem(DISMISS_KEY)) return
        // Conta recém-criada ainda não tem opinião: pedir nota no primeiro
        // minuto só gasta o pedido (a jornada no painel mostrou isso).
        // Quem acabou de receber as estrelas da Apple não precisa de outro pedido
        if (Date.now() - lastReviewAskAt() < 14 * 86400000) return
        const u = JSON.parse(localStorage.getItem('petlife_user') || 'null') as { created_at?: string } | null
        if (u?.created_at) {
          const iso = /Z|[+-]\d\d:?\d\d$/.test(u.created_at) ? u.created_at : u.created_at + 'Z'
          if (Date.now() - new Date(iso).getTime() < MIN_ACCOUNT_AGE_DAYS * 86400000) return
        }
      } catch { /* sem storage: segue pelo servidor */ }
      try {
        const { answered } = await feedbackApi.status(SOURCE)
        if (answered || !alive) return
        timer = setTimeout(() => {
          // O anúncio de novidade tem prioridade — nunca dois modais na sessão.
          try { if (sessionStorage.getItem('petlife_announce_active')) return } catch {}
          if (alive) { setOpen(true); track('rate_prompt_shown') }
        }, DELAY_MS)
      } catch { /* offline/erro: não incomoda */ }
    }
    maybeOpen()

    // Reabertura forçada (ex.: botão "dar feedback" do anúncio de novidade) —
    // vale até pra quem já respondeu ou dispensou.
    function forceOpen() {
      setDone(false)
      setAskStore(false)
      setOpen(true)
      track('rate_prompt_shown')
    }
    window.addEventListener('petlife:open-feedback', forceOpen)

    return () => {
      alive = false
      clearTimeout(timer)
      window.removeEventListener('petlife:open-feedback', forceOpen)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    track('rate_prompt_later')
    setOpen(false)
  }

  function goToStore() {
    track('rate_prompt_store')
    openReviewPage()
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
      if ((rating ?? 0) >= 4) {
        // feliz → estrelas nativas da Apple (dentro do app) + cartão com o
        // link de escrever comentário; infeliz → só agradece
        setAskStore(true)
        setTimeout(() => {
          void requestNativeReview().then(ok => { if (ok) track('rate_prompt_native') })
        }, 700)
      } else {
        setTimeout(() => setOpen(false), 2600)
      }
    } catch {
      // falhou: fecha sem travar o usuário (pode responder depois)
      dismiss()
    } finally {
      setSending(false)
    }
  }

  const canSend = !!rating || !!likes.trim() || !!suggestion.trim()
  const textareaCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-950 text-[15px] text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none'

  return (
    <Modal open={open} onClose={done ? () => setOpen(false) : dismiss} size="md">
      {done && askStore ? (
        <div className="py-4 text-center">
          <div className="w-20 h-20 mx-auto bg-amber-50 dark:bg-amber-500/15 rounded-3xl flex items-center justify-center mb-4">
            <Star className="w-10 h-10 text-amber-500 fill-amber-400" aria-hidden />
          </div>
          <h2 className="font-display text-xl font-extrabold text-surface-900 dark:text-white mb-2">{t('fb.storeTitle')}</h2>
          <p className="text-[15px] text-surface-600 dark:text-surface-300 leading-relaxed mb-6">{t('fb.storeBody')}</p>
          <Button size="lg" fullWidth leftIcon={Star} onClick={goToStore}>
            {t('fb.storeCta')}
          </Button>
          <Button variant="ghost" fullWidth className="mt-2" onClick={() => setOpen(false)}>
            {t('fb.storeLater')}
          </Button>
        </div>
      ) : done ? (
        <div className="py-6 text-center" role="status">
          <div className="flex justify-center mb-4">
            <SuccessCheck size={72} />
          </div>
          <h2 className="font-display text-xl font-extrabold text-surface-900 dark:text-white mb-2 inline-flex items-center gap-2">
            {t('fb.thanksTitle')}
            <PartyPopper className="w-5 h-5 text-primary-700 dark:text-primary-300" aria-hidden />
          </h2>
          <p className="text-[15px] text-surface-600 dark:text-surface-300 leading-relaxed">{t('fb.thanksBody')}</p>
        </div>
      ) : (
        <>
          <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6 bg-gradient-to-br from-primary-100 to-accent-50 dark:from-primary-500/15 dark:to-surface-900 px-7 pb-7 pt-10 text-center">
            <div className="w-16 h-16 mx-auto bg-white dark:bg-surface-800 rounded-3xl shadow-card flex items-center justify-center mb-3">
              <MessageCircleHeart className="w-8 h-8 text-primary-700 dark:text-primary-300" aria-hidden />
            </div>
            <h2 className="font-display text-xl font-extrabold text-surface-900 dark:text-white mb-1.5">{t('fb.title')}</h2>
            <p className="text-[15px] text-surface-700 dark:text-surface-300 leading-relaxed">{t('fb.subtitle')}</p>
          </div>

          <div className="pt-5 space-y-5">
            {/* nota por carinha (o emoji é conteúdo, o rótulo vai em texto) */}
            <fieldset>
              <legend className="block text-sm font-semibold text-surface-800 dark:text-surface-100 mb-2.5">{t('fb.rating')}</legend>
              <div className="flex items-center justify-between gap-1.5">
                {FACES.map(f => {
                  const active = rating === f.v
                  return (
                    <button
                      key={f.v}
                      type="button"
                      onClick={() => { setRating(f.v); void hapticLight() }}
                      aria-pressed={active}
                      className={`pressable flex-1 min-h-[64px] flex flex-col items-center justify-center gap-1 py-2 rounded-2xl border transition-[background-color,border-color,transform] duration-150 ${
                        active
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/15 scale-105'
                          : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                      }`}
                    >
                      <span className="text-2xl leading-none" aria-hidden>{f.emoji}</span>
                      <span className={`text-[11px] font-medium ${active ? 'text-primary-800 dark:text-primary-200' : 'text-surface-600 dark:text-surface-400'}`}>
                        {t(f.labelKey)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="fb-likes" className="block text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5">
                {t('fb.likes')} <span className="font-normal text-surface-500 dark:text-surface-400">({t('common.optional')})</span>
              </label>
              <textarea
                id="fb-likes"
                value={likes}
                onChange={e => setLikes(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder={t('fb.likesPlaceholder')}
                className={textareaCls}
              />
            </div>

            <div>
              <label htmlFor="fb-suggestion" className="block text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1.5">
                {t('fb.suggestion')}
              </label>
              <textarea
                id="fb-suggestion"
                value={suggestion}
                onChange={e => setSuggestion(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={t('fb.suggestionPlaceholder')}
                className={textareaCls}
              />
            </div>

            <label htmlFor="fb-contact" className="flex items-start gap-2.5 cursor-pointer min-h-[44px]">
              <input
                id="fb-contact"
                type="checkbox"
                checked={canContact}
                onChange={e => setCanContact(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded accent-primary-700 dark:accent-primary-500 shrink-0"
              />
              <span className="text-[13px] text-surface-700 dark:text-surface-300 leading-snug">{t('fb.canContact')}</span>
            </label>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" size="lg" onClick={dismiss}>
                {t('fb.later')}
              </Button>
              <Button size="lg" className="flex-1" onClick={submit} disabled={!canSend} loading={sending} leftIcon={Send}>
                {sending ? t('fb.sending') : t('fb.send')}
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
