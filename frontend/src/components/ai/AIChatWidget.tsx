'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, ChevronDown } from 'lucide-react'
import { VyronAvatar } from './VyronAvatar'
import { ai, type Pet } from '@/lib/api'
import { cn, getSpeciesEmoji } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  /**
   * Mensagens nossas (boas-vindas, erro) guardam a chave em vez do texto:
   * assim acompanham a troca de idioma em vez de congelar no idioma inicial.
   */
  contentKey?: string
  timestamp: Date
}

interface AIChatWidgetProps {
  pets: Pet[]
}

export function AIChatWidget({ pets }: AIChatWidgetProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: '',
      contentKey: 'v.ai.welcome',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedPetId, setSelectedPetId] = useState<number | undefined>(pets[0]?.id)
  const [petDropdown, setPetDropdown] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [messages, open])

  useEffect(() => {
    if (pets.length > 0 && !selectedPetId) {
      setSelectedPetId(pets[0].id)
    }
  }, [pets, selectedPetId])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await ai.chat(text, selectedPetId)
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.response,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        contentKey: 'v.ai.error',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  const selectedPet = pets.find(p => p.id === selectedPetId)

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t('v.ai.openChat')}
          style={{ right: 'max(1rem, env(safe-area-inset-right))' }}
          className="pressable fixed bottom-nav md:bottom-6 z-40 flex items-center gap-2 bg-white dark:bg-surface-800 border-2 border-primary-400 text-primary-700 dark:text-primary-300 pl-1.5 pr-4 py-1.5 tap-target rounded-full shadow-xl shadow-primary-300/40 transition-all hover:scale-105"
        >
          <VyronAvatar size={40} state="idle" />
          <span className="text-sm font-bold">Vyron</span>
        </button>
      )}

      {/* Chat modal */}
      {open && (
        <div
          className="fixed bottom-nav md:bottom-6 right-2 left-2 md:right-6 md:left-auto z-40 w-auto md:w-96 max-h-[min(80dvh,640px)] flex flex-col bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 overflow-hidden animate-slide-up"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary-500 text-white">
            <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-inner">
              <VyronAvatar size={38} state={loading ? 'thinking' : 'idle'} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm">Vyron</div>
              <div className="text-xs text-primary-100">{loading ? t('v.ai.thinking') : t('v.ai.status')}</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Pet selector */}
          {pets.length > 0 && (
            <div className="px-3 py-2 border-b border-surface-100 dark:border-surface-700 relative">
              <button
                onClick={() => setPetDropdown(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-50 dark:bg-surface-900/60 hover:bg-surface-100 transition text-sm"
              >
                <span>{getSpeciesEmoji(selectedPet?.species)}</span>
                <span className="text-surface-700 dark:text-surface-200 font-medium">
                  {selectedPet?.name ?? t('v.side.selectPet')}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-surface-400 ml-auto transition-transform', petDropdown && 'rotate-180')} />
              </button>
              {petDropdown && (
                <div className="absolute left-3 right-3 top-full mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg z-10 overflow-hidden">
                  {pets.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPetId(p.id); setPetDropdown(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary-50 text-sm text-left"
                    >
                      <span>{getSpeciesEmoji(p.species)}</span>
                      <span>{p.name}</span>
                      {p.id === selectedPetId && <span className="ml-auto text-primary-600">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                    <VyronAvatar size={26} state="idle" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white rounded-tr-sm'
                      : 'bg-surface-100 dark:bg-surface-700 text-surface-800 dark:text-surface-100 rounded-tl-sm'
                  )}
                >
                  {msg.contentKey ? t(msg.contentKey) : msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                  <VyronAvatar size={26} state="thinking" />
                </div>
                <div className="bg-surface-100 dark:bg-surface-700 rounded-2xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-surface-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-surface-100 dark:border-surface-700 flex gap-2 shrink-0 pb-keyboard">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage() }}
              onFocus={() => {
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 250)
              }}
              placeholder={t('v.ai.placeholder')}
              className="flex-1 text-base px-3 py-2 border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              inputMode="text"
              enterKeyHint="send"
            />
            <button
              onClick={sendMessage}
              aria-label={t('v.ai.send')}
              disabled={!input.trim() || loading}
              className="tap-target bg-primary-500 text-white rounded-xl flex items-center justify-center hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition px-3"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
