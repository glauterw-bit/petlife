'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircleHeart, Send } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { support, type SupportMsg } from '@/lib/api'
import { track } from '@/lib/track'
import { hapticSuccess } from '@/lib/feedback'
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
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs.length])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const m = await support.send(body)
      setMsgs(prev => [...prev, m])
      setText('')
      void hapticSuccess()
    } catch {} finally { setSending(false) }
  }

  if (loading) return <DashboardLayout><PageLoader /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100dvh - 180px)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
            <MessageCircleHeart className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-surface-900 dark:text-white">{t('g.sup.title')}</h1>
            <p className="text-xs text-surface-500 dark:text-surface-400">{t('g.sup.subtitle')}</p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pb-4">
          {msgs.length === 0 && (
            <div className="text-center py-12 px-6">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-100 mb-1">{t('g.sup.emptyTitle')}</p>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">{t('g.sup.emptyBody')}</p>
            </div>
          )}
          {msgs.map(m => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                m.sender === 'user'
                  ? 'bg-primary-500 text-white rounded-br-md'
                  : 'bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 text-surface-800 dark:text-surface-100 rounded-bl-md'
              }`}>
                {m.sender === 'admin' && (
                  <div className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 mb-0.5">
                    {t('g.sup.adminName')}
                  </div>
                )}
                {m.body}
                <div className={`text-[10px] mt-1 ${m.sender === 'user' ? 'text-white/70' : 'text-surface-400'}`}>
                  {fmtTime(m.created_at)}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="sticky bottom-0 bg-surface-50/95 dark:bg-surface-900/95 backdrop-blur pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-2 items-end">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              rows={2}
              maxLength={4000}
              placeholder={t('g.sup.placeholder')}
              className="flex-1 px-3.5 py-2.5 rounded-2xl border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              aria-label={t('g.sup.send')}
              className="p-3 rounded-2xl bg-primary-500 text-white hover:bg-primary-600 transition shadow-md shadow-primary-500/30 disabled:opacity-40"
            >
              {sending
                ? <span className="block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[10px] text-center text-surface-400 mt-1.5">{t('g.sup.hint')}</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
