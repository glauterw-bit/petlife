'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '@/contexts/LocaleContext'
import { hapticWarning } from '@/lib/feedback'
import { Sheet } from './Sheet'
import { Button } from './Button'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Substitui window.confirm por uma folha com dois botões. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>(o => {
    // se já havia uma pergunta aberta, ela é respondida como "não"
    resolver.current?.(false)
    setOpts(o)
    setOpen(true)
    return new Promise<boolean>(resolve => {
      resolver.current = resolve
    })
  }, [])

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpen(false)
  }, [])

  useEffect(() => {
    if (open && opts?.tone === 'danger') void hapticWarning()
  }, [open, opts])

  const danger = opts?.tone === 'danger'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={open}
        onClose={() => settle(false)}
        title={opts?.title}
        description={opts?.message}
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="secondary" fullWidth className="sm:w-auto" onClick={() => settle(false)}>
              {opts?.cancelLabel ?? t('ui.confirm.cancel')}
            </Button>
            <Button
              variant={danger ? 'danger' : 'primary'}
              fullWidth
              className="sm:w-auto"
              data-autofocus
              onClick={() => settle(true)}
            >
              {opts?.confirmLabel ?? (danger ? t('ui.confirm.delete') : t('ui.confirm.ok'))}
            </Button>
          </div>
        }
      >
        {null}
      </Sheet>
    </ConfirmContext.Provider>
  )
}

/**
 * const confirm = useConfirm(); if (await confirm({ title, tone: 'danger' })) …
 * Fora do provider, cai no window.confirm (nunca quebra).
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  return (
    ctx ??
    (async (o: ConfirmOptions) =>
      typeof window !== 'undefined' ? window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title) : false)
  )
}
