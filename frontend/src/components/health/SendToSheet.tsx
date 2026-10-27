'use client'

/**
 * "Enviar para…" — uma folha só: escolhe o destino (hotel e creche, banho e
 * tosa, veterinário, outro), vê a prévia da mensagem e envia pelo WhatsApp,
 * pela folha de compartilhar do sistema, em PDF ou impresso. A mensagem
 * sempre leva o link público, que se mantém atualizado.
 *
 * Confirmação do envio: a folha fecha e o ícone do botão "Enviar" da tela
 * vira um check por 1,2 s (SendFlashIcon + useSendFlash), com haptic('saved').
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import {
  Check, ChevronLeft, ChevronRight, FileText, Hotel, MessageCircle, Printer, Scissors, Send, Share2, Stethoscope,
  type LucideIcon,
} from 'lucide-react'
import { useT } from '@/contexts/LocaleContext'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { haptic } from '@/lib/feedback'
import { track } from '@/lib/track'
import { trackHappyMoment } from '@/lib/review'
import { dur, easeOut, spring, usePrefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Tempo que o check fica no lugar do ícone de enviar. */
const SENT_FLASH_MS = 1200

/**
 * Liga o check por 1,2 s. Se o envio levou o tutor para fora do app
 * (WhatsApp, folha do sistema), espera ele voltar para a tela — senão o
 * check aconteceria sem ninguém ver.
 */
export function useSendFlash(): { sent: boolean; flash: () => void } {
  const [sent, setSent] = useState(false)
  const timer = useRef<number | null>(null)
  const pending = useRef<(() => void) | null>(null)

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
    if (pending.current) document.removeEventListener('visibilitychange', pending.current)
  }, [])

  const flash = useCallback(() => {
    const start = () => {
      if (timer.current) window.clearTimeout(timer.current)
      setSent(true)
      timer.current = window.setTimeout(() => setSent(false), SENT_FLASH_MS)
    }
    if (typeof document !== 'undefined' && document.hidden) {
      if (pending.current) document.removeEventListener('visibilitychange', pending.current)
      const onVisible = () => {
        if (document.hidden) return
        document.removeEventListener('visibilitychange', onVisible)
        pending.current = null
        start()
      }
      pending.current = onVisible
      document.addEventListener('visibilitychange', onVisible)
      return
    }
    start()
  }, [])

  return { sent, flash }
}

/** Ícone Send que troca por Check com um "pop" (só a troca, com reduced motion). */
export function SendFlashIcon({ sent, className }: { sent: boolean; className?: string }) {
  const reduced = usePrefersReducedMotion()
  const enter = reduced ? { opacity: 1 } : { opacity: 0, scale: 0.4 }
  const exit = reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.6 }
  return (
    <span className={cn('relative inline-flex w-4 h-4 shrink-0', className)} aria-hidden>
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={sent ? 'check' : 'send'}
          initial={enter}
          animate={{ opacity: 1, scale: 1 }}
          exit={exit}
          transition={reduced ? { duration: 0 } : spring.pop}
          className="absolute inset-0 inline-flex"
        >
          {sent ? <Check className="w-full h-full" strokeWidth={2.75} /> : <Send className="w-full h-full" />}
        </m.span>
      </AnimatePresence>
    </span>
  )
}

export type SendDest = 'hotel' | 'groomer' | 'vet' | 'other'

const DESTS: Array<{ id: SendDest; Icon: LucideIcon; labelKey: string }> = [
  { id: 'hotel', Icon: Hotel, labelKey: 'wallet.destHotel' },
  { id: 'groomer', Icon: Scissors, labelKey: 'wallet.destGroomer' },
  { id: 'vet', Icon: Stethoscope, labelKey: 'wallet.destVet' },
  { id: 'other', Icon: Send, labelKey: 'wallet.destOther' },
]

