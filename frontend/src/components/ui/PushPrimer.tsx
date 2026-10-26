'use client'

/**
 * Pedido de notificação COM contexto — aparece logo depois da 1ª vacina
 * registrada (nunca a frio). A antecedência citada no texto ("7 dias antes e
 * no dia") é a que o servidor manda e a que lib/notifications.ts agenda.
 *
 * Negado: não dá para pedir de novo pelo app (o iOS não deixa). Oferece
 * "Abrir Ajustes" (esquema app-settings: no app nativo) e mantém o caminho
 * por extenso, caso o esquema não abra a tela certa no aparelho.
 */
import { useEffect, useState } from 'react'
import { BellRing, BellOff, Settings } from 'lucide-react'
import { useT } from '@/contexts/LocaleContext'
import { getPushPermission, requestPushPermission } from '@/lib/push'
import { haptic } from '@/lib/feedback'
import { Sheet } from './Sheet'
import { Button } from './Button'

export const PUSH_PRIMER_SEEN_KEY = 'petlife_push_primer_seen'

/** True se o primer já foi mostrado neste aparelho. */
export function pushPrimerSeen(): boolean {
  try {
    return !!localStorage.getItem(PUSH_PRIMER_SEEN_KEY)
  } catch {
    return false
  }
}

function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }
  return !!w.Capacitor?.isNativePlatform?.()
}

/** Abre os Ajustes do app no iOS. Fora do app nativo não faz nada. */
export function openAppSettings(): void {
  if (!isNativeApp()) return
  try {
    window.location.href = 'app-settings:'
  } catch {}
}

function markSeen() {
  try {
    localStorage.setItem(PUSH_PRIMER_SEEN_KEY, String(Date.now()))
  } catch {}
}

export function PushPrimer({
  open,
  onClose,
  petName,
  vaccineName,
}: {
  open: boolean
  onClose: () => void
  petName: string
  vaccineName?: string
}) {
  const t = useT()
  const [perm, setPerm] = useState<'granted' | 'denied' | 'prompt' | 'unsupported' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    markSeen()
    let alive = true
    getPushPermission().then(p => {
      if (!alive) return
      setPerm(p)
      // já permitido: nada a pedir
      if (p === 'granted') onClose()
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function enable() {
    setBusy(true)
    const ok = await requestPushPermission()
    setBusy(false)
    if (ok) {
      haptic('saved')
      onClose()
    } else {
      setPerm(await getPushPermission())
    }
  }

  const denied = perm === 'denied'
  const [native, setNative] = useState(false)
  useEffect(() => setNative(isNativeApp()), [])
  const body = vaccineName
    ? t('ui.push.body', { pet: petName, vaccine: vaccineName })
    : t('ui.push.bodyNoVaccine', { pet: petName })

  return (
    <Sheet
      open={open && perm !== 'granted'}
      onClose={onClose}
      ariaLabel={t('ui.push.title')}
      footer={
        denied ? (
          <div className="flex flex-col gap-2">
            {native && (
              <Button fullWidth size="lg" variant="secondary" leftIcon={Settings} onClick={openAppSettings} data-autofocus>
                {t('ui2.push.openSettings')}
              </Button>
            )}
            <Button fullWidth variant={native ? 'ghost' : 'secondary'} size={native ? undefined : 'lg'} onClick={onClose}>
              {t('ui.push.gotIt')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button fullWidth size="lg" leftIcon={BellRing} loading={busy} onClick={enable} data-autofocus>
              {t('ui.push.enable')}
            </Button>
            <Button fullWidth variant="ghost" onClick={onClose}>
              {t('ui.push.later')}
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col items-center text-center pt-2 pb-1">
        <span className="w-16 h-16 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300 flex items-center justify-center mb-4">
          {denied ? <BellOff className="w-7 h-7" aria-hidden /> : <BellRing className="w-7 h-7" aria-hidden />}
        </span>
        <h2 className="font-display text-xl font-extrabold text-surface-900 dark:text-white leading-snug">{t('ui.push.title')}</h2>
        <p className="mt-2 text-[15px] text-surface-600 dark:text-surface-300 max-w-xs">{denied ? t('ui2.push.deniedShort') : body}</p>
        {denied && (
          <p className="mt-2 text-[13px] text-surface-600 dark:text-surface-300 max-w-xs">{t('ui2.push.settingsPath')}</p>
        )}
      </div>
    </Sheet>
  )
}
