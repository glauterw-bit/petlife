'use client'

import { useEffect, useState } from 'react'
import { BellRing, BellOff, X } from 'lucide-react'
import { getPushPermission } from '@/lib/push'
import { useT } from '@/contexts/LocaleContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PushPrimer } from '@/components/ui/PushPrimer'

const DISMISS_KEY = 'petlife_home_push_card_dismissed'

/**
 * "Ativar avisos" com contexto: só aparece quando a permissão ainda não foi
 * decidida e já existe ao menos uma vacina registrada (há o que avisar).
 * Negado → cartão curto que abre o estado negado do PushPrimer (texto AA,
 * "Abrir Ajustes" no iOS e o caminho por extenso). Pode ser dispensado.
 */
export function PushCard({
  hasVaccine,
  petName,
  vaccineName,
}: {
  hasVaccine: boolean
  petName: string
  vaccineName?: string
}) {
  const t = useT()
  const [perm, setPerm] = useState<'granted' | 'denied' | 'prompt' | 'unsupported' | null>(null)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(!!localStorage.getItem(DISMISS_KEY))
    } catch {
      setDismissed(false)
    }
    let alive = true
    getPushPermission().then(p => { if (alive) setPerm(p) })
    return () => { alive = false }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setDismissed(true)
  }

  async function onClosePrimer() {
    setOpen(false)
    setPerm(await getPushPermission())
  }

  if (!hasVaccine || perm === null || perm === 'granted' || perm === 'unsupported') return null

  const denied = perm === 'denied'
  const Icon = denied ? BellOff : BellRing

  return (
    <>
      {!dismissed && (
        <Card padding="sm" className="mb-5 flex items-start gap-3 pl-3.5">
          <span
            className={
              denied
                ? 'w-10 h-10 rounded-xl bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-200 flex items-center justify-center shrink-0'
                : 'w-10 h-10 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 flex items-center justify-center shrink-0'
            }
          >
            <Icon className="w-5 h-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-surface-900 dark:text-white">{t(denied ? 'home2.push.deniedTitle' : 'home.push.title')}</div>
            <div className="text-xs text-surface-600 dark:text-surface-300 leading-snug">{t(denied ? 'home2.push.deniedText' : 'home.push.text')}</div>
            <Button size="sm" variant={denied ? 'secondary' : 'soft'} onClick={() => setOpen(true)} className="mt-2">
              {t(denied ? 'home2.push.deniedCta' : 'home.push.cta')}
            </Button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('home.push.dismiss')}
            className="pressable -mr-1.5 -mt-1 w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-surface-500 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </Card>
      )}
      <PushPrimer open={open} onClose={onClosePrimer} petName={petName} vaccineName={vaccineName} />
    </>
  )
}
