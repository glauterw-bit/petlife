'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircleHeart, Send, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { spring, usePrefersReducedMotion } from '@/lib/motion'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { support, type SupportMsg } from '@/lib/api'
import { track } from '@/lib/track'
import { hapticSuccess, hapticError } from '@/lib/feedback'
import { useT } from '@/contexts/LocaleContext'

/**
 * Fale com o suporte — conversa direta com o time (o Glauter) dentro do app.
 * Poll leve enquanto a tela está aberta; resposta do admin também chega
 * por e-mail, então ninguém fica esperando de olho na tela.
 */

const POLL_MS = 15000

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function SuportePage() {
  const t = useT()
  const [msgs, setMsgs] = useState<SupportMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const [failed, setFailed] = useState(false)

  async function load() {
    try { setMsgs(await support.list()) } catch {} finally { setLoading(false) }
  }

  useEffect(() => {
    track('support_open')
    load()
    const iv = setInterval(load, POLL_MS)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' })
  }, [msgs.length, reduced])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setFailed(false)
    try {
      const m = await support.send(body)
      setMsgs(prev => [...prev, m])
      setText('')
      void hapticSuccess()
    } catch {
      // mantém o texto no campo para tentar de novo
      void hapticError()
      setFailed(true)
    } finally { setSending(false) }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100dvh - 6rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))' }}>
        <PageHeader title={t('g.sup.title')} subtitle={t('g.sup.subtitle')} />

        <div className="flex-1 space-y-3 pb-4" role="log" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <div className="space-y-3" aria-hidden>
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : msgs.length === 0 ? (
            <EmptyState icon={MessageCircleHeart} title={t('g.sup.emptyTitle')} text={t('g.sup.emptyBody')} />
          ) : null}
          {msgs.map(m => {
            const mine = m.sender === 'user'
            return (
              <motion.div
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={spring.snappy}
              >
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[15px] leading-snug whitespace-pre-wrap break-words ${
                  mine
                    ? 'bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950 rounded-br-md'
                    : 'bg-white dark:bg-surface-900 border border-surface-200/70 dark:border-surface-800 text-surface-800 dark:text-surface-100 rounded-bl-md'
                }`}>
                  {m.sender === 'admin' && (
                    <div className="text-[11px] font-semibold text-primary-700 dark:text-primary-300 mb-0.5">
                      {t('g.sup.adminName')}
                    </div>
                  )}
                  {m.sender === 'assistant' && (
                    <div className="text-[11px] font-semibold text-primary-700 dark:text-primary-300 mb-0.5">
                      {t('g.sup.botName')}
                    </div>
                  )}
                  {m.body}
                  <div className={`text-[11px] mt-1 ${mine ? 'text-white/80 dark:text-surface-950/70' : 'text-surface-500 dark:text-surface-400'}`}>
                    {fmtTime(m.created_at)}
                  </div>
                </div>
              </motion.div>
            )
          })}
          <div ref={endRef} />
        </div>

        <div className="sticky bottom-nav md:bottom-0 -mx-4 px-4 md:mx-0 md:px-0 bg-surface-50/95 dark:bg-surface-950/95 backdrop-blur pt-2 pb-2 md:pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {failed && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300 mb-1.5">{t('acct.sup.sendFailed')}</p>
          )}
          <div className="flex gap-2 items-end">
            <label htmlFor="support-text" className="sr-only">{t('g.sup.placeholder')}</label>
            <textarea
              id="support-text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              rows={2}
              maxLength={4000}
              placeholder={t('g.sup.placeholder')}
              className="flex-1 px-3.5 py-2.5 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-[15px] text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || sending}
              aria-label={t('g.sup.send')}
              className="pressable w-12 h-12 shrink-0 inline-flex items-center justify-center rounded-2xl bg-primary-700 text-white hover:bg-primary-800 dark:bg-primary-500 dark:text-surface-950 dark:hover:bg-primary-400 transition-colors disabled:opacity-40"
            >
              {sending
                ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
                : <Send className="w-5 h-5" aria-hidden />}
            </button>
          </div>
          <p className="text-[11px] text-center text-surface-500 dark:text-surface-400 mt-1.5">{t('g.sup.hint')}</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
