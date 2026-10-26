'use client'

/**
 * Peças compartilhadas das telas de entrada (login, cadastro, recuperar e
 * redefinir senha): moldura com logo, campo com rótulo ligado (htmlFor/id),
 * campo de senha com mostrar/ocultar acessível e avisos com par escuro.
 */
import Link from 'next/link'
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Eye, EyeOff, PawPrint, AlertCircle, Info, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useT } from '@/contexts/LocaleContext'
import { cn } from '@/lib/utils'
import { spring, variants } from '@/lib/motion'

export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
  top,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  /** Conteúdo acima do título (ex.: faixa de convite). */
  top?: ReactNode
}) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 flex items-center justify-center px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <motion.div
        className="w-full max-w-md"
        variants={variants.fadeUp}
        initial="hidden"
        animate="show"
        transition={spring.soft}
      >
        <div className="text-center mb-7">
          <Link href="/" className="inline-flex flex-col items-center gap-2.5 rounded-2xl" aria-label="PetLife">
            <span className="w-14 h-14 bg-primary-700 dark:bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-700/20">
              <PawPrint className="w-8 h-8 text-white dark:text-surface-950" aria-hidden />
            </span>
            <span className="text-xl font-display font-extrabold text-surface-900 dark:text-white">PetLife</span>
          </Link>
          {top}
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-surface-900 dark:text-white mt-4">{title}</h1>
          {subtitle && <p className="text-[15px] text-surface-600 dark:text-surface-400 mt-1">{subtitle}</p>}
        </div>
        <div className="bg-white dark:bg-surface-900 rounded-3xl shadow-card border border-surface-200/70 dark:border-surface-800 p-5 sm:p-8">
          {children}
        </div>
        {footer}
      </motion.div>
    </div>
  )
}

const TONES = {
  danger: { cls: 'tone-danger-bg text-red-800 dark:text-red-200', Icon: AlertCircle },
  info: { cls: 'tone-brand-bg text-primary-900 dark:text-primary-200', Icon: Info },
  success: { cls: 'tone-success-bg text-emerald-900 dark:text-emerald-200', Icon: CheckCircle2 },
  warning: { cls: 'tone-warning-bg text-amber-900 dark:text-amber-200', Icon: AlertTriangle },
} as const

export function Notice({
  tone,
  children,
  className,
  icon,
}: {
  tone: keyof typeof TONES
  children: ReactNode
  className?: string
  icon?: LucideIcon
}) {
  const { cls, Icon: DefaultIcon } = TONES[tone]
  const Icon = icon ?? DefaultIcon
  return (
    <motion.div
      role={tone === 'danger' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.snappy}
      className={cn('flex items-start gap-2.5 rounded-xl border p-3 text-sm leading-snug', cls, className)}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0">{children}</div>
    </motion.div>
  )
}

export const fieldClasses =
  'w-full py-3 border border-surface-200 dark:border-surface-700 rounded-xl text-[15px] bg-white dark:bg-surface-950 text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition'

type FieldProps = {
  label: string
  icon?: LucideIcon
  hint?: string
} & InputHTMLAttributes<HTMLInputElement>

export const AuthField = forwardRef<HTMLInputElement, FieldProps>(function AuthField(
  { label, icon: Icon, hint, id, className, ...rest },
  ref,
) {
  const auto = useId()
  const inputId = id ?? auto
  const hintId = hint ? `${inputId}-hint` : undefined
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400 pointer-events-none" aria-hidden />}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={hintId}
          className={cn(fieldClasses, Icon ? 'pl-10 pr-4' : 'px-4', className)}
          {...rest}
        />
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-surface-500 dark:text-surface-400">
          {hint}
        </p>
      )}
    </div>
  )
})

export function PasswordField({
  label,
  icon: Icon,
  hint,
  id,
  show: showProp,
  onToggle,
  ...rest
}: FieldProps & { show?: boolean; onToggle?: () => void }) {
  const t = useT()
  const auto = useId()
  const inputId = id ?? auto
  const hintId = hint ? `${inputId}-hint` : undefined
  const [own, setOwn] = useState(false)
  const show = showProp ?? own
  const toggle = onToggle ?? (() => setOwn(v => !v))
  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400 pointer-events-none" aria-hidden />}
        <input
          id={inputId}
          type={show ? 'text' : 'password'}
          aria-describedby={hintId}
          className={cn(fieldClasses, Icon ? 'pl-10' : 'pl-4', 'pr-12')}
          {...rest}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={show ? t('ac.pass.hide') : t('ac.pass.show')}
          aria-pressed={show}
          aria-controls={inputId}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center rounded-xl text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
        >
          {show ? <EyeOff className="w-5 h-5" aria-hidden /> : <Eye className="w-5 h-5" aria-hidden />}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-surface-500 dark:text-surface-400">
          {hint}
        </p>
      )}
    </div>
  )
}

/** Link de texto com alvo de toque de 44 px. */
export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center min-h-[44px] px-1 font-semibold text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200',
        className,
      )}
    >
      {children}
    </Link>
  )
}