export function SendToSheet({
  open,
  onClose,
  petName,
  shareUrl,
  onPdf,
  onPrint,
  onSent,
}: {
  open: boolean
  onClose: () => void
  petName: string
  shareUrl: string
  onPdf: () => Promise<void> | void
  onPrint?: () => void
  /** Depois de um envio (WhatsApp, compartilhar ou PDF). */
  onSent?: (dest: SendDest, channel: 'whatsapp' | 'share' | 'pdf') => void
}) {
  const t = useT()
  const [dest, setDest] = useState<SendDest | null>(null)
  const [canShare, setCanShare] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (!open) {
      const id = window.setTimeout(() => setDest(null), 300)
      return () => window.clearTimeout(id)
    }
  }, [open])

  const message = dest
    ? dest === 'other'
      ? t('h.card.shareWhatsAppText', { name: petName, url: shareUrl })
      : t(`h.card.sendText.${dest}`, { name: petName, url: shareUrl })
    : ''

  function done(channel: 'whatsapp' | 'share' | 'pdf') {
    if (!dest) return
    haptic('saved')
    onSent?.(dest, channel)
    onClose()
  }

  function whatsapp() {
    if (!dest) return
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
    track(dest === 'other' ? 'carteirinha_whatsapp' : `carteirinha_send_${dest}`)
    trackHappyMoment('carteirinha_whatsapp')
    done('whatsapp')
  }

  async function share() {
    if (!dest || !navigator.share) return
    try {
      await navigator.share({ title: t('h.card.shareTitle', { name: petName }), text: message, url: shareUrl })
      track('carteirinha_share')
      trackHappyMoment('carteirinha_share')
      done('share')
    } catch {
      /* cancelado pelo usuário */
    }
  }

  async function pdf() {
    if (pdfBusy) return
    setPdfBusy(true)
    try {
      await onPdf()
      done('pdf')
    } catch {
      /* a tela mostra o erro */
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('wallet.sendTitle', { pet: petName })}
      description={t('wallet.sendDesc')}
      footer={
        dest ? (
          <div className="space-y-2">
            <Button size="lg" fullWidth leftIcon={MessageCircle} onClick={whatsapp} data-autofocus>
              {t('wallet.whatsapp')}
            </Button>
            <div className={canShare ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
              {canShare && (
                <Button variant="secondary" leftIcon={Share2} onClick={share} className="px-2">
                  {t('wallet.share')}
                </Button>
              )}
              <Button variant="secondary" leftIcon={FileText} loading={pdfBusy} onClick={pdf} className="px-2">
                {t('wallet.pdf')}
              </Button>
              {onPrint && (
                <Button
                  variant="secondary"
                  leftIcon={Printer}
                  className="px-2"
                  onClick={() => {
                    onClose()
                    window.setTimeout(onPrint, 320)
                  }}
                >
                  {t('wallet.print')}
                </Button>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {!dest ? (
          <m.div
            key="dests"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: dur.fast, ease: easeOut }}
            className="grid grid-cols-2 gap-2.5 pb-1"
          >
            {DESTS.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDest(d.id)}
                className="pressable min-h-[96px] rounded-2xl border border-surface-200 bg-white p-3.5 text-left flex flex-col justify-between hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-800/60 dark:hover:bg-surface-800"
              >
                <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 flex items-center justify-center">
                  <d.Icon className="w-5 h-5" aria-hidden />
                </span>
                <span className="flex items-center justify-between gap-1 text-[15px] font-semibold text-surface-900 dark:text-white">
                  {t(d.labelKey)}
                  <ChevronRight className="w-4 h-4 text-surface-400" aria-hidden />
                </span>
              </button>
            ))}
          </m.div>
        ) : (
          <m.div
            key="preview"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: dur.fast, ease: easeOut }}
            className="pb-1"
          >
            <Button variant="ghost" size="sm" leftIcon={ChevronLeft} className="-ml-2 mb-2" onClick={() => setDest(null)}>
              {t('wallet.changeDest')}
            </Button>
            <p className="text-[11px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-2">
              {t('wallet.preview')} · {t(DESTS.find(d => d.id === dest)!.labelKey)}
            </p>
            <div className="rounded-2xl bg-surface-100 dark:bg-surface-950 p-3">
              <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md bg-emerald-100 text-surface-900 dark:bg-emerald-900/60 dark:text-emerald-50 px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-line break-words shadow-sm">
                {message}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </Sheet>
  )
}
