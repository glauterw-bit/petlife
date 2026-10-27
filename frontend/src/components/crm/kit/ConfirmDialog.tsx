'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, m } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { Btn, Input, TextArea } from '../ui'
import { useFocusTrap, useLayer } from './layers'

export interface ConfirmOptions { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: 'danger' | 'primary' }
export interface PromptOptions extends ConfirmOptions { label: string; placeholder?: string; minLength?: number; multiline?: boolean; initial?: string }

type Pending =
  | { kind: 'confirm'; o: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; o: PromptOptions; resolve: (v: string | null) => void }

const Ctx = createContext<{ confirm: (o: ConfirmOptions) => Promise<boolean>; prompt: (o: PromptOptions) => Promise<string | null> } | null>(null)

/** Confirmações e perguntas do CRM (no lugar do confirm() do navegador). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ kind: 'confirm', o, resolve })), [])
  const prompt = useCallback((o: PromptOptions) => new Promise<string | null>(resolve => setPending({ kind: 'prompt', o, resolve })), [])

  const close = (value: boolean | string | null) => {
    if (!pending) return
    if (pending.kind === 'confirm') pending.resolve(value === true)
    else pending.resolve(typeof value === 'string' ? value : null)
    setPending(null)
  }

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}
      {mounted && createPortal(
        <AnimatePresence>{pending && <Dialog key="dlg" pending={pending} onDone={close} />}</AnimatePresence>,
        document.body,
      )}
    </Ctx.Provider>
  )
}

export function useConfirm() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useConfirm fora do ConfirmProvider')
  return c
}

function Dialog({ pending, onDone }: { pending: Pending; onDone: (v: boolean | string | null) => void }) {
  const o = pending.o
  const isPrompt = pending.kind === 'prompt'
  const p = isPrompt ? (o as PromptOptions) : null
  const [text, setText] = useState(p?.initial ?? '')
  const [err, setErr] = useState('')
  const cancel = () => onDone(isPrompt ? null : false)
  const { z, isTop } = useLayer(true, cancel)
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const inputId = useId()
  useFocusTrap(true, ref, isTop, isPrompt ? 'field' : 'first')
  const danger = o.tone === 'danger'

  const ok = () => {
    if (!isPrompt) { onDone(true); return }
    const v = text.trim()
    const min = p?.minLength ?? 1
    if (v.length < min) { setErr(min > 1 ? `Escreva pelo menos ${min} caracteres.` : 'Preencha o campo.'); return }
    onDone(v)
  }

  return (
    <div className="crm-layer fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: z }}>
      <m.div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden onClick={cancel}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} />
      <m.div
        ref={ref} role="alertdialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="relative w-full max-w-[420px] rounded-2xl bg-panel text-ink shadow-crm-pop p-5 outline-none"
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        <form onSubmit={e => { e.preventDefault(); ok() }}>
          <div className="flex gap-3">
            {danger && (
              <span className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300 inline-flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-lg font-extrabold leading-tight">{o.title}</h2>
              {o.message && <div className="text-sm text-muted mt-1.5">{o.message}</div>}
            </div>
          </div>
          {p && (
            <div className="mt-4">
              <label htmlFor={inputId} className="block text-xs font-semibold text-ink/80 mb-1">{p.label}</label>
              {p.multiline
                ? <TextArea id={inputId} rows={3} value={text} placeholder={p.placeholder} onChange={e => { setText(e.target.value); setErr('') }}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ok() } }} />
                : <Input id={inputId} value={text} placeholder={p.placeholder} onChange={e => { setText(e.target.value); setErr('') }} />}
              {err && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1">{err}</p>}
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Btn variant="ghost" onClick={cancel} data-autofocus={!isPrompt && danger ? true : undefined}>{o.cancelLabel ?? 'Cancelar'}</Btn>
            <Btn type="submit" variant={danger ? 'danger' : 'primary'} data-autofocus={!isPrompt && !danger ? true : undefined}
              className={danger ? '!bg-red-600 !text-white hover:!bg-red-700 dark:!bg-red-500 dark:hover:!bg-red-400' : ''}>
              {o.confirmLabel ?? 'Confirmar'}
            </Btn>
          </div>
        </form>
      </m.div>
    </div>
  )
}
