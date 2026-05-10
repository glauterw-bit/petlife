'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Bot, ChevronDown } from 'lucide-react'
import { ai, type Pet } from '@/lib/api'
import { cn, getSpeciesEmoji } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AIChatWidgetProps {
  pets: Pet[]
}

export function AIChatWidget({ pets }: AIChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Olá! Sou a Vyron IA, sua assistente veterinária virtual. Como posso ajudar com o seu pet hoje? 🐾',
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
        content: 'Desculpe, tive um problema de conexão. Tente novamente em instantes.',
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
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-primary-500 text-white px-4 py-3 rounded-2xl shadow-xl shadow-primary-200 hover:bg-primary-600 transition-all hover:scale-105 animate-pulse-soft"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-semibold">Fale com a Vyron IA</span>
        </button>
      )}

      {/* Chat modal */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-80 sm:w-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-surface-200 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary-500 text-white">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm">Vyron IA</div>
              <div className="text-xs text-primary-100">Assistente veterinária virtual</div>
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
            <div className="px-3 py-2 border-b border-surface-100 relative">
              <button
                onClick={() => setPetDropdown(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-50 hover:bg-surface-100 transition text-sm"
              >
                <span>{getSpeciesEmoji(selectedPet?.species)}</span>
                <span className="text-surface-700 font-medium">
                  {selectedPet?.name ?? 'Selecionar pet'}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-surface-400 ml-auto transition-transform', petDropdown && 'rotate-180')} />
              </button>
              {petDropdown && (
                <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-surface-200 rounded-xl shadow-lg z-10 overflow-hidden">
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
          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '350px' }}>
            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary-600" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white rounded-tr-sm'
                      : 'bg-surface-100 text-surface-800 rounded-tl-sm'
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary-600" />
                </div>
                <div className="bg-surface-100 rounded-2xl rounded-tl-sm px-3 py-2">
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
          <div className="px-3 py-3 border-t border-surface-100 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage() }}
              placeholder="Pergunte algo sobre seu pet..."
              className="flex-1 text-sm px-3 py-2 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-10 h-10 bg-primary-500 text-white rounded-xl flex items-center justify-center hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
