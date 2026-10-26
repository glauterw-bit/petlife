'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X, Send, ChevronDown, Check, Dog, Cat, PawPrint } from 'lucide-react'
import { VyronAvatar } from './VyronAvatar'
import { ai, billing, type Pet } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LocaleContext'
import { haptic } from '@/lib/feedback'
import { spring, dur, easeOut, useScrollDirection } from '@/lib/motion'

/**
 * Regra do lançador: nada do Vyron fica parado por cima do conteúdo. O botão
 * sai da frente ao rolar para baixo, e qualquer balão/dica que venha a ser
 * mostrado junto dele some sozinho em no máximo BUBBLE_MAX_MS.
 */
export const BUBBLE_MAX_MS = 6000

/** Telas onde o botão do Vyron atrapalha (formulários longos, passeio ativo, suporte humano). */
const HIDDEN_ROUTES = ['/suporte', '/pets/new', '/walks/active', '/settings', '/plans']

function SpeciesIcon({ species, className }: { species?: string; className?: string }) {
  const Icon = species === 'dog' ? Dog : species === 'cat' ? Cat : PawPrint
  return <Icon className={className} aria-hidden />
}

/** Teclado virtual aberto (a viewport visual encolhe bem mais que a barra do Safari). */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setOpen(vv.height < window.innerHeight - 150)
    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])
  return open
}

