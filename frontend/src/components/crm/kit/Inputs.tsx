'use client'

import { useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Search, X, type LucideIcon } from 'lucide-react'
import { spring } from '../motion'
import { useHotkey } from './hooks'

type NumProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onChange: (raw: string) => void }

const wrapCls = 'flex items-center h-9 rounded-lg border border-line bg-panel dark:bg-panel-2/40 transition-shadow focus-within:border-primary-500 focus-within:shadow-crm-glow'
const innerCls = 'min-w-0 flex-1 h-full bg-transparent px-3 text-sm text-ink tabular-nums placeholder:text-muted/70 outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60'

function clean(v: string, neg: boolean) {
  let s = v.replace(neg ? /[^\d.,-]/g : /[^\d.,]/g, '')
  if (neg) s = s.replace(/(?!^)-/g, '')
  return s
}

/** Valor em reais como texto (aceita '12,50', '1.234,56'); converta com parseMoney. */
export function MoneyInput({ value, onChange, className = '', ...p }: NumProps) {
  return (
    <div className={`${wrapCls} ${className}`}>
      <span className="pl-3 text-sm text-muted select-none" aria-hidden>R$</span>
      <input {...p} type="text" inputMode="decimal" autoComplete="off" value={value}
        onChange={e => onChange(clean(e.target.value, false))} className={`${innerCls} pl-1.5`} />
    </div>
  )
}

/** Quantidade, peso ou duração como texto ('0,5'); converta com parseDecimal. */
export function DecimalInput({ value, onChange, suffix, allowNegative, className = '', ...p }: NumProps & { suffix?: string; allowNegative?: boolean }) {
  return (
    <div className={`${wrapCls} ${className}`}>
      <input {...p} type="text" inputMode={allowNegative ? 'text' : 'decimal'} autoComplete="off" value={value}
        onChange={e => onChange(clean(e.target.value, !!allowNegative))} className={innerCls} />
      {suffix && <span className="pr-3 text-sm text-muted select-none" aria-hidden>{suffix}</span>}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Buscar', autoFocus, shortcut, className = '', ariaLabel }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; shortcut?: string; className?: string; ariaLabel?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  useHotkey(shortcut || '', e => { e.preventDefault(); ref.current?.focus(); ref.current?.select() }, { when: !!shortcut })
  return (
    <div className={`${wrapCls} ${className}`}>
      <Search className="ml-3 w-4 h-4 text-muted shrink-0" strokeWidth={1.75} aria-hidden />
      <input ref={ref} type="search" value={value} autoFocus={autoFocus} placeholder={placeholder} aria-label={ariaLabel ?? placeholder}
        onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.key === 'Escape' && value) { e.stopPropagation(); onChange('') } }}
        className={`${innerCls} pl-2 [&::-webkit-search-cancel-button]:hidden`} />
      {value ? (
        <button type="button" onClick={() => { onChange(''); ref.current?.focus() }} aria-label="Limpar busca"
          className="mr-1 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-panel-2">
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      ) : shortcut && !focused ? (
        <kbd className="mr-2 hidden sm:inline-flex h-5 min-w-5 items-center justify-center rounded border border-line px-1.5 text-2xs font-medium text-muted">{shortcut}</kbd>
      ) : null}
    </div>
  )
}

export function Chip({ active, onClick, children, count, icon: Icon }: { active?: boolean; onClick?: () => void; children: ReactNode; count?: number; icon?: LucideIcon }) {
  return (
    <motion.button type="button" aria-pressed={!!active} onClick={onClick} whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
        ${active ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-surface-950' : 'bg-panel text-ink shadow-crm-card hover:bg-panel-2'}`}>
      {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />}
      {children}
      {count != null && <span className={`tabular-nums rounded-full px-1.5 text-2xs ${active ? 'bg-white/20' : 'bg-panel-2 text-muted'}`}>{count}</span>}
    </motion.button>
  )
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary-600 dark:bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'}`}>
        <motion.span layout transition={spring.snappy}
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${checked ? 'right-0.5' : 'left-0.5'}`} />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
      </span>
    </label>
  )
}
