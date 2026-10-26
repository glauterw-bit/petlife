'use client'

/**
 * Funil de upgrade: escuta o evento global `petlife:quota` (disparado pelo api.ts
 * quando o backend responde 402 — limite do plano atingido) e converte o "erro"
 * em convite pra assinar, com CTA direto pra /plans.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { hapticWarning } from '@/lib/feedback'
import { track } from '@/lib/track'
import { useT } from '@/contexts/LocaleContext'

export function QuotaUpsellModal() {
  const router = useRouter()
  const t = useT()
  const [message, setMessage] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onQuota = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail
      setMessage(detail?.message || t('ac.quota.defaultMsg'))
      setOpen(true)
      track('paywall_shown')
      void hapticWarning()
    }
    window.addEventListener('petlife:quota', onQuota)
    return () => window.removeEventListener('petlife:quota', onQuota)
  }, [t])

  // A mensagem fica guardada durante a animação de saída da folha.
  const close = () => setOpen(false)

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('ac.quota.title')}
      footer={
        <div className="space-y-2">
          <Button size="lg" fullWidth leftIcon={Crown} onClick={() => { close(); router.push('/plans') }}>
            {t('ac.quota.cta')}
          </Button>
          <Button variant="ghost" fullWidth onClick={close}>
            {t('ac.quota.later')}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <span className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
          <Crown className="w-6 h-6 text-amber-600 dark:text-amber-400" aria-hidden />
        </span>
        <p className="text-[15px] text-surface-700 dark:text-surface-300 leading-relaxed">{message}</p>
      </div>
    </Sheet>
  )
}