interface Message {
  upsell?: boolean
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

const UPSELL_KEY = 'petlife_vyron_upsell_at'
const UPSELL_COOLDOWN_DIAS = 7
const UPSELL_APOS_RESPOSTAS = 3

interface AIChatWidgetProps {
  pets: Pet[]
  /** Alguma tela pediu para esconder o botão (useHideAssistant). */
  hidden?: boolean
}

export function AIChatWidget({ pets, hidden = false }: AIChatWidgetProps) {
  const t = useT()
  const pathname = usePathname() ?? ''
  const keyboardOpen = useKeyboardOpen()
  const tucked = useScrollDirection() === 'down'
  const reduced = useReducedMotion()
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
  // Oferta no momento de valor: o paywall só aparecia como punição (402), e o
  // dado provou que ninguém chega perto do limite — 1 pessoa em 154 usou 7 de
  // 10 mensagens no mês. Quem gosta da Vyron precisa OUVIR a oferta.
  const respostasRef = useRef(0)
  const usageRef = useRef<{ tier: string; restam: number } | null>(null)

  useEffect(() => {
    if (!open || usageRef.current) return
    billing.me().then(me => {
      const u = me?.usage
      if (u) usageRef.current = { tier: u.tier, restam: Math.max(0, (u.limits.ai_chat ?? 0) - (u.used.ai_chat ?? 0)) }
    }).catch(() => {})
  }, [open])

  function talvezOferecer() {
    const info = usageRef.current
    if (!info || info.tier !== 'free') return
    respostasRef.current += 1
    if (respostasRef.current !== UPSELL_APOS_RESPOSTAS) return
    try {
      const ultima = Number(localStorage.getItem(UPSELL_KEY) || 0)
      if (Date.now() - ultima < UPSELL_COOLDOWN_DIAS * 864e5) return
      localStorage.setItem(UPSELL_KEY, String(Date.now()))
    } catch {}
    setMessages(prev => [...prev, {
      id: `up-${Date.now()}`,
      role: 'assistant',
      content: '',
      upsell: true,
      timestamp: new Date(),
    }])
  }

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
      talvezOferecer()
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

  // fecha o chat ao trocar de tela (ex.: tocou em "ver planos" dentro dele)
  useEffect(() => { setOpen(false); setPetDropdown(false) }, [pathname])

  const selectedPet = pets.find(p => p.id === selectedPetId)
  const routeHidden = HIDDEN_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  const showButton = !open && !hidden && !routeHidden && !keyboardOpen

  return (
    <>
      {/* Botão flutuante: só o Vyron, 52 px */}
      <AnimatePresence>
        {showButton && (
          // Contêiner fixo: posição e o "sumir ao rolar" em CSS (.vyron-launcher,
          // sempre 8 px acima da cápsula). O botão dentro só anima entrada/saída.
          <div
            key="vyron-fab"
            className="vyron-launcher fixed z-40 origin-bottom-right"
            data-hidden={tucked ? 'true' : 'false'}
            aria-hidden={tucked || undefined}
            style={{ right: 'max(1rem, env(safe-area-inset-right))' }}
          >
            <motion.button
              type="button"
              onClick={() => { haptic('tap'); setOpen(true) }}
              aria-label={t('shell.assistant')}
              // Rolando para baixo: sai da frente (sem foco/toque enquanto escondido).
              tabIndex={tucked ? -1 : undefined}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.6, transition: { duration: dur.fast } }}
              whileTap={reduced ? undefined : { scale: 0.92 }}
              transition={spring.pop}
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-white dark:bg-surface-800 border border-primary-200 dark:border-primary-500/30 shadow-float origin-bottom-right"
            >
              <VyronAvatar size={40} state="idle" />
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* Chat */}
      <AnimatePresence>
      {open && (
        <motion.div
          key="vyron-panel"
          role="dialog"
          aria-label="Vyron"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: dur.fast, ease: easeOut } }}
          transition={spring.snappy}
          className="fixed bottom-nav md:bottom-6 right-2 left-2 md:right-6 md:left-auto z-[45] w-auto md:w-96 max-h-[min(78dvh,640px)] flex flex-col bg-white dark:bg-surface-900 rounded-3xl shadow-float border border-surface-200 dark:border-surface-800 overflow-hidden origin-bottom-right"
        >
          {/* Header */}
          <div className="flex items-center gap-3 pl-4 pr-2 py-2.5 border-b border-surface-100 dark:border-surface-800">
            <div className="w-11 h-11 bg-primary-50 dark:bg-primary-500/15 rounded-2xl flex items-center justify-center">
              <VyronAvatar size={36} state={loading ? 'thinking' : 'idle'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-surface-900 dark:text-white">Vyron</div>
              <div className="text-xs text-surface-500 dark:text-surface-400" aria-live="polite">{loading ? t('v.ai.thinking') : t('v.ai.status')}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
              className="pressable w-11 h-11 rounded-full flex items-center justify-center text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200 transition"
            >
              <X className="w-5 h-5" aria-hidden />
            </button>
          </div>

          {/* Pet selector */}
          {pets.length > 0 && (
            <div className="px-3 py-2 border-b border-surface-100 dark:border-surface-800 relative">
              <button
                onClick={() => setPetDropdown(v => !v)}
                type="button"
                aria-expanded={petDropdown}
                className="w-full min-h-[44px] flex items-center gap-2 px-3 rounded-xl bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition text-sm"
              >
                <SpeciesIcon species={selectedPet?.species} className="w-4 h-4 text-primary-700 dark:text-primary-300" />
                <span className="text-surface-700 dark:text-surface-200 font-medium">
                  {selectedPet?.name ?? t('v.side.selectPet')}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-surface-400 ml-auto transition-transform', petDropdown && 'rotate-180')} />
              </button>
              {petDropdown && (
                <div className="absolute left-3 right-3 top-full mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-float z-10 overflow-hidden">
                  {pets.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPetId(p.id); setPetDropdown(false) }}
                      type="button"
                      className="w-full min-h-[44px] flex items-center gap-2 px-3 hover:bg-primary-50 dark:hover:bg-primary-500/10 text-sm text-left text-surface-800 dark:text-surface-100"
                    >
                      <SpeciesIcon species={p.species} className="w-4 h-4 text-surface-500 dark:text-surface-400" />
                      <span>{p.name}</span>
                      {p.id === selectedPetId && <Check className="ml-auto w-4 h-4 text-primary-700 dark:text-primary-300" aria-hidden />}
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
                  <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
                    <VyronAvatar size={26} state="idle" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950 rounded-tr-sm'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-100 rounded-tl-sm'
                  )}
                >
                  {msg.upsell ? (
                    <span className="block">
                      <span className="block font-semibold mb-1">{t('v.ai.upsellTitle')}</span>
                      <span className="block text-[13px] opacity-90">
                        {usageRef.current && usageRef.current.restam <= 3
                          ? t('v.ai.upsellLow', { n: usageRef.current.restam })
                          : t('v.ai.upsellBody')}
                      </span>
                      <a href="/plans" className="inline-flex items-center mt-2 min-h-[36px] bg-primary-700 hover:bg-primary-800 text-white dark:bg-primary-500 dark:text-surface-950 text-xs font-semibold px-3 rounded-lg transition">
                        {t('v.ai.upsellCta')}
                      </a>
                    </span>
                  ) : msg.contentKey ? t(msg.contentKey) : msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center shrink-0">
                  <VyronAvatar size={26} state="thinking" />
                </div>
                <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-tl-sm px-3 py-2">
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
          <div className="px-3 py-3 border-t border-surface-100 dark:border-surface-800 flex gap-2 shrink-0 pb-keyboard">
            <label htmlFor="vyron-input" className="sr-only">{t('v.ai.placeholder')}</label>
            <input
              id="vyron-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage() }}
              onFocus={() => {
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 250)
              }}
              placeholder={t('v.ai.placeholder')}
              className="flex-1 min-w-0 min-h-[44px] text-base px-3 border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              inputMode="text"
              enterKeyHint="send"
            />
            <button
              onClick={sendMessage}
              aria-label={t('v.ai.send')}
              disabled={!input.trim() || loading}
              type="button"
              className="tap-target bg-primary-700 text-white dark:bg-primary-500 dark:text-surface-950 rounded-xl flex items-center justify-center hover:bg-primary-800 dark:hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition px-3"
            >
              <Send className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  )
}
